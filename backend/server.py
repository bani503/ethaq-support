from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING
import os
import logging
import uuid
import httpx
import stripe
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------- Config ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')
stripe.api_key = STRIPE_SECRET_KEY

FRONTEND_BASE = "https://covenant-app-4.preview.emergentagent.com"

FREE_DEDICATIONS_PER_MONTH = 5

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class TasbihUpdate(BaseModel):
    device_id: str
    count: int


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    session_id: str


class SessionCreateRequest(BaseModel):
    session_token: str


class DedicationCreate(BaseModel):
    recipient_name: str
    phone_number: Optional[str] = ""
    dedication_type: str = "dua"  # dua | khatmah | tasbih | sadaqah
    message: Optional[str] = ""


class FamilyCreate(BaseModel):
    name: str


class FamilyJoin(BaseModel):
    code: str


class CheckoutRequest(BaseModel):
    plan: str  # "monthly" or "yearly"


# ---------- Startup ----------
@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index([("email", ASCENDING)], unique=True)
        await db.users.create_index([("user_id", ASCENDING)], unique=True)
        await db.user_sessions.create_index([("session_token", ASCENDING)], unique=True)
        await db.user_sessions.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0)
        await db.families.create_index([("code", ASCENDING)], unique=True)
    except Exception:
        logging.exception("index creation error")


# ---------- Auth helpers ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    exp = sess.get("expires_at")
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            return None
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    return user


async def require_user(authorization: Optional[str] = Header(None)) -> dict:
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def _sanitize_user(u: dict) -> dict:
    """Return a JSON-safe user dict — strips MongoDB _id and datetime is left as-is via BaseModel."""
    if not u:
        return {}
    out = {k: v for k, v in u.items() if k != "_id"}
    # datetimes → iso
    for k, v in list(out.items()):
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


# ---------- Islamic content ----------
DAILY_HADITHS = [
    {"text": "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى.", "source": "رواه البخاري ومسلم"},
    {"text": "مَنْ حُسْنِ إِسْلَامِ الْمَرْءِ تَرْكُهُ مَا لَا يَعْنِيهِ.", "source": "رواه الترمذي"},
    {"text": "لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ.", "source": "رواه البخاري ومسلم"},
    {"text": "الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ.", "source": "رواه البخاري"},
    {"text": "الدِّينُ النَّصِيحَةُ، قُلْنَا: لِمَنْ؟ قَالَ: لِلَّهِ وَلِكِتَابِهِ وَلِرَسُولِهِ وَلِأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ.", "source": "رواه مسلم"},
    {"text": "اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ.", "source": "رواه الترمذي"},
    {"text": "مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ.", "source": "رواه البخاري ومسلم"},
    {"text": "الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ.", "source": "رواه البخاري ومسلم"},
    {"text": "لَا تَحْقِرَنَّ مِنَ الْمَعْرُوفِ شَيْئًا، وَلَوْ أَنْ تَلْقَى أَخَاكَ بِوَجْهٍ طَلْقٍ.", "source": "رواه مسلم"},
    {"text": "مَنْ لَا يَرْحَمِ النَّاسَ لَا يَرْحَمْهُ اللَّهُ.", "source": "رواه البخاري ومسلم"},
    {"text": "تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ لَكَ صَدَقَةٌ.", "source": "رواه الترمذي"},
    {"text": "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ.", "source": "رواه مسلم"},
]


# ---------- Public routes ----------
@api_router.get("/")
async def root():
    return {"message": "إيثاق API"}


@api_router.get("/hadith/daily")
async def get_daily_hadith():
    day_of_year = datetime.now(timezone.utc).timetuple().tm_yday
    idx = day_of_year % len(DAILY_HADITHS)
    h = DAILY_HADITHS[idx]
    return {"hadith": h["text"], "source": h["source"], "day": day_of_year}


@api_router.get("/tasbih/{device_id}")
async def get_tasbih(device_id: str):
    doc = await db.tasbih.find_one({"device_id": device_id}, {"_id": 0})
    return {"device_id": device_id, "count": (doc or {}).get("count", 0)}


@api_router.post("/tasbih")
async def update_tasbih(body: TasbihUpdate):
    await db.tasbih.update_one(
        {"device_id": body.device_id},
        {"$set": {"count": body.count, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"device_id": body.device_id, "count": body.count}


@api_router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    system_msg = (
        "أنت (إيثاق)، مساعد إسلامي علمي راقٍ يُجيب باللغة العربية الفصحى المبسّطة. "
        "أجب عن الأسئلة الشرعية والفقهية والعقدية وأمور الحياة اليومية للمسلم وفق الكتاب والسنة "
        "ومنهج أهل العلم المعتبرين. اذكر الدليل من القرآن والسنة عند الحاجة. "
        "كن مختصراً واضحاً محترماً، وإن كنت لا تعلم فقل: (لا أعلم، والأولى سؤال أهل العلم)."
    )
    chat_client = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=body.session_id,
        system_message=system_msg,
    ).with_model("openai", "gpt-5.4")

    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": body.session_id,
        "role": "user",
        "content": body.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    try:
        reply_text = await chat_client.send_message(UserMessage(text=body.message))
    except Exception as e:
        logging.exception("LLM error")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
    await db.chat_messages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": body.session_id,
        "role": "assistant",
        "content": reply_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return ChatResponse(reply=reply_text, session_id=body.session_id)


@api_router.get("/chat/history/{session_id}")
async def get_history(session_id: str):
    cur = db.chat_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1)
    msgs = await cur.to_list(500)
    return {"session_id": session_id, "messages": msgs}


# ---------- Auth ----------
@api_router.post("/auth/session")
async def create_session(body: SessionCreateRequest):
    """Verify Emergent session_token, upsert user + create backend session."""
    session_token = body.session_token
    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            r = await client_http.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_token},
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session token")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("auth verify failed")
        raise HTTPException(status_code=502, detail=f"Auth verify failed: {e}")

    email = data.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Missing email")

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name"),
            "picture": data.get("picture"),
            "subscription_status": "inactive",
            "subscription_plan": None,
            "subscription_current_period_end": None,
            "stripe_customer_id": None,
            "free_dedications_used": 0,
            "free_dedications_period_start": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    # Delete any existing session with same token (should be unique anyway)
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": user_id,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": _sanitize_user(user)}


@api_router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": _sanitize_user(user)}


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return {"ok": True}
    token = authorization[7:]
    await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- Subscription ----------
def _plan_details(plan: str):
    if plan == "monthly":
        return {"amount": 300, "interval": "month", "name": "إيثاق بريميوم - شهري"}
    if plan == "yearly":
        return {"amount": 3000, "interval": "year", "name": "إيثاق بريميوم - سنوي"}
    return None


@api_router.post("/subscription/checkout")
async def create_checkout(body: CheckoutRequest, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    details = _plan_details(body.plan)
    if not details:
        raise HTTPException(status_code=400, detail="Invalid plan")

    # ensure stripe customer
    customer_id = user.get("stripe_customer_id")
    if not customer_id:
        try:
            customer = stripe.Customer.create(email=user["email"], name=user.get("name") or "")
            customer_id = customer.id
            await db.users.update_one(
                {"user_id": user["user_id"]},
                {"$set": {"stripe_customer_id": customer_id}},
            )
        except Exception as e:
            logging.exception("stripe customer create failed")
            raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "sar",
                    "product_data": {"name": details["name"]},
                    "unit_amount": details["amount"],
                    "recurring": {"interval": details["interval"]},
                },
                "quantity": 1,
            }],
            success_url=f"{FRONTEND_BASE}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{FRONTEND_BASE}/subscription/cancel",
            metadata={"user_id": user["user_id"], "plan": body.plan},
        )
        return {"checkout_url": session.url, "session_id": session.id}
    except Exception as e:
        logging.exception("stripe checkout failed")
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")


@api_router.get("/subscription/status")
async def subscription_status(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    active = user.get("subscription_status") == "active"
    return {
        "active": active,
        "plan": user.get("subscription_plan"),
        "current_period_end": user.get("subscription_current_period_end"),
    }


@api_router.get("/subscription/verify/{stripe_session_id}")
async def verify_checkout_session(stripe_session_id: str, authorization: Optional[str] = Header(None)):
    """Poll after checkout success to confirm and update user subscription."""
    user = await require_user(authorization)
    try:
        s = stripe.checkout.Session.retrieve(stripe_session_id, expand=["subscription"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    if s.get("payment_status") == "paid" or s.get("status") == "complete":
        sub = s.get("subscription")
        plan = (s.get("metadata") or {}).get("plan")
        current_period_end = None
        if sub and isinstance(sub, dict):
            cpe = sub.get("current_period_end")
            if cpe:
                current_period_end = datetime.fromtimestamp(cpe, tz=timezone.utc).isoformat()
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {
                "subscription_status": "active",
                "subscription_plan": plan,
                "subscription_current_period_end": current_period_end,
            }},
        )
        return {"active": True, "plan": plan, "current_period_end": current_period_end}
    return {"active": False}


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get("Stripe-Signature", "")
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            # Dev mode: parse without signature (test only)
            import json as _json
            event = _json.loads(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    etype = event.get("type")
    obj = (event.get("data") or {}).get("object") or {}

    if etype in ("customer.subscription.updated", "customer.subscription.created"):
        cust = obj.get("customer")
        status = obj.get("status")
        cpe = obj.get("current_period_end")
        current_period_end = (
            datetime.fromtimestamp(cpe, tz=timezone.utc).isoformat() if cpe else None
        )
        await db.users.update_one(
            {"stripe_customer_id": cust},
            {"$set": {
                "subscription_status": "active" if status in ("active", "trialing") else status,
                "subscription_current_period_end": current_period_end,
            }},
        )
    elif etype == "customer.subscription.deleted":
        cust = obj.get("customer")
        await db.users.update_one(
            {"stripe_customer_id": cust},
            {"$set": {"subscription_status": "canceled"}},
        )
    return {"ok": True}


# ---------- Dedications ----------
async def _refresh_monthly_quota(user: dict) -> dict:
    """Reset free_dedications_used at start of a new calendar month."""
    period = user.get("free_dedications_period_start")
    now = datetime.now(timezone.utc)
    reset = False
    if not period:
        reset = True
    else:
        try:
            pd = datetime.fromisoformat(period) if isinstance(period, str) else period
            if pd.tzinfo is None:
                pd = pd.replace(tzinfo=timezone.utc)
            if pd.year != now.year or pd.month != now.month:
                reset = True
        except Exception:
            reset = True
    if reset:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"free_dedications_used": 0, "free_dedications_period_start": now.isoformat()}},
        )
        user["free_dedications_used"] = 0
        user["free_dedications_period_start"] = now.isoformat()
    return user


@api_router.get("/dedications/quota")
async def dedication_quota(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    user = await _refresh_monthly_quota(user)
    is_sub = user.get("subscription_status") == "active"
    used = user.get("free_dedications_used", 0)
    return {
        "is_subscriber": is_sub,
        "used": used,
        "limit": None if is_sub else FREE_DEDICATIONS_PER_MONTH,
        "remaining": None if is_sub else max(0, FREE_DEDICATIONS_PER_MONTH - used),
    }


@api_router.post("/dedications")
async def create_dedication(body: DedicationCreate, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    user = await _refresh_monthly_quota(user)
    is_sub = user.get("subscription_status") == "active"
    used = user.get("free_dedications_used", 0)
    if not is_sub and used >= FREE_DEDICATIONS_PER_MONTH:
        raise HTTPException(status_code=402, detail="Free dedication limit reached. Subscribe to unlock unlimited.")
    ded = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "recipient_name": body.recipient_name,
        "phone_number": body.phone_number or "",
        "dedication_type": body.dedication_type,
        "message": body.message or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.dedications.insert_one(ded)
    if not is_sub:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"free_dedications_used": 1}},
        )
    ded.pop("_id", None)
    return {"dedication": ded}


@api_router.get("/dedications")
async def list_dedications(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    cur = db.dedications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1)
    items = await cur.to_list(200)
    return {"dedications": items}


@api_router.delete("/dedications/{ded_id}")
async def delete_dedication(ded_id: str, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    r = await db.dedications.delete_one({"id": ded_id, "user_id": user["user_id"]})
    return {"deleted": r.deleted_count > 0}


# ---------- Family (أسرة إيثاق) ----------
def _gen_family_code() -> str:
    import string, random
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


@api_router.post("/families")
async def create_family(body: FamilyCreate, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    # If user already in a family, return it
    existing = await db.families.find_one(
        {"member_ids": user["user_id"]}, {"_id": 0}
    )
    if existing:
        return {"family": existing}
    # generate code
    code = _gen_family_code()
    for _ in range(5):
        if not await db.families.find_one({"code": code}):
            break
        code = _gen_family_code()
    fam = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip() or "أسرتي",
        "code": code,
        "owner_id": user["user_id"],
        "member_ids": [user["user_id"]],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.families.insert_one(fam)
    fam.pop("_id", None)
    return {"family": fam}


@api_router.post("/families/join")
async def join_family(body: FamilyJoin, authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    fam = await db.families.find_one({"code": body.code.upper().strip()}, {"_id": 0})
    if not fam:
        raise HTTPException(status_code=404, detail="Family code not found")
    if user["user_id"] not in fam["member_ids"]:
        await db.families.update_one(
            {"id": fam["id"]},
            {"$addToSet": {"member_ids": user["user_id"]}},
        )
        fam["member_ids"].append(user["user_id"])
    return {"family": fam}


@api_router.get("/families/me")
async def my_family(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    fam = await db.families.find_one({"member_ids": user["user_id"]}, {"_id": 0})
    if not fam:
        return {"family": None, "members": []}
    members_cur = db.users.find(
        {"user_id": {"$in": fam["member_ids"]}},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "picture": 1, "subscription_status": 1},
    )
    members = await members_cur.to_list(50)
    # Just return members (progress details will be stored by each member client-side in v1)
    return {"family": fam, "members": members}


@api_router.post("/families/leave")
async def leave_family(authorization: Optional[str] = Header(None)):
    user = await require_user(authorization)
    fam = await db.families.find_one({"member_ids": user["user_id"]}, {"_id": 0})
    if not fam:
        return {"ok": True}
    # If owner and last member -> delete family
    if fam["owner_id"] == user["user_id"] and len(fam["member_ids"]) == 1:
        await db.families.delete_one({"id": fam["id"]})
    else:
        await db.families.update_one(
            {"id": fam["id"]},
            {"$pull": {"member_ids": user["user_id"]}},
        )
    return {"ok": True}


# ---------- Wire up ----------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

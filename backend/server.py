from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class TasbihState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    count: int = 0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TasbihUpdate(BaseModel):
    device_id: str
    count: int


class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    role: str  # user | assistant
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    reply: str
    session_id: str


# ---------- Islamic Content (in Arabic) ----------
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


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "إيثاق API"}


@api_router.get("/hadith/daily")
async def get_daily_hadith():
    """Returns a hadith based on day of year."""
    day_of_year = datetime.now(timezone.utc).timetuple().tm_yday
    idx = day_of_year % len(DAILY_HADITHS)
    hadith = DAILY_HADITHS[idx]
    return {"hadith": hadith["text"], "source": hadith["source"], "day": day_of_year}


@api_router.get("/tasbih/{device_id}")
async def get_tasbih(device_id: str):
    doc = await db.tasbih.find_one({"device_id": device_id}, {"_id": 0})
    if not doc:
        return {"device_id": device_id, "count": 0}
    return {"device_id": doc["device_id"], "count": doc.get("count", 0)}


@api_router.post("/tasbih")
async def update_tasbih(body: TasbihUpdate):
    now = datetime.now(timezone.utc).isoformat()
    await db.tasbih.update_one(
        {"device_id": body.device_id},
        {"$set": {"count": body.count, "updated_at": now}},
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
        "ومنهج أهل العلم المعتبرين. اذكر الدليل من القرآن والسنة عند الحاجة، "
        "وإن اختلف الفقهاء في مسألة فاذكر أبرز الأقوال بأدلتها. "
        "كن مختصراً واضحاً محترماً، وإن كنت لا تعلم فقل: (لا أعلم، والأولى سؤال أهل العلم)."
    )

    chat_client = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=body.session_id,
        system_message=system_msg,
    ).with_model("openai", "gpt-5.4")

    # Store user message
    user_msg = ChatMessage(session_id=body.session_id, role="user", content=body.message)
    await db.chat_messages.insert_one(user_msg.model_dump())

    try:
        reply_text = await chat_client.send_message(UserMessage(text=body.message))
    except Exception as e:
        logging.exception("LLM error")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    assistant_msg = ChatMessage(session_id=body.session_id, role="assistant", content=reply_text)
    await db.chat_messages.insert_one(assistant_msg.model_dump())

    return ChatResponse(reply=reply_text, session_id=body.session_id)


@api_router.get("/chat/history/{session_id}")
async def get_history(session_id: str):
    cursor = db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("created_at", 1)
    msgs = await cursor.to_list(500)
    return {"session_id": session_id, "messages": msgs}


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

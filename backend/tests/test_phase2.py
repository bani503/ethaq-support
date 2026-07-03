"""Phase 2 backend tests for Ithaq: auth, subscription, dedications, family.

Seeds a fake user + user_session directly into MongoDB (since we cannot
obtain a real Emergent session_token in a test harness), then exercises
all Bearer-protected endpoints.
"""
import os
import uuid
import time
import asyncio
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta

# Load env
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# ---------- Helpers ----------
def _loop():
    try:
        return asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop


def _mongo():
    client = AsyncIOMotorClient(MONGO_URL)
    return client, client[DB_NAME]


async def _seed_user_and_session(email: str, sub_status: str = "inactive", customer_id: str = None):
    client, db = _mongo()
    user_id = f"TESTUSER_{uuid.uuid4().hex[:10]}"
    token = f"TESTTOKEN_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc)
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": "TEST User",
        "picture": "https://example.com/pic.png",
        "subscription_status": sub_status,
        "subscription_plan": None,
        "subscription_current_period_end": None,
        "stripe_customer_id": customer_id,
        "free_dedications_used": 0,
        "free_dedications_period_start": now.isoformat(),
        "created_at": now.isoformat(),
    })
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": now + timedelta(days=7),
        "created_at": now,
    })
    client.close()
    return user_id, token


async def _cleanup(email_prefix="TEST_phase2_"):
    client, db = _mongo()
    users = await db.users.find({"email": {"$regex": f"^{email_prefix}"}}, {"user_id": 1}).to_list(500)
    ids = [u["user_id"] for u in users]
    if ids:
        await db.dedications.delete_many({"user_id": {"$in": ids}})
        await db.families.delete_many({"$or": [
            {"owner_id": {"$in": ids}},
            {"member_ids": {"$in": ids}},
        ]})
        await db.user_sessions.delete_many({"user_id": {"$in": ids}})
        await db.users.delete_many({"user_id": {"$in": ids}})
    client.close()


@pytest.fixture(scope="session", autouse=True)
def cleanup_at_end():
    yield
    _loop().run_until_complete(_cleanup())


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _seed(email_suffix="a", sub="inactive", customer=None):
    email = f"TEST_phase2_{email_suffix}_{uuid.uuid4().hex[:6]}@example.com"
    return _loop().run_until_complete(_seed_user_and_session(email, sub, customer)) + (email,)


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ==================== AUTH ====================
class TestAuth:
    def test_auth_session_invalid_token_returns_401(self, api):
        r = api.post(f"{API}/auth/session", json={"session_token": "definitely_not_valid_" + uuid.uuid4().hex})
        assert r.status_code == 401, r.text

    def test_auth_me_without_token_returns_401(self, api):
        r = api.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_auth_me_with_valid_token(self, api):
        _, token, email = _seed("me")
        r = api.get(f"{API}/auth/me", headers=_auth(token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user" in data
        u = data["user"]
        assert u["email"] == email
        assert u["subscription_status"] == "inactive"
        assert "_id" not in u
        # Verify sanitizer removed _id from any nested response
        assert "_id" not in data

    def test_auth_logout_deletes_session(self, api):
        _, token, _ = _seed("logout")
        r = api.post(f"{API}/auth/logout", headers=_auth(token))
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Subsequent auth/me should be 401
        r2 = api.get(f"{API}/auth/me", headers=_auth(token))
        assert r2.status_code == 401


# ==================== SUBSCRIPTION ====================
class TestSubscription:
    def test_status_new_user_inactive(self, api):
        _, token, _ = _seed("status")
        r = api.get(f"{API}/subscription/status", headers=_auth(token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["active"] is False
        assert data.get("plan") is None
        assert "_id" not in data

    def test_status_requires_auth(self, api):
        r = api.get(f"{API}/subscription/status")
        assert r.status_code == 401

    def test_checkout_invalid_plan_returns_400(self, api):
        _, token, _ = _seed("invplan")
        r = api.post(f"{API}/subscription/checkout", json={"plan": "weekly"}, headers=_auth(token))
        assert r.status_code == 400, r.text

    def test_checkout_monthly_returns_url(self, api):
        _, token, _ = _seed("mo")
        r = api.post(f"{API}/subscription/checkout", json={"plan": "monthly"}, headers=_auth(token))
        # Stripe test key sk_test_emergent may not be a real live key; accept either success or 502
        if r.status_code == 200:
            data = r.json()
            assert "checkout_url" in data and data["checkout_url"].startswith("http")
            assert "session_id" in data
        else:
            # Report failure with details for main agent
            assert r.status_code == 502, f"unexpected status {r.status_code}: {r.text}"

    def test_checkout_yearly_returns_url(self, api):
        _, token, _ = _seed("yr")
        r = api.post(f"{API}/subscription/checkout", json={"plan": "yearly"}, headers=_auth(token))
        if r.status_code == 200:
            data = r.json()
            assert "checkout_url" in data and data["checkout_url"].startswith("http")
        else:
            assert r.status_code == 502, f"unexpected {r.status_code}: {r.text}"


# ==================== STRIPE WEBHOOK ====================
class TestStripeWebhook:
    def test_webhook_subscription_updated_activates_user(self, api):
        # Seed user with a fake stripe_customer_id
        cust_id = f"cus_TEST_{uuid.uuid4().hex[:10]}"
        user_id, _, _ = _seed("wh", sub="inactive", customer=cust_id)
        cpe = int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())
        payload = {
            "type": "customer.subscription.updated",
            "data": {"object": {
                "customer": cust_id,
                "status": "active",
                "current_period_end": cpe,
            }},
        }
        r = api.post(f"{API}/webhook/stripe", json=payload)
        assert r.status_code == 200, r.text
        # Verify DB updated
        client, db = _mongo()
        u = _loop().run_until_complete(db.users.find_one({"user_id": user_id}, {"_id": 0}))
        client.close()
        assert u["subscription_status"] == "active"
        assert u.get("subscription_current_period_end") is not None


# ==================== DEDICATIONS ====================
class TestDedications:
    def test_quota_new_user(self, api):
        _, token, _ = _seed("qq")
        r = api.get(f"{API}/dedications/quota", headers=_auth(token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["is_subscriber"] is False
        assert data["used"] == 0
        assert data["limit"] == 5
        assert data["remaining"] == 5

    def test_create_dedication_decrements_quota(self, api):
        _, token, _ = _seed("ded1")
        r = api.post(f"{API}/dedications", json={"recipient_name": "TEST_Recipient"}, headers=_auth(token))
        assert r.status_code == 200, r.text
        ded = r.json()["dedication"]
        assert ded["recipient_name"] == "TEST_Recipient"
        assert ded["dedication_type"] == "dua"
        assert "_id" not in ded
        assert "id" in ded
        # Quota now used=1 remaining=4
        r2 = api.get(f"{API}/dedications/quota", headers=_auth(token))
        q = r2.json()
        assert q["used"] == 1
        assert q["remaining"] == 4

    def test_six_dedications_exceeds_quota(self, api):
        _, token, _ = _seed("ded6")
        for i in range(5):
            r = api.post(f"{API}/dedications", json={"recipient_name": f"R{i}"}, headers=_auth(token))
            assert r.status_code == 200, f"i={i}: {r.text}"
        # 6th should fail with 402
        r6 = api.post(f"{API}/dedications", json={"recipient_name": "R6"}, headers=_auth(token))
        assert r6.status_code == 402, r6.text

    def test_subscriber_unlimited(self, api):
        _, token, _ = _seed("sub", sub="active")
        for i in range(7):
            r = api.post(f"{API}/dedications", json={"recipient_name": f"S{i}"}, headers=_auth(token))
            assert r.status_code == 200, f"i={i}: {r.text}"
        rq = api.get(f"{API}/dedications/quota", headers=_auth(token))
        q = rq.json()
        assert q["is_subscriber"] is True
        assert q["limit"] is None
        assert q["remaining"] is None

    def test_list_dedications_sorted_desc(self, api):
        _, token, _ = _seed("list")
        names = ["A", "B", "C"]
        for n in names:
            api.post(f"{API}/dedications", json={"recipient_name": n}, headers=_auth(token))
            time.sleep(0.05)
        r = api.get(f"{API}/dedications", headers=_auth(token))
        assert r.status_code == 200
        items = r.json()["dedications"]
        assert len(items) == 3
        # Sorted desc by created_at → last created (C) first
        assert items[0]["recipient_name"] == "C"
        assert items[-1]["recipient_name"] == "A"
        for it in items:
            assert "_id" not in it

    def test_delete_only_own(self, api):
        _, token_a, _ = _seed("da")
        _, token_b, _ = _seed("db")
        r = api.post(f"{API}/dedications", json={"recipient_name": "OwnedByA"}, headers=_auth(token_a))
        ded_id = r.json()["dedication"]["id"]
        # B tries to delete
        rb = api.delete(f"{API}/dedications/{ded_id}", headers=_auth(token_b))
        assert rb.status_code == 200
        assert rb.json()["deleted"] is False
        # A deletes successfully
        ra = api.delete(f"{API}/dedications/{ded_id}", headers=_auth(token_a))
        assert ra.status_code == 200
        assert ra.json()["deleted"] is True

    def test_dedications_require_auth(self, api):
        assert api.get(f"{API}/dedications").status_code == 401
        assert api.get(f"{API}/dedications/quota").status_code == 401
        assert api.post(f"{API}/dedications", json={"recipient_name": "X"}).status_code == 401


# ==================== FAMILIES ====================
class TestFamilies:
    def test_create_family(self, api):
        _, token, _ = _seed("fam")
        r = api.post(f"{API}/families", json={"name": "أسرتي"}, headers=_auth(token))
        assert r.status_code == 200, r.text
        fam = r.json()["family"]
        assert fam["name"] == "أسرتي"
        assert len(fam["code"]) == 6
        assert fam["code"].isupper() or fam["code"].isalnum()
        assert "owner_id" in fam and fam["owner_id"]
        assert "_id" not in fam

    def test_join_family_invalid_code(self, api):
        _, token, _ = _seed("famj")
        r = api.post(f"{API}/families/join", json={"code": "ZZZZZZ"}, headers=_auth(token))
        assert r.status_code == 404, r.text

    def test_join_family_valid_code(self, api):
        _, token_o, _ = _seed("famo")
        _, token_m, _ = _seed("famm")
        rc = api.post(f"{API}/families", json={"name": "Fam1"}, headers=_auth(token_o))
        code = rc.json()["family"]["code"]
        rj = api.post(f"{API}/families/join", json={"code": code}, headers=_auth(token_m))
        assert rj.status_code == 200, rj.text
        fam = rj.json()["family"]
        assert len(fam["member_ids"]) == 2
        assert "_id" not in fam

    def test_family_me_includes_members(self, api):
        _, token_o, _ = _seed("mem_o")
        _, token_m, _ = _seed("mem_m")
        rc = api.post(f"{API}/families", json={"name": "FamMembers"}, headers=_auth(token_o))
        code = rc.json()["family"]["code"]
        api.post(f"{API}/families/join", json={"code": code}, headers=_auth(token_m))
        r = api.get(f"{API}/families/me", headers=_auth(token_o))
        assert r.status_code == 200
        data = r.json()
        assert data["family"] is not None
        assert "_id" not in data["family"]
        assert len(data["members"]) == 2
        for m in data["members"]:
            assert "_id" not in m
            assert "user_id" in m
            assert "subscription_status" in m
            assert "picture" in m

    def test_leave_family_last_owner_deletes(self, api):
        user_id, token, _ = _seed("leave")
        rc = api.post(f"{API}/families", json={"name": "SoloFam"}, headers=_auth(token))
        fam_id = rc.json()["family"]["id"]
        r = api.post(f"{API}/families/leave", headers=_auth(token))
        assert r.status_code == 200
        # Verify family deleted
        client, db = _mongo()
        f = _loop().run_until_complete(db.families.find_one({"id": fam_id}))
        client.close()
        assert f is None

    def test_leave_family_non_owner_stays(self, api):
        _, token_o, _ = _seed("stay_o")
        _, token_m, _ = _seed("stay_m")
        rc = api.post(f"{API}/families", json={"name": "StayFam"}, headers=_auth(token_o))
        code = rc.json()["family"]["code"]
        fam_id = rc.json()["family"]["id"]
        api.post(f"{API}/families/join", json={"code": code}, headers=_auth(token_m))
        r = api.post(f"{API}/families/leave", headers=_auth(token_m))
        assert r.status_code == 200
        client, db = _mongo()
        f = _loop().run_until_complete(db.families.find_one({"id": fam_id}, {"_id": 0}))
        client.close()
        assert f is not None
        assert len(f["member_ids"]) == 1

    def test_family_endpoints_require_auth(self, api):
        assert api.get(f"{API}/families/me").status_code == 401
        assert api.post(f"{API}/families", json={"name": "X"}).status_code == 401
        assert api.post(f"{API}/families/join", json={"code": "AAAAAA"}).status_code == 401
        assert api.post(f"{API}/families/leave").status_code == 401


# ==================== V1 REGRESSION ====================
class TestV1Regression:
    def test_root(self, api):
        r = api.get(f"{API}/")
        assert r.status_code == 200
        assert "إيثاق" in r.json()["message"]

    def test_hadith_daily(self, api):
        r = api.get(f"{API}/hadith/daily")
        assert r.status_code == 200
        d = r.json()
        assert d["hadith"] and d["source"] and "رواه" in d["source"]

    def test_tasbih_flow(self, api):
        did = f"TEST_phase2_tas_{uuid.uuid4().hex[:6]}"
        r = api.get(f"{API}/tasbih/{did}")
        assert r.status_code == 200
        assert r.json()["count"] == 0
        r2 = api.post(f"{API}/tasbih", json={"device_id": did, "count": 7})
        assert r2.status_code == 200
        assert r2.json()["count"] == 7
        # cleanup tasbih
        client, db = _mongo()
        _loop().run_until_complete(db.tasbih.delete_one({"device_id": did}))
        client.close()

    def test_chat_history_empty_ok(self, api):
        # Existing chat + history endpoints still respond (skip heavy AI call)
        sid = f"TEST_phase2_sess_{uuid.uuid4().hex[:6]}"
        r = api.get(f"{API}/chat/history/{sid}")
        assert r.status_code == 200
        assert r.json()["session_id"] == sid
        assert r.json()["messages"] == []

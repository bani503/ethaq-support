"""Backend API tests for Ithaq (إيثاق) Islamic app."""
import os
import uuid
import time
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Load frontend .env to obtain public base URL (as user sees)
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Root ----------
class TestRoot:
    def test_root_returns_arabic_name(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "message" in data
        # Contains Arabic app name إيثاق
        assert "إيثاق" in data["message"]


# ---------- Hadith ----------
class TestHadith:
    def test_daily_hadith(self, api_client):
        r = api_client.get(f"{API}/hadith/daily")
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("hadith", "source", "day"):
            assert key in data
        assert isinstance(data["hadith"], str) and len(data["hadith"]) > 0
        assert isinstance(data["source"], str) and len(data["source"]) > 0
        # Source should be in Arabic (contain رواه)
        assert "رواه" in data["source"]
        # No mongo _id leakage
        assert "_id" not in data


# ---------- Tasbih ----------
class TestTasbih:
    def test_get_initial_count_zero(self, api_client):
        device_id = f"TEST_{uuid.uuid4()}"
        r = api_client.get(f"{API}/tasbih/{device_id}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["device_id"] == device_id
        assert data["count"] == 0
        assert "_id" not in data

    def test_post_upsert_and_persist(self, api_client):
        device_id = f"TEST_{uuid.uuid4()}"
        # First upsert
        r = api_client.post(f"{API}/tasbih", json={"device_id": device_id, "count": 33})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["device_id"] == device_id
        assert data["count"] == 33
        assert "_id" not in data

        # GET verifies persistence
        r2 = api_client.get(f"{API}/tasbih/{device_id}")
        assert r2.status_code == 200
        assert r2.json()["count"] == 33

        # Update to new count
        r3 = api_client.post(f"{API}/tasbih", json={"device_id": device_id, "count": 100})
        assert r3.status_code == 200
        assert r3.json()["count"] == 100

        # GET reflects update
        r4 = api_client.get(f"{API}/tasbih/{device_id}")
        assert r4.json()["count"] == 100
        assert "_id" not in r4.json()


# ---------- Chat (AI) ----------
class TestChat:
    session_id = f"TEST_{uuid.uuid4()}"

    def test_chat_returns_arabic_reply(self, api_client):
        payload = {
            "session_id": self.session_id,
            "message": "ما حكم الصلاة في جماعة؟",
        }
        r = api_client.post(f"{API}/chat", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["session_id"] == self.session_id
        assert "reply" in data
        assert isinstance(data["reply"], str)
        assert len(data["reply"]) > 0
        # Reply should contain at least one Arabic character
        assert any("\u0600" <= ch <= "\u06FF" for ch in data["reply"]), (
            f"Reply not in Arabic: {data['reply'][:200]}"
        )
        assert "_id" not in data

    def test_chat_history_returns_messages(self, api_client):
        # slight delay to ensure DB write done
        time.sleep(1)
        r = api_client.get(f"{API}/chat/history/{self.session_id}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["session_id"] == self.session_id
        assert "messages" in data
        msgs = data["messages"]
        assert isinstance(msgs, list)
        assert len(msgs) >= 2  # user + assistant
        roles = [m.get("role") for m in msgs]
        assert "user" in roles and "assistant" in roles
        # No ObjectId leaks
        for m in msgs:
            assert "_id" not in m
            assert "session_id" in m
            assert "content" in m


# ---------- CORS ----------
class TestCORS:
    def test_cors_allows_browser(self, api_client):
        r = api_client.options(
            f"{API}/",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        # OPTIONS should be handled (200 or 204)
        assert r.status_code in (200, 204), r.text
        # ACAO header present
        acao = r.headers.get("access-control-allow-origin")
        assert acao is not None
        assert acao in ("*", "https://example.com")

    def test_cors_on_get(self, api_client):
        r = api_client.get(f"{API}/", headers={"Origin": "https://example.com"})
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") is not None

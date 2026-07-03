# PRD — إيثاق (Ithaq) — Islamic Mobile App

## Overview
Arabic-first (RTL) Islamic companion app built in Expo. Codename: إيثاق ("covenant / pact").

## Users
Arabic-speaking Muslims who want a single elegant app for daily worship, plus premium members who dedicate prayers and share their journey with family.

## Feature Set

### Free / Core
1. **Home dashboard** — Hijri date, city, next prayer hero card + countdown, prayer times row, daily hadith, bento grid.
2. **Prayer Times** — Aladhan API, geo-located, fallback to Makkah.
3. **Adhan & Iqamah** — Scheduled local notifications per prayer + configurable iqamah delay + test playback.
4. **Quran** — 114 surahs, Uthmani text (AlQuran.cloud) + full surah audio (Mishary Alafasy CDN).
5. **Adhkar** — 4 categories × counters + haptics.
6. **Digital Tasbih** — Big circular counter with dhikr & target selectors.
7. **Qibla Compass** — Great-circle bearing to Kaaba with magnetometer.
8. **Prayer Tracker (مفكرة الصلوات)** — Daily 5 prayers + qada counter + streak + 30-day stats.
9. **40 Nawawi Hadiths** — Full text, mark as memorized, progress.
10. **99 Names of Allah** — 2-column grid + meaning.
11. **AI Assistant (إيثاق AI)** — Chat in Arabic backed by OpenAI GPT-5.4 via Emergent LLM key.
12. **Settings** — Adhan toggle, iqamah delay, per-prayer overrides.

### Auth
- **Google Sign-in** via Emergent Auth (WebBrowser flow on mobile, redirect on web). Token stored in `expo-secure-store` (mobile) / `localStorage` (web). 7-day sessions with TTL index in MongoDB.

### Premium (Phase 2)
- **Subscription (إيثاق بريميوم)** — 3 SAR/month or 30 SAR/year (16% savings) via **Stripe Checkout**. `sk_test_emergent` in dev; webhook auto-updates `subscription_status`.
- **Prayer Dedications (إهداءات الدعاء)** — Dedicate a dua/khatmah/tasbih/sadaqah to a named person + optional phone. Free tier: **5/month**, resets monthly. Premium: **unlimited**.
- **Family (أسرة إيثاق)** — Create or join a family with a 6-char code, share the journey with loved ones. Leave anytime; last owner deletes family.

## Tech Stack
- **Frontend:** Expo SDK 54 · expo-router · expo-audio · expo-notifications · expo-location · expo-sensors · expo-haptics · expo-web-browser · expo-secure-store · react-native-reanimated
- **Backend:** FastAPI + MongoDB (motor) · emergentintegrations (LLM) · stripe · httpx (Emergent auth verify)
- **External APIs:** Aladhan · AlQuran.cloud · MP3Quran (Alafasy) · islamcan (Adhan)

## Design
- RTL Arabic-first · warm paper (#FDFBF7) · forest green (#0F4C3A) · gold (#D4AF37).

## Data model (MongoDB)
- `users` — user_id (unique), email (unique), name, picture, subscription_status, subscription_plan, subscription_current_period_end, stripe_customer_id, free_dedications_used, free_dedications_period_start.
- `user_sessions` — session_token (unique), user_id, expires_at (TTL).
- `dedications` — id, user_id, recipient_name, phone_number, dedication_type, message, created_at.
- `families` — id, name, code (unique 6-char), owner_id, member_ids[], created_at.
- Plus: `chat_messages`, `tasbih`.

## Testing status
- **Phase 1 backend**: 8/8 tests ✓
- **Phase 2 backend**: 28/28 tests ✓ (auth, subscription, webhook, dedications quota, family lifecycle)

## Known limitations / follow-ups
- Adhan notifications work fully only in production APK/IPA; Expo Go Android may skip background schedules.
- Emergent OAuth requires real Google flow to test end-to-end; auth backend tested via seeded sessions.
- Stripe webhook secret is not set in dev (accepts unsigned events). Set `STRIPE_WEBHOOK_SECRET` for prod.
- server.py is 620 LOC — consider splitting into routers before Phase 3.

## Roadmap
- **Phase 3 (optional):** SMS delivery for dedications via Twilio; family live activity feed (who prayed today); leaderboards; iOS/Android push notifications; multi-reciter Quran audio.

# PRD — إيثاق (Ithaq) — Islamic Mobile App

## Overview
An Arabic-first (RTL) Islamic companion mobile app built in Expo. Codename: إيثاق (meaning "covenant / pact").

## Users
Arabic-speaking Muslims who want a single elegant app for daily worship: prayer times, Quran (read + audio), adhkar, tasbih, qibla, prayer tracking, and an AI assistant.

## Core Features
1. **Home dashboard** — Hijri date, city, next prayer hero card with countdown, full prayer times row, daily hadith, bento grid of all services, settings shortcut.
2. **Prayer Times** — Aladhan API method=4 (Umm Al-Qura). Auto geo-location, fallback to Makkah.
3. **Adhan & Iqamah (NEW)** — Scheduled local notifications for each prayer + configurable iqamah delay (5–30 min) per prayer. Test-play Adhan audio in settings.
4. **Quran (114 surahs)** — Surah list with search, Uthmani text reader (AlQuran.cloud), full surah audio (Mishary Alafasy — MP3Quran CDN).
5. **Adhkar** — 4 categories (morning / evening / sleep / after-prayer) with per-item counter + haptics.
6. **Digital Tasbih** — Large circular counter, dhikr selector, target selector, total across sessions.
7. **Qibla Compass** — Great-circle bearing to Kaaba, animated needle driven by magnetometer.
8. **Prayer Tracker (مفكرة الصلوات) (NEW)** — Track daily 5 prayers, qada counter, streak, 30-day stats, encouraging verse.
9. **40 Nawawi Hadiths (NEW)** — Full text of all 40, expand/collapse, mark as memorized, progress bar.
10. **99 Names of Allah** — 2-column grid with meaning.
11. **AI Assistant (إيثاق AI)** — Chat in Arabic backed by OpenAI GPT-5.4 via Emergent LLM key. Persists history in MongoDB.
12. **Settings** — Adhan toggle, iqamah delay, per-prayer notification toggle, test-adhan playback.

## Roadmap — Phase 2 (planned, awaiting user confirmation)
- Authentication (Google via Emergent Auth)
- Subscription tier (3 SAR/mo or 30 SAR/yr) via Stripe
- "إهداء الدعاء" — dedicate a prayer to a phone number (SMS via Twilio)
- "أسرة إيثاق" — family/social prayer-tracking sharing

## Tech Stack
- **Frontend:** Expo SDK 54, expo-router, expo-location, expo-sensors, expo-audio, expo-notifications, expo-haptics, react-native-reanimated
- **Backend:** FastAPI + MongoDB (motor), emergentintegrations for LLM
- **External APIs:** Aladhan, AlQuran.cloud, MP3Quran (Alafasy), islamcan (Adhan MP3)

## Design
- RTL Arabic-first, warm paper background (#FDFBF7), deep forest green primary (#0F4C3A), gold accent (#D4AF37).
- Serif family for large Arabic (Amiri/system), sans for UI.

## Known limitations
- Scheduled adhan notifications work fully only in a real APK/IPA build. In Expo Go, background notifications may be limited (esp. on Android).
- Adhan / Quran audio requires internet (streamed from CDN).

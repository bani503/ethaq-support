# PRD — إيثاق (Ithaq) — Islamic Mobile App

## Overview
An Arabic-first (RTL) Islamic companion mobile app built in Expo. Codename: إيثاق (meaning "covenant / pact").

## Users
Arabic-speaking Muslims who want a single elegant app for daily worship: prayer times, Quran, adhkar, tasbih, qibla, and an AI assistant.

## Core Features (v1)
1. **Home dashboard** — Hijri date, city, next prayer hero card with countdown, full prayer times row, daily hadith, bento grid of services.
2. **Prayer Times** — Aladhan API, method=4 (Umm Al-Qura). Automatic geo-location (falls back to Makkah).
3. **Quran (114 surahs)** — Surah list with search + Uthmani text reader (AlQuran.cloud API).
4. **Adhkar** — 4 categories (morning / evening / sleep / after-prayer) with per-item counter and haptics.
5. **Digital Tasbih** — Large circular counter, dhikr selector, target selector (33/99/100/500), total across sessions.
6. **Qibla Compass** — Great-circle bearing to Kaaba, animated needle driven by magnetometer heading.
7. **99 Names of Allah (Asma Al-Husna)** — 2-column grid with meaning.
8. **AI Assistant (إيثاق AI)** — Chat interface in Arabic backed by OpenAI GPT-5.4 via Emergent LLM key. Persists per-session history in MongoDB.

## Tech Stack
- **Frontend:** Expo SDK 54, expo-router, expo-location, expo-sensors, expo-haptics, react-native-reanimated
- **Backend:** FastAPI + MongoDB (motor), emergentintegrations for LLM
- **External APIs:** Aladhan (prayer/hijri), AlQuran.cloud (Quran text)

## Design
- RTL Arabic-first, warm paper background (#FDFBF7), deep forest green primary (#0F4C3A), gold accent (#D4AF37).
- Serif family for large Arabic text (Amiri/system), sans for UI.

## Non-goals (v1)
- Quran audio playback (planned)
- Auth / cloud sync of user progress
- Push notifications for prayer times (planned)

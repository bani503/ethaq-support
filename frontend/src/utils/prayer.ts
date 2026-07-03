// Prayer times helper using Aladhan API (no key required)
// https://api.aladhan.com/v1/timings/

export type PrayerName = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export const PRAYER_NAMES_AR: Record<PrayerName, string> = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

export const PRAYER_ORDER: PrayerName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];

export interface Timings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface PrayerData {
  timings: Timings;
  hijri: { day: string; month: string; year: string; monthEn: string };
  gregorianDate: string;
  cityName?: string;
}

const HIJRI_MONTHS_AR: Record<string, string> = {
  "Muharram": "محرم",
  "Safar": "صفر",
  "Rabi al-awwal": "ربيع الأول",
  "Rabi al-thani": "ربيع الآخر",
  "Jumada al-awwal": "جمادى الأولى",
  "Jumada al-thani": "جمادى الآخرة",
  "Rajab": "رجب",
  "Sha'ban": "شعبان",
  "Ramadan": "رمضان",
  "Shawwal": "شوال",
  "Dhu al-Qi'dah": "ذو القعدة",
  "Dhu al-Hijjah": "ذو الحجة",
};

export function toArabicMonth(en: string): string {
  return HIJRI_MONTHS_AR[en] || en;
}

export async function fetchPrayerTimes(lat: number, lng: number): Promise<PrayerData> {
  const url = `https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=4`;
  const res = await fetch(url);
  const json = await res.json();
  const t = json.data.timings;
  return {
    timings: {
      Fajr: (t.Fajr as string).slice(0, 5),
      Sunrise: (t.Sunrise as string).slice(0, 5),
      Dhuhr: (t.Dhuhr as string).slice(0, 5),
      Asr: (t.Asr as string).slice(0, 5),
      Maghrib: (t.Maghrib as string).slice(0, 5),
      Isha: (t.Isha as string).slice(0, 5),
    },
    hijri: {
      day: json.data.date.hijri.day,
      month: json.data.date.hijri.month.en,
      year: json.data.date.hijri.year,
      monthEn: json.data.date.hijri.month.en,
    },
    gregorianDate: json.data.date.gregorian.date,
  };
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

export function getNextPrayer(timings: Timings): {
  name: PrayerName;
  time: string;
  minutesUntil: number;
} {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const p of PRAYER_ORDER) {
    if (p === "Sunrise") continue; // not a prayer time
    const mins = toMinutes(timings[p]);
    if (mins > nowMin) {
      return { name: p, time: timings[p], minutesUntil: mins - nowMin };
    }
  }
  // Next day Fajr
  const mins = toMinutes(timings.Fajr) + 24 * 60;
  return { name: "Fajr", time: timings.Fajr, minutesUntil: mins - nowMin };
}

export function formatCountdown(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h} س ${m} د`;
  return `${m} دقيقة`;
}

// Qibla direction from user location to Kaaba (21.4225, 39.8262).
export function calculateQiblaBearing(lat: number, lng: number): number {
  const kaabaLat = 21.4225;
  const kaabaLng = 39.8262;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(lat);
  const phi2 = toRad(kaabaLat);
  const dLng = toRad(kaabaLng - lng);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}

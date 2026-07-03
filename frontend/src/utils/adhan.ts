import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";
import { PRAYER_NAMES_AR, type PrayerName, type Timings } from "./prayer";

const NOTIFICATION_CHANNEL = "adhan-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (cur.canAskAgain === false) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: "الأذان والإقامة",
    importance: Notifications.AndroidImportance.MAX,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#0F4C3A",
  });
}

export interface AdhanSettings {
  enabled: boolean;
  iqamahDelayMin: number; // e.g. 15
  perPrayer: Record<PrayerName, boolean>;
}

export const DEFAULT_ADHAN_SETTINGS: AdhanSettings = {
  enabled: true,
  iqamahDelayMin: 15,
  perPrayer: { Fajr: true, Sunrise: false, Dhuhr: true, Asr: true, Maghrib: true, Isha: true },
};

export async function getAdhanSettings(): Promise<AdhanSettings> {
  const raw = await storage.getItem<string>("adhan_settings", "");
  if (!raw) return DEFAULT_ADHAN_SETTINGS;
  try {
    return { ...DEFAULT_ADHAN_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ADHAN_SETTINGS;
  }
}

export async function saveAdhanSettings(s: AdhanSettings) {
  await storage.setItem("adhan_settings", JSON.stringify(s));
}

export async function cancelAllAdhanNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

// Schedule today's remaining adhan + iqamah notifications
export async function scheduleAdhanForTimings(timings: Timings, settings: AdhanSettings) {
  if (!settings.enabled) {
    await cancelAllAdhanNotifications();
    return;
  }
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await ensureAndroidChannel();
  await cancelAllAdhanNotifications();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const prayers: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  for (const p of prayers) {
    if (!settings.perPrayer[p]) continue;
    const [h, m] = timings[p].split(":").map((x) => parseInt(x, 10));
    const adhanTime = new Date(today);
    adhanTime.setHours(h, m, 0, 0);
    // if in future, schedule adhan
    if (adhanTime.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `حان الآن وقت صلاة ${PRAYER_NAMES_AR[p]}`,
          body: "الله أكبر · الله أكبر · حيّ على الصلاة",
          sound: "default",
          data: { type: "adhan", prayer: p },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: adhanTime,
          channelId: NOTIFICATION_CHANNEL,
        },
      });
    }
    // Iqamah
    const iqamahTime = new Date(adhanTime.getTime() + settings.iqamahDelayMin * 60 * 1000);
    if (iqamahTime.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `الإقامة لصلاة ${PRAYER_NAMES_AR[p]}`,
          body: "قد قامت الصلاة · قد قامت الصلاة",
          sound: "default",
          data: { type: "iqamah", prayer: p },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: iqamahTime,
          channelId: NOTIFICATION_CHANNEL,
        },
      });
    }
  }
}

// Adhan MP3 CDN — multiple muezzins (islamcan.com public catalogue)
export interface MuezzinOption {
  id: string;
  name: string;
  desc: string;
  url: string;
  iqamahUrl?: string;
}

export const MUEZZIN_OPTIONS: MuezzinOption[] = [
  {
    id: "makkah",
    name: "المسجد الحرام",
    desc: "الشيخ علي أحمد ملا",
    url: "https://www.islamcan.com/audio/adhan/azan2.mp3",
    iqamahUrl: "https://www.islamcan.com/audio/adhan/azan13.mp3",
  },
  {
    id: "madinah",
    name: "المسجد النبوي",
    desc: "أذان المدينة المنورة",
    url: "https://www.islamcan.com/audio/adhan/azan10.mp3",
  },
  {
    id: "afasy",
    name: "الشيخ مشاري العفاسي",
    desc: "بصوت هادئ وجميل",
    url: "https://www.islamcan.com/audio/adhan/azan14.mp3",
  },
  {
    id: "egypt",
    name: "الأذان المصري",
    desc: "على المقام النهاوند",
    url: "https://www.islamcan.com/audio/adhan/azan5.mp3",
  },
  {
    id: "turkey",
    name: "الأذان التركي",
    desc: "أنقرة العثمانية",
    url: "https://www.islamcan.com/audio/adhan/azan4.mp3",
  },
  {
    id: "fajr",
    name: "أذان الفجر",
    desc: "الصلاة خير من النوم",
    url: "https://www.islamcan.com/audio/adhan/azan1.mp3",
  },
];

export const DEFAULT_MUEZZIN_ID = "makkah";

export function getMuezzin(id?: string | null): MuezzinOption {
  return MUEZZIN_OPTIONS.find((m) => m.id === id) || MUEZZIN_OPTIONS[0];
}

export async function getSelectedMuezzin(): Promise<MuezzinOption> {
  const id = await storage.getItem<string>("muezzin_id", DEFAULT_MUEZZIN_ID);
  return getMuezzin(id || DEFAULT_MUEZZIN_ID);
}

export async function setSelectedMuezzin(id: string) {
  await storage.setItem("muezzin_id", id);
}

export const ADHAN_MP3_URL = MUEZZIN_OPTIONS[0].url;
export const IQAMAH_MP3_URL = "https://www.islamcan.com/audio/adhan/azan13.mp3";

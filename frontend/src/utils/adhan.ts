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

// Adhan MP3 CDN (Mishary Alafasy)
export const ADHAN_MP3_URL = "https://www.islamcan.com/audio/adhan/azan1.mp3";
export const IQAMAH_MP3_URL = "https://www.islamcan.com/audio/adhan/azan2.mp3";

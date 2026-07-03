import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useAudioPlayer } from "expo-audio";

import { theme } from "@/src/theme";
import { PRAYER_NAMES_AR, type PrayerName } from "@/src/utils/prayer";
import {
  getAdhanSettings,
  saveAdhanSettings,
  DEFAULT_ADHAN_SETTINGS,
  ADHAN_MP3_URL,
  type AdhanSettings,
} from "@/src/utils/adhan";

const PRAYERS: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const IQAMAH_OPTIONS = [5, 10, 15, 20, 25, 30];

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<AdhanSettings>(DEFAULT_ADHAN_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const player = useAudioPlayer(ADHAN_MP3_URL);

  useEffect(() => {
    (async () => {
      const s = await getAdhanSettings();
      setSettings(s);
      setLoaded(true);
    })();
  }, []);

  const update = async (next: AdhanSettings) => {
    setSettings(next);
    await saveAdhanSettings(next);
  };

  const testAdhan = async () => {
    try {
      player.seekTo(0);
      player.play();
    } catch (e) {
      Alert.alert("تعذر التشغيل", "حدث خطأ في تشغيل الأذان.");
    }
  };

  const stopAdhan = () => {
    try { player.pause(); } catch {}
  };

  if (!loaded) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="settings-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="settings-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>الإعدادات</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Master toggle */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>تفعيل الأذان والإقامة</Text>
              <Text style={styles.rowDesc}>إشعارات محلية عند دخول كل وقت</Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(v) => update({ ...settings, enabled: v })}
              trackColor={{ true: theme.colors.primary, false: theme.colors.divider }}
              thumbColor="#fff"
              testID="adhan-enabled-switch"
            />
          </View>
        </View>

        {/* Iqamah delay */}
        <Text style={styles.sectionLabel}>وقت الإقامة بعد الأذان</Text>
        <View style={styles.iqamahRow}>
          {IQAMAH_OPTIONS.map((min) => (
            <TouchableOpacity
              key={min}
              onPress={() => update({ ...settings, iqamahDelayMin: min })}
              style={[
                styles.iqamahChip,
                settings.iqamahDelayMin === min && styles.iqamahChipActive,
              ]}
              testID={`iqamah-${min}`}
            >
              <Text
                style={[
                  styles.iqamahChipText,
                  settings.iqamahDelayMin === min && styles.iqamahChipTextActive,
                ]}
              >
                {min} د
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Per-prayer */}
        <Text style={styles.sectionLabel}>تخصيص الصلوات</Text>
        <View style={styles.card}>
          {PRAYERS.map((p, idx) => (
            <View key={p} style={[styles.row, idx > 0 && styles.rowBorder]}>
              <Text style={styles.rowTitle}>{PRAYER_NAMES_AR[p]}</Text>
              <Switch
                value={settings.perPrayer[p]}
                onValueChange={(v) =>
                  update({ ...settings, perPrayer: { ...settings.perPrayer, [p]: v } })
                }
                trackColor={{ true: theme.colors.primary, false: theme.colors.divider }}
                thumbColor="#fff"
                disabled={!settings.enabled}
                testID={`prayer-toggle-${p.toLowerCase()}`}
              />
            </View>
          ))}
        </View>

        {/* Test adhan */}
        <Text style={styles.sectionLabel}>تجربة صوت الأذان</Text>
        <View style={styles.audioBtnRow}>
          <TouchableOpacity style={styles.playBtn} onPress={testAdhan} testID="test-adhan-play">
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.playBtnText}>تشغيل</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stopBtn} onPress={stopAdhan} testID="test-adhan-stop">
            <Ionicons name="stop" size={18} color={theme.colors.primary} />
            <Text style={styles.stopBtnText}>إيقاف</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tip}>
          <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
          <Text style={styles.tipText}>
            الإشعارات المجدولة تعمل بالكامل بعد نشر التطبيق وبناء نسخة APK/IPA. في وضع Expo Go قد لا تظهر إشعارات الأذان في الخلفية.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.textPrimary },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 8,
    textAlign: "right",
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.divider },
  rowTitle: { fontSize: 15, color: theme.colors.textPrimary, fontWeight: "600", textAlign: "right" },
  rowDesc: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, textAlign: "right" },
  iqamahRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  iqamahChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iqamahChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  iqamahChipText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: "600" },
  iqamahChipTextActive: { color: "#fff" },
  audioBtnRow: { flexDirection: "row", gap: 8 },
  playBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    padding: 14,
    borderRadius: theme.radius.md,
  },
  playBtnText: { color: "#fff", fontWeight: "700" },
  stopBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.primaryLight,
    padding: 14,
    borderRadius: theme.radius.md,
  },
  stopBtnText: { color: theme.colors.primary, fontWeight: "700" },
  tip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: theme.colors.primaryLight,
    padding: 14,
    borderRadius: theme.radius.md,
    marginTop: 20,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: "right",
    lineHeight: 20,
  },
});

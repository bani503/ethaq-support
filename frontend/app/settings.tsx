import { useEffect, useState, useMemo } from "react";
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
  MUEZZIN_OPTIONS,
  getMuezzin,
  setSelectedMuezzin,
  type AdhanSettings,
} from "@/src/utils/adhan";
import { storage } from "@/src/utils/storage";

const PRAYERS: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const IQAMAH_OPTIONS = [5, 10, 15, 20, 25, 30];

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<AdhanSettings>(DEFAULT_ADHAN_SETTINGS);
  const [muezzinId, setMuezzinId] = useState<string>(MUEZZIN_OPTIONS[0].id);
  const [loaded, setLoaded] = useState(false);
  const muezzin = useMemo(() => getMuezzin(muezzinId), [muezzinId]);
  const player = useAudioPlayer(muezzin.url);

  useEffect(() => {
    (async () => {
      const s = await getAdhanSettings();
      setSettings(s);
      const m = await storage.getItem<string>("muezzin_id", MUEZZIN_OPTIONS[0].id);
      setMuezzinId(m || MUEZZIN_OPTIONS[0].id);
      setLoaded(true);
    })();
  }, []);

  const chooseMuezzin = async (id: string) => {
    try { player.pause(); } catch {}
    setMuezzinId(id);
    await setSelectedMuezzin(id);
  };

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

        {/* Muezzin picker */}
        <Text style={styles.sectionLabel}>اختيار المؤذن</Text>
        <View style={styles.muezzinList}>
          {MUEZZIN_OPTIONS.map((m) => {
            const selected = m.id === muezzinId;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => chooseMuezzin(m.id)}
                style={[styles.muezzinRow, selected && styles.muezzinRowActive]}
                testID={`muezzin-${m.id}`}
              >
                <View style={[styles.muezzinRadio, selected && styles.muezzinRadioActive]}>
                  {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.muezzinName, selected && styles.muezzinNameActive]}>{m.name}</Text>
                  <Text style={styles.muezzinDesc}>{m.desc}</Text>
                </View>
                <Ionicons
                  name="musical-notes"
                  size={18}
                  color={selected ? theme.colors.gold : theme.colors.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Test adhan */}
        <Text style={styles.sectionLabel}>تجربة صوت {muezzin.name}</Text>
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
  muezzinList: { gap: 8 },
  muezzinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  muezzinRowActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  muezzinRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  muezzinRadioActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  muezzinName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  muezzinNameActive: { color: theme.colors.primary },
  muezzinDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: "right",
  },
});

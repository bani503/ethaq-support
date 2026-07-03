import { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";
import { theme } from "@/src/theme";
import { PRAYER_NAMES_AR, type PrayerName } from "@/src/utils/prayer";

const PRAYERS: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

type DayRecord = {
  Fajr: boolean;
  Dhuhr: boolean;
  Asr: boolean;
  Maghrib: boolean;
  Isha: boolean;
  qada: number; // قضاء
  niyyah?: string; // نية اليوم
};

const emptyDay: DayRecord = {
  Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false, qada: 0,
};

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TrackerScreen() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [record, setRecord] = useState<DayRecord>(emptyDay);
  const [streak, setStreak] = useState(0);
  const [totalQada, setTotalQada] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);

  const load = useCallback(async () => {
    const raw = await storage.getItem<string>(`tracker_${dateKey(today)}`, "");
    if (raw) {
      try { setRecord({ ...emptyDay, ...JSON.parse(raw) }); } catch {}
    }
    // stats
    let s = 0, tq = 0, tc = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const r = await storage.getItem<string>(`tracker_${dateKey(d)}`, "");
      if (!r) { if (i === 0) continue; break; }
      try {
        const rec: DayRecord = { ...emptyDay, ...JSON.parse(r) };
        const done = PRAYERS.filter((p) => rec[p]).length;
        if (i === 0 || done === 5) s = i + 1;
        else if (i > 0) break;
        tq += rec.qada || 0;
        tc += done;
      } catch { break; }
    }
    setStreak(s);
    setTotalQada(tq);
    setTotalCompleted(tc);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (p: PrayerName) => {
    const next: DayRecord = { ...record, [p]: !record[p] };
    setRecord(next);
    await storage.setItem(`tracker_${dateKey(today)}`, JSON.stringify(next));
    load();
  };

  const addQada = async (delta: number) => {
    const next: DayRecord = { ...record, qada: Math.max(0, record.qada + delta) };
    setRecord(next);
    await storage.setItem(`tracker_${dateKey(today)}`, JSON.stringify(next));
    load();
  };

  const done = PRAYERS.filter((p) => record[p]).length;
  const progress = Math.round((done / 5) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="tracker-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="tracker-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>مفكرة الصلوات</Text>
          <Text style={styles.subtitle}>تتبّع صلواتك اليومية</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={22} color={theme.colors.gold} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>أيام متتالية</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done-circle" size={22} color={theme.colors.primary} />
            <Text style={styles.statValue}>{totalCompleted}</Text>
            <Text style={styles.statLabel}>صلاة (30 يوم)</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="time" size={22} color={theme.colors.danger} />
            <Text style={styles.statValue}>{totalQada}</Text>
            <Text style={styles.statLabel}>قضاء (30 يوم)</Text>
          </View>
        </View>

        {/* Today progress */}
        <View style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayTitle}>اليوم</Text>
            <Text style={styles.todayCount}>{done} / 5</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        {/* Prayer checklist */}
        <View style={styles.card}>
          {PRAYERS.map((p, idx) => (
            <TouchableOpacity
              key={p}
              onPress={() => toggle(p)}
              style={[styles.prayerRow, idx > 0 && styles.rowBorder]}
              testID={`prayer-check-${p.toLowerCase()}`}
            >
              <View style={[styles.checkBox, record[p] && styles.checkBoxDone]}>
                {record[p] && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={[styles.prayerName, record[p] && styles.prayerNameDone]}>
                {PRAYER_NAMES_AR[p]}
              </Text>
              {record[p] && <Ionicons name="checkmark-circle" size={22} color={theme.colors.gold} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Qada counter */}
        <Text style={styles.sectionLabel}>قضاء الفوائت</Text>
        <View style={styles.qadaCard}>
          <TouchableOpacity
            style={styles.qadaBtn}
            onPress={() => addQada(-1)}
            testID="qada-decrement"
          >
            <Ionicons name="remove" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <View style={styles.qadaCountBox}>
            <Text style={styles.qadaValue}>{record.qada}</Text>
            <Text style={styles.qadaLabel}>صلوات قضاء اليوم</Text>
          </View>
          <TouchableOpacity
            style={[styles.qadaBtn, styles.qadaBtnPrimary]}
            onPress={() => addQada(1)}
            testID="qada-increment"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.tip}>
          <Ionicons name="bulb" size={16} color={theme.colors.primary} />
          <Text style={styles.tipText}>
            {"«إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا» — النساء: 103"}
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
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: theme.fonts.serif, fontWeight: "700", color: theme.colors.primary },
  subtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: theme.colors.textPrimary, marginTop: 4 },
  statLabel: { fontSize: 10, color: theme.colors.textSecondary, marginTop: 2, textAlign: "center" },
  todayCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 16,
  },
  todayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  todayTitle: { fontSize: 16, color: "#fff", fontWeight: "700" },
  todayCount: { fontSize: 20, color: theme.colors.gold, fontWeight: "800" },
  progressBar: { height: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: theme.colors.gold },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  prayerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: theme.colors.divider },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxDone: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  prayerName: { flex: 1, fontSize: 16, color: theme.colors.textPrimary, fontWeight: "600", textAlign: "right" },
  prayerNameDone: { color: theme.colors.primary },
  sectionLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "right",
  },
  qadaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  qadaBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  qadaBtnPrimary: { backgroundColor: theme.colors.primary },
  qadaCountBox: { flex: 1, alignItems: "center" },
  qadaValue: { fontSize: 28, fontWeight: "800", color: theme.colors.primary },
  qadaLabel: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.goldLight,
    padding: 12,
    borderRadius: theme.radius.md,
    marginTop: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.fonts.serif,
    color: theme.colors.primary,
    textAlign: "right",
    lineHeight: 22,
  },
});

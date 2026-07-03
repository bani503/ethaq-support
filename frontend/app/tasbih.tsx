import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

import { storage } from "@/src/utils/storage";
import { theme } from "@/src/theme";

const DHIKR_OPTIONS = [
  { id: "subhan", text: "سُبْحَانَ اللَّهِ" },
  { id: "hamd", text: "الْحَمْدُ لِلَّهِ" },
  { id: "akbar", text: "اللَّهُ أَكْبَرُ" },
  { id: "istighfar", text: "أَسْتَغْفِرُ اللَّهَ" },
  { id: "salla", text: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ" },
  { id: "tahlil", text: "لَا إِلَهَ إِلَّا اللَّهُ" },
];

const TARGETS = [33, 99, 100, 500];

export default function TasbihScreen() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [dhikr, setDhikr] = useState(DHIKR_OPTIONS[0]);
  const [target, setTarget] = useState(33);
  const scale = useSharedValue(1);

  useEffect(() => {
    (async () => {
      const t = await storage.getItem<number>("tasbih_total", 0);
      setTotal(t ?? 0);
    })();
  }, []);

  const increment = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scale.value = withSequence(withSpring(0.92, { duration: 80 }), withSpring(1, { duration: 120 }));
    setCount((c) => {
      const nc = c + 1;
      if (nc === target) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      return nc;
    });
    setTotal((t) => {
      const nt = t + 1;
      storage.setItem("tasbih_total", nt);
      return nt;
    });
  }, [scale, target]);

  const reset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setCount(0);
  };

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const progress = Math.min(count / target, 1);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="tasbih-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="tasbih-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>المسبحة</Text>
        <TouchableOpacity onPress={reset} style={styles.backBtn} testID="tasbih-reset">
          <Ionicons name="refresh" size={20} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.dhikrBox}>
          <Text style={styles.dhikrText}>{dhikr.text}</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{count}</Text>
            <Text style={styles.statLabel}>الحالي</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{target}</Text>
            <Text style={styles.statLabel}>الهدف</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>الإجمالي</Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={increment}
          style={styles.counterBtnWrap}
          testID="tasbih-increment-btn"
        >
          <Animated.View style={[styles.counterBtn, animStyle]}>
            <View style={styles.counterInner}>
              <Text style={styles.counterNum}>{count}</Text>
              <Text style={styles.counterHint}>اضغط للتسبيح</Text>
            </View>
          </Animated.View>
        </TouchableOpacity>

        <Text style={styles.pickerLabel}>اختر الذكر</Text>
        <View style={styles.chipsWrap}>
          {DHIKR_OPTIONS.map((d) => (
            <TouchableOpacity
              key={d.id}
              onPress={() => setDhikr(d)}
              style={[styles.chip, dhikr.id === d.id && styles.chipActive]}
              testID={`dhikr-chip-${d.id}`}
            >
              <Text style={[styles.chipText, dhikr.id === d.id && styles.chipTextActive]}>
                {d.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.pickerLabel}>الهدف</Text>
        <View style={styles.targetRow}>
          {TARGETS.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => {
                setTarget(t);
                setCount(0);
              }}
              style={[styles.targetChip, target === t && styles.targetChipActive]}
              testID={`target-${t}`}
            >
              <Text style={[styles.targetText, target === t && styles.targetTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: theme.colors.textPrimary },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  dhikrBox: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  dhikrText: {
    fontSize: 30,
    color: "#fff",
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    textAlign: "center",
  },
  stats: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  statCell: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statDivider: { width: 1, backgroundColor: theme.colors.border, marginVertical: 12 },
  statValue: { fontSize: 22, fontWeight: "700", color: theme.colors.primary },
  statLabel: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.divider,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: {
    height: 6,
    backgroundColor: theme.colors.gold,
  },
  counterBtnWrap: { alignItems: "center", marginBottom: 24 },
  counterBtn: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  counterInner: {
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(212,175,55,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  counterNum: { fontSize: 78, color: "#fff", fontWeight: "800" },
  counterHint: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  pickerLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    textAlign: "right",
    fontWeight: "600",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  chipText: { fontSize: 14, color: theme.colors.textSecondary, fontFamily: theme.fonts.serif },
  chipTextActive: { color: theme.colors.primary, fontWeight: "700" },
  targetRow: { flexDirection: "row", gap: 8 },
  targetChip: {
    flex: 1,
    padding: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  targetChipActive: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  targetText: { fontSize: 15, fontWeight: "700", color: theme.colors.textSecondary },
  targetTextActive: { color: "#fff" },
});

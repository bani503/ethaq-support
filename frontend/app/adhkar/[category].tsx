import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { ADHKAR, type AdhkarCategory } from "@/src/data/adhkar";
import { theme } from "@/src/theme";

export default function AdhkarDetail() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const router = useRouter();

  const key = (category as AdhkarCategory) in ADHKAR ? (category as AdhkarCategory) : "morning";
  const data = ADHKAR[key];
  const [counts, setCounts] = useState<Record<number, number>>({});

  const tap = (idx: number, target: number) => {
    const cur = counts[idx] || 0;
    if (cur >= target) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nc = cur + 1;
    setCounts({ ...counts, [idx]: nc });
    if (nc === target) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const completed = Object.entries(counts).filter(
    ([i, c]) => c >= data.items[Number(i)].count,
  ).length;
  const progress = Math.round((completed / data.items.length) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="adhkar-detail">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="adhkar-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.progress}>{completed} / {data.items.length}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {data.items.map((item, idx) => {
          const cur = counts[idx] || 0;
          const done = cur >= item.count;
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.85}
              onPress={() => tap(idx, item.count)}
              style={[styles.card, done && styles.cardDone]}
              testID={`dhikr-item-${idx}`}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.countBadge, done && styles.countBadgeDone]}>
                  <Text style={[styles.countText, done && styles.countTextDone]}>
                    {cur} / {item.count}
                  </Text>
                </View>
                {done && <Ionicons name="checkmark-circle" size={22} color={theme.colors.gold} />}
              </View>
              <Text style={[styles.dhikrText, done && styles.dhikrTextDone]}>{item.text}</Text>
              {item.virtue && <Text style={styles.virtue}>· {item.virtue}</Text>}
            </TouchableOpacity>
          );
        })}
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontFamily: theme.fonts.serif, fontWeight: "700", color: theme.colors.primary },
  progress: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.divider,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: theme.colors.gold },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardDone: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  countBadge: {
    backgroundColor: theme.colors.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countBadgeDone: { backgroundColor: theme.colors.primary },
  countText: { fontSize: 12, color: theme.colors.primary, fontWeight: "700" },
  countTextDone: { color: "#fff" },
  dhikrText: {
    fontSize: 18,
    lineHeight: 32,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.serif,
    textAlign: "right",
  },
  dhikrTextDone: { color: theme.colors.primary },
  virtue: { fontSize: 11, color: theme.colors.textMuted, marginTop: 8, textAlign: "right" },
});

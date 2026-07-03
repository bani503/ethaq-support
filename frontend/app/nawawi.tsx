import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";
import { theme } from "@/src/theme";
import { NAWAWI_40 } from "@/src/data/nawawi";

export default function NawawiScreen() {
  const router = useRouter();
  const [readSet, setReadSet] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem<string>("nawawi_read", "");
      if (raw) {
        try { setReadSet(new Set(JSON.parse(raw))); } catch {}
      }
    })();
  }, []);

  const toggleRead = async (num: number) => {
    const next = new Set(readSet);
    if (next.has(num)) next.delete(num);
    else next.add(num);
    setReadSet(next);
    await storage.setItem("nawawi_read", JSON.stringify([...next]));
  };

  const percent = Math.round((readSet.size / NAWAWI_40.length) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="nawawi-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="nawawi-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>الأربعون النووية</Text>
          <Text style={styles.subtitle}>{readSet.size} / 40 محفوظ</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>

      <FlatList
        data={NAWAWI_40}
        keyExtractor={(item) => String(item.num)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const read = readSet.has(item.num);
          const open = expanded === item.num;
          return (
            <View style={[styles.card, read && styles.cardDone]} testID={`nawawi-${item.num}`}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setExpanded(open ? null : item.num)}
                style={styles.cardHead}
              >
                <View style={[styles.numBadge, read && styles.numBadgeDone]}>
                  <Text style={[styles.numText, read && styles.numTextDone]}>{item.num}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSource}>{item.source}</Text>
                </View>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {open && (
                <View style={styles.cardBody}>
                  <Text style={styles.hadithText}>{item.text}</Text>
                  <TouchableOpacity
                    onPress={() => toggleRead(item.num)}
                    style={[styles.readBtn, read && styles.readBtnActive]}
                    testID={`nawawi-toggle-${item.num}`}
                  >
                    <Ionicons name={read ? "checkmark-circle" : "ellipse-outline"} size={18} color={read ? "#fff" : theme.colors.primary} />
                    <Text style={[styles.readBtnText, read && styles.readBtnTextActive]}>
                      {read ? "تم الحفظ ✓" : "تم قراءته"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
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
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.divider,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 4, backgroundColor: theme.colors.gold },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  cardDone: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  numBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
  },
  numBadgeDone: { backgroundColor: theme.colors.gold },
  numText: { fontSize: 15, fontWeight: "700", color: theme.colors.primary },
  numTextDone: { color: "#fff" },
  cardTitle: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontFamily: theme.fonts.serif,
    textAlign: "right",
  },
  cardSource: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2, textAlign: "right" },
  cardBody: {
    padding: 14,
    paddingTop: 0,
  },
  hadithText: {
    fontSize: 17,
    lineHeight: 32,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.serif,
    textAlign: "right",
    marginBottom: 12,
  },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  readBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  readBtnText: { color: theme.colors.primary, fontWeight: "700", fontSize: 13 },
  readBtnTextActive: { color: "#fff" },
});

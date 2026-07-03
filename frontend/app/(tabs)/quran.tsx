import { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { SURAHS } from "@/src/data/surahs";

export default function QuranTab() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SURAHS;
    return SURAHS.filter(
      (s) =>
        s.name.includes(q) ||
        s.englishName.toLowerCase().includes(q) ||
        String(s.number).includes(q),
    );
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="quran-screen">
      <View style={styles.header}>
        <Text style={styles.title}>القرآن الكريم</Text>
        <Text style={styles.subtitle}>114 سورة</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن سورة..."
          placeholderTextColor={theme.colors.textMuted}
          style={styles.search}
          testID="quran-search"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.number)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.row}
            onPress={() => router.push(`/quran/${item.number}`)}
            testID={`surah-row-${item.number}`}
          >
            <View style={styles.numberBadge}>
              <Ionicons name="star" size={14} color={theme.colors.gold} style={StyleSheet.absoluteFill as any} />
              <Text style={styles.numberText}>{item.number}</Text>
            </View>
            <View style={styles.rowMid}>
              <Text style={styles.surahName}>{item.name}</Text>
              <Text style={styles.surahMeta}>{item.type} · {item.ayah} آية</Text>
            </View>
            <Text style={styles.surahEn}>{item.englishName}</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: {
    fontSize: 28,
    color: theme.colors.primary,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    textAlign: "right",
  },
  subtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, textAlign: "right" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  search: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  numberBadge: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  numberText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "700",
    zIndex: 2,
  },
  rowMid: { flex: 1 },
  surahName: {
    fontSize: 18,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    textAlign: "right",
  },
  surahMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    textAlign: "right",
  },
  surahEn: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: "600",
  },
  sep: { height: 8 },
});

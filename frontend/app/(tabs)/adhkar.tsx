import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { ADHKAR } from "@/src/data/adhkar";

const CATEGORIES: {
  key: keyof typeof ADHKAR;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  gradient: string;
}[] = [
  { key: "morning", icon: "sunny", color: theme.colors.gold, gradient: "#FFF6E0" },
  { key: "evening", icon: "moon", color: theme.colors.primary, gradient: "#E7F0EC" },
  { key: "sleep", icon: "bed", color: "#5B4FCF", gradient: "#EEECFB" },
  { key: "afterPrayer", icon: "heart", color: theme.colors.danger, gradient: "#FBEAE5" },
];

export default function AdhkarTab() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="adhkar-screen">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>الأذكار</Text>
          <Text style={styles.subtitle}>حصنك من الله</Text>
        </View>

        {CATEGORIES.map((c) => {
          const cat = ADHKAR[c.key];
          return (
            <TouchableOpacity
              key={c.key}
              activeOpacity={0.85}
              style={[styles.card, { backgroundColor: c.gradient }]}
              onPress={() => router.push(`/adhkar/${c.key}`)}
              testID={`adhkar-cat-${c.key}`}
            >
              <View style={styles.cardLeft}>
                <View style={[styles.iconWrap, { backgroundColor: "#FFFFFF" }]}>
                  <Ionicons name={c.icon} size={22} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{cat.title}</Text>
                  <Text style={styles.cardMeta}>{cat.items.length} ذكر</Text>
                </View>
              </View>
              <Ionicons name="chevron-back" size={20} color={c.color} />
            </TouchableOpacity>
          );
        })}

        <View style={styles.tip}>
          <Ionicons name="information-circle" size={18} color={theme.colors.primary} />
          <Text style={styles.tipText}>
            اضغط على الذكر لتعدّه، وسيتم حفظ تقدمك في هذه الجلسة.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 20, paddingBottom: 24 },
  header: { marginBottom: 20 },
  title: {
    fontSize: 28,
    color: theme.colors.primary,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    textAlign: "right",
  },
  subtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, textAlign: "right" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: theme.radius.lg,
    marginBottom: 12,
  },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.serif,
    textAlign: "right",
  },
  cardMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: "right",
  },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.primaryLight,
    padding: 12,
    borderRadius: theme.radius.md,
    marginTop: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.primary,
    textAlign: "right",
    lineHeight: 20,
  },
});

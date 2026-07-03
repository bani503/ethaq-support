import { View, Text, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "@/src/theme";
import { ASMA_AL_HUSNA } from "@/src/data/asma";

export default function AsmaScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="asma-screen">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="asma-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>أسماء الله الحسنى</Text>
          <Text style={styles.subtitle}>99 اسمًا</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={ASMA_AL_HUSNA}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        renderItem={({ item, index }) => (
          <View style={styles.card} testID={`asma-card-${index}`}>
            <View style={styles.numBadge}>
              <Text style={styles.numText}>{index + 1}</Text>
            </View>
            <Text style={styles.name}>{item.ar}</Text>
            <Text style={styles.meaning} numberOfLines={3}>
              {item.meaning}
            </Text>
          </View>
        )}
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
  title: {
    fontSize: 20,
    color: theme.colors.primary,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 2,
  },
  list: { padding: 16, gap: 10, paddingBottom: 32 },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    minHeight: 130,
  },
  numBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.goldLight,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: { fontSize: 10, color: theme.colors.primary, fontWeight: "700" },
  name: {
    fontSize: 22,
    color: theme.colors.primary,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  meaning: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
    textAlign: "center",
  },
});

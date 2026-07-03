import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { theme } from "@/src/theme";
import { SURAHS } from "@/src/data/surahs";

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
}

export default function SurahReader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const surahNum = parseInt(id || "1", 10);
  const meta = SURAHS.find((s) => s.number === surahNum);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const r = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`);
        const j = await r.json();
        if (j.code === 200 && j.data?.ayahs) {
          setAyahs(j.data.ayahs);
        } else {
          setError("تعذر تحميل السورة");
        }
      } catch (e) {
        setError("تعذر الاتصال بالإنترنت");
      } finally {
        setLoading(false);
      }
    })();
  }, [surahNum]);

  const showBasmalah = surahNum !== 1 && surahNum !== 9;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="surah-reader">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="surah-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>سورة {meta?.name}</Text>
          <Text style={styles.subtitle}>{meta?.type} · {meta?.ayah} آية</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.center}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
          </View>
        )}

        {!loading && !error && ayahs.length > 0 && (
          <View style={styles.card}>
            {showBasmalah && (
              <Text style={styles.basmalah}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
            )}
            <Text style={styles.body}>
              {ayahs.map((a) => (
                <Text key={a.number}>
                  <Text style={styles.ayahText}>
                    {surahNum === 1 || a.numberInSurah === 1
                      ? a.text.replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, "")
                      : a.text}
                  </Text>
                  <Text style={styles.ayahNum}> ﴿{toArabicNumber(a.numberInSurah)}﴾ </Text>
                </Text>
              ))}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function toArabicNumber(n: number): string {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(n)
    .split("")
    .map((d) => digits[parseInt(d, 10)] || d)
    .join("");
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
  subtitle: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  center: { padding: 40, alignItems: "center", justifyContent: "center" },
  error: { color: theme.colors.danger, fontSize: 14 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  basmalah: {
    fontSize: 26,
    fontFamily: theme.fonts.serif,
    color: theme.colors.primary,
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "700",
  },
  body: {
    fontSize: 22,
    lineHeight: 46,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.serif,
    textAlign: "right",
    writingDirection: "rtl",
  },
  ayahText: {
    fontSize: 22,
    lineHeight: 46,
    fontFamily: theme.fonts.serif,
    color: theme.colors.textPrimary,
  },
  ayahNum: {
    color: theme.colors.gold,
    fontSize: 16,
    fontWeight: "700",
  },
});

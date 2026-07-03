import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useRouter } from "expo-router";

import { theme } from "@/src/theme";
import {
  fetchPrayerTimes,
  getNextPrayer,
  formatCountdown,
  PRAYER_NAMES_AR,
  toArabicMonth,
  type PrayerData,
} from "@/src/utils/prayer";
import { getAdhanSettings, scheduleAdhanForTimings } from "@/src/utils/adhan";

const HERO_IMAGE = { uri: "https://images.unsplash.com/photo-1554147090-e1221a04a025?w=1200" };

// Fallback: Makkah coordinates
const FALLBACK_LAT = 21.4225;
const FALLBACK_LNG = 39.8262;
const FALLBACK_CITY = "مكة المكرمة";

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prayerData, setPrayerData] = useState<PrayerData | null>(null);
  const [cityName, setCityName] = useState<string>(FALLBACK_CITY);
  const [hadith, setHadith] = useState<{ hadith: string; source: string } | null>(null);
  const [tick, setTick] = useState(0);

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

  const loadData = useCallback(async () => {
    try {
      let lat = FALLBACK_LAT;
      let lng = FALLBACK_LNG;
      let city = FALLBACK_CITY;

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getLastKnownPositionAsync().catch(() => null);
        const pos = loc || (await Location.getCurrentPositionAsync({}).catch(() => null));
        if (pos) {
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
          if (geo && geo[0]) {
            city = geo[0].city || geo[0].region || geo[0].country || city;
          }
        }
      }

      setCityName(city);
      const data = await fetchPrayerTimes(lat, lng);
      setPrayerData(data);

      // Schedule adhan/iqamah notifications for today's remaining prayers
      try {
        const s = await getAdhanSettings();
        await scheduleAdhanForTimings(data.timings, s);
      } catch (e) {
        console.log("adhan schedule error", e);
      }

      // Hadith
      try {
        const r = await fetch(`${backendUrl}/api/hadith/daily`);
        const j = await r.json();
        setHadith({ hadith: j.hadith, source: j.source });
      } catch {}
    } catch (e) {
      console.log("home load error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    (async () => {
      // Ask permission on first mount but do not block
      const cur = await Location.getForegroundPermissionsAsync();
      if (cur.status === "undetermined") {
        await Location.requestForegroundPermissionsAsync().catch(() => null);
      }
      loadData();
    })();
  }, [loadData]);

  // Ticker for countdown re-render every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const next = prayerData ? getNextPrayer(prayerData.timings) : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="home-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        {/* Top greeting */}
        <View style={styles.header}>
          <View>
            <Text style={styles.appName} testID="app-name">إيثاق</Text>
            <Text style={styles.appSub}>وعدك مع الله</Text>
          </View>
          <View style={styles.locationChip}>
            <Ionicons name="location" size={14} color={theme.colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>{cityName}</Text>
          </View>
        </View>

        {/* Hero prayer card */}
        <TouchableOpacity activeOpacity={0.92} style={styles.heroWrap} testID="prayer-hero-card">
          <ImageBackground source={HERO_IMAGE} style={styles.hero} imageStyle={styles.heroImg}>
            <LinearGradient
              colors={["rgba(15,76,58,0.72)", "rgba(10,54,41,0.94)"]}
              style={StyleSheet.absoluteFill}
            />
            {loading || !next || !prayerData ? (
              <View style={styles.heroLoading}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : (
              <View style={styles.heroContent}>
                <View style={styles.heroTopRow}>
                  <View style={styles.hijriPill}>
                    <Ionicons name="moon" size={12} color={theme.colors.gold} />
                    <Text style={styles.hijriText}>
                      {prayerData.hijri.day} {toArabicMonth(prayerData.hijri.month)} {prayerData.hijri.year}هـ
                    </Text>
                  </View>
                  <Text style={styles.heroLabel}>الصلاة القادمة</Text>
                </View>
                <Text style={styles.heroPrayerName}>{PRAYER_NAMES_AR[next.name]}</Text>
                <Text style={styles.heroTime}>{next.time}</Text>
                <View style={styles.heroDivider} />
                <View style={styles.heroBottom}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.gold} />
                  <Text style={styles.heroCountdown}>بعد {formatCountdown(next.minutesUntil)}</Text>
                </View>
              </View>
            )}
          </ImageBackground>
        </TouchableOpacity>

        {/* Prayer times row */}
        {prayerData && (
          <View style={styles.timesRow} testID="prayer-times-row">
            {(["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const).map((p) => {
              const isNext = next?.name === p;
              return (
                <View
                  key={p}
                  style={[styles.timeCell, isNext && styles.timeCellActive]}
                  testID={`prayer-cell-${p.toLowerCase()}`}
                >
                  <Text style={[styles.timeCellName, isNext && styles.timeCellNameActive]}>
                    {PRAYER_NAMES_AR[p]}
                  </Text>
                  <Text style={[styles.timeCellTime, isNext && styles.timeCellTimeActive]}>
                    {prayerData.timings[p]}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Daily hadith */}
        <View style={styles.hadithCard} testID="daily-hadith">
          <View style={styles.hadithHeader}>
            <View style={styles.hadithBadge}>
              <Ionicons name="book" size={14} color={theme.colors.gold} />
              <Text style={styles.hadithBadgeText}>حديث اليوم</Text>
            </View>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.textMuted} />
          </View>
          <Text style={styles.hadithText}>
            {hadith ? hadith.hadith : "..."}
          </Text>
          {hadith?.source && <Text style={styles.hadithSource}>{hadith.source}</Text>}
        </View>

        {/* Bento grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>الخدمات</Text>
          <TouchableOpacity onPress={() => router.push("/settings")} testID="header-settings">
            <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.bento}>
          <BentoCard
            title="مفكرة الصلوات"
            subtitle="تتبّع صلواتك"
            icon="calendar-outline"
            color={theme.colors.primary}
            onPress={() => router.push("/tracker")}
            testID="bento-tracker"
          />
          <BentoCard
            title="الأربعون النووية"
            subtitle="40 حديث"
            icon="library-outline"
            color={theme.colors.gold}
            onPress={() => router.push("/nawawi")}
            testID="bento-nawawi"
          />
          <BentoCard
            title="المسبحة"
            subtitle="سبّح واذكر"
            icon="ellipse-outline"
            color={theme.colors.primary}
            onPress={() => router.push("/tasbih")}
            testID="bento-tasbih"
          />
          <BentoCard
            title="الأذكار"
            subtitle="صباحاً ومساءً"
            icon="flower-outline"
            color={theme.colors.gold}
            onPress={() => router.push("/(tabs)/adhkar")}
            testID="bento-adhkar"
          />
          <BentoCard
            title="القرآن"
            subtitle="اقرأ واستمع"
            icon="book-outline"
            color={theme.colors.primary}
            onPress={() => router.push("/(tabs)/quran")}
            testID="bento-quran"
          />
          <BentoCard
            title="القبلة"
            subtitle="جهة الكعبة"
            icon="compass-outline"
            color={theme.colors.gold}
            onPress={() => router.push("/(tabs)/qibla")}
            testID="bento-qibla"
          />
          <BentoCard
            title="أسماء الله الحسنى"
            subtitle="99 اسمًا"
            icon="sparkles-outline"
            color={theme.colors.primary}
            onPress={() => router.push("/asma")}
            testID="bento-asma"
            wide
          />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BentoCard({
  title,
  subtitle,
  icon,
  color,
  onPress,
  testID,
  wide,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  testID: string;
  wide?: boolean;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.bentoCard, wide && styles.bentoCardWide]}
      onPress={onPress}
      testID={testID}
    >
      <View style={[styles.bentoIcon, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.bentoTitle}>{title}</Text>
      <Text style={styles.bentoSubtitle}>{subtitle}</Text>
      <View style={styles.bentoArrow}>
        <Ionicons name="chevron-back" size={16} color={theme.colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 16,
  },
  appName: {
    fontSize: 28,
    color: theme.colors.primary,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
  },
  appSub: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  locationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 160,
  },
  locationText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: "600",
  },
  heroWrap: {
    marginBottom: 16,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  hero: {
    minHeight: 200,
    padding: 20,
  },
  heroImg: {
    resizeMode: "cover",
  },
  heroLoading: { height: 160, alignItems: "center", justifyContent: "center" },
  heroContent: { position: "relative" },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  hijriPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  hijriText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  heroLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12 },
  heroPrayerName: {
    fontSize: 40,
    color: "#FFF",
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    marginTop: 4,
  },
  heroTime: {
    fontSize: 28,
    color: theme.colors.gold,
    fontWeight: "700",
    marginTop: 2,
  },
  heroDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 12,
  },
  heroBottom: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroCountdown: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  timesRow: {
    flexDirection: "row",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  timeCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  timeCellActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  timeCellName: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  timeCellNameActive: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
  timeCellTime: {
    fontSize: 13,
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  timeCellTimeActive: {
    color: theme.colors.primary,
  },
  hadithCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
  },
  hadithHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  hadithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  hadithBadgeText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: "700",
  },
  hadithText: {
    fontSize: 17,
    lineHeight: 30,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.serif,
    textAlign: "right",
  },
  hadithSource: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 10,
    textAlign: "right",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  bento: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  bentoCard: {
    width: "48%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 120,
    justifyContent: "space-between",
  },
  bentoCardWide: {
    width: "100%",
  },
  bentoIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  bentoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.textPrimary,
    textAlign: "right",
  },
  bentoSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
    textAlign: "right",
  },
  bentoArrow: {
    position: "absolute",
    top: 16,
    left: 16,
  },
});

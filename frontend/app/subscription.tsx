import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth, apiFetch } from "@/src/auth";
import { theme } from "@/src/theme";

const FEATURES = [
  { icon: "heart", text: "إهداءات دعاء بلا حدود" },
  { icon: "musical-notes", text: "تلاوات قرآنية بجودة عالية" },
  { icon: "people", text: "أسرة إيثاق (قريباً)" },
  { icon: "sparkles", text: "دعم لمساعد إيثاق الذكي" },
  { icon: "shield-checkmark", text: "بدون إعلانات — للأبد" },
] as const;

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, token, signIn, refreshUser } = useAuth();
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ active: boolean; plan?: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) return;
      const r = await apiFetch("/api/subscription/status", token);
      if (r.ok) setStatus(await r.json());
    })();
  }, [token]);

  const subscribe = async () => {
    if (!user) {
      await signIn();
      return;
    }
    setLoading(true);
    try {
      const r = await apiFetch("/api/subscription/checkout", token, {
        method: "POST",
        body: JSON.stringify({ plan: selected }),
      });
      if (!r.ok) {
        Alert.alert("تعذر إنشاء الجلسة", await r.text());
        return;
      }
      const j = await r.json();
      const url: string = j.checkout_url;
      if (Platform.OS === "web") {
        window.location.href = url;
      } else {
        const redirect = Linking.createURL("subscription/success");
        const res = await WebBrowser.openAuthSessionAsync(url, redirect);
        if (res.type === "success" || res.type === "dismiss") {
          // Try to verify from URL if present
          try {
            const stripeSession = j.session_id;
            if (stripeSession) {
              const vr = await apiFetch(`/api/subscription/verify/${stripeSession}`, token);
              if (vr.ok) {
                await refreshUser();
                const vj = await vr.json();
                if (vj.active) {
                  Alert.alert("مبارك 🎉", "تم تفعيل اشتراكك في إيثاق بريميوم.");
                }
              }
            }
          } catch {}
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const active = status?.active || user?.subscription_status === "active";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="subscription-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="sub-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>إيثاق بريميوم</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.crownWrap}>
            <Ionicons name="star" size={40} color={theme.colors.gold} />
          </View>
          <Text style={styles.heroTitle}>ارفع تجربتك الروحانية</Text>
          <Text style={styles.heroDesc}>ادعم إيثاق واحصل على جميع الميزات المتقدمة</Text>
        </View>

        {active ? (
          <View style={styles.activeCard}>
            <Ionicons name="checkmark-circle" size={40} color={theme.colors.gold} />
            <Text style={styles.activeTitle}>اشتراكك مفعّل</Text>
            <Text style={styles.activeDesc}>جزاك الله خيراً على دعمك للتطبيق</Text>
          </View>
        ) : (
          <>
            <View style={styles.plans}>
              <PlanCard
                plan="yearly"
                title="سنوي"
                price="30"
                period="ريال/سنة"
                badge="وفّر 16%"
                selected={selected === "yearly"}
                onSelect={() => setSelected("yearly")}
              />
              <PlanCard
                plan="monthly"
                title="شهري"
                price="3"
                period="ريال/شهر"
                selected={selected === "monthly"}
                onSelect={() => setSelected("monthly")}
              />
            </View>

            <View style={styles.features}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <Ionicons name={f.icon as any} size={16} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={subscribe}
              disabled={loading}
              testID="subscribe-btn"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="star" size={16} color="#fff" />
                  <Text style={styles.ctaBtnText}>
                    {user ? `اشترك الآن (${selected === "monthly" ? "3" : "30"} ريال)` : "سجّل الدخول للاشتراك"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              الدفع آمن عبر Stripe. يمكنك إلغاء الاشتراك في أي وقت.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanCard({
  title, price, period, badge, selected, onSelect,
}: {
  plan: "monthly" | "yearly";
  title: string;
  price: string;
  period: string;
  badge?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      style={[styles.planCard, selected && styles.planCardActive]}
      activeOpacity={0.85}
      testID={`plan-${title === "شهري" ? "monthly" : "yearly"}`}
    >
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Text style={[styles.planTitle, selected && styles.planTitleActive]}>{title}</Text>
      <View style={styles.priceRow}>
        <Text style={[styles.price, selected && styles.priceActive]}>{price}</Text>
        <Text style={[styles.period, selected && styles.periodActive]}>{period}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.textPrimary },
  content: { padding: 20, paddingBottom: 40 },
  hero: { alignItems: "center", marginBottom: 24 },
  crownWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: theme.colors.goldLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 22, fontFamily: theme.fonts.serif, fontWeight: "700", color: theme.colors.primary,
  },
  heroDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, textAlign: "center" },
  activeCard: {
    backgroundColor: theme.colors.primary,
    padding: 24, borderRadius: theme.radius.lg,
    alignItems: "center",
  },
  activeTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 12 },
  activeDesc: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4 },
  plans: { flexDirection: "row", gap: 12, marginBottom: 20 },
  planCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: "center",
  },
  planCardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  badge: {
    position: "absolute", top: -10, backgroundColor: theme.colors.gold,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  planTitle: {
    fontSize: 14, fontWeight: "700", color: theme.colors.textSecondary, marginTop: 8, marginBottom: 8,
  },
  planTitleActive: { color: theme.colors.primary },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  price: { fontSize: 34, fontWeight: "800", color: theme.colors.textPrimary },
  priceActive: { color: theme.colors.primary },
  period: { fontSize: 12, color: theme.colors.textSecondary },
  periodActive: { color: theme.colors.primary },
  radio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: theme.colors.border,
    marginTop: 12,
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  features: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    padding: 16, borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 20, gap: 10,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  featureText: { fontSize: 14, color: theme.colors.textPrimary, flex: 1, textAlign: "right" },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary,
    padding: 16, borderRadius: theme.radius.md,
  },
  ctaBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  disclaimer: { fontSize: 11, color: theme.colors.textMuted, textAlign: "center", marginTop: 12 },
});

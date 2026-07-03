import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { theme } from "@/src/theme";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="profile-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="profile-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>حسابي</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!user ? (
          <View style={styles.loginBox}>
            <View style={styles.loginIcon}>
              <Ionicons name="person" size={36} color={theme.colors.primary} />
            </View>
            <Text style={styles.loginTitle}>مرحباً بك في إيثاق</Text>
            <Text style={styles.loginDesc}>
              سجّل الدخول عبر جوجل لحفظ تقدّمك ومزاياك واستخدام الميزات الخاصة.
            </Text>
            <TouchableOpacity style={styles.googleBtn} onPress={signIn} testID="login-google-btn">
              <Ionicons name="logo-google" size={18} color="#fff" />
              <Text style={styles.googleBtnText}>الدخول بحساب جوجل</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.userCard}>
              {user.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={30} color="#fff" />
                </View>
              )}
              <Text style={styles.userName}>{user.name || "مستخدم"}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              {user.subscription_status === "active" ? (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={14} color="#fff" />
                  <Text style={styles.premiumBadgeText}>عضو بريميوم</Text>
                </View>
              ) : (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>حساب مجاني</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push("/subscription")}
              testID="row-subscription"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: theme.colors.goldLight }]}>
                  <Ionicons name="star" size={18} color={theme.colors.gold} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>إيثاق بريميوم</Text>
                  <Text style={styles.rowDesc}>
                    {user.subscription_status === "active" ? "مفعّل" : "3 ريال/شهر · 30 ريال/سنة"}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push("/dedications")}
              testID="row-dedications"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: theme.colors.primaryLight }]}>
                  <Ionicons name="heart" size={18} color={theme.colors.primary} />
                </View>
                <View>
                  <Text style={styles.rowTitle}>إهداءات الدعاء</Text>
                  <Text style={styles.rowDesc}>أهدِ دعوة لمن تحب</Text>
                </View>
              </View>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push("/family")}
              testID="row-family"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: "#EEECFB" }]}>
                  <Ionicons name="people" size={18} color="#5B4FCF" />
                </View>
                <View>
                  <Text style={styles.rowTitle}>أسرة إيثاق</Text>
                  <Text style={styles.rowDesc}>شارك تقدّمك مع من تحب</Text>
                </View>
              </View>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push("/settings")}
              testID="row-settings"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, { backgroundColor: theme.colors.divider }]}>
                  <Ionicons name="settings" size={18} color={theme.colors.textSecondary} />
                </View>
                <Text style={styles.rowTitle}>الإعدادات</Text>
              </View>
              <Ionicons name="chevron-back" size={20} color={theme.colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={signOut} testID="logout-btn">
              <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
              <Text style={styles.logoutText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.textPrimary },
  content: { padding: 16, paddingBottom: 40 },
  loginBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  loginIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  loginTitle: {
    fontSize: 22, fontFamily: theme.fonts.serif, fontWeight: "700", color: theme.colors.primary,
    marginBottom: 8,
  },
  loginDesc: {
    fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", lineHeight: 24, marginBottom: 24,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 999,
  },
  googleBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  userCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 8 },
  avatarPlaceholder: {
    backgroundColor: theme.colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  userName: { fontSize: 18, fontWeight: "700", color: theme.colors.textPrimary },
  userEmail: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  premiumBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.gold,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, marginTop: 12,
  },
  premiumBadgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  freeBadge: {
    backgroundColor: theme.colors.divider,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, marginTop: 12,
  },
  freeBadgeText: { color: theme.colors.textSecondary, fontWeight: "600", fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontSize: 15, color: theme.colors.textPrimary, fontWeight: "700" },
  rowDesc: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, marginTop: 12,
  },
  logoutText: { color: theme.colors.danger, fontWeight: "700", fontSize: 14 },
});

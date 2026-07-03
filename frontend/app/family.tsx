import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Share, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useAuth, apiFetch } from "@/src/auth";
import { theme } from "@/src/theme";

type Member = {
  user_id: string;
  email: string;
  name?: string;
  picture?: string;
  subscription_status?: string;
};
type Family = { id: string; name: string; code: string; owner_id: string; member_ids: string[] };

export default function FamilyScreen() {
  const router = useRouter();
  const { user, token, signIn } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [famName, setFamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    const r = await apiFetch("/api/families/me", token);
    if (r.ok) {
      const j = await r.json();
      setFamily(j.family);
      setMembers(j.members || []);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!famName.trim()) { Alert.alert("مطلوب", "اكتب اسم الأسرة"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/families", token, {
        method: "POST",
        body: JSON.stringify({ name: famName.trim() }),
      });
      if (r.ok) { setMode("none"); setFamName(""); await load(); }
    } finally { setSubmitting(false); }
  };

  const join = async () => {
    if (!joinCode.trim()) { Alert.alert("مطلوب", "أدخل كود الأسرة"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/families/join", token, {
        method: "POST",
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });
      if (r.status === 404) { Alert.alert("خطأ", "كود الأسرة غير صحيح"); return; }
      if (r.ok) { setMode("none"); setJoinCode(""); await load(); }
    } finally { setSubmitting(false); }
  };

  const leave = () => {
    Alert.alert(
      "الخروج من الأسرة",
      "هل أنت متأكد من الخروج من هذه الأسرة؟",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "خروج", style: "destructive",
          onPress: async () => {
            await apiFetch("/api/families/leave", token, { method: "POST" });
            setFamily(null); setMembers([]); load();
          },
        },
      ],
    );
  };

  const shareCode = async () => {
    if (!family) return;
    try {
      await Share.share({
        message: `انضم إلى أسرة "${family.name}" في تطبيق إيثاق الإسلامي 🕌\n\nكود الأسرة: ${family.code}`,
      });
    } catch {}
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]} testID="family-screen">
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>أسرة إيثاق</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>يتطلب تسجيل الدخول</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={signIn} testID="fam-signin-btn">
            <Text style={styles.primaryBtnText}>سجّل الدخول</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="family-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="fam-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>أسرة إيثاق</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
        ) : family ? (
          <>
            <View style={styles.famHero}>
              <View style={styles.famIcon}>
                <Ionicons name="people" size={30} color="#fff" />
              </View>
              <Text style={styles.famName}>{family.name}</Text>
              <Text style={styles.famMeta}>{members.length} عضو</Text>
            </View>

            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>كود الأسرة</Text>
              <Text style={styles.codeValue} testID="family-code">{family.code}</Text>
              <TouchableOpacity onPress={shareCode} style={styles.shareBtn} testID="share-code-btn">
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.shareBtnText}>مشاركة الكود</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>الأعضاء</Text>
            {members.map((m) => (
              <View key={m.user_id} style={styles.memberRow} testID={`member-${m.user_id}`}>
                {m.picture ? (
                  <Image source={{ uri: m.picture }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                    <Ionicons name="person" size={18} color="#fff" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{m.name || m.email.split("@")[0]}</Text>
                    {m.user_id === family.owner_id && (
                      <View style={styles.ownerBadge}>
                        <Text style={styles.ownerBadgeText}>المؤسس</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.memberEmail}>{m.email}</Text>
                </View>
                {m.subscription_status === "active" && (
                  <Ionicons name="star" size={16} color={theme.colors.gold} />
                )}
              </View>
            ))}

            <TouchableOpacity style={styles.leaveBtn} onPress={leave} testID="leave-family-btn">
              <Ionicons name="exit-outline" size={16} color={theme.colors.danger} />
              <Text style={styles.leaveText}>الخروج من الأسرة</Text>
            </TouchableOpacity>
          </>
        ) : mode === "create" ? (
          <View>
            <Text style={styles.label}>اسم الأسرة</Text>
            <TextInput
              value={famName}
              onChangeText={setFamName}
              placeholder="مثال: أسرتي الكريمة"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              testID="fam-name-input"
            />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode("none")}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={create} disabled={submitting} testID="fam-create-btn">
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>إنشاء</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : mode === "join" ? (
          <View>
            <Text style={styles.label}>كود الأسرة</Text>
            <TextInput
              value={joinCode}
              onChangeText={(s) => setJoinCode(s.toUpperCase())}
              placeholder="ABC123"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, { textAlign: "center", letterSpacing: 4, fontSize: 20 }]}
              autoCapitalize="characters"
              maxLength={6}
              testID="fam-join-input"
            />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode("none")}>
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={join} disabled={submitting} testID="fam-join-btn">
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>انضم</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.chooseWrap}>
            <View style={styles.chooseIcon}>
              <Ionicons name="people" size={40} color={theme.colors.primary} />
            </View>
            <Text style={styles.chooseTitle}>أسرة إيثاق</Text>
            <Text style={styles.chooseDesc}>
              اجمع أفراد أسرتك في مكان واحد، وشجعوا بعضكم على العبادة والذكر.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode("create")} testID="fam-mode-create">
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>إنشاء أسرة جديدة</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode("join")} testID="fam-mode-join">
              <Ionicons name="enter" size={18} color={theme.colors.primary} />
              <Text style={styles.secondaryBtnText}>الانضمام بكود</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: theme.colors.textPrimary },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.textPrimary, marginTop: 12 },
  chooseWrap: { alignItems: "center", paddingTop: 40 },
  chooseIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  chooseTitle: { fontSize: 22, fontFamily: theme.fonts.serif, fontWeight: "700", color: theme.colors.primary },
  chooseDesc: {
    fontSize: 14, color: theme.colors.textSecondary, textAlign: "center",
    lineHeight: 24, marginTop: 8, marginBottom: 32, maxWidth: 320,
  },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 999, marginBottom: 12, minWidth: 240,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 24, paddingVertical: 14,
    borderRadius: 999, minWidth: 240,
  },
  secondaryBtnText: { color: theme.colors.primary, fontWeight: "700" },
  label: {
    fontSize: 13, color: theme.colors.textSecondary, fontWeight: "700",
    marginBottom: 6, marginTop: 8, textAlign: "right",
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    padding: 14, fontSize: 14, color: theme.colors.textPrimary,
    textAlign: "right",
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 16 },
  cancelBtn: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    padding: 14, borderRadius: theme.radius.md, alignItems: "center",
  },
  cancelText: { color: theme.colors.textSecondary, fontWeight: "700" },
  famHero: { alignItems: "center", padding: 24 },
  famIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  famName: { fontSize: 24, fontFamily: theme.fonts.serif, fontWeight: "700", color: theme.colors.primary },
  famMeta: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  codeCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    padding: 20, alignItems: "center", marginBottom: 20,
  },
  codeLabel: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  codeValue: { color: theme.colors.gold, fontSize: 34, fontWeight: "800", letterSpacing: 6, marginVertical: 8 },
  shareBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  sectionLabel: {
    fontSize: 13, color: theme.colors.textSecondary, fontWeight: "700",
    marginBottom: 8, textAlign: "right",
  },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12, borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 8,
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 22 },
  memberAvatarPlaceholder: {
    backgroundColor: theme.colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  memberNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  memberName: { fontSize: 15, color: theme.colors.textPrimary, fontWeight: "700" },
  memberEmail: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  ownerBadge: { backgroundColor: theme.colors.goldLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  ownerBadgeText: { fontSize: 10, color: theme.colors.primary, fontWeight: "700" },
  leaveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, marginTop: 20,
  },
  leaveText: { color: theme.colors.danger, fontWeight: "700", fontSize: 14 },
});

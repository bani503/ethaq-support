import { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useAuth, apiFetch } from "@/src/auth";
import { theme } from "@/src/theme";

type Dedication = {
  id: string;
  recipient_name: string;
  phone_number: string;
  dedication_type: string;
  message: string;
  created_at: string;
};

const TYPES = [
  { id: "dua", label: "دعاء", icon: "hand-left" },
  { id: "khatmah", label: "ختمة", icon: "book" },
  { id: "tasbih", label: "تسبيح", icon: "ellipse" },
  { id: "sadaqah", label: "صدقة", icon: "heart" },
] as const;

const TYPE_LABEL: Record<string, string> = {
  dua: "دعاء", khatmah: "ختمة", tasbih: "تسبيح", sadaqah: "صدقة",
};

export default function DedicationsScreen() {
  const router = useRouter();
  const { user, token, signIn } = useAuth();
  const [items, setItems] = useState<Dedication[]>([]);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<{ is_subscriber: boolean; used: number; limit: number | null; remaining: number | null } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedType, setSelectedType] = useState<string>("dua");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [r1, r2] = await Promise.all([
        apiFetch("/api/dedications", token),
        apiFetch("/api/dedications/quota", token),
      ]);
      if (r1.ok) setItems((await r1.json()).dedications || []);
      if (r2.ok) setQuota(await r2.json());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert("مطلوب", "الرجاء إدخال اسم المُهدَى إليه");
      return;
    }
    setSubmitting(true);
    try {
      const r = await apiFetch("/api/dedications", token, {
        method: "POST",
        body: JSON.stringify({
          recipient_name: name.trim(),
          phone_number: phone.trim(),
          dedication_type: selectedType,
          message: message.trim(),
        }),
      });
      if (r.status === 402) {
        Alert.alert(
          "انتهت الإهداءات المجانية",
          "اشترك في إيثاق بريميوم للحصول على إهداءات غير محدودة.",
          [{ text: "لاحقاً" }, { text: "اشترك", onPress: () => router.push("/subscription") }],
        );
        return;
      }
      if (!r.ok) {
        Alert.alert("خطأ", await r.text());
        return;
      }
      setName(""); setPhone(""); setMessage(""); setSelectedType("dua"); setShowForm(false);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    await apiFetch(`/api/dedications/${id}`, token, { method: "DELETE" });
    load();
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]} testID="dedications-screen">
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>إهداءات الدعاء</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>يتطلب تسجيل الدخول</Text>
          <Text style={styles.emptyDesc}>سجّل بحساب جوجل لإدارة إهداءات الدعاء</Text>
          <TouchableOpacity style={styles.signInBtn} onPress={signIn} testID="ded-signin-btn">
            <Text style={styles.signInText}>سجّل الدخول</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="dedications-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="ded-back">
          <Ionicons name="chevron-forward" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>إهداءات الدعاء</Text>
          {quota && (
            <Text style={styles.subtitle}>
              {quota.is_subscriber
                ? "بريميوم — بلا حدود"
                : `${quota.remaining ?? 0} من ${quota.limit ?? 5} متبقّي هذا الشهر`}
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {showForm ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.label}>اسم المُهدَى إليه *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="مثال: والدتي"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              testID="ded-name"
            />
            <Text style={styles.label}>رقم الجوال (اختياري)</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="مثال: +9665..."
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="phone-pad"
              style={styles.input}
              testID="ded-phone"
            />
            <Text style={styles.label}>نوع الإهداء</Text>
            <View style={styles.typeRow}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.typeChip, selectedType === t.id && styles.typeChipActive]}
                  onPress={() => setSelectedType(t.id)}
                  testID={`ded-type-${t.id}`}
                >
                  <Ionicons name={t.icon as any} size={16} color={selectedType === t.id ? "#fff" : theme.colors.primary} />
                  <Text style={[styles.typeText, selectedType === t.id && styles.typeTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>رسالة الإهداء (اختياري)</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="اكتب دعاءً خاصاً..."
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, styles.textarea]}
              multiline
              testID="ded-message"
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowForm(false)}
                testID="ded-cancel"
              >
                <Text style={styles.cancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={submit}
                disabled={submitting}
                testID="ded-submit"
              >
                {submitting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="heart" size={16} color="#fff" />
                    <Text style={styles.submitText}>إهداء</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : items.length === 0 ? (
              <View style={styles.center}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="heart-outline" size={40} color={theme.colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>لا توجد إهداءات بعد</Text>
                <Text style={styles.emptyDesc}>
                  اجعل ذكر أحبتك دائماً في دعائك — أهدِ لهم دعوة صادقة.
                </Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(i) => i.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                  <View style={styles.dedCard} testID={`ded-item-${item.id}`}>
                    <View style={styles.dedHead}>
                      <View style={styles.dedTypeBadge}>
                        <Text style={styles.dedTypeText}>{TYPE_LABEL[item.dedication_type] || "دعاء"}</Text>
                      </View>
                      <TouchableOpacity onPress={() => remove(item.id)} testID={`ded-delete-${item.id}`}>
                        <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.dedName}>{item.recipient_name}</Text>
                    {item.phone_number ? (
                      <Text style={styles.dedPhone}>📞 {item.phone_number}</Text>
                    ) : null}
                    {item.message ? <Text style={styles.dedMsg}>{`"${item.message}"`}</Text> : null}
                    <Text style={styles.dedDate}>
                      {new Date(item.created_at).toLocaleDateString("ar-SA")}
                    </Text>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.fab}
              onPress={() => setShowForm(true)}
              testID="ded-new-btn"
            >
              <Ionicons name="add" size={24} color="#fff" />
              <Text style={styles.fabText}>إهداء جديد</Text>
            </TouchableOpacity>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  title: { fontSize: 18, fontWeight: "700", color: theme.colors.textPrimary },
  subtitle: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: theme.colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.textPrimary, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 8, textAlign: "center", lineHeight: 22, maxWidth: 300 },
  signInBtn: {
    marginTop: 16, backgroundColor: theme.colors.primary,
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999,
  },
  signInText: { color: "#fff", fontWeight: "700" },
  content: { padding: 16, paddingBottom: 40 },
  label: {
    fontSize: 13, color: theme.colors.textSecondary, fontWeight: "700",
    marginBottom: 6, marginTop: 12, textAlign: "right",
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    padding: 14, fontSize: 14, color: theme.colors.textPrimary,
    textAlign: "right",
  },
  textarea: { minHeight: 88, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  typeChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  typeText: { fontSize: 13, color: theme.colors.primary, fontWeight: "600" },
  typeTextActive: { color: "#fff" },
  formActions: { flexDirection: "row", gap: 8, marginTop: 20 },
  cancelBtn: {
    flex: 1, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    padding: 14, borderRadius: theme.radius.md, alignItems: "center",
  },
  cancelText: { color: theme.colors.textSecondary, fontWeight: "700" },
  submitBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: theme.colors.primary, padding: 14, borderRadius: theme.radius.md,
  },
  submitText: { color: "#fff", fontWeight: "700" },
  list: { padding: 16, paddingBottom: 120, gap: 10 },
  dedCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 14, borderWidth: 1, borderColor: theme.colors.border,
  },
  dedHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  dedTypeBadge: {
    backgroundColor: theme.colors.goldLight,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  dedTypeText: { color: theme.colors.primary, fontWeight: "700", fontSize: 11 },
  dedName: { fontSize: 16, fontWeight: "700", color: theme.colors.textPrimary, textAlign: "right" },
  dedPhone: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 4, textAlign: "right" },
  dedMsg: { fontSize: 13, color: theme.colors.textPrimary, marginTop: 8, fontStyle: "italic", textAlign: "right", lineHeight: 22 },
  dedDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 8, textAlign: "left" },
  fab: {
    position: "absolute", bottom: 20, left: 20, right: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary,
    padding: 16, borderRadius: 999,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  fabText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

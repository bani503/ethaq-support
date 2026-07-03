import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useAuth, apiFetch } from "@/src/auth";
import { theme } from "@/src/theme";

export default function SuccessScreen() {
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const router = useRouter();
  const { token, refreshUser } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [active, setActive] = useState(false);

  useEffect(() => {
    (async () => {
      if (!session_id || !token) { setVerifying(false); return; }
      try {
        const r = await apiFetch(`/api/subscription/verify/${session_id}`, token);
        if (r.ok) {
          const j = await r.json();
          setActive(!!j.active);
          if (j.active) await refreshUser();
        }
      } finally { setVerifying(false); }
    })();
  }, [session_id, token, refreshUser]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="sub-success">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.center}>
        {verifying ? (
          <>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.msg}>جاري تفعيل اشتراكك...</Text>
          </>
        ) : active ? (
          <>
            <View style={styles.iconOk}>
              <Ionicons name="checkmark" size={40} color="#fff" />
            </View>
            <Text style={styles.title}>مبارك! 🎉</Text>
            <Text style={styles.desc}>تم تفعيل اشتراكك في إيثاق بريميوم. جزاك الله خيراً على دعمك.</Text>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle" size={54} color={theme.colors.danger} />
            <Text style={styles.title}>لم يتم التأكيد</Text>
            <Text style={styles.desc}>إذا سُحب المبلغ ولم يفعّل الاشتراك، تواصل معنا.</Text>
          </>
        )}
        <TouchableOpacity style={styles.btn} onPress={() => router.replace("/(tabs)")} testID="success-home">
          <Text style={styles.btnText}>الرجوع إلى الرئيسية</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  iconOk: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: theme.colors.primary,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  msg: { fontSize: 15, color: theme.colors.textSecondary, marginTop: 16 },
  title: { fontSize: 26, fontFamily: theme.fonts.serif, fontWeight: "700", color: theme.colors.primary, marginTop: 12 },
  desc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", marginTop: 12, lineHeight: 24, maxWidth: 320 },
  btn: {
    marginTop: 32, backgroundColor: theme.colors.primary,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});

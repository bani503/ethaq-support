import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import { theme } from "@/src/theme";

export default function CancelScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.center}>
        <Ionicons name="close-circle" size={64} color={theme.colors.textMuted} />
        <Text style={styles.title}>تم إلغاء العملية</Text>
        <Text style={styles.desc}>لم يتم تفعيل الاشتراك. يمكنك المحاولة لاحقاً.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace("/subscription")}>
          <Text style={styles.btnText}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  title: { fontSize: 22, fontWeight: "700", color: theme.colors.textPrimary, marginTop: 12 },
  desc: { fontSize: 14, color: theme.colors.textSecondary, textAlign: "center", marginTop: 8 },
  btn: {
    marginTop: 24, backgroundColor: theme.colors.primary,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999,
  },
  btnText: { color: "#fff", fontWeight: "700" },
});

import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Magnetometer } from "expo-sensors";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { theme } from "@/src/theme";
import { calculateQiblaBearing } from "@/src/utils/prayer";

type PermState = "loading" | "granted" | "denied" | "blocked";

export default function QiblaTab() {
  const [permState, setPermState] = useState<PermState>("loading");
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null); // absolute (from north)
  const [heading, setHeading] = useState<number>(0); // device heading in degrees
  const [locationInfo, setLocationInfo] = useState<{ lat: number; lng: number } | null>(null);

  const rotation = useSharedValue(0);
  const subRef = useRef<any>(null);

  const requestAndInit = async () => {
    setPermState("loading");
    const cur = await Location.getForegroundPermissionsAsync();
    let status = cur.status;
    if (status === "undetermined") {
      const req = await Location.requestForegroundPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") {
      setPermState(cur.canAskAgain ? "denied" : "blocked");
      return;
    }
    setPermState("granted");
    const pos = await Location.getCurrentPositionAsync({}).catch(() => null);
    if (pos) {
      const b = calculateQiblaBearing(pos.coords.latitude, pos.coords.longitude);
      setQiblaBearing(b);
      setLocationInfo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    }

    // Subscribe to magnetometer for heading
    Magnetometer.setUpdateInterval(120);
    subRef.current = Magnetometer.addListener((data) => {
      const angle = Math.atan2(data.y, data.x) * (180 / Math.PI);
      const deg = (angle + 360) % 360;
      setHeading(deg);
    });
  };

  useEffect(() => {
    requestAndInit();
    return () => {
      if (subRef.current) subRef.current.remove();
    };
  }, []);

  // Compute needle rotation: qibla - heading (needle points from device heading toward qibla)
  useEffect(() => {
    if (qiblaBearing == null) return;
    const target = (qiblaBearing - heading + 360) % 360;
    // shortest path
    let cur = rotation.value % 360;
    if (cur < 0) cur += 360;
    let diff = target - cur;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    rotation.value = withTiming(rotation.value + diff, {
      duration: 150,
      easing: Easing.out(Easing.quad),
    });
  }, [heading, qiblaBearing, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const aligned = qiblaBearing != null && Math.abs(((qiblaBearing - heading + 540) % 360) - 180) < 5;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="qibla-screen">
      <View style={styles.header}>
        <Text style={styles.title}>القبلة</Text>
        <Text style={styles.subtitle}>جهة المسجد الحرام</Text>
      </View>

      {permState === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      )}

      {(permState === "denied" || permState === "blocked") && (
        <View style={styles.center}>
          <View style={styles.permCard}>
            <Ionicons name="location" size={36} color={theme.colors.primary} />
            <Text style={styles.permTitle}>نحتاج إلى موقعك</Text>
            <Text style={styles.permDesc}>
              يستخدم إيثاق موقعك لتحديد اتجاه القبلة بدقة. لا يتم مشاركة موقعك مع أي جهة.
            </Text>
            {permState === "denied" ? (
              <TouchableOpacity
                style={styles.permBtn}
                onPress={requestAndInit}
                testID="qibla-request-permission"
              >
                <Text style={styles.permBtnText}>السماح بالموقع</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.permBtn}
                onPress={() => Linking.openSettings()}
                testID="qibla-open-settings"
              >
                <Text style={styles.permBtnText}>فتح الإعدادات</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {permState === "granted" && qiblaBearing != null && (
        <View style={styles.compassContainer}>
          <View style={styles.compassOuter}>
            <View style={styles.compassCardinal}>
              <Text style={[styles.cardinalText, styles.cardinalN]}>ش</Text>
              <Text style={[styles.cardinalText, styles.cardinalS]}>ج</Text>
              <Text style={[styles.cardinalText, styles.cardinalE]}>غ</Text>
              <Text style={[styles.cardinalText, styles.cardinalW]}>ق</Text>
            </View>
            <View style={styles.compassInner}>
              <Animated.View style={[styles.needleWrap, animatedStyle]}>
                <View style={[styles.needle, aligned && styles.needleAligned]} />
                <View style={[styles.kaabaMarker, aligned && styles.kaabaMarkerAligned]}>
                  <Text style={styles.kaabaEmoji}>🕋</Text>
                </View>
              </Animated.View>
            </View>
          </View>

          <View style={styles.infoBox} testID="qibla-info">
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>اتجاه القبلة</Text>
              <Text style={styles.infoValue}>{Math.round(qiblaBearing)}°</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>اتجاه الجهاز</Text>
              <Text style={styles.infoValue}>{Math.round(heading)}°</Text>
            </View>
            {locationInfo && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>الموقع</Text>
                <Text style={styles.infoValue}>
                  {locationInfo.lat.toFixed(3)}, {locationInfo.lng.toFixed(3)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.hint}>
            {aligned ? "أنت متجه نحو القبلة ✨" : "أدر جهازك حتى تتجه الكعبة لأعلى الشاشة"}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: 20 },
  title: {
    fontSize: 28,
    color: theme.colors.primary,
    fontFamily: theme.fonts.serif,
    fontWeight: "700",
    textAlign: "right",
  },
  subtitle: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, textAlign: "right" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  permCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxWidth: 360,
  },
  permTitle: {
    fontSize: 20,
    color: theme.colors.textPrimary,
    fontWeight: "700",
    marginTop: 12,
  },
  permDesc: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 8,
    lineHeight: 22,
    textAlign: "center",
  },
  permBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  permBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  compassContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  compassOuter: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  compassCardinal: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  cardinalText: {
    position: "absolute",
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.textSecondary,
  },
  cardinalN: { top: 12 },
  cardinalS: { bottom: 12 },
  cardinalE: { left: 12 },
  cardinalW: { right: 12 },
  compassInner: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  needleWrap: {
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  needle: {
    width: 4,
    height: 90,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    position: "absolute",
    top: 10,
  },
  needleAligned: {
    backgroundColor: theme.colors.gold,
  },
  kaabaMarker: {
    position: "absolute",
    top: -6,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  kaabaMarkerAligned: {
    backgroundColor: theme.colors.gold,
  },
  kaabaEmoji: { fontSize: 26 },
  infoBox: {
    width: "100%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  infoLabel: { fontSize: 13, color: theme.colors.textSecondary },
  infoValue: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: "700" },
  hint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 16,
    textAlign: "center",
  },
});

import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/src/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          ...Platform.select({
            ios: {
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
            android: { elevation: 8 },
          }),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "الرئيسية",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="quran"
        options={{
          title: "القرآن",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "book" : "book-outline"} size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="adhkar"
        options={{
          title: "الأذكار",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "flower" : "flower-outline"} size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="qibla"
        options={{
          title: "القبلة",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "compass" : "compass-outline"} size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "إيثاق AI",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <Ionicons name={focused ? "sparkles" : "sparkles-outline"} size={22} color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ children, focused }: { children: React.ReactNode; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  iconWrapFocused: {
    backgroundColor: theme.colors.primaryLight,
  },
});

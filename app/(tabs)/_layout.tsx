import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Link, Tabs } from "expo-router";
import { ColorValue, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2f5d62",
        tabBarInactiveTintColor: "#68645e",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: "#f8f7f3",
          borderTopColor: "#ded9cf",
          height: 66 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6
        },
        tabBarItemStyle: { minHeight: 54, paddingVertical: 2 },
        tabBarIconStyle: { marginBottom: 1 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700" },
        headerStyle: { backgroundColor: "#f8f7f3" },
        headerTintColor: "#2f2d2a",
        headerTitleStyle: { fontWeight: "700" },
        headerRight: PlansChangedHeaderAction
      }}
    >
      <Tabs.Screen name="index" options={tabOptions("Today", "home-outline")} />
      <Tabs.Screen
        name="calendar"
        options={tabOptions("Calendar", "calendar-month-outline")}
      />
      <Tabs.Screen name="tasks" options={tabOptions("Tasks", "format-list-checks")} />
      <Tabs.Screen name="recovery" options={tabOptions("Recovery", "lifebuoy")} />
      <Tabs.Screen name="recap" options={tabOptions("Recap", "history")} />
      <Tabs.Screen
        name="guide"
        options={tabOptions("Guide", "book-open-page-variant-outline")}
      />
      <Tabs.Screen name="settings" options={tabOptions("Settings", "cog-outline")} />
    </Tabs>
  );
}

function tabOptions(
  title: string,
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]
) {
  return {
    title,
    tabBarAccessibilityLabel: `${title} tab`,
    tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => (
      <MaterialCommunityIcons color={color} name={icon} size={Math.max(size, 23)} />
    )
  };
}

function PlansChangedHeaderAction() {
  return (
    <Link href="/recovery/start" asChild>
      <Pressable
        accessibilityHint="Review unfinished work safely"
        accessibilityLabel="Plans changed? Open Recovery Mode options"
        accessibilityRole="button"
        style={({ pressed }) => [styles.recoveryAction, pressed && styles.pressed]}
      >
        <Text style={styles.recoveryActionText}>Plans changed?</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  recoveryAction: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  recoveryActionText: { color: "#24565c", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.68 }
});

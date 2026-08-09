import { Link, Tabs } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";

const tabScreenOptions = {
  tabBarActiveTintColor: "#2f5d62",
  tabBarInactiveTintColor: "#68645e",
  tabBarStyle: {
    backgroundColor: "#f8f7f3",
    borderTopColor: "#ded9cf",
    minHeight: 64,
    paddingTop: 6
  },
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: "600" as const
  },
  headerStyle: {
    backgroundColor: "#f8f7f3"
  },
  headerTintColor: "#2f2d2a",
  headerTitleStyle: {
    fontWeight: "700" as const
  },
  headerRight: PlansChangedHeaderAction
};

export default function TabLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="recovery" options={{ title: "Recovery" }} />
      <Tabs.Screen name="recap" options={{ title: "Recap" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
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

import { Link, Tabs } from "expo-router";
import { ColorValue, Pressable, StyleSheet, Text, View } from "react-native";

const tabScreenOptions = {
  tabBarActiveTintColor: "#2f5d62",
  tabBarInactiveTintColor: "#68645e",
  tabBarActiveBackgroundColor: "#dfece8",
  tabBarHideOnKeyboard: true,
  tabBarStyle: {
    backgroundColor: "#f8f7f3",
    borderTopColor: "#ded9cf",
    borderTopWidth: 1,
    elevation: 10,
    height: 84,
    paddingBottom: 7,
    paddingHorizontal: 4,
    paddingTop: 5,
    shadowColor: "#2f2d2a",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 6
  },
  tabBarItemStyle: {
    borderRadius: 12,
    marginHorizontal: 2,
    marginVertical: 3,
    minHeight: 64,
    paddingVertical: 4
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: "800" as const,
    lineHeight: 15
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
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: (props) => <TabBadge abbreviation="TOD" {...props} />
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar",
          tabBarIcon: (props) => <TabBadge abbreviation="CAL" {...props} />
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: (props) => <TabBadge abbreviation="TSK" {...props} />
        }}
      />
      <Tabs.Screen
        name="recovery"
        options={{
          title: "Recovery",
          tabBarIcon: (props) => <TabBadge abbreviation="REC" {...props} />
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: "Recap",
          tabBarIcon: (props) => <TabBadge abbreviation="LOG" {...props} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: (props) => <TabBadge abbreviation="SET" {...props} />
        }}
      />
    </Tabs>
  );
}

function TabBadge({
  abbreviation,
  color,
  focused
}: {
  abbreviation: string;
  color: ColorValue;
  focused: boolean;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tabBadge, focused && styles.tabBadgeFocused]}
    >
      <Text style={[styles.tabBadgeText, { color }]}>{abbreviation}</Text>
    </View>
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
  tabBadge: {
    alignItems: "center",
    borderColor: "#aaa49a",
    borderRadius: 8,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    minWidth: 36,
    paddingHorizontal: 5
  },
  tabBadgeFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#2f5d62",
    borderWidth: 2
  },
  tabBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  recoveryAction: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12
  },
  recoveryActionText: { color: "#24565c", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.68 }
});

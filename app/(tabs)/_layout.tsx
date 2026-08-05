import { Tabs } from "expo-router";

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
  }
};

export default function TabLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="tasks" options={{ title: "Tasks" }} />
      <Tabs.Screen name="recovery" options={{ title: "Recovery" }} />
      <Tabs.Screen name="recap" options={{ title: "Recap" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

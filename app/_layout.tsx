import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { DatabaseProvider } from "../src/database/DatabaseProvider";

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#f8f7f3" },
          headerTintColor: "#2f2d2a",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#f8f7f3" }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="tasks/new"
          options={{
            title: "New task",
            presentation: "modal"
          }}
        />
      </Stack>
    </DatabaseProvider>
  );
}

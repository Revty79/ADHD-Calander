import { Stack } from "expo-router";

import { DatabaseProvider } from "../src/database/DatabaseProvider";
import "../src/styles/web.css";

export default function WebRootLayout() {
  return (
    <DatabaseProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tasks/new" />
        <Stack.Screen name="events/new" />
      </Stack>
    </DatabaseProvider>
  );
}

import { Stack } from "expo-router";

import { DatabaseProvider } from "../src/database/DatabaseProvider";
import "../src/styles/web.css";

export default function WebRootLayout() {
  return (
    <DatabaseProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tasks/new" />
        <Stack.Screen name="tasks/[id]/index" />
        <Stack.Screen name="tasks/[id]/edit" />
        <Stack.Screen name="tasks/[id]/breakdown" />
        <Stack.Screen name="tasks/[id]/schedule" />
        <Stack.Screen name="events/new" />
        <Stack.Screen name="recovery/start" />
      </Stack>
    </DatabaseProvider>
  );
}

import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/Screen";

export default function RecoveryScreen() {
  return (
    <Screen>
      <View style={styles.panel}>
        <Text style={styles.title}>Recovery Mode</Text>
        <Text style={styles.body}>
          Recovery Mode is planned for a later build. It will help reduce future workload
          without moving fixed commitments automatically.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 18
  },
  title: {
    color: "#2f2d2a",
    fontSize: 24,
    fontWeight: "700"
  },
  body: {
    color: "#4a4742",
    fontSize: 16,
    lineHeight: 23
  }
});

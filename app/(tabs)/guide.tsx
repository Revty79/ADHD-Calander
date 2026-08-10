import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/Screen";
import { guideSections } from "../../src/features/guide/guideContent";

export default function GuideScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          How it works
        </Text>
        <Text style={styles.intro}>
          A quick guide to the features that are available now.
        </Text>
      </View>
      <View style={styles.sections}>
        {guideSections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </Text>
            <Text style={styles.summary}>{section.summary}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 8, marginBottom: 18 },
  title: { color: "#292724", fontSize: 30, fontWeight: "800" },
  intro: { color: "#5e5a54", fontSize: 16, lineHeight: 23 },
  sections: { gap: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#ded9cf",
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    padding: 16
  },
  sectionTitle: { color: "#2f2d2a", fontSize: 18, fontWeight: "800" },
  summary: { color: "#4f4a44", fontSize: 15, lineHeight: 22 }
});

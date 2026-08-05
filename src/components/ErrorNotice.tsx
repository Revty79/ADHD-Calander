import { Pressable, StyleSheet, Text, View } from "react-native";

type ErrorNoticeProps = {
  message: string;
  onRetry?: () => void;
};

export function ErrorNotice({ message, onRetry }: ErrorNoticeProps) {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry"
          onPress={onRetry}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff8f6",
    borderColor: "#d6aaa2",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginBottom: 16,
    padding: 14
  },
  message: {
    color: "#4a2e2a",
    fontSize: 15,
    lineHeight: 21
  },
  button: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#8d3434",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16
  },
  buttonText: {
    color: "#8d3434",
    fontSize: 15,
    fontWeight: "700"
  },
  pressed: {
    opacity: 0.7
  }
});

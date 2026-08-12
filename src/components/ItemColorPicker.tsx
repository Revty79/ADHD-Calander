import { Pressable, StyleSheet, Text, View } from "react-native";

import { ItemColor, itemColorOptions } from "../types/itemColor";

export function ItemColorPicker({
  label = "Color",
  onChange,
  value
}: {
  label?: string;
  onChange(value: ItemColor): void;
  value: ItemColor;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {itemColorOptions.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityLabel={`${option.label} color`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: option.backgroundColor,
                  borderColor: option.borderColor
                },
                selected && styles.selected,
                pressed && styles.pressed
              ]}
            >
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.swatch, { backgroundColor: option.borderColor }]}
              />
              <Text style={[styles.optionText, { color: option.foregroundColor }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { color: "#2f2d2a", fontSize: 16, fontWeight: "700" },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12
  },
  selected: { borderWidth: 3, paddingHorizontal: 10 },
  swatch: { borderRadius: 7, height: 14, width: 14 },
  optionText: { fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.72 }
});

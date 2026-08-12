export const itemColors = [
  "neutral",
  "blue",
  "green",
  "amber",
  "lavender",
  "rose"
] as const;

export type ItemColor = (typeof itemColors)[number];

export type ItemColorOption = {
  value: ItemColor;
  label: string;
  backgroundColor: string;
  borderColor: string;
  foregroundColor: string;
};

export const itemColorOptions: readonly ItemColorOption[] = [
  {
    value: "neutral",
    label: "Neutral",
    backgroundColor: "#f5f2ec",
    borderColor: "#8b8174",
    foregroundColor: "#3f3a34"
  },
  {
    value: "blue",
    label: "Blue",
    backgroundColor: "#e6f0f5",
    borderColor: "#50778b",
    foregroundColor: "#294b5b"
  },
  {
    value: "green",
    label: "Green",
    backgroundColor: "#e7f1ea",
    borderColor: "#577b62",
    foregroundColor: "#31513a"
  },
  {
    value: "amber",
    label: "Amber",
    backgroundColor: "#f6edda",
    borderColor: "#9a7434",
    foregroundColor: "#654a1f"
  },
  {
    value: "lavender",
    label: "Lavender",
    backgroundColor: "#eee9f5",
    borderColor: "#74648c",
    foregroundColor: "#4c4060"
  },
  {
    value: "rose",
    label: "Rose",
    backgroundColor: "#f5e8e6",
    borderColor: "#95645e",
    foregroundColor: "#633f3b"
  }
];

export function isItemColor(value: unknown): value is ItemColor {
  return typeof value === "string" && itemColors.includes(value as ItemColor);
}

export function getItemColorOption(color: ItemColor): ItemColorOption {
  return (
    itemColorOptions.find((option) => option.value === color) ?? itemColorOptions[0]!
  );
}

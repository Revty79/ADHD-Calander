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
    <fieldset className="web-choice-fieldset">
      <legend>{label}</legend>
      <div className="web-choice-grid">
        {itemColorOptions.map((option) => (
          <label
            key={option.value}
            style={{
              backgroundColor: option.backgroundColor,
              borderColor: option.borderColor,
              color: option.foregroundColor
            }}
          >
            <input
              checked={option.value === value}
              name={`${label.toLowerCase().replaceAll(" ", "-")}-color`}
              onChange={() => onChange(option.value)}
              type="radio"
              value={option.value}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

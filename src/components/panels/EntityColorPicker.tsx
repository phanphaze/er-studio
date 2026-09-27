"use client";
const COLORS = [
  ["Violet", "#a78bfa"],
  ["Purple", "#c084fc"],
  ["Indigo", "#818cf8"],
  ["Blue", "#60a5fa"],
  ["Sky", "#38bdf8"],
  ["Cyan", "#22d3ee"],
  ["Teal", "#2dd4bf"],
  ["Emerald", "#34d399"],
  ["Green", "#4ade80"],
  ["Lime", "#a3e635"],
  ["Yellow", "#facc15"],
  ["Amber", "#fbbf24"],
  ["Orange", "#fb923c"],
  ["Coral", "#fb7185"],
  ["Red", "#f87171"],
  ["Pink", "#f472b6"],
  ["Fuchsia", "#e879f9"],
  ["Rose", "#fda4af"],
  ["Slate", "#94a3b8"],
  ["Silver", "#cbd5e1"],
] as const;

export function EntityColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <fieldset className="entity-color-field">
      <legend>Entity color</legend>
      <div className="color-picker">
        {COLORS.map(([name, color]) => (
          <button
            type="button"
            key={color}
            title={name}
            aria-label={`${name} entity color`}
            aria-pressed={value.toLowerCase() === color}
            style={{ background: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <label className="custom-entity-color">
        <span>Custom color</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <code>{value.toUpperCase()}</code>
      </label>
    </fieldset>
  );
}

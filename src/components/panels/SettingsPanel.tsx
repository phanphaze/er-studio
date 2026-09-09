"use client";
import { useSettingsStore } from "@/store/useSettingsStore";
export function SettingsPanel() {
  const s = useSettingsStore();
  return (
    <div className="settings-panel">
      <h3>Appearance</h3>
      <label className="field-label">
        Theme
        <select
          value={s.mode}
          onChange={(e) =>
            s.setPreferences({ mode: e.target.value as "dark" | "light" })
          }
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>
      <label className="field-label">
        Accent color
        <select
          value={s.accent}
          onChange={(e) =>
            s.setPreferences({ accent: e.target.value as typeof s.accent })
          }
        >
          {["violet", "blue", "teal", "amber"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="field-label">
        Contrast
        <select
          value={s.contrast}
          onChange={(e) =>
            s.setPreferences({ contrast: e.target.value as "normal" | "high" })
          }
        >
          <option value="normal">Standard</option>
          <option value="high">High contrast</option>
        </select>
      </label>
      <p className="muted">
        Appearance is remembered on this device. Entity colors remain
        configurable in Properties.
      </p>
      <h3>Diagram legend</h3>
      <p className="muted">
        One to one / one to many describes the maximum at both ends. Mandatory
        means at least one; optional means zero is allowed.
      </p>
      <p className="muted">
        In Chen, double lines mean mandatory participation; single lines mean
        optional. Labels spell out the direction and allowed count.
      </p>
      <p className="muted">
        Shift-click entity headers to align a selection. With fewer than two
        selected, alignment applies to all entities. Auto-organize arranges the
        current notation; Undo restores the previous layout.
      </p>
    </div>
  );
}

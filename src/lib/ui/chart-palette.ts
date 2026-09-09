/**
 * Chart color tokens — the validated default palette from the dataviz
 * skill (references/palette.md), not the app's UI palette. Categorical
 * hues are assigned in this fixed order only; never cycled or reassigned
 * when the series count changes. Light-mode only (this app doesn't ship a
 * dark theme yet — see src/app/globals.css).
 */
export const CATEGORICAL_PALETTE = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
] as const;

export const SEQUENTIAL_BLUE = "#2a78d6";

export const CHART_INK = {
  primary: "#0b0b0b",
  secondary: "#52514e",
  muted: "#898781",
  gridline: "#e1e0d9",
  baseline: "#c3c2b7",
  surface: "#fcfcfb",
} as const;

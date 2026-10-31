import { Platform, useColorScheme } from "react-native";

// Colour tokens mirror apps/web/src/styles/global.css: green carries structure, red is kept for
// highlights such as common mistakes. Light and dark follow the system setting.

export interface Colors {
  canvas: string;
  card: string;
  surface: string;
  raised: string;
  line: string;
  lineStrong: string;
  ink: string;
  inkStrong: string;
  inkMuted: string;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  onAccent: string;
  highlight: string;
  highlightSoft: string;
}

export const light: Colors = {
  canvas: "#ffffff",
  card: "#ffffff",
  surface: "#eff6f2",
  raised: "#ffffff",
  line: "#dfe5e2",
  lineStrong: "#b9c3be",
  ink: "#3f4341",
  inkStrong: "#1d211f",
  inkMuted: "#5d6360",
  accent: "#0f7a4a",
  accentStrong: "#0b5e39",
  accentSoft: "#dcf2e5",
  onAccent: "#ffffff",
  highlight: "#c63823",
  highlightSoft: "#ffe6e2",
};

export const dark: Colors = {
  canvas: "#1b201e",
  card: "#232a27",
  surface: "#2a322e",
  raised: "#3b4641",
  line: "#343d39",
  lineStrong: "#56605b",
  ink: "#e6ebe8",
  inkStrong: "#ffffff",
  inkMuted: "#a9b2ad",
  accent: "#6fc39e",
  accentStrong: "#93d6b8",
  accentSoft: "#1f3a2d",
  onAccent: "#10231b",
  highlight: "#ee6d5a",
  highlightSoft: "#3a2420",
};

/** Jost for text (loaded in the root layout), Georgia for page titles, as on the web. */
export const fonts = {
  regular: "Jost_400Regular",
  medium: "Jost_500Medium",
  semibold: "Jost_600SemiBold",
  bold: "Jost_700Bold",
  serif: Platform.select({ ios: "Georgia", default: "serif" }),
};

export const radius = { card: 10, tray: 14, pill: 999 };

export function useColors(): Colors {
  return useColorScheme() === "dark" ? dark : light;
}

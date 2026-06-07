// ─── Design Tokens ────────────────────────────────────────────────────────────

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 28,
  xxl: 36,
  hero: 48,
} as const;

// ─── Futuristic Invisible Palette ─────────────────────────────────────────────

export type ThemeColors = typeof darkColors;

export const darkColors = {
  background: "#003249",
  backgroundElevated: "#052B3A",
  surface: "rgba(204, 219, 220, 0.08)",
  surfaceHover: "rgba(204, 219, 220, 0.14)",

  border: "rgba(204, 219, 220, 0.14)",
  borderStrong: "rgba(204, 219, 220, 0.24)",
  borderAccent: "rgba(0, 126, 167, 0.3)",

  textPrimary: "#F4FCFF",
  textSecondary: "#C9E7EB",
  textMuted: "#9ACDD6",
  textInverse: "#003249",

  accent: "#007EA7",
  accentLight: "#80CED7",
  accentHighlight: "rgba(128, 206, 215, 0.14)",

  success: "#9AD1D4",
  successMuted: "rgba(154, 209, 212, 0.12)",
  error: "#CC3A33",
  errorMuted: "rgba(204, 58, 51, 0.1)",
  warning: "#F59E0B",
  warningMuted: "rgba(245, 158, 11, 0.08)",
};

export const lightColors: ThemeColors = {
  background: "#dee2e6",
  backgroundElevated: "#fdfcdc",
  surface: "rgba(0, 0, 0, 0.02)",
  // surface: "#ccc5b9",
  surfaceHover: "rgba(0, 0, 0, 0.05)",

  border: "rgba(0, 0, 0, 0.04)",
  borderStrong: "rgba(0, 0, 0, 0.08)",
  borderAccent: "rgba(79, 70, 229, 0.2)",

  textPrimary: "#000000",
  textSecondary: "#666666",
  textMuted: "#999999",
  textInverse: "#FFFFFF",

  accent: "#007EA7",
  accentLight: "#80CED7",
  accentHighlight: "rgba(0, 126, 167, 0.12)",

  success: "#9AD1D4",
  successMuted: "rgba(154, 209, 212, 0.12)",
  error: "#CC3A33",
  errorMuted: "rgba(204, 58, 51, 0.1)",
  warning: "#F59E0B",
  warningMuted: "rgba(245, 158, 11, 0.05)",
};

export const gradients = {
  primary: ["#007EA7", "#80CED7"] as const,
  primaryLight: ["#9AD1D4", "#CCDBDC"] as const,
  glass: ["rgba(204, 219, 220, 0.08)", "rgba(204, 219, 220, 0.01)"] as const,
  glow: ["rgba(128, 206, 215, 0.18)", "transparent"] as const,
};

export const glass = {
  blurIntensity: 15,
  blurIntensityLight: 30,
};

export const colors = darkColors;

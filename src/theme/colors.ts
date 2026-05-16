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
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 26,
  xxl: 32,
  hero: 40,
} as const;

// ─── Color Palettes ───────────────────────────────────────────────────────────

export type ThemeColors = typeof darkColors;

export const darkColors = {
  background: '#0A0A0F',
  backgroundElevated: '#111118',
  surface: 'rgba(22, 22, 32, 0.85)',
  surfaceHover: 'rgba(36, 36, 50, 0.90)',

  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  borderAccent: 'rgba(99, 102, 241, 0.5)',

  textPrimary: '#F4F4F6',
  textSecondary: '#9898B0',
  textMuted: '#56566A',
  textInverse: '#FFFFFF',

  accent: '#6366F1',
  accentLight: '#818CF8',
  accentHighlight: 'rgba(99, 102, 241, 0.12)',

  success: '#22D3A5',
  successMuted: 'rgba(34, 211, 165, 0.12)',
  error: '#F87171',
  errorMuted: 'rgba(248, 113, 113, 0.12)',
  warning: '#FBBF24',
  warningMuted: 'rgba(251, 191, 36, 0.12)',
};

export const lightColors: ThemeColors = {
  background: '#F0F0F8',
  backgroundElevated: '#FAFAFE',
  surface: 'rgba(255, 255, 255, 0.80)',
  surfaceHover: 'rgba(255, 255, 255, 0.95)',

  border: 'rgba(0, 0, 0, 0.06)',
  borderStrong: 'rgba(0, 0, 0, 0.12)',
  borderAccent: 'rgba(99, 102, 241, 0.4)',

  textPrimary: '#12121E',
  textSecondary: '#4E4E6A',
  textMuted: '#8E8EAA',
  textInverse: '#FFFFFF',

  accent: '#4F52E8',
  accentLight: '#6366F1',
  accentHighlight: 'rgba(79, 82, 232, 0.10)',

  success: '#0EBA90',
  successMuted: 'rgba(14, 186, 144, 0.10)',
  error: '#E55353',
  errorMuted: 'rgba(229, 83, 83, 0.10)',
  warning: '#E0A020',
  warningMuted: 'rgba(224, 160, 32, 0.10)',
};

// ─── Gradient Presets ─────────────────────────────────────────────────────────

export const gradients = {
  primary: ['#6366F1', '#8B5CF6'] as const,
  primaryLight: ['#818CF8', '#A78BFA'] as const,
  success: ['#22D3A5', '#06B6D4'] as const,
  error: ['#F87171', '#FB923C'] as const,
  dark: ['rgba(22,22,32,0.95)', 'rgba(10,10,15,0.98)'] as const,
  surface: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)'] as const,
};

// ─── Glass Tokens ─────────────────────────────────────────────────────────────

export const glass = {
  blurIntensity: 35,
  blurIntensityLight: 50,
};

// Backward-compatible
export const colors = darkColors;

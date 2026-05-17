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
  background: '#09090B',
  backgroundElevated: '#121217',
  surface: 'rgba(24, 24, 27, 0.7)',
  surfaceHover: 'rgba(39, 39, 42, 0.8)',

  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  borderAccent: 'rgba(99, 102, 241, 0.4)',

  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#52525B',
  textInverse: '#09090B',

  accent: '#6366F1',
  accentLight: '#818CF8',
  accentHighlight: 'rgba(99, 102, 241, 0.15)',

  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.15)',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.15)',

  elevation1: '#18181B',
  elevation2: '#27272A',
  elevation3: '#3F3F46',
};

export const lightColors: ThemeColors = {
  background: '#FAFAFA',
  backgroundElevated: '#F4F4F5',
  surface: 'rgba(255, 255, 255, 0.7)',
  surfaceHover: 'rgba(244, 244, 245, 0.8)',

  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.16)',
  borderAccent: 'rgba(79, 70, 229, 0.3)',

  textPrimary: '#09090B',
  textSecondary: '#52525B',
  textMuted: '#A1A1AA',
  textInverse: '#FAFAFA',

  accent: '#4F46E5',
  accentLight: '#6366F1',
  accentHighlight: 'rgba(79, 70, 229, 0.1)',

  success: '#059669',
  successMuted: 'rgba(5, 150, 105, 0.1)',
  error: '#DC2626',
  errorMuted: 'rgba(220, 38, 38, 0.1)',
  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.1)',

  elevation1: '#FFFFFF',
  elevation2: '#F4F4F5',
  elevation3: '#E4E4E7',
};

// ─── Gradient Presets ─────────────────────────────────────────────────────────

export const gradients = {
  primary: ['#6366F1', '#8B5CF6'] as const,
  primaryLight: ['#818CF8', '#A78BFA'] as const,
  success: ['#10B981', '#06B6D4'] as const,
  error: ['#EF4444', '#F97316'] as const,
  dark: ['#18181B', '#09090B'] as const,
  surface: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'] as const,
};

// ─── Glass Tokens ─────────────────────────────────────────────────────────────

export const glass = {
  blurIntensity: 25,
  blurIntensityLight: 40,
};

// Backward-compatible
export const colors = darkColors;

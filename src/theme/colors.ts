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
  background: '#050505', // Near pure black
  backgroundElevated: '#0A0A0A',
  surface: 'rgba(255, 255, 255, 0.03)', // Barely visible
  surfaceHover: 'rgba(255, 255, 255, 0.07)',

  border: 'rgba(255, 255, 255, 0.05)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  borderAccent: 'rgba(99, 102, 241, 0.3)',

  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textMuted: '#444444',
  textInverse: '#000000',

  accent: '#6366F1',
  accentLight: '#818CF8',
  accentHighlight: 'rgba(99, 102, 241, 0.08)',

  success: '#10B981',
  successMuted: 'rgba(16, 185, 129, 0.08)',
  error: '#EF4444',
  errorMuted: 'rgba(239, 68, 68, 0.08)',
  warning: '#F59E0B',
  warningMuted: 'rgba(245, 158, 11, 0.08)',
};

export const lightColors: ThemeColors = {
  background: '#FAFAFA',
  backgroundElevated: '#FFFFFF',
  surface: 'rgba(0, 0, 0, 0.02)',
  surfaceHover: 'rgba(0, 0, 0, 0.05)',

  border: 'rgba(0, 0, 0, 0.04)',
  borderStrong: 'rgba(0, 0, 0, 0.08)',
  borderAccent: 'rgba(79, 70, 229, 0.2)',

  textPrimary: '#000000',
  textSecondary: '#666666',
  textMuted: '#999999',
  textInverse: '#FFFFFF',

  accent: '#4F46E5',
  accentLight: '#6366F1',
  accentHighlight: 'rgba(79, 70, 229, 0.05)',

  success: '#059669',
  successMuted: 'rgba(5, 150, 105, 0.05)',
  error: '#DC2626',
  errorMuted: 'rgba(220, 38, 38, 0.05)',
  warning: '#D97706',
  warningMuted: 'rgba(217, 119, 6, 0.05)',
};

export const gradients = {
  primary: ['#6366F1', '#8B5CF6'] as const,
  primaryLight: ['#818CF8', '#A78BFA'] as const,
  glass: ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)'] as const,
  glow: ['rgba(99, 102, 241, 0.15)', 'transparent'] as const,
};

export const glass = {
  blurIntensity: 15,
  blurIntensityLight: 30,
};

export const colors = darkColors;

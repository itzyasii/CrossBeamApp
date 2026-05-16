export type ThemePalette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  accent: string;
  accentHighlight: string;
  success: string;
  error: string;
  warning: string;
};

export const lightColors = {
  background: '#EAEBEF',
  surface: 'rgba(255, 255, 255, 0.4)',
  surfaceHighlight: 'rgba(255, 255, 255, 0.6)',
  border: 'rgba(200, 205, 215, 0.5)',
  textPrimary: '#1E2024',
  textSecondary: '#626875',
  textInverse: '#FFFFFF',
  accent: '#185BFF',
  accentHighlight: 'rgba(24, 91, 255, 0.1)',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
};

export const darkColors = {
  background: '#0B0D12',
  surface: 'rgba(30, 34, 45, 0.4)',
  surfaceHighlight: 'rgba(40, 45, 58, 0.6)',
  border: 'rgba(60, 68, 85, 0.5)',
  textPrimary: '#FFFFFF',
  textSecondary: '#949BAE',
  textInverse: '#000000',
  accent: '#3B82F6',
  accentHighlight: 'rgba(59, 130, 246, 0.15)',
  success: '#34D399',
  error: '#F87171',
  warning: '#FBBF24',
};

export type ThemeColors = typeof lightColors;

// Backward-compatible export for older code paths.
export const colors = darkColors;

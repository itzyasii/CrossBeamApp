export type ThemePalette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textInverse: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  badge: string;
};

export const lightColors: ThemePalette = {
  background: '#F4F7FC',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF3FB',
  border: '#D7E2F4',
  textPrimary: '#0D1B33',
  textSecondary: '#506385',
  textInverse: '#FFFFFF',
  accent: '#1D6FFF',
  success: '#1F9D69',
  warning: '#B07800',
  danger: '#CC3A33',
  badge: '#E7F0FF',
};

export const darkColors: ThemePalette = {
  background: '#070E1B',
  surface: '#101B30',
  surfaceAlt: '#172844',
  border: '#27406C',
  textPrimary: '#F4F7FF',
  textSecondary: '#A8B8D9',
  textInverse: '#021126',
  accent: '#5AA9FF',
  success: '#35D399',
  warning: '#F4C760',
  danger: '#FF7B73',
  badge: '#213457',
};

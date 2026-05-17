import { useColorScheme } from 'react-native';
import { darkColors, lightColors, glass, gradients } from '@/theme/colors';
import { useAppStore } from '@/store';

export const useTheme = () => {
  const systemScheme = useColorScheme();
  const themePreference = useAppStore((state) => state.themePreference);

  const isDark = themePreference === 'system'
    ? systemScheme !== 'light'
    : themePreference === 'dark';

  return {
    isDark,
    themePreference,
    colors: isDark ? darkColors : lightColors,
    glass,
    gradients,
  };
};

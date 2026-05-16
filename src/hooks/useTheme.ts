import { useColorScheme } from 'react-native';
import { darkColors, lightColors, glass, gradients } from '@/theme/colors';

export const useTheme = () => {
  const mode = useColorScheme();
  const isDark = mode !== 'light';

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
    glass,
    gradients,
  };
};

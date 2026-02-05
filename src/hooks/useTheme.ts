import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from '@/theme/colors';

export const useTheme = () => {
  const mode = useColorScheme();
  const isDark = mode !== 'light';

  return {
    isDark,
    colors: isDark ? darkColors : lightColors,
  };
};

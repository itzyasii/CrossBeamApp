import React, { useState } from 'react';
import { Pressable, PressableProps, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface FocusablePressableProps extends PressableProps {
  style?: any;
  focusedStyle?: ViewStyle;
  children: React.ReactNode;
}

export const FocusablePressable: React.FC<FocusablePressableProps> = ({
  children,
  style,
  focusedStyle,
  onPress,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const { colors } = useTheme();

  const combinedStyle = (state: { pressed: boolean }) => [
    typeof style === 'function' ? style(state) : style,
    isFocused && (focusedStyle || { 
      borderColor: colors.accent, 
      borderWidth: 2,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 5,
    }),
    state.pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
  ];

  return (
    <Pressable
      {...props}
      onPress={onPress}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={combinedStyle}
    >
      {children}
    </Pressable>
  );
};

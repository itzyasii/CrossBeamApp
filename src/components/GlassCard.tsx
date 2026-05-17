import React, { useEffect, useRef } from 'react';
import { View, ViewProps, StyleSheet, Animated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/hooks/useTheme';
import { RADIUS, SPACING } from '@/theme/colors';

interface GlassCardProps extends ViewProps {
  padding?: number;
  animate?: boolean;
  accentBorder?: boolean;
  borderWidth?: number;
}

export const GlassCard = ({
  style,
  children,
  padding = SPACING.lg,
  animate = false,
  accentBorder = false,
  borderWidth = StyleSheet.hairlineWidth,
  ...props
}: GlassCardProps) => {
  const { isDark, glass, colors } = useTheme();
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? 8 : 0)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 40, friction: 12, useNativeDriver: true }),
    ]).start();
  }, [animate]);

  return (
    <Animated.View
      style={[
        styles.shell,
        {
          opacity,
          transform: [{ translateY }],
          borderColor: accentBorder ? colors.borderAccent : colors.border,
          borderWidth: accentBorder ? 1 : borderWidth,
          backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
        },
        style,
      ]}
      {...props}
    >
      <BlurView
        intensity={isDark ? glass.blurIntensity : glass.blurIntensityLight}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, { padding }]}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  shell: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  inner: {
    borderRadius: RADIUS.lg,
  },
});

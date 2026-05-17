import React, { useEffect, useRef } from 'react';
import { View, ViewProps, StyleSheet, Animated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { RADIUS, SPACING } from '@/theme/colors';

interface GlassCardProps extends ViewProps {
  padding?: number;
  animate?: boolean;
  accentBorder?: boolean;
  elevation?: 1 | 2 | 3;
}

export const GlassCard = ({
  style,
  children,
  padding = SPACING.lg,
  animate = false,
  accentBorder = false,
  elevation = 1,
  ...props
}: GlassCardProps) => {
  const { isDark, glass, colors } = useTheme();
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? 12 : 0)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 50, friction: 10, useNativeDriver: true }),
    ]).start();
  }, [animate, opacity, translateY]);

  const elevationStyles = {
    1: {
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    2: {
      shadowOpacity: isDark ? 0.4 : 0.15,
      shadowRadius: 20,
      elevation: 8,
    },
    3: {
      shadowOpacity: isDark ? 0.5 : 0.2,
      shadowRadius: 30,
      elevation: 16,
    },
  }[elevation];

  return (
    <Animated.View
      style={[
        styles.shell,
        elevationStyles,
        accentBorder && { borderColor: colors.borderAccent, borderWidth: 1.2 },
        { opacity, transform: [{ translateY }] },
        style,
      ]}
      {...props}
    >
      <BlurView
        intensity={isDark ? glass.blurIntensity : glass.blurIntensityLight}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.01)']
            : ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.40)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, { padding }]}>{children}</View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  shell: {
    borderRadius: RADIUS.lg,
    overflow: Platform.OS === 'ios' ? 'visible' : 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
  },
  inner: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
});

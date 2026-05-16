import React, { useEffect, useRef } from 'react';
import { View, ViewProps, StyleSheet, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/hooks/useTheme';
import { RADIUS, SPACING } from '@/theme/colors';

interface GlassCardProps extends ViewProps {
  padding?: number;
  animate?: boolean;
  accentBorder?: boolean;
}

export const GlassCard = ({
  style,
  children,
  padding = SPACING.lg,
  animate = false,
  accentBorder = false,
  ...props
}: GlassCardProps) => {
  const { isDark, glass } = useTheme();
  const opacity = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(animate ? 16 : 0)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();
  }, [animate, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.shell,
        accentBorder && styles.accentBorder,
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
            ? ['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.00)']
            : ['rgba(255,255,255,0.80)', 'rgba(255,255,255,0.30)']
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
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 8,
  },
  accentBorder: {
    borderColor: 'rgba(99,102,241,0.45)',
    borderWidth: 1,
  },
  inner: {
    borderRadius: RADIUS.lg,
  },
});

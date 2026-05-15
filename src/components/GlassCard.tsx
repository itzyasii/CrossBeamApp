import React, { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Colors, Radius, Shadows } from '@/constants/theme';

type GlassCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  elevation?: keyof typeof Shadows;
}>;

export function GlassCard({ children, style, elevation = 'sm' }: GlassCardProps) {
  return <View style={[styles.card, Shadows[elevation], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glass.strong,
    borderColor: Colors.gray[100],
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
});


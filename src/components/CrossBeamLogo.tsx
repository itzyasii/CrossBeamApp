import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  size?: number;
  animate?: boolean;
}

export const CrossBeamLogo = ({ size = 100, animate = true }: Props) => {
  const { colors } = useTheme();
  const rotation = React.useRef(new Animated.Value(0)).current;
  const pulse = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animate) {
      Animated.loop(
        Animated.parallel([
          Animated.timing(rotation, { toValue: 1, duration: 20000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(pulse, { toValue: 1.1, duration: 2000, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
          ])
        ])
      ).start();
    }
  }, [animate]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ rotate: spin }, { scale: pulse }] }}>
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
          <Defs>
            <LinearGradient id="logoGrad" x1="0" y1="0" x2="100" y2="100">
              <Stop offset="0%" stopColor={colors.accent} />
              <Stop offset="100%" stopColor={colors.accentLight} />
            </LinearGradient>
          </Defs>

          {/* Outer Rings */}
          <Circle cx="50" cy="50" r="48" stroke={colors.border} strokeWidth="0.5" strokeDasharray="4 4" />

          {/* Main "X" Beams */}
          <Path
            d="M30 30 L70 70 M70 30 L30 70"
            stroke="url(#logoGrad)"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Central Core */}
          <Circle cx="50" cy="50" r="12" fill={colors.background} stroke={colors.accent} strokeWidth="2" />
          <Circle cx="50" cy="50" r="6" fill={colors.accent} />

          {/* Accent Nodes */}
          <Circle cx="30" cy="30" r="3" fill={colors.accent} />
          <Circle cx="70" cy="70" r="3" fill={colors.accent} />
          <Circle cx="70" cy="30" r="3" fill={colors.accent} />
          <Circle cx="30" cy="70" r="3" fill={colors.accent} />
        </Svg>
      </Animated.View>
    </View>
  );
};

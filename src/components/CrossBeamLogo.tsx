import React, { useEffect } from "react";
import { View, StyleSheet, Animated } from "react-native";
import Svg, {
  Rect,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";

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
          Animated.timing(rotation, {
            toValue: 1,
            duration: 20000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1.1,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(pulse, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ).start();
    }
  }, [animate]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={{ transform: [{ rotate: spin }, { scale: pulse }] }}
      >
        <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
          <Defs>
            <LinearGradient id="bg" x1="0" y1="0" x2="512" y2="512">
              <Stop offset="0%" stopColor="#BDF8FF" />
              <Stop offset="100%" stopColor="#B6BCFF" />
            </LinearGradient>
            <LinearGradient id="beam1" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#6FF8F2" />
              <Stop offset="100%" stopColor="#5DCBFF" />
            </LinearGradient>
            <LinearGradient id="beam2" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#9E68FF" />
              <Stop offset="100%" stopColor="#6F4AFF" />
            </LinearGradient>
          </Defs>

          <Rect
            x="16"
            y="16"
            width="480"
            height="480"
            rx="64"
            fill="url(#bg)"
          />

          <Rect
            x="148"
            y="145"
            width="220"
            height="54"
            rx="16"
            transform="rotate(45 148 145)"
            fill="url(#beam1)"
          />
          <Rect
            x="365"
            y="145"
            width="220"
            height="54"
            rx="16"
            transform="rotate(135 365 145)"
            fill="url(#beam2)"
          />

          <Circle cx="256" cy="256" r="24" fill="white" />
          <Circle cx="256" cy="256" r="10" fill="#4C95FF" />
        </Svg>
      </Animated.View>
    </View>
  );
};

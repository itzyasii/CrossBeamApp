import React, { useEffect } from "react";
import { Animated, Image, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  size?: number;
  animate?: boolean;
}

export const CrossBeamLogo = ({ size = 100, animate = true }: Props) => {
  const { isDark } = useTheme();
  const source = isDark
    ? require("../../assets/logo_dark_mode.png")
    : require("../../assets/logo_light_mode.png");
  const pulse = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (animate) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [animate]);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image
          source={source}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
};

interface WordmarkProps {
  width?: number;
}

export const CrossBeamWordmark = ({ width = 220 }: WordmarkProps) => {
  const { isDark } = useTheme();
  const source = isDark
    ? require("../../assets/logo_main_dark.png")
    : require("../../assets/logo_main.png");

  return (
    <Image
      source={source}
      style={{ width, height: width / 3 }}
      resizeMode="contain"
    />
  );
};

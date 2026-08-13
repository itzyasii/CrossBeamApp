import React, { useEffect } from "react";
import { Animated, Image, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import headerMarkDark from "../../assets/logo/header-mark-dark.png";
import headerMarkLight from "../../assets/logo/header-mark-light.png";
import drawerWordmarkDark from "../../assets/logo/drawer-wordmark-dark.png";
import drawerWordmarkLight from "../../assets/logo/drawer-wordmark-light.png";

interface Props {
  size?: number;
  animate?: boolean;
}

export const CrossBeamLogo = ({ size = 100, animate = true }: Props) => {
  const { isDark } = useTheme();
  const source = isDark ? headerMarkDark : headerMarkLight;
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
  const source = isDark ? drawerWordmarkDark : drawerWordmarkLight;
  const imageHeight = isDark ? width * (2 / 3) : width / 3;
  const imageOffset = isDark ? -width * 0.23 : -width * 0.065;

  return (
    <View style={{ width, height: width * 0.2, overflow: "hidden" }}>
      <Image
        source={source}
        style={{
          width,
          height: imageHeight,
          transform: [{ translateY: imageOffset }],
        }}
        resizeMode="contain"
      />
    </View>
  );
};

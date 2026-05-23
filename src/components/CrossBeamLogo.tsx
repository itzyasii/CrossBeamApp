import React, { useEffect } from "react";
import { Animated, Image, View } from "react-native";

interface Props {
  size?: number;
  animate?: boolean;
}

export const CrossBeamLogo = ({ size = 100, animate = true }: Props) => {
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
          source={require("../../assets/AppIcon.png")}
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

export const CrossBeamWordmark = ({ width = 220 }: WordmarkProps) => (
  <Image
    source={require("../../assets/Logo.png")}
    style={{ width, height: width / 3 }}
    resizeMode="contain"
  />
);

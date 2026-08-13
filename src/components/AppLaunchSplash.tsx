import { Asset } from "expo-asset";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import splashGlow from "../../assets/splash/splash-glow.png";
import splashMark from "../../assets/splash/splash-mark.png";
import splashParticles from "../../assets/splash/splash-particles.png";
import splashWordmark from "../../assets/splash/splash-wordmark.png";

interface Props {
  shouldStart: boolean;
  onReady: () => void;
  onFinish: () => void;
}

const BACKGROUND = "#0A0A0F";
const SPLASH_ASSETS = [splashGlow, splashMark, splashParticles, splashWordmark];

export const AppLaunchSplash = ({ shouldStart, onReady, onFinish }: Props) => {
  const { width, height } = useWindowDimensions();
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [hasLayout, setHasLayout] = useState(false);
  const readyNotified = useRef(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.82)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.72)).current;
  const particlesOpacity = useRef(new Animated.Value(0)).current;
  const particlesProgress = useRef(new Animated.Value(0)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkOffset = useRef(new Animated.Value(12)).current;
  const finished = useRef(false);

  useEffect(() => {
    let mounted = true;

    void Promise.all(
      SPLASH_ASSETS.map((source) =>
        Asset.fromModule(source as number).downloadAsync(),
      ),
    )
      .catch((error) => {
        // The bundled images can still render from their module references. Do
        // not leave the native splash stuck if an individual cache load fails.
        console.warn("[Splash] Unable to preload launch assets:", error);
      })
      .finally(() => {
        if (mounted) setAssetsLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!assetsLoaded || !hasLayout || readyNotified.current) return;
    readyNotified.current = true;
    onReady();
  }, [assetsLoaded, hasLayout, onReady]);

  useEffect(() => {
    if (!shouldStart) return;

    let animation: Animated.CompositeAnimation | undefined;

    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      onFinish();
    };

    const start = async () => {
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(
        () => false,
      );

      if (reduceMotion) {
        markOpacity.setValue(1);
        markScale.setValue(1);
        glowOpacity.setValue(0.45);
        glowScale.setValue(1);
        particlesOpacity.setValue(0.7);
        wordmarkOpacity.setValue(1);
        wordmarkOffset.setValue(0);

        animation = Animated.sequence([
          Animated.delay(500),
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]);
        animation.start(({ finished: didFinish }) => didFinish && finish());
        return;
      }

      animation = Animated.sequence([
        Animated.parallel([
          Animated.timing(markOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(markScale, {
            toValue: 1,
            damping: 10,
            stiffness: 105,
            mass: 0.75,
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.72,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1.08,
            duration: 850,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(particlesOpacity, {
            toValue: 0.82,
            duration: 500,
            delay: 120,
            useNativeDriver: true,
          }),
          Animated.timing(particlesProgress, {
            toValue: 1,
            duration: 1450,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(wordmarkOpacity, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(wordmarkOffset, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 0.95,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.5,
              duration: 360,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.delay(280),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 320,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

      animation.start(({ finished: didFinish }) => didFinish && finish());
    };

    void start();
    return () => animation?.stop();
  }, [
    glowOpacity,
    glowScale,
    markOpacity,
    markScale,
    onFinish,
    overlayOpacity,
    particlesOpacity,
    particlesProgress,
    shouldStart,
    wordmarkOffset,
    wordmarkOpacity,
  ]);

  const markSize = Math.min(
    width * (Platform.isTV ? 0.3 : 0.58),
    height * 0.38,
    Platform.isTV ? 380 : 300,
  );
  const wordmarkWidth = Math.min(width * 0.74, Platform.isTV ? 460 : 360);
  const particleRotation = particlesProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["-4deg", "7deg"],
  });
  const particleShift = particlesProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [10, -10],
  });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="auto"
      onLayout={() => setHasLayout(true)}
      style={[S.overlay, { opacity: overlayOpacity }]}
    >
      <View style={S.brand}>
        <View style={{ width: markSize, height: markSize }}>
          <Animated.Image
            source={splashGlow}
            resizeMode="contain"
            style={[
              S.layer,
              {
                opacity: glowOpacity,
                transform: [{ scale: glowScale }],
              },
            ]}
          />
          <Animated.Image
            source={splashParticles}
            resizeMode="contain"
            style={[
              S.layer,
              {
                opacity: particlesOpacity,
                transform: [
                  { rotate: particleRotation },
                  { translateY: particleShift },
                  { scale: 1.16 },
                ],
              },
            ]}
          />
          <Animated.Image
            source={splashMark}
            resizeMode="contain"
            style={[
              S.layer,
              {
                opacity: markOpacity,
                transform: [{ scale: markScale }],
              },
            ]}
          />
        </View>

        <Animated.View
          style={{
            width: wordmarkWidth,
            height: wordmarkWidth * 0.22,
            marginTop: -markSize * 0.02,
            opacity: wordmarkOpacity,
            overflow: "hidden",
            transform: [{ translateY: wordmarkOffset }],
          }}
        >
          <Animated.Image
            source={splashWordmark}
            resizeMode="contain"
            style={{
              width: wordmarkWidth,
              height: wordmarkWidth * (2 / 3),
              transform: [{ translateY: -wordmarkWidth * 0.22 }],
            }}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const S = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND,
  },
  brand: {
    alignItems: "center",
    justifyContent: "center",
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
});

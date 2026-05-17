import React, { useState, useEffect, useRef } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Animated, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Lock, ShieldCheck, X } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { SPACING, FONT_SIZE, RADIUS } from '@/theme/colors';
import { haptics } from '@/services/haptics';

interface Props {
  visible: boolean;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
  expectedPin?: string;
}

export const PinVerificationModal = ({ visible, onConfirm, onCancel, expectedPin = '1234' }: Props) => {
  const { colors, isDark } = useTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      void haptics.light();
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 4) {
        if (newPin === expectedPin) {
          void haptics.success();
          setTimeout(() => {
            onConfirm(newPin);
            setPin('');
          }, 300);
        } else {
          void haptics.error();
          setError(true);
          shake();
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 600);
        }
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={S.overlay}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

        <Animated.View style={[
          S.modal,
          {
            backgroundColor: colors.backgroundElevated,
            borderColor: error ? colors.error : colors.borderStrong,
            transform: [{ translateX: shakeAnim }]
          }
        ]}>
          <View style={S.header}>
            <Text style={[S.title, { color: colors.textPrimary }]}>NODE_AUTH</Text>
            <Pressable onPress={onCancel} style={S.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={S.authIcon}>
            <Lock size={32} color={error ? colors.error : colors.accent} strokeWidth={1.5} />
          </View>

          <Text style={[S.subtitle, { color: colors.textSecondary }]}>
            ENTER SECURITY PIN TO AUTHORIZE
          </Text>

          <View style={S.pinContainer}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[
                S.pinSlot,
                { borderColor: error ? colors.error : colors.borderStrong },
                pin.length > i && { backgroundColor: error ? colors.error : colors.accent, borderColor: error ? colors.error : colors.accent }
              ]}>
                {pin.length > i && <View style={S.dot} />}
              </View>
            ))}
          </View>

          <View style={S.numpad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((val) => (
              <Pressable
                key={val}
                onPress={() => val === 'C' ? setPin('') : val === 'OK' ? null : handlePress(val.toString())}
                style={({ pressed }) => [
                  S.numBtn,
                  pressed && { backgroundColor: colors.surfaceHover },
                  val === 'OK' && { opacity: 0.3 }
                ]}
              >
                <Text style={[S.numText, { color: val === 'C' ? colors.error : colors.textPrimary }]}>
                  {val}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={S.footer}>
            <ShieldCheck size={14} color={colors.textMuted} />
            <Text style={[S.footerText, { color: colors.textMuted }]}>E2EE_ENFORCED</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const S = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  modal: {
    height: '80%',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderWidth: 1,
    padding: SPACING.xl,
    gap: 30
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '900', letterSpacing: 4 },
  closeBtn: { padding: 8 },

  authIcon: { alignSelf: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center' },
  subtitle: { textAlign: 'center', fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  pinContainer: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  pinSlot: { width: 50, height: 60, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },

  numpad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15 },
  numBtn: { width: '28%', height: 65, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  numText: { fontSize: 24, fontWeight: '300' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  footerText: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});

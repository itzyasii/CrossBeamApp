import React, { useState } from 'react';
import { Modal, StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Lock, X } from 'lucide-react-native';
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

  const handlePress = (num: string) => {
    if (pin.length < 4) {
      void haptics.light();
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        if (newPin === expectedPin) {
          void haptics.success();
          onConfirm(newPin);
          setPin('');
        } else {
          void haptics.error();
          setTimeout(() => setPin(''), 500);
        }
      }
    }
  };

  const handleClear = () => {
    void haptics.medium();
    setPin('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={S.overlay}>
        <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[S.modal, { backgroundColor: colors.backgroundElevated, borderColor: colors.borderStrong }]}>
          <View style={S.header}>
            <View style={[S.iconBox, { backgroundColor: colors.accentHighlight }]}>
              <Lock size={20} color={colors.accent} />
            </View>
            <Text style={[S.title, { color: colors.textPrimary }]}>Enter PIN</Text>
            <Pressable onPress={onCancel} style={S.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Text style={[S.subtitle, { color: colors.textSecondary }]}>
            Enter the 4-digit code shown on the sender's device.
          </Text>

          <View style={S.pinRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  S.pinDot,
                  { backgroundColor: pin.length > i ? colors.accent : colors.borderStrong },
                ]}
              />
            ))}
          </View>

          <View style={S.numpad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, 'OK'].map((val) => (
              <Pressable
                key={val}
                onPress={() => (val === 'C' ? handleClear() : val === 'OK' ? null : handlePress(val.toString()))}
                style={({ pressed }) => [
                  S.numBtn,
                  { backgroundColor: colors.surface },
                  pressed && { backgroundColor: colors.surfaceHover },
                  val === 'OK' && { opacity: 0.5 }
                ]}
              >
                <Text style={[S.numText, { color: colors.textPrimary }]}>{val}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const S = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { width: 320, padding: SPACING.xl, borderRadius: RADIUS.xl, borderWidth: 1, gap: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  iconBox: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '800', flex: 1 },
  closeBtn: { padding: 4 },
  subtitle: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20 },
  pinRow: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.lg, marginVertical: SPACING.md },
  pinDot: { width: 16, height: 16, borderRadius: 8 },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  numBtn: { width: 80, height: 60, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
});

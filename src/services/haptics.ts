import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Utility service for providing haptic feedback.
 * Safely handles platforms where haptics might not be supported.
 */
export const haptics = {
  /**
   * Provides feedback for a successful action.
   */
  success: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // Ignore errors if haptics fail
    }
  },

  /**
   * Provides feedback for a failed action or error.
   */
  error: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Provides feedback for a warning or subtle alert.
   */
  warning: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Provides a light impact feedback (e.g. tab switch).
   */
  light: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Provides a medium impact feedback (e.g. button press).
   */
  medium: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Provides a heavy impact feedback (e.g. long press).
   */
  heavy: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Selection feedback for scrolling or picking.
   */
  selection: async () => {
    if (Platform.OS === 'web') return;
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      // Ignore
    }
  },
};

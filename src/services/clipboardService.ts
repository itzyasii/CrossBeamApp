import * as Clipboard from 'expo-clipboard';
import { haptics } from './haptics';

export const clipboardService = {
  /**
   * Copies text to the local clipboard and provides haptic feedback.
   */
  copy: async (text: string) => {
    await Clipboard.setStringAsync(text);
    void haptics.success();
  },

  /**
   * Gets the current clipboard content.
   */
  get: async () => {
    return await Clipboard.getStringAsync();
  },

  /**
   * Formats a "Beam" payload for text sharing.
   */
  createBeamPayload: (text: string) => {
    return JSON.stringify({
      type: 'clipboard',
      content: text,
      timestamp: Date.now(),
    });
  },
};

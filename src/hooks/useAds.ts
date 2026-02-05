import { useRef } from 'react';

const AD_COOLDOWN_MS = 45_000;
const MAX_IMPRESSIONS_PER_SESSION = 4;

export const useAds = () => {
  const lastShownAtRef = useRef<number>(0);
  const impressionsRef = useRef<number>(0);

  const shouldShowAd = () => {
    const now = Date.now();
    const cooldownPassed = now - lastShownAtRef.current > AD_COOLDOWN_MS;
    const hasImpressionsLeft = impressionsRef.current < MAX_IMPRESSIONS_PER_SESSION;

    if (cooldownPassed && hasImpressionsLeft) {
      lastShownAtRef.current = now;
      impressionsRef.current += 1;
      return true;
    }

    return false;
  };

  return {
    shouldShowAd,
  };
};

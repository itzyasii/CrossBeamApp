import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import App from './App';
import { AppLaunchSplash } from './src/components/AppLaunchSplash';

// Keep the native launch screen in place until the animated splash has loaded
// and painted its first frame. Calling this outside React avoids a one-frame
// gap while the root component is being created.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // Development fast-refresh can call this after the splash is already held.
});

function Root() {
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);
  const [playLaunchSplash, setPlayLaunchSplash] = useState(false);

  const revealLaunchSplash = useCallback(async () => {
    try {
      await SplashScreen.hideAsync();
    } finally {
      setPlayLaunchSplash(true);
    }
  }, []);

  const finishLaunchSplash = useCallback(() => {
    setShowLaunchSplash(false);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        <App />
        {showLaunchSplash && (
          <AppLaunchSplash
            shouldStart={playLaunchSplash}
            onReady={revealLaunchSplash}
            onFinish={finishLaunchSplash}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);

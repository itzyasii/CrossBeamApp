import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { View } from 'react-native';
import App from './App';
import { AppLaunchSplash } from './src/components/AppLaunchSplash';

function Root() {
  const [showLaunchSplash, setShowLaunchSplash] = useState(true);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        <App />
        {showLaunchSplash && (
          <AppLaunchSplash onFinish={() => setShowLaunchSplash(false)} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);

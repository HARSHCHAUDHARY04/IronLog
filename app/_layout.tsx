import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Colors, useThemeColor } from '../lib/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();


export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { loadUser } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const { isDark, colors, text } = useThemeColor();

  useEffect(() => {
    if (loaded) {
      Promise.all([loadUser(), loadSettings()]).then(async () => {
        SplashScreen.hideAsync();
        try {
          const { requestPermissions } = require('../lib/notifications');
          await requestPermissions();
        } catch (e) {
          console.warn('Failed to request notifications permission on launch:', e);
        }
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const IronLogTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: Colors.accent.red,
      background: colors.background,
      card: colors.surface,
      text: text.primary,
      border: colors.border,
      notification: Colors.accent.red,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider value={IronLogTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen 
              name="(auth)" 
              options={{ headerShown: false }} 
            />
            <Stack.Screen 
              name="modal" 
              options={{ presentation: 'modal', headerShown: false }} 
            />
            <Stack.Screen 
              name="workout-active" 
              options={{ 
                headerShown: false,
                gestureEnabled: false,
                animation: 'slide_from_bottom',
              }} 
            />
          </Stack>
          <StatusBar style={isDark ? "light" : "dark"} />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

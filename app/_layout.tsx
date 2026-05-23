import { DarkTheme, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../lib/theme';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const IronLogDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.accent.red,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.text.primary,
    border: Colors.dark.border,
    notification: Colors.accent.red,
  },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { loadUser } = useAuthStore();

  useEffect(() => {
    if (loaded) {
      loadUser().then(() => {
        SplashScreen.hideAsync();
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={IronLogDarkTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark.background },
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
        <Stack.Screen 
          name="workout-summary" 
          options={{ 
            presentation: 'modal',
            headerShown: false,
          }} 
        />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

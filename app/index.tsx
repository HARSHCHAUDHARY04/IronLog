// ═══════════════════════════════════════════════════════
// Root Index — Initial Routing Logic
// Redirects user based on auth state and onboarding
// ═══════════════════════════════════════════════════════

import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useThemeColor } from '../lib/theme';

export default function Index() {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const { colors, accent } = useThemeColor();
  const styles = getStyles(colors);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={accent.red} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (user && !user.onboarding_completed) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

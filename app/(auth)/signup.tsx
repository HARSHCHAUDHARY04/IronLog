// ═══════════════════════════════════════════════════════
// Sign Up Screen
// ═══════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { User, Mail, Lock, ArrowLeft } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons'; // Keeping only for Google logo
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useThemeColor, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';

export default function SignupScreen() {
  const { colors, text, accent, status, muscle } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);

  const router = useRouter();
  const { signup, signInWithGoogle } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    const success = await signInWithGoogle();
    setIsLoading(false);
    if (success) {
      router.replace('/(auth)/onboarding');
    }
  };

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    const success = await signup(email, password, name);
    setIsLoading(false);

    if (success) {
      router.replace('/(auth)/onboarding');
    } else {
      Alert.alert('Error', 'Could not create account');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={text.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.titleContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Every Rep Counts.</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.form}>
          <View style={styles.inputContainer}>
            <User size={20} color={text.tertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor={text.tertiary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Mail size={20} color={text.tertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={text.tertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color={text.tertiary} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={text.tertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.signupButton}
            onPress={handleSignup}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignup}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-google" size={20} color={text.primary} style={styles.googleIcon} />
            <Text style={styles.googleButtonText}>Continue with Google</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any, text: any, accent: any, status: any, muscle: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  titleContainer: {
    marginBottom: Spacing['3xl'],
  },
  title: {
    color: text.primary,
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.extrabold,
    letterSpacing: -1,
  },
  subtitle: {
    color: text.secondary,
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.md,
    ...Shadows.sm,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    color: text.primary,
    fontSize: FontSize.md,
    paddingVertical: Spacing.lg,
    fontWeight: FontWeight.medium,
  },
  signupButton: {
    backgroundColor: accent.red,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.md,
    ...Shadows.md,
  },
  signupButtonText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: text.tertiary,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  googleButton: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  googleIcon: {
    marginRight: Spacing.sm,
  },
  googleButtonText: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing['3xl'],
  },
  footerText: {
    color: text.secondary,
    fontSize: FontSize.md,
  },
  footerLink: {
    color: accent.red,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});

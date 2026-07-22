// ═══════════════════════════════════════════════════════
// Onboarding Screen
// ═══════════════════════════════════════════════════════

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, useThemeColor, Spacing, BorderRadius, FontSize, FontWeight } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';

export default function OnboardingScreen() {
  const { colors, text, accent, status, muscle } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);

  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  const [step, setStep] = useState(1);

  // User data
  const [goal, setGoal] = useState<'strength' | 'hypertrophy' | 'weight_loss' | 'endurance' | 'general_fitness'>('strength');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    await completeOnboarding({
      goal,
      weight_kg: parseFloat(weight) || undefined,
      age: parseInt(age) || undefined,
    });
    router.replace('/(tabs)');
  };

  const renderStepIndicators = () => (
    <View style={styles.indicatorContainer}>
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={[
            styles.indicator,
            step >= i && styles.indicatorActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {renderStepIndicators()}

        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>What's your primary goal?</Text>
            <Text style={styles.subtitle}>This helps us tailor your progression.</Text>
            
            <View style={styles.optionsList}>
              {[
                { id: 'strength', title: 'Strength', icon: '💪', desc: 'Lift heavier weights' },
                { id: 'hypertrophy', title: 'Hypertrophy', icon: '🏋️', desc: 'Build muscle mass' },
                { id: 'weight_loss', title: 'Weight Loss', icon: '🔥', desc: 'Burn fat and tone' },
                { id: 'general_fitness', title: 'General Fitness', icon: '⚡', desc: 'Stay healthy and active' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.optionCard,
                    goal === item.id && styles.optionCardActive,
                  ]}
                  onPress={() => setGoal(item.id as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.optionIcon}>{item.icon}</Text>
                  <View style={styles.optionTextContainer}>
                    <Text style={[
                      styles.optionTitle,
                      goal === item.id && styles.optionTitleActive
                    ]}>{item.title}</Text>
                    <Text style={[
                      styles.optionDesc,
                      goal === item.id && styles.optionDescActive
                    ]}>{item.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.title}>Let's get your stats</Text>
            <Text style={styles.subtitle}>Optional, but helps with analytics.</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Current Weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 75"
                placeholderTextColor={text.tertiary}
                value={weight}
                onChangeText={setWeight}
                keyboardType="numeric"
                autoFocus
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 28"
                placeholderTextColor={text.tertiary}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.successIcon}>
              <Text style={{ fontSize: 64 }}>🎯</Text>
            </View>
            <Text style={[styles.title, { textAlign: 'center' }]}>You're all set!</Text>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>
              We've created some starting templates and demo data for you to explore.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[styles.nextButton, step === 1 && { flex: 1 }]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {step === 3 ? "Let's Go!" : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: any, text: any, accent: any, status: any, muscle: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    paddingTop: Platform.OS === 'android' ? Spacing['4xl'] : Spacing.xl,
  },
  indicatorContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing['3xl'],
  },
  indicator: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 2,
  },
  indicatorActive: {
    backgroundColor: accent.red,
  },
  stepContainer: {
    flex: 1,
  },
  title: {
    color: text.primary,
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    letterSpacing: -1,
  },
  subtitle: {
    color: text.secondary,
    fontSize: FontSize.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing['2xl'],
  },
  optionsList: {
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionCardActive: {
    borderColor: accent.red,
    backgroundColor: accent.redGlow,
  },
  optionIcon: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  optionTitleActive: {
    color: accent.red,
  },
  optionDesc: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  optionDescActive: {
    color: text.secondary,
  },
  formGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    color: text.secondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    color: text.primary,
    fontSize: FontSize.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
    marginTop: Spacing['4xl'],
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 'auto',
    paddingBottom: Spacing.xl,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  nextButton: {
    flex: 2,
    backgroundColor: accent.red,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});

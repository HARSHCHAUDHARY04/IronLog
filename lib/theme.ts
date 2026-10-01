// ═══════════════════════════════════════════════════════
// Next Rep Design System
// Dark-first graphite palette with an ember accent and a
// condensed display face for headings and numbers.
// ═══════════════════════════════════════════════════════

export const Colors = {
  // Core palette
  dark: {
    background: '#0A0A0C',       // Graphite, not navy
    surface: '#111114',          // Base surface (tab bar, sheets)
    surfaceElevated: '#17171C',  // Cards
    surfaceHighlight: '#202027', // Inputs, chips, pressed states
    border: 'rgba(255,255,255,0.07)',
    borderLight: 'rgba(255,255,255,0.12)',
  },
  light: {
    background: '#F5F5F7',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceHighlight: '#EEEEF2',
    border: 'rgba(10,10,12,0.08)',
    borderLight: 'rgba(10,10,12,0.16)',
  },

  // Text
  text: {
    dark: {
      primary: '#F4F4F6',
      secondary: 'rgba(244, 244, 246, 0.66)',
      tertiary: 'rgba(244, 244, 246, 0.42)',
      inverse: '#0A0A0C',
    },
    light: {
      primary: '#0F0F12',
      secondary: '#52525B',
      tertiary: '#8A8A93',
      inverse: '#F5F5F7',
    }
  },

  // Accent colors
  // Brand "red" is a warm ember; key names kept for compatibility
  accent: {
    red: '#FF4D3D',
    redDark: '#E0301F',
    redLight: '#FF7A5C',
    redGlow: 'rgba(255, 77, 61, 0.14)',
  },

  // Status colors
  status: {
    success: '#22C55E',
    successDark: '#16A34A',
    successLight: '#4ADE80',
    successGlow: 'rgba(34, 197, 94, 0.15)',

    warning: '#F59E0B',
    warningDark: '#D97706',
    warningLight: '#FBBF24',
    warningGlow: 'rgba(245, 158, 11, 0.15)',

    info: '#3B82F6',
    infoDark: '#2563EB',
    infoLight: '#60A5FA',
    infoGlow: 'rgba(59, 130, 246, 0.15)',

    plateau: '#F97316',
    regression: '#EF4444',
    progress: '#22C55E',
  },

  // Muscle group colors
  muscle: {
    chest: '#FF4444',
    back: '#3B82F6',
    shoulders: '#F59E0B',
    arms: '#8B5CF6',
    legs: '#22C55E',
    core: '#EC4899',
  },

  // Gradients (start, end)
  gradients: {
    primary: ['#FF7A3D', '#FF3B30'],
    ember: ['#FF7A3D', '#FF3B30'],
    heroDark: ['#2A1411', '#17171C'],
    heroLight: ['#FFE9E3', '#FFFFFF'],
    surface: ['#111827', '#0A0E1A'],
    accent: ['#FF6666', '#FF4444'],
    success: ['#4ADE80', '#22C55E'],
    premium: ['#F59E0B', '#D97706'],
  },
} as const;

// Condensed display face for headings, big numbers and labels.
// Loaded in app/_layout.tsx; falls back to the system font until ready.
export const Fonts = {
  display: 'BarlowCondensed_700Bold',
  displayHeavy: 'BarlowCondensed_800ExtraBold',
  displayMedium: 'BarlowCondensed_600SemiBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 26,
  full: 9999,
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// Shadow presets for elevation
export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  }),
};

// Commonly used styles
export const CommonStyles = {
  screenContainer: {
    flex: 1,
  },
  button: {
    backgroundColor: Colors.accent.red,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  buttonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

/** Accent colour for a muscle group name (e.g. 'quadriceps' → legs green) */
export function getMuscleColor(group?: string): string {
  const g = (group || '').toLowerCase();
  if (g.includes('chest')) return Colors.muscle.chest;
  if (g.includes('back') || g.includes('lat')) return Colors.muscle.back;
  if (g.includes('shoulder')) return Colors.muscle.shoulders;
  if (['biceps', 'triceps', 'arms', 'forearm'].some(m => g.includes(m))) return Colors.muscle.arms;
  if (['quad', 'hamstring', 'glute', 'calf', 'calves', 'leg'].some(m => g.includes(m))) return Colors.muscle.legs;
  if (g.includes('core') || g.includes('abs')) return Colors.muscle.core;
  return Colors.accent.red;
}

export type ThemeColors = typeof Colors.dark | typeof Colors.light;
export type TextColors = typeof Colors.text.dark | typeof Colors.text.light;
export type AccentColors = typeof Colors.accent;
export type StatusColors = typeof Colors.status;
export type MuscleColors = typeof Colors.muscle;
export type GradientColors = typeof Colors.gradients;

export interface ActiveTheme {
  isDark: boolean;
  colors: ThemeColors;
  text: TextColors;
  accent: AccentColors;
  status: StatusColors;
  muscle: MuscleColors;
  gradients: GradientColors;
}

import { useSettingsStore } from '../stores/settingsStore';
import { useColorScheme } from 'react-native';

export const useThemeColor = (): ActiveTheme => {
  const { theme } = useSettingsStore();
  const systemTheme = useColorScheme() ?? 'dark';
  
  const activeTheme = theme === 'system' ? systemTheme : theme;
  const isDark = activeTheme === 'dark';
  
  return {
    isDark,
    colors: isDark ? Colors.dark : Colors.light,
    text: isDark ? Colors.text.dark : Colors.text.light,
    accent: Colors.accent,
    status: Colors.status,
    muscle: Colors.muscle,
    gradients: Colors.gradients,
  };
};

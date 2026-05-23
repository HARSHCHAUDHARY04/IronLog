// ═══════════════════════════════════════════════════════
// IronLog Design System
// Dark-first, gym-optimized color palette
// ═══════════════════════════════════════════════════════

export const Colors = {
  // Core palette
  dark: {
    background: '#0A0E1A',
    surface: '#111827',
    surfaceElevated: '#1A2236',
    surfaceHighlight: '#222D45',
    border: '#2A3550',
    borderLight: '#374565',
  },

  // Text
  text: {
    primary: '#F0F4FF',
    secondary: '#8B95B0',
    tertiary: '#5B6580',
    inverse: '#0A0E1A',
  },

  // Accent colors
  accent: {
    red: '#FF4444',
    redDark: '#CC2222',
    redLight: '#FF6666',
    redGlow: 'rgba(255, 68, 68, 0.15)',
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
    primary: ['#FF4444', '#CC2222'],
    surface: ['#111827', '#0A0E1A'],
    accent: ['#FF6666', '#FF4444'],
    success: ['#4ADE80', '#22C55E'],
    premium: ['#F59E0B', '#D97706'],
  },
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
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
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
    backgroundColor: Colors.dark.background,
  },
  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardElevated: {
    backgroundColor: Colors.dark.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    ...Shadows.md,
  },
  inputContainer: {
    backgroundColor: Colors.dark.surfaceHighlight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
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
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

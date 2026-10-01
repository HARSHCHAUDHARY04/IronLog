// ═══════════════════════════════════════════════════════
// Shared UI primitives — headers, section titles, rings, pills
// Keep screens visually consistent without a full component library.
// ═══════════════════════════════════════════════════════

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useThemeColor, Fonts, Spacing, BorderRadius } from '../lib/theme';

/** Large screen title with an optional eyebrow line and right-side slot */
export function ScreenHeader({
  title,
  eyebrow,
  right,
  style,
}: {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { text, accent } = useThemeColor();
  return (
    <View style={[styles.screenHeader, style]}>
      <View style={{ flex: 1 }}>
        {!!eyebrow && <Text style={[styles.eyebrow, { color: accent.red }]}>{eyebrow}</Text>}
        <Text style={[styles.screenTitle, { color: text.primary }]} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

/** Section title row with optional action link */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}) {
  const { text, accent } = useThemeColor();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: text.primary }]}>{title}</Text>
      {!!actionLabel && (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.sectionAction, { color: accent.red }]}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Circular progress ring with ember gradient stroke */
export function ProgressRing({
  progress,
  size = 96,
  strokeWidth = 9,
  children,
}: {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const { isDark } = useThemeColor();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF7A3D" />
            <Stop offset="1" stopColor="#FF3B30" />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,12,0.08)'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {clamped > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#ringGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

/** Small rounded label */
export function Pill({ label, color, style }: { label: string; color?: string; style?: ViewStyle }) {
  const { text, colors } = useThemeColor();
  const tint = color || text.secondary;
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: color ? `${color}1F` : colors.surfaceHighlight, borderColor: color ? `${color}33` : colors.border },
        style,
      ]}
    >
      <Text style={[styles.pillText, { color: tint }]}>{label}</Text>
    </View>
  );
}

/** Display-font number with a small unit/label underneath */
export function Stat({
  value,
  label,
  align = 'flex-start',
  valueStyle,
}: {
  value: string | number;
  label: string;
  align?: 'flex-start' | 'center' | 'flex-end';
  valueStyle?: TextStyle;
}) {
  const { text } = useThemeColor();
  return (
    <View style={{ alignItems: align }}>
      <Text style={[styles.statValue, { color: text.primary }, valueStyle]}>{value}</Text>
      <Text style={[styles.statLabel, { color: text.tertiary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  eyebrow: {
    fontFamily: Fonts.displayMedium,
    fontSize: 13,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  screenTitle: {
    fontFamily: Fonts.displayHeavy,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Fonts.display,
    fontSize: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'capitalize',
  },
  statValue: {
    fontFamily: Fonts.displayHeavy,
    fontSize: 30,
    lineHeight: 32,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});

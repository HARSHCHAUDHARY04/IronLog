import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Home, Dumbbell, Clock, BarChart2, Users, User as UserIcon } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useThemeColor, Spacing, Colors } from '../../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from 'react';

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 30,
    borderRadius: 15,
  },
});

function TabBarIcon({ IconComponent, color, focused }: { IconComponent: any; color: string; focused: boolean; isDark: boolean }) {
  const pillStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 180 }),
    transform: [{ scaleX: withSpring(focused ? 1 : 0.6, { damping: 18 }) }],
  }));

  return (
    <View style={styles.iconContainer}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { borderRadius: 15, backgroundColor: Colors.accent.redGlow }, pillStyle]}
      />
      <IconComponent size={21} color={color} strokeWidth={focused ? 2.4 : 1.9} />
    </View>
  );
}

export default function TabLayout() {
  const { colors, text, accent, isDark } = useThemeColor();
  const insets = useSafeAreaInsets();
  const dynamicStyles = React.useMemo(() => getStyles(colors, insets.bottom), [colors, insets.bottom]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: accent.red,
        tabBarInactiveTintColor: text.tertiary,
        tabBarStyle: dynamicStyles.tabBar,
        tabBarLabelStyle: dynamicStyles.tabBarLabel,
        tabBarItemStyle: dynamicStyles.tabBarItem,
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarBackground: Platform.OS === 'ios' ? () => (
          <BlurView 
            tint={isDark ? "dark" : "light"} 
            intensity={80} 
            style={StyleSheet.absoluteFill} 
          />
        ) : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={Home} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={Dumbbell} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={Clock} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={BarChart2} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={Users} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null, // Hides the tab from the bottom tab bar to prevent overcrowding. Accessible via Home screen.
        }}
      />
    </Tabs>
  );
}

const getStyles = (colors: any, bottomInset: number) => StyleSheet.create({
  tabBar: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 68 + Math.max(bottomInset, 6),
    paddingTop: 8,
    paddingBottom: Math.max(bottomInset, 6),
    elevation: 0,
    position: Platform.OS === 'ios' ? 'absolute' : 'relative',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBarItem: {
    paddingVertical: 2,
  },
  tabBarLabel: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.3,
  },
});

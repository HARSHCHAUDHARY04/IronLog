import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Home, Dumbbell, Clock, BarChart2, Users, User as UserIcon } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { useThemeColor, Spacing } from '../../lib/theme';
import React from 'react';

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 32,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -10,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

function TabBarIcon({ IconComponent, color, focused, isDark }: { IconComponent: any; color: string; focused: boolean; isDark: boolean }) {
  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(focused ? 1.15 : 1) }],
      opacity: withTiming(focused ? 1 : 0.6),
    };
  });

  const animatedIndicatorStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: withSpring(focused ? 1 : 0) }],
      opacity: withTiming(focused ? 1 : 0),
    };
  });

  return (
    <View style={styles.iconContainer}>
      <Animated.View style={animatedIconStyle}>
        <IconComponent size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
      </Animated.View>
      <Animated.View style={[styles.activeIndicator, { backgroundColor: color }, animatedIndicatorStyle]} />
    </View>
  );
}

export default function TabLayout() {
  const { colors, text, accent, isDark } = useThemeColor();
  const dynamicStyles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: accent.red,
        tabBarInactiveTintColor: text.tertiary,
        tabBarStyle: dynamicStyles.tabBar,
        tabBarLabelStyle: dynamicStyles.tabBarLabel,
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
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon IconComponent={UserIcon} color={color} focused={focused} isDark={isDark} />
          ),
        }}
      />
    </Tabs>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  tabBar: {
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    height: Platform.OS === 'ios' ? 88 : 70,
    paddingTop: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    elevation: 0,
    position: Platform.OS === 'ios' ? 'absolute' : 'relative',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

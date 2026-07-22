import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeType = 'system' | 'light' | 'dark';
export type UnitType = 'kg' | 'lbs';

interface SettingsState {
  theme: ThemeType;
  unit: UnitType;
  defaultRestTimer: number; // in seconds
  isPremium: boolean;
  weeklyGoal: number; // workouts per week
  notificationsEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  streakGraceDays: number; // Max allowed days gap between workouts (1 = strict, 2 = 1 rest day, 3 = 2 rest days)
  
  setTheme: (theme: ThemeType) => void;
  setUnit: (unit: UnitType) => void;
  setDefaultRestTimer: (seconds: number) => void;
  upgradeToPremium: () => void;
  setWeeklyGoal: (goal: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReminderTime: (hour: number, minute: number) => void;
  setStreakGraceDays: (days: number) => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'dark', // default to dark
  unit: 'kg',
  defaultRestTimer: 90,
  isPremium: false,
  weeklyGoal: 3, // default to 3 workouts per week
  notificationsEnabled: false,
  reminderHour: 18, // 6 PM default
  reminderMinute: 0,
  streakGraceDays: 2, // 1 rest day allowed by default

  setTheme: async (theme) => {
    set({ theme });
    await AsyncStorage.setItem('settings_theme', theme);
  },

  setUnit: async (unit) => {
    set({ unit });
    await AsyncStorage.setItem('settings_unit', unit);
  },

  setDefaultRestTimer: async (seconds) => {
    set({ defaultRestTimer: seconds });
    await AsyncStorage.setItem('settings_rest', seconds.toString());
  },

  upgradeToPremium: async () => {
    set({ isPremium: true });
    await AsyncStorage.setItem('settings_premium', 'true');
  },

  setWeeklyGoal: async (goal) => {
    set({ weeklyGoal: goal });
    await AsyncStorage.setItem('settings_weekly_goal', goal.toString());
  },

  setNotificationsEnabled: async (enabled) => {
    set({ notificationsEnabled: enabled });
    await AsyncStorage.setItem('settings_notifications', enabled ? 'true' : 'false');
  },

  setReminderTime: async (hour, minute) => {
    set({ reminderHour: hour, reminderMinute: minute });
    await AsyncStorage.setItem('settings_reminder_hour', hour.toString());
    await AsyncStorage.setItem('settings_reminder_minute', minute.toString());
  },

  setStreakGraceDays: async (days) => {
    set({ streakGraceDays: days });
    await AsyncStorage.setItem('settings_streak_grace', days.toString());
  },

  loadSettings: async () => {
    try {
      const [theme, unit, rest, premium, weekly, notifications, remHour, remMin, grace] = await Promise.all([
        AsyncStorage.getItem('settings_theme'),
        AsyncStorage.getItem('settings_unit'),
        AsyncStorage.getItem('settings_rest'),
        AsyncStorage.getItem('settings_premium'),
        AsyncStorage.getItem('settings_weekly_goal'),
        AsyncStorage.getItem('settings_notifications'),
        AsyncStorage.getItem('settings_reminder_hour'),
        AsyncStorage.getItem('settings_reminder_minute'),
        AsyncStorage.getItem('settings_streak_grace'),
      ]);
      
      set({
        theme: (theme as ThemeType) || 'dark',
        unit: (unit as UnitType) || 'kg',
        defaultRestTimer: rest ? parseInt(rest, 10) : 90,
        isPremium: premium === 'true',
        weeklyGoal: weekly ? parseInt(weekly, 10) : 3,
        notificationsEnabled: notifications === 'true',
        reminderHour: remHour ? parseInt(remHour, 10) : 18,
        reminderMinute: remMin ? parseInt(remMin, 10) : 0,
        streakGraceDays: grace ? parseInt(grace, 10) : 2,
      });
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }
}));


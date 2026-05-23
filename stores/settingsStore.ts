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
  
  setTheme: (theme: ThemeType) => void;
  setUnit: (unit: UnitType) => void;
  setDefaultRestTimer: (seconds: number) => void;
  upgradeToPremium: () => void;
  setWeeklyGoal: (goal: number) => void;
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'dark', // default to dark
  unit: 'kg',
  defaultRestTimer: 90,
  isPremium: false,
  weeklyGoal: 3, // default to 3 workouts per week

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

  loadSettings: async () => {
    try {
      const [theme, unit, rest, premium, weekly] = await Promise.all([
        AsyncStorage.getItem('settings_theme'),
        AsyncStorage.getItem('settings_unit'),
        AsyncStorage.getItem('settings_rest'),
        AsyncStorage.getItem('settings_premium'),
        AsyncStorage.getItem('settings_weekly_goal'),
      ]);
      
      set({
        theme: (theme as ThemeType) || 'dark',
        unit: (unit as UnitType) || 'kg',
        defaultRestTimer: rest ? parseInt(rest, 10) : 90,
        isPremium: premium === 'true',
        weeklyGoal: weekly ? parseInt(weekly, 10) : 3,
      });
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }
}));

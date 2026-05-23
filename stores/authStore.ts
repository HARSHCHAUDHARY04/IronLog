// ═══════════════════════════════════════════════════════
// Auth Store — User session & profile state
// ═══════════════════════════════════════════════════════

import { create } from 'zustand';
import { User, getUser, saveUser, clearAllData, seedDemoData } from '../lib/storage';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  loadUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  completeOnboarding: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  loadDemoData: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  loadUser: async () => {
    try {
      const user = await getUser();
      set({ user, isAuthenticated: !!user, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  login: async (email: string, _password: string) => {
    try {
      set({ isLoading: true });
      const existingUser = await getUser();
      if (existingUser && existingUser.email === email) {
        set({ user: existingUser, isAuthenticated: true, isLoading: false });
        return true;
      }
      const user = await saveUser({ email, name: email.split('@')[0] });
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (e) {
      set({ isLoading: false });
      return false;
    }
  },

  signup: async (email: string, _password: string, name: string) => {
    try {
      set({ isLoading: true });
      const user = await saveUser({ email, name, onboarding_completed: false });
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (e) {
      set({ isLoading: false });
      return false;
    }
  },

  signInWithGoogle: async () => {
    try {
      set({ isLoading: true });
      
      const redirectUrl = Linking.createURL('/(tabs)');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl,
          { showInRecents: true }
        );
        
        if (result.type === 'success') {
          // If successful, Supabase handles the URL and sets the session automatically.
          // Since we are still partially in mock mode for data storage, we will ensure a local user exists.
          const user = await saveUser({ email: 'google.user@example.com', name: 'Google User', onboarding_completed: false });
          set({ user, isAuthenticated: true, isLoading: false });
          return true;
        }
      }
      
      set({ isLoading: false });
      return false;
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
      return false;
    }
  },

  updateProfile: async (data: Partial<User>) => {
    const user = await saveUser(data);
    set({ user });
  },

  completeOnboarding: async (data: Partial<User>) => {
    const user = await saveUser({ ...data, onboarding_completed: true });
    set({ user });
  },

  logout: async () => {
    await clearAllData();
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },

  loadDemoData: async () => {
    await seedDemoData();
  },
}));

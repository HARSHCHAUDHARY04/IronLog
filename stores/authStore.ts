// ═══════════════════════════════════════════════════════
// Auth Store — User session & profile state
// ═══════════════════════════════════════════════════════

import { create } from 'zustand';
import { User, getUser, saveUser, clearAllData, seedDemoData } from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
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
  addXP: (amount: number) => Promise<void>;
  checkBadges: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  loadUser: async () => {
    try {
      let localUser = await getUser();
      
      // Attempt to retrieve active session user from Supabase client
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      
      if (sbUser) {
        const email = sbUser.email || localUser?.email || 'google.user@example.com';
        const name = sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || localUser?.name || email.split('@')[0];
        
        let xp = localUser?.xp || 0;
        let level = localUser?.level || 1;
        let badges = localUser?.badges || [];
        let total_workouts = localUser?.total_workouts || 0;
        let current_streak = localUser?.current_streak || 0;
        let highest_streak = localUser?.highest_streak || 0;

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sbUser.id)
            .single();
          
          if (profile) {
            xp = profile.xp ?? xp;
            level = profile.level ?? level;
            badges = profile.badges ?? badges;
            total_workouts = profile.total_workouts ?? total_workouts;
            current_streak = profile.current_streak ?? current_streak;
            highest_streak = profile.highest_streak ?? highest_streak;
          }
        } catch (dbErr) {
          console.warn('Failed to fetch profile during loadUser:', dbErr);
        }

        localUser = await saveUser({
          id: sbUser.id,
          email,
          name,
          xp,
          level,
          badges,
          total_workouts,
          current_streak,
          highest_streak,
          onboarding_completed: localUser?.onboarding_completed ?? false,
        });
      }

      set({ user: localUser, isAuthenticated: !!localUser, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true });

      if (isSupabaseConfigured) {
        // Authenticate with live Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData?.user) {
          const sbUser = authData.user;
          const name = sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || email.split('@')[0];
          
          let xp = 0;
          let level = 1;
          let badges: string[] = [];
          let total_workouts = 0;
          let current_streak = 0;
          let highest_streak = 0;

          // Fetch profile metadata from profiles table
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', sbUser.id)
              .single();

            if (profile) {
              xp = profile.xp ?? xp;
              level = profile.level ?? level;
              badges = profile.badges ?? badges;
              total_workouts = profile.total_workouts ?? total_workouts;
              current_streak = profile.current_streak ?? current_streak;
              highest_streak = profile.highest_streak ?? highest_streak;
            }
          } catch (dbErr) {
            console.warn('Failed to load profile on standard login:', dbErr);
          }

          const localUser = await saveUser({
            id: sbUser.id,
            email,
            name,
            xp,
            level,
            badges,
            total_workouts,
            current_streak,
            highest_streak,
            onboarding_completed: true,
          });

          set({ user: localUser, isAuthenticated: true, isLoading: false });
          return true;
        }
      }

      // --- MOCK FALLBACK ---
      const existingUser = await getUser();
      if (existingUser && existingUser.email === email) {
        set({ user: existingUser, isAuthenticated: true, isLoading: false });
        return true;
      }
      const user = await saveUser({ email, name: email.split('@')[0] });
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (e) {
      console.error('Login Error:', e);
      set({ isLoading: false });
      return false;
    }
  },

  signup: async (email: string, password: string, name: string) => {
    try {
      set({ isLoading: true });

      if (isSupabaseConfigured) {
        // Create user in live Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
              username: name.toLowerCase().replace(/\s+/g, '_'),
            },
          },
        });

        if (authError) throw authError;

        if (authData?.user) {
          const sbUser = authData.user;

          // Locally save user details
          const localUser = await saveUser({
            id: sbUser.id,
            email,
            name,
            xp: 0,
            level: 1,
            badges: [],
            onboarding_completed: false,
          });

          // Seed profile database record (trigger will also trigger, but we upsert to be safe)
          try {
            await supabase.from('profiles').upsert({
              id: sbUser.id,
              username: name.toLowerCase().replace(/\s+/g, '_'),
              avatar_url: '',
              xp: 0,
              level: 1,
              badges: [],
            });
          } catch (dbErr) {
            console.warn('Silent fallback on profiles insert during signup:', dbErr);
          }

          set({ user: localUser, isAuthenticated: true, isLoading: false });
          return true;
        }
      }

      // --- MOCK FALLBACK ---
      const user = await saveUser({ email, name, onboarding_completed: false });
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (e) {
      console.error('Signup Error:', e);
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
        
        if (result.type === 'success' && result.url) {
          // Parse access_token and refresh_token from redirect URL
          const urlStr = result.url;
          const paramsString = urlStr.split('#')[1] || urlStr.split('?')[1];
          if (paramsString) {
            const params = paramsString.split('&').reduce((acc, current) => {
              const [key, value] = current.split('=');
              if (key && value) {
                acc[key] = decodeURIComponent(value);
              }
              return acc;
            }, {} as Record<string, string>);

            if (params.access_token && params.refresh_token) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: params.access_token,
                refresh_token: params.refresh_token,
              });
              if (sessionError) {
                console.error('Failed to set Supabase session:', sessionError);
              }
            }
          }

          // Polling loop to wait for the Supabase session to complete initialization
          let sbUser = null;
          for (let i = 0; i < 6; i++) {
            const { data: userData } = await supabase.auth.getUser();
            if (userData?.user) {
              sbUser = userData.user;
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          if (!sbUser) {
            throw new Error('Google Auth succeeded but failed to fetch Supabase user session.');
          }

          const email = sbUser.email || 'google.user@example.com';
          const name = sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || email.split('@')[0];
          
          // Try to fetch existing profile state from database or AsyncStorage
          const existingUser = await getUser();
          const isOnboardingCompleted = existingUser?.onboarding_completed || false;
          let xp = existingUser?.xp || 0;
          let level = existingUser?.level || 1;
          let badges = existingUser?.badges || [];

          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', sbUser.id)
              .single();
            
            if (profile) {
              xp = profile.xp ?? xp;
              level = profile.level ?? level;
              badges = profile.badges ?? badges;
            }
          } catch (dbErr) {
            console.warn('Failed to fetch existing profile from DB:', dbErr);
          }

          const localUser = await saveUser({
            id: sbUser.id, // Sync the unique Supabase user ID locally
            email,
            name,
            xp,
            level,
            badges,
            onboarding_completed: isOnboardingCompleted
          });

          // Sync user profile row back in Supabase database
          try {
            await supabase
              .from('profiles')
              .upsert({
                id: sbUser.id,
                username: name.toLowerCase().replace(/\s+/g, '_'),
                avatar_url: sbUser.user_metadata?.avatar_url || '',
                xp,
                level,
                badges
              });
          } catch (upsertErr) {
            console.warn('Silent fallback on profiles row upsert:', upsertErr);
          }

          set({ user: localUser, isAuthenticated: true, isLoading: false });
          return true;
        }
      }
      
      set({ isLoading: false });
      return false;
    } catch (e) {
      console.error('Google Sign In Error:', e);
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
    await get().loadUser();
  },

  addXP: async (amount: number) => {
    const { user } = get();
    if (!user) return;
    
    const newXP = user.xp + amount;
    const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1;
    
    const updatedUser = await saveUser({ xp: newXP, level: newLevel });
    set({ user: updatedUser });
  },

  checkBadges: async () => {
    const { user } = get();
    if (!user) return;
    
    const newBadges = [...user.badges];
    let newlyEarned = false;

    // First Workout Badge
    if (user.total_workouts >= 1 && !newBadges.includes('first_workout')) {
      newBadges.push('first_workout');
      newlyEarned = true;
    }
    
    // 10 Workouts Badge
    if (user.total_workouts >= 10 && !newBadges.includes('dedicated_10')) {
      newBadges.push('dedicated_10');
      newlyEarned = true;
    }

    // 100 Workouts Badge
    if (user.total_workouts >= 100 && !newBadges.includes('century_club')) {
      newBadges.push('century_club');
      newlyEarned = true;
    }

    if (newlyEarned) {
      const updatedUser = await saveUser({ badges: newBadges });
      set({ user: updatedUser });
    }
  },
}));

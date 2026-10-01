// ═══════════════════════════════════════════════════════
// Auth Store — User session & profile state
// ═══════════════════════════════════════════════════════

import { create } from 'zustand';
import {
  User,
  getUser,
  getLocalUser,
  saveUser,
  clearAllData,
  seedDemoData,
  flushPendingSync,
  deleteAccount as deleteAccountData,
  getWorkoutStats,
} from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { cancelAllReminders, cancelRestTimerNotification } from '../lib/notifications';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; error: string };

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  loadUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, password: string, name: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  completeOnboarding: (data: Partial<User>) => Promise<void>;
  /** Returns the number of workouts that could not be synced (0 = safe) */
  pendingBeforeLogout: () => Promise<number>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  loadDemoData: () => Promise<void>;
  addXP: (amount: number) => Promise<void>;
  checkBadges: () => Promise<void>;
}

function errorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
    return (e as any).message;
  }
  return fallback;
}

/** After Supabase auth succeeds, load (or create) the app user for that account */
async function hydrateSessionUser(sbUser: { id: string; email?: string | null; user_metadata?: any }): Promise<User> {
  const existing = await getUser();
  if (existing && existing.id === sbUser.id) return existing;

  // First sign-in on this account: create the users row
  const meta = sbUser.user_metadata || {};
  const email = sbUser.email || '';
  const name = meta.full_name || meta.name || email.split('@')[0];

  // Accounts created before the signup trigger existed have no profile row
  const slug = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 20);
  const { error: profileError } = await supabase.from('profiles').insert({
    id: sbUser.id,
    username: `${slug}_${sbUser.id.replace(/-/g, '').slice(0, 6)}`,
    avatar_url: meta.avatar_url || '',
  });
  if (profileError && profileError.code !== '23505') {
    console.warn('Profile row create skipped:', profileError.message);
  }

  return saveUser({ id: sbUser.id, email, name, onboarding_completed: false });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  loadUser: async () => {
    try {
      // getUser() pulls the profile from Supabase when a session exists and
      // falls back to the cached copy offline.
      const user = await getUser();
      set({ user, isAuthenticated: !!user, isLoading: false });
    } catch (e) {
      console.error('loadUser failed:', e);
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!data.user) throw new Error('Sign in failed. Please try again.');

        const user = await hydrateSessionUser(data.user);
        set({ user, isAuthenticated: true, isLoading: false });
        return { ok: true };
      }

      // Offline/local mode (no Supabase configured): single local account
      const existingUser = await getLocalUser();
      const user = existingUser && existingUser.email === email
        ? existingUser
        : await saveUser({ email, name: email.split('@')[0] });
      set({ user, isAuthenticated: true, isLoading: false });
      return { ok: true };
    } catch (e) {
      console.error('Login Error:', e);
      set({ isLoading: false });
      return { ok: false, error: errorMessage(e, 'Invalid email or password') };
    }
  },

  signup: async (email, password, name) => {
    set({ isLoading: true });
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.user) throw new Error('Could not create account');

        // Email confirmation enabled: no session until the link is clicked
        if (!data.session) {
          set({ isLoading: false });
          return { ok: true, needsEmailConfirmation: true };
        }

        const user = await saveUser({
          id: data.user.id,
          email,
          name,
          onboarding_completed: false,
        });
        set({ user, isAuthenticated: true, isLoading: false });
        return { ok: true };
      }

      const user = await saveUser({ email, name, onboarding_completed: false });
      set({ user, isAuthenticated: true, isLoading: false });
      return { ok: true };
    } catch (e) {
      console.error('Signup Error:', e);
      set({ isLoading: false });
      return { ok: false, error: errorMessage(e, 'Could not create account') };
    }
  },

  signInWithGoogle: async () => {
    set({ isLoading: true });
    try {
      if (!isSupabaseConfigured) throw new Error('Google sign-in requires Supabase to be configured.');

      const redirectUrl = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('Could not start Google sign-in.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, { showInRecents: true });
      if (result.type !== 'success' || !result.url) {
        set({ isLoading: false });
        return { ok: false, error: 'Google sign-in was cancelled.' };
      }

      // Tokens come back in the URL fragment (implicit flow)
      const paramsString = result.url.split('#')[1] || result.url.split('?')[1] || '';
      const params = Object.fromEntries(
        paramsString.split('&').filter(Boolean).map(pair => {
          const [k, v = ''] = pair.split('=');
          return [k, decodeURIComponent(v)];
        })
      );
      if (params.error_description) throw new Error(params.error_description);
      if (!params.access_token || !params.refresh_token) {
        throw new Error('Google sign-in did not return a session.');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (sessionError) throw sessionError;
      if (!sessionData.user) throw new Error('Could not load your account.');

      const user = await hydrateSessionUser(sessionData.user);
      set({ user, isAuthenticated: true, isLoading: false });
      return { ok: true };
    } catch (e) {
      console.error('Google Sign In Error:', e);
      set({ isLoading: false });
      return { ok: false, error: errorMessage(e, 'Google sign-in failed') };
    }
  },

  updateProfile: async (data) => {
    const user = await saveUser(data);
    set({ user });
  },

  completeOnboarding: async (data) => {
    const user = await saveUser({ ...data, onboarding_completed: true });
    set({ user });
  },

  pendingBeforeLogout: async () => {
    try {
      return await flushPendingSync();
    } catch {
      return 1;
    }
  },

  logout: async () => {
    // Try one last sync so nothing queued is lost, then sign out and wipe the device
    try { await flushPendingSync(); } catch {}
    await cancelAllReminders();
    await cancelRestTimerNotification();
    try { await supabase.auth.signOut(); } catch (e) { console.warn('signOut failed:', e); }
    await clearAllData();
    set({ user: null, isAuthenticated: false });
  },

  deleteAccount: async () => {
    await deleteAccountData();
    await cancelAllReminders();
    try { await supabase.auth.signOut(); } catch {}
    set({ user: null, isAuthenticated: false });
  },

  loadDemoData: async () => {
    await seedDemoData();
    await get().loadUser();
  },

  addXP: async (amount) => {
    const { user } = get();
    if (!user) return;
    const newXP = user.xp + amount;
    const updatedUser = await saveUser({ xp: newXP, level: Math.floor(Math.sqrt(newXP / 100)) + 1 });
    set({ user: updatedUser });
  },

  checkBadges: async () => {
    const { user } = get();
    if (!user) return;

    const newBadges = [...user.badges];
    let newlyEarned = false;

    const grant = (id: string) => {
      if (!newBadges.includes(id)) {
        newBadges.push(id);
        newlyEarned = true;
      }
    };

    // ── Workout Count Badges ──
    if (user.total_workouts >= 1) grant('first_workout');
    if (user.total_workouts >= 10) grant('dedicated_10');
    if (user.total_workouts >= 25) grant('quarter_century');
    if (user.total_workouts >= 50) grant('half_century');
    if (user.total_workouts >= 100) grant('century_club');
    if (user.total_workouts >= 250) grant('iron_veteran');

    // ── Streak Badges ──
    const streak = Math.max(user.current_streak || 0, user.highest_streak || 0);
    if (streak >= 7) grant('week_warrior');
    if (streak >= 30) grant('iron_will');
    if (streak >= 100) grant('unstoppable');

    // ── Volume Badges ──
    try {
      const stats = await getWorkoutStats();
      if (stats.totalVolume >= 50000) grant('volume_crusher');
      if (stats.totalVolume >= 100000) grant('volume_king');
    } catch (e) {}

    // ── XP / Level Badges ──
    if ((user.level || 1) >= 5) grant('rising_star');
    if ((user.level || 1) >= 10) grant('elite_lifter');
    if ((user.xp || 0) >= 5000) grant('xp_hunter');

    // ── Social Badges ──
    try {
      const { fetchFriends } = require('../lib/social');
      const friends = await fetchFriends();
      if (friends.length >= 3) grant('social_butterfly');
    } catch (e) {}

    if (newlyEarned) {
      const updatedUser = await saveUser({ badges: newBadges });
      set({ user: updatedUser });
    }
  },
}));

// ═══════════════════════════════════════════════════════
// Data Storage Layer
// Local-first: AsyncStorage is the source of truth on device,
// Supabase is synced when configured and a session exists.
// Writes that fail to reach Supabase are queued and retried.
// ═══════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { useSettingsStore } from '../stores/settingsStore';
import { toLocalDateStr, parseLocalDate, startOfWeek as getStartOfWeek, addDays } from './date';
import { calculateStreaks } from './streaks';
export { calculateStreaks } from './streaks';

// Generate a standard RFC4122 version 4 compliant UUID
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Helper to ensure an ID is a valid UUID, generating one if it isn't
function ensureUUID(id: string): string {
  return isUUID(id) ? id : generateId();
}

// ───────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  age?: number;
  weight_kg?: number;
  height_cm?: number;
  goal: 'strength' | 'hypertrophy' | 'weight_loss' | 'endurance' | 'general_fitness';
  onboarding_completed: boolean;
  xp: number;
  level: number;
  current_streak: number;
  highest_streak: number;
  total_workouts: number;
  badges: string[];
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  workout_date: string;
  name: string;
  muscle_groups: string[];
  duration_minutes: number;
  notes: string;
  total_volume_kg: number;
  exercises: WorkoutExercise[];
  created_at: string;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe?: number;
  is_warmup: boolean;
  estimated_1rm: number;
  notes?: string;
}

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  aliases: string[];
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string;
  movement_pattern: string;
  difficulty: string;
  instructions: string;
  common_mistakes: string[];
}

export interface ProgressEntry {
  id: string;
  user_id: string;
  body_weight: number;
  date: string;
  notes?: string;
}

export interface PRRecord {
  id: string;
  user_id: string;
  exercise_name: string;
  record_type: '1rm' | 'volume' | 'reps';
  value: number;
  previous_value?: number;
  improvement_pct?: number;
  achieved_at: string;
  workout_id: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id?: string;
  name: string;
  muscle_groups: string[];
  exercises: { name: string; sets: number; reps: number; }[];
  is_default: boolean;
}

// ───────────────────────────────────────────────────────
// Storage Keys
// ───────────────────────────────────────────────────────

const KEYS = {
  USER: 'ironlog_user',
  WORKOUTS: 'ironlog_workouts',
  TEMPLATES: 'ironlog_templates',
  PROGRESS: 'ironlog_progress',
  PRS: 'ironlog_prs',
  CUSTOM_EXERCISES: 'ironlog_custom_exercises',
  PENDING_WORKOUTS: 'ironlog_pending_workouts',
  PENDING_DELETES: 'ironlog_pending_deletes',
};

// Other per-user keys owned by other modules, cleared on sign-out
const OTHER_USER_KEYS = [
  'ironlog_session_prs',
  'ironlog_daily_macros',
  'ironlog_daily_macros_date',
  'ironlog_weekly_report',
  'ironlog_weekly_report_date',
  'ironlog_feed_posts',
  'ironlog_feed_reactions',
  'ironlog_social_friends',
  'ironlog_social_pending',
  'ironlog_social_users_pool',
  'nextrep_chats',
  'ironlog_reminder_ids',
  'ironlog-active-workout',
];

// ───────────────────────────────────────────────────────
// Internal helpers
// ───────────────────────────────────────────────────────

async function readLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch (e) {
    console.error(`Failed to read ${key}:`, e);
    return fallback;
  }
}

async function writeLocal(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/** Supabase user id for the current session, or null when signed out / not configured */
export async function getSessionUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function addToSet(key: string, id: string) {
  const ids = await readLocal<string[]>(key, []);
  if (!ids.includes(id)) {
    ids.push(id);
    await writeLocal(key, ids);
  }
}

async function removeFromSet(key: string, id: string) {
  const ids = await readLocal<string[]>(key, []);
  await writeLocal(key, ids.filter(x => x !== id));
}

// ───────────────────────────────────────────────────────
// User Operations
// ───────────────────────────────────────────────────────

export async function getLocalUser(): Promise<User | null> {
  return readLocal<User | null>(KEYS.USER, null);
}

export async function getUser(): Promise<User | null> {
  const local = await getLocalUser();
  const sessionUserId = await getSessionUserId();

  if (sessionUserId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const [{ data: profile, error: pError }, { data: userData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', sessionUserId).maybeSingle(),
        supabase
          .from('users')
          .select('name, age, weight_kg, height_cm, goal, onboarding_completed')
          .eq('id', sessionUserId)
          .maybeSingle(),
      ]);

      if (!pError && profile) {
        const localForThisUser = local?.id === sessionUserId ? local : null;
        const user: User = {
          id: profile.id,
          name: userData?.name || profile.display_name || profile.username || localForThisUser?.name || '',
          email: session?.user?.email || localForThisUser?.email || '',
          age: userData?.age ?? undefined,
          weight_kg: userData?.weight_kg ? Number(userData.weight_kg) : undefined,
          height_cm: userData?.height_cm ? Number(userData.height_cm) : undefined,
          goal: (userData?.goal as User['goal']) || 'general_fitness',
          // No users row yet means the account has never finished onboarding
          onboarding_completed: userData?.onboarding_completed ?? false,
          xp: profile.xp || 0,
          level: profile.level || 1,
          current_streak: profile.current_streak || 0,
          highest_streak: profile.highest_streak || 0,
          total_workouts: profile.total_workouts || 0,
          badges: profile.badges || [],
          created_at: profile.created_at || new Date().toISOString(),
        };
        await writeLocal(KEYS.USER, user);
        return user;
      }
    } catch (e) {
      console.error('Supabase getUser failed, using local fallback:', e);
    }
  }

  return local;
}

// Columns the client may not be allowed to write once the server owns them
// (see supabase/migrations/001_audit_fixes.sql)
const SERVER_OWNED_PROFILE_FIELDS = ['xp', 'level', 'total_workouts'] as const;

async function syncProfileRow(user: User): Promise<void> {
  const payload: Record<string, unknown> = {
    display_name: user.name,
    current_streak: user.current_streak,
    highest_streak: user.highest_streak,
    badges: user.badges,
    xp: user.xp,
    level: user.level,
    total_workouts: user.total_workouts,
  };

  // Retry by dropping fields the live schema rejects, so the app works
  // both before and after the migration is applied.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (!error) return;

    if ((error.code === '42703' || error.code === 'PGRST204') && 'display_name' in payload) {
      delete payload.display_name; // column not added yet
      continue;
    }
    if (error.code === '42501' && 'xp' in payload) {
      SERVER_OWNED_PROFILE_FIELDS.forEach(f => delete payload[f]); // server computes these
      continue;
    }
    console.error('Supabase update profiles failed:', error);
    return;
  }
}

export async function saveUser(user: Partial<User>): Promise<User> {
  const existing = await getLocalUser();
  const sessionUserId = await getSessionUserId();

  // Prefer explicit id, then the authenticated session, then the existing local id
  const resolvedId = user.id || sessionUserId || existing?.id || generateId();
  const base = existing?.id === resolvedId ? existing : null;

  const updated: User = {
    id: resolvedId,
    name: user.name || base?.name || '',
    email: user.email || base?.email || '',
    age: user.age ?? base?.age,
    weight_kg: user.weight_kg ?? base?.weight_kg,
    height_cm: user.height_cm ?? base?.height_cm,
    goal: user.goal || base?.goal || 'general_fitness',
    onboarding_completed: user.onboarding_completed ?? base?.onboarding_completed ?? false,
    xp: user.xp ?? base?.xp ?? 0,
    level: user.level ?? base?.level ?? 1,
    current_streak: user.current_streak ?? base?.current_streak ?? 0,
    highest_streak: user.highest_streak ?? base?.highest_streak ?? 0,
    total_workouts: user.total_workouts ?? base?.total_workouts ?? 0,
    badges: user.badges ?? base?.badges ?? [],
    created_at: base?.created_at || new Date().toISOString(),
  };
  await writeLocal(KEYS.USER, updated);

  if (sessionUserId && sessionUserId === updated.id) {
    try {
      // users row must exist first: workouts/progress/templates reference it
      const { error: userError } = await supabase.from('users').upsert({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        age: updated.age ?? null,
        weight_kg: updated.weight_kg ?? null,
        height_cm: updated.height_cm ?? null,
        goal: updated.goal,
        onboarding_completed: updated.onboarding_completed,
      });
      if (userError) console.error('Supabase upsert users failed:', userError);

      await syncProfileRow(updated);
    } catch (e) {
      console.error('Supabase saveUser failed:', e);
    }
  }

  return updated;
}

// ───────────────────────────────────────────────────────
// Workout Sync
// ───────────────────────────────────────────────────────

async function getLocalWorkouts(): Promise<Workout[]> {
  return readLocal<Workout[]>(KEYS.WORKOUTS, []);
}

async function uploadWorkout(workout: Workout, userId: string): Promise<boolean> {
  const { error: wError } = await supabase.from('workouts').upsert({
    id: workout.id,
    user_id: userId,
    workout_date: workout.workout_date,
    name: workout.name,
    muscle_groups: workout.muscle_groups,
    duration_minutes: workout.duration_minutes,
    notes: workout.notes,
    total_volume_kg: workout.total_volume_kg,
    created_at: workout.created_at,
  });
  if (wError) {
    console.error('Supabase workout upload failed:', wError);
    return false;
  }

  if (workout.exercises.length === 0) return true;

  // estimated_1rm is a generated column in the database — never send it
  const { error: exError } = await supabase.from('exercises').upsert(
    workout.exercises.map(e => ({
      id: e.id,
      workout_id: workout.id,
      exercise_name: e.exercise_name,
      set_number: e.set_number,
      reps: e.reps,
      weight_kg: e.weight_kg,
      rpe: e.rpe ?? null,
      is_warmup: e.is_warmup,
      notes: e.notes ?? null,
    }))
  );
  if (exError) {
    console.error('Supabase exercises upload failed:', exError);
    return false;
  }
  return true;
}

let flushPromise: Promise<number> | null = null;

/**
 * Push queued workout uploads and deletions to Supabase.
 * Returns the number of operations still pending afterwards.
 */
export function flushPendingSync(): Promise<number> {
  if (!flushPromise) {
    flushPromise = doFlush().finally(() => { flushPromise = null; });
  }
  return flushPromise;
}

async function doFlush(): Promise<number> {
  const pendingWorkouts = await readLocal<string[]>(KEYS.PENDING_WORKOUTS, []);
  const pendingDeletes = await readLocal<string[]>(KEYS.PENDING_DELETES, []);
  const userId = await getSessionUserId();
  if (!userId) return pendingWorkouts.length + pendingDeletes.length;

  for (const id of pendingDeletes) {
    try {
      const { error } = await supabase.from('workouts').delete().eq('id', id).eq('user_id', userId);
      if (!error) await removeFromSet(KEYS.PENDING_DELETES, id);
    } catch (e) {
      console.warn('Pending delete still failing:', e);
    }
  }

  if (pendingWorkouts.length > 0) {
    const local = await getLocalWorkouts();
    for (const id of pendingWorkouts) {
      const workout = local.find(w => w.id === id);
      if (!workout) {
        await removeFromSet(KEYS.PENDING_WORKOUTS, id);
        continue;
      }
      try {
        if (await uploadWorkout(workout, userId)) {
          await removeFromSet(KEYS.PENDING_WORKOUTS, id);
        }
      } catch (e) {
        console.warn('Pending workout upload still failing:', e);
      }
    }
  }

  const remaining = (await readLocal<string[]>(KEYS.PENDING_WORKOUTS, [])).length
    + (await readLocal<string[]>(KEYS.PENDING_DELETES, [])).length;
  return remaining;
}

export async function getPendingSyncCount(): Promise<number> {
  const a = await readLocal<string[]>(KEYS.PENDING_WORKOUTS, []);
  const b = await readLocal<string[]>(KEYS.PENDING_DELETES, []);
  return a.length + b.length;
}

// ───────────────────────────────────────────────────────
// Workout Operations
// ───────────────────────────────────────────────────────

function sortByDateDesc(workouts: Workout[]): Workout[] {
  return workouts.sort((a, b) => {
    const byDate = b.workout_date.localeCompare(a.workout_date);
    return byDate !== 0 ? byDate : (b.created_at || '').localeCompare(a.created_at || '');
  });
}

// Several screens call getWorkouts() on every focus; share one request
const WORKOUTS_CACHE_MS = 3000;
let workoutsCache: { at: number; promise: Promise<Workout[]> } | null = null;

export function invalidateWorkoutsCache() {
  workoutsCache = null;
}

export function getWorkouts(): Promise<Workout[]> {
  if (workoutsCache && Date.now() - workoutsCache.at < WORKOUTS_CACHE_MS) {
    return workoutsCache.promise;
  }
  const promise = fetchWorkouts().catch(err => {
    invalidateWorkoutsCache();
    throw err;
  });
  workoutsCache = { at: Date.now(), promise };
  return promise;
}

async function fetchWorkouts(): Promise<Workout[]> {
  const userId = await getSessionUserId();

  if (userId) {
    try {
      await flushPendingSync();

      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id, user_id, workout_date, name, muscle_groups, duration_minutes,
          notes, total_volume_kg, created_at,
          exercises ( id, workout_id, exercise_name, set_number, reps, weight_kg, rpe, is_warmup, estimated_1rm, notes )
        `)
        .eq('user_id', userId)
        .order('workout_date', { ascending: false });

      if (!error && data) {
        const remote: Workout[] = (data as any[]).map(w => ({
          id: w.id,
          user_id: w.user_id,
          workout_date: w.workout_date,
          name: w.name,
          muscle_groups: w.muscle_groups || [],
          duration_minutes: w.duration_minutes || 0,
          notes: w.notes || '',
          total_volume_kg: Number(w.total_volume_kg) || 0,
          created_at: w.created_at,
          exercises: (w.exercises || [])
            .map((e: any) => ({
              id: e.id,
              workout_id: e.workout_id,
              exercise_name: e.exercise_name,
              set_number: e.set_number,
              reps: e.reps,
              weight_kg: Number(e.weight_kg) || 0,
              rpe: e.rpe ? Number(e.rpe) : undefined,
              is_warmup: e.is_warmup || false,
              estimated_1rm: Number(e.estimated_1rm) || 0,
              notes: e.notes || '',
            }))
            .sort((a: WorkoutExercise, b: WorkoutExercise) => a.set_number - b.set_number),
        }));

        const local = await getLocalWorkouts();
        const localById = new Map(local.map(w => [w.id, w]));
        const pendingUploads = new Set(await readLocal<string[]>(KEYS.PENDING_WORKOUTS, []));
        const pendingDeletes = new Set(await readLocal<string[]>(KEYS.PENDING_DELETES, []));
        const remoteIds = new Set(remote.map(w => w.id));

        // Repair: older app versions saved the workout row but the sets
        // failed to upload. Keep the local sets and queue a re-upload.
        for (const w of remote) {
          const localCopy = localById.get(w.id);
          if (w.exercises.length === 0 && localCopy && localCopy.exercises.length > 0) {
            w.exercises = localCopy.exercises;
            await addToSet(KEYS.PENDING_WORKOUTS, w.id);
          }
        }

        // Keep local workouts only if they are still waiting to upload —
        // anything else missing from the server was deleted elsewhere.
        const unsynced = local.filter(w => !remoteIds.has(w.id) && pendingUploads.has(w.id));
        const merged = sortByDateDesc(
          [...remote, ...unsynced].filter(w => !pendingDeletes.has(w.id))
        );

        await writeLocal(KEYS.WORKOUTS, merged);
        return merged;
      }
      if (error) console.error('Supabase getWorkouts failed:', error);
    } catch (e) {
      console.error('Supabase getWorkouts failed, using local fallback:', e);
    }
  }

  return sortByDateDesc(await getLocalWorkouts());
}

export async function getWorkoutById(id: string): Promise<Workout | null> {
  const workouts = await getWorkouts();
  return workouts.find(w => w.id === id) || null;
}

export async function saveWorkout(workout: Omit<Workout, 'id' | 'created_at'>): Promise<Workout> {
  const newWorkout: Workout = {
    ...workout,
    id: generateId(),
    created_at: new Date().toISOString(),
  };

  newWorkout.exercises = newWorkout.exercises.map(e => ({
    ...e,
    id: ensureUUID(e.id),
    workout_id: newWorkout.id,
  }));

  const workouts = await getLocalWorkouts();
  workouts.push(newWorkout);
  await writeLocal(KEYS.WORKOUTS, workouts);
  await addToSet(KEYS.PENDING_WORKOUTS, newWorkout.id);
  invalidateWorkoutsCache();

  // Try to upload now; if it fails it stays queued for the next sync
  await flushPendingSync();

  return newWorkout;
}

export async function deleteWorkout(id: string): Promise<void> {
  const workouts = await getLocalWorkouts();
  await writeLocal(KEYS.WORKOUTS, workouts.filter(w => w.id !== id));

  const pendingUploads = await readLocal<string[]>(KEYS.PENDING_WORKOUTS, []);
  if (pendingUploads.includes(id)) {
    // Never reached the server — nothing to delete remotely
    await removeFromSet(KEYS.PENDING_WORKOUTS, id);
  } else if (isSupabaseConfigured) {
    await addToSet(KEYS.PENDING_DELETES, id);
  }
  invalidateWorkoutsCache();
  await flushPendingSync();
}

export async function getExerciseHistory(exerciseName: string): Promise<{
  workout_date: string;
  sets: WorkoutExercise[];
  best_1rm: number;
  total_volume: number;
}[]> {
  const workouts = await getWorkouts();
  const target = exerciseName.toLowerCase();
  const history: {
    workout_date: string;
    sets: WorkoutExercise[];
    best_1rm: number;
    total_volume: number;
  }[] = [];

  for (const workout of workouts) {
    const exerciseSets = workout.exercises.filter(
      e => e.exercise_name.toLowerCase() === target && !e.is_warmup
    );
    if (exerciseSets.length > 0) {
      history.push({
        workout_date: workout.workout_date,
        sets: exerciseSets,
        best_1rm: Math.max(...exerciseSets.map(s => s.estimated_1rm)),
        total_volume: exerciseSets.reduce((sum, s) => sum + (s.reps * s.weight_kg), 0),
      });
    }
  }

  return history;
}

export async function getLastSessionForExercise(exerciseName: string): Promise<WorkoutExercise[] | null> {
  const history = await getExerciseHistory(exerciseName);
  if (history.length === 0) return null;
  return history[0].sets;
}

// ───────────────────────────────────────────────────────
// Stats & Analytics
// ───────────────────────────────────────────────────────

export async function getWorkoutStats(): Promise<{
  totalWorkouts: number;
  thisMonthWorkouts: number;
  currentStreak: number;
  longestStreak: number;
  totalVolume: number;
  thisWeekVolume: number;
  lastWeekVolume: number;
  thisWeekWorkouts: number;
}> {
  const workouts = await getWorkouts();
  const now = new Date();
  const monthStart = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const weekStart = toLocalDateStr(getStartOfWeek(now));
  const lastWeekStart = toLocalDateStr(addDays(getStartOfWeek(now), -7));

  const thisWeek = workouts.filter(w => w.workout_date >= weekStart);
  const lastWeek = workouts.filter(w => w.workout_date >= lastWeekStart && w.workout_date < weekStart);

  const allowedGap = Math.max(1, useSettingsStore.getState().streakGraceDays ?? 2);
  const { currentStreak, longestStreak } = calculateStreaks(workouts.map(w => w.workout_date), allowedGap);

  return {
    totalWorkouts: workouts.length,
    thisMonthWorkouts: workouts.filter(w => w.workout_date >= monthStart).length,
    currentStreak,
    longestStreak,
    totalVolume: workouts.reduce((sum, w) => sum + w.total_volume_kg, 0),
    thisWeekVolume: Math.round(thisWeek.reduce((sum, w) => sum + w.total_volume_kg, 0)),
    lastWeekVolume: Math.round(lastWeek.reduce((sum, w) => sum + w.total_volume_kg, 0)),
    thisWeekWorkouts: thisWeek.length,
  };
}

export async function getWorkoutDatesForMonth(year: number, month: number): Promise<string[]> {
  const workouts = await getWorkouts();
  return workouts
    .filter(w => {
      const d = parseLocalDate(w.workout_date);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .map(w => w.workout_date);
}

// ───────────────────────────────────────────────────────
// Progress (Bodyweight) Operations
// ───────────────────────────────────────────────────────

export async function getProgressEntries(): Promise<ProgressEntry[]> {
  const userId = await getSessionUserId();
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('progress')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (!error && data) {
        const formatted: ProgressEntry[] = (data as any[]).map(pe => ({
          id: pe.id,
          user_id: pe.user_id,
          body_weight: Number(pe.body_weight) || 0,
          date: pe.date,
          notes: pe.notes || '',
        }));
        await writeLocal(KEYS.PROGRESS, formatted);
        return formatted;
      }
    } catch (e) {
      console.error('Supabase getProgressEntries failed, using local fallback:', e);
    }
  }

  const entries = await readLocal<ProgressEntry[]>(KEYS.PROGRESS, []);
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export async function saveProgressEntry(entry: Omit<ProgressEntry, 'id'>): Promise<ProgressEntry> {
  const newEntry: ProgressEntry = { ...entry, id: generateId() };

  const entries = await readLocal<ProgressEntry[]>(KEYS.PROGRESS, []);
  entries.push(newEntry);
  await writeLocal(KEYS.PROGRESS, entries);

  const userId = await getSessionUserId();
  if (userId) {
    const { error } = await supabase.from('progress').upsert({
      id: newEntry.id,
      user_id: userId,
      body_weight: newEntry.body_weight,
      date: newEntry.date,
      notes: newEntry.notes || null,
    });
    if (error) console.error('Supabase saveProgressEntry failed:', error);
  }

  return newEntry;
}

// ───────────────────────────────────────────────────────
// Personal Records Operations
// ───────────────────────────────────────────────────────

export async function getPRs(): Promise<PRRecord[]> {
  const userId = await getSessionUserId();
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', userId)
        .order('achieved_at', { ascending: false });

      if (!error && data) {
        const formatted: PRRecord[] = (data as any[]).map(pr => ({
          id: pr.id,
          user_id: pr.user_id,
          exercise_name: pr.exercise_name,
          record_type: pr.record_type,
          value: Number(pr.value) || 0,
          previous_value: pr.previous_value ? Number(pr.previous_value) : undefined,
          improvement_pct: pr.improvement_pct ? Number(pr.improvement_pct) : undefined,
          achieved_at: pr.achieved_at,
          workout_id: pr.workout_id || '',
        }));
        await writeLocal(KEYS.PRS, formatted);
        return formatted;
      }
    } catch (e) {
      console.error('Supabase getPRs failed, using local fallback:', e);
    }
  }

  const prs = await readLocal<PRRecord[]>(KEYS.PRS, []);
  return prs.sort((a, b) => b.achieved_at.localeCompare(a.achieved_at));
}

export async function savePR(pr: Omit<PRRecord, 'id'>): Promise<PRRecord> {
  const newPR: PRRecord = { ...pr, id: generateId() };

  const prs = await readLocal<PRRecord[]>(KEYS.PRS, []);
  prs.push(newPR);
  await writeLocal(KEYS.PRS, prs);

  const userId = await getSessionUserId();
  if (userId) {
    // The workout may still be queued for upload; null avoids an FK failure
    const pendingUploads = await readLocal<string[]>(KEYS.PENDING_WORKOUTS, []);
    const workoutId = newPR.workout_id && !pendingUploads.includes(newPR.workout_id) ? newPR.workout_id : null;
    const { error } = await supabase.from('personal_records').upsert({
      id: newPR.id,
      user_id: userId,
      exercise_name: newPR.exercise_name,
      record_type: newPR.record_type,
      value: newPR.value,
      previous_value: newPR.previous_value ?? null,
      improvement_pct: newPR.improvement_pct ?? null,
      achieved_at: newPR.achieved_at,
      workout_id: workoutId,
    });
    if (error) console.error('Supabase savePR failed:', error);
  }

  return newPR;
}

export async function getBestPRForExercise(exerciseName: string): Promise<{
  oneRM: number;
  volume: number;
  maxReps: number;
}> {
  const prs = await readLocal<PRRecord[]>(KEYS.PRS, []);
  const target = exerciseName.toLowerCase();
  const exercisePRs = prs.filter(p => p.exercise_name.toLowerCase() === target);

  return {
    oneRM: Math.max(0, ...exercisePRs.filter(p => p.record_type === '1rm').map(p => p.value)),
    volume: Math.max(0, ...exercisePRs.filter(p => p.record_type === 'volume').map(p => p.value)),
    maxReps: Math.max(0, ...exercisePRs.filter(p => p.record_type === 'reps').map(p => p.value)),
  };
}

// ───────────────────────────────────────────────────────
// Template Operations
// ───────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: WorkoutTemplate[] = [
    {
      id: 'default-push',
      user_id: '',
      name: 'Push Day',
      muscle_groups: ['chest', 'shoulders', 'triceps'],
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: 8 },
        { name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
        { name: 'Overhead Press', sets: 3, reps: 8 },
        { name: 'Lateral Raise', sets: 3, reps: 12 },
        { name: 'Tricep Pushdown', sets: 3, reps: 12 },
        { name: 'Overhead Tricep Extension', sets: 3, reps: 12 },
      ],
      is_default: true,
    },
    {
      id: 'default-pull',
      user_id: '',
      name: 'Pull Day',
      muscle_groups: ['back', 'biceps'],
      exercises: [
        { name: 'Conventional Deadlift', sets: 4, reps: 5 },
        { name: 'Barbell Row', sets: 4, reps: 8 },
        { name: 'Lat Pulldown', sets: 3, reps: 10 },
        { name: 'Seated Cable Row', sets: 3, reps: 10 },
        { name: 'Face Pull', sets: 3, reps: 15 },
        { name: 'Barbell Curl', sets: 3, reps: 10 },
        { name: 'Hammer Curl', sets: 3, reps: 12 },
      ],
      is_default: true,
    },
    {
      id: 'default-legs',
      user_id: '',
      name: 'Leg Day',
      muscle_groups: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
      exercises: [
        { name: 'Barbell Back Squat', sets: 4, reps: 6 },
        { name: 'Romanian Deadlift', sets: 3, reps: 10 },
        { name: 'Leg Press', sets: 3, reps: 12 },
        { name: 'Leg Extension', sets: 3, reps: 12 },
        { name: 'Leg Curl', sets: 3, reps: 12 },
        { name: 'Standing Calf Raise', sets: 4, reps: 15 },
      ],
      is_default: true,
    },
    {
      id: 'default-upper',
      user_id: '',
      name: 'Upper Body',
      muscle_groups: ['chest', 'back', 'shoulders', 'arms'],
      exercises: [
        { name: 'Barbell Bench Press', sets: 4, reps: 8 },
        { name: 'Barbell Row', sets: 4, reps: 8 },
        { name: 'Overhead Press', sets: 3, reps: 8 },
        { name: 'Lat Pulldown', sets: 3, reps: 10 },
        { name: 'Dumbbell Curl', sets: 3, reps: 10 },
        { name: 'Tricep Pushdown', sets: 3, reps: 12 },
      ],
      is_default: true,
    },
    {
      id: 'default-lower',
      user_id: '',
      name: 'Lower Body',
      muscle_groups: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
      exercises: [
        { name: 'Barbell Back Squat', sets: 4, reps: 6 },
        { name: 'Romanian Deadlift', sets: 3, reps: 8 },
        { name: 'Bulgarian Split Squat', sets: 3, reps: 10 },
        { name: 'Leg Press', sets: 3, reps: 12 },
        { name: 'Hip Thrust', sets: 3, reps: 10 },
        { name: 'Standing Calf Raise', sets: 4, reps: 15 },
      ],
      is_default: true,
    },
    {
      id: 'default-fullbody',
      user_id: '',
      name: 'Full Body',
      muscle_groups: ['chest', 'back', 'shoulders', 'quadriceps', 'hamstrings', 'core'],
      exercises: [
        { name: 'Barbell Back Squat', sets: 3, reps: 8 },
        { name: 'Barbell Bench Press', sets: 3, reps: 8 },
        { name: 'Barbell Row', sets: 3, reps: 8 },
        { name: 'Overhead Press', sets: 3, reps: 8 },
        { name: 'Romanian Deadlift', sets: 3, reps: 10 },
        { name: 'Plank', sets: 3, reps: 60 },
      ],
      is_default: true,
    },
];

async function getLocalCustomTemplates(): Promise<WorkoutTemplate[]> {
  const stored = await readLocal<WorkoutTemplate[]>(KEYS.TEMPLATES, []);
  return stored.filter(t => !t.is_default && !t.id.startsWith('default-'));
}

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  const userId = await getSessionUserId();
  if (userId) {
    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const custom: WorkoutTemplate[] = (data as any[]).map(t => ({
          id: t.id,
          user_id: t.user_id,
          name: t.name,
          muscle_groups: t.muscle_groups || [],
          exercises: Array.isArray(t.exercises) ? t.exercises : JSON.parse(t.exercises || '[]'),
          is_default: false,
        }));
        await writeLocal(KEYS.TEMPLATES, custom);
        return [...DEFAULT_TEMPLATES, ...custom];
      }
    } catch (e) {
      console.error('Supabase getTemplates failed, using local fallback:', e);
    }
  }

  return [...DEFAULT_TEMPLATES, ...(await getLocalCustomTemplates())];
}

export async function saveTemplate(template: Omit<WorkoutTemplate, 'id'>): Promise<WorkoutTemplate> {
  const newTemplate: WorkoutTemplate = { ...template, id: generateId(), is_default: false };

  const custom = await getLocalCustomTemplates();
  custom.push(newTemplate);
  await writeLocal(KEYS.TEMPLATES, custom);

  const userId = await getSessionUserId();
  if (userId) {
    const { error } = await supabase.from('workout_templates').upsert({
      id: newTemplate.id,
      user_id: userId,
      name: newTemplate.name,
      muscle_groups: newTemplate.muscle_groups,
      exercises: newTemplate.exercises,
      is_default: false,
    });
    if (error) console.error('Supabase saveTemplate failed:', error);
  }

  return newTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  if (id.startsWith('default-')) return;

  const custom = await getLocalCustomTemplates();
  await writeLocal(KEYS.TEMPLATES, custom.filter(t => t.id !== id));

  const userId = await getSessionUserId();
  if (userId) {
    const { error } = await supabase.from('workout_templates').delete().eq('id', id).eq('user_id', userId);
    if (error) console.error('Supabase deleteTemplate failed:', error);
  }
}

// ───────────────────────────────────────────────────────
// Seed Demo Data (offline / local accounts only)
// ───────────────────────────────────────────────────────

/** Demo data is local-only; on a synced account it would pollute the public leaderboard */
export async function canSeedDemoData(): Promise<boolean> {
  return !(await getSessionUserId());
}

export async function seedDemoData(): Promise<void> {
  if (!(await canSeedDemoData())) {
    throw new Error('Demo data is only available for offline accounts.');
  }

  let user = await getLocalUser();
  if (!user) {
    user = await saveUser({
      name: 'Demo Athlete',
      email: 'demo@ironlog.app',
      onboarding_completed: true,
      xp: 0,
      level: 1,
    });
  }

  const exercises = [
    { name: 'Barbell Bench Press', baseWeight: 60, baseReps: 8 },
    { name: 'Barbell Back Squat', baseWeight: 80, baseReps: 6 },
    { name: 'Conventional Deadlift', baseWeight: 100, baseReps: 5 },
    { name: 'Overhead Press', baseWeight: 40, baseReps: 8 },
    { name: 'Barbell Row', baseWeight: 55, baseReps: 8 },
    { name: 'Lat Pulldown', baseWeight: 45, baseReps: 10 },
    { name: 'Dumbbell Curl', baseWeight: 12, baseReps: 10 },
    { name: 'Tricep Pushdown', baseWeight: 25, baseReps: 12 },
  ];

  const workoutPatterns = [
    { name: 'Push Day', muscleGroups: ['chest', 'shoulders', 'triceps'], exerciseIndices: [0, 3, 7] },
    { name: 'Pull Day', muscleGroups: ['back', 'biceps'], exerciseIndices: [4, 5, 6] },
    { name: 'Leg Day', muscleGroups: ['quadriceps', 'hamstrings', 'glutes'], exerciseIndices: [1, 2] },
  ];

  const workouts: Workout[] = [];
  const today = new Date();

  for (let day = 30; day >= 0; day -= 2) {
    const workoutDate = addDays(today, -day);
    const patternIdx = Math.floor((30 - day) / 2) % 3;
    const pattern = workoutPatterns[patternIdx];
    const progressFactor = 1 + ((30 - day) / 30) * 0.15; // Up to 15% increase

    const workoutId = generateId();
    const workoutExercises: WorkoutExercise[] = [];
    let totalVolume = 0;

    for (const exIdx of pattern.exerciseIndices) {
      const ex = exercises[exIdx];
      const weight = Math.round(ex.baseWeight * progressFactor / 2.5) * 2.5;
      const reps = ex.baseReps + Math.floor(Math.random() * 2);

      for (let set = 1; set <= 4; set++) {
        const setWeight = set === 1 ? weight * 0.6 : weight; // First set is warmup
        const setReps = set === 1 ? 12 : reps - Math.floor(Math.random() * 2);
        const est1rm = setWeight * (1 + setReps / 30);

        workoutExercises.push({
          id: generateId(),
          workout_id: workoutId,
          exercise_name: ex.name,
          set_number: set,
          reps: setReps,
          weight_kg: setWeight,
          rpe: set === 4 ? 9 : set === 3 ? 8 : 7,
          is_warmup: set === 1,
          estimated_1rm: Math.round(est1rm * 100) / 100,
        });

        if (set !== 1) totalVolume += setReps * setWeight;
      }
    }

    workouts.push({
      id: workoutId,
      user_id: user.id,
      workout_date: toLocalDateStr(workoutDate),
      name: pattern.name,
      muscle_groups: pattern.muscleGroups,
      duration_minutes: 45 + Math.floor(Math.random() * 30),
      notes: '',
      total_volume_kg: Math.round(totalVolume),
      exercises: workoutExercises,
      created_at: workoutDate.toISOString(),
    });
  }

  await writeLocal(KEYS.WORKOUTS, workouts);
  invalidateWorkoutsCache();

  const prs: PRRecord[] = [];
  const exerciseNames = [...new Set(workouts.flatMap(w => w.exercises.map(e => e.exercise_name)))];
  for (const name of exerciseNames) {
    const allSets = workouts.flatMap(w => w.exercises.filter(e => e.exercise_name === name && !e.is_warmup));
    if (allSets.length > 0) {
      prs.push({
        id: generateId(),
        user_id: user.id,
        exercise_name: name,
        record_type: '1rm',
        value: Math.round(Math.max(...allSets.map(s => s.estimated_1rm)) * 100) / 100,
        achieved_at: new Date().toISOString(),
        workout_id: workouts[workouts.length - 1].id,
      });
    }
  }
  await writeLocal(KEYS.PRS, prs);

  const progressEntries: ProgressEntry[] = [];
  for (let day = 30; day >= 0; day -= 3) {
    progressEntries.push({
      id: generateId(),
      user_id: user.id,
      body_weight: (user.weight_kg || 70) + (Math.random() * 2 - 1),
      date: toLocalDateStr(addDays(today, -day)),
    });
  }
  await writeLocal(KEYS.PROGRESS, progressEntries);

  const workoutsTotalVolume = workouts.reduce((sum, w) => sum + w.total_volume_kg, 0);
  const xpEarned = Math.round(workoutsTotalVolume / 100) + 15 * workouts.length;
  const streaks = calculateStreaks(workouts.map(w => w.workout_date), 2);

  await saveUser({
    total_workouts: workouts.length,
    current_streak: streaks.currentStreak,
    highest_streak: streaks.longestStreak,
    xp: xpEarned,
    level: Math.floor(Math.sqrt(xpEarned / 100)) + 1,
    badges: ['first_workout', 'dedicated_10'],
  });
}

// ───────────────────────────────────────────────────────
// Sign-out / account deletion
// ───────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([...Object.values(KEYS), ...OTHER_USER_KEYS]);
  invalidateWorkoutsCache();
}

/**
 * Permanently delete the signed-in account and all its data
 * (requires the delete_my_account() function from the migration).
 */
export async function deleteAccount(): Promise<void> {
  if (await getSessionUserId()) {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw new Error(error.message);
  }
  await clearAllData();
}

// ───────────────────────────────────────────────────────
// Custom Exercises Operations
// ───────────────────────────────────────────────────────

export async function getCustomExercises(): Promise<ExerciseLibraryItem[]> {
  return readLocal<ExerciseLibraryItem[]>(KEYS.CUSTOM_EXERCISES, []);
}

export async function saveCustomExercise(exercise: Omit<ExerciseLibraryItem, 'id'>): Promise<ExerciseLibraryItem> {
  const customExercises = await getCustomExercises();
  const newExercise: ExerciseLibraryItem = {
    ...exercise,
    id: 'custom-' + generateId(),
  };
  customExercises.push(newExercise);
  await writeLocal(KEYS.CUSTOM_EXERCISES, customExercises);
  return newExercise;
}

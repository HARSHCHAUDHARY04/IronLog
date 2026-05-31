// ═══════════════════════════════════════════════════════
// Mock Data Storage Layer
// Provides full app functionality without Supabase
// Uses AsyncStorage for persistence
// ═══════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

// Generate a standard RFC4122 version 4 compliant UUID
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to ensure an ID is a valid UUID, generating one if it isn't
function ensureUUID(id: string): string {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    return id;
  }
  return generateId();
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
  user_id: string;
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
};

// ───────────────────────────────────────────────────────
// User Operations
// ───────────────────────────────────────────────────────

export async function getUser(): Promise<User | null> {
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile, error: pError } = await supabase
          .from('profiles')
          .select('id, username, created_at, xp, level, current_streak, highest_streak, total_workouts, badges')
          .eq('id', session.user.id)
          .single();
        
        if (!pError && profile) {
          // Fetch demographics from users table
          const { data: userData } = await supabase
            .from('users')
            .select('age, weight_kg, height_cm, goal, onboarding_completed')
            .eq('id', session.user.id)
            .single();

          const user: User = {
            id: profile.id,
            name: profile.username || '',
            email: session.user.email || '',
            age: userData?.age || undefined,
            weight_kg: userData?.weight_kg ? Number(userData.weight_kg) : undefined,
            height_cm: userData?.height_cm ? Number(userData.height_cm) : undefined,
            goal: (userData?.goal as any) || 'general_fitness',
            onboarding_completed: userData?.onboarding_completed ?? true,
            xp: profile.xp || 0,
            level: profile.level || 1,
            current_streak: profile.current_streak || 0,
            highest_streak: profile.highest_streak || 0,
            total_workouts: profile.total_workouts || 0,
            badges: profile.badges || [],
            created_at: profile.created_at || new Date().toISOString(),
          };
          await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
          return user;
        }
      }
    } catch (e) {
      console.error('Supabase getUser failed, using local fallback:', e);
    }
  }

  const data = await AsyncStorage.getItem(KEYS.USER);
  return data ? JSON.parse(data) : null;
}

export async function saveUser(user: Partial<User>): Promise<User> {
  const existing = await getUser();
  const updated: User = {
    id: existing?.id || generateId(),
    name: user.name || existing?.name || '',
    email: user.email || existing?.email || '',
    age: user.age ?? existing?.age,
    weight_kg: user.weight_kg ?? existing?.weight_kg,
    height_cm: user.height_cm ?? existing?.height_cm,
    goal: user.goal || existing?.goal || 'general_fitness',
    onboarding_completed: user.onboarding_completed ?? existing?.onboarding_completed ?? false,
    xp: user.xp ?? existing?.xp ?? 0,
    level: user.level ?? existing?.level ?? 1,
    current_streak: user.current_streak ?? existing?.current_streak ?? 0,
    highest_streak: user.highest_streak ?? existing?.highest_streak ?? 0,
    total_workouts: user.total_workouts ?? existing?.total_workouts ?? 0,
    badges: user.badges ?? existing?.badges ?? [],
    created_at: existing?.created_at || new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEYS.USER, JSON.stringify(updated));

  if (isSupabaseConfigured) {
    try {
      // First upsert to users table to satisfy foreign keys
      const { error: userError } = await supabase.from('users').upsert({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        age: updated.age,
        weight_kg: updated.weight_kg,
        height_cm: updated.height_cm,
        goal: updated.goal,
        onboarding_completed: updated.onboarding_completed,
      });
      if (userError) {
        console.error('Supabase upsert users failed:', userError);
      }

      // Then upsert to profiles table
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: updated.id,
        username: updated.name,
        xp: updated.xp,
        level: updated.level,
        current_streak: updated.current_streak,
        highest_streak: updated.highest_streak,
        total_workouts: updated.total_workouts,
        badges: updated.badges,
      });
      if (profileError) {
        console.error('Supabase upsert profiles failed:', profileError);
      }
    } catch (e) {
      console.error('Supabase saveUser failed:', e);
    }
  }

  return updated;
}

// ───────────────────────────────────────────────────────
// Workout Operations
// ───────────────────────────────────────────────────────

export async function getWorkouts(): Promise<Workout[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select(`
          id,
          user_id,
          workout_date,
          name,
          muscle_groups,
          duration_minutes,
          notes,
          total_volume_kg,
          created_at,
          exercises (
            id,
            workout_id,
            exercise_name,
            set_number,
            reps,
            weight_kg,
            rpe,
            is_warmup,
            estimated_1rm,
            notes
          )
        `)
        .order('workout_date', { ascending: false });

      if (!error && data) {
        const formatted: Workout[] = (data as any[]).map(w => ({
          id: w.id,
          user_id: w.user_id,
          workout_date: w.workout_date,
          name: w.name,
          muscle_groups: w.muscle_groups || [],
          duration_minutes: w.duration_minutes || 0,
          notes: w.notes || '',
          total_volume_kg: Number(w.total_volume_kg) || 0,
          created_at: w.created_at,
          exercises: (w.exercises || []).map((e: any) => ({
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
          })),
        }));

        await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(formatted));
        return formatted;
      }
    } catch (e) {
      console.error('Supabase getWorkouts failed, using local fallback:', e);
    }
  }

  const data = await AsyncStorage.getItem(KEYS.WORKOUTS);
  const workouts: Workout[] = data ? JSON.parse(data) : [];
  return workouts.sort((a, b) => new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime());
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

  // Ensure all exercise IDs are valid UUIDs
  newWorkout.exercises = newWorkout.exercises.map(e => ({
    ...e,
    id: ensureUUID(e.id),
    workout_id: newWorkout.id,
  }));

  const workouts = await getWorkouts();
  workouts.push(newWorkout);
  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));

  if (isSupabaseConfigured) {
    try {
      const { error: wError } = await supabase.from('workouts').insert({
        id: newWorkout.id,
        user_id: newWorkout.user_id,
        workout_date: newWorkout.workout_date,
        name: newWorkout.name,
        muscle_groups: newWorkout.muscle_groups,
        duration_minutes: newWorkout.duration_minutes,
        notes: newWorkout.notes,
        total_volume_kg: newWorkout.total_volume_kg,
        created_at: newWorkout.created_at,
      });

      if (wError) {
        console.error('Supabase parent saveWorkout failed:', wError);
      } else {
        const exercisesToInsert = newWorkout.exercises.map(e => ({
          id: e.id,
          workout_id: newWorkout.id,
          exercise_name: e.exercise_name,
          set_number: e.set_number,
          reps: e.reps,
          weight_kg: e.weight_kg,
          rpe: e.rpe,
          is_warmup: e.is_warmup,
          notes: e.notes,
        }));

        const { error: exError } = await supabase.from('exercises').insert(exercisesToInsert);
        if (exError) console.error('Supabase child exercises save failed:', exError);
      }
    } catch (e) {
      console.error('Supabase saveWorkout exception:', e);
    }
  }

  return newWorkout;
}

export async function deleteWorkout(id: string): Promise<void> {
  const workouts = await getWorkouts();
  const filtered = workouts.filter(w => w.id !== id);
  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(filtered));

  if (isSupabaseConfigured) {
    try {
      await supabase.from('workouts').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteWorkout failed:', e);
    }
  }
}

export async function getExerciseHistory(exerciseName: string): Promise<{
  workout_date: string;
  sets: WorkoutExercise[];
  best_1rm: number;
  total_volume: number;
}[]> {
  const workouts = await getWorkouts();
  const history: {
    workout_date: string;
    sets: WorkoutExercise[];
    best_1rm: number;
    total_volume: number;
  }[] = [];

  for (const workout of workouts) {
    const exerciseSets = workout.exercises.filter(
      e => e.exercise_name.toLowerCase() === exerciseName.toLowerCase() && !e.is_warmup
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
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const thisMonthWorkouts = workouts.filter(w => new Date(w.workout_date) >= startOfMonth).length;
  const thisWeekWorkouts = workouts.filter(w => new Date(w.workout_date) >= startOfWeek).length;
  const thisWeekVolume = workouts
    .filter(w => new Date(w.workout_date) >= startOfWeek)
    .reduce((sum, w) => sum + w.total_volume_kg, 0);
  const lastWeekVolume = workouts
    .filter(w => {
      const d = new Date(w.workout_date);
      return d >= startOfLastWeek && d < startOfWeek;
    })
    .reduce((sum, w) => sum + w.total_volume_kg, 0);

  // Calculate streak
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  const workoutDates = [...new Set(workouts.map(w => w.workout_date))].sort().reverse();
  
  if (workoutDates.length > 0) {
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Check if there's a workout today or yesterday to start the streak
    if (workoutDates[0] === today || workoutDates[0] === yesterdayStr) {
      currentStreak = 1;
      for (let i = 1; i < workoutDates.length; i++) {
        const prev = new Date(workoutDates[i - 1]);
        const curr = new Date(workoutDates[i]);
        const diffDays = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 2) { // Allow 1 rest day between workouts
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    tempStreak = 1;
    for (let i = 1; i < workoutDates.length; i++) {
      const prev = new Date(workoutDates[i - 1]);
      const curr = new Date(workoutDates[i]);
      const diffDays = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  return {
    totalWorkouts: workouts.length,
    thisMonthWorkouts,
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalVolume: workouts.reduce((sum, w) => sum + w.total_volume_kg, 0),
    thisWeekVolume: Math.round(thisWeekVolume),
    lastWeekVolume: Math.round(lastWeekVolume),
    thisWeekWorkouts,
  };
}

export async function getWorkoutDatesForMonth(year: number, month: number): Promise<string[]> {
  const workouts = await getWorkouts();
  return workouts
    .filter(w => {
      const d = new Date(w.workout_date);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .map(w => w.workout_date);
}

// ───────────────────────────────────────────────────────
// Progress (Bodyweight) Operations
// ───────────────────────────────────────────────────────

export async function getProgressEntries(): Promise<ProgressEntry[]> {
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase
          .from('progress')
          .select('*')
          .eq('user_id', session.user.id)
          .order('date', { ascending: false });

        if (!error && data) {
          const formatted: ProgressEntry[] = (data as any[]).map(pe => ({
            id: pe.id,
            user_id: pe.user_id,
            body_weight: Number(pe.body_weight) || 0,
            date: pe.date,
            notes: pe.notes || '',
          }));

          await AsyncStorage.setItem(KEYS.PROGRESS, JSON.stringify(formatted));
          return formatted;
        }
      }
    } catch (e) {
      console.error('Supabase getProgressEntries failed, using local fallback:', e);
    }
  }

  const data = await AsyncStorage.getItem(KEYS.PROGRESS);
  const entries: ProgressEntry[] = data ? JSON.parse(data) : [];
  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function saveProgressEntry(entry: Omit<ProgressEntry, 'id'>): Promise<ProgressEntry> {
  const newEntry: ProgressEntry = { ...entry, id: generateId() };

  // 1. Optimistic local update
  const entries = await getProgressEntries();
  entries.push(newEntry);
  await AsyncStorage.setItem(KEYS.PROGRESS, JSON.stringify(entries));

  // 2. Sync to Supabase in background
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const supabaseProgress = {
          id: newEntry.id,
          user_id: session.user.id,
          body_weight: newEntry.body_weight,
          date: newEntry.date,
          notes: newEntry.notes || null,
        };

        await supabase.from('progress').upsert(supabaseProgress);
      }
    } catch (e) {
      console.error('Supabase saveProgressEntry failed:', e);
    }
  }

  return newEntry;
}

// ───────────────────────────────────────────────────────
// Personal Records Operations
// ───────────────────────────────────────────────────────

export async function getPRs(): Promise<PRRecord[]> {
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase
          .from('personal_records')
          .select('*')
          .eq('user_id', session.user.id)
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

          await AsyncStorage.setItem(KEYS.PRS, JSON.stringify(formatted));
          return formatted;
        }
      }
    } catch (e) {
      console.error('Supabase getPRs failed, using local fallback:', e);
    }
  }

  const data = await AsyncStorage.getItem(KEYS.PRS);
  const prs: PRRecord[] = data ? JSON.parse(data) : [];
  return prs.sort((a, b) => new Date(b.achieved_at).getTime() - new Date(a.achieved_at).getTime());
}

export async function savePR(pr: Omit<PRRecord, 'id'>): Promise<PRRecord> {
  const newPR: PRRecord = { ...pr, id: generateId() };

  // 1. Optimistic local update
  const prs = await getPRs();
  prs.push(newPR);
  await AsyncStorage.setItem(KEYS.PRS, JSON.stringify(prs));

  // 2. Sync to Supabase in background
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const supabasePR = {
          id: newPR.id,
          user_id: session.user.id,
          exercise_name: newPR.exercise_name,
          record_type: newPR.record_type,
          value: newPR.value,
          previous_value: newPR.previous_value || null,
          improvement_pct: newPR.improvement_pct || null,
          achieved_at: newPR.achieved_at,
          workout_id: newPR.workout_id || null, // Map empty string to null to satisfy foreign key
        };

        await supabase.from('personal_records').upsert(supabasePR);
      }
    } catch (e) {
      console.error('Supabase savePR failed:', e);
    }
  }

  return newPR;
}

export async function getBestPRForExercise(exerciseName: string): Promise<{
  oneRM: number;
  volume: number;
  maxReps: number;
}> {
  const prs = await getPRs();
  const exercisePRs = prs.filter(
    p => p.exercise_name.toLowerCase() === exerciseName.toLowerCase()
  );

  return {
    oneRM: Math.max(0, ...exercisePRs.filter(p => p.record_type === '1rm').map(p => p.value)),
    volume: Math.max(0, ...exercisePRs.filter(p => p.record_type === 'volume').map(p => p.value)),
    maxReps: Math.max(0, ...exercisePRs.filter(p => p.record_type === 'reps').map(p => p.value)),
  };
}

// ───────────────────────────────────────────────────────
// Template Operations
// ───────────────────────────────────────────────────────

export async function getTemplates(): Promise<WorkoutTemplate[]> {
  // Define default system-level templates
  const defaults: WorkoutTemplate[] = [
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

  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data, error } = await supabase
          .from('workout_templates')
          .select('*')
          .eq('user_id', session.user.id);

        if (!error && data) {
          const customTemplates: WorkoutTemplate[] = (data as any[]).map(t => ({
            id: t.id,
            user_id: t.user_id,
            name: t.name,
            muscle_groups: t.muscle_groups || [],
            exercises: Array.isArray(t.exercises) ? t.exercises : JSON.parse(t.exercises || '[]'),
            is_default: t.is_default || false,
          }));

          const combined = [...defaults, ...customTemplates];
          await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(combined));
          return combined;
        }
      }
    } catch (e) {
      console.error('Supabase getTemplates failed, using local fallback:', e);
    }
  }

  const data = await AsyncStorage.getItem(KEYS.TEMPLATES);
  if (data) {
    // Make sure we have the defaults if the storage is empty or somehow corrupted
    const parsed = JSON.parse(data) as WorkoutTemplate[];
    const custom = parsed.filter(t => !t.is_default);
    return [...defaults, ...custom];
  }

  await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(defaults));
  return defaults;
}

export async function saveTemplate(template: Omit<WorkoutTemplate, 'id'>): Promise<WorkoutTemplate> {
  const newTemplate: WorkoutTemplate = {
    ...template,
    id: generateId(),
  };

  // 1. Optimistic local update
  const templates = await getTemplates();
  templates.push(newTemplate);
  await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(templates));

  // 2. Sync to Supabase in background
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const supabaseTemplate = {
          id: newTemplate.id,
          user_id: session.user.id,
          name: newTemplate.name,
          muscle_groups: newTemplate.muscle_groups,
          exercises: newTemplate.exercises, // JSONB
          is_default: newTemplate.is_default,
        };

        await supabase.from('workout_templates').upsert(supabaseTemplate);
      }
    } catch (e) {
      console.error('Supabase saveTemplate failed:', e);
    }
  }

  return newTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  // 1. Optimistic local deletion
  const templates = await getTemplates();
  const updated = templates.filter(t => t.id !== id);
  await AsyncStorage.setItem(KEYS.TEMPLATES, JSON.stringify(updated));

  // 2. Sync deletion to Supabase
  if (isSupabaseConfigured && !id.startsWith('default-')) {
    try {
      await supabase.from('workout_templates').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase deleteTemplate failed:', e);
    }
  }
}

// ───────────────────────────────────────────────────────
// Seed Demo Data (for showcasing)
// ───────────────────────────────────────────────────────

export async function seedDemoData(): Promise<void> {
  let user = await getUser();
  if (!user) {
    user = await saveUser({
      name: 'Demo Athlete',
      email: 'demo@ironlog.app',
      onboarding_completed: true,
      xp: 0,
      level: 1,
    });
  }

  // Generate 30 days of workout data
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
    const workoutDate = new Date(today);
    workoutDate.setDate(today.getDate() - day);
    const dateStr = workoutDate.toISOString().split('T')[0];

    const patternIdx = Math.floor((30 - day) / 2) % 3;
    const pattern = workoutPatterns[patternIdx];

    // Progressive overload: slight weight increase over time
    const progressFactor = 1 + ((30 - day) / 30) * 0.15; // Up to 15% increase

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
          workout_id: '',
          exercise_name: ex.name,
          set_number: set,
          reps: setReps,
          weight_kg: setWeight,
          rpe: set === 4 ? 9 : set === 3 ? 8 : 7,
          is_warmup: set === 1,
          estimated_1rm: Math.round(est1rm * 100) / 100,
        });

        if (set !== 1) {
          totalVolume += setReps * setWeight;
        }
      }
    }

    const workout: Workout = {
      id: generateId(),
      user_id: user.id,
      workout_date: dateStr,
      name: pattern.name,
      muscle_groups: pattern.muscleGroups,
      duration_minutes: 45 + Math.floor(Math.random() * 30),
      notes: '',
      total_volume_kg: Math.round(totalVolume),
      exercises: workoutExercises.map(e => ({ ...e, workout_id: '' })),
      created_at: workoutDate.toISOString(),
    };

    // Set workout_id on exercises
    workout.exercises = workout.exercises.map(e => ({ ...e, workout_id: workout.id }));
    workouts.push(workout);
  }

  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));

  // Generate some PRs from the workout data
  const prs: PRRecord[] = [];
  const exerciseNames = [...new Set(workouts.flatMap(w => w.exercises.map(e => e.exercise_name)))];
  
  for (const name of exerciseNames) {
    const allSets = workouts.flatMap(w => 
      w.exercises.filter(e => e.exercise_name === name && !e.is_warmup)
    );
    if (allSets.length > 0) {
      const best1rm = Math.max(...allSets.map(s => s.estimated_1rm));
      prs.push({
        id: generateId(),
        user_id: user.id,
        exercise_name: name,
        record_type: '1rm',
        value: Math.round(best1rm * 100) / 100,
        achieved_at: new Date().toISOString(),
        workout_id: workouts[workouts.length - 1].id,
      });
    }
  }

  await AsyncStorage.setItem(KEYS.PRS, JSON.stringify(prs));

  // Generate bodyweight progress
  const progressEntries: ProgressEntry[] = [];
  for (let day = 30; day >= 0; day -= 3) {
    const date = new Date(today);
    date.setDate(today.getDate() - day);
    progressEntries.push({
      id: generateId(),
      user_id: user.id,
      body_weight: (user.weight_kg || 70) + (Math.random() * 2 - 1),
      date: date.toISOString().split('T')[0],
    });
  }

  await AsyncStorage.setItem(KEYS.PROGRESS, JSON.stringify(progressEntries));

  // Calculate and update user stats in storage to match the seeded demo data
  const workoutsTotalVolume = workouts.reduce((sum, w) => sum + w.total_volume_kg, 0);
  const xpEarned = Math.round(workoutsTotalVolume / 100) + 15 * workouts.length;
  const newLevel = Math.floor(Math.sqrt(xpEarned / 100)) + 1;

  await saveUser({
    total_workouts: workouts.length,
    current_streak: 3,
    highest_streak: 5,
    xp: xpEarned,
    level: newLevel,
    badges: ['first_workout', 'dedicated_10'],
  });
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const keys = [
    KEYS.USER,
    KEYS.WORKOUTS,
    KEYS.TEMPLATES,
    KEYS.PROGRESS,
    KEYS.PRS,
    KEYS.CUSTOM_EXERCISES,
  ];
  await Promise.all(keys.map(key => AsyncStorage.removeItem(key)));
}

// ───────────────────────────────────────────────────────
// Custom Exercises Operations
// ───────────────────────────────────────────────────────

export async function getCustomExercises(): Promise<ExerciseLibraryItem[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.CUSTOM_EXERCISES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error fetching custom exercises:', error);
    return [];
  }
}

export async function saveCustomExercise(exercise: Omit<ExerciseLibraryItem, 'id'>): Promise<ExerciseLibraryItem> {
  const customExercises = await getCustomExercises();
  const newExercise: ExerciseLibraryItem = {
    ...exercise,
    id: 'custom-' + generateId(),
  };
  customExercises.push(newExercise);
  await AsyncStorage.setItem(KEYS.CUSTOM_EXERCISES, JSON.stringify(customExercises));
  return newExercise;
}

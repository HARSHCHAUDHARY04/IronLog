// ═══════════════════════════════════════════════════════
// Workout Store — Active workout session state
// Persisted to AsyncStorage to survive app kills
// ═══════════════════════════════════════════════════════

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Workout, WorkoutExercise, saveWorkout, getLastSessionForExercise, getWorkoutStats, saveUser, getBestPRForExercise, savePR } from '../lib/storage';
import { calculate1RM } from '../lib/overloadEngine';
import { useAuthStore } from './authStore';
import { useSettingsStore } from './settingsStore';
import { toLocalDateStr } from '../lib/date';
import { scheduleRestTimerNotification, cancelRestTimerNotification, scheduleWorkoutReminders } from '../lib/notifications';
import { checkForPRs } from '../lib/prDetection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import exerciseLibrary from '../data/exercises.json';

interface ActiveExercise {
  name: string;
  sets: ActiveSet[];
  notes: string;
  previousSets: WorkoutExercise[] | null;
}

interface ActiveSet {
  id: string;
  reps: number;
  weight_kg: number;
  rpe?: number;
  is_warmup: boolean;
  completed: boolean;
}

interface WorkoutState {
  // Active workout
  isActive: boolean;
  workoutName: string;
  startTime: string | null; // ISO string for serialization
  exercises: ActiveExercise[];
  restTimerRunning: boolean;
  restTimerSeconds: number;
  restTimerDefault: number;
  restTimerStartedAt: string | null;

  // Actions
  startWorkout: (name?: string) => void;
  startFromTemplate: (name: string, templateExercises: { name: string; sets: number; reps: number }[]) => Promise<void>;
  setWorkoutName: (name: string) => void;
  addExercise: (name: string) => Promise<void>;
  removeExercise: (index: number) => void;
  addSet: (exerciseIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, data: Partial<ActiveSet>) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  duplicateSet: (exerciseIndex: number, setIndex: number) => void;
  toggleSetComplete: (exerciseIndex: number, setIndex: number) => void;
  setExerciseNotes: (exerciseIndex: number, notes: string) => void;
  startRestTimer: (seconds?: number) => void;
  stopRestTimer: () => void;
  setRestTimerDefault: (seconds: number) => void;
  finishWorkout: (userId: string, notes?: string) => Promise<Workout | null>;
  cancelWorkout: () => void;
  reorderExercise: (fromIndex: number, toIndex: number) => void;
}

function generateSetId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getDayName(): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date().getDay()];
}

/**
 * Look up muscle groups from the exercise library by name.
 * Falls back to keyword matching for custom exercises not in the library.
 */
function getMuscleGroupsForExercise(exerciseName: string): string[] {
  // Try exact match from exercise library
  const libraryEntry = exerciseLibrary.exercises.find(
    (e: any) => e.name.toLowerCase() === exerciseName.toLowerCase()
  );
  if (libraryEntry && libraryEntry.primary_muscles.length > 0) {
    return libraryEntry.primary_muscles;
  }

  // Fallback: keyword matching for custom exercises
  const nameLower = exerciseName.toLowerCase();
  const keywordMap: Record<string, string[]> = {
    'bench': ['chest'], 'press': ['chest', 'shoulders'], 'fly': ['chest'],
    'squat': ['quadriceps'], 'lunge': ['quadriceps'], 'leg': ['quadriceps', 'hamstrings'],
    'deadlift': ['hamstrings', 'back'], 'row': ['back'], 'pull': ['back'], 'lat': ['back'],
    'curl': ['biceps'], 'tricep': ['triceps'], 'shoulder': ['shoulders'],
    'lateral': ['shoulders'], 'overhead': ['shoulders'], 'calf': ['calves'],
    'crunch': ['core'], 'plank': ['core'], 'hip thrust': ['glutes'],
    'glute': ['glutes'], 'dip': ['chest', 'triceps'],
  };

  const matched: string[] = [];
  for (const [keyword, muscles] of Object.entries(keywordMap)) {
    if (nameLower.includes(keyword)) {
      muscles.forEach(m => { if (!matched.includes(m)) matched.push(m); });
    }
  }
  return matched;
}

export const useWorkoutStore = create<WorkoutState>()(
  persist(
    (set, get) => ({
      isActive: false,
      workoutName: '',
      startTime: null,
      exercises: [],
      restTimerRunning: false,
      restTimerSeconds: 0,
      restTimerDefault: 90,
      restTimerStartedAt: null,

      startWorkout: (name?: string) => {
        set({
          isActive: true,
          workoutName: name || `${getDayName()} Workout`,
          startTime: new Date().toISOString(),
          exercises: [],
          restTimerRunning: false,
          restTimerSeconds: 0,
        });
      },

      startFromTemplate: async (name: string, templateExercises: { name: string; sets: number; reps: number }[]) => {
        const exercises: ActiveExercise[] = [];

        for (const te of templateExercises) {
          const previousSets = await getLastSessionForExercise(te.name);
          const sets: ActiveSet[] = [];

          for (let i = 0; i < te.sets; i++) {
            const prevSet = previousSets?.[i];
            sets.push({
              id: generateSetId(),
              reps: prevSet?.reps || te.reps,
              weight_kg: prevSet?.weight_kg || 0,
              is_warmup: false,
              completed: false,
            });
          }

          exercises.push({
            name: te.name,
            sets,
            notes: '',
            previousSets,
          });
        }

        set({
          isActive: true,
          workoutName: name,
          startTime: new Date().toISOString(),
          exercises,
          restTimerRunning: false,
          restTimerSeconds: 0,
        });
      },

      setWorkoutName: (name: string) => set({ workoutName: name }),

      addExercise: async (name: string) => {
        const previousSets = await getLastSessionForExercise(name);
        const { exercises } = get();

        const defaultSet: ActiveSet = {
          id: generateSetId(),
          reps: previousSets?.[0]?.reps || 8,
          weight_kg: previousSets?.[0]?.weight_kg || 0,
          is_warmup: false,
          completed: false,
        };

        set({
          exercises: [
            ...exercises,
            {
              name,
              sets: [defaultSet],
              notes: '',
              previousSets,
            },
          ],
        });
      },

      removeExercise: (index: number) => {
        const { exercises } = get();
        set({ exercises: exercises.filter((_, i) => i !== index) });
      },

      addSet: (exerciseIndex: number) => {
        const { exercises } = get();
        const exercise = exercises[exerciseIndex];
        if (!exercise) return;

        const lastSet = exercise.sets[exercise.sets.length - 1];
        const newSet: ActiveSet = {
          id: generateSetId(),
          reps: lastSet?.reps || 8,
          weight_kg: lastSet?.weight_kg || 0,
          is_warmup: false,
          completed: false,
        };

        const updated = [...exercises];
        updated[exerciseIndex] = {
          ...exercise,
          sets: [...exercise.sets, newSet],
        };
        set({ exercises: updated });
      },

      updateSet: (exerciseIndex: number, setIndex: number, data: Partial<ActiveSet>) => {
        // Input validation: clamp weight and reps
        if (data.weight_kg !== undefined) {
          data.weight_kg = Math.max(0, Math.min(999, data.weight_kg));
        }
        if (data.reps !== undefined) {
          data.reps = Math.max(0, Math.min(999, data.reps));
        }

        const { exercises } = get();
        const updated = [...exercises];
        const exercise = { ...updated[exerciseIndex] };
        const sets = [...exercise.sets];
        sets[setIndex] = { ...sets[setIndex], ...data };
        exercise.sets = sets;
        updated[exerciseIndex] = exercise;
        set({ exercises: updated });
      },

      removeSet: (exerciseIndex: number, setIndex: number) => {
        const { exercises } = get();
        const updated = [...exercises];
        const exercise = { ...updated[exerciseIndex] };
        exercise.sets = exercise.sets.filter((_, i) => i !== setIndex);
        updated[exerciseIndex] = exercise;
        set({ exercises: updated });
      },

      duplicateSet: (exerciseIndex: number, setIndex: number) => {
        const { exercises } = get();
        const updated = [...exercises];
        const exercise = { ...updated[exerciseIndex] };
        const setToDuplicate = exercise.sets[setIndex];
        const newSet: ActiveSet = {
          ...setToDuplicate,
          id: generateSetId(),
          completed: false,
        };
        exercise.sets = [...exercise.sets];
        exercise.sets.splice(setIndex + 1, 0, newSet);
        updated[exerciseIndex] = exercise;
        set({ exercises: updated });
      },

      toggleSetComplete: (exerciseIndex: number, setIndex: number) => {
        const { exercises } = get();
        const updated = [...exercises];
        const exercise = { ...updated[exerciseIndex] };
        const sets = [...exercise.sets];
        sets[setIndex] = { ...sets[setIndex], completed: !sets[setIndex].completed };
        exercise.sets = sets;
        updated[exerciseIndex] = exercise;
        set({ exercises: updated });
      },

      setExerciseNotes: (exerciseIndex: number, notes: string) => {
        const { exercises } = get();
        const updated = [...exercises];
        updated[exerciseIndex] = { ...updated[exerciseIndex], notes };
        set({ exercises: updated });
      },

      startRestTimer: (seconds?: number) => {
        // The Profile → Rest Timer setting is the source of truth
        const duration = seconds || useSettingsStore.getState().defaultRestTimer || get().restTimerDefault;
        set({
          restTimerRunning: true,
          restTimerSeconds: duration,
          restTimerStartedAt: new Date().toISOString(),
        });
        // Alerts the user even if the phone is locked / app backgrounded
        scheduleRestTimerNotification(duration);
      },

      stopRestTimer: () => {
        set({ restTimerRunning: false, restTimerSeconds: 0, restTimerStartedAt: null });
        cancelRestTimerNotification();
      },

      setRestTimerDefault: (seconds: number) => {
        set({ restTimerDefault: seconds });
        useSettingsStore.getState().setDefaultRestTimer(seconds);
      },

      finishWorkout: async (userId: string, notes?: string) => {
        try {
          const { workoutName, startTime, exercises } = get();

          if (exercises.length === 0) return null;

          // Clear PRs left over from a previous session
          await AsyncStorage.removeItem('ironlog_session_prs');

          const now = new Date();
          // Cap at 8h so a workout left open overnight doesn't log 900 minutes
          const durationMinutes = startTime
            ? Math.min(480, Math.round((now.getTime() - new Date(startTime).getTime()) / 60000))
            : 0;

          // Build workout exercises
          const workoutExercises: WorkoutExercise[] = [];
          const muscleGroupsSet = new Set<string>();
          let totalVolume = 0;

          for (const exercise of exercises) {
            for (let i = 0; i < exercise.sets.length; i++) {
              const s = exercise.sets[i];
              if (!s.completed) continue;

              const est1rm = calculate1RM(s.weight_kg, s.reps);
              workoutExercises.push({
                id: generateSetId(),
                workout_id: '', // Will be set by storage
                exercise_name: exercise.name,
                set_number: i + 1,
                reps: s.reps,
                weight_kg: s.weight_kg,
                rpe: s.rpe,
                is_warmup: s.is_warmup,
                estimated_1rm: est1rm,
                notes: exercise.notes,
              });

              if (!s.is_warmup) {
                totalVolume += s.reps * s.weight_kg;
              }
            }
          }

          if (workoutExercises.length === 0) return null;

          // Determine muscle groups using exercise library lookup
          const loggedNames = [...new Set(workoutExercises.map(e => e.exercise_name))];
          for (const name of loggedNames) {
            getMuscleGroupsForExercise(name).forEach(m => muscleGroupsSet.add(m));
          }

          const workout = await saveWorkout({
            user_id: userId,
            workout_date: toLocalDateStr(now),
            name: workoutName,
            muscle_groups: Array.from(muscleGroupsSet),
            duration_minutes: durationMinutes,
            notes: notes || '',
            total_volume_kg: Math.round(totalVolume),
            exercises: workoutExercises,
          });

          // --- DETECT AND SAVE PRs ---
          try {
            const newPRsDetected: any[] = [];
            for (const ex of loggedNames.map(name => ({ name }))) {
              const workingSets = workoutExercises.filter(e => e.exercise_name === ex.name);
              const hist = await getBestPRForExercise(ex.name);
              
              const mappedSets = workingSets.map(s => ({
                id: s.id,
                exercise_name: s.exercise_name,
                set_number: s.set_number,
                reps: s.reps,
                weight_kg: s.weight_kg,
                rpe: s.rpe,
                is_warmup: s.is_warmup,
                estimated_1rm: s.estimated_1rm
              }));
              
              const detected = checkForPRs(ex.name, mappedSets, hist);
              for (const pr of detected) {
                if (pr.is_pr || pr.is_baseline) {
                  const saved = await savePR({
                    user_id: userId,
                    exercise_name: pr.exercise_name,
                    record_type: pr.record_type,
                    value: pr.new_value,
                    previous_value: pr.previous_value ?? undefined,
                    improvement_pct: pr.improvement_pct ?? undefined,
                    achieved_at: now.toISOString(),
                    workout_id: workout.id
                  });
                  if (pr.is_pr) newPRsDetected.push(saved);
                }
              }
            }

            if (newPRsDetected.length > 0) {
              await AsyncStorage.setItem('ironlog_session_prs', JSON.stringify(newPRsDetected));
            }
          } catch (prError) {
            console.error('PR detection failed in finishWorkout:', prError);
          }

          // --- GAMIFICATION: Update XP and Stats ---
          // With Supabase the database recomputes xp/level/total_workouts from
          // the workouts table; the local values here are an optimistic preview.
          try {
            const authStore = useAuthStore.getState();
            const currentUser = authStore.user;

            if (currentUser) {
              // 1 XP per 100kg volume (max 500) + 10 XP base for completion
              const xpEarned = Math.min(500, Math.round(totalVolume / 100)) + 10;
              const newXP = (currentUser.xp || 0) + xpEarned;
              const stats = await getWorkoutStats();

              await saveUser({
                xp: newXP,
                level: Math.floor(Math.sqrt(newXP / 100)) + 1,
                total_workouts: stats.totalWorkouts,
                current_streak: stats.currentStreak,
                highest_streak: Math.max(currentUser.highest_streak || 0, stats.longestStreak),
              });

              await authStore.checkBadges();
              await authStore.loadUser();
            }
          } catch (gamificationError) {
            console.error('Gamification update failed in finishWorkout:', gamificationError);
          }

          // Trained today → skip today's reminder
          const settings = useSettingsStore.getState();
          if (settings.notificationsEnabled) {
            scheduleWorkoutReminders(settings.reminderHour, settings.reminderMinute, workout.workout_date);
          }
          cancelRestTimerNotification();

          // Reset state
          set({
            isActive: false,
            workoutName: '',
            startTime: null,
            exercises: [],
            restTimerRunning: false,
            restTimerSeconds: 0,
            restTimerStartedAt: null,
          });

          return workout;
        } catch (error) {
          console.error('Critical error in finishWorkout:', error);
          // Keep the session intact so the user can retry instead of losing every set
          throw error;
        }
      },

      cancelWorkout: () => {
        set({
          isActive: false,
          workoutName: '',
          startTime: null,
          exercises: [],
          restTimerRunning: false,
          restTimerSeconds: 0,
          restTimerStartedAt: null,
        });
        cancelRestTimerNotification();
      },

      reorderExercise: (fromIndex: number, toIndex: number) => {
        const { exercises } = get();
        const updated = [...exercises];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        set({ exercises: updated });
      },
    }),
    {
      name: 'ironlog-active-workout',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist workout-related state, not timer runtime state
      partialize: (state) => ({
        isActive: state.isActive,
        workoutName: state.workoutName,
        startTime: state.startTime,
        exercises: state.exercises,
        restTimerDefault: state.restTimerDefault,
      }),
    }
  )
);

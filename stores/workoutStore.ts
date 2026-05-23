// ═══════════════════════════════════════════════════════
// Workout Store — Active workout session state
// ═══════════════════════════════════════════════════════

import { create } from 'zustand';
import { Workout, WorkoutExercise, saveWorkout, getLastSessionForExercise, getWorkoutStats, saveUser, getUser, getBestPRForExercise, savePR } from '../lib/storage';
import { calculate1RM } from '../lib/overloadEngine';
import { useAuthStore } from './authStore';
import { checkForPRs } from '../lib/prDetection';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  startTime: Date | null;
  exercises: ActiveExercise[];
  restTimerRunning: boolean;
  restTimerSeconds: number;
  restTimerDefault: number;

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
  finishWorkout: (userId: string) => Promise<Workout | null>;
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

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  isActive: false,
  workoutName: '',
  startTime: null,
  exercises: [],
  restTimerRunning: false,
  restTimerSeconds: 0,
  restTimerDefault: 90,

  startWorkout: (name?: string) => {
    set({
      isActive: true,
      workoutName: name || `${getDayName()} Workout`,
      startTime: new Date(),
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
      startTime: new Date(),
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
    const { restTimerDefault } = get();
    set({
      restTimerRunning: true,
      restTimerSeconds: seconds || restTimerDefault,
    });
  },

  stopRestTimer: () => {
    set({ restTimerRunning: false, restTimerSeconds: 0 });
  },

  setRestTimerDefault: (seconds: number) => set({ restTimerDefault: seconds }),

  finishWorkout: async (userId: string) => {
    try {
      const { workoutName, startTime, exercises } = get();

      if (exercises.length === 0) return null;

      const now = new Date();
      const durationMinutes = startTime
        ? Math.round((now.getTime() - startTime.getTime()) / 60000)
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

      // Determine muscle groups from exercise library
      // For now, use a simple mapping
      const exerciseToMuscle: Record<string, string[]> = {
        'bench': ['chest'],
        'press': ['chest', 'shoulders'],
        'fly': ['chest'],
        'squat': ['quadriceps'],
        'lunge': ['quadriceps'],
        'leg': ['quadriceps', 'hamstrings'],
        'deadlift': ['hamstrings'],
        'row': ['back'],
        'pull': ['back'],
        'lat': ['back'],
        'curl': ['biceps'],
        'tricep': ['triceps'],
        'shoulder': ['shoulders'],
        'lateral': ['shoulders'],
        'overhead': ['shoulders'],
        'calf': ['calves'],
        'crunch': ['core'],
        'plank': ['core'],
      };

      for (const ex of exercises) {
        const nameLower = ex.name.toLowerCase();
        for (const [keyword, muscles] of Object.entries(exerciseToMuscle)) {
          if (nameLower.includes(keyword)) {
            muscles.forEach(m => muscleGroupsSet.add(m));
          }
        }
      }

      const workout = await saveWorkout({
        user_id: userId,
        workout_date: new Date().toISOString().split('T')[0],
        name: workoutName,
        muscle_groups: Array.from(muscleGroupsSet),
        duration_minutes: durationMinutes,
        notes: '',
        total_volume_kg: Math.round(totalVolume),
        exercises: workoutExercises,
      });

      // --- DETECT AND SAVE PRs ---
      try {
        const newPRsDetected: any[] = [];
        for (const ex of exercises) {
          const workingSets = workoutExercises.filter(e => e.exercise_name === ex.name);
          if (workingSets.length === 0) continue;
          
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
            if (pr.is_pr) {
              const saved = await savePR({
                user_id: userId,
                exercise_name: pr.exercise_name,
                record_type: pr.record_type,
                value: pr.new_value,
                previous_value: pr.previous_value ?? undefined,
                improvement_pct: pr.improvement_pct ?? undefined,
                achieved_at: new Date().toISOString().split('T')[0],
                workout_id: workout.id
              });
              newPRsDetected.push(saved);
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
      try {
        const authStore = useAuthStore.getState();
        const currentUser = await getUser();
        
        if (currentUser) {
          // 1 XP per 100kg volume + 10 XP base for completion
          const xpEarned = Math.round(totalVolume / 100) + 10;
          await authStore.addXP(xpEarned);

          // Fetch updated stats to determine streak
          const stats = await getWorkoutStats();
          
          await saveUser({
            total_workouts: stats.totalWorkouts || 1,
            current_streak: stats.currentStreak || 1,
            highest_streak: stats.longestStreak || 1,
          });

          await authStore.checkBadges();
          // Refresh user state
          await authStore.loadUser();
        }
      } catch (gamificationError) {
        console.error('Gamification update failed in finishWorkout:', gamificationError);
      }

      // Reset state
      set({
        isActive: false,
        workoutName: '',
        startTime: null,
        exercises: [],
        restTimerRunning: false,
        restTimerSeconds: 0,
      });

      return workout;
    } catch (error) {
      console.error('Critical error in finishWorkout:', error);
      // Ensure we reset active state so the app doesn't freeze or stay stuck
      set({
        isActive: false,
        workoutName: '',
        startTime: null,
        exercises: [],
        restTimerRunning: false,
        restTimerSeconds: 0,
      });
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
    });
  },

  reorderExercise: (fromIndex: number, toIndex: number) => {
    const { exercises } = get();
    const updated = [...exercises];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    set({ exercises: updated });
  },
}));

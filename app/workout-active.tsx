// ═══════════════════════════════════════════════════════
// Active Workout Logger — Core Feature
// Full-screen workout logging with exercise cards,
// set tracking, rest timer, and auto-fill
// ═══════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../lib/theme';
import { useWorkoutStore } from '../stores/workoutStore';
import { useAuthStore } from '../stores/authStore';
import exerciseData from '../data/exercises.json';
import * as Haptics from 'expo-haptics';

export default function WorkoutActiveScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    isActive,
    workoutName,
    startTime,
    exercises,
    restTimerRunning,
    restTimerSeconds,
    restTimerDefault,
    setWorkoutName,
    addExercise,
    removeExercise,
    addSet,
    updateSet,
    removeSet,
    duplicateSet,
    toggleSetComplete,
    startRestTimer,
    stopRestTimer,
    finishWorkout,
    cancelWorkout,
  } = useWorkoutStore();

  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  // Update elapsed time
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsedTime(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimerRunning) {
      setRestTimeLeft(0);
      return;
    }
    setRestTimeLeft(restTimerSeconds);
    const interval = setInterval(() => {
      setRestTimeLeft(prev => {
        if (prev <= 1) {
          stopRestTimer();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [restTimerRunning, restTimerSeconds]);

  const handleFinish = () => {
    const completedSets = exercises.reduce((sum, ex) => 
      sum + ex.sets.filter(s => s.completed).length, 0);
    
    if (completedSets === 0) {
      Alert.alert('No Sets Completed', 'Complete at least one set before finishing.');
      return;
    }

    Alert.alert(
      'Finish Workout?',
      `${completedSets} set${completedSets > 1 ? 's' : ''} completed. Save this workout?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          style: 'default',
          onPress: async () => {
            if (user) {
              const workout = await finishWorkout(user.id);
              if (workout) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.replace('/(tabs)');
              }
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Workout?',
      'All unsaved progress will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            cancelWorkout();
            router.back();
          },
        },
      ]
    );
  };

  const handleAddExercise = async (exerciseName: string) => {
    await addExercise(exerciseName);
    setShowExerciseSearch(false);
    setSearchQuery('');
    // Scroll to bottom after adding
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  };

  const handleSetComplete = (exerciseIdx: number, setIdx: number) => {
    toggleSetComplete(exerciseIdx, setIdx);
    const set = exercises[exerciseIdx]?.sets[setIdx];
    if (set && !set.completed) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startRestTimer();
    }
  };

  // Filter exercises for search
  const filteredExercises = searchQuery.length > 0
    ? exerciseData.exercises.filter(ex => {
        const q = searchQuery.toLowerCase();
        return ex.name.toLowerCase().includes(q) ||
          ex.aliases.some(a => a.toLowerCase().includes(q)) ||
          ex.primary_muscles.some(m => m.toLowerCase().includes(q)) ||
          ex.equipment.toLowerCase().includes(q);
      })
    : exerciseData.exercises;

  // Group by muscle group for search display
  const groupedExercises = filteredExercises.reduce<Record<string, typeof filteredExercises>>((acc, ex) => {
    const group = ex.primary_muscles[0] || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(ex);
    return acc;
  }, {});

  if (!isActive) {
    router.back();
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={28} color={Colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <TextInput
            style={styles.workoutNameInput}
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="Workout Name"
            placeholderTextColor={Colors.text.tertiary}
          />
          <Text style={styles.timerText}>⏱ {elapsedTime}</Text>
        </View>

        <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
          <Text style={styles.finishButtonText}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* Rest Timer Banner */}
      {restTimerRunning && restTimeLeft > 0 && (
        <View style={styles.restTimerBanner}>
          <View style={styles.restTimerContent}>
            <Ionicons name="timer-outline" size={20} color="#fff" />
            <Text style={styles.restTimerText}>
              Rest: {Math.floor(restTimeLeft / 60)}:{(restTimeLeft % 60).toString().padStart(2, '0')}
            </Text>
          </View>
          <TouchableOpacity onPress={stopRestTimer}>
            <Text style={styles.restTimerSkip}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Exercise List */}
      <ScrollView
        ref={scrollRef}
        style={styles.exerciseList}
        contentContainerStyle={styles.exerciseListContent}
        showsVerticalScrollIndicator={false}
      >
        {exercises.map((exercise, exIdx) => (
          <View key={exIdx} style={styles.exerciseCard}>
            {/* Exercise Header */}
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Remove Exercise',
                    `Remove ${exercise.name}?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => removeExercise(exIdx),
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>

            {/* Previous performance hint */}
            {exercise.previousSets && exercise.previousSets.length > 0 && (
              <Text style={styles.previousHint}>
                Last: {exercise.previousSets.filter(s => !s.is_warmup)[0]?.weight_kg || 0}kg × {exercise.previousSets.filter(s => !s.is_warmup)[0]?.reps || 0} reps
              </Text>
            )}

            {/* Set Header */}
            <View style={styles.setHeader}>
              <Text style={[styles.setHeaderText, { width: 36 }]}>SET</Text>
              <Text style={[styles.setHeaderText, { flex: 1, textAlign: 'center' }]}>KG</Text>
              <Text style={[styles.setHeaderText, { flex: 1, textAlign: 'center' }]}>REPS</Text>
              <Text style={[styles.setHeaderText, { width: 44, textAlign: 'center' }]}>✓</Text>
            </View>

            {/* Sets */}
            {exercise.sets.map((set, setIdx) => (
              <View key={set.id} style={[styles.setRow, set.completed && styles.setRowCompleted]}>
                <Text style={[styles.setNumber, set.is_warmup && styles.warmupText]}>
                  {set.is_warmup ? 'W' : setIdx + 1}
                </Text>
                
                <TextInput
                  style={[styles.setInput, set.completed && styles.setInputCompleted]}
                  value={set.weight_kg > 0 ? set.weight_kg.toString() : ''}
                  onChangeText={t => updateSet(exIdx, setIdx, { weight_kg: parseFloat(t) || 0 })}
                  placeholder={exercise.previousSets?.filter(s => !s.is_warmup)[setIdx]?.weight_kg?.toString() || '0'}
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
                
                <TextInput
                  style={[styles.setInput, set.completed && styles.setInputCompleted]}
                  value={set.reps > 0 ? set.reps.toString() : ''}
                  onChangeText={t => updateSet(exIdx, setIdx, { reps: parseInt(t) || 0 })}
                  placeholder={exercise.previousSets?.filter(s => !s.is_warmup)[setIdx]?.reps?.toString() || '0'}
                  placeholderTextColor={Colors.text.tertiary}
                  keyboardType="numeric"
                  selectTextOnFocus
                />

                <TouchableOpacity
                  style={[styles.checkButton, set.completed && styles.checkButtonDone]}
                  onPress={() => handleSetComplete(exIdx, setIdx)}
                >
                  <Ionicons
                    name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={28}
                    color={set.completed ? Colors.status.success : Colors.text.tertiary}
                  />
                </TouchableOpacity>
              </View>
            ))}

            {/* Add Set Button */}
            <TouchableOpacity
              style={styles.addSetButton}
              onPress={() => addSet(exIdx)}
            >
              <Ionicons name="add" size={18} color={Colors.accent.red} />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add Exercise Button */}
        <TouchableOpacity
          style={styles.addExerciseButton}
          onPress={() => setShowExerciseSearch(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={24} color={Colors.accent.red} />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Exercise Search Modal */}
      <Modal
        visible={showExerciseSearch}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.searchModal}>
          {/* Search Header */}
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => { setShowExerciseSearch(false); setSearchQuery(''); }}>
              <Ionicons name="close-circle" size={28} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={18} color={Colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises, muscles, equipment..."
              placeholderTextColor={Colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close" size={18} color={Colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={Object.entries(groupedExercises)}
            keyExtractor={([group]) => group}
            renderItem={({ item: [group, exs] }) => (
              <View>
                <Text style={styles.searchGroupTitle}>
                  {group.charAt(0).toUpperCase() + group.slice(1).replace('_', ' ')}
                </Text>
                {exs.map(ex => (
                  <TouchableOpacity
                    key={ex.name}
                    style={styles.searchExerciseItem}
                    onPress={() => handleAddExercise(ex.name)}
                  >
                    <View style={styles.searchExerciseIcon}>
                      <Text style={styles.searchExerciseEmoji}>
                        {ex.equipment === 'barbell' ? '🏋️' :
                         ex.equipment === 'dumbbell' ? '💪' :
                         ex.equipment === 'cable' ? '🔗' :
                         ex.equipment === 'machine' ? '⚙️' :
                         ex.equipment === 'bodyweight' ? '🤸' : '⚡'}
                      </Text>
                    </View>
                    <View style={styles.searchExerciseInfo}>
                      <Text style={styles.searchExerciseName}>{ex.name}</Text>
                      <Text style={styles.searchExerciseMeta}>
                        {ex.equipment} • {ex.primary_muscles.join(', ')}
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={24} color={Colors.accent.red} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.md,
  },
  workoutNameInput: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    padding: 0,
  },
  timerText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  finishButton: {
    backgroundColor: Colors.accent.red,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },

  // Rest timer
  restTimerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.status.info,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  restTimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  restTimerText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  restTimerSkip: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },

  // Exercise list
  exerciseList: { flex: 1 },
  exerciseListContent: {
    padding: Spacing.lg,
  },

  // Exercise card
  exerciseCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  exerciseName: {
    color: Colors.accent.red,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  previousHint: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    marginBottom: Spacing.md,
    fontStyle: 'italic',
  },

  // Set header
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    marginBottom: Spacing.sm,
  },
  setHeaderText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },

  // Set row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    marginBottom: 2,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 4,
  },
  setRowCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  setNumber: {
    width: 36,
    color: Colors.text.secondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  warmupText: {
    color: Colors.status.warning,
  },
  setInput: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceHighlight,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: 4,
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  setInputCompleted: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    color: Colors.status.success,
  },
  checkButton: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonDone: {},

  // Add set
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  addSetText: {
    color: Colors.accent.red,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },

  // Add exercise button
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  addExerciseText: {
    color: Colors.accent.red,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },

  // Search modal
  searchModal: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  searchTitle: {
    color: Colors.text.primary,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSize.md,
    paddingVertical: Spacing.md,
  },
  searchGroupTitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchExerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  searchExerciseIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  searchExerciseEmoji: {
    fontSize: 18,
  },
  searchExerciseInfo: {
    flex: 1,
  },
  searchExerciseName: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  searchExerciseMeta: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
    textTransform: 'capitalize',
  },
});

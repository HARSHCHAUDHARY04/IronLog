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
  Platform,
} from 'react-native';
import { 
  X, Timer, Trash2, CheckCircle2, Circle, 
  Plus, PlusCircle, Search, XCircle, Dumbbell 
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, FadeInDown, Layout, ZoomIn } from 'react-native-reanimated';
import { useThemeColor, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../lib/theme';
import { useWorkoutStore } from '../stores/workoutStore';
import { useAuthStore } from '../stores/authStore';
import exerciseData from '../data/exercises.json';
import * as Haptics from 'expo-haptics';
import { getCustomExercises, saveCustomExercise } from '../lib/storage';

export default function WorkoutActiveScreen() {
  const { colors, text, accent, status, muscle, isDark } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle, isDark), [colors, text, accent, status, muscle, isDark]);

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

  // Custom Exercises State
  const [customExercises, setCustomExercises] = useState<any[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrimaryMuscle, setCustomPrimaryMuscle] = useState('chest');
  const [customEquipment, setCustomEquipment] = useState('dumbbell');

  // Plate Calculator State
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [activePlateExIdx, setActivePlateExIdx] = useState<number | null>(null);
  const [activePlateSetIdx, setActivePlateSetIdx] = useState<number | null>(null);
  const [plateTargetWeight, setPlateTargetWeight] = useState<string>('45');
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
      if (Platform.OS === 'web') {
        window.alert('No Sets Completed: Complete at least one set before finishing.');
        return;
      }
      Alert.alert('No Sets Completed', 'Complete at least one set before finishing.');
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm(`Finish Workout?\n${completedSets} set${completedSets > 1 ? 's' : ''} completed. Save this workout?`)) {
        if (user) {
          finishWorkout(user.id).then(workout => {
            if (workout) {
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch (hapticError) {
                console.warn('Haptics failed', hapticError);
              }
              router.replace('/(tabs)');
            }
          }).catch(err => {
            console.error('Failed to finish workout:', err);
            window.alert('Error: Failed to save workout. Please try again.');
          });
        }
      }
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
              try {
                const workout = await finishWorkout(user.id);
                if (workout) {
                  try {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  } catch (hapticError) {
                    console.warn('Haptics failed', hapticError);
                  }
                  router.replace('/(tabs)');
                }
              } catch (err) {
                console.error('Failed to finish workout:', err);
                Alert.alert('Error', 'Failed to save workout. Please try again.');
              }
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Cancel Workout?\nAll unsaved progress will be lost.')) {
        cancelWorkout();
        router.back();
      }
      return;
    }

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

  // Load custom exercises
  const loadCustomExercises = async () => {
    const loaded = await getCustomExercises();
    setCustomExercises(loaded);
  };

  useEffect(() => {
    if (showExerciseSearch) {
      loadCustomExercises();
    }
  }, [showExerciseSearch]);

  const allExercises = React.useMemo(() => {
    const normalizedCustom = customExercises.map(ex => ({
      ...ex,
      aliases: ex.aliases || [],
      secondary_muscles: ex.secondary_muscles || [],
      movement_pattern: ex.movement_pattern || '',
      difficulty: ex.difficulty || 'intermediate',
      instructions: ex.instructions || '',
      common_mistakes: ex.common_mistakes || [],
    }));
    return [...normalizedCustom, ...exerciseData.exercises];
  }, [customExercises]);

  const filteredExercises = searchQuery.length > 0
    ? allExercises.filter(ex => {
        const q = searchQuery.toLowerCase();
        return ex.name.toLowerCase().includes(q) ||
          (ex.aliases && ex.aliases.some((a: string) => a.toLowerCase().includes(q))) ||
          (ex.primary_muscles && ex.primary_muscles.some((m: string) => m.toLowerCase().includes(q))) ||
          (ex.equipment && ex.equipment.toLowerCase().includes(q));
      })
    : allExercises;

  const groupedExercises = filteredExercises.reduce<Record<string, typeof filteredExercises>>((acc, ex) => {
    const group = ex.primary_muscles[0] || 'other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(ex);
    return acc;
  }, {});

  // Custom Exercise handler
  const handleSaveCustomExercise = async () => {
    if (!customName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Please enter an exercise name.');
      } else {
        Alert.alert('Error', 'Please enter an exercise name.');
      }
      return;
    }

    try {
      const newEx = await saveCustomExercise({
        name: customName.trim(),
        aliases: [],
        primary_muscles: [customPrimaryMuscle],
        secondary_muscles: [],
        equipment: customEquipment,
        movement_pattern: 'custom',
        difficulty: 'intermediate',
        instructions: 'Custom user exercise.',
        common_mistakes: []
      });

      setShowCustomModal(false);
      setShowExerciseSearch(false);
      setSearchQuery('');
      setCustomName('');
      
      await handleAddExercise(newEx.name);
    } catch (error) {
      console.error('Failed to save custom exercise:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to save exercise.');
      } else {
        Alert.alert('Error', 'Failed to save exercise.');
      }
    }
  };

  // Plate Calculator Open
  const openPlateCalculator = (exIdx: number, setIdx: number, currentWeight: number) => {
    setActivePlateExIdx(exIdx);
    setActivePlateSetIdx(setIdx);
    setPlateTargetWeight(currentWeight > 0 ? currentWeight.toString() : '45');
    setShowPlateCalc(true);
  };

  // Barbell Plates calculation logic
  const AVAILABLE_PLATES = [
    { weight: 25, color: '#DC2626', label: '25' },
    { weight: 20, color: '#2563EB', label: '20' },
    { weight: 15, color: '#EAB308', label: '15' },
    { weight: 10, color: '#16A34A', label: '10' },
    { weight: 5, color: '#F3F4F6', textColor: '#1F2937', label: '5' },
    { weight: 2.5, color: '#4B5563', label: '2.5' },
    { weight: 1.25, color: '#9333EA', label: '1.25' }
  ];

  const calculatedPlatesList = React.useMemo(() => {
    const target = parseFloat(plateTargetWeight) || 0;
    const barWeight = 20;
    if (target <= barWeight) return [];
    
    let remainingSide = (target - barWeight) / 2;
    const result: typeof AVAILABLE_PLATES = [];
    
    for (const plate of AVAILABLE_PLATES) {
      while (remainingSide >= plate.weight) {
        result.push(plate);
        remainingSide -= plate.weight;
      }
    }
    return result;
  }, [plateTargetWeight]);

  const handleApplyPlateWeight = () => {
    if (activePlateExIdx !== null && activePlateSetIdx !== null) {
      const weight = parseFloat(plateTargetWeight) || 0;
      updateSet(activePlateExIdx, activePlateSetIdx, { weight_kg: weight });
      setShowPlateCalc(false);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (_) {}
    }
  };

  useEffect(() => {
    if (!isActive) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/workout');
      }
    }
  }, [isActive, router]);

  if (!isActive) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={28} color={text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <TextInput
            style={styles.workoutNameInput}
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="Workout Name"
            placeholderTextColor={text.tertiary}
          />
          <Text style={styles.timerText}>{elapsedTime}</Text>
        </View>

        <TouchableOpacity style={styles.finishButton} onPress={handleFinish} activeOpacity={0.8}>
          <Text style={styles.finishButtonText}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* Rest Timer Banner */}
      {restTimerRunning && restTimeLeft > 0 && (
        <Animated.View entering={FadeInUp.springify()} style={styles.restTimerBanner}>
          <View style={styles.restTimerContent}>
            <Timer size={20} color="#fff" />
            <Text style={styles.restTimerText}>
              Rest: {Math.floor(restTimeLeft / 60)}:{(restTimeLeft % 60).toString().padStart(2, '0')}
            </Text>
          </View>
          <TouchableOpacity onPress={stopRestTimer}>
            <Text style={styles.restTimerSkip}>Skip</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Exercise List */}
      <ScrollView
        ref={scrollRef}
        style={styles.exerciseList}
        contentContainerStyle={styles.exerciseListContent}
        showsVerticalScrollIndicator={false}
      >
        {exercises.map((exercise, exIdx) => (
          <Animated.View key={exIdx} layout={Layout.springify()}>
            <Animated.View 
              entering={FadeInDown.delay(exIdx * 100).springify()}
              style={styles.exerciseCard}
            >
              {/* Exercise Header */}
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <TouchableOpacity
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      if (window.confirm(`Remove ${exercise.name}?`)) {
                        removeExercise(exIdx);
                      }
                      return;
                    }
                    Alert.alert(
                      'Remove Exercise',
                      `Remove ${exercise.name}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => removeExercise(exIdx) },
                      ]
                    );
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 size={20} color={text.tertiary} />
                </TouchableOpacity>
              </View>

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
                <Animated.View key={set.id} layout={Layout.springify()}>
                  <Animated.View 
                    entering={ZoomIn.springify()}
                    style={[styles.setRow, set.completed && styles.setRowCompleted]}
                  >
                    <Text style={[styles.setNumber, set.is_warmup && styles.warmupText]}>
                      {set.is_warmup ? 'W' : setIdx + 1}
                    </Text>
                    
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: 4, position: 'relative' }}>
                      <TextInput
                        style={[styles.setInput, { flex: 1, marginHorizontal: 0 }, !set.completed && { paddingRight: 24 }, set.completed && styles.setInputCompleted]}
                        value={set.weight_kg > 0 ? set.weight_kg.toString() : ''}
                        onChangeText={t => updateSet(exIdx, setIdx, { weight_kg: parseFloat(t) || 0 })}
                        placeholder={exercise.previousSets?.filter(s => !s.is_warmup)[setIdx]?.weight_kg?.toString() || '-'}
                        placeholderTextColor={text.tertiary}
                        keyboardType="numeric"
                        selectTextOnFocus
                        editable={!set.completed}
                      />
                      {!set.completed && (
                        <TouchableOpacity
                          style={{ position: 'absolute', right: 8, padding: 4 }}
                          onPress={() => openPlateCalculator(exIdx, setIdx, set.weight_kg)}
                        >
                          <Dumbbell size={14} color={accent.red} />
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    <TextInput
                      style={[styles.setInput, set.completed && styles.setInputCompleted]}
                      value={set.reps > 0 ? set.reps.toString() : ''}
                      onChangeText={t => updateSet(exIdx, setIdx, { reps: parseInt(t) || 0 })}
                      placeholder={exercise.previousSets?.filter(s => !s.is_warmup)[setIdx]?.reps?.toString() || '-'}
                      placeholderTextColor={text.tertiary}
                      keyboardType="numeric"
                      selectTextOnFocus
                      editable={!set.completed}
                    />

                    <TouchableOpacity
                      style={[styles.checkButton, set.completed && styles.checkButtonDone]}
                      onPress={() => handleSetComplete(exIdx, setIdx)}
                      activeOpacity={0.7}
                    >
                      {set.completed ? (
                        <CheckCircle2 size={28} color={status.success} />
                      ) : (
                        <Circle size={28} color={text.tertiary} />
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              ))}

              {/* Add Set Button */}
              <TouchableOpacity
                style={styles.addSetButton}
                onPress={() => addSet(exIdx)}
              >
                <Plus size={16} color={accent.red} />
                <Text style={styles.addSetText}>Add Set</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        ))}

        {/* Add Exercise Button */}
        <TouchableOpacity
          style={styles.addExerciseButton}
          onPress={() => setShowExerciseSearch(true)}
          activeOpacity={0.8}
        >
          <PlusCircle size={24} color={accent.red} />
          <Text style={styles.addExerciseText}>Add Exercise</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Exercise Search Modal */}
      <Modal
        visible={showExerciseSearch}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.searchModal}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => { setShowExerciseSearch(false); setSearchQuery(''); }}>
              <XCircle size={28} color={text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchInputContainer}>
            <Search size={18} color={text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises, muscles, equipment..."
              placeholderTextColor={text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={18} color={text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={Object.entries(groupedExercises)}
            keyExtractor={([group]) => group}
            ListHeaderComponent={() => (
              <TouchableOpacity
                style={[styles.searchExerciseItem, { borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 8, backgroundColor: colors.surfaceHighlight }]}
                onPress={() => {
                  setCustomName(searchQuery);
                  setShowCustomModal(true);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.searchExerciseIcon}>
                  <Plus size={20} color={accent.red} />
                </View>
                <View style={styles.searchExerciseInfo}>
                  <Text style={[styles.searchExerciseName, { color: text.primary }]}>Create Custom Exercise</Text>
                  <Text style={styles.searchExerciseMeta}>Add your own exercises completely offline</Text>
                </View>
                <PlusCircle size={24} color={accent.red} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={{ padding: Spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
                <Dumbbell size={48} color={text.tertiary} style={{ marginBottom: 16 }} />
                <Text style={{ color: text.secondary, fontSize: FontSize.md, fontWeight: FontWeight.bold, marginBottom: 8 }}>
                  No exercises found
                </Text>
                <Text style={{ color: text.tertiary, fontSize: FontSize.sm, textAlign: 'center', marginBottom: 20 }}>
                  "{searchQuery}" isn't in our library.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: accent.red, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md }}
                  onPress={() => {
                    setCustomName(searchQuery);
                    setShowCustomModal(true);
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: FontWeight.bold }}>Create "{searchQuery}" Custom Exercise</Text>
                </TouchableOpacity>
              </View>
            )}
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
                    activeOpacity={0.7}
                  >
                    <View style={styles.searchExerciseIcon}>
                      <Dumbbell size={20} color={text.secondary} />
                    </View>
                    <View style={styles.searchExerciseInfo}>
                      <Text style={styles.searchExerciseName}>{ex.name}</Text>
                      <Text style={styles.searchExerciseMeta}>
                        {ex.equipment} • {ex.primary_muscles.join(', ')}
                      </Text>
                    </View>
                    <PlusCircle size={24} color={accent.red} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </Modal>

      {/* Custom Exercise Creator Modal */}
      <Modal
        visible={showCustomModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.searchModal}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>Create Custom Exercise</Text>
            <TouchableOpacity onPress={() => setShowCustomModal(false)}>
              <XCircle size={28} color={text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: text.secondary, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Exercise Name</Text>
            <TextInput
              style={[styles.searchInput, { marginHorizontal: 0, paddingHorizontal: 12, marginBottom: 20 }]}
              placeholder="e.g. Incline DB Flyes"
              placeholderTextColor={text.tertiary}
              value={customName}
              onChangeText={setCustomName}
            />

            <Text style={{ color: text.secondary, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>Primary Muscle Group</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {[
                { value: 'chest', label: 'Chest' },
                { value: 'back', label: 'Back' },
                { value: 'shoulders', label: 'Shoulders' },
                { value: 'quadriceps', label: 'Quads' },
                { value: 'hamstrings', label: 'Hamstrings' },
                { value: 'biceps', label: 'Biceps' },
                { value: 'triceps', label: 'Triceps' },
                { value: 'core', label: 'Core' },
                { value: 'glutes', label: 'Glutes' },
                { value: 'calves', label: 'Calves' }
              ].map(item => {
                const isSelected = customPrimaryMuscle === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 20,
                      backgroundColor: isSelected ? accent.red : colors.surfaceHighlight,
                      borderWidth: 1,
                      borderColor: isSelected ? accent.red : colors.border
                    }}
                    onPress={() => setCustomPrimaryMuscle(item.value)}
                  >
                    <Text style={{ color: isSelected ? '#FFFFFF' : text.secondary, fontWeight: '600', fontSize: 13 }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ color: text.secondary, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>Equipment Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 30 }}>
              {[
                { value: 'barbell', label: 'Barbell' },
                { value: 'dumbbell', label: 'Dumbbell' },
                { value: 'machine', label: 'Machine' },
                { value: 'cable', label: 'Cable' },
                { value: 'bodyweight', label: 'Bodyweight' },
                { value: 'other', label: 'Other' }
              ].map(item => {
                const isSelected = customEquipment === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 16,
                      borderRadius: 20,
                      backgroundColor: isSelected ? accent.red : colors.surfaceHighlight,
                      borderWidth: 1,
                      borderColor: isSelected ? accent.red : colors.border
                    }}
                    onPress={() => setCustomEquipment(item.value)}
                  >
                    <Text style={{ color: isSelected ? '#FFFFFF' : text.secondary, fontWeight: '600', fontSize: 13 }}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: accent.red,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: accent.red,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 4
              }}
              onPress={handleSaveCustomExercise}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Create and Add Exercise</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Barbell Plate Calculator Modal */}
      <Modal
        visible={showPlateCalc}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.searchModal}>
          <View style={styles.searchHeader}>
            <Text style={styles.searchTitle}>Plate Calculator</Text>
            <TouchableOpacity onPress={() => setShowPlateCalc(false)}>
              <XCircle size={28} color={text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: text.secondary, fontSize: 14, fontWeight: '600', marginBottom: 8, textAlign: 'center' }}>
              Target Weight (KG)
            </Text>
            <TextInput
              style={[styles.searchInput, { marginHorizontal: 30, paddingHorizontal: 12, marginBottom: 20, textAlign: 'center', fontSize: 24, height: 50, fontWeight: 'bold' }]}
              placeholder="e.g. 82.5"
              placeholderTextColor={text.tertiary}
              value={plateTargetWeight}
              onChangeText={setPlateTargetWeight}
              keyboardType="numeric"
              selectTextOnFocus
            />

            {/* Visual Barbell */}
            <View style={{ 
              height: 180, 
              backgroundColor: colors.surfaceHighlight, 
              borderRadius: 16, 
              alignItems: 'center', 
              justifyContent: 'center', 
              marginBottom: 20,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border
            }}>
              {/* Sleeve shaft and plates container */}
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
                {/* Barbell collar / hub */}
                <View style={{ width: 14, height: 130, backgroundColor: '#6B7280', borderRadius: 3 }} />
                
                {/* Plate Stopper/Collar Ring */}
                <View style={{ width: 8, height: 90, backgroundColor: '#374151', marginRight: 4, borderRadius: 2 }} />

                {/* Plates area along the sleeve (which is a gray line in background) */}
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  minWidth: 160, 
                  height: 30, 
                  justifyContent: 'flex-start',
                  position: 'relative'
                }}>
                  {/* Sleeve steel line behind */}
                  <View style={{ 
                    position: 'absolute', 
                    top: 11, 
                    left: 0, 
                    right: 0, 
                    height: 8, 
                    backgroundColor: '#9CA3AF', 
                    borderRadius: 4 
                  }} />

                  {/* Render the plates side-by-side */}
                  {calculatedPlatesList.map((plate, index) => {
                    let pHeight = 45;
                    let pWidth = 8;
                    if (plate.weight === 25) { pHeight = 120; pWidth = 18; }
                    else if (plate.weight === 20) { pHeight = 110; pWidth = 18; }
                    else if (plate.weight === 15) { pHeight = 100; pWidth = 18; }
                    else if (plate.weight === 10) { pHeight = 90; pWidth = 15; }
                    else if (plate.weight === 5) { pHeight = 75; pWidth = 12; }
                    else if (plate.weight === 2.5) { pHeight = 60; pWidth = 10; }

                    return (
                      <View
                        key={index}
                        style={{
                          width: pWidth,
                          height: pHeight,
                          backgroundColor: plate.color,
                          borderRadius: 4,
                          marginHorizontal: 1,
                          borderWidth: 1,
                          borderColor: '#111827',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 10
                        }}
                      >
                        <Text style={{ 
                          color: plate.weight === 5 ? '#1F2937' : '#FFFFFF', 
                          fontSize: plate.weight < 5 ? 7 : 9, 
                          fontWeight: 'bold',
                          transform: [{ rotate: '90deg' }]
                        }}>
                          {plate.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Steel sleeve end cap */}
                <View style={{ width: 6, height: 16, backgroundColor: '#D1D5DB', borderTopRightRadius: 2, borderBottomRightRadius: 2 }} />
              </View>
            </View>

            <Text style={{ color: text.secondary, textAlign: 'center', fontSize: 14, marginBottom: 20, fontWeight: '500' }}>
              {parseFloat(plateTargetWeight) <= 20 ? (
                "Empty 20kg Barbell"
              ) : (
                `20kg Bar + ${calculatedPlatesList.map(p => `${p.label}kg`).join(' + ')} on each side`
              )}
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              {[
                { label: '-10kg', val: -10 },
                { label: '-2.5kg', val: -2.5 },
                { label: '+2.5kg', val: 2.5 },
                { label: '+10kg', val: 10 },
                { label: '+20kg', val: 20 }
              ].map(btn => (
                <TouchableOpacity
                  key={btn.label}
                  style={{
                    backgroundColor: colors.surfaceHighlight,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                  onPress={() => {
                    const current = parseFloat(plateTargetWeight) || 0;
                    const next = Math.max(20, current + btn.val);
                    setPlateTargetWeight(next.toString());
                  }}
                >
                  <Text style={{ color: text.secondary, fontWeight: '600', fontSize: 13 }}>{btn.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: accent.red,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: accent.red,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 4,
                marginBottom: 40
              }}
              onPress={handleApplyPlateWeight}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Apply to Set</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, text: any, accent: any, status: any, muscle: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: Spacing.md,
  },
  workoutNameInput: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    padding: 0,
  },
  timerText: {
    color: accent.red,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  finishButton: {
    backgroundColor: accent.red,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
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
    backgroundColor: status.info,
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
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  restTimerSkip: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },

  // Exercise list
  exerciseList: { flex: 1 },
  exerciseListContent: {
    padding: Spacing.lg,
  },

  // Exercise card
  exerciseCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  exerciseName: {
    color: accent.red,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    flex: 1,
  },
  previousHint: {
    color: text.tertiary,
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
    borderBottomColor: colors.border,
    marginBottom: Spacing.sm,
  },
  setHeaderText: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },

  // Set row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    marginBottom: 4,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 4,
  },
  setRowCompleted: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.05)',
  },
  setNumber: {
    width: 36,
    color: text.secondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },
  warmupText: {
    color: status.warning,
  },
  setInput: {
    flex: 1,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginHorizontal: 4,
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  setInputCompleted: {
    backgroundColor: 'transparent',
    color: status.success,
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
    marginTop: Spacing.md,
    gap: Spacing.xs,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: BorderRadius.md,
  },
  addSetText: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Add exercise button
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: accent.red,
    borderStyle: 'dashed',
    marginBottom: Spacing.lg,
  },
  addExerciseText: {
    color: accent.red,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },

  // Search modal
  searchModal: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: text.primary,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: text.primary,
    fontSize: FontSize.md,
    paddingVertical: Spacing.md,
  },
  searchGroupTitle: {
    color: text.secondary,
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
    borderBottomColor: colors.border,
  },
  searchExerciseIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  searchExerciseInfo: {
    flex: 1,
  },
  searchExerciseName: {
    color: text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  searchExerciseMeta: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
    textTransform: 'capitalize',
    fontWeight: FontWeight.medium,
  },
});

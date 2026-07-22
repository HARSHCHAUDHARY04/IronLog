// ═══════════════════════════════════════════════════════
// Workout Tab — Template selection & quick start
// ═══════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Colors, useThemeColor, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../lib/theme';
import { useWorkoutStore } from '../../stores/workoutStore';
import { getTemplates, WorkoutTemplate, getWorkouts, Workout, deleteTemplate, saveTemplate } from '../../lib/storage';
import { LinearGradient } from 'expo-linear-gradient';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import exerciseLibrary from '../../data/exercises.json';

export default function WorkoutTab() {
  const { colors, text, accent, status, muscle } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);

  const router = useRouter();
  const { startWorkout, startFromTemplate, isActive } = useWorkoutStore();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Custom Template Creation State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>(['chest']);
  const [newExercises, setNewExercises] = useState<{ name: string; sets: number; reps: number }[]>([
    { name: 'Barbell Bench Press', sets: 4, reps: 8 },
  ]);
  const [showExPicker, setShowExPicker] = useState(false);
  const [exSearch, setExSearch] = useState('');

  // AI Workout Generator State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiGoal, setAiGoal] = useState('hypertrophy');
  const [aiEquipment, setAiEquipment] = useState('full gym');
  const [aiDuration, setAiDuration] = useState('45');
  const [generatingAI, setGeneratingAI] = useState(false);

  const loadData = useCallback(async () => {
    const [tmpl, workouts] = await Promise.all([getTemplates(), getWorkouts()]);
    setTemplates(tmpl);
    const seen = new Set<string>();
    const unique = workouts.filter(w => {
      if (seen.has(w.name)) return false;
      seen.add(w.name);
      return true;
    }).slice(0, 5);
    setRecentWorkouts(unique);
  }, []);

  const handleSaveCustomTemplate = async () => {
    if (!newTemplateName.trim()) {
      if (Platform.OS === 'web') window.alert('Please enter a template name.');
      else Alert.alert('Error', 'Please enter a template name.');
      return;
    }
    if (newExercises.length === 0) {
      if (Platform.OS === 'web') window.alert('Please add at least one exercise.');
      else Alert.alert('Error', 'Please add at least one exercise.');
      return;
    }

    try {
      await saveTemplate({
        name: newTemplateName.trim(),
        muscle_groups: selectedMuscles,
        exercises: newExercises,
        is_default: false,
      });

      setShowCreateModal(false);
      setNewTemplateName('');
      setNewExercises([{ name: 'Barbell Bench Press', sets: 4, reps: 8 }]);
      await loadData();
      if (Platform.OS === 'web') window.alert(`Created template "${newTemplateName}"!`);
      else Alert.alert('Success', `Custom template "${newTemplateName}" created!`);
    } catch (e) {
      console.error('Failed to create custom template:', e);
    }
  };

  const handleGenerateAISmartWorkout = async () => {
    setGeneratingAI(true);
    try {
      const { generateSmartWorkout } = require('../../lib/gemini');
      const generated = await generateSmartWorkout(
        aiGoal,
        aiEquipment,
        parseInt(aiDuration) || 45
      );

      await saveTemplate({
        name: generated.name,
        muscle_groups: generated.muscle_groups,
        exercises: generated.exercises,
        is_default: false,
      });

      setShowAIModal(false);
      await loadData();
      if (Platform.OS === 'web') window.alert(`Generated "${generated.name}" template!`);
      else Alert.alert('AI Workout Ready', `Created AI template "${generated.name}"!`);
    } catch (err) {
      console.error('AI Workout generation failed:', err);
      if (Platform.OS === 'web') window.alert('Failed to generate AI workout. Please try again.');
      else Alert.alert('Error', 'Failed to generate AI workout. Please try again.');
    } finally {
      setGeneratingAI(false);
    }
  };

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleStartEmpty = () => {
    startWorkout();
    router.push('/workout-active');
  };

  const handleStartTemplate = async (template: WorkoutTemplate) => {
    await startFromTemplate(template.name, template.exercises);
    router.push('/workout-active');
  };

  const handleRepeatWorkout = async (workout: Workout) => {
    const templateExercises = [...new Set(workout.exercises.map(e => e.exercise_name))].map(name => {
      const sets = workout.exercises.filter(e => e.exercise_name === name && !e.is_warmup);
      return {
        name,
        sets: sets.length || 3,
        reps: sets[0]?.reps || 8,
      };
    });
    await startFromTemplate(workout.name, templateExercises);
    router.push('/workout-active');
  };

  const handleDeleteTemplate = (id: string) => {
    Alert.alert(
      "Delete Custom Template",
      "Are you sure you want to permanently delete this custom workout template?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            await deleteTemplate(id);
            await loadData();
          } 
        }
      ]
    );
  };

  const filteredTemplates = searchQuery
    ? templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.muscle_groups.some(mg => mg.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : templates;

  const muscleGroupIcons: Record<string, string> = {
    chest: '💪',
    back: '🔙',
    shoulders: '🏋️',
    quadriceps: '🦵',
    hamstrings: '🦵',
    glutes: '🍑',
    biceps: '💪',
    triceps: '💪',
    core: '🎯',
    arms: '💪',
    calves: '🦶',
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Workout</Text>

        {/* Continue Active Workout */}
        {isActive && (
          <TouchableOpacity
            style={styles.continueCard}
            onPress={() => router.push('/workout-active')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#FF4444', '#CC2222']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueGradient}
            >
              <Ionicons name="play-circle" size={28} color="#fff" />
              <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                <Text style={styles.continueLabel}>Continue Workout</Text>
                <Text style={styles.continueSubtext}>You have an active session</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Action Row: Custom Template & AI Generator */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: Spacing.xl }}>
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.xl,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.8}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent.redGlow, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Ionicons name="create-outline" size={20} color={accent.red} />
            </View>
            <Text style={{ color: text.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold, textAlign: 'center' }}>
              Custom Routine
            </Text>
            <Text style={{ color: text.tertiary, fontSize: 11, marginTop: 2, textAlign: 'center' }}>
              Build your own
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.xl,
              padding: Spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => setShowAIModal(true)}
            activeOpacity={0.8}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(147, 51, 234, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              <Ionicons name="sparkles-outline" size={20} color="#9333EA" />
            </View>
            <Text style={{ color: text.primary, fontSize: FontSize.sm, fontWeight: FontWeight.bold, textAlign: 'center' }}>
              AI Generator
            </Text>
            <Text style={{ color: text.tertiary, fontSize: 11, marginTop: 2, textAlign: 'center' }}>
              Auto-generate
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search templates..."
            placeholderTextColor={text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Templates Section */}
        <Text style={styles.sectionTitle}>Workout Templates</Text>
        {filteredTemplates.map((template) => {
          const Card = (
            <TouchableOpacity
              style={[styles.templateCard, !template.is_default && { marginBottom: 0 }]}
              onPress={() => handleStartTemplate(template)}
              activeOpacity={0.8}
            >
              <View style={styles.templateIcon}>
                <Text style={styles.templateEmoji}>
                  {muscleGroupIcons[template.muscle_groups[0]] || '⚡'}
                </Text>
              </View>
              <View style={styles.templateInfo}>
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateMuscles}>
                  {template.muscle_groups.map(mg => mg.charAt(0).toUpperCase() + mg.slice(1)).join(' • ')}
                </Text>
                <Text style={styles.templateExCount}>
                  {template.exercises.length} exercises • {template.exercises.reduce((sum, e) => sum + e.sets, 0)} sets
                </Text>
              </View>
              <Ionicons name="play-circle-outline" size={28} color={accent.red} />
            </TouchableOpacity>
          );

          if (template.is_default) {
            return <View key={template.id}>{Card}</View>;
          }

          return (
            <Swipeable
              key={template.id}
              renderRightActions={() => (
                <TouchableOpacity
                  style={{
                    backgroundColor: accent.red,
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: 70,
                    borderRadius: BorderRadius.lg,
                    marginBottom: Spacing.sm,
                    marginLeft: Spacing.sm,
                  }}
                  onPress={() => handleDeleteTemplate(template.id)}
                >
                  <Ionicons name="trash" size={22} color="#fff" />
                </TouchableOpacity>
              )}
              containerStyle={{ marginBottom: Spacing.sm }}
            >
              {Card}
            </Swipeable>
          );
        })}

        {/* Recent Workouts */}
        {recentWorkouts.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Repeat Recent</Text>
            {recentWorkouts.map((workout, idx) => (
              <TouchableOpacity
                key={workout.id}
                style={styles.recentCard}
                onPress={() => handleRepeatWorkout(workout)}
                activeOpacity={0.8}
              >
                <View style={styles.recentInfo}>
                  <Text style={styles.recentName}>{workout.name}</Text>
                  <Text style={styles.recentMeta}>
                    {new Date(workout.workout_date).toLocaleDateString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                    })} • {workout.duration_minutes}min • {workout.total_volume_kg}kg
                  </Text>
                </View>
                <Ionicons name="refresh-outline" size={22} color={text.tertiary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Create Custom Routine Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: text.primary, fontSize: FontSize.xl, fontWeight: FontWeight.bold }}>Build Custom Routine</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={26} color={text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Routine Name */}
            <Text style={{ color: text.secondary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 }}>Routine Name</Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderRadius: BorderRadius.md,
                padding: Spacing.md,
                color: text.primary,
                fontSize: FontSize.md,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
              }}
              placeholder="e.g. Upper Body Strength"
              placeholderTextColor={text.tertiary}
              value={newTemplateName}
              onChangeText={setNewTemplateName}
            />

            {/* Target Muscle Groups */}
            <Text style={{ color: text.secondary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 }}>Target Muscle Groups</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {['chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'core', 'full body'].map(m => {
                const selected = selectedMuscles.includes(m);
                return (
                  <TouchableOpacity
                    key={m}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                      backgroundColor: selected ? accent.red : colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? accent.red : colors.border,
                    }}
                    onPress={() => {
                      if (selected) {
                        if (selectedMuscles.length > 1) setSelectedMuscles(selectedMuscles.filter(x => x !== m));
                      } else {
                        setSelectedMuscles([...selectedMuscles, m]);
                      }
                    }}
                  >
                    <Text style={{ color: selected ? '#FFF' : text.secondary, fontSize: 12, fontWeight: 'bold' }}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Exercises List */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: text.secondary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>Exercises ({newExercises.length})</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                onPress={() => setShowExPicker(true)}
              >
                <Ionicons name="add-circle-outline" size={18} color={accent.red} />
                <Text style={{ color: accent.red, fontSize: 13, fontWeight: 'bold' }}>Add Exercise</Text>
              </TouchableOpacity>
            </View>

            {newExercises.map((ex, idx) => (
              <View
                key={idx}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: BorderRadius.lg,
                  padding: 14,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 14, marginBottom: 6 }}>{ex.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: text.tertiary, fontSize: 12 }}>Sets:</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surfaceHighlight,
                          color: text.primary,
                          fontSize: 13,
                          fontWeight: 'bold',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          width: 40,
                          textAlign: 'center',
                        }}
                        keyboardType="numeric"
                        value={ex.sets.toString()}
                        onChangeText={t => {
                          const val = parseInt(t) || 1;
                          const updated = [...newExercises];
                          updated[idx].sets = val;
                          setNewExercises(updated);
                        }}
                      />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: text.tertiary, fontSize: 12 }}>Target Reps:</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surfaceHighlight,
                          color: text.primary,
                          fontSize: 13,
                          fontWeight: 'bold',
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          width: 44,
                          textAlign: 'center',
                        }}
                        keyboardType="numeric"
                        value={ex.reps.toString()}
                        onChangeText={t => {
                          const val = parseInt(t) || 1;
                          const updated = [...newExercises];
                          updated[idx].reps = val;
                          setNewExercises(updated);
                        }}
                      />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setNewExercises(newExercises.filter((_, i) => i !== idx));
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={text.tertiary} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={{
                backgroundColor: accent.red,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 20,
                marginBottom: 30,
              }}
              onPress={handleSaveCustomTemplate}
            >
              <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>Save Custom Routine</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Exercise Picker Modal inside Template Builder */}
      <Modal
        visible={showExPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExPicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: text.primary, fontSize: FontSize.lg, fontWeight: FontWeight.bold }}>Select Exercise</Text>
            <TouchableOpacity onPress={() => setShowExPicker(false)}>
              <Ionicons name="close" size={24} color={text.secondary} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={{
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.md,
              padding: Spacing.md,
              color: text.primary,
              fontSize: FontSize.md,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: 16,
            }}
            placeholder="Search exercise..."
            placeholderTextColor={text.tertiary}
            value={exSearch}
            onChangeText={setExSearch}
          />

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {exerciseLibrary.exercises
              .filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase()))
              .map((e, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={{
                    backgroundColor: colors.surface,
                    padding: 14,
                    borderRadius: BorderRadius.md,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={() => {
                    setNewExercises([...newExercises, { name: e.name, sets: 3, reps: 10 }]);
                    setShowExPicker(false);
                    setExSearch('');
                  }}
                >
                  <View>
                    <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 14 }}>{e.name}</Text>
                    <Text style={{ color: text.tertiary, fontSize: 12, marginTop: 2 }}>
                      {e.primary_muscles.join(', ')} • {e.equipment}
                    </Text>
                  </View>
                  <Ionicons name="add" size={20} color={accent.red} />
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>
      </Modal>

      {/* AI Smart Generator Modal */}
      <Modal
        visible={showAIModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAIModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles" size={22} color="#9333EA" />
              <Text style={{ color: text.primary, fontSize: FontSize.xl, fontWeight: FontWeight.bold }}>AI Routine Generator</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAIModal(false)}>
              <Ionicons name="close" size={26} color={text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Goal */}
            <Text style={{ color: text.secondary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 }}>Training Goal</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {['Hypertrophy', 'Strength', 'Endurance', 'Fat Loss'].map(g => {
                const selected = aiGoal.toLowerCase() === g.toLowerCase();
                return (
                  <TouchableOpacity
                    key={g}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: selected ? '#9333EA' : colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? '#9333EA' : colors.border,
                    }}
                    onPress={() => setAiGoal(g.toLowerCase())}
                  >
                    <Text style={{ color: selected ? '#FFF' : text.primary, fontWeight: 'bold', fontSize: 13 }}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Equipment */}
            <Text style={{ color: text.secondary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 }}>Available Equipment</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {['Full Gym', 'Dumbbells Only', 'Barbell & Rack', 'Bodyweight'].map(eq => {
                const selected = aiEquipment.toLowerCase() === eq.toLowerCase();
                return (
                  <TouchableOpacity
                    key={eq}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: selected ? '#9333EA' : colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? '#9333EA' : colors.border,
                    }}
                    onPress={() => setAiEquipment(eq.toLowerCase())}
                  >
                    <Text style={{ color: selected ? '#FFF' : text.primary, fontWeight: 'bold', fontSize: 13 }}>{eq}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duration */}
            <Text style={{ color: text.secondary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 }}>Target Duration</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 30 }}>
              {['30', '45', '60', '90'].map(d => {
                const selected = aiDuration === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: selected ? '#9333EA' : colors.surface,
                      borderWidth: 1,
                      borderColor: selected ? '#9333EA' : colors.border,
                      alignItems: 'center',
                    }}
                    onPress={() => setAiDuration(d)}
                  >
                    <Text style={{ color: selected ? '#FFF' : text.primary, fontWeight: 'bold', fontSize: 14 }}>{d} min</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: '#9333EA',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
              onPress={handleGenerateAISmartWorkout}
              disabled={generatingAI}
            >
              {generatingAI ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>Generate Smart Workout</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any, text: any, accent: any, status: any, muscle: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  title: {
    color: text.primary,
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    marginBottom: Spacing['2xl'],
  },

  // Continue card
  continueCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  continueLabel: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  continueSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.sm,
    marginTop: 2,
  },

  // Empty session
  emptySessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptySessionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: accent.redGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySessionTitle: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  emptySessionSubtext: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: text.primary,
    fontSize: FontSize.md,
    paddingVertical: Spacing.md,
  },

  // Section
  sectionTitle: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },

  // Template card
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateEmoji: {
    fontSize: 22,
  },
  templateInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  templateName: {
    color: text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  templateMuscles: {
    color: text.secondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  templateExCount: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  // Recent workouts
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    color: text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  recentMeta: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
});

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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../lib/theme';
import { useWorkoutStore } from '../../stores/workoutStore';
import { getTemplates, WorkoutTemplate, getWorkouts, Workout } from '../../lib/storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function WorkoutTab() {
  const router = useRouter();
  const { startWorkout, startFromTemplate, isActive } = useWorkoutStore();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    const [tmpl, workouts] = await Promise.all([getTemplates(), getWorkouts()]);
    setTemplates(tmpl);
    // Get unique recent workout names
    const seen = new Set<string>();
    const unique = workouts.filter(w => {
      if (seen.has(w.name)) return false;
      seen.add(w.name);
      return true;
    }).slice(0, 5);
    setRecentWorkouts(unique);
  }, []);

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

        {/* Empty Session */}
        <TouchableOpacity
          style={styles.emptySessionCard}
          onPress={handleStartEmpty}
          activeOpacity={0.85}
        >
          <View style={styles.emptySessionIcon}>
            <Ionicons name="add" size={28} color={Colors.accent.red} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <Text style={styles.emptySessionTitle}>Empty Workout</Text>
            <Text style={styles.emptySessionSubtext}>Start from scratch, add exercises as you go</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.text.tertiary} />
        </TouchableOpacity>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={Colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search templates..."
            placeholderTextColor={Colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Templates Section */}
        <Text style={styles.sectionTitle}>Workout Templates</Text>
        {filteredTemplates.map((template) => (
          <TouchableOpacity
            key={template.id}
            style={styles.templateCard}
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
            <Ionicons name="play-circle-outline" size={28} color={Colors.accent.red} />
          </TouchableOpacity>
        ))}

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
                <Ionicons name="refresh-outline" size={22} color={Colors.text.tertiary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  title: {
    color: Colors.text.primary,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
  },
  emptySessionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent.redGlow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySessionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  emptySessionSubtext: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: FontSize.md,
    paddingVertical: Spacing.md,
  },

  // Section
  sectionTitle: {
    color: Colors.text.secondary,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  templateIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceHighlight,
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
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  templateMuscles: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  templateExCount: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  // Recent workouts
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  recentInfo: {
    flex: 1,
  },
  recentName: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  recentMeta: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
});

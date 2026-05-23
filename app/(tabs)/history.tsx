// ═══════════════════════════════════════════════════════
// History Tab — Workout history with calendar heatmap
// ═══════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../lib/theme';
import { getWorkouts, getWorkoutDatesForMonth, Workout } from '../../lib/storage';

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    const [w, dates] = await Promise.all([
      getWorkouts(),
      getWorkoutDatesForMonth(calendarMonth.getFullYear(), calendarMonth.getMonth()),
    ]);
    setWorkouts(w);
    setWorkoutDates(dates);
  }, [calendarMonth]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Calendar helpers
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
  const monthName = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    const d = new Date(calendarMonth);
    d.setMonth(d.getMonth() - 1);
    setCalendarMonth(d);
  };

  const nextMonth = () => {
    const d = new Date(calendarMonth);
    d.setMonth(d.getMonth() + 1);
    setCalendarMonth(d);
  };

  const isWorkoutDay = (day: number) => {
    const dateStr = `${calendarMonth.getFullYear()}-${(calendarMonth.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    return workoutDates.includes(dateStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day &&
      today.getMonth() === calendarMonth.getMonth() &&
      today.getFullYear() === calendarMonth.getFullYear();
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatVolume = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k kg`;
    return `${v} kg`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent.red} />
        }
      >
        <Text style={styles.title}>History</Text>

        {/* Calendar Heatmap */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={prevMonth}>
              <Ionicons name="chevron-back" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.calendarMonth}>{monthName}</Text>
            <TouchableOpacity onPress={nextMonth}>
              <Ionicons name="chevron-forward" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.calendarDays}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <Text key={i} style={styles.calendarDayLabel}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {/* Empty cells for days before first of month */}
            {Array.from({ length: firstDayOfWeek }, (_, i) => (
              <View key={`empty-${i}`} style={styles.calendarCell} />
            ))}
            {/* Days of month */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const hasWorkout = isWorkoutDay(day);
              const today = isToday(day);

              return (
                <View key={day} style={styles.calendarCell}>
                  <View
                    style={[
                      styles.calendarDayCircle,
                      hasWorkout && styles.calendarDayActive,
                      today && styles.calendarDayToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        hasWorkout && styles.calendarDayTextActive,
                        today && !hasWorkout && styles.calendarDayTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: Colors.status.success }]} />
              <Text style={styles.legendText}>Workout Day</Text>
            </View>
            <Text style={styles.legendCount}>
              {workoutDates.length} workouts this month
            </Text>
          </View>
        </View>

        {/* Workout List */}
        <Text style={styles.sectionTitle}>All Workouts</Text>

        {workouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color={Colors.text.tertiary} />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>Start your first workout to see it here!</Text>
          </View>
        ) : (
          workouts.map((workout) => (
            <TouchableOpacity
              key={workout.id}
              style={styles.workoutCard}
              onPress={() => setSelectedWorkout(selectedWorkout?.id === workout.id ? null : workout)}
              activeOpacity={0.8}
            >
              <View style={styles.workoutHeader}>
                <View style={styles.workoutDateBadge}>
                  <Text style={styles.workoutDateDay}>
                    {new Date(workout.workout_date).getDate()}
                  </Text>
                  <Text style={styles.workoutDateMonth}>
                    {new Date(workout.workout_date).toLocaleDateString('en-US', { month: 'short' })}
                  </Text>
                </View>
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutName}>{workout.name || 'Workout'}</Text>
                  <View style={styles.workoutMeta}>
                    <Text style={styles.workoutMetaText}>
                      ⏱ {formatDuration(workout.duration_minutes)}
                    </Text>
                    <Text style={styles.workoutMetaText}>
                      📊 {formatVolume(workout.total_volume_kg)}
                    </Text>
                    <Text style={styles.workoutMetaText}>
                      💪 {[...new Set(workout.exercises.map(e => e.exercise_name))].length} exercises
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={selectedWorkout?.id === workout.id ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.text.tertiary}
                />
              </View>

              {/* Muscle group tags */}
              <View style={styles.muscleGroupRow}>
                {workout.muscle_groups.slice(0, 4).map(mg => (
                  <View key={mg} style={styles.muscleTag}>
                    <Text style={styles.muscleTagText}>{mg}</Text>
                  </View>
                ))}
              </View>

              {/* Expanded detail */}
              {selectedWorkout?.id === workout.id && (
                <View style={styles.workoutDetail}>
                  {[...new Set(workout.exercises.map(e => e.exercise_name))].map(exName => {
                    const sets = workout.exercises.filter(e => e.exercise_name === exName);
                    return (
                      <View key={exName} style={styles.detailExercise}>
                        <Text style={styles.detailExerciseName}>{exName}</Text>
                        {sets.map((s, i) => (
                          <Text key={i} style={styles.detailSet}>
                            {s.is_warmup ? 'W' : `Set ${s.set_number}`}: {s.weight_kg}kg × {s.reps}
                            {s.rpe ? ` @RPE${s.rpe}` : ''}
                          </Text>
                        ))}
                      </View>
                    );
                  })}
                </View>
              )}
            </TouchableOpacity>
          ))
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

  // Calendar
  calendarCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  calendarMonth: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  calendarDays: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  calendarDayLabel: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  calendarDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayActive: {
    backgroundColor: Colors.status.success,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: Colors.accent.red,
  },
  calendarDayText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  calendarDayTextActive: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
  calendarDayTextToday: {
    color: Colors.accent.red,
    fontWeight: FontWeight.bold,
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
  },
  legendCount: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
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

  // Workout card
  workoutCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutDateBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  workoutDateDay: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    lineHeight: 20,
  },
  workoutDateMonth: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    lineHeight: 14,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  workoutMeta: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
  },
  workoutMetaText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
  },
  muscleGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    marginLeft: 56,
  },
  muscleTag: {
    backgroundColor: Colors.dark.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  muscleTagText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    textTransform: 'capitalize',
  },

  // Detail
  workoutDetail: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  detailExercise: {
    marginBottom: Spacing.md,
  },
  detailExerciseName: {
    color: Colors.accent.red,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  detailSet: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginLeft: Spacing.lg,
    lineHeight: 20,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
  emptyText: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginTop: Spacing.md,
  },
  emptySubtext: {
    color: Colors.text.tertiary,
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },
});

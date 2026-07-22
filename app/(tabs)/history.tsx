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
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { 
  ChevronLeft, ChevronRight, Dumbbell, 
  ChevronUp, ChevronDown, Clock, Activity, Flame, Crown, Search
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { useThemeColor, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../lib/theme';
import { getWorkouts, getWorkoutDatesForMonth, Workout, deleteWorkout } from '../../lib/storage';
import { useSettingsStore } from '../../stores/settingsStore';
import { displayWeight } from '../../lib/units';
import { LinearGradient } from 'expo-linear-gradient';

export default function HistoryScreen() {
  const { colors, text, accent, status, muscle, isDark } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);
  const { isPremium, upgradeToPremium } = useSettingsStore();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleDeleteWorkout = async (id: string) => {
    Alert.alert(
      "Delete Workout",
      "Are you sure you want to permanently delete this workout session? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            await deleteWorkout(id);
            setSelectedWorkout(null);
            await loadData();
          } 
        }
      ]
    );
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
    return displayWeight(v);
  };

  const filteredWorkouts = React.useMemo(() => {
    if (!searchQuery.trim()) return workouts;
    const q = searchQuery.toLowerCase();
    return workouts.filter(w => 
      w.name.toLowerCase().includes(q) ||
      w.muscle_groups.some(mg => mg.toLowerCase().includes(q)) ||
      w.exercises.some(e => e.exercise_name.toLowerCase().includes(q))
    );
  }, [workouts, searchQuery]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent.red} />
        }
      >
        <Text style={styles.title}>History</Text>

        {/* Calendar Heatmap */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
              <ChevronLeft size={20} color={text.secondary} />
            </TouchableOpacity>
            <Text style={styles.calendarMonth}>{monthName}</Text>
            <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
              <ChevronRight size={20} color={text.secondary} />
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
              <View style={[styles.legendDot, { backgroundColor: status.success }]} />
              <Text style={styles.legendText}>Workout Day</Text>
            </View>
            <Text style={styles.legendCount}>
              {workoutDates.length} workouts
            </Text>
          </View>
        </Animated.View>

        {/* Workout List */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
          <Text style={styles.sectionTitle}>Training Log</Text>
        </View>

        {/* Search Bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: BorderRadius.md,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
        }}>
          <Search size={18} color={text.tertiary} style={{ marginRight: Spacing.sm }} />
          <TextInput
            style={{
              flex: 1,
              color: text.primary,
              fontSize: FontSize.md,
              paddingVertical: Spacing.md,
            }}
            placeholder="Search workouts or exercises..."
            placeholderTextColor={text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {filteredWorkouts.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.emptyState}>
            <Dumbbell size={48} color={text.tertiary} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyText}>{searchQuery ? 'No matching workouts' : 'No workouts yet'}</Text>
            <Text style={styles.emptySubtext}>{searchQuery ? 'Try a different search term.' : 'Your past workouts will appear here.'}</Text>
          </Animated.View>
        ) : (
          (isPremium ? filteredWorkouts : filteredWorkouts.slice(0, 5)).map((workout, index) => (
            <Animated.View key={workout.id} layout={Layout.springify()}>
              <Animated.View 
                entering={FadeInDown.delay(200 + index * 50).springify()}
              >
                <TouchableOpacity
                  style={styles.workoutCard}
                  onPress={() => setSelectedWorkout(selectedWorkout?.id === workout.id ? null : workout)}
                  activeOpacity={0.9}
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
                        <View style={styles.workoutMetaItem}>
                          <Clock size={12} color={text.tertiary} />
                          <Text style={styles.workoutMetaText}>{formatDuration(workout.duration_minutes)}</Text>
                        </View>
                        <View style={styles.workoutMetaItem}>
                          <Activity size={12} color={text.tertiary} />
                          <Text style={styles.workoutMetaText}>{formatVolume(workout.total_volume_kg)}</Text>
                        </View>
                        <View style={styles.workoutMetaItem}>
                          <Dumbbell size={12} color={text.tertiary} />
                          <Text style={styles.workoutMetaText}>
                            {[...new Set(workout.exercises.map(e => e.exercise_name))].length}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {selectedWorkout?.id === workout.id ? (
                      <ChevronUp size={20} color={text.tertiary} />
                    ) : (
                      <ChevronDown size={20} color={text.tertiary} />
                    )}
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
                    <Animated.View entering={FadeInDown.springify()} style={styles.workoutDetail}>
                      {[...new Set(workout.exercises.map(e => e.exercise_name))].map(exName => {
                        const sets = workout.exercises.filter(e => e.exercise_name === exName);
                        return (
                          <View key={exName} style={styles.detailExercise}>
                            <Text style={styles.detailExerciseName}>{exName}</Text>
                            {sets.map((s, i) => (
                              <View key={i} style={styles.detailSetRow}>
                                <Text style={styles.detailSetNumber}>
                                  {s.is_warmup ? 'W' : `Set ${s.set_number}`}
                                </Text>
                                <Text style={styles.detailSetValues}>
                                  {displayWeight(s.weight_kg)} × {s.reps}
                                  {s.rpe ? `  @RPE${s.rpe}` : ''}
                                </Text>
                              </View>
                            ))}
                          </View>
                        );
                      })}

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          borderRadius: BorderRadius.md,
                          paddingVertical: 10,
                          marginTop: Spacing.md,
                          gap: 6
                        }}
                        onPress={() => handleDeleteWorkout(workout.id)}
                      >
                        <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 13 }}>Delete Workout Session</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          ))
        )}

        {!isPremium && workouts.length > 5 && (
          <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.paywallCard}>
            <LinearGradient
              colors={[colors.surfaceElevated, colors.surface]}
              style={styles.paywallGradient}
            >
              <Crown size={48} color="#FFD700" style={{ marginBottom: Spacing.md }} />
              <Text style={styles.paywallTitle}>Unlock Unlimited History</Text>
              <Text style={styles.paywallText}>
                Free tier is limited to your last 5 workouts. Go premium to store, review, and search your entire lifetime training history.
              </Text>
              <TouchableOpacity style={styles.paywallButton} onPress={() => upgradeToPremium()}>
                <Text style={styles.paywallButtonText}>Go Premium for ₹199</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
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
    letterSpacing: -0.5,
  },

  // Calendar
  calendarCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.md,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  calendarMonth: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
  },
  navButton: {
    padding: Spacing.xs,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: BorderRadius.sm,
  },
  calendarDays: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  calendarDayLabel: {
    flex: 1,
    textAlign: 'center',
    color: text.tertiary,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayActive: {
    backgroundColor: status.success,
    ...Shadows.glow(status.success),
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: accent.red,
  },
  calendarDayText: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  calendarDayTextActive: {
    color: colors.background,
    fontWeight: FontWeight.extrabold,
  },
  calendarDayTextToday: {
    color: accent.red,
    fontWeight: FontWeight.bold,
  },
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: text.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  legendCount: {
    color: text.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
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

  // Workout card
  workoutCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutDateBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  workoutDateDay: {
    color: text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    lineHeight: 22,
  },
  workoutDateMonth: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    color: text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 6,
  },
  workoutMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workoutMetaText: {
    color: text.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  muscleGroupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginLeft: 64, // Aligns under the text, not the badge
  },
  muscleTag: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  muscleTagText: {
    color: text.secondary,
    fontSize: 10,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Detail
  workoutDetail: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginLeft: 64,
  },
  detailExercise: {
    marginBottom: Spacing.md,
  },
  detailExerciseName: {
    color: accent.red,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  detailSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailSetNumber: {
    width: 40,
    color: text.tertiary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  detailSetValues: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  emptySubtext: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },

  // Paywall
  paywallCard: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.lg,
  },
  paywallGradient: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallTitle: {
    color: text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  paywallText: {
    color: text.secondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  paywallButton: {
    backgroundColor: accent.red,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    ...Shadows.md,
  },
  paywallButtonText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});

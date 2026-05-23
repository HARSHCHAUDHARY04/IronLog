// ═══════════════════════════════════════════════════════
// Home Dashboard — IronLog's Main Screen
// Features: greeting, streak, volume stats, recent PRs,
// quick workout start, and suggested workout
// ═══════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { getWorkoutStats, getTemplates, getPRs, getWorkouts, type PRRecord, type WorkoutTemplate, type Workout } from '../../lib/storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { startWorkout, startFromTemplate, isActive } = useWorkoutStore();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    thisMonthWorkouts: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalVolume: 0,
    thisWeekVolume: 0,
    lastWeekVolume: 0,
  });
  const [recentPRs, setRecentPRs] = useState<PRRecord[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  const loadData = useCallback(async () => {
    try {
      const [s, prs, tmpl, workouts] = await Promise.all([
        getWorkoutStats(),
        getPRs(),
        getTemplates(),
        getWorkouts(),
      ]);
      setStats(s);
      setRecentPRs(prs.slice(0, 5));
      setTemplates(tmpl);
      setLastWorkout(workouts.length > 0 ? workouts[0] : null);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    // Pulse animation for the start button
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleStartWorkout = () => {
    if (isActive) {
      router.push('/workout-active');
    } else {
      startWorkout();
      router.push('/workout-active');
    }
  };

  const handleStartTemplate = async (template: WorkoutTemplate) => {
    await startFromTemplate(template.name, template.exercises);
    router.push('/workout-active');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const volumeChange = stats.lastWeekVolume > 0
    ? Math.round(((stats.thisWeekVolume - stats.lastWeekVolume) / stats.lastWeekVolume) * 100)
    : 0;

  const formatVolume = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v.toString();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent.red}
            colors={[Colors.accent.red]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'Lifter'} 💪</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <LinearGradient
              colors={[Colors.dark.surfaceElevated, Colors.dark.surfaceHighlight]}
              style={styles.profileGradient}
            >
              <Ionicons name="person" size={20} color={Colors.text.secondary} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Continue Workout Banner */}
        {isActive && (
          <TouchableOpacity 
            style={styles.continueWorkout}
            onPress={() => router.push('/workout-active')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#FF4444', '#CC2222']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueGradient}
            >
              <View style={styles.continueContent}>
                <View>
                  <Text style={styles.continueLabel}>WORKOUT IN PROGRESS</Text>
                  <Text style={styles.continueTitle}>Tap to continue →</Text>
                </View>
                <View style={styles.continuePulse}>
                  <Ionicons name="barbell" size={28} color="#fff" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Start Workout Button */}
        {!isActive && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartWorkout}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#FF5555', '#FF4444', '#DD2222']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startButtonGradient}
              >
                <Ionicons name="add-circle" size={32} color="#fff" />
                <Text style={styles.startButtonText}>Start Workout</Text>
                <Text style={styles.startButtonSubtext}>Empty session • Add exercises as you go</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <View style={[styles.statIcon, { backgroundColor: Colors.accent.redGlow }]}>
              <Ionicons name="flame" size={20} color={Colors.accent.red} />
            </View>
            <Text style={styles.statValue}>{stats.currentStreak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>

          <View style={[styles.statCard, { flex: 1 }]}>
            <View style={[styles.statIcon, { backgroundColor: Colors.status.infoGlow }]}>
              <Ionicons name="calendar" size={20} color={Colors.status.info} />
            </View>
            <Text style={styles.statValue}>{stats.thisMonthWorkouts}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>

          <View style={[styles.statCard, { flex: 1 }]}>
            <View style={[styles.statIcon, { backgroundColor: Colors.status.successGlow }]}>
              <Ionicons name="trending-up" size={20} color={Colors.status.success} />
            </View>
            <Text style={styles.statValue}>{formatVolume(stats.totalVolume)}</Text>
            <Text style={styles.statLabel}>Total Vol (kg)</Text>
          </View>
        </View>

        {/* Weekly Volume Card */}
        <View style={styles.volumeCard}>
          <View style={styles.volumeHeader}>
            <Text style={styles.volumeTitle}>Weekly Volume</Text>
            <View style={[
              styles.volumeChangeBadge,
              { backgroundColor: volumeChange >= 0 ? Colors.status.successGlow : Colors.accent.redGlow }
            ]}>
              <Ionicons 
                name={volumeChange >= 0 ? 'arrow-up' : 'arrow-down'} 
                size={14} 
                color={volumeChange >= 0 ? Colors.status.success : Colors.accent.red} 
              />
              <Text style={[
                styles.volumeChangeText,
                { color: volumeChange >= 0 ? Colors.status.success : Colors.accent.red }
              ]}>
                {Math.abs(volumeChange)}%
              </Text>
            </View>
          </View>
          <Text style={styles.volumeValue}>{formatVolume(stats.thisWeekVolume)} kg</Text>
          <Text style={styles.volumeSubtext}>vs {formatVolume(stats.lastWeekVolume)} kg last week</Text>

          {/* Simple volume bar */}
          <View style={styles.volumeBar}>
            <View
              style={[
                styles.volumeBarFill,
                {
                  width: stats.lastWeekVolume > 0
                    ? `${Math.min(100, (stats.thisWeekVolume / stats.lastWeekVolume) * 100)}%`
                    : '0%',
                  backgroundColor: volumeChange >= 0 ? Colors.status.success : Colors.accent.red,
                },
              ]}
            />
          </View>
        </View>

        {/* Workout Templates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Start</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
            {templates.slice(0, 6).map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => handleStartTemplate(template)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[Colors.dark.surfaceElevated, Colors.dark.surface]}
                  style={styles.templateGradient}
                >
                  <Text style={styles.templateEmoji}>
                    {template.muscle_groups.includes('chest') ? '💪' :
                     template.muscle_groups.includes('back') ? '🔙' :
                     template.muscle_groups.includes('quadriceps') ? '🦵' :
                     template.muscle_groups.includes('shoulders') ? '🏋️' : '⚡'}
                  </Text>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.templateExercises}>
                    {template.exercises.length} exercises
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Recent PRs */}
        {recentPRs.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent PRs 🏆</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentPRs.slice(0, 3).map((pr, idx) => (
              <View key={pr.id || idx} style={styles.prCard}>
                <View style={styles.prIcon}>
                  <Text style={styles.prEmoji}>
                    {pr.record_type === '1rm' ? '🏆' : pr.record_type === 'volume' ? '📊' : '🔥'}
                  </Text>
                </View>
                <View style={styles.prInfo}>
                  <Text style={styles.prExercise}>{pr.exercise_name}</Text>
                  <Text style={styles.prValue}>
                    {pr.record_type === '1rm' ? `${pr.value.toFixed(1)} kg est. 1RM` :
                     pr.record_type === 'volume' ? `${pr.value} kg volume` :
                     `${pr.value} reps`}
                  </Text>
                </View>
                {pr.improvement_pct && (
                  <View style={styles.prBadge}>
                    <Text style={styles.prBadgeText}>+{pr.improvement_pct}%</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Last Workout */}
        {lastWorkout && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last Workout</Text>
            <TouchableOpacity 
              style={styles.lastWorkoutCard}
              onPress={() => router.push('/(tabs)/history')}
              activeOpacity={0.8}
            >
              <View style={styles.lastWorkoutHeader}>
                <Text style={styles.lastWorkoutName}>{lastWorkout.name || 'Workout'}</Text>
                <Text style={styles.lastWorkoutDate}>
                  {new Date(lastWorkout.workout_date).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
              <View style={styles.lastWorkoutStats}>
                <View style={styles.lastWorkoutStat}>
                  <Ionicons name="time-outline" size={16} color={Colors.text.secondary} />
                  <Text style={styles.lastWorkoutStatText}>{lastWorkout.duration_minutes} min</Text>
                </View>
                <View style={styles.lastWorkoutStat}>
                  <Ionicons name="barbell-outline" size={16} color={Colors.text.secondary} />
                  <Text style={styles.lastWorkoutStatText}>{formatVolume(lastWorkout.total_volume_kg)} kg</Text>
                </View>
                <View style={styles.lastWorkoutStat}>
                  <Ionicons name="fitness-outline" size={16} color={Colors.text.secondary} />
                  <Text style={styles.lastWorkoutStatText}>
                    {[...new Set(lastWorkout.exercises.map(e => e.exercise_name))].length} exercises
                  </Text>
                </View>
              </View>
              <View style={styles.muscleGroupTags}>
                {lastWorkout.muscle_groups.map(mg => (
                  <View key={mg} style={styles.muscleTag}>
                    <Text style={styles.muscleTagText}>{mg}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty state for new users */}
        {stats.totalWorkouts === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏋️</Text>
            <Text style={styles.emptyTitle}>Ready to Start?</Text>
            <Text style={styles.emptyText}>
              Your fitness journey begins with a single rep.{'\n'}
              Tap "Start Workout" above to log your first session!
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  greeting: {
    color: Colors.text.secondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  userName: {
    color: Colors.text.primary,
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    marginTop: 2,
  },
  profileButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  profileGradient: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  // Continue workout banner
  continueWorkout: {
    marginBottom: Spacing.xl,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  continueGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  continueContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  continueLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 1,
  },
  continueTitle: {
    color: '#fff',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginTop: 4,
  },
  continuePulse: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Start workout button
  startButton: {
    marginBottom: Spacing['2xl'],
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
    ...Shadows.glow(Colors.accent.red),
  },
  startButtonGradient: {
    paddingVertical: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
  },
  startButtonText: {
    color: '#fff',
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
    marginTop: Spacing.sm,
  },
  startButtonSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.sm,
    marginTop: 4,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statValue: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
  },
  statLabel: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    marginTop: 2,
  },

  // Volume card
  volumeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  volumeTitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  volumeChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 2,
  },
  volumeChangeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  volumeValue: {
    color: Colors.text.primary,
    fontSize: FontSize['4xl'],
    fontWeight: FontWeight.extrabold,
  },
  volumeSubtext: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  volumeBar: {
    height: 6,
    backgroundColor: Colors.dark.surfaceHighlight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  volumeBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Templates
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.md,
  },
  seeAll: {
    color: Colors.accent.red,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  templateScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  templateCard: {
    width: 130,
    marginRight: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  templateGradient: {
    padding: Spacing.md,
    minHeight: 110,
    justifyContent: 'space-between',
  },
  templateEmoji: {
    fontSize: 28,
    marginBottom: Spacing.sm,
  },
  templateName: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  templateExercises: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 4,
  },

  // PR cards
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  prIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  prEmoji: {
    fontSize: 20,
  },
  prInfo: {
    flex: 1,
  },
  prExercise: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  prValue: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  prBadge: {
    backgroundColor: Colors.status.successGlow,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  prBadgeText: {
    color: Colors.status.success,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  // Last workout
  lastWorkoutCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  lastWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  lastWorkoutName: {
    color: Colors.text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  lastWorkoutDate: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
  },
  lastWorkoutStats: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  lastWorkoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastWorkoutStatText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
  },
  muscleGroupTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  muscleTag: {
    backgroundColor: Colors.dark.surfaceHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  muscleTagText: {
    color: Colors.text.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'capitalize',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.text.primary,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: Colors.text.secondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
});

// ═══════════════════════════════════════════════════════
// Analytics Tab — Charts, PRs, and progress tracking
// ═══════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../lib/theme';
import { getWorkouts, getExerciseHistory, getPRs, getWorkoutStats, Workout, PRRecord } from '../../lib/storage';
import { analyzeOverload, type OverloadAnalysis } from '../../lib/overloadEngine';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - Spacing.lg * 2 - Spacing.lg * 2;
const CHART_HEIGHT = 180;

export default function AnalyticsScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [prs, setPRs] = useState<PRRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);
  const [overloadAnalysis, setOverloadAnalysis] = useState<OverloadAnalysis | null>(null);
  const [timeRange, setTimeRange] = useState<'4W' | '3M' | '6M' | '1Y' | 'ALL'>('3M');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [w, p, s] = await Promise.all([getWorkouts(), getPRs(), getWorkoutStats()]);
    setWorkouts(w);
    setPRs(p);
    setStats(s);

    // Get unique exercise names
    const names = [...new Set(w.flatMap(wk => wk.exercises.map(e => e.exercise_name)))];
    setExerciseNames(names);

    if (names.length > 0 && !selectedExercise) {
      setSelectedExercise(names[0]);
      await loadExerciseChart(names[0]);
    }
  }, []);

  const loadExerciseChart = async (exerciseName: string) => {
    const history = await getExerciseHistory(exerciseName);
    
    // Filter by time range
    const now = new Date();
    let cutoff = new Date(0);
    switch (timeRange) {
      case '4W': cutoff = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000); break;
      case '3M': cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '6M': cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); break;
      case '1Y': cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      case 'ALL': break;
    }

    const filtered = history.filter(h => new Date(h.workout_date) >= cutoff);
    
    setChartData(filtered.reverse().map(h => ({
      date: h.workout_date,
      value: h.best_1rm,
    })));

    // Run overload analysis
    const analysis = analyzeOverload(filtered.reverse().map(h => ({
      workout_date: h.workout_date,
      sets: h.sets,
      best_1rm: h.best_1rm,
      total_volume: h.total_volume,
    })));
    setOverloadAnalysis(analysis);
  };

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleExerciseSelect = async (name: string) => {
    setSelectedExercise(name);
    await loadExerciseChart(name);
  };

  const handleTimeRangeChange = async (range: typeof timeRange) => {
    setTimeRange(range);
    if (selectedExercise) {
      await loadExerciseChart(selectedExercise);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Simple chart renderer using Views
  const renderChart = () => {
    if (chartData.length < 2) {
      return (
        <View style={styles.chartEmpty}>
          <Ionicons name="analytics-outline" size={40} color={Colors.text.tertiary} />
          <Text style={styles.chartEmptyText}>
            {chartData.length === 0 ? 'No data for this exercise' : 'Need 2+ sessions for chart'}
          </Text>
        </View>
      );
    }

    const maxVal = Math.max(...chartData.map(d => d.value));
    const minVal = Math.min(...chartData.map(d => d.value));
    const range = maxVal - minVal || 1;
    const barWidth = Math.max(8, Math.min(32, (CHART_WIDTH - chartData.length * 4) / chartData.length));

    return (
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxis}>
          <Text style={styles.yAxisLabel}>{Math.round(maxVal)}</Text>
          <Text style={styles.yAxisLabel}>{Math.round(minVal + range / 2)}</Text>
          <Text style={styles.yAxisLabel}>{Math.round(minVal)}</Text>
        </View>

        {/* Bars */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
          <View style={styles.barsContainer}>
            {/* Grid lines */}
            <View style={[styles.gridLine, { top: 0 }]} />
            <View style={[styles.gridLine, { top: '50%' }]} />
            <View style={[styles.gridLine, { top: '100%' }]} />

            {chartData.map((d, i) => {
              const height = ((d.value - minVal) / range) * (CHART_HEIGHT - 20) + 10;
              const isLatest = i === chartData.length - 1;

              return (
                <View key={i} style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height,
                        width: barWidth,
                        backgroundColor: isLatest ? Colors.accent.red : Colors.status.info,
                        opacity: isLatest ? 1 : 0.6 + (i / chartData.length) * 0.4,
                      },
                    ]}
                  />
                  {(i === 0 || i === chartData.length - 1 || i === Math.floor(chartData.length / 2)) && (
                    <Text style={styles.barLabel}>
                      {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'progressing': return { icon: 'trending-up', color: Colors.status.success };
      case 'plateau': return { icon: 'pause-circle', color: Colors.status.warning };
      case 'regression': return { icon: 'trending-down', color: Colors.accent.red };
      default: return { icon: 'information-circle', color: Colors.status.info };
    }
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
        <Text style={styles.title}>Analytics</Text>

        {/* Summary Stats */}
        {stats && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.totalWorkouts}</Text>
              <Text style={styles.summaryLabel}>Total{'\n'}Workouts</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.longestStreak}</Text>
              <Text style={styles.summaryLabel}>Best{'\n'}Streak</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{prs.length}</Text>
              <Text style={styles.summaryLabel}>Personal{'\n'}Records</Text>
            </View>
          </View>
        )}

        {/* Exercise Selector */}
        <Text style={styles.sectionTitle}>Strength Progression</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseSelector}>
          {exerciseNames.map(name => (
            <TouchableOpacity
              key={name}
              style={[
                styles.exercisePill,
                selectedExercise === name && styles.exercisePillActive,
              ]}
              onPress={() => handleExerciseSelect(name)}
            >
              <Text
                style={[
                  styles.exercisePillText,
                  selectedExercise === name && styles.exercisePillTextActive,
                ]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Time Range Selector */}
        <View style={styles.timeRangeRow}>
          {(['4W', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                timeRange === range && styles.timeRangeButtonActive,
              ]}
              onPress={() => handleTimeRangeChange(range)}
            >
              <Text
                style={[
                  styles.timeRangeText,
                  timeRange === range && styles.timeRangeTextActive,
                ]}
              >
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart Card */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            Estimated 1RM — {selectedExercise || 'Select Exercise'}
          </Text>
          {chartData.length > 0 && (
            <Text style={styles.chartSubtitle}>
              Current: {chartData[chartData.length - 1]?.value.toFixed(1)} kg
            </Text>
          )}
          {renderChart()}
        </View>

        {/* Overload Analysis */}
        {overloadAnalysis && (
          <View style={styles.analysisCard}>
            <View style={styles.analysisHeader}>
              <Ionicons
                name={getStatusIcon(overloadAnalysis.status).icon as any}
                size={24}
                color={getStatusIcon(overloadAnalysis.status).color}
              />
              <Text style={[styles.analysisStatus, { color: getStatusIcon(overloadAnalysis.status).color }]}>
                {overloadAnalysis.status.charAt(0).toUpperCase() + overloadAnalysis.status.slice(1)}
              </Text>
            </View>
            <Text style={styles.analysisDetails}>{overloadAnalysis.details}</Text>
            
            {overloadAnalysis.suggestedWeight && (
              <View style={styles.suggestionBox}>
                <Ionicons name="bulb" size={18} color={Colors.status.warning} />
                <Text style={styles.suggestionText}>
                  Suggested: {overloadAnalysis.suggestedWeight} kg
                  {overloadAnalysis.suggestedReps ? ` × ${overloadAnalysis.suggestedReps} reps` : ''}
                </Text>
              </View>
            )}

            {overloadAnalysis.changePercent !== undefined && (
              <Text style={styles.analysisChange}>
                {overloadAnalysis.changePercent >= 0 ? '📈' : '📉'} {Math.abs(overloadAnalysis.changePercent).toFixed(1)}% change over {overloadAnalysis.sessionsAnalyzed} sessions
              </Text>
            )}
          </View>
        )}

        {/* Personal Records */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>All-Time PRs 🏆</Text>
        {prs.length === 0 ? (
          <View style={styles.emptyPRs}>
            <Text style={styles.emptyPRsText}>Log workouts to set PRs!</Text>
          </View>
        ) : (
          prs.slice(0, 10).map((pr, idx) => (
            <View key={pr.id || idx} style={styles.prCard}>
              <View style={styles.prRank}>
                <Text style={styles.prRankText}>
                  {pr.record_type === '1rm' ? '🏆' : pr.record_type === 'volume' ? '📊' : '🔥'}
                </Text>
              </View>
              <View style={styles.prInfo}>
                <Text style={styles.prExercise}>{pr.exercise_name}</Text>
                <Text style={styles.prType}>
                  {pr.record_type === '1rm' ? 'Estimated 1RM' :
                   pr.record_type === 'volume' ? 'Session Volume' : 'Max Reps'}
                </Text>
              </View>
              <View style={styles.prValueBox}>
                <Text style={styles.prValue}>
                  {pr.value.toFixed(pr.record_type === 'reps' ? 0 : 1)}
                </Text>
                <Text style={styles.prUnit}>
                  {pr.record_type === 'reps' ? 'reps' : 'kg'}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Volume by Muscle Group (simple) */}
        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Muscle Group Volume</Text>
        {(() => {
          const muscleVolumes: Record<string, number> = {};
          workouts.forEach(w => {
            w.muscle_groups.forEach(mg => {
              muscleVolumes[mg] = (muscleVolumes[mg] || 0) + w.total_volume_kg;
            });
          });
          const maxVol = Math.max(...Object.values(muscleVolumes), 1);
          const muscleColors: Record<string, string> = {
            chest: Colors.muscle.chest,
            back: Colors.muscle.back,
            shoulders: Colors.muscle.shoulders,
            quadriceps: Colors.muscle.legs,
            hamstrings: Colors.muscle.legs,
            biceps: Colors.muscle.arms,
            triceps: Colors.muscle.arms,
            core: Colors.muscle.core,
            glutes: Colors.muscle.legs,
            calves: Colors.muscle.legs,
          };

          return Object.entries(muscleVolumes)
            .sort((a, b) => b[1] - a[1])
            .map(([muscle, vol]) => (
              <View key={muscle} style={styles.muscleVolumeRow}>
                <Text style={styles.muscleVolumeName}>
                  {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
                </Text>
                <View style={styles.muscleVolumeBarBg}>
                  <View
                    style={[
                      styles.muscleVolumeBarFill,
                      {
                        width: `${(vol / maxVol) * 100}%`,
                        backgroundColor: muscleColors[muscle] || Colors.status.info,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.muscleVolumeValue}>{Math.round(vol)} kg</Text>
              </View>
            ));
        })()}

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

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing['2xl'],
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  summaryValue: {
    color: Colors.text.primary,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
  },
  summaryLabel: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: 4,
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

  // Exercise selector
  exerciseSelector: {
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  exercisePill: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  exercisePillActive: {
    backgroundColor: Colors.accent.red,
    borderColor: Colors.accent.red,
  },
  exercisePillText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  exercisePillTextActive: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },

  // Time range
  timeRangeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.surface,
  },
  timeRangeButtonActive: {
    backgroundColor: Colors.dark.surfaceHighlight,
    borderWidth: 1,
    borderColor: Colors.accent.red,
  },
  timeRangeText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  timeRangeTextActive: {
    color: Colors.accent.red,
    fontWeight: FontWeight.bold,
  },

  // Chart
  chartCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  chartTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  chartSubtitle: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT + 30,
  },
  yAxis: {
    width: 36,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  yAxisLabel: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  chartScroll: {
    flex: 1,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    paddingBottom: 20,
    gap: 4,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  barWrapper: {
    alignItems: 'center',
  },
  bar: {
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    color: Colors.text.tertiary,
    fontSize: 9,
    marginTop: 4,
  },
  chartEmpty: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },

  // Analysis card
  analysisCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  analysisStatus: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  analysisDetails: {
    color: Colors.text.secondary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.status.warningGlow,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  suggestionText: {
    color: Colors.status.warning,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },
  analysisChange: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },

  // PRs
  emptyPRs: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  emptyPRsText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.md,
  },
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
  prRank: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  prRankText: {
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
  prType: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  prValueBox: {
    alignItems: 'flex-end',
  },
  prValue: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
  },
  prUnit: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
  },

  // Muscle volume
  muscleVolumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  muscleVolumeName: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    width: 80,
    fontWeight: FontWeight.medium,
  },
  muscleVolumeBarBg: {
    flex: 1,
    height: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 6,
    overflow: 'hidden',
    marginHorizontal: Spacing.sm,
  },
  muscleVolumeBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  muscleVolumeValue: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    width: 55,
    textAlign: 'right',
  },
});

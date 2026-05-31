// ═══════════════════════════════════════════════════════
// Analytics Tab — Charts, PRs, and progress tracking
// ═══════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { 
  TrendingUp, TrendingDown, Activity, 
  Flame, Trophy, BarChart2, CheckCircle, Lightbulb, AlertCircle, Crown, Plus
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSettingsStore } from '../../stores/settingsStore';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { useThemeColor, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../lib/theme';
import { getWorkouts, getExerciseHistory, getPRs, getWorkoutStats, Workout, PRRecord, saveTemplate } from '../../lib/storage';
import { analyzeOverload, type OverloadAnalysis } from '../../lib/overloadEngine';
import MuscleHeatmap from '../../components/MuscleHeatmap';
import { LinearGradient } from 'expo-linear-gradient';
import { generateGeminiContent } from '../../lib/gemini';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const { colors, text, accent, status, muscle, isDark } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);
  const { isPremium, upgradeToPremium } = useSettingsStore();

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [prs, setPRs] = useState<PRRecord[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);
  const [overloadAnalysis, setOverloadAnalysis] = useState<OverloadAnalysis | null>(null);
  const [timeRange, setTimeRange] = useState<'4W' | '3M' | '6M' | '1Y' | 'ALL'>('3M');
  const [chartMode, setChartMode] = useState<'progression' | 'volume' | 'heatmap'>('progression');
  const [refreshing, setRefreshing] = useState(false);

  // 1RM Percentage Calculator State
  const [calcWeight, setCalcWeight] = useState('100');
  const [calcReps, setCalcReps] = useState('5');

  const oneRepMaxVal = React.useMemo(() => {
    const w = parseFloat(calcWeight) || 0;
    const r = parseFloat(calcReps) || 0;
    if (w <= 0 || r <= 0) return 0;
    return w * (1 + r / 30);
  }, [calcWeight, calcReps]);

  // AI Plateau Solver States
  const [auditingPlateaus, setAuditingPlateaus] = useState(false);
  const [plateauResult, setPlateauResult] = useState<any | null>(null);
  const [savingBreakthrough, setSavingBreakthrough] = useState(false);

  const handlePlateauAudit = async () => {
    setAuditingPlateaus(true);
    setPlateauResult(null);

    const prNames = prs.slice(0, 3).map(p => `${p.exercise_name} (${p.value} kg)`).join(', ');
    const historyText = prNames ? `User's recent personal records are: ${prNames}.` : "No workouts logged yet.";

    const systemPrompt = `You are a certified Strength and Conditioning Specialist (CSCS).
    Analyze the user's lift records: "${historyText}".
    Identify ONE primary exercise where they are plateauing or need a progression boost, or choose a common lift like "Barbell Bench Press".
    Return a structured JSON detailing:
    1. plateau_detected: true
    2. exercise_name: string name of the exercise (e.g., "Barbell Bench Press")
    3. analysis_report: a 2-sentence biomechanical analysis explaining why they are plateauing and how to break it.
    4. recommended_action: one of 'deload', 'switch_variation', 'reps_up', or 'weight_up'.
    5. ai_workout_template: a custom 4-exercise breakthrough workout session designed specifically to target and strengthen the secondary stabilizer muscles for this lift. Include sets and reps.`;

    const payload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            plateau_detected: { type: 'BOOLEAN' },
            exercise_name: { type: 'STRING' },
            analysis_report: { type: 'STRING' },
            recommended_action: { type: 'STRING' },
            ai_workout_template: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                muscle_groups: { type: 'ARRAY', items: { type: 'STRING' } },
                exercises: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      name: { type: 'STRING' },
                      sets: { type: 'INTEGER' },
                      reps: { type: 'INTEGER' }
                    },
                    required: ['name', 'sets', 'reps']
                  }
                }
              },
              required: ['name', 'muscle_groups', 'exercises']
            }
          },
          required: ['plateau_detected', 'exercise_name', 'analysis_report', 'recommended_action', 'ai_workout_template']
        }
      }
    };

    try {
      const responseData = await generateGeminiContent(payload);
      const textResponse = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsed = JSON.parse(textResponse);
        setPlateauResult(parsed);
      }
    } catch (err) {
      console.error(err);
      if (Platform.OS === 'web') {
        window.alert("Plateau Solver Unavailable: Could not contact AI services.");
      } else {
        Alert.alert(
          "AI Solver Unavailable",
          "Could not analyze plateau data. Please check your network or try again later."
        );
      }
      setPlateauResult({
        error: true,
        message: "AI Plateau analysis is currently offline. Please check back later."
      });
    } finally {
      setAuditingPlateaus(false);
    }
  };

  const handleSaveBreakthroughWorkout = async () => {
    if (!plateauResult || !plateauResult.ai_workout_template) return;
    setSavingBreakthrough(true);
    
    try {
      await saveTemplate({
        user_id: 'default_user',
        name: `AI: ${plateauResult.ai_workout_template.name}`,
        muscle_groups: plateauResult.ai_workout_template.muscle_groups,
        exercises: plateauResult.ai_workout_template.exercises,
        is_default: false
      });
      
      if (Platform.OS === 'web') {
        window.alert("Plateau Solver Workout Saved!");
      } else {
        Alert.alert("Breakthrough Session Saved", "Added successfully to your routine templates list!", [{ text: "Awesome!" }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingBreakthrough(false);
    }
  };

  const loadData = useCallback(async () => {
    const [w, p, s] = await Promise.all([getWorkouts(), getPRs(), getWorkoutStats()]);
    setWorkouts(w);
    setPRs(p);
    setStats(s);

    const names = [...new Set(w.flatMap(wk => wk.exercises.map(e => e.exercise_name)))];
    setExerciseNames(names);

    if (names.length > 0 && !selectedExercise) {
      setSelectedExercise(names[0]);
      await loadExerciseChart(names[0]);
    }
  }, []);

  const loadExerciseChart = async (exerciseName: string, rangeOverride?: typeof timeRange) => {
    const history = await getExerciseHistory(exerciseName);
    const activeRange = rangeOverride || timeRange;
    
    const now = new Date();
    let cutoff = new Date(0);
    switch (activeRange) {
      case '4W': cutoff = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000); break;
      case '3M': cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '6M': cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); break;
      case '1Y': cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
      case 'ALL': break;
    }

    const filtered = history.filter(h => new Date(h.workout_date) >= cutoff);
    const reversedHistory = [...filtered].reverse();
    
    setChartData(reversedHistory.map(h => ({
      label: new Date(h.workout_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: h.best_1rm,
    })));

    const analysis = analyzeOverload(reversedHistory.map(h => ({
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
      await loadExerciseChart(selectedExercise, range);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'progressing': return { Icon: TrendingUp, color: status.success };
      case 'plateau': return { Icon: Activity, color: status.warning };
      case 'regression': return { Icon: TrendingDown, color: accent.red };
      default: return { Icon: CheckCircle, color: status.info };
    }
  };

  const calculateFatigueLevels = () => {
    const levels: Record<string, number> = {};
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentWorkouts = workouts.filter(w => new Date(w.workout_date) >= oneWeekAgo);
    recentWorkouts.forEach(w => {
      w.muscle_groups.forEach(mg => {
        levels[mg] = (levels[mg] || 0) + (w.total_volume_kg / 100);
      });
    });
    
    for (const mg in levels) {
      levels[mg] = Math.min(100, levels[mg]);
    }
    return levels;
  };

  const renderVolumeChart = () => {
    // Generate data for the last 7 workouts
    const volumeData = workouts.slice(0, 7).reverse().map(w => ({
      label: new Date(w.workout_date).toLocaleDateString('en-US', { weekday: 'short' }),
      value: w.total_volume_kg,
      frontColor: accent.red,
    }));

    if (volumeData.length === 0) {
      return (
        <View style={styles.chartEmpty}>
          <BarChart2 size={40} color={text.tertiary} />
          <Text style={styles.chartEmptyText}>No volume data available</Text>
        </View>
      );
    }

    return (
      <View style={{ marginTop: Spacing.xl, alignItems: 'center' }}>
        <BarChart
          data={volumeData}
          width={width - 80}
          height={200}
          barWidth={22}
          spacing={24}
          roundedTop
          roundedBottom
          xAxisThickness={0}
          yAxisThickness={0}
          yAxisTextStyle={{ color: text.tertiary, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: text.tertiary, fontSize: 10, marginTop: 4 }}
          hideRules
          initialSpacing={10}
        />
      </View>
    );
  };

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
        <Text style={styles.title}>Analytics</Text>

        {/* Mode Selector */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.modeSelectorRow}>
          {(['progression', 'volume', 'heatmap'] as const).map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeButton, chartMode === mode && styles.modeButtonActive]}
              onPress={() => setChartMode(mode)}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeButtonText, chartMode === mode && styles.modeButtonTextActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {!isPremium && (chartMode === 'progression' || chartMode === 'heatmap') ? (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.paywallCard}>
            <LinearGradient
              colors={[colors.surfaceElevated, colors.surface]}
              style={styles.paywallGradient}
            >
              <Crown size={48} color="#FFD700" style={{ marginBottom: Spacing.md }} />
              <Text style={styles.paywallTitle}>Unlock Advanced Analytics</Text>
              <Text style={styles.paywallText}>
                Next Rep Premium unlocks your custom 1RM progression charts, automatic progressive overload calculations, and 3D recovery heatmaps.
              </Text>
              <TouchableOpacity style={styles.paywallButton} onPress={() => upgradeToPremium()}>
                <Text style={styles.paywallButtonText}>Go Premium for ₹199</Text>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        ) : (
          <>
            {chartMode === 'progression' && (
              <Animated.View entering={FadeInDown.delay(200).springify()}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseSelector}>
                  {exerciseNames.map(name => (
                    <TouchableOpacity
                      key={name}
                      style={[styles.exercisePill, selectedExercise === name && styles.exercisePillActive]}
                      onPress={() => handleExerciseSelect(name)}
                    >
                      <Text style={[styles.exercisePillText, selectedExercise === name && styles.exercisePillTextActive]}>
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.timeRangeRow}>
                  {(['4W', '3M', '6M', '1Y', 'ALL'] as const).map(range => (
                    <TouchableOpacity
                      key={range}
                      style={[styles.timeRangeButton, timeRange === range && styles.timeRangeButtonActive]}
                      onPress={() => handleTimeRangeChange(range)}
                    >
                      <Text style={[styles.timeRangeText, timeRange === range && styles.timeRangeTextActive]}>
                        {range}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.chartCard}>
                  <Text style={styles.chartTitle}>Estimated 1RM — {selectedExercise || 'Select Exercise'}</Text>
                  
                  {chartData.length < 2 ? (
                    <View style={styles.chartEmpty}>
                      <TrendingUp size={40} color={text.tertiary} />
                      <Text style={styles.chartEmptyText}>Need 2+ sessions for chart</Text>
                    </View>
                  ) : (
                    <View style={{ marginTop: Spacing.xl, alignItems: 'center', marginLeft: -10 }}>
                      <LineChart
                        data={chartData}
                        width={width - 90}
                        height={200}
                        color={accent.red}
                        thickness={3}
                        startFillColor={accent.redGlow}
                        endFillColor="rgba(255,68,68,0)"
                        startOpacity={0.9}
                        endOpacity={0.1}
                        initialSpacing={10}
                        noOfSections={4}
                        yAxisColor="transparent"
                        xAxisColor="transparent"
                        yAxisTextStyle={{ color: text.tertiary, fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: text.tertiary, fontSize: 10 }}
                        curved
                        isAnimated
                        dataPointsColor={accent.red}
                        dataPointsRadius={4}
                        rulesType="solid"
                        rulesColor={colors.border}
                      />
                    </View>
                  )}
                </View>

                {/* Overload Analysis */}
                {overloadAnalysis && (
                  <View style={styles.analysisCard}>
                    <View style={styles.analysisHeader}>
                      {(() => {
                        const { Icon, color } = getStatusIcon(overloadAnalysis.status);
                        return <Icon size={24} color={color} />;
                      })()}
                      <Text style={[styles.analysisStatus, { color: getStatusIcon(overloadAnalysis.status).color }]}>
                        {overloadAnalysis.status.charAt(0).toUpperCase() + overloadAnalysis.status.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.analysisDetails}>{overloadAnalysis.details}</Text>
                    
                    {overloadAnalysis.suggestedWeight && (
                      <View style={styles.suggestionBox}>
                        <Lightbulb size={18} color={status.warning} />
                        <Text style={styles.suggestionText}>
                          Suggested: {overloadAnalysis.suggestedWeight} kg
                          {overloadAnalysis.suggestedReps ? ` × ${overloadAnalysis.suggestedReps} reps` : ''}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </Animated.View>
            )}

            {chartMode === 'heatmap' && (
              <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.chartCard}>
                <Text style={styles.chartTitle}>Muscle Recovery Heatmap</Text>
                <Text style={styles.chartSubtitle}>Based on volume from the last 7 days</Text>
                <MuscleHeatmap fatigueLevels={calculateFatigueLevels()} />
              </Animated.View>
            )}
          </>
        )}

        {chartMode === 'volume' && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Recent Volume</Text>
              {renderVolumeChart()}
            </View>
            
            {/* Muscle Group Distribution */}
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Volume Distribution</Text>
              <View style={{ marginTop: Spacing.lg }}>
                {(() => {
                  const muscleVolumes: Record<string, number> = {};
                  workouts.forEach(w => {
                    w.muscle_groups.forEach(mg => {
                      muscleVolumes[mg] = (muscleVolumes[mg] || 0) + w.total_volume_kg;
                    });
                  });
                  const maxVol = Math.max(...Object.values(muscleVolumes), 1);
                  const muscleColors: Record<string, string> = {
                    chest: muscle.chest, back: muscle.back, shoulders: muscle.shoulders,
                    quadriceps: muscle.legs, hamstrings: muscle.legs, biceps: muscle.arms,
                    triceps: muscle.arms, core: muscle.core, glutes: muscle.legs, calves: muscle.legs,
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
                                backgroundColor: muscleColors[muscle] || status.info,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.muscleVolumeValue}>{Math.round(vol)} kg</Text>
                      </View>
                    ));
                })()}
              </View>
            </View>
          </Animated.View>
        )}

        {/* 1RM Percentage Calculator Card */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={{ marginHorizontal: 0, marginTop: Spacing.xl }}>
          <Text style={styles.sectionTitle}>1RM Percentage Calculator</Text>
          <View style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: BorderRadius.xl,
            padding: Spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            ...Shadows.md
          }}>
            <Text style={{ color: text.secondary, fontSize: 13, marginBottom: 12, fontStyle: 'italic' }}>
              Estimate your strength and training intensity targets using Epley's formula.
            </Text>

            {/* Inputs */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: text.secondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Weight (kg)</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: BorderRadius.md,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    color: text.primary,
                    fontWeight: 'bold',
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                  value={calcWeight}
                  onChangeText={setCalcWeight}
                  keyboardType="numeric"
                  placeholder="100"
                  placeholderTextColor={text.tertiary}
                  selectTextOnFocus
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ color: text.secondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Reps</Text>
                <TextInput
                  style={{
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: BorderRadius.md,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    color: text.primary,
                    fontWeight: 'bold',
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                  value={calcReps}
                  onChangeText={setCalcReps}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor={text.tertiary}
                  selectTextOnFocus
                />
              </View>
            </View>

            {/* Estimated 1RM Hero */}
            <View style={{
              backgroundColor: colors.surfaceHighlight,
              borderRadius: BorderRadius.lg,
              padding: 16,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: colors.border
            }}>
              <Text style={{ color: text.tertiary, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 4 }}>
                ESTIMATED 1-REP MAX
              </Text>
              <Text style={{ color: accent.red, fontSize: 32, fontWeight: 'bold' }}>
                {oneRepMaxVal > 0 ? `${oneRepMaxVal.toFixed(1)} kg` : '--'}
              </Text>
            </View>

            {/* Intensity Table */}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 6 }}>
                <Text style={{ color: text.tertiary, fontSize: 11, fontWeight: 'bold' }}>INTENSITY %</Text>
                <Text style={{ color: text.tertiary, fontSize: 11, fontWeight: 'bold', width: 80, textAlign: 'center' }}>REPS</Text>
                <Text style={{ color: text.tertiary, fontSize: 11, fontWeight: 'bold', textAlign: 'right' }}>TARGET WEIGHT</Text>
              </View>

              {[
                { pct: 100, reps: '1 rep' },
                { pct: 95, reps: '2 reps' },
                { pct: 90, reps: '3-4 reps' },
                { pct: 85, reps: '5-6 reps' },
                { pct: 80, reps: '7-8 reps' },
                { pct: 75, reps: '9-10 reps' },
                { pct: 70, reps: '11-12 reps' },
                { pct: 65, reps: '13-15 reps' }
              ].map((row, index) => {
                const weight = oneRepMaxVal * (row.pct / 100);
                return (
                  <View
                    key={row.pct}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 8,
                      backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      borderBottomWidth: index === 7 ? 0 : 1,
                      borderBottomColor: colors.border && 'rgba(255,255,255,0.03)'
                    }}
                  >
                    <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 13 }}>
                      {row.pct}%
                    </Text>
                    <Text style={{ color: text.secondary, fontSize: 12, width: 80, textAlign: 'center' }}>
                      {row.reps}
                    </Text>
                    <Text style={{ color: accent.red, fontWeight: 'bold', fontSize: 13, textAlign: 'right' }}>
                      {weight > 0 ? `${weight.toFixed(1)} kg` : '--'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* AI Plateau Solver Card */}
        <Animated.View entering={FadeInDown.delay(280).springify()} style={{ marginHorizontal: 0, marginTop: Spacing.xl }}>
          <Text style={styles.sectionTitle}>AI Plateau Solver</Text>
          <View style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: BorderRadius.xl,
            padding: Spacing.lg,
            borderWidth: 1,
            borderColor: colors.border,
            ...Shadows.md
          }}>
            <Text style={{ color: text.secondary, fontSize: 13, marginBottom: 16, fontStyle: 'italic' }}>
              Let Gemini analyze your progression logs to identify lifts stuck in plateau and automatically generate stabilizer-based breakthrough routines.
            </Text>

            {/* Audit CTA */}
            {!plateauResult && !auditingPlateaus && (
              <TouchableOpacity
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  borderWidth: 1,
                  borderColor: '#EAB308',
                  borderRadius: BorderRadius.md,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8
                }}
                onPress={handlePlateauAudit}
              >
                <TrendingUp size={18} color="#EAB308" />
                <Text style={{ color: '#EAB308', fontWeight: 'bold' }}>Run AI Diagnostics Audit</Text>
              </TouchableOpacity>
            )}

            {/* Loading Auditing Status */}
            {auditingPlateaus && (
              <View style={{ paddingVertical: 20, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <ActivityIndicator color="#EAB308" />
                <Text style={{ color: text.secondary, fontSize: 13, fontStyle: 'italic', textAlign: 'center' }}>
                  Reading 30 days of workouts... analyzing progressive overload patterns... consulting stabilizer biomechanics...
                </Text>
              </View>
            )}

            {/* Diagnostics Report & Breakthrough Workout */}
            {plateauResult && (
              <View>
                {plateauResult.error ? (
                  <View style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: BorderRadius.md,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    marginBottom: 20
                  }}>
                    <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                      Plateau Analysis Failed
                    </Text>
                    <Text style={{ color: text.secondary, fontSize: 13, lineHeight: 18 }}>
                      {plateauResult.message}
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Diagnostics Header Badge */}
                    <View style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: 'rgba(234, 179, 8, 0.1)',
                      borderRadius: BorderRadius.md,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(234, 179, 8, 0.3)',
                      marginBottom: 16
                    }}>
                      <View>
                        <Text style={{ color: text.tertiary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>
                          AUDITED EXERCISE
                        </Text>
                        <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>
                          {plateauResult.exercise_name}
                        </Text>
                      </View>
                      <View style={{
                        backgroundColor: plateauResult.recommended_action === 'deload' ? '#EF4444' : '#EAB308',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8
                      }}>
                        <Text style={{ color: '#1E1B18', fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' }}>
                          {plateauResult.recommended_action.replace('_', ' ')}
                        </Text>
                      </View>
                    </View>

                    {/* Biomechanical Analysis Report */}
                    <Text style={{ color: text.secondary, fontSize: 13, lineHeight: 18, marginBottom: 20 }}>
                      <Text style={{ color: '#EAB308', fontWeight: 'bold' }}>AI Audit Analysis: </Text>
                      "{plateauResult.analysis_report}"
                    </Text>
                  </>
                )}

                {/* AI Breakthrough Workout Routine Card */}
                {!plateauResult.error && plateauResult.ai_workout_template && (
                  <View style={{
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: BorderRadius.md,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: 20
                  }}>
                    <Text style={{ color: '#EAB308', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase', marginBottom: 10 }}>
                      Breakthrough Workout Session
                    </Text>
                    <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 15, marginBottom: 12 }}>
                      Session: {plateauResult.ai_workout_template.name}
                    </Text>

                    {/* Exercises list */}
                    <View style={{ gap: 8, marginBottom: 14 }}>
                      {plateauResult.ai_workout_template.exercises.map((ex: any, idx: number) => (
                        <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: text.primary, fontSize: 13 }}>{ex.name}</Text>
                          <Text style={{ color: text.secondary, fontSize: 12, fontWeight: '600' }}>
                            {ex.sets} sets × {ex.reps} reps
                          </Text>
                        </View>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={{
                        backgroundColor: '#EAB308',
                        borderRadius: 8,
                        paddingVertical: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6
                      }}
                      onPress={handleSaveBreakthroughWorkout}
                      disabled={savingBreakthrough}
                    >
                      {savingBreakthrough ? (
                        <ActivityIndicator color="#1E1B18" />
                      ) : (
                        <>
                          <Plus size={16} color="#1E1B18" strokeWidth={3} />
                          <Text style={{ color: '#1E1B18', fontWeight: 'bold', fontSize: 13 }}>Save Breakthrough Workout</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Run Audit Again */}
                <TouchableOpacity
                  style={{ alignSelf: 'center' }}
                  onPress={handlePlateauAudit}
                >
                  <Text style={{ color: text.tertiary, fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' }}>
                    Re-Audit Training Logs
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Personal Records */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>All-Time PRs</Text>
          {prs.length === 0 ? (
            <View style={styles.emptyPRs}>
              <Text style={styles.emptyPRsText}>Log workouts to set PRs!</Text>
            </View>
          ) : (
            prs.slice(0, 10).map((pr, idx) => (
              <View key={pr.id || idx} style={styles.prCard}>
                <View style={styles.prRank}>
                  {pr.record_type === '1rm' ? <Trophy size={20} color={status.warning} /> : 
                   pr.record_type === 'volume' ? <Activity size={20} color={status.info} /> : 
                   <Flame size={20} color={accent.red} />}
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
        </Animated.View>

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
    marginBottom: Spacing['xl'],
    letterSpacing: -0.5,
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
  
  // Mode Selector
  modeSelectorRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: 6,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  modeButtonActive: {
    backgroundColor: colors.surfaceHighlight,
    ...Shadows.sm,
  },
  modeButtonText: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  modeButtonTextActive: {
    color: text.primary,
    fontWeight: FontWeight.bold,
  },

  // Exercise selector
  exerciseSelector: {
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  exercisePill: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exercisePillActive: {
    backgroundColor: accent.red,
    borderColor: accent.red,
  },
  exercisePillText: {
    color: text.secondary,
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
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  timeRangeButtonActive: {
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.border,
  },
  timeRangeText: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  timeRangeTextActive: {
    color: text.primary,
    fontWeight: FontWeight.bold,
  },

  // Chart
  chartCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.md,
  },
  chartTitle: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  chartSubtitle: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  chartEmpty: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },

  // Analysis card
  analysisCard: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.md,
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
    color: text.secondary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  suggestionText: {
    color: status.warning,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },

  // PRs
  emptyPRs: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyPRsText: {
    color: text.tertiary,
    fontSize: FontSize.md,
  },
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  prRank: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  prInfo: {
    flex: 1,
  },
  prExercise: {
    color: text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  prType: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  prValueBox: {
    alignItems: 'flex-end',
  },
  prValue: {
    color: text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
  },
  prUnit: {
    color: text.tertiary,
    fontSize: FontSize.xs,
  },

  // Muscle volume
  muscleVolumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  muscleVolumeName: {
    color: text.primary,
    fontSize: FontSize.sm,
    width: 85,
    fontWeight: FontWeight.bold,
  },
  muscleVolumeBarBg: {
    flex: 1,
    height: 14,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 7,
    overflow: 'hidden',
    marginHorizontal: Spacing.sm,
  },
  muscleVolumeBarFill: {
    height: '100%',
    borderRadius: 7,
  },
  muscleVolumeValue: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    width: 55,
    textAlign: 'right',
    fontWeight: FontWeight.semibold,
  },

  // Paywall
  paywallCard: {
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

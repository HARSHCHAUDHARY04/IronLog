// ═══════════════════════════════════════════════════════
// Home Dashboard — IronLog's Main Screen
// Features: greeting, streak, volume stats, recent PRs,
// quick workout start, and suggested workout
// ═══════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { WeeklyReport, getCachedReport, generateWeeklyReport } from '../../lib/weeklyReport';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { 
  User, Dumbbell, PlusCircle, Flame, Calendar, 
  TrendingUp, ArrowUp, ArrowDown, Clock, Activity, 
  Trophy, Target, ChevronRight, Sparkles, Play
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { generateGeminiContent } from '../../lib/gemini';
import { useFocusEffect } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  FadeInDown
} from 'react-native-reanimated';
import { useThemeColor, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Fonts, getMuscleColor } from '../../lib/theme';
import { ProgressRing, SectionHeader } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getWorkoutStats, getTemplates, getPRs, getWorkouts, type PRRecord, type WorkoutTemplate, type Workout } from '../../lib/storage';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateStr, startOfWeek as getStartOfWeek, addDays } from '../../lib/date';
import { useUnit, toDisplayWeight, displayWeight } from '../../lib/units';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const unit = useUnit();
  const { colors, text, accent, status, muscle, isDark, gradients } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle, isDark), [colors, text, accent, status, muscle, isDark]);

  const router = useRouter();
  const { user } = useAuthStore();
  const { weeklyGoal } = useSettingsStore();
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
    thisWeekWorkouts: 0,
  });
  const [recentPRs, setRecentPRs] = useState<PRRecord[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [lastWorkout, setLastWorkout] = useState<Workout | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sessionPRs, setSessionPRs] = useState<any[]>([]);
  const [showPRModal, setShowPRModal] = useState(false);

  // AI Weekly Report States
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // AI Meal Scanner States
  const [dailyMacros, setDailyMacros] = useState({ protein: 0, carbs: 0, fat: 0, calories: 0 });
  const [showMealModal, setShowMealModal] = useState(false);
  const [selectedMealPreset, setSelectedMealPreset] = useState<string>('');
  const [customMealText, setCustomMealText] = useState('');
  const [scanningMeal, setScanningMeal] = useState(false);
  const [scannedMealResult, setScannedMealResult] = useState<any | null>(null);
  

  const handleGenerateReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const report = await generateWeeklyReport();
      setWeeklyReport(report);
    } catch (e) {
      Alert.alert('AI Report Error', 'Could not generate report. Check your API key.');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [s, prs, tmpl, workoutsList] = await Promise.all([
        getWorkoutStats(),
        getPRs(),
        getTemplates(),
        getWorkouts(),
      ]);
      setStats(s);
      setRecentPRs(prs.slice(0, 5));
      setTemplates(tmpl);
      setLastWorkout(workoutsList.length > 0 ? workoutsList[0] : null);
      setWorkouts(workoutsList);
      
      // Check for transient session PRs achieved
      const stored = await AsyncStorage.getItem('ironlog_session_prs');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.length > 0) {
          setSessionPRs(parsed);
          setShowPRModal(true);
        }
        await AsyncStorage.removeItem('ironlog_session_prs');
      }

      // Daily macros reset at local midnight
      const storedMacros = await AsyncStorage.getItem('ironlog_daily_macros');
      const storedMacrosDate = await AsyncStorage.getItem('ironlog_daily_macros_date');
      const todayStr = toLocalDateStr();

      if (storedMacros && storedMacrosDate === todayStr) {
        setDailyMacros(JSON.parse(storedMacros));
      } else {
        const cleared = { protein: 0, carbs: 0, fat: 0, calories: 0 };
        setDailyMacros(cleared);
        await AsyncStorage.setItem('ironlog_daily_macros', JSON.stringify(cleared));
        await AsyncStorage.setItem('ironlog_daily_macros_date', todayStr);
      }

      const cachedReport = await getCachedReport();
      if (cachedReport) setWeeklyReport(cachedReport);
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
  }, []);

  const handleScanMeal = async (mealDescription: string) => {
    if (!mealDescription.trim()) return;
    setScanningMeal(true);
    setScannedMealResult(null);

    const payload = {
      systemInstruction: { parts: [{ text: 'You are a sports nutritionist. Analyze the meal the user describes and return estimated calories, protein (g), carbs (g), fat (g), and a short 1-sentence tactical coaching advice. If the text is not a meal, return zeros.' }] },
      contents: [{ role: 'user' as const, parts: [{ text: mealDescription.slice(0, 500) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            meal_name: { type: 'STRING' },
            calories: { type: 'INTEGER' },
            protein_g: { type: 'INTEGER' },
            carbs_g: { type: 'INTEGER' },
            fat_g: { type: 'INTEGER' },
            coaching_advice: { type: 'STRING' }
          },
          required: ['meal_name', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'coaching_advice']
        }
      }
    };

    try {
      const responseData = await generateGeminiContent(payload);
      const textResponse = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsed = JSON.parse(textResponse);
        setScannedMealResult(parsed);
        
        const updated = {
          protein: dailyMacros.protein + (parsed.protein_g || 0),
          carbs: dailyMacros.carbs + (parsed.carbs_g || 0),
          fat: dailyMacros.fat + (parsed.fat_g || 0),
          calories: dailyMacros.calories + (parsed.calories || 0),
        };
        
        setDailyMacros(updated);
        await AsyncStorage.setItem('ironlog_daily_macros', JSON.stringify(updated));
        await AsyncStorage.setItem('ironlog_daily_macros_date', toLocalDateStr());
      }
    } catch (err) {
      console.error(err);
      Alert.alert(
        'AI Scanner Unavailable',
        'Could not analyze the meal. Please make sure your API key is configured or try again later.'
      );
      setScannedMealResult({
        error: true,
        message: 'Could not connect to Gemini AI services.'
      });
    } finally {
      setScanningMeal(false);
    }
  };

  const handleClearMacros = async () => {
    const cleared = { protein: 0, carbs: 0, fat: 0, calories: 0 };
    setDailyMacros(cleared);
    await AsyncStorage.setItem('ironlog_daily_macros', JSON.stringify(cleared));
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const getWorkoutsForWeekDays = React.useMemo(() => {
    const startOfWeek = getStartOfWeek();
    const workoutDates = new Set(workouts.map(w => w.workout_date));

    const days: { date: Date; hasWorkout: boolean; label: string }[] = [];
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    for (let i = 0; i < 7; i++) {
      const date = addDays(startOfWeek, i);
      const hasWorkout = workoutDates.has(toLocalDateStr(date));

      days.push({
        date,
        hasWorkout,
        label: dayLabels[i]
      });
    }

    return days;
  }, [workouts]);


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
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const muscleTint = getMuscleColor;

  const volumeChange = stats.lastWeekVolume > 0
    ? Math.round(((stats.thisWeekVolume - stats.lastWeekVolume) / stats.lastWeekVolume) * 100)
    : 0;

  const formatVolume = (kg: number) => {
    const v = toDisplayWeight(kg, unit);
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return Math.round(v).toString();
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
            tintColor={accent.red}
            colors={[accent.red]}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(60).springify()} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateEyebrow}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.greeting} numberOfLines={1}>
              {getGreeting()}, <Text style={{ color: accent.red }}>{(user?.name || 'Lifter').split(' ')[0]}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
          >
            <LinearGradient colors={gradients.ember as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || 'L').charAt(0).toUpperCase()}</Text>
            </LinearGradient>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{user?.level || 1}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Hero: streak + weekly goal ring */}
        <Animated.View entering={FadeInDown.delay(120).springify()}>
          <LinearGradient
            colors={(isDark ? gradients.heroDark : gradients.heroLight) as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.heroEyebrowRow}>
                  <Flame size={16} color={accent.red} fill={stats.currentStreak > 0 ? accent.red : 'transparent'} />
                  <Text style={styles.heroEyebrow}>Current streak</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.heroNumber}>{stats.currentStreak}</Text>
                  <Text style={styles.heroNumberUnit}>{stats.currentStreak === 1 ? 'day' : 'days'}</Text>
                </View>
                <Text style={styles.heroCaption}>
                  {stats.currentStreak > 0
                    ? `Best: ${Math.max(stats.longestStreak, stats.currentStreak)} days · keep it alive`
                    : 'Log a workout to start a streak'}
                </Text>
              </View>

              <ProgressRing progress={stats.thisWeekWorkouts / Math.max(1, weeklyGoal)} size={104} strokeWidth={10}>
                <Text style={styles.ringValue}>
                  {stats.thisWeekWorkouts}
                  <Text style={styles.ringTotal}>/{weeklyGoal}</Text>
                </Text>
                <Text style={styles.ringLabel}>this week</Text>
              </ProgressRing>
            </View>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{formatVolume(stats.thisWeekVolume)}</Text>
                <Text style={styles.heroStatLabel}>{unit} this week</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  {volumeChange !== 0 && (volumeChange > 0
                    ? <ArrowUp size={16} color={status.success} />
                    : <ArrowDown size={16} color={status.regression} />)}
                  <Text style={[styles.heroStatValue, volumeChange > 0 && { color: status.success }, volumeChange < 0 && { color: status.regression }]}>
                    {stats.lastWeekVolume > 0 ? `${Math.abs(volumeChange)}%` : '—'}
                  </Text>
                </View>
                <Text style={styles.heroStatLabel}>vs last week</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{stats.totalWorkouts}</Text>
                <Text style={styles.heroStatLabel}>sessions</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Week strip */}
        <Animated.View entering={FadeInDown.delay(180).springify()} style={styles.card}>
          <View style={styles.weekRow}>
            {getWorkoutsForWeekDays.map((day, idx) => {
              const isToday = toLocalDateStr() === toLocalDateStr(day.date);
              return (
                <View key={idx} style={styles.weekDay}>
                  <Text style={[styles.weekLabel, isToday && { color: accent.red }]}>{day.label}</Text>
                  {day.hasWorkout ? (
                    <LinearGradient colors={gradients.ember as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.weekDot}>
                      <Flame size={15} color="#fff" fill="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={[styles.weekDot, styles.weekDotEmpty, isToday && styles.weekDotToday]}>
                      <Text style={[styles.weekDate, isToday && { color: accent.red }]}>{day.date.getDate()}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Primary CTA */}
        <Animated.View entering={FadeInDown.delay(240).springify()}>
          <TouchableOpacity onPress={handleStartWorkout} activeOpacity={0.88} style={styles.ctaShadow}>
            <LinearGradient colors={gradients.ember as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
              <View>
                <Text style={styles.ctaEyebrow}>{isActive ? 'Workout in progress' : 'Ready when you are'}</Text>
                <Text style={styles.ctaTitle}>{isActive ? 'Resume session' : 'Start workout'}</Text>
              </View>
              <View style={styles.ctaIcon}>
                {isActive ? <Dumbbell size={22} color={accent.red} /> : <Play size={22} color={accent.red} fill={accent.red} />}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Routines */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
          <SectionHeader title="Quick start" actionLabel="All routines" onAction={() => router.push('/(tabs)/workout')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.md, paddingRight: Spacing.lg }} style={styles.templateScroll}>
            {templates.slice(0, 6).map((template) => {
              const tint = muscleTint(template.muscle_groups[0]);
              return (
                <TouchableOpacity
                  key={template.id}
                  style={styles.templateCard}
                  onPress={() => handleStartTemplate(template)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.templateAccent, { backgroundColor: tint }]} />
                  <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                  <Text style={styles.templateMeta} numberOfLines={1}>
                    {template.muscle_groups.slice(0, 3).map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(' · ')}
                  </Text>
                  <View style={styles.templateFooter}>
                    <Text style={styles.templateCount}>{template.exercises.length} exercises</Text>
                    <View style={[styles.templatePlay, { backgroundColor: `${tint}22` }]}>
                      <Play size={12} color={tint} fill={tint} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Nutrition */}
        <Animated.View entering={FadeInDown.delay(340).springify()} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Sparkles size={16} color={status.warning} />
              <Text style={styles.cardTitle}>Today's nutrition</Text>
            </View>
            {dailyMacros.calories > 0 && (
              <TouchableOpacity onPress={handleClearMacros} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: text.tertiary, fontSize: 12, fontWeight: '700' }}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.macroRow}>
            {[
              { label: 'kcal', val: dailyMacros.calories, color: text.primary },
              { label: 'protein', val: `${dailyMacros.protein}g`, color: accent.red },
              { label: 'carbs', val: `${dailyMacros.carbs}g`, color: status.success },
              { label: 'fat', val: `${dailyMacros.fat}g`, color: status.warning },
            ].map(macro => (
              <View key={macro.label} style={styles.macro}>
                <Text style={[styles.macroValue, { color: macro.color }]}>{macro.val}</Text>
                <Text style={styles.macroLabel}>{macro.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setScannedMealResult(null);
              setSelectedMealPreset('');
              setCustomMealText('');
              setShowMealModal(true);
            }}
            activeOpacity={0.8}
          >
            <PlusCircle size={16} color={text.primary} />
            <Text style={styles.secondaryButtonText}>Log a meal with AI</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* AI Weekly Report Card */}
        <Animated.View entering={FadeInDown.delay(380).springify()}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Sparkles size={16} color={accent.red} />
                <Text style={styles.cardTitle}>Weekly coach report</Text>
              </View>
              {weeklyReport && (
                <LinearGradient colors={gradients.ember as any} style={styles.gradeBadge}>
                  <Text style={styles.gradeText}>{weeklyReport.grade}</Text>
                </LinearGradient>
              )}
            </View>

            {weeklyReport ? (
              <View>
                <Text style={{ color: text.secondary, fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
                  {weeklyReport.summary}
                </Text>
                
                {weeklyReport.highlights.length > 0 && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ color: status.success, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Highlights</Text>
                    {weeklyReport.highlights.map((h, i) => (
                      <Text key={i} style={{ color: text.secondary, fontSize: 12, lineHeight: 18, marginBottom: 3 }}>✦ {h}</Text>
                    ))}
                  </View>
                )}

                {weeklyReport.recommendations.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Recommendations</Text>
                    {weeklyReport.recommendations.map((r, i) => (
                      <Text key={i} style={{ color: text.secondary, fontSize: 12, lineHeight: 18, marginBottom: 3 }}>→ {r}</Text>
                    ))}
                  </View>
                )}

                <Text style={{ color: text.tertiary, fontSize: 10, fontStyle: 'italic', marginTop: 4 }}>{weeklyReport.muscle_balance}</Text>
                
                <TouchableOpacity 
                  onPress={handleGenerateReport}
                  style={{ marginTop: 12, alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}
                >
                  <Text style={{ color: accent.red, fontSize: 12, fontWeight: 'bold' }}>Regenerate Report</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.cardBody}>
                  Get a grade, highlights and next steps based on this week's training.
                </Text>
                <TouchableOpacity
                  onPress={handleGenerateReport}
                  disabled={loadingReport}
                  style={[styles.secondaryButton, loadingReport && { opacity: 0.7 }]}
                  activeOpacity={0.8}
                >
                  {loadingReport ? (
                    <>
                      <ActivityIndicator size="small" color={text.primary} />
                      <Text style={styles.secondaryButtonText}>Analyzing your training…</Text>
                    </>
                  ) : (
                    <Text style={styles.secondaryButtonText}>Generate report</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>

        {/* Recent PRs */}
        {recentPRs.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.section}>
            <SectionHeader title="Recent PRs" actionLabel="Analytics" onAction={() => router.push('/(tabs)/analytics')} />
            {recentPRs.slice(0, 3).map((pr, idx) => (
              <View key={pr.id || idx} style={styles.prCard}>
                <View style={styles.prIcon}>
                  {pr.record_type === '1rm' ? <Trophy size={20} color={status.warning} /> : 
                   pr.record_type === 'volume' ? <Activity size={20} color={status.info} /> : 
                   <Flame size={20} color={accent.red} />}
                </View>
                <View style={styles.prInfo}>
                  <Text style={styles.prExercise} numberOfLines={1}>{pr.exercise_name}</Text>
                  <Text style={styles.prType}>
                    {pr.record_type === '1rm' ? 'Estimated 1RM' : pr.record_type === 'volume' ? 'Session volume' : 'Rep record'}
                    {pr.improvement_pct ? <Text style={{ color: status.success }}>{`  +${pr.improvement_pct}%`}</Text> : null}
                  </Text>
                </View>
                <Text style={styles.prValue}>
                  {pr.record_type === 'reps' ? `${pr.value}` : toDisplayWeight(pr.value).toFixed(pr.record_type === '1rm' ? 1 : 0)}
                  <Text style={styles.prUnit}> {pr.record_type === 'reps' ? 'reps' : unit}</Text>
                </Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Empty state for new users */}
        {stats.totalWorkouts === 0 && (
          <View style={styles.emptyState}>
            <Dumbbell size={48} color={text.tertiary} style={{ marginBottom: Spacing.lg }} />
            <Text style={styles.emptyTitle}>Ready to Train?</Text>
            <Text style={styles.emptyText}>
              Your fitness journey begins with a single rep.{'\n'}
              Tap "Start workout" above to log your first session.
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* AI Meal Scanner Modal */}
      <Modal
        visible={showMealModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={{ flex: 1, backgroundColor: colors.background, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: text.primary, fontSize: 20, fontWeight: 'bold' }}>AI Plate Scanner</Text>
            <TouchableOpacity onPress={() => setShowMealModal(false)}>
              <Text style={{ color: text.secondary, fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: text.secondary, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>
              Select a Preset Dish to Scan:
            </Text>

            <View style={{ gap: 10, marginBottom: 20 }}>
              {[
                { name: 'Grilled Chicken & Rice', desc: '150g cooked breast + 1 cup jasmine rice, broccoli' },
                { name: 'Avocado Toast & Eggs', desc: '2 sourdough slices, 1/2 avocado, 2 poached eggs' },
                { name: 'Double Pepperoni Pizza', desc: '2 premium hand-tossed slices' }
              ].map(preset => {
                const isSelected = selectedMealPreset === preset.name;
                return (
                  <TouchableOpacity
                    key={preset.name}
                    style={{
                      backgroundColor: isSelected ? 'rgba(234, 179, 8, 0.1)' : colors.surface,
                      borderRadius: BorderRadius.md,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: isSelected ? '#EAB308' : colors.border
                    }}
                    onPress={() => {
                      setSelectedMealPreset(preset.name);
                      setCustomMealText(preset.desc);
                    }}
                  >
                    <Text style={{ color: isSelected ? '#EAB308' : text.primary, fontWeight: 'bold', fontSize: 15, marginBottom: 2 }}>
                      {preset.name}
                    </Text>
                    <Text style={{ color: text.secondary, fontSize: 12 }}>
                      {preset.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ color: text.secondary, fontSize: 14, fontWeight: '600', marginBottom: 8 }}>
              Or Describe Custom Plate:
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surfaceHighlight,
                borderRadius: BorderRadius.md,
                padding: 12,
                color: text.primary,
                minHeight: 80,
                borderWidth: 1,
                borderColor: colors.border,
                textAlignVertical: 'top',
                marginBottom: 20
              }}
              multiline
              placeholder="e.g. 1 scoop whey protein + 250ml oat milk + 1 banana"
              placeholderTextColor={text.tertiary}
              value={customMealText}
              onChangeText={text => {
                setCustomMealText(text);
                setSelectedMealPreset('');
              }}
            />

            <TouchableOpacity
              style={{
                backgroundColor: '#EAB308',
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                shadowColor: '#EAB308',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 6,
                elevation: 4,
                marginBottom: 24
              }}
              onPress={() => handleScanMeal(customMealText)}
              disabled={scanningMeal}
            >
              {scanningMeal ? (
                <ActivityIndicator color="#1E1B18" />
              ) : (
                <>
                  <Sparkles size={18} color="#1E1B18" />
                  <Text style={{ color: '#1E1B18', fontSize: 16, fontWeight: 'bold' }}>Scan Plate with Gemini AI</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Scan Results */}
            {scannedMealResult && (
              <Animated.View entering={FadeInDown.springify()} style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: BorderRadius.lg,
                padding: 16,
                borderWidth: 1,
                borderColor: scannedMealResult.error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                marginBottom: 40
              }}>
                {scannedMealResult.error ? (
                  <>
                    <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                      Scan Failed
                    </Text>
                    <Text style={{ color: text.secondary, fontSize: 13, lineHeight: 18 }}>
                      {scannedMealResult.message}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={{ color: '#EAB308', fontWeight: 'bold', fontSize: 16, marginBottom: 12 }}>
                      Gemini Scan Analysis Result:
                    </Text>
                    <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>
                      Meal: {scannedMealResult.meal_name}
                    </Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 16 }}>
                      {[
                        { label: 'Calories', val: `${scannedMealResult.calories} kcal`, color: '#3B82F6' },
                        { label: 'Protein', val: `${scannedMealResult.protein_g}g`, color: '#EF4444' },
                        { label: 'Carbs', val: `${scannedMealResult.carbs_g}g`, color: '#10B981' },
                        { label: 'Fat', val: `${scannedMealResult.fat_g}g`, color: '#F59E0B' }
                      ].map(macro => (
                        <View key={macro.label} style={{
                          flex: 1,
                          backgroundColor: colors.surfaceHighlight,
                          borderRadius: BorderRadius.md,
                          padding: 8,
                          alignItems: 'center'
                        }}>
                          <Text style={{ color: text.tertiary, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>{macro.label}</Text>
                          <Text style={{ color: macro.color, fontSize: 12, fontWeight: 'bold' }}>{macro.val}</Text>
                        </View>
                      ))}
                    </View>

                    <Text style={{ color: text.secondary, fontSize: 13, fontStyle: 'italic', lineHeight: 18 }}>
                      Coach Tip: "{scannedMealResult.coaching_advice}"
                    </Text>
                  </>
                )}
              </Animated.View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* PR Celebration Modal Overlay */}
      <Modal
        visible={showPRModal}
        transparent={true}
        animationType="fade"
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24
        }}>
          {/* Glowing Golden Trophy Card */}
          <Animated.View 
            entering={FadeInDown.springify()}
            style={{
              width: '100%',
              backgroundColor: '#1E1B18', // Deep brown/black premium look
              borderRadius: 24,
              borderWidth: 2,
              borderColor: '#EAB308', // Glowing gold
              padding: 24,
              alignItems: 'center',
              shadowColor: '#EAB308',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.5,
              shadowRadius: 20,
              elevation: 10
            }}
          >
            {/* Triumphant Rotating / Pulser Icon */}
            <View style={{
              width: 90,
              height: 90,
              borderRadius: 45,
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              borderWidth: 1,
              borderColor: '#EAB308'
            }}>
              <Trophy size={48} color="#EAB308" />
            </View>

            <Text style={{
              color: '#EAB308',
              fontSize: 24,
              fontWeight: '900',
              letterSpacing: 1,
              textAlign: 'center',
              marginBottom: 8
            }}>
              NEW PERSONAL RECORD!
            </Text>

            <Text style={{
              color: text.secondary,
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 24,
              paddingHorizontal: 16
            }}>
              Unbelievable strength! You've broken through your limits and established new personal records:
            </Text>

            {/* List of achievements */}
            <View style={{ width: '100%', gap: 12, marginBottom: 30 }}>
              {sessionPRs.map((pr, idx) => (
                <View 
                  key={pr.id || idx}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(234, 179, 8, 0.2)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>
                      {pr.exercise_name}
                    </Text>
                    <Text style={{ color: text.tertiary, fontSize: 12 }}>
                      {pr.record_type === '1rm' ? 'Estimated 1-Rep Max' :
                       pr.record_type === 'volume' ? 'Total Session Volume' : 'Working Reps Max'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: '#EAB308', fontWeight: '900', fontSize: 18 }}>
                      {pr.record_type === 'reps' ? `${pr.value} reps` : displayWeight(pr.value)}
                    </Text>
                    {pr.improvement_pct && (
                      <View style={{
                        backgroundColor: 'rgba(34, 197, 94, 0.15)',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#22C55E'
                      }}>
                        <Text style={{ color: '#22C55E', fontWeight: 'bold', fontSize: 10 }}>
                          +{pr.improvement_pct}%
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Dismiss CTA */}
            <TouchableOpacity
              style={{
                width: '100%',
                backgroundColor: '#EAB308',
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#EAB308',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
                elevation: 4
              }}
              onPress={() => setShowPRModal(false)}
            >
              <Text style={{ color: '#1E1B18', fontSize: 16, fontWeight: 'bold' }}>
                Heck Yeah!
              </Text>
            </TouchableOpacity>
          </Animated.View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  dateEyebrow: {
    color: text.tertiary,
    fontFamily: Fonts.displayMedium,
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  greeting: {
    color: text.primary,
    fontFamily: Fonts.displayHeavy,
    fontSize: 34,
    lineHeight: 38,
    textTransform: 'uppercase',
  },
  avatarButton: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontFamily: Fonts.displayHeavy,
    fontSize: 24,
  },
  levelBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelBadgeText: {
    color: text.primary,
    fontFamily: Fonts.displayHeavy,
    fontSize: 13,
    lineHeight: 15,
  },

  // Hero
  hero: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,122,61,0.18)' : 'rgba(255,77,61,0.16)',
    marginBottom: Spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroEyebrow: {
    color: text.secondary,
    fontFamily: Fonts.displayMedium,
    fontSize: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroNumber: {
    color: text.primary,
    fontFamily: Fonts.displayHeavy,
    fontSize: 76,
    lineHeight: 80,
    marginTop: 2,
  },
  heroNumberUnit: {
    color: text.secondary,
    fontFamily: Fonts.display,
    fontSize: 22,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  heroCaption: {
    color: text.tertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  ringValue: {
    color: text.primary,
    fontFamily: Fonts.displayHeavy,
    fontSize: 30,
    lineHeight: 32,
  },
  ringTotal: {
    color: text.tertiary,
    fontSize: 20,
  },
  ringLabel: {
    color: text.tertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroStats: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,12,0.08)',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,12,0.08)',
  },
  heroStatValue: {
    color: text.primary,
    fontFamily: Fonts.displayHeavy,
    fontSize: 24,
    lineHeight: 26,
  },
  heroStatLabel: {
    color: text.tertiary,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // Generic card
  card: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: text.primary,
    fontFamily: Fonts.display,
    fontSize: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardBody: {
    color: text.secondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: Spacing.md,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  secondaryButtonText: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  gradeBadge: {
    minWidth: 40,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeText: {
    color: '#fff',
    fontFamily: Fonts.displayHeavy,
    fontSize: 18,
  },

  // Week strip
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    alignItems: 'center',
    gap: 8,
  },
  weekLabel: {
    color: text.tertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  weekDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotEmpty: {
    backgroundColor: colors.surfaceHighlight,
  },
  weekDotToday: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: accent.red,
  },
  weekDate: {
    color: text.secondary,
    fontSize: 13,
    fontWeight: '700',
  },

  // CTA
  ctaShadow: {
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
    shadowColor: accent.red,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  cta: {
    height: 76,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaEyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  ctaTitle: {
    color: '#fff',
    fontFamily: Fonts.displayHeavy,
    fontSize: 28,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  ctaIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },

  // Routines
  templateScroll: {
    marginHorizontal: -Spacing.lg,
    paddingLeft: Spacing.lg,
  },
  templateCard: {
    width: 168,
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  templateAccent: {
    width: 28,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.md,
  },
  templateName: {
    color: text.primary,
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  templateMeta: {
    color: text.tertiary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  templateFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  templateCount: {
    color: text.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  templatePlay: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 1,
  },

  // Nutrition
  macroRow: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  macro: {
    flex: 1,
    alignItems: 'center',
  },
  macroValue: {
    fontFamily: Fonts.displayHeavy,
    fontSize: 24,
    lineHeight: 26,
  },
  macroLabel: {
    color: text.tertiary,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // PRs
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: Spacing.md,
  },
  prIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prInfo: {
    flex: 1,
  },
  prExercise: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  prType: {
    color: text.tertiary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  prValue: {
    color: text.primary,
    fontFamily: Fonts.displayHeavy,
    fontSize: 24,
  },
  prUnit: {
    color: text.tertiary,
    fontFamily: Fonts.display,
    fontSize: 14,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    color: text.primary,
    fontFamily: Fonts.displayHeavy,
    fontSize: 28,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: text.secondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});

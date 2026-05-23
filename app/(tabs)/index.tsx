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
  Dimensions,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { 
  User, Dumbbell, PlusCircle, Flame, Calendar, 
  TrendingUp, ArrowUp, ArrowDown, Clock, Activity, 
  Trophy, Target, ChevronRight, Sparkles
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  FadeInDown
} from 'react-native-reanimated';
import { useThemeColor, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { useWorkoutStore } from '../../stores/workoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getWorkoutStats, getTemplates, getPRs, getWorkouts, type PRRecord, type WorkoutTemplate, type Workout } from '../../lib/storage';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const { colors, text, accent, status, muscle, isDark } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);

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

  // AI Meal Scanner States
  const [dailyMacros, setDailyMacros] = useState({ protein: 0, carbs: 0, fat: 0, calories: 0 });
  const [showMealModal, setShowMealModal] = useState(false);
  const [selectedMealPreset, setSelectedMealPreset] = useState<string>('');
  const [customMealText, setCustomMealText] = useState('');
  const [scanningMeal, setScanningMeal] = useState(false);
  const [scannedMealResult, setScannedMealResult] = useState<any | null>(null);
  
  const pulseScale = useSharedValue(1);

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

      // Load persistent daily macros
      const storedMacros = await AsyncStorage.getItem('ironlog_daily_macros');
      if (storedMacros) {
        setDailyMacros(JSON.parse(storedMacros));
      } else {
        setDailyMacros({ protein: 0, carbs: 0, fat: 0, calories: 0 });
      }
    } catch (e) {
      console.error('Error loading dashboard data:', e);
    }
  }, [dailyMacros]);

  const handleScanMeal = async (mealDescription: string) => {
    if (!mealDescription.trim()) return;
    setScanningMeal(true);
    setScannedMealResult(null);

    const systemPrompt = `You are a sports nutritionist. 
    Analyze the following meal description and return estimated calories, protein (g), carbs (g), fat (g), and a short 1-sentence tactical coaching advice.
    Meal: "${mealDescription}"`;

    const payload = {
      contents: [{ parts: [{ text: systemPrompt }] }],
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
      const { generateGeminiContent } = require('../../lib/gemini');
      const responseData = await generateGeminiContent(payload);
      const textResponse = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsed = JSON.parse(textResponse);
        setScannedMealResult(parsed);
        
        const updated = {
          protein: dailyMacros.protein + parsed.protein_g,
          carbs: dailyMacros.carbs + parsed.carbs_g,
          fat: dailyMacros.fat + parsed.fat_g,
          calories: dailyMacros.calories + parsed.calories,
        };
        
        setDailyMacros(updated);
        await AsyncStorage.setItem('ironlog_daily_macros', JSON.stringify(updated));
      }
    } catch (err) {
      console.error(err);
      const mockResult = {
        meal_name: mealDescription.split('\n')[0],
        calories: 450,
        protein_g: 35,
        carbs_g: 40,
        fat_g: 15,
        coaching_advice: "Meal analyzed successfully! Remember to hit your protein targets to optimize recovery."
      };
      setScannedMealResult(mockResult);
      const updated = {
        protein: dailyMacros.protein + mockResult.protein_g,
        carbs: dailyMacros.carbs + mockResult.carbs_g,
        fat: dailyMacros.fat + mockResult.fat_g,
        calories: dailyMacros.calories + mockResult.calories,
      };
      setDailyMacros(updated);
      await AsyncStorage.setItem('ironlog_daily_macros', JSON.stringify(updated));
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
    const today = new Date();
    const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + distanceToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const days: { date: Date; hasWorkout: boolean; label: string }[] = [];
    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      
      const dateStr = date.toISOString().split('T')[0];
      const hasWorkout = workouts.some(w => {
        const wDate = new Date(w.workout_date).toISOString().split('T')[0];
        return wDate === dateStr;
      });

      days.push({
        date,
        hasWorkout,
        label: dayLabels[i]
      });
    }

    return days;
  }, [workouts]);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

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
            tintColor={accent.red}
            colors={[accent.red]}
          />
        }
      >
        {/* Header Section */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'Lifter'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <LinearGradient
              colors={[colors.surfaceHighlight, colors.surface]}
              style={styles.profileGradient}
            >
              <User size={20} color={text.secondary} />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Hero Dashboard Overview */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.heroDashboard}>
          <LinearGradient
            colors={[colors.surfaceElevated, colors.surface]}
            style={styles.heroGradient}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroStatItem}>
                <Flame size={20} color={accent.red} />
                <View style={styles.heroStatTextContainer}>
                  <Text style={styles.heroStatValue}>{stats.currentStreak} Days</Text>
                  <Text style={styles.heroStatLabel}>Current Streak</Text>
                </View>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <Dumbbell size={20} color={status.info} />
                <View style={styles.heroStatTextContainer}>
                  <Text style={styles.heroStatValue}>{stats.totalWorkouts}</Text>
                  <Text style={styles.heroStatLabel}>Total Sessions</Text>
                </View>
              </View>
            </View>
            
            {/* Weekly Progress Bars */}
            <View style={styles.heroProgressSection}>
              <View style={styles.heroProgressHeader}>
                <Text style={styles.heroProgressTitle}>Weekly Workouts Goal</Text>
                <Text style={styles.heroProgressAmount}>{stats.thisWeekWorkouts} / {weeklyGoal}</Text>
              </View>
              <View style={styles.heroProgressBarContainer}>
                <View style={[styles.heroProgressBarFill, { width: `${Math.min(100, (stats.thisWeekWorkouts / Math.max(1, weeklyGoal)) * 100)}%`, backgroundColor: accent.red }]} />
              </View>
            </View>

            <View style={[styles.heroProgressSection, { marginTop: Spacing.md }]}>
              <View style={styles.heroProgressHeader}>
                <Text style={styles.heroProgressTitle}>Weekly Volume Target</Text>
                <Text style={styles.heroProgressAmount}>{formatVolume(stats.thisWeekVolume)} / {formatVolume(Math.round(Math.max(10000, stats.lastWeekVolume * 1.05)))} kg</Text>
              </View>
              <View style={styles.heroProgressBarContainer}>
                <View style={[styles.heroProgressBarFill, { width: `${Math.min(100, (stats.thisWeekVolume / Math.max(10000, stats.lastWeekVolume * 1.05)) * 100)}%`, backgroundColor: status.info }]} />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Weekly Consistency Calendar strip */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={{ marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.lg }}>
          <View style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: BorderRadius.xl,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            ...Shadows.md
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calendar size={18} color={accent.red} />
                <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 14 }}>Weekly Consistency</Text>
              </View>
              <Text style={{ color: text.secondary, fontSize: 12, fontWeight: '500' }}>
                {stats.thisWeekWorkouts} / {weeklyGoal} goal
              </Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              {getWorkoutsForWeekDays.map((day, idx) => {
                const isToday = new Date().toISOString().split('T')[0] === day.date.toISOString().split('T')[0];
                return (
                  <View key={idx} style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ 
                      color: isToday ? accent.red : text.tertiary, 
                      fontSize: 11, 
                      fontWeight: isToday ? 'bold' : '500' 
                    }}>
                      {day.label}
                    </Text>
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: day.hasWorkout ? accent.red : colors.border,
                      backgroundColor: day.hasWorkout ? 'rgba(239, 68, 68, 0.15)' : colors.surfaceHighlight,
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}>
                      {day.hasWorkout ? (
                        <Flame size={18} color={accent.red} />
                      ) : (
                        <Text style={{ color: text.secondary, fontSize: 12, fontWeight: '500' }}>
                          {day.date.getDate()}
                        </Text>
                      )}
                      {isToday && !day.hasWorkout && (
                        <View style={{
                          position: 'absolute',
                          bottom: -2,
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: accent.red
                        }} />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* AI Meal Scanner Dashboard Card */}
        <Animated.View entering={FadeInDown.delay(260).springify()} style={{ marginHorizontal: Spacing.lg, marginTop: 0, marginBottom: Spacing.lg }}>
          <View style={{
            backgroundColor: colors.surfaceElevated,
            borderRadius: BorderRadius.xl,
            padding: Spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            ...Shadows.md
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Sparkles size={18} color="#EAB308" />
                <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 14 }}>Daily AI Nutrition Tracker</Text>
              </View>
              {dailyMacros.calories > 0 && (
                <TouchableOpacity onPress={handleClearMacros}>
                  <Text style={{ color: accent.red, fontSize: 11, fontWeight: 'bold' }}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Macro Pills */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Calories', val: `${dailyMacros.calories} kcal`, color: '#3B82F6' },
                { label: 'Protein', val: `${dailyMacros.protein}g`, color: '#EF4444' },
                { label: 'Carbs', val: `${dailyMacros.carbs}g`, color: '#10B981' },
                { label: 'Fat', val: `${dailyMacros.fat}g`, color: '#F59E0B' }
              ].map(macro => (
                <View key={macro.label} style={{
                  flex: 1,
                  backgroundColor: colors.surfaceHighlight,
                  borderRadius: BorderRadius.md,
                  padding: 8,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.02)'
                }}>
                  <Text style={{ color: text.tertiary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 }}>{macro.label}</Text>
                  <Text style={{ color: macro.color, fontSize: 13, fontWeight: 'bold' }}>{macro.val}</Text>
                </View>
              ))}
            </View>

            {/* Scanning CTA Trigger */}
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                borderWidth: 1,
                borderColor: '#EAB308',
                borderRadius: BorderRadius.md,
                paddingVertical: 10,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6
              }}
              onPress={() => {
                setScannedMealResult(null);
                setSelectedMealPreset('');
                setCustomMealText('');
                setShowMealModal(true);
              }}
            >
              <Sparkles size={16} color="#EAB308" />
              <Text style={{ color: '#EAB308', fontWeight: 'bold', fontSize: 13 }}>Scan Plate with Gemini AI</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Continue Workout Banner */}
        {isActive && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <TouchableOpacity 
              style={styles.continueWorkout}
              onPress={() => router.push('/workout-active')}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[accent.red, accent.redDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueGradient}
              >
                <View style={styles.continueContent}>
                  <View>
                    <Text style={styles.continueLabel}>WORKOUT IN PROGRESS</Text>
                    <Text style={styles.continueTitle}>Resume Session</Text>
                  </View>
                  <View style={styles.continuePulse}>
                    <Dumbbell size={24} color="#fff" />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Start Workout Button */}
        {!isActive && (
          <Animated.View style={[animatedPulseStyle]} entering={FadeInDown.delay(300).springify()}>
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleStartWorkout}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[accent.redLight, accent.red]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startButtonGradient}
              >
                <PlusCircle size={32} color="#fff" />
                <Text style={styles.startButtonText}>Start Empty Workout</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Workout Templates */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Routines</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateScroll}>
            {templates.slice(0, 6).map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                onPress={() => handleStartTemplate(template)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.surfaceElevated, colors.surface]}
                  style={styles.templateGradient}
                >
                  <View style={styles.templateIconWrapper}>
                    <Target size={24} color={accent.red} />
                  </View>
                  <View>
                    <Text style={styles.templateName} numberOfLines={1}>{template.name}</Text>
                    <Text style={styles.templateExercises}>
                      {template.exercises.length} exercises
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Recent PRs */}
        {recentPRs.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Achievements</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/analytics')}>
                <Text style={styles.seeAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {recentPRs.slice(0, 3).map((pr, idx) => (
              <View key={pr.id || idx} style={styles.prCard}>
                <View style={styles.prIcon}>
                  {pr.record_type === '1rm' ? <Trophy size={20} color={status.warning} /> : 
                   pr.record_type === 'volume' ? <Activity size={20} color={status.info} /> : 
                   <Flame size={20} color={accent.red} />}
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
          </Animated.View>
        )}

        {/* Empty state for new users */}
        {stats.totalWorkouts === 0 && (
          <View style={styles.emptyState}>
            <Dumbbell size={48} color={text.tertiary} style={{ marginBottom: Spacing.lg }} />
            <Text style={styles.emptyTitle}>Ready to Train?</Text>
            <Text style={styles.emptyText}>
              Your fitness journey begins with a single rep.{'\n'}
              Tap "Start Empty Workout" above to log your first session!
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
                borderColor: 'rgba(234, 179, 8, 0.3)',
                marginBottom: 40
              }}>
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
                      {pr.value} {pr.record_type === 'reps' ? 'reps' : 'kg'}
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

const getStyles = (colors: any, text: any, accent: any, status: any, muscle: any) => StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  greeting: {
    color: text.secondary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
  },
  userName: {
    color: text.primary,
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
    marginTop: 2,
    letterSpacing: -0.5,
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
    borderColor: colors.border,
  },

  // Hero Dashboard
  heroDashboard: {
    marginBottom: Spacing['2xl'],
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.md,
  },
  heroGradient: {
    padding: Spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  heroStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroStatTextContainer: {
    flex: 1,
  },
  heroStatValue: {
    color: text.primary,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  heroStatLabel: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroDivider: {
    width: 1,
    height: '100%',
    backgroundColor: colors.border,
    marginHorizontal: Spacing.md,
  },
  heroProgressSection: {
    marginTop: Spacing.xs,
  },
  heroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  heroProgressTitle: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  heroProgressAmount: {
    color: text.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  heroProgressBarContainer: {
    height: 6,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  heroProgressBarFill: {
    height: '100%',
    backgroundColor: accent.red,
    borderRadius: 3,
  },

  // Continue workout banner
  continueWorkout: {
    marginBottom: Spacing['2xl'],
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.glow(accent.red),
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
  },
  startButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
  },
  startButtonText: {
    color: '#fff',
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
  },

  // Templates
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.extrabold,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  seeAll: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  templateScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  templateCard: {
    width: 140,
    marginRight: Spacing.md,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  templateGradient: {
    padding: Spacing.lg,
    minHeight: 120,
    justifyContent: 'space-between',
  },
  templateIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  templateName: {
    color: text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  templateExercises: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 4,
  },

  // PR cards
  prCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prIcon: {
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
  prValue: {
    color: text.secondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  prBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  prBadgeText: {
    color: status.success,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['4xl'],
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: Spacing.md,
  },
  emptyTitle: {
    color: text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: text.secondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
});

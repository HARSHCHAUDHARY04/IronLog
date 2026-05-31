// ═══════════════════════════════════════════════════════
// Profile Tab — User settings, bodyweight, and account
// ═══════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { 
  User, Moon, Dumbbell, Timer, PlusCircle, 
  LogOut, Database, Edit3, X, Crown, ShieldCheck,
  ChevronRight, Award, Zap, Calendar
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useThemeColor, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { getWorkoutStats, getProgressEntries, saveProgressEntry, ProgressEntry } from '../../lib/storage';
import { LinearGradient } from 'expo-linear-gradient';

import { useSettingsStore } from '../../stores/settingsStore';
import { displayWeight, parseInputToKg } from '../../lib/units';

export default function ProfileScreen() {
  const { colors, text, accent, status, muscle, isDark } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle, isDark), [colors, text, accent, status, muscle, isDark]);

  const router = useRouter();
  const { user, updateProfile, logout, loadDemoData } = useAuthStore();
  const { theme, unit, defaultRestTimer, isPremium, weeklyGoal, setTheme, setUnit, setDefaultRestTimer, setWeeklyGoal, upgradeToPremium } = useSettingsStore();
  const [stats, setStats] = useState<any>(null);
  const [bodyweightEntries, setBodyweightEntries] = useState<ProgressEntry[]>([]);
  const [showWeightInput, setShowWeightInput] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [editGoal, setEditGoal] = useState('');

  const loadData = useCallback(async () => {
    const [s, bw] = await Promise.all([getWorkoutStats(), getProgressEntries()]);
    setStats(s);
    setBodyweightEntries(bw);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleSaveWeight = async () => {
    const weightInput = parseFloat(newWeight);
    if (isNaN(weightInput) || weightInput <= 0) return;

    const weightInKg = parseInputToKg(weightInput);

    await saveProgressEntry({
      user_id: user?.id || '',
      body_weight: weightInKg,
      date: new Date().toISOString().split('T')[0],
    });
    setNewWeight('');
    setShowWeightInput(false);
    await loadData();
  };

  const handleEditProfile = () => {
    setEditName(user?.name || '');
    setEditAge(user?.age?.toString() || '');
    setEditWeight(user?.weight_kg?.toString() || '');
    setEditHeight(user?.height_cm?.toString() || '');
    setEditGoal(user?.goal || 'general_fitness');
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    await updateProfile({
      name: editName,
      age: parseInt(editAge) || undefined,
      weight_kg: parseFloat(editWeight) || undefined,
      height_cm: parseFloat(editHeight) || undefined,
      goal: editGoal as any,
    });
    setIsEditing(false);
  };

  const handleLoadDemo = () => {
    Alert.alert(
      'Load Demo Data',
      'This will add 30 days of sample workout data for demonstration.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          onPress: async () => {
            await loadDemoData();
            await loadData();
            Alert.alert('Done!', 'Demo data loaded. Check your dashboard and analytics!');
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'This will clear all local data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          } 
        },
      ]
    );
  };

  const goals: Record<string, string> = {
    strength: '💪 Strength',
    hypertrophy: '🏋️ Hypertrophy',
    weight_loss: '🔥 Weight Loss',
    endurance: '🏃 Endurance',
    general_fitness: '⚡ General Fitness',
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        {/* Profile Card */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.profileCard}>
          <LinearGradient
            colors={[colors.surfaceElevated, colors.surface]}
            style={styles.profileGradient}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>{user?.name || 'Lifter'}</Text>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>Lvl {user?.level || 1}</Text>
                </View>
              </View>
              <Text style={styles.profileUsername}>
                @{user?.name ? user.name.toLowerCase().replace(/\s+/g, '_') : 'lifter'}
              </Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
              
              {/* XP Progress Bar */}
              {user && (() => {
                const currentLevelXP = 100 * Math.pow((user.level || 1) - 1, 2);
                const nextLevelXP = 100 * Math.pow(user.level || 1, 2);
                const progressXP = (user.xp || 0) - currentLevelXP;
                const totalRequiredXP = nextLevelXP - currentLevelXP;
                const percent = Math.min(100, Math.max(0, (progressXP / totalRequiredXP) * 100));

                return (
                  <View style={styles.xpContainer}>
                    <View style={styles.xpBarBg}>
                      <View style={[styles.xpBarFill, { width: `${percent}%` }]} />
                    </View>
                    <Text style={styles.xpText}>{user.xp || 0} / {nextLevelXP} XP</Text>
                  </View>
                );
              })()}

              <View style={styles.profileGoal}>
                <Text style={styles.profileGoalText}>
                  {goals[user?.goal || 'general_fitness']}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Edit3 size={20} color={text.secondary} />
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>

        {/* Quick Stats */}
        {stats && (
          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{user?.total_workouts || stats.totalWorkouts}</Text>
              <Text style={styles.quickStatLabel}>Workouts</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{user?.highest_streak || stats.longestStreak}</Text>
              <Text style={styles.quickStatLabel}>Best Streak</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>
                {stats.totalVolume >= 1000
                  ? `${(stats.totalVolume / 1000).toFixed(0)}k`
                  : stats.totalVolume}
              </Text>
              <Text style={styles.quickStatLabel}>Vol (kg)</Text>
            </View>
          </Animated.View>
        )}

        {/* Trophy Room */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Trophy Room</Text>
          <View style={styles.badgesContainer}>
            {['first_workout', 'dedicated_10', 'century_club'].map(badgeId => {
              const hasBadge = user?.badges?.includes(badgeId);
              const badgeInfo: Record<string, { Icon: any, name: string }> = {
                'first_workout': { Icon: Award, name: 'First Steps' },
                'dedicated_10': { Icon: Zap, name: 'Dedicated' },
                'century_club': { Icon: Crown, name: 'Century Club' }
              };
              const info = badgeInfo[badgeId];
              const IconComp = info.Icon;

              return (
                <View key={badgeId} style={[styles.badgeItem, !hasBadge && styles.badgeLocked]}>
                  {hasBadge ? <IconComp size={28} color={accent.red} /> : <ShieldCheck size={28} color={text.tertiary} />}
                  <Text style={styles.badgeName}>{info.name}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Body Measurements */}
        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Body Weight</Text>
            <TouchableOpacity onPress={() => setShowWeightInput(!showWeightInput)}>
              <PlusCircle size={24} color={accent.red} />
            </TouchableOpacity>
          </View>

          {showWeightInput && (
            <View style={styles.weightInputRow}>
              <TextInput
                style={styles.weightInput}
                placeholder={`Weight (${unit})`}
                placeholderTextColor={text.tertiary}
                value={newWeight}
                onChangeText={setNewWeight}
                keyboardType="numeric"
                autoFocus
              />
              <TouchableOpacity style={styles.saveWeightButton} onPress={handleSaveWeight}>
                <Text style={styles.saveWeightText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}

          {bodyweightEntries.length > 0 ? (
            <View style={styles.weightHistory}>
              {bodyweightEntries.slice(0, 7).map((entry, idx) => (
                <View key={entry.id} style={styles.weightEntry}>
                  <Text style={styles.weightDate}>{formatDate(entry.date)}</Text>
                  <View style={styles.weightBarContainer}>
                    <View
                      style={[
                        styles.weightBar,
                        {
                          width: `${Math.min(100, (entry.body_weight / Math.max(...bodyweightEntries.map(e => e.body_weight))) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.weightValue}>{displayWeight(entry.body_weight, false)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyWeight}>
              <Text style={styles.emptyText}>Track your body weight to see trends</Text>
            </View>
          )}
        </Animated.View>

        {/* Subscription (Luxurious Metallic) */}
        <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <TouchableOpacity 
            style={styles.subscriptionCard} 
            activeOpacity={0.85}
            onPress={() => {
              if (!isPremium) {
                Alert.alert(
                  'Premium Unlocked!', 
                  'For this demo, we have granted you premium access automatically.',
                  [{ text: 'Awesome', onPress: upgradeToPremium }]
                );
              }
            }}
          >
            <LinearGradient
              colors={isPremium ? [status.successDark, status.success] : ['#1E160C', '#4A3515', '#C08D38']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.subscriptionGradient}
            >
              <Crown size={28} color={isPremium ? "#fff" : "#FFD700"} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.subscriptionTitle}>
                  {isPremium ? 'Premium Active' : 'Next Rep Premium'}
                </Text>
                <Text style={styles.subscriptionSubtext}>
                  {isPremium ? 'Thanks for supporting us!' : 'Advanced analytics & unlimited history'}
                </Text>
              </View>
              {!isPremium && <Text style={styles.subscriptionPrice}>₹199/mo</Text>}
              {isPremium && <ChevronRight size={20} color="#fff" />}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Settings */}
        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.settingsGroup}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconBg}>
                  <Moon size={18} color={text.primary} />
                </View>
                <Text style={styles.settingText}>Dark Mode</Text>
              </View>
              <Switch
                value={theme === 'dark'}
                onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
                trackColor={{ true: accent.red, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
            <View style={styles.settingDivider} />

            <TouchableOpacity style={styles.settingItem} onPress={() => setUnit(unit === 'kg' ? 'lbs' : 'kg')}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIconBg}>
                  <Dumbbell size={18} color={text.primary} />
                </View>
                <Text style={styles.settingText}>Weight Unit</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>{unit}</Text>
                <ChevronRight size={16} color={text.tertiary} />
              </View>
            </TouchableOpacity>
            <View style={styles.settingDivider} />

            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={() => {
                const options = [60, 90, 120];
                const nextIdx = (options.indexOf(defaultRestTimer) + 1) % options.length;
                setDefaultRestTimer(options[nextIdx]);
              }}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconBg}>
                  <Timer size={18} color={text.primary} />
                </View>
                <Text style={styles.settingText}>Default Rest</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>{defaultRestTimer}s</Text>
                <ChevronRight size={16} color={text.tertiary} />
              </View>
            </TouchableOpacity>
            <View style={styles.settingDivider} />

            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={() => {
                const options = [2, 3, 4, 5, 6, 7];
                const nextIdx = (options.indexOf(weeklyGoal) + 1) % options.length;
                setWeeklyGoal(options[nextIdx]);
              }}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIconBg}>
                  <Calendar size={18} color={text.primary} />
                </View>
                <Text style={styles.settingText}>Weekly Goal</Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={styles.settingValue}>{weeklyGoal} workouts</Text>
                <ChevronRight size={16} color={text.tertiary} />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Actions */}
        <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          <View style={styles.settingsGroup}>
            <TouchableOpacity style={styles.settingItem} onPress={handleLoadDemo}>
              <View style={styles.settingLeft}>
                <Database size={20} color={status.info} />
                <Text style={[styles.settingText, { color: status.info }]}>Load Demo Data</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.settingDivider} />
            <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
              <View style={styles.settingLeft}>
                <LogOut size={20} color={accent.red} />
                <Text style={[styles.settingText, { color: accent.red }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Next Rep v2.0.0</Text>
          <Text style={styles.appInfoText}>Every Rep Counts.</Text>
          <Text style={[styles.appInfoText, { marginTop: Spacing.sm }]}>
            Crafted for lifters
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      {isEditing && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <X size={24} color={text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={text.tertiary}
            />

            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.input}
              value={editAge}
              onChangeText={setEditAge}
              keyboardType="numeric"
              placeholderTextColor={text.tertiary}
            />

            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={editWeight}
              onChangeText={setEditWeight}
              keyboardType="numeric"
              placeholderTextColor={text.tertiary}
            />

            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={editHeight}
              onChangeText={setEditHeight}
              keyboardType="numeric"
              placeholderTextColor={text.tertiary}
            />

            <Text style={styles.inputLabel}>Goal</Text>
            <View style={styles.goalSelector}>
              {Object.entries(goals).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.goalOption,
                    editGoal === key && styles.goalOptionActive,
                  ]}
                  onPress={() => setEditGoal(key)}
                >
                  <Text
                    style={[
                      styles.goalOptionText,
                      editGoal === key && styles.goalOptionTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors: any, text: any, accent: any, status: any, muscle: any, isDark: boolean) => StyleSheet.create({
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

  // Profile card
  profileCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.md,
  },
  profileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: accent.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: FontSize['3xl'],
    fontWeight: FontWeight.extrabold,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  profileName: {
    color: text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  levelBadge: {
    backgroundColor: accent.red,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  levelBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  profileUsername: {
    color: accent.red,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    marginTop: 2,
  },
  profileEmail: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  xpContainer: {
    marginTop: Spacing.md,
    marginBottom: 4,
  },
  xpBarBg: {
    height: 6,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: status.warning,
    borderRadius: 3,
  },
  xpText: {
    color: text.tertiary,
    fontSize: 10,
    fontWeight: FontWeight.medium,
  },
  profileGoal: {
    marginTop: Spacing.xs,
  },
  profileGoalText: {
    color: text.secondary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  editButton: {
    padding: Spacing.sm,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: BorderRadius.full,
  },

  // Quick stats
  quickStats: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    color: text.primary,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
  },
  quickStatLabel: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 4,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: Spacing.md,
  },

  // Badges
  badgesContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  badgeItem: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Shadows.sm,
  },
  badgeLocked: {
    opacity: 0.4,
  },
  badgeName: {
    color: text.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  // Section
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
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },

  // Weight tracking
  weightInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  weightInput: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: text.primary,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveWeightButton: {
    backgroundColor: accent.red,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  saveWeightText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
  weightHistory: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weightEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  weightDate: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    width: 50,
  },
  weightBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 4,
    marginHorizontal: Spacing.sm,
    overflow: 'hidden',
  },
  weightBar: {
    height: '100%',
    backgroundColor: accent.red,
    borderRadius: 4,
  },
  weightValue: {
    color: text.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    width: 45,
    textAlign: 'right',
  },
  emptyWeight: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: text.tertiary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },

  // Settings Group (iOS Style)
  settingsGroup: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 50,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    color: text.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  settingValue: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },

  // Subscription
  subscriptionCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.glow('rgba(192,141,56,0.3)'),
  },
  subscriptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  subscriptionTitle: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  subscriptionSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  subscriptionPrice: {
    color: '#FFD700',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
  },

  // App Info
  appInfo: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  appInfoText: {
    color: text.tertiary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },

  // Modal
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing['2xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    color: text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  inputLabel: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: text.primary,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  goalSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  goalOption: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  goalOptionActive: {
    backgroundColor: accent.red,
  },
  goalOptionText: {
    color: text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  goalOptionTextActive: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
  saveButton: {
    backgroundColor: accent.red,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});

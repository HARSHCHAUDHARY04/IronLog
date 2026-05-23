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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { getWorkoutStats, getProgressEntries, saveProgressEntry, ProgressEntry } from '../../lib/storage';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, logout, loadDemoData } = useAuthStore();
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
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) return;

    await saveProgressEntry({
      user_id: user?.id || '',
      body_weight: weight,
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
        { text: 'Sign Out', style: 'destructive', onPress: logout },
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
        <View style={styles.profileCard}>
          <LinearGradient
            colors={[Colors.dark.surfaceElevated, Colors.dark.surface]}
            style={styles.profileGradient}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'Lifter'}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
              <View style={styles.profileGoal}>
                <Text style={styles.profileGoalText}>
                  {goals[user?.goal || 'general_fitness']}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Ionicons name="create-outline" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Quick Stats */}
        {stats && (
          <View style={styles.quickStats}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{stats.totalWorkouts}</Text>
              <Text style={styles.quickStatLabel}>Workouts</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{stats.longestStreak}</Text>
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
          </View>
        )}

        {/* Body Measurements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Body Weight</Text>
            <TouchableOpacity onPress={() => setShowWeightInput(!showWeightInput)}>
              <Ionicons name="add-circle" size={24} color={Colors.accent.red} />
            </TouchableOpacity>
          </View>

          {showWeightInput && (
            <View style={styles.weightInputRow}>
              <TextInput
                style={styles.weightInput}
                placeholder="Weight (kg)"
                placeholderTextColor={Colors.text.tertiary}
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
                  <Text style={styles.weightValue}>{entry.body_weight.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Track your body weight to see trends</Text>
          )}
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="moon" size={20} color={Colors.text.secondary} />
              <Text style={styles.settingText}>Dark Mode</Text>
            </View>
            <Switch
              value={true}
              disabled
              trackColor={{ true: Colors.accent.red }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="barbell" size={20} color={Colors.text.secondary} />
              <Text style={styles.settingText}>Weight Unit</Text>
            </View>
            <Text style={styles.settingValue}>kg</Text>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="timer" size={20} color={Colors.text.secondary} />
              <Text style={styles.settingText}>Default Rest Timer</Text>
            </View>
            <Text style={styles.settingValue}>90s</Text>
          </View>
        </View>

        {/* Subscription */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <TouchableOpacity style={styles.subscriptionCard} activeOpacity={0.8}>
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subscriptionGradient}
            >
              <Ionicons name="diamond" size={24} color="#fff" />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.subscriptionTitle}>Upgrade to Premium</Text>
                <Text style={styles.subscriptionSubtext}>
                  Full history • AI insights • Advanced analytics
                </Text>
              </View>
              <Text style={styles.subscriptionPrice}>₹199/mo</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>

          <TouchableOpacity style={styles.actionItem} onPress={handleLoadDemo}>
            <Ionicons name="flask" size={20} color={Colors.status.info} />
            <Text style={[styles.actionText, { color: Colors.status.info }]}>Load Demo Data</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleLogout}>
            <Ionicons name="log-out" size={20} color={Colors.accent.red} />
            <Text style={[styles.actionText, { color: Colors.accent.red }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>IronLog v1.0.0</Text>
          <Text style={styles.appInfoText}>AI-Powered Fitness Progression</Text>
          <Text style={[styles.appInfoText, { marginTop: Spacing.sm }]}>
            Built with 💪 for lifters everywhere
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      {isEditing && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <Ionicons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholderTextColor={Colors.text.tertiary}
            />

            <Text style={styles.inputLabel}>Age</Text>
            <TextInput
              style={styles.input}
              value={editAge}
              onChangeText={setEditAge}
              keyboardType="numeric"
              placeholderTextColor={Colors.text.tertiary}
            />

            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={editWeight}
              onChangeText={setEditWeight}
              keyboardType="numeric"
              placeholderTextColor={Colors.text.tertiary}
            />

            <Text style={styles.inputLabel}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={editHeight}
              onChangeText={setEditHeight}
              keyboardType="numeric"
              placeholderTextColor={Colors.text.tertiary}
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

  // Profile card
  profileCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  profileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  profileName: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  profileEmail: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  profileGoal: {
    marginTop: Spacing.xs,
  },
  profileGoalText: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
  },
  editButton: {
    padding: Spacing.sm,
  },

  // Quick stats
  quickStats: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    color: Colors.text.primary,
    fontSize: FontSize['2xl'],
    fontWeight: FontWeight.extrabold,
  },
  quickStatLabel: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: Colors.dark.border,
    marginHorizontal: Spacing.md,
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
    color: Colors.text.secondary,
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
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  saveWeightButton: {
    backgroundColor: Colors.accent.red,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  saveWeightText: {
    color: '#fff',
    fontWeight: FontWeight.bold,
  },
  weightHistory: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  weightEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  weightDate: {
    color: Colors.text.tertiary,
    fontSize: FontSize.xs,
    width: 50,
  },
  weightBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.dark.surfaceHighlight,
    borderRadius: 4,
    marginHorizontal: Spacing.sm,
    overflow: 'hidden',
  },
  weightBar: {
    height: '100%',
    backgroundColor: Colors.status.info,
    borderRadius: 4,
  },
  weightValue: {
    color: Colors.text.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    width: 45,
    textAlign: 'right',
  },
  emptyText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },

  // Settings
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingText: {
    color: Colors.text.primary,
    fontSize: FontSize.md,
  },
  settingValue: {
    color: Colors.text.secondary,
    fontSize: FontSize.md,
  },

  // Subscription
  subscriptionCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  subscriptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  subscriptionTitle: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  subscriptionSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  subscriptionPrice: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
  },

  // Actions
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  actionText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },

  // App info
  appInfo: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  appInfoText: {
    color: Colors.text.tertiary,
    fontSize: FontSize.sm,
  },

  // Edit modal
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modal: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    color: Colors.text.primary,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  inputLabel: {
    color: Colors.text.secondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.dark.surfaceHighlight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text.primary,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  goalSelector: {
    gap: Spacing.xs,
  },
  goalOption: {
    backgroundColor: Colors.dark.surfaceHighlight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  goalOptionActive: {
    borderColor: Colors.accent.red,
    backgroundColor: Colors.accent.redGlow,
  },
  goalOptionText: {
    color: Colors.text.secondary,
    fontSize: FontSize.md,
  },
  goalOptionTextActive: {
    color: Colors.accent.red,
    fontWeight: FontWeight.bold,
  },
  saveButton: {
    backgroundColor: Colors.accent.red,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
});

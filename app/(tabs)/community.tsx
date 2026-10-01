import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, useThemeColor, Spacing, BorderRadius, FontSize, FontWeight } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { Sparkles, Send, Brain, Bot } from 'lucide-react-native';
import MarkdownText from '../../components/MarkdownText';
import { getAICoachingAdvice, CoachTurn } from '../../lib/gemini';
import { fetchGlobalLeaderboard, fetchFriends, searchUsers, addFriend, removeFriend, fetchIncomingRequests, acceptFriend, declineFriend, fetchSharedRoutines, recordRoutineDownload, SharedRoutine } from '../../lib/social';
import { saveTemplate, getWorkouts, getPRs } from '../../lib/storage';
import { displayVolume } from '../../lib/units';
import { sendMessage as sendChatMessage, getMessages as getChatMessages, subscribeToMessages, markConversationRead } from '../../lib/messaging';
import { getFeed, addReaction, removeReaction, WorkoutPost } from '../../lib/feed';
import * as Haptics from 'expo-haptics';

export default function CommunityScreen() {
  const { colors, text, accent, status, muscle } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'friends' | 'routines' | 'ai_coach' | 'feed'>('feed');
  const { user } = useAuthStore();

  // Feed States
  const [feedPosts, setFeedPosts] = useState<WorkoutPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  // AI Chat Coach States
  const [messages, setMessages] = useState<{ id: string; text: string; sender: 'user' | 'ai'; timestamp: Date }[]>([
    {
      id: 'welcome',
      text: "Hey! I'm RepBot, your certified AI Coach. Ask me anything about progressive overload, breaking plateaus, dynamic recovery, or custom nutrition schedules!",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAIResponding, setIsAIResponding] = useState(false);

  // Voice playback state


  useEffect(() => {
    // Load feed
    const loadFeedData = async () => {
      setLoadingFeed(true);
      try {
        const posts = await getFeed();
        setFeedPosts(posts);
      } catch (e) {
        console.error('Failed to load feed:', e);
      } finally {
        setLoadingFeed(false);
      }
    };
    loadFeedData();
  }, []);

  const SUGGESTED_PROMPTS = [
    "Break a bench press plateau",
    "Explain progressive overload simply",
    "How to manage a deload week?",
    "Calculate my daily protein target"
  ];

  // Short summary of recent training so RepBot can give specific advice
  const buildTrainingContext = async (): Promise<string> => {
    try {
      const [workouts, prs] = await Promise.all([getWorkouts(), getPRs()]);
      const recent = workouts.slice(0, 5).map(w => {
        const names = [...new Set(w.exercises.map(e => e.exercise_name))].slice(0, 5).join(', ');
        return `- ${w.workout_date}: ${w.name} (${w.duration_minutes} min, ${Math.round(w.total_volume_kg)} kg volume) — ${names}`;
      });
      const best = prs.filter(p => p.record_type === '1rm').slice(0, 5)
        .map(p => `- ${p.exercise_name}: est. 1RM ${p.value} kg`);
      return [
        user?.goal ? `Goal: ${user.goal.replace('_', ' ')}` : '',
        user?.weight_kg ? `Bodyweight: ${user.weight_kg} kg` : '',
        `Total workouts logged: ${workouts.length}`,
        recent.length ? `Recent sessions:\n${recent.join('\n')}` : '',
        best.length ? `Recent 1RM records:\n${best.join('\n')}` : '',
      ].filter(Boolean).join('\n');
    } catch {
      return '';
    }
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isAIResponding) return;

    const userMsg = {
      id: Date.now().toString(),
      text: textToSend.trim(),
      sender: 'user' as const,
      timestamp: new Date()
    };

    const conversation = [...messages, userMsg];
    setMessages(conversation);
    setInputMessage('');
    setIsAIResponding(true);

    try {
      // Send the real conversation (minus the canned welcome) so follow-ups work
      const history: CoachTurn[] = conversation
        .filter(m => m.id !== 'welcome' && !m.id.startsWith('err-'))
        .map(m => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }));
      const response = await getAICoachingAdvice(history, await buildTrainingContext());

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'ai' as const,
        timestamp: new Date()
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        text: "I couldn't reach the coaching service right now. Check your connection and try again.",
        sender: 'ai' as const,
        timestamp: new Date()
      }]);
    } finally {
      setIsAIResponding(false);
    }
  };

  // Dynamic Social State
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
  const [friendRoutines, setFriendRoutines] = useState<Record<string, SharedRoutine[]>>({});
  const [isCopyingRoutine, setIsCopyingRoutine] = useState<string | null>(null);

  // Direct Chat States
  const [activeChatFriend, setActiveChatFriend] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, { id: string; text: string; sender: 'me' | 'them'; timestamp: string }[]>>({});
  const [directChatInput, setDirectChatInput] = useState('');

  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [socialError, setSocialError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const loadSocialData = async () => {
    setIsLoadingSocial(true);
    setSocialError(false);
    try {
      const [lb, fr, reqs] = await Promise.all([
        fetchGlobalLeaderboard(20),
        fetchFriends(),
        fetchIncomingRequests()
      ]);
      setLeaderboard(lb);
      setFriends(fr);
      setIncomingRequests(reqs);

      const routines = await fetchSharedRoutines(fr.map(f => f.id)).catch(() => []);
      const byCreator: Record<string, SharedRoutine[]> = {};
      routines.forEach(r => { (byCreator[r.creator_id] ||= []).push(r); });
      setFriendRoutines(byCreator);
    } catch (e) {
      console.error('Failed to load social data:', e);
      setSocialError(true);
    } finally {
      setIsLoadingSocial(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'leaderboard' || activeTab === 'friends') {
      loadSocialData();
    }
  }, [activeTab]);

  // Load the conversation from the server and listen for new messages
  useEffect(() => {
    if (!activeChatFriend || !user?.id) return;
    const friendId = activeChatFriend.id;
    let cancelled = false;

    getChatMessages(friendId).then(msgs => {
      if (!cancelled) setChatMessages(prev => ({ ...prev, [friendId]: msgs }));
    });
    markConversationRead(friendId);

    const unsubscribe = subscribeToMessages(friendId, user.id, msg => {
      setChatMessages(prev => {
        const existing = prev[friendId] || [];
        if (existing.some(m => m.id === msg.id)) return prev;
        return { ...prev, [friendId]: [...existing, msg] };
      });
      markConversationRead(friendId);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeChatFriend?.id, user?.id]);

  const showError = (title: string, e: unknown) => {
    const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
    if (Platform.OS === 'web') alert(`${title}: ${message}`);
    else Alert.alert(title, message);
  };

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await searchUsers(val);
      setSearchResults(res);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    try {
      const success = await addFriend(friendId);
      if (success) {
        await loadSocialData();
        setSearchResults(prev => prev.filter(u => u.id !== friendId));
        if (Platform.OS === 'web') {
          alert("Friend request sent!");
        } else {
          Alert.alert("Request Sent", "They'll appear in your friends list once they accept.");
        }
      }
    } catch (e) {
      console.error(e);
      showError('Could not send request', e);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      const success = await removeFriend(friendId);
      if (success) {
        await loadSocialData();
        if (Platform.OS === 'web') {
          alert("Friend removed successfully.");
        } else {
          Alert.alert("Removed", "Friend removed successfully.");
        }
      }
    } catch (e) {
      console.error(e);
      showError('Could not remove friend', e);
    }
  };

  const handleAcceptFriend = async (friendId: string) => {
    try {
      const success = await acceptFriend(friendId);
      if (success) {
        await loadSocialData();
        if (Platform.OS === 'web') {
          alert("Friend request accepted!");
        } else {
          Alert.alert("Success", "Friend request accepted!");
        }
      }
    } catch (e) {
      console.error(e);
      showError('Could not accept request', e);
    }
  };

  const handleDeclineFriend = async (friendId: string) => {
    try {
      const success = await declineFriend(friendId);
      if (success) {
        await loadSocialData();
        if (Platform.OS === 'web') {
          alert("Friend request declined.");
        } else {
          Alert.alert("Declined", "Friend request declined.");
        }
      }
    } catch (e) {
      console.error(e);
      showError('Could not decline request', e);
    }
  };

  const handleFistBump = async (friendId: string, name: string) => {
    try {
      await sendChatMessage(friendId, '👊 Fist bump!');
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (Platform.OS === 'web') alert(`Fist bump sent to ${name}!`);
      else Alert.alert('👊 Sent', `Fist bump sent to ${name}!`);
    } catch (e) {
      showError('Fist bump failed', e);
    }
  };

  const handleCopyRoutine = async (routine: SharedRoutine) => {
    setIsCopyingRoutine(routine.id);
    try {
      const muscleGroups = [...new Set(
        routine.exercises.flatMap(ex => {
          const lib = require('../../data/exercises.json').exercises.find(
            (e: any) => e.name.toLowerCase() === ex.name.toLowerCase()
          );
          return lib ? lib.primary_muscles : [];
        })
      )] as string[];

      await saveTemplate({
        user_id: user?.id,
        name: routine.name,
        muscle_groups: muscleGroups,
        exercises: routine.exercises,
        is_default: false
      });
      recordRoutineDownload(routine.id);

      try {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (h) {}

      if (Platform.OS === 'web') {
        alert(`Copied "${routine.name}" to your templates!`);
      } else {
        Alert.alert("Copied", `"${routine.name}" is now in your templates. Start it from the Workout tab.`);
      }
    } catch (e) {
      showError('Failed to copy routine', e);
    } finally {
      setIsCopyingRoutine(null);
    }
  };

  const handleSendDirectMessage = async () => {
    if (!directChatInput.trim() || !activeChatFriend) return;

    const friendId = activeChatFriend.id;
    
    try {
      const sentMsg = await sendChatMessage(friendId, directChatInput);
      
      const updatedChats: Record<string, { id: string; text: string; sender: 'me' | 'them'; timestamp: string }[]> = {
        ...chatMessages,
        [friendId]: [...(chatMessages[friendId] || []), {
          id: sentMsg.id,
          text: sentMsg.text,
          sender: 'me',
          timestamp: sentMsg.timestamp,
        }]
      };
      setChatMessages(updatedChats);
      setDirectChatInput('');

      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.error('Send message failed:', e);
      showError('Message not sent', e);
    }
  };

  const handleReaction = async (postId: string, reaction: 'fire' | 'muscle' | 'fist') => {
    const post = feedPosts.find(p => p.id === postId);
    if (!post) return;
    
    const existingReaction = post.reactions.find(r => r.user_id === user?.id);
    
    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (h) {}

    if (existingReaction && existingReaction.reaction === reaction) {
      await removeReaction(postId);
    } else {
      await addReaction(postId, reaction);
    }
    
    // Refresh feed
    const updatedFeed = await getFeed();
    setFeedPosts(updatedFeed);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
      </View>

      <View style={styles.tabSelector}>
        <TouchableOpacity style={[styles.tab, activeTab === 'feed' && styles.activeTab]} onPress={() => setActiveTab('feed')}>
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]} onPress={() => setActiveTab('leaderboard')}>
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>Board</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'friends' && styles.activeTab]} onPress={() => setActiveTab('friends')}>
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'ai_coach' && styles.activeTab]} onPress={() => setActiveTab('ai_coach')}>
          <Text style={[styles.tabText, activeTab === 'ai_coach' && styles.activeTabText, { color: activeTab === 'ai_coach' ? '#EAB308' : text.tertiary }]}>AI Coach</Text>
        </TouchableOpacity>
      </View>

      {activeTab !== 'ai_coach' ? (
        <ScrollView contentContainerStyle={styles.content}>

          {/* ─── FEED TAB ─── */}
          {activeTab === 'feed' && (
            <View>
              <Text style={styles.sectionTitle}>Workout Feed</Text>
              {loadingFeed && feedPosts.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
                  <ActivityIndicator size="small" color={accent.red} />
                  <Text style={{ color: text.tertiary, fontStyle: 'italic' }}>Loading Feed...</Text>
                </View>
              ) : feedPosts.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12, backgroundColor: colors.surfaceElevated, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 48 }}>🏋️</Text>
                  <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 16 }}>No Posts Yet</Text>
                  <Text style={{ color: text.tertiary, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
                    Complete a workout and share it to start the feed!
                  </Text>
                </View>
              ) : (
                feedPosts.map(post => {
                  const timeAgo = getTimeAgo(new Date(post.created_at));
                  const myReaction = post.reactions.find(r => r.user_id === user?.id);
                  const reactionCounts = {
                    fire: post.reactions.filter(r => r.reaction === 'fire').length,
                    muscle: post.reactions.filter(r => r.reaction === 'muscle').length,
                    fist: post.reactions.filter(r => r.reaction === 'fist').length,
                  };

                  return (
                    <View key={post.id} style={{
                      backgroundColor: colors.surfaceElevated,
                      borderRadius: BorderRadius.xl,
                      padding: Spacing.lg,
                      marginBottom: Spacing.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}>
                      {/* Post Header */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{
                          width: 40, height: 40, borderRadius: 20,
                          backgroundColor: accent.red,
                          alignItems: 'center', justifyContent: 'center', marginRight: 10
                        }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{post.user_avatar}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 14 }}>{post.user_name}</Text>
                          <Text style={{ color: text.tertiary, fontSize: 11 }}>{timeAgo}</Text>
                        </View>
                      </View>

                      {/* Workout Info */}
                      <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>
                        {post.workout_name}
                      </Text>

                      {/* Stats Row */}
                      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 10 }}>
                        <View style={{ backgroundColor: colors.surfaceHighlight, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: text.tertiary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Duration</Text>
                          <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 13 }}>{post.duration_minutes}min</Text>
                        </View>
                        <View style={{ backgroundColor: colors.surfaceHighlight, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: text.tertiary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Volume</Text>
                          <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 13 }}>{displayVolume(post.total_volume_kg)}</Text>
                        </View>
                        <View style={{ backgroundColor: colors.surfaceHighlight, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ color: text.tertiary, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>Exercises</Text>
                          <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 13 }}>{post.exercise_count}</Text>
                        </View>
                        {post.prs_hit > 0 && (
                          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ color: accent.red, fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' }}>PRs</Text>
                            <Text style={{ color: accent.red, fontWeight: 'bold', fontSize: 13 }}>{post.prs_hit} 🏆</Text>
                          </View>
                        )}
                      </View>

                      {/* Muscle Tags */}
                      {post.muscle_groups.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {post.muscle_groups.map(mg => (
                            <View key={mg} style={{ backgroundColor: colors.surfaceHighlight, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 3 }}>
                              <Text style={{ color: text.secondary, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>{mg}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Caption */}
                      {post.caption ? (
                        <Text style={{ color: text.secondary, fontSize: 13, marginBottom: 10, lineHeight: 19 }}>{post.caption}</Text>
                      ) : null}

                      {/* Reactions */}
                      <View style={{ flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
                        {(['fire', 'muscle', 'fist'] as const).map(reaction => {
                          const emoji = reaction === 'fire' ? '🔥' : reaction === 'muscle' ? '💪' : '👊';
                          const count = reactionCounts[reaction];
                          const isActive = myReaction?.reaction === reaction;
                          return (
                            <TouchableOpacity
                              key={reaction}
                              onPress={() => handleReaction(post.id, reaction)}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 4,
                                backgroundColor: isActive ? 'rgba(239, 68, 68, 0.15)' : colors.surfaceHighlight,
                                borderRadius: BorderRadius.full,
                                paddingHorizontal: 12, paddingVertical: 6,
                                borderWidth: isActive ? 1 : 0,
                                borderColor: accent.red,
                              }}
                            >
                              <Text style={{ fontSize: 16 }}>{emoji}</Text>
                              {count > 0 && <Text style={{ color: isActive ? accent.red : text.secondary, fontSize: 12, fontWeight: 'bold' }}>{count}</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* ─── LEADERBOARD TAB ─── */}
          {activeTab === 'leaderboard' && (
            <View>
              <Text style={styles.sectionTitle}>Global Leaderboard</Text>
              {isLoadingSocial && leaderboard.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
                  <ActivityIndicator size="small" color={accent.red} />
                  <Text style={{ color: text.tertiary, fontStyle: 'italic' }}>Loading Leaderboard...</Text>
                </View>
              ) : socialError && leaderboard.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
                  <Text style={{ color: '#EF4444', fontStyle: 'italic' }}>Failed to load leaderboard.</Text>
                  <TouchableOpacity 
                    style={{ backgroundColor: colors.surfaceHighlight, paddingVertical: 8, paddingHorizontal: 16, borderRadius: BorderRadius.md }}
                    onPress={loadSocialData}
                  >
                    <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 13 }}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                leaderboard.map((u) => (
                  <View key={u.id} style={[styles.userCard, u.isMe && styles.myCard]}>
                    <Text style={styles.rank}>#{u.rank}</Text>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{u.avatar}</Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{u.name} {u.isMe && '(You)'}</Text>
                      <Text style={styles.userLevel}>Lvl {u.level}</Text>
                    </View>
                    <Text style={styles.userXP}>{u.xp} XP</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'friends' && (
            <View>
              {isSearchMode ? (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.sectionTitle}>Find Friends</Text>
                    <TouchableOpacity onPress={() => { setIsSearchMode(false); setSearchQuery(''); setSearchResults([]); }}>
                      <Text style={{ color: accent.red, fontWeight: 'bold', fontSize: 13 }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={{
                      backgroundColor: colors.surfaceHighlight,
                      borderRadius: BorderRadius.md,
                      padding: 12,
                      color: text.primary,
                      borderWidth: 1,
                      borderColor: colors.border,
                      marginBottom: 16
                    }}
                    placeholder="Search username..."
                    placeholderTextColor={text.tertiary}
                    value={searchQuery}
                    onChangeText={handleSearch}
                    autoFocus
                  />

                  {searchResults.length === 0 ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                      <Text style={{ color: text.tertiary, fontStyle: 'italic', fontSize: 13 }}>
                        {searchQuery ? "No lifters found matching that search." : "Type a name to search lifters..."}
                      </Text>
                    </View>
                  ) : (
                    searchResults.map((u) => (
                      <View key={u.id} style={styles.userCard}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{u.avatar}</Text>
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{u.name}</Text>
                          <Text style={styles.userLevel}>Lvl {u.level} • {u.xp} XP</Text>
                        </View>
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#EAB308',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 6
                          }}
                          onPress={() => handleAddFriend(u.id)}
                        >
                          <Text style={{ color: '#1E1B18', fontWeight: 'bold', fontSize: 12 }}>+ Add</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              ) : (
                <View>
                  {/* Incoming requests section */}
                  {incomingRequests.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={styles.sectionTitle}>Friend Requests</Text>
                        <View style={{ backgroundColor: accent.red, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 8 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{incomingRequests.length}</Text>
                        </View>
                      </View>
                      {incomingRequests.map((req) => (
                        <View key={req.id} style={styles.userCard}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{req.avatar}</Text>
                          </View>
                          <View style={styles.userInfo}>
                            <Text style={styles.userName}>{req.name}</Text>
                            <Text style={styles.userLevel}>Lvl {req.level} • {req.xp} XP</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={{
                                backgroundColor: '#22C55E',
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 6
                              }}
                              onPress={() => handleAcceptFriend(req.id)}
                            >
                              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                backgroundColor: colors.surfaceHighlight,
                                paddingHorizontal: 12,
                                paddingVertical: 6,
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: colors.border
                              }}
                              onPress={() => handleDeclineFriend(req.id)}
                            >
                              <Text style={{ color: text.secondary, fontWeight: 'bold', fontSize: 12 }}>Ignore</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={styles.sectionTitle}>Your Friends</Text>
                    <TouchableOpacity 
                      style={{
                        backgroundColor: colors.surfaceHighlight,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: colors.border
                      }}
                      onPress={() => setIsSearchMode(true)}
                    >
                      <Text style={{ color: text.secondary, fontWeight: 'bold', fontSize: 12 }}>+ Find Friends</Text>
                    </TouchableOpacity>
                  </View>

                  {isLoadingSocial && friends.length === 0 ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
                      <ActivityIndicator size="small" color={accent.red} />
                      <Text style={{ color: text.tertiary, fontStyle: 'italic' }}>Loading Friends list...</Text>
                    </View>
                  ) : socialError && friends.length === 0 ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
                      <Text style={{ color: '#EF4444', fontStyle: 'italic' }}>Failed to load friends list.</Text>
                      <TouchableOpacity 
                        style={{ backgroundColor: colors.surfaceHighlight, paddingVertical: 8, paddingHorizontal: 16, borderRadius: BorderRadius.md }}
                        onPress={loadSocialData}
                      >
                        <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 13 }}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  ) : friends.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="people" size={48} color={text.tertiary} />
                      <Text style={styles.emptyText}>You haven't added any friends yet.</Text>
                      <TouchableOpacity style={styles.primaryButton} onPress={() => setIsSearchMode(true)}>
                        <Text style={styles.primaryButtonText}>Find Friends</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    friends.map((friend) => {
                      const isExpanded = expandedFriendId === friend.id;
                      const routines = friendRoutines[friend.id] || [];

                      return (
                        <View 
                          key={friend.id} 
                          style={{
                            backgroundColor: colors.surfaceElevated,
                            borderRadius: BorderRadius.md,
                            borderWidth: 1,
                            borderColor: isExpanded ? accent.red : colors.border,
                            marginBottom: 12,
                            overflow: 'hidden'
                          }}
                        >
                          {/* Main Row (Header) */}
                          <TouchableOpacity 
                            style={{
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              padding: 14,
                              justifyContent: 'space-between'
                            }}
                            onPress={() => setExpandedFriendId(isExpanded ? null : friend.id)}
                            activeOpacity={0.7}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                              <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{friend.avatar}</Text>
                              </View>
                              <View style={styles.userInfo}>
                                <Text style={styles.userName}>{friend.name}</Text>
                                <Text style={styles.userLevel}>Lvl {friend.level} • {friend.xp} XP</Text>
                              </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Ionicons 
                                name={isExpanded ? "chevron-up" : "chevron-down"} 
                                size={18} 
                                color={text.tertiary} 
                              />
                            </View>
                          </TouchableOpacity>

                          {/* Expanded Content */}
                          {isExpanded && (
                            <View style={{ 
                              padding: 14, 
                              borderTopWidth: 1, 
                              borderColor: colors.border,
                              backgroundColor: colors.surfaceHighlight 
                            }}>
                              {/* Shared Routines */}
                              {routines.length === 0 ? (
                                <Text style={{ color: text.tertiary, fontSize: 12, fontStyle: 'italic', marginBottom: 14 }}>
                                  {friend.name} hasn't shared any routines yet.
                                </Text>
                              ) : routines.map(routine => (
                                <View key={routine.id} style={{
                                  backgroundColor: colors.surfaceElevated,
                                  borderRadius: BorderRadius.md,
                                  padding: 12,
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  marginBottom: 14
                                }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={{ color: text.primary, fontSize: 13, fontWeight: 'bold', flex: 1 }}>{routine.name}</Text>
                                    <Text style={{ color: text.tertiary, fontSize: 10 }}>📥 {routine.downloads}</Text>
                                  </View>
                                  {!!routine.description && (
                                    <Text style={{ color: text.secondary, fontSize: 12, marginBottom: 8 }}>{routine.description}</Text>
                                  )}

                                  {routine.exercises.map((ex, idx) => (
                                    <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: idx === routine.exercises.length - 1 ? 0 : 1, borderColor: colors.border }}>
                                      <Text style={{ color: text.secondary, fontSize: 12 }}>{ex.name}</Text>
                                      <Text style={{ color: text.tertiary, fontSize: 12, fontWeight: 'bold' }}>{ex.sets}x{ex.reps}</Text>
                                    </View>
                                  ))}

                                  <TouchableOpacity
                                    style={{
                                      backgroundColor: '#C08D38',
                                      borderRadius: 6,
                                      paddingVertical: 10,
                                      alignItems: 'center',
                                      marginTop: 12,
                                    }}
                                    onPress={() => handleCopyRoutine(routine)}
                                    disabled={isCopyingRoutine === routine.id}
                                  >
                                    {isCopyingRoutine === routine.id ? (
                                      <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>📋 Copy to My Templates</Text>
                                    )}
                                  </TouchableOpacity>
                                </View>
                              ))}

                              {/* Interactive Actions Footer */}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <TouchableOpacity 
                                    style={{
                                      flexDirection: 'row',
                                      backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                      borderRadius: 6,
                                      paddingHorizontal: 12,
                                      paddingVertical: 8,
                                      alignItems: 'center',
                                      gap: 6
                                    }}
                                    onPress={() => handleFistBump(friend.id, friend.name)}
                                  >
                                    <Text style={{ fontSize: 14 }}>👊</Text>
                                    <Text style={{ color: '#EAB308', fontSize: 12, fontWeight: 'bold' }}>Fist Bump</Text>
                                  </TouchableOpacity>

                                  <TouchableOpacity 
                                    style={{
                                      flexDirection: 'row',
                                      backgroundColor: colors.surfaceHighlight,
                                      borderRadius: 6,
                                      paddingHorizontal: 12,
                                      paddingVertical: 8,
                                      alignItems: 'center',
                                      gap: 6,
                                      borderWidth: 1,
                                      borderColor: colors.border
                                    }}
                                    onPress={() => setActiveChatFriend(friend)}
                                  >
                                    <Ionicons name="chatbubble-ellipses" size={16} color={text.primary} />
                                    <Text style={{ color: text.primary, fontSize: 12, fontWeight: 'bold' }}>Message</Text>
                                  </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                  style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    borderRadius: 6,
                                    borderWidth: 1,
                                    borderColor: 'rgba(239, 68, 68, 0.2)'
                                  }}
                                  onPress={() => handleRemoveFriend(friend.id)}
                                >
                                  <Text style={{ color: accent.red, fontSize: 11, fontWeight: 'bold' }}>Remove Friend</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <View style={{ flex: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }}>
            <Text style={styles.sectionTitle}>RepBot AI Personal Trainer</Text>

            {/* Chat Messages */}
            <View style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: Spacing.md,
              marginBottom: Spacing.md
            }}>
              <ScrollView 
                ref={ref => {
                  if (ref) {
                    setTimeout(() => ref.scrollToEnd({ animated: true }), 100);
                  }
                }}
                showsVerticalScrollIndicator={false}
              >
                {messages.map((msg) => {
                  const isAI = msg.sender === 'ai';
                  return (
                    <View 
                      key={msg.id}
                      style={{
                        alignSelf: isAI ? 'flex-start' : 'flex-end',
                        backgroundColor: isAI ? colors.surfaceHighlight : '#EAB308',
                        borderRadius: BorderRadius.md,
                        padding: 10,
                        marginVertical: 4,
                        maxWidth: '85%',
                        borderWidth: 1,
                        borderColor: isAI ? 'rgba(234,179,8,0.2)' : 'transparent',
                        paddingRight: isAI ? 36 : 10,
                        position: 'relative'
                      }}
                    >
                      {isAI ? (
                        <MarkdownText 
                          content={msg.text} 
                          colors={colors}
                          textColors={text}
                          textStyles={{ 
                            color: text.primary, 
                            fontSize: 14 
                          }} 
                        />
                      ) : (
                        <Text style={{ 
                          color: '#1E1B18', 
                          fontSize: 14,
                          fontWeight: '600'
                        }}>
                          {msg.text}
                        </Text>
                      )}
                    </View>
                  );
                })}
                {isAIResponding && (
                  <View style={{
                    alignSelf: 'flex-start',
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: BorderRadius.md,
                    padding: 10,
                    marginVertical: 4,
                    borderWidth: 1,
                    borderColor: 'rgba(234,179,8,0.2)'
                  }}>
                    <Text style={{ color: text.tertiary, fontStyle: 'italic', fontSize: 13 }}>
                      RepBot is analyzing...
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Quick Prompts */}
            <Text style={{ color: text.tertiary, fontSize: 11, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' }}>
              Suggested Coaching Queries
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md }}>
              {SUGGESTED_PROMPTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={{
                    backgroundColor: colors.surfaceHighlight,
                    borderRadius: 14,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: colors.border
                  }}
                  onPress={() => handleSendMessage(p)}
                >
                  <Text style={{ color: text.secondary, fontSize: 12, fontWeight: '500' }}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Send Input */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceHighlight,
                  borderRadius: BorderRadius.md,
                  padding: 12,
                  color: text.primary,
                  borderWidth: 1,
                  borderColor: colors.border
                }}
                placeholder="Ask RepBot advice..."
                placeholderTextColor={text.tertiary}
                value={inputMessage}
                onChangeText={setInputMessage}
                onSubmitEditing={() => handleSendMessage(inputMessage)}
              />
              <TouchableOpacity
                style={{
                  backgroundColor: '#EAB308',
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onPress={() => handleSendMessage(inputMessage)}
              >
                <Send size={18} color="#1E1B18" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Direct Messaging Chat Modal Overlay */}
      {activeChatFriend && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.background,
          zIndex: 1000
        }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: Platform.OS === 'ios' ? 50 : 20,
            paddingBottom: 12,
            paddingHorizontal: Spacing.lg,
            borderBottomWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface
          }}>
            <TouchableOpacity 
              onPress={() => setActiveChatFriend(null)} 
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surfaceHighlight,
                marginRight: 12
              }}
            >
              <Ionicons name="arrow-back" size={24} color={text.primary} />
            </TouchableOpacity>

            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceHighlight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 16 }}>{activeChatFriend.avatar || 'F'}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: text.primary, fontWeight: 'bold', fontSize: 16 }}>{activeChatFriend.name}</Text>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' }} />
              </View>
              <Text style={{ color: text.tertiary, fontSize: 11 }}>Lvl {activeChatFriend.level} • Active Now</Text>
            </View>
          </View>

          {/* Messages List */}
          <ScrollView 
            style={{ flex: 1, padding: Spacing.lg }}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            ref={(ref) => {
              if (ref) {
                setTimeout(() => ref.scrollToEnd({ animated: true }), 100);
              }
            }}
          >
            {(chatMessages[activeChatFriend.id] || []).length === 0 ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 100 }}>
                <Ionicons name="chatbubbles" size={48} color={colors.border} style={{ marginBottom: 12 }} />
                <Text style={{ color: text.tertiary, fontStyle: 'italic', fontSize: 13 }}>No messages yet. Send a message to start the grind!</Text>
              </View>
            ) : (
              (chatMessages[activeChatFriend.id] || []).map((msg) => {
                const isMe = msg.sender === 'me';
                return (
                  <View 
                    key={msg.id} 
                    style={{
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      backgroundColor: isMe ? accent.red : colors.surfaceElevated,
                      borderWidth: isMe ? 0 : 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      borderBottomRightRadius: isMe ? 2 : 16,
                      borderBottomLeftRadius: isMe ? 16 : 2,
                      paddingHorizontal: 14,
                      paddingVertical: 10
                    }}
                  >
                    <Text style={{ color: isMe ? '#fff' : text.primary, fontSize: 14 }}>{msg.text}</Text>
                    <Text style={{ color: isMe ? 'rgba(255, 255, 255, 0.6)' : text.tertiary, fontSize: 8, marginTop: 4, alignSelf: 'flex-end' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              })
            )}

          </ScrollView>

          {/* Input Bar */}
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: Spacing.md,
              paddingVertical: 12,
              borderTopWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              gap: 8,
              paddingBottom: Platform.OS === 'ios' ? 24 : 12
            }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceHighlight,
                  borderRadius: 20,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  color: text.primary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  fontSize: 14,
                  fontWeight: 'medium'
                }}
                placeholder="Message..."
                placeholderTextColor={text.tertiary}
                value={directChatInput}
                onChangeText={setDirectChatInput}
                onSubmitEditing={handleSendDirectMessage}
              />
              <TouchableOpacity 
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: directChatInput.trim() ? accent.red : colors.surfaceHighlight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: directChatInput.trim() ? accent.red : 'transparent', 
                  shadowOffset: { width: 0, height: 2 }, 
                  shadowOpacity: 0.15, 
                  shadowRadius: 8, 
                  elevation: 2
                }}
                onPress={handleSendDirectMessage}
                disabled={!directChatInput.trim()}
              >
                <Ionicons name="send" size={18} color={directChatInput.trim() ? '#fff' : text.tertiary} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </View>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = Math.floor(seconds / 31536000);

  if (interval >= 1) return interval + 'y ago';
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + 'mo ago';
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + 'd ago';
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + 'h ago';
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + 'm ago';
  return 'just now';
}

const getStyles = (colors: any, text: any, accent: any, status: any, muscle: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 60, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  title: { color: text.primary, fontSize: FontSize['3xl'], fontWeight: FontWeight.extrabold },
  tabSelector: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: accent.red },
  tabText: { color: text.tertiary, fontWeight: 'bold' },
  activeTabText: { color: text.primary },
  content: { padding: Spacing.lg },
  sectionTitle: { color: text.secondary, textTransform: 'uppercase', fontSize: 12, fontWeight: 'bold', marginBottom: Spacing.md },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  myCard: { borderColor: accent.red, borderWidth: 1 },
  rank: { color: text.tertiary, fontSize: 18, fontWeight: 'bold', width: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceHighlight, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  userInfo: { flex: 1 },
  userName: { color: text.primary, fontSize: 16, fontWeight: 'bold' },
  userLevel: { color: text.tertiary, fontSize: 12 },
  userXP: { color: accent.red, fontWeight: 'bold' },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: text.tertiary, marginVertical: Spacing.md },
  primaryButton: { backgroundColor: accent.red, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  primaryButtonText: { color: '#fff', fontWeight: 'bold' },
  routineCard: { backgroundColor: colors.surface, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  routineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routineName: { color: text.primary, fontSize: 16, fontWeight: 'bold' },
  routineAuthor: { color: text.tertiary, fontSize: 12, marginTop: 4 },
});

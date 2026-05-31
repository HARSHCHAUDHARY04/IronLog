import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, useThemeColor, Spacing, BorderRadius, FontSize, FontWeight } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { Sparkles, Send, Brain, Bot, Volume2, VolumeX, Mic } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import MarkdownText from '../../components/MarkdownText';
import { getAICoachingAdvice } from '../../lib/gemini';
import { fetchGlobalLeaderboard, fetchFriends, searchUsers, addFriend, removeFriend, fetchIncomingRequests, acceptFriend, declineFriend } from '../../lib/social';
import { saveTemplate } from '../../lib/storage';
import * as Haptics from 'expo-haptics';

const MOCK_FRIEND_ROUTINES: Record<string, { name: string; muscle_groups: string[]; exercises: { name: string; sets: number; reps: number }[]; prs: { name: string; value: string }[] }> = {
  'mock-1': {
    name: "Alex's Golden Era Chest & Back",
    muscle_groups: ['Chest', 'Back'],
    exercises: [
      { name: 'Barbell Bench Press', sets: 4, reps: 8 },
      { name: 'Incline Dumbbell Press', sets: 3, reps: 10 },
      { name: 'Bent-Over Barbell Rows', sets: 4, reps: 8 },
      { name: 'Pull-Ups', sets: 3, reps: 12 }
    ],
    prs: [
      { name: 'Bench Press', value: '110 kg' },
      { name: 'Deadlift', value: '180 kg' }
    ]
  },
  'mock-2': {
    name: "Sam's Powerlifting Squat Special",
    muscle_groups: ['Legs'],
    exercises: [
      { name: 'Barbell Back Squat', sets: 5, reps: 5 },
      { name: 'Leg Press', sets: 3, reps: 10 },
      { name: 'Romanian Deadlift', sets: 4, reps: 8 }
    ],
    prs: [
      { name: 'Back Squat', value: '160 kg' },
      { name: 'Deadlift', value: '200 kg' }
    ]
  },
  'mock-3': {
    name: "Jordan's High Intensity Shoulder Shred",
    muscle_groups: ['Shoulders'],
    exercises: [
      { name: 'Overhead Press', sets: 4, reps: 6 },
      { name: 'Dumbbell Lateral Raises', sets: 4, reps: 12 },
      { name: 'Face Pulls', sets: 3, reps: 15 }
    ],
    prs: [
      { name: 'Overhead Press', value: '75 kg' }
    ]
  },
  'mock-4': {
    name: "Sarah's Posterior Chain Powerhouse",
    muscle_groups: ['Glutes', 'Hamstrings'],
    exercises: [
      { name: 'Barbell Deadlift', sets: 4, reps: 5 },
      { name: 'Glute Ham Raises', sets: 3, reps: 10 },
      { name: 'Barbell Hip Thrusts', sets: 4, reps: 8 }
    ],
    prs: [
      { name: 'Deadlift', value: '140 kg' },
      { name: 'Squat', value: '115 kg' }
    ]
  }
};

const getFriendRoutine = (id: string, name: string) => {
  if (MOCK_FRIEND_ROUTINES[id]) {
    return MOCK_FRIEND_ROUTINES[id];
  }
  return {
    name: `${name}'s Strength Routine`,
    muscle_groups: ['Full Body'],
    exercises: [
      { name: 'Squat', sets: 3, reps: 8 },
      { name: 'Bench Press', sets: 3, reps: 8 },
      { name: 'Pull-Ups', sets: 3, reps: 10 }
    ],
    prs: [
      { name: 'Bench Press', value: '85 kg' },
      { name: 'Squat', value: '120 kg' }
    ]
  };
};

export default function CommunityScreen() {
  const { colors, text, accent, status, muscle } = useThemeColor();
  const styles = React.useMemo(() => getStyles(colors, text, accent, status, muscle), [colors, text, accent, status, muscle]);

  const [activeTab, setActiveTab] = useState<'leaderboard' | 'friends' | 'routines' | 'ai_coach'>('leaderboard');
  const { user } = useAuthStore();

  // AI Chat Coach States
  const [messages, setMessages] = useState<{ id: string; text: string; sender: 'user' | 'ai'; timestamp: Date }[]>([
    {
      id: 'welcome',
      text: "Hey! I'm IronBot, your certified AI Coach. Ask me anything about progressive overload, breaking plateaus, dynamic recovery, or custom nutrition schedules!",
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isAIResponding, setIsAIResponding] = useState(false);

  // Voice playback state
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Voice recording states
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // Stop speaking when leaving tab or unmounting
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'ai_coach') {
      Speech.stop();
      setSpeakingMessageId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const stored = await AsyncStorage.getItem('nextrep_chats');
        if (stored) {
          setChatMessages(JSON.parse(stored));
        } else {
          const initial = {
            'mock-1': [
              { id: '1', text: "Hey bro! Are we hitting the gym together today?", sender: 'them' as const, timestamp: new Date(Date.now() - 3600000 * 2).toISOString() },
              { id: '2', text: "Yeah! Let's do chest and back.", sender: 'me' as const, timestamp: new Date(Date.now() - 3600000).toISOString() },
              { id: '3', text: "Awesome, see you at 6 PM. I'm going to try to Bench 110kg today!", sender: 'them' as const, timestamp: new Date(Date.now() - 1800000).toISOString() }
            ],
            'mock-2': [
              { id: '1', text: "Did you check out my squat progression chart in the analytics tab?", sender: 'them' as const, timestamp: new Date(Date.now() - 7200000).toISOString() },
              { id: '2', text: "Yes! 160kg is insane progress, Sam!", sender: 'me' as const, timestamp: new Date(Date.now() - 3600000).toISOString() },
              { id: '3', text: "Thanks man! Consistency pays off 👊", sender: 'them' as const, timestamp: new Date(Date.now() - 1800000).toISOString() }
            ],
            'mock-3': [
              { id: '1', text: "Hey! What's the best exercise to hit the rear delts?", sender: 'them' as const, timestamp: new Date(Date.now() - 10000000).toISOString() },
              { id: '2', text: "Face pulls or reverse dumbbell flyes work great.", sender: 'me' as const, timestamp: new Date(Date.now() - 8000000).toISOString() }
            ],
            'mock-4': [
              { id: '1', text: "Smashing deadlifts tomorrow. You in?", sender: 'them' as const, timestamp: new Date(Date.now() - 3600000 * 4).toISOString() }
            ]
          };
          setChatMessages(initial);
          await AsyncStorage.setItem('nextrep_chats', JSON.stringify(initial));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadChats();
  }, []);

  // HTML5 Web Speech Dictation Init
  useEffect(() => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputMessage(prev => prev + (prev ? ' ' : '') + transcript);
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          if (Platform.OS === 'web') {
            if (event.error === 'not-allowed') {
              alert("Microphone Access Denied!\n\nPlease click the lock or settings icon in your browser's address bar and enable Microphone permissions to use voice dictation.");
            } else if (event.error === 'no-speech') {
              console.log('No speech detected.');
            } else {
              alert(`Speech recognition failed: ${event.error}\n\n💡 Note: Browsers disable Speech Recognition on insecure IP-address connections. Please load the site via 'localhost:8081' or 'https' to use this feature.`);
            }
          }
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognition) {
      if (Platform.OS !== 'web') {
        Alert.alert(
          "Mobile Voice Typing Dictation",
          "For high-accuracy voice input on iOS and Android:\n\n1. Tap the text input field.\n2. When the keyboard opens, tap the keyboard microphone button (🎤) next to your space bar!\n\nThis system-level dictation is fast, offline-capable, and works natively.",
          [{ text: "Got it!" }]
        );
      } else {
        alert("Speech recognition is not supported in this browser. Please use Chrome, Safari, or Edge over localhost or HTTPS.");
      }
      return;
    }

    try {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    } catch (err: any) {
      console.error(err);
      if (Platform.OS === 'web') {
        alert(`Failed to start speech recognition: ${err.message || String(err)}`);
      }
    }
  };

  const handleSpeak = async (messageId: string, textToSpeak: string) => {
    if (speakingMessageId === messageId) {
      try {
        Speech.stop();
      } catch (e) {
        console.error('Speech.stop failed:', e);
      }
      setSpeakingMessageId(null);
      return;
    }

    try {
      Speech.stop();
    } catch (e) {}

    setSpeakingMessageId(messageId);

    // Clean markdown formatting before speaking so the coach sounds highly natural
    const cleanText = textToSpeak
      .replace(/[\*\#\-\`\>\_\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('[Speaker] Starting TTS playback for:', cleanText);

    try {
      Speech.speak(cleanText, {
        rate: 0.95,
        pitch: 1.0,
        onStart: () => {
          console.log('[Speaker] Speech started successfully via expo-speech');
        },
        onDone: () => {
          console.log('[Speaker] Speech finished naturally');
          setSpeakingMessageId(null);
        },
        onError: (err: any) => {
          console.error('[Speaker] expo-speech error:', err);
          setSpeakingMessageId(null);
          
          if (Platform.OS === 'web') {
            console.log('[Speaker] Attempting direct browser HTML5 speechSynthesis fallback...');
            try {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(cleanText);
              utterance.rate = 0.95;
              utterance.pitch = 1.0;
              utterance.onend = () => setSpeakingMessageId(null);
              utterance.onerror = () => setSpeakingMessageId(null);
              window.speechSynthesis.speak(utterance);
              setSpeakingMessageId(messageId);
              console.log('[Speaker] Direct browser fallback activated successfully!');
            } catch (fallbackErr) {
              console.error('[Speaker] Direct browser fallback failed:', fallbackErr);
            }
          }
        },
      });
    } catch (speechErr) {
      console.error('[Speaker] expo-speech speak command failed:', speechErr);
      setSpeakingMessageId(null);

      // Direct Web fallback if the expo-speech package has a loading/linkage crash on Web
      if (Platform.OS === 'web') {
        console.log('[Speaker] Attempting direct browser HTML5 speechSynthesis fallback after crash...');
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(cleanText);
          utterance.rate = 0.95;
          utterance.pitch = 1.0;
          utterance.onend = () => setSpeakingMessageId(null);
          utterance.onerror = () => setSpeakingMessageId(null);
          window.speechSynthesis.speak(utterance);
          setSpeakingMessageId(messageId);
          console.log('[Speaker] Direct browser fallback activated after package crash!');
        } catch (fallbackErr) {
          console.error('[Speaker] Direct browser fallback failed:', fallbackErr);
        }
      }
    }
  };

  const SUGGESTED_PROMPTS = [
    "Break a bench press plateau",
    "Explain progressive overload simply",
    "How to manage a deload week?",
    "Calculate my daily protein target"
  ];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg = {
      id: Date.now().toString(),
      text: textToSend,
      sender: 'user' as const,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsAIResponding(true);

    try {
      const response = await getAICoachingAdvice(textToSend);
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'ai' as const,
        timestamp: new Date()
      }]);
    } catch (err: any) {
      console.error(err);
      const errorMessage = err?.message || String(err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: `Unable to reach the AI Coach.\n\nError details:\n"${errorMessage}"\n\n💡 Troubleshooting tip: If the API key is not active, try restarting your Expo dev server with clear cache:\n\n   npx expo start -c`,
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
  const [fistBumps, setFistBumps] = useState<Record<string, number>>({});
  const [isCopyingRoutine, setIsCopyingRoutine] = useState<string | null>(null);

  // Direct Chat States
  const [activeChatFriend, setActiveChatFriend] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, { id: string; text: string; sender: 'me' | 'them'; timestamp: string }[]>>({});
  const [directChatInput, setDirectChatInput] = useState('');
  const [isFriendTyping, setIsFriendTyping] = useState(false);

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
          alert("Friend added successfully!");
        } else {
          Alert.alert("Success", "Friend added successfully!");
        }
      }
    } catch (e) {
      console.error(e);
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
    }
  };

  const handleFistBump = async (friendId: string, name: string) => {
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      console.warn(e);
    }
    setFistBumps(prev => ({
      ...prev,
      [friendId]: (prev[friendId] || 0) + 1
    }));
  };

  const handleCopyRoutine = async (friendId: string, name: string) => {
    setIsCopyingRoutine(friendId);
    try {
      const routine = getFriendRoutine(friendId, name);
      await saveTemplate({
        user_id: user?.id || 'user',
        name: routine.name,
        muscle_groups: routine.muscle_groups,
        exercises: routine.exercises,
        is_default: false
      });
      
      try {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (h) {}

      if (Platform.OS === 'web') {
        alert(`Copied "${routine.name}" directly to your templates!`);
      } else {
        Alert.alert("Success", `Copied "${routine.name}" directly to your templates! You can start this workout in your Workout tab.`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to copy template.");
    } finally {
      setIsCopyingRoutine(null);
    }
  };

  const handleSendDirectMessage = async () => {
    if (!directChatInput.trim() || !activeChatFriend) return;

    const friendId = activeChatFriend.id;
    const newMessage = {
      id: Math.random().toString(),
      text: directChatInput,
      sender: 'me' as const,
      timestamp: new Date().toISOString()
    };

    const updatedChats: Record<string, { id: string; text: string; sender: 'me' | 'them'; timestamp: string }[]> = {
      ...chatMessages,
      [friendId]: [...(chatMessages[friendId] || []), newMessage]
    };
    setChatMessages(updatedChats);
    await AsyncStorage.setItem('nextrep_chats', JSON.stringify(updatedChats));
    setDirectChatInput('');

    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (h) {}

    setIsFriendTyping(true);
    setTimeout(async () => {
      let replyText = "Let's push it! Every single rep counts! 👊";
      const nameLower = activeChatFriend.name.toLowerCase();
      
      if (nameLower.includes('alex')) {
        replyText = "Hell yeah! Remember, consistency beats everything. See you at the gym! 🏋️‍♂️";
      } else if (nameLower.includes('sam')) {
        replyText = "Heavy squats and deadlifts are calling! Let's hit a new PR this week! 🔥";
      } else if (nameLower.includes('jordan')) {
        replyText = "No limits! Let's shatter some boundaries today. Let's go! 🚀";
      } else if (nameLower.includes('sarah')) {
        replyText = "Absolutely! Time to smash some heavy sets and fuel up. Let's get it! 💪";
      } else {
        replyText = `Grinding hard! Let's get that extra rep! 💯`;
      }

      const replyMessage = {
        id: Math.random().toString(),
        text: replyText,
        sender: 'them' as const,
        timestamp: new Date().toISOString()
      };

      const finalChats: Record<string, { id: string; text: string; sender: 'me' | 'them'; timestamp: string }[]> = {
        ...updatedChats,
        [friendId]: [...(updatedChats[friendId] || []), replyMessage]
      };
      setChatMessages(finalChats);
      await AsyncStorage.setItem('nextrep_chats', JSON.stringify(finalChats));
      setIsFriendTyping(false);

      try {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (h) {}
    }, 1500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
      </View>

      <View style={styles.tabSelector}>
        <TouchableOpacity style={[styles.tab, activeTab === 'leaderboard' && styles.activeTab]} onPress={() => setActiveTab('leaderboard')}>
          <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.activeTabText]}>Leaderboard</Text>
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
                      const routine = getFriendRoutine(friend.id, friend.name);
                      const bumpCount = fistBumps[friend.id] || 0;

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
                              {bumpCount > 0 && (
                                <View style={{ backgroundColor: 'rgba(234, 179, 8, 0.15)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                                  <Text style={{ color: '#EAB308', fontSize: 11, fontWeight: 'bold' }}>👊 {bumpCount}</Text>
                                </View>
                              )}
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
                              {/* PRs Section */}
                              {routine.prs.length > 0 && (
                                <View style={{ marginBottom: 14 }}>
                                  <Text style={{ color: text.secondary, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6 }}>Top Lifts 🏆</Text>
                                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                    {routine.prs.map((pr, i) => (
                                      <View key={i} style={{ backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                                        <Text style={{ color: text.tertiary, fontSize: 10 }}>{pr.name}</Text>
                                        <Text style={{ color: accent.red, fontSize: 13, fontWeight: 'bold' }}>{pr.value}</Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}

                              {/* Routine Section */}
                              <View style={{ 
                                backgroundColor: colors.surfaceElevated, 
                                borderRadius: BorderRadius.md, 
                                padding: 12, 
                                borderWidth: 1, 
                                borderColor: colors.border,
                                marginBottom: 14 
                              }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <Text style={{ color: text.primary, fontSize: 13, fontWeight: 'bold' }}>Signature Routine</Text>
                                  <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ color: accent.red, fontSize: 9, fontWeight: 'bold' }}>{routine.muscle_groups.join(', ')}</Text>
                                  </View>
                                </View>
                                <Text style={{ color: text.secondary, fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>{routine.name}</Text>
                                
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
                                  onPress={() => handleCopyRoutine(friend.id, friend.name)}
                                  disabled={isCopyingRoutine === friend.id}
                                >
                                  {isCopyingRoutine === friend.id ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>📋 Copy Routine to My Templates</Text>
                                  )}
                                </TouchableOpacity>
                              </View>

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
            <Text style={styles.sectionTitle}>IronBot AI Personal Trainer</Text>

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
                      
                      {isAI && (
                        <TouchableOpacity
                          style={{
                            position: 'absolute',
                            right: 6,
                            bottom: 6,
                            padding: 4,
                          }}
                          onPress={() => handleSpeak(msg.id, msg.text)}
                        >
                          {speakingMessageId === msg.id ? (
                            <Volume2 size={16} color="#EAB308" />
                          ) : (
                            <VolumeX size={16} color={text.tertiary} />
                          )}
                        </TouchableOpacity>
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
                      IronBot is analyzing...
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
                placeholder="Ask IronBot advice..."
                placeholderTextColor={text.tertiary}
                value={inputMessage}
                onChangeText={setInputMessage}
                onSubmitEditing={() => handleSendMessage(inputMessage)}
              />
              <TouchableOpacity
                style={{
                  backgroundColor: isListening ? '#EF4444' : colors.surfaceHighlight,
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: isListening ? '#EF4444' : colors.border
                }}
                onPress={toggleListening}
              >
                <Mic size={18} color={isListening ? '#FFF' : text.secondary} />
              </TouchableOpacity>
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

            {isFriendTyping && (
              <View 
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  borderBottomLeftRadius: 2,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Text style={{ color: text.tertiary, fontSize: 12, fontStyle: 'italic' }}>{activeChatFriend.name} is typing...</Text>
              </View>
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

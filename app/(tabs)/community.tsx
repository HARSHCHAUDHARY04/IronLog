import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, useThemeColor, Spacing, BorderRadius, FontSize, FontWeight } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { Sparkles, Send, Brain, Bot, Volume2, VolumeX, Mic } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import MarkdownText from '../../components/MarkdownText';
import { getAICoachingAdvice } from '../../lib/gemini';
import { fetchGlobalLeaderboard, fetchFriends, searchUsers, addFriend, removeFriend } from '../../lib/social';

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
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [socialError, setSocialError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchMode, setIsSearchMode] = useState(false);

  const loadSocialData = async () => {
    setIsLoadingSocial(true);
    setSocialError(false);
    try {
      const [lb, fr] = await Promise.all([
        fetchGlobalLeaderboard(20),
        fetchFriends()
      ]);
      setLeaderboard(lb);
      setFriends(fr);
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
                    friends.map((friend) => (
                      <View key={friend.id} style={styles.userCard}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{friend.avatar}</Text>
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.userName}>{friend.name}</Text>
                          <Text style={styles.userLevel}>Lvl {friend.level} • {friend.xp} XP</Text>
                        </View>
                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: 'rgba(239, 68, 68, 0.2)'
                          }}
                          onPress={() => handleRemoveFriend(friend.id)}
                        >
                          <Text style={{ color: accent.red, fontSize: 11, fontWeight: 'bold' }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))
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

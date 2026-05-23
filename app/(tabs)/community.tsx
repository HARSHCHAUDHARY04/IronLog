import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, useThemeColor, Spacing, BorderRadius, FontSize, FontWeight } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';
import { Sparkles, Send, Brain, Bot } from 'lucide-react-native';

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
      const { getAICoachingAdvice } = require('../../lib/gemini');
      const response = await getAICoachingAdvice(textToSend);
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: response,
        sender: 'ai' as const,
        timestamp: new Date()
      }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "I couldn't establish a secure line to the server. Please verify that your `EXPO_PUBLIC_GEMINI_API_KEY` is fully configured inside the `.env` file at the root of the workspace.",
        sender: 'ai' as const,
        timestamp: new Date()
      }]);
    } finally {
      setIsAIResponding(false);
    }
  };

  // Mock Data
  const leaderboard = [
    { rank: 1, name: 'Alex Johnson', level: 12, xp: 14500, avatar: 'A' },
    { rank: 2, name: 'Sam Smith', level: 11, xp: 12200, avatar: 'S' },
    { rank: 3, name: user?.name || 'You', level: user?.level || 1, xp: user?.xp || 0, avatar: (user?.name || 'Y').charAt(0).toUpperCase(), isMe: true },
    { rank: 4, name: 'Jordan Davis', level: 5, xp: 2500, avatar: 'J' },
  ].sort((a, b) => b.xp - a.xp).map((item, idx) => ({ ...item, rank: idx + 1 }));

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

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'leaderboard' && (
          <View>
            <Text style={styles.sectionTitle}>Global Leaderboard</Text>
            {leaderboard.map((u) => (
              <View key={u.name} style={[styles.userCard, u.isMe && styles.myCard]}>
                <Text style={styles.rank}>#{u.rank}</Text>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{u.avatar}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.name}</Text>
                  <Text style={styles.userLevel}>Lvl {u.level}</Text>
                </View>
                <Text style={styles.userXP}>{u.xp} XP</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'friends' && (
          <View>
            <Text style={styles.sectionTitle}>Your Friends</Text>
            <View style={styles.emptyState}>
              <Ionicons name="people" size={48} color={text.tertiary} />
              <Text style={styles.emptyText}>You haven't added any friends yet.</Text>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Find Friends</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'ai_coach' && (
          <View style={{ flex: 1, minHeight: 450 }}>
            <Text style={styles.sectionTitle}>IronBot AI Personal Trainer</Text>
            
            {/* Chat Messages */}
            <View style={{
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: Spacing.md,
              height: 300,
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
                        borderColor: isAI ? 'rgba(234,179,8,0.2)' : 'transparent'
                      }}
                    >
                      <Text style={{ 
                        color: isAI ? text.primary : '#1E1B18', 
                        fontSize: 14,
                        fontWeight: isAI ? 'normal' : '600'
                      }}>
                        {msg.text}
                      </Text>
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
        )}
      </ScrollView>
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

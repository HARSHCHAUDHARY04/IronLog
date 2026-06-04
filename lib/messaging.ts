// ═══════════════════════════════════════════════════════
// Messaging Library — Direct messages with Supabase + local fallback
// ═══════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { getUser } from './storage';

const CHATS_KEY = 'nextrep_chats';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'them';
  sender_id?: string;
  timestamp: string;
  read_at?: string | null;
}

/**
 * Send a message to a friend
 */
export async function sendMessage(friendId: string, text: string): Promise<ChatMessage> {
  const currentUser = await getUser();
  const messageId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  
  const newMessage: ChatMessage = {
    id: messageId,
    text,
    sender: 'me',
    sender_id: currentUser?.id,
    timestamp: new Date().toISOString(),
  };

  // Always save locally first (optimistic)
  const chats = await getLocalChats();
  if (!chats[friendId]) chats[friendId] = [];
  chats[friendId].push(newMessage);
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));

  // Try Supabase if configured
  if (isSupabaseConfigured && currentUser?.id) {
    try {
      await supabase.from('messages').insert({
        id: messageId,
        sender_id: currentUser.id,
        receiver_id: friendId,
        text,
      });
    } catch (e) {
      console.error('Supabase sendMessage failed:', e);
    }
  }

  return newMessage;
}

/**
 * Get all messages for a conversation with a friend
 */
export async function getMessages(friendId: string): Promise<ChatMessage[]> {
  const currentUser = await getUser();

  if (isSupabaseConfigured && currentUser?.id) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const messages: ChatMessage[] = data.map((m: any) => ({
          id: m.id,
          text: m.text,
          sender: m.sender_id === currentUser.id ? 'me' as const : 'them' as const,
          sender_id: m.sender_id,
          timestamp: m.created_at,
          read_at: m.read_at,
        }));

        // Also update local cache
        const chats = await getLocalChats();
        chats[friendId] = messages;
        await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));

        return messages;
      }
    } catch (e) {
      console.error('Supabase getMessages failed:', e);
    }
  }

  // Fallback to local
  const chats = await getLocalChats();
  return chats[friendId] || [];
}

/**
 * Subscribe to real-time messages from a friend (Supabase Realtime)
 * Returns an unsubscribe function
 */
export function subscribeToMessages(
  friendId: string,
  currentUserId: string,
  onNewMessage: (msg: ChatMessage) => void
): () => void {
  if (!isSupabaseConfigured) {
    return () => {}; // No-op if not configured
  }

  const channel = supabase
    .channel(`messages:${currentUserId}:${friendId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${currentUserId}`,
      },
      (payload: any) => {
        const msg = payload.new;
        if (msg.sender_id === friendId) {
          onNewMessage({
            id: msg.id,
            text: msg.text,
            sender: 'them',
            sender_id: msg.sender_id,
            timestamp: msg.created_at,
            read_at: msg.read_at,
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Mark a message as read
 */
export async function markAsRead(messageId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);
    } catch (e) {
      console.error('markAsRead failed:', e);
    }
  }
}

/**
 * Get locally stored chats
 */
async function getLocalChats(): Promise<Record<string, ChatMessage[]>> {
  try {
    const stored = await AsyncStorage.getItem(CHATS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to read local chats:', e);
  }
  return {};
}

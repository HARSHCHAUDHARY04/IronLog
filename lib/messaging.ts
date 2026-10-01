// ═══════════════════════════════════════════════════════
// Messaging Library — Direct messages with Supabase + local fallback
// ═══════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { getLocalUser, generateId } from './storage';

const CHATS_KEY = 'nextrep_chats';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'them';
  sender_id?: string;
  timestamp: string;
  read_at?: string | null;
}

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Send a message to a friend. Throws if the server rejects it, so the UI
 * can tell the user instead of showing a message that was never delivered.
 */
export async function sendMessage(friendId: string, text: string): Promise<ChatMessage> {
  const currentUser = await getLocalUser();
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) throw new Error('Message is empty');

  const newMessage: ChatMessage = {
    id: generateId(),
    text: trimmed,
    sender: 'me',
    sender_id: currentUser?.id,
    timestamp: new Date().toISOString(),
  };

  if (isSupabaseConfigured && currentUser?.id) {
    const { error } = await supabase.from('messages').insert({
      id: newMessage.id,
      sender_id: currentUser.id,
      receiver_id: friendId,
      text: trimmed,
    });
    if (error) {
      throw new Error(error.code === '42501'
        ? 'You can only message accepted friends.'
        : `Message not sent: ${error.message}`);
    }
  }

  const chats = await getLocalChats();
  chats[friendId] = [...(chats[friendId] || []), newMessage];
  await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));

  return newMessage;
}

/**
 * Get all messages for a conversation with a friend
 */
export async function getMessages(friendId: string): Promise<ChatMessage[]> {
  const currentUser = await getLocalUser();

  if (isSupabaseConfigured && currentUser?.id) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true })
        .limit(500);

      if (error) console.error('Supabase getMessages failed:', error);
      if (!error && data) {
        const messages: ChatMessage[] = data.map((m: any) => ({
          id: m.id,
          text: m.text,
          sender: m.sender_id === currentUser.id ? 'me' as const : 'them' as const,
          sender_id: m.sender_id,
          timestamp: m.created_at,
          read_at: m.read_at,
        }));

        const chats = await getLocalChats();
        chats[friendId] = messages;
        await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(chats));

        return messages;
      }
    } catch (e) {
      console.error('Supabase getMessages failed:', e);
    }
  }

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
    return () => {};
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
 * Mark every unread message from a friend as read
 */
export async function markConversationRead(friendId: string): Promise<void> {
  const currentUser = await getLocalUser();
  if (!isSupabaseConfigured || !currentUser?.id) return;
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', friendId)
    .eq('receiver_id', currentUser.id)
    .is('read_at', null);
  if (error) console.error('markConversationRead failed:', error);
}

/**
 * Mark a message as read
 */
export async function markAsRead(messageId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) console.error('markAsRead failed:', error);
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

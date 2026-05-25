import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { getUser, User } from './storage';

export interface SocialUser {
  id: string;
  name: string;
  email?: string;
  xp: number;
  level: number;
  avatar?: string;
  isMe?: boolean;
}

export interface FriendRelation {
  id: string;
  friend: SocialUser;
  status: 'pending' | 'accepted' | 'incoming';
}

const KEYS = {
  FRIENDS: 'ironlog_social_friends',
  PENDING_REQUESTS: 'ironlog_social_pending',
  ALL_USERS: 'ironlog_social_users_pool',
};

// Seed initial pool of mock users for local/offline fallback
const INITIAL_MOCK_USERS: SocialUser[] = [
  { id: 'mock-1', name: 'Alex Johnson', xp: 14500, level: 12, avatar: 'A' },
  { id: 'mock-2', name: 'Sam Smith', xp: 12200, level: 11, avatar: 'S' },
  { id: 'mock-3', name: 'Jordan Davis', xp: 2500, level: 5, avatar: 'J' },
  { id: 'mock-4', name: 'Sarah Miller', xp: 8200, level: 9, avatar: 'M' },
  { id: 'mock-5', name: 'Chris Evans', xp: 1100, level: 3, avatar: 'C' },
];

/**
 * Ensures mock users pool exists in AsyncStorage
 */
async function ensureMockPool() {
  const data = await AsyncStorage.getItem(KEYS.ALL_USERS);
  if (!data) {
    await AsyncStorage.setItem(KEYS.ALL_USERS, JSON.stringify(INITIAL_MOCK_USERS));
  }
}

/**
 * Fetch the global leaderboard
 */
export async function fetchGlobalLeaderboard(limitNum = 20): Promise<SocialUser[]> {
  const currentUser = await getUser();
  
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('get_global_leaderboard', { limit_num: limitNum });
      if (!error && data) {
        return data.map((u: any) => ({
          id: u.id,
          name: u.username || u.name || 'Anonymous Lifter',
          xp: u.xp || 0,
          level: u.level || 1,
          avatar: u.avatar_url || (u.username || 'A').charAt(0).toUpperCase(),
          isMe: currentUser ? u.id === currentUser.id : false,
        }));
      }
      console.warn('Leaderboard RPC failed, falling back to direct profiles query:', error);
      
      const { data: profiles, error: profError } = await supabase
        .from('profiles')
        .select('id, username, level, xp')
        .order('xp', { ascending: false })
        .limit(limitNum);
        
      if (!profError && profiles) {
        return profiles.map((u: any) => ({
          id: u.id,
          name: u.username || 'Anonymous Lifter',
          xp: u.xp || 0,
          level: u.level || 1,
          avatar: (u.username || 'A').charAt(0).toUpperCase(),
          isMe: currentUser ? u.id === currentUser.id : false,
        }));
      }
    } catch (e) {
      console.error('Failed to communicate with Supabase leaderboard:', e);
    }
  }

  // --- MOCK FALLBACK ---
  await ensureMockPool();
  const poolStr = await AsyncStorage.getItem(KEYS.ALL_USERS);
  const pool: SocialUser[] = poolStr ? JSON.parse(poolStr) : INITIAL_MOCK_USERS;

  // Add the current user to the leaderboard pool
  if (currentUser) {
    const userInPool = pool.find(u => u.id === currentUser.id);
    if (!userInPool) {
      pool.push({
        id: currentUser.id,
        name: currentUser.name || 'You',
        xp: currentUser.xp || 0,
        level: currentUser.level || 1,
        avatar: (currentUser.name || 'Y').charAt(0).toUpperCase(),
        isMe: true,
      });
    } else {
      userInPool.xp = currentUser.xp;
      userInPool.level = currentUser.level;
    }
  }

  return pool
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limitNum)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

/**
 * Fetch list of friends
 */
export async function fetchFriends(): Promise<SocialUser[]> {
  const currentUser = await getUser();
  if (!currentUser) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          id,
          status,
          user_id_1,
          user_id_2
        `)
        .eq('status', 'accepted')
        .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);

      if (!error && data) {
        const friendIds = data.map(rel => rel.user_id_1 === currentUser.id ? rel.user_id_2 : rel.user_id_1);
        if (friendIds.length > 0) {
          const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('id, username, level, xp')
            .in('id', friendIds);

          if (!profError && profiles) {
            return profiles.map((u: any) => ({
              id: u.id,
              name: u.username || 'Anonymous Friend',
              xp: u.xp || 0,
              level: u.level || 1,
              avatar: (u.username || 'F').charAt(0).toUpperCase(),
            }));
          }
        }
        return [];
      }
    } catch (e) {
      console.error('Failed to fetch Supabase friends:', e);
    }
  }

  // --- MOCK FALLBACK ---
  const data = await AsyncStorage.getItem(KEYS.FRIENDS);
  return data ? JSON.parse(data) : [];
}

/**
 * Search users in the app
 */
export async function searchUsers(query: string): Promise<SocialUser[]> {
  const currentUser = await getUser();
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, level, xp')
        .ilike('username', `%${trimmed}%`)
        .neq('id', currentUser?.id || '')
        .limit(10);

      if (!error && data) {
        return data.map((u: any) => ({
          id: u.id,
          name: u.username || 'Anonymous Lifter',
          xp: u.xp || 0,
          level: u.level || 1,
          avatar: (u.username || 'A').charAt(0).toUpperCase(),
        }));
      }
    } catch (e) {
      console.error('Failed to search Supabase users:', e);
    }
  }

  // --- MOCK FALLBACK ---
  await ensureMockPool();
  const poolStr = await AsyncStorage.getItem(KEYS.ALL_USERS);
  const pool: SocialUser[] = poolStr ? JSON.parse(poolStr) : INITIAL_MOCK_USERS;

  return pool.filter(
    u => 
      u.name.toLowerCase().includes(trimmed) && 
      u.id !== currentUser?.id
  );
}

/**
 * Send a friend request
 */
export async function addFriend(friendId: string): Promise<boolean> {
  const currentUser = await getUser();
  if (!currentUser) return false;

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('friends')
        .insert([
          { user_id_1: currentUser.id, user_id_2: friendId, status: 'accepted' } // Auto-accept requests for simplified demo
        ]);
      if (!error) return true;
    } catch (e) {
      console.error('Failed to send Supabase request:', e);
    }
  }

  // --- MOCK FALLBACK ---
  await ensureMockPool();
  const poolStr = await AsyncStorage.getItem(KEYS.ALL_USERS);
  const pool: SocialUser[] = poolStr ? JSON.parse(poolStr) : INITIAL_MOCK_USERS;
  
  const targetFriend = pool.find(u => u.id === friendId);
  if (!targetFriend) return false;

  const currentFriends = await fetchFriends();
  if (currentFriends.some(f => f.id === friendId)) return true; // Already friends

  currentFriends.push(targetFriend);
  await AsyncStorage.setItem(KEYS.FRIENDS, JSON.stringify(currentFriends));
  return true;
}

/**
 * Remove a friend relationship
 */
export async function removeFriend(friendId: string): Promise<boolean> {
  const currentUser = await getUser();
  if (!currentUser) return false;

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .or(`and(user_id_1.eq.${currentUser.id},user_id_2.eq.${friendId}),and(user_id_1.eq.${friendId},user_id_2.eq.${currentUser.id})`);
      if (!error) return true;
    } catch (e) {
      console.error('Failed to delete Supabase friend:', e);
    }
  }

  // --- MOCK FALLBACK ---
  const currentFriends = await fetchFriends();
  const filtered = currentFriends.filter(f => f.id !== friendId);
  await AsyncStorage.setItem(KEYS.FRIENDS, JSON.stringify(filtered));
  return true;
}

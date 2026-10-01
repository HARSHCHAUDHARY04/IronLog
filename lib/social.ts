import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { getLocalUser, generateId } from './storage';

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

export interface SharedRoutine {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  exercises: { name: string; sets: number; reps: number }[];
  downloads: number;
  created_at: string;
}

const KEYS = {
  FRIENDS: 'ironlog_social_friends',
  PENDING_REQUESTS: 'ironlog_social_pending',
  ALL_USERS: 'ironlog_social_users_pool',
};

// Mock users exist ONLY for offline mode (no Supabase configured).
// With Supabase configured, errors surface as errors — never fake people.
const useMocks = !isSupabaseConfigured;

const INITIAL_MOCK_USERS: SocialUser[] = [
  { id: 'mock-1', name: 'Alex Johnson', xp: 14500, level: 12, avatar: 'A' },
  { id: 'mock-2', name: 'Sam Smith', xp: 12200, level: 11, avatar: 'S' },
  { id: 'mock-3', name: 'Jordan Davis', xp: 2500, level: 5, avatar: 'J' },
  { id: 'mock-4', name: 'Sarah Miller', xp: 8200, level: 9, avatar: 'M' },
  { id: 'mock-5', name: 'Chris Evans', xp: 1100, level: 3, avatar: 'C' },
];

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function getMockPool(): Promise<SocialUser[]> {
  const pool = await readJSON<SocialUser[] | null>(KEYS.ALL_USERS, null);
  if (pool) return pool;
  await AsyncStorage.setItem(KEYS.ALL_USERS, JSON.stringify(INITIAL_MOCK_USERS));
  return INITIAL_MOCK_USERS;
}

function profileName(u: any, fallback = 'Anonymous Lifter'): string {
  return u?.display_name || u?.username || fallback;
}

function toSocialUser(u: any, meId?: string): SocialUser {
  const name = profileName(u);
  return {
    id: u.id,
    name,
    xp: u.xp || 0,
    level: u.level || 1,
    avatar: name.charAt(0).toUpperCase(),
    isMe: meId ? u.id === meId : false,
  };
}

// Select display_name when the migration has added it, else fall back
async function selectProfiles<T>(
  build: (columns: string) => PromiseLike<{ data: T | null; error: any }>
): Promise<T> {
  let res = await build('id, username, display_name, level, xp');
  if (res.error && (res.error.code === '42703' || res.error.code === 'PGRST204')) {
    res = await build('id, username, level, xp');
  }
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/**
 * Fetch the global leaderboard
 */
export async function fetchGlobalLeaderboard(limitNum = 20): Promise<SocialUser[]> {
  const currentUser = await getLocalUser();

  if (!useMocks) {
    const { data, error } = await supabase.rpc('get_global_leaderboard', { limit_num: limitNum });
    if (!error && data) return (data as any[]).map(u => toSocialUser(u, currentUser?.id));

    const profiles = await selectProfiles<any[]>(cols =>
      supabase.from('profiles').select(cols).order('xp', { ascending: false }).limit(limitNum)
    );
    return profiles.map(u => toSocialUser(u, currentUser?.id));
  }

  const pool = [...(await getMockPool())];
  if (currentUser) {
    pool.push({
      id: currentUser.id,
      name: currentUser.name || 'You',
      xp: currentUser.xp || 0,
      level: currentUser.level || 1,
      avatar: (currentUser.name || 'Y').charAt(0).toUpperCase(),
      isMe: true,
    });
  }
  return pool.sort((a, b) => b.xp - a.xp).slice(0, limitNum);
}

/**
 * Fetch incoming pending friend requests
 */
export async function fetchIncomingRequests(): Promise<SocialUser[]> {
  const currentUser = await getLocalUser();
  if (!currentUser) return [];

  if (!useMocks) {
    const { data, error } = await supabase
      .from('friends')
      .select('user_id_1')
      .eq('user_id_2', currentUser.id)
      .eq('status', 'pending');
    if (error) throw new Error(error.message);

    const ids = (data || []).map((r: any) => r.user_id_1);
    if (ids.length === 0) return [];
    const profiles = await selectProfiles<any[]>(cols => supabase.from('profiles').select(cols).in('id', ids));
    return profiles.map(u => toSocialUser(u));
  }

  return readJSON<SocialUser[]>(KEYS.PENDING_REQUESTS, []);
}

/**
 * Accept a friend request
 */
export async function acceptFriend(friendId: string): Promise<boolean> {
  const currentUser = await getLocalUser();
  if (!currentUser) return false;

  if (!useMocks) {
    const { error } = await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('user_id_1', friendId)
      .eq('user_id_2', currentUser.id);
    if (error) throw new Error(error.message);
    return true;
  }

  let pending = await readJSON<SocialUser[]>(KEYS.PENDING_REQUESTS, []);
  const target = pending.find(u => u.id === friendId);
  if (!target) return false;
  pending = pending.filter(u => u.id !== friendId);
  await AsyncStorage.setItem(KEYS.PENDING_REQUESTS, JSON.stringify(pending));
  const friends = await readJSON<SocialUser[]>(KEYS.FRIENDS, []);
  if (!friends.some(f => f.id === friendId)) {
    friends.push(target);
    await AsyncStorage.setItem(KEYS.FRIENDS, JSON.stringify(friends));
  }
  return true;
}

/**
 * Decline/Ignore a friend request
 */
export async function declineFriend(friendId: string): Promise<boolean> {
  const currentUser = await getLocalUser();
  if (!currentUser) return false;

  if (!useMocks) {
    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('user_id_1', friendId)
      .eq('user_id_2', currentUser.id);
    if (error) throw new Error(error.message);
    return true;
  }

  const pending = await readJSON<SocialUser[]>(KEYS.PENDING_REQUESTS, []);
  await AsyncStorage.setItem(KEYS.PENDING_REQUESTS, JSON.stringify(pending.filter(u => u.id !== friendId)));
  return true;
}

/**
 * Fetch list of accepted friends
 */
export async function fetchFriends(): Promise<SocialUser[]> {
  const currentUser = await getLocalUser();
  if (!currentUser) return [];

  if (!useMocks) {
    const { data, error } = await supabase
      .from('friends')
      .select('user_id_1, user_id_2')
      .eq('status', 'accepted')
      .or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);
    if (error) throw new Error(error.message);

    const friendIds = (data || []).map((rel: any) =>
      rel.user_id_1 === currentUser.id ? rel.user_id_2 : rel.user_id_1
    );
    if (friendIds.length === 0) return [];
    const profiles = await selectProfiles<any[]>(cols => supabase.from('profiles').select(cols).in('id', friendIds));
    return profiles.map(u => toSocialUser(u));
  }

  return readJSON<SocialUser[]>(KEYS.FRIENDS, []);
}

/** Ids of users with a pending request in either direction */
export async function fetchOutgoingRequestIds(): Promise<string[]> {
  const currentUser = await getLocalUser();
  if (!currentUser || useMocks) return [];
  const { data, error } = await supabase
    .from('friends')
    .select('user_id_2')
    .eq('user_id_1', currentUser.id)
    .eq('status', 'pending');
  if (error) return [];
  return (data || []).map((r: any) => r.user_id_2);
}

/**
 * Search users in the app
 */
export async function searchUsers(query: string): Promise<SocialUser[]> {
  const currentUser = await getLocalUser();
  // Strip characters that have meaning in PostgREST filters
  const trimmed = query.trim().toLowerCase().replace(/[%,()*\\]/g, '');
  if (trimmed.length < 2) return [];

  if (!useMocks) {
    let res: { data: any[] | null; error: any } = await supabase
      .from('profiles')
      .select('id, username, display_name, level, xp')
      .or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
      .neq('id', currentUser?.id || '')
      .limit(10);
    if (res.error && (res.error.code === '42703' || res.error.code === 'PGRST204')) {
      res = await supabase
        .from('profiles')
        .select('id, username, level, xp')
        .ilike('username', `%${trimmed}%`)
        .neq('id', currentUser?.id || '')
        .limit(10);
    }
    if (res.error) throw new Error(res.error.message);
    return (res.data || []).map(u => toSocialUser(u));
  }

  const pool = await getMockPool();
  return pool.filter(u => u.name.toLowerCase().includes(trimmed) && u.id !== currentUser?.id);
}

/**
 * Send a friend request
 */
export async function addFriend(friendId: string): Promise<boolean> {
  const currentUser = await getLocalUser();
  if (!currentUser || friendId === currentUser.id) return false;

  if (!useMocks) {
    const { error } = await supabase
      .from('friends')
      .insert({ user_id_1: currentUser.id, user_id_2: friendId, status: 'pending' });
    if (error) {
      if (error.code === '23505') throw new Error('You already have a request or friendship with this user.');
      throw new Error(error.message);
    }
    return true;
  }

  const pool = await getMockPool();
  const target = pool.find(u => u.id === friendId);
  if (!target) return false;
  const friends = await readJSON<SocialUser[]>(KEYS.FRIENDS, []);
  if (!friends.some(f => f.id === friendId)) {
    friends.push(target);
    await AsyncStorage.setItem(KEYS.FRIENDS, JSON.stringify(friends));
  }
  return true;
}

/**
 * Remove a friend relationship
 */
export async function removeFriend(friendId: string): Promise<boolean> {
  const currentUser = await getLocalUser();
  if (!currentUser) return false;

  if (!useMocks) {
    const { error } = await supabase
      .from('friends')
      .delete()
      .or(`and(user_id_1.eq.${currentUser.id},user_id_2.eq.${friendId}),and(user_id_1.eq.${friendId},user_id_2.eq.${currentUser.id})`);
    if (error) throw new Error(error.message);
    return true;
  }

  const friends = await readJSON<SocialUser[]>(KEYS.FRIENDS, []);
  await AsyncStorage.setItem(KEYS.FRIENDS, JSON.stringify(friends.filter(f => f.id !== friendId)));
  return true;
}

// ───────────────────────────────────────────────────────
// Shared routines (public table: shared_routines)
// ───────────────────────────────────────────────────────

function toRoutine(r: any): SharedRoutine {
  return {
    id: r.id,
    creator_id: r.creator_id,
    name: r.name,
    description: r.description || '',
    exercises: Array.isArray(r.exercises) ? r.exercises : [],
    downloads: r.downloads || 0,
    created_at: r.created_at,
  };
}

/** Routines shared by the given users (e.g. your friends), newest first */
export async function fetchSharedRoutines(creatorIds: string[]): Promise<SharedRoutine[]> {
  if (useMocks || creatorIds.length === 0) return [];
  const { data, error } = await supabase
    .from('shared_routines')
    .select('*')
    .in('creator_id', creatorIds)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []).map(toRoutine);
}

export async function shareRoutine(routine: {
  name: string;
  description?: string;
  exercises: { name: string; sets: number; reps: number }[];
}): Promise<SharedRoutine> {
  const currentUser = await getLocalUser();
  if (useMocks || !currentUser) throw new Error('Sign in with a cloud account to share routines.');

  const { data, error } = await supabase
    .from('shared_routines')
    .insert({
      id: generateId(),
      creator_id: currentUser.id,
      name: routine.name,
      description: routine.description || '',
      exercises: routine.exercises,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toRoutine(data);
}

/** Bump the download counter when someone copies a routine (best effort) */
export async function recordRoutineDownload(routineId: string): Promise<void> {
  if (useMocks) return;
  const { error } = await supabase.rpc('increment_routine_downloads', { p_routine: routineId });
  if (error) console.warn('increment_routine_downloads failed:', error.message);
}

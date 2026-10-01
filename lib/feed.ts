// ═══════════════════════════════════════════════════════
// Social Feed — Workout sharing with reactions
// ═══════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { fetchFriends } from './social';
import { getLocalUser, generateId } from './storage';

const FEED_KEY = 'ironlog_feed_posts';
const REACTIONS_KEY = 'ironlog_feed_reactions';

export interface WorkoutPost {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  workout_name: string;
  muscle_groups: string[];
  duration_minutes: number;
  total_volume_kg: number;
  exercise_count: number;
  prs_hit: number;
  caption: string;
  created_at: string;
  reactions: PostReaction[];
}

export interface PostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction: 'fire' | 'muscle' | 'fist';
}

/**
 * Share a completed workout to the feed
 */
export async function shareWorkout(data: {
  workout_name: string;
  muscle_groups: string[];
  duration_minutes: number;
  total_volume_kg: number;
  exercise_count: number;
  prs_hit: number;
  caption: string;
}): Promise<WorkoutPost> {
  const user = await getLocalUser();
  const postId = generateId();

  const post: WorkoutPost = {
    id: postId,
    user_id: user?.id || 'local',
    user_name: user?.name || 'You',
    user_avatar: (user?.name || 'Y').charAt(0).toUpperCase(),
    workout_name: data.workout_name,
    muscle_groups: data.muscle_groups,
    duration_minutes: data.duration_minutes,
    total_volume_kg: data.total_volume_kg,
    exercise_count: data.exercise_count,
    prs_hit: data.prs_hit,
    caption: data.caption,
    created_at: new Date().toISOString(),
    reactions: [],
  };

  // Supabase first: a post only exists once the server accepts it
  if (isSupabaseConfigured && user?.id) {
    const { error } = await supabase.from('workout_posts').insert({
        id: postId,
        user_id: user.id,
        workout_name: data.workout_name,
        muscle_groups: data.muscle_groups,
        duration_minutes: data.duration_minutes,
        total_volume_kg: data.total_volume_kg,
        exercise_count: data.exercise_count,
        prs_hit: data.prs_hit,
        caption: data.caption,
      });
    if (error) throw new Error(`Could not share workout: ${error.message}`);
  }

  const feed = await getLocalFeed();
  feed.unshift(post);
  await AsyncStorage.setItem(FEED_KEY, JSON.stringify(feed.slice(0, 50)));

  return post;
}

/**
 * Get the social feed (friends + own posts)
 */
export async function getFeed(): Promise<WorkoutPost[]> {
  const user = await getLocalUser();
  if (isSupabaseConfigured && user?.id) {
    try {
      // RLS also enforces this once the migration is applied
      const friends = await fetchFriends().catch(() => []);
      const authorIds = [user.id, ...friends.map(f => f.id)];

      const { data, error } = await supabase
        .from('workout_posts')
        .select(`
          *,
          profiles:user_id (*),
          post_reactions (id, user_id, reaction)
        `)
        .in('user_id', authorIds)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) console.error('Supabase getFeed failed:', error);
      if (!error && data) {
        const posts: WorkoutPost[] = data.map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          user_name: p.profiles?.display_name || p.profiles?.username || 'Anonymous',
          user_avatar: (p.profiles?.display_name || p.profiles?.username || 'A').charAt(0).toUpperCase(),
          workout_name: p.workout_name,
          muscle_groups: p.muscle_groups || [],
          duration_minutes: p.duration_minutes || 0,
          total_volume_kg: Number(p.total_volume_kg) || 0,
          exercise_count: p.exercise_count || 0,
          prs_hit: p.prs_hit || 0,
          caption: p.caption || '',
          created_at: p.created_at,
          reactions: (p.post_reactions || []).map((r: any) => ({
            id: r.id,
            post_id: p.id,
            user_id: r.user_id,
            reaction: r.reaction,
          })),
        }));

        await AsyncStorage.setItem(FEED_KEY, JSON.stringify(posts));
        return posts;
      }
    } catch (e) {
      console.error('Supabase getFeed failed:', e);
    }
  }

  return getLocalFeed();
}

/**
 * Add a reaction to a post
 */
export async function addReaction(postId: string, reaction: 'fire' | 'muscle' | 'fist'): Promise<void> {
  const user = await getLocalUser();
  const reactionId = generateId();

  // Update local feed
  const feed = await getLocalFeed();
  const postIndex = feed.findIndex(p => p.id === postId);
  if (postIndex >= 0) {
    // Remove existing reaction from this user
    feed[postIndex].reactions = feed[postIndex].reactions.filter(r => r.user_id !== user?.id);
    feed[postIndex].reactions.push({
      id: reactionId,
      post_id: postId,
      user_id: user?.id || 'local',
      reaction,
    });
    await AsyncStorage.setItem(FEED_KEY, JSON.stringify(feed));
  }

  // Supabase sync
  if (isSupabaseConfigured && user?.id) {
    try {
      // One reaction per user per post (UNIQUE(post_id, user_id)); there is
      // no UPDATE policy, so replace instead of upsert
      const { error: delError } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      if (delError) console.error('Supabase reaction cleanup failed:', delError);

      const { error } = await supabase.from('post_reactions').insert({
        id: reactionId,
        post_id: postId,
        user_id: user.id,
        reaction,
      });
      if (error) console.error('Supabase addReaction failed:', error);
    } catch (e) {
      console.error('Supabase addReaction failed:', e);
    }
  }
}

/**
 * Remove a reaction from a post
 */
export async function removeReaction(postId: string): Promise<void> {
  const user = await getLocalUser();

  // Update local feed
  const feed = await getLocalFeed();
  const postIndex = feed.findIndex(p => p.id === postId);
  if (postIndex >= 0) {
    feed[postIndex].reactions = feed[postIndex].reactions.filter(r => r.user_id !== user?.id);
    await AsyncStorage.setItem(FEED_KEY, JSON.stringify(feed));
  }

  // Supabase sync
  if (isSupabaseConfigured && user?.id) {
    try {
      const { error } = await supabase
        .from('post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', user.id);
      if (error) console.error('Supabase removeReaction failed:', error);
    } catch (e) {
      console.error('Supabase removeReaction failed:', e);
    }
  }
}

/**
 * Get locally stored feed
 */
async function getLocalFeed(): Promise<WorkoutPost[]> {
  try {
    const stored = await AsyncStorage.getItem(FEED_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [];
}

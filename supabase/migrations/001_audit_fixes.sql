-- ═══════════════════════════════════════════════════════
-- 001 — Audit fixes
-- Safe to run more than once. Run in the Supabase SQL editor
-- (or `supabase db push`) AFTER schema.sql has been applied.
-- ═══════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────
-- Helpers
-- ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.are_friends(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friends f
    WHERE f.status = 'accepted'
      AND ((f.user_id_1 = a AND f.user_id_2 = b) OR (f.user_id_1 = b AND f.user_id_2 = a))
  );
$$;

-- ───────────────────────────────────────────────────────
-- 1. Profiles: display name, safe writes, server-owned XP
-- ───────────────────────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Clients may create their own row (the signup trigger normally does) and
-- edit cosmetic fields + streak/badges. xp / level / total_workouts are
-- computed by the database from the workouts table.
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile."
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, username, display_name, avatar_url) ON public.profiles TO authenticated;
GRANT UPDATE (username, display_name, avatar_url, current_streak, highest_streak, badges)
  ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_profile_stats(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
  v_xp INTEGER;
BEGIN
  -- Same formula as the app: 10 XP per workout + 1 XP per 100 kg volume,
  -- capped per workout so a typo can't top the leaderboard.
  SELECT COUNT(*), COALESCE(SUM(LEAST(ROUND(COALESCE(total_volume_kg, 0) / 100), 500) + 10), 0)
    INTO v_count, v_xp
  FROM public.workouts WHERE user_id = p_user;

  UPDATE public.profiles
  SET total_workouts = v_count,
      xp = v_xp,
      level = FLOOR(SQRT(v_xp / 100.0))::INTEGER + 1
  WHERE id = p_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.workouts_recompute_stats()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_profile_stats(COALESCE(NEW.user_id, OLD.user_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS workouts_recompute_stats ON public.workouts;
CREATE TRIGGER workouts_recompute_stats
  AFTER INSERT OR DELETE OR UPDATE OF total_volume_kg, user_id ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.workouts_recompute_stats();

-- Backfill everyone from their actual workouts
SELECT public.recompute_profile_stats(id) FROM public.profiles;

-- Signup trigger: usernames are UNIQUE, so derive a collision-free handle
-- instead of copying the display name (two "Rahul"s used to break signup).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_display TEXT;
  v_base TEXT;
BEGIN
  v_display := COALESCE(
    NULLIF(new.raw_user_meta_data->>'full_name', ''),
    NULLIF(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );
  v_base := LEFT(REGEXP_REPLACE(LOWER(v_display), '[^a-z0-9_]+', '_', 'g'), 20);

  INSERT INTO public.profiles (id, username, display_name, avatar_url, xp, level)
  VALUES (
    new.id,
    v_base || '_' || LEFT(REPLACE(new.id::TEXT, '-', ''), 6),
    v_display,
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    0,
    1
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Fill display_name for existing rows
UPDATE public.profiles p
SET display_name = COALESCE(u.name, p.username)
FROM public.users u
WHERE u.id = p.id AND p.display_name IS NULL;

UPDATE public.profiles SET display_name = username WHERE display_name IS NULL;

-- Leaderboard returns display_name too (return type changed → drop first)
DROP FUNCTION IF EXISTS public.get_global_leaderboard(INTEGER);
CREATE FUNCTION public.get_global_leaderboard(limit_num INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  level INTEGER,
  xp INTEGER,
  total_workouts INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.username, p.display_name, p.avatar_url, p.level, p.xp, p.total_workouts
  FROM public.profiles p
  ORDER BY p.xp DESC
  LIMIT LEAST(GREATEST(limit_num, 1), 100);
$$;

-- ───────────────────────────────────────────────────────
-- 2. History functions ran as SECURITY DEFINER with a caller-supplied
--    user id, so anyone could read anyone's training log. Run them
--    with the caller's rights so RLS applies.
-- ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regprocedure('public.get_exercise_history(uuid,text,integer)') IS NOT NULL THEN
    ALTER FUNCTION public.get_exercise_history(UUID, TEXT, INTEGER) SECURITY INVOKER;
  END IF;
  IF to_regprocedure('public.get_1rm_progression(uuid,text,integer)') IS NOT NULL THEN
    ALTER FUNCTION public.get_1rm_progression(UUID, TEXT, INTEGER) SECURITY INVOKER;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────
-- 3. Friends: no self-friending
-- ───────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friends_not_self') THEN
    ALTER TABLE public.friends ADD CONSTRAINT friends_not_self CHECK (user_id_1 <> user_id_2) NOT VALID;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────
-- 4. Messages: only between friends; receivers may only set read_at
-- ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can send messages." ON public.messages;
CREATE POLICY "Users can send messages."
ON public.messages FOR INSERT
WITH CHECK (auth.uid() = sender_id AND public.are_friends(sender_id, receiver_id));

REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

-- ───────────────────────────────────────────────────────
-- 5. Feed: posts visible to the author and their friends only
-- ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Workout posts are viewable by everyone." ON public.workout_posts;
DROP POLICY IF EXISTS "Workout posts are viewable by friends." ON public.workout_posts;
CREATE POLICY "Workout posts are viewable by friends."
ON public.workout_posts FOR SELECT
USING (auth.uid() = user_id OR public.are_friends(auth.uid(), user_id));

DROP POLICY IF EXISTS "Reactions are viewable by everyone." ON public.post_reactions;
DROP POLICY IF EXISTS "Reactions are viewable with their post." ON public.post_reactions;
CREATE POLICY "Reactions are viewable with their post."
ON public.post_reactions FOR SELECT
USING (EXISTS (SELECT 1 FROM public.workout_posts p WHERE p.id = post_id));

DROP POLICY IF EXISTS "Users can add reactions." ON public.post_reactions;
CREATE POLICY "Users can add reactions."
ON public.post_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (SELECT 1 FROM public.workout_posts p WHERE p.id = post_id)
);

-- ───────────────────────────────────────────────────────
-- 6. Shared routines: creators can delete; downloads via RPC
-- ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can delete their own routines." ON public.shared_routines;
CREATE POLICY "Users can delete their own routines."
ON public.shared_routines FOR DELETE USING (auth.uid() = creator_id);

CREATE INDEX IF NOT EXISTS idx_shared_routines_creator ON public.shared_routines (creator_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.increment_routine_downloads(p_routine UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.shared_routines SET downloads = downloads + 1 WHERE id = p_routine;
$$;
GRANT EXECUTE ON FUNCTION public.increment_routine_downloads(UUID) TO authenticated;

-- ───────────────────────────────────────────────────────
-- 7. Account deletion (required by Google Play / App Store)
-- ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.post_reactions
    WHERE user_id = uid OR post_id IN (SELECT id FROM public.workout_posts WHERE user_id = uid);
  DELETE FROM public.workout_posts WHERE user_id = uid;
  DELETE FROM public.messages WHERE sender_id = uid OR receiver_id = uid;
  DELETE FROM public.friends WHERE user_id_1 = uid OR user_id_2 = uid;
  DELETE FROM public.shared_routines WHERE creator_id = uid;
  -- Cascades to workouts, exercises, progress, personal_records, workout_templates
  DELETE FROM public.users WHERE id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

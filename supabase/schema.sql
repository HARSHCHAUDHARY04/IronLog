-- ═══════════════════════════════════════════════════════
-- IronLog Database Schema
-- Supabase (PostgreSQL) with Row Level Security
-- ═══════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ───────────────────────────────────────────────────────
-- EXERCISE LIBRARY (reference table, no RLS needed for reads)
-- ───────────────────────────────────────────────────────
CREATE TABLE exercise_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  aliases TEXT[] DEFAULT '{}',
  primary_muscles TEXT[] NOT NULL DEFAULT '{}',
  secondary_muscles TEXT[] DEFAULT '{}',
  equipment TEXT NOT NULL DEFAULT 'bodyweight',
  movement_pattern TEXT NOT NULL DEFAULT 'push',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  instructions TEXT,
  common_mistakes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ───────────────────────────────────────────────────────
-- USERS
-- ───────────────────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  age INTEGER,
  weight_kg NUMERIC,
  height_cm NUMERIC,
  goal TEXT DEFAULT 'general_fitness'
    CHECK (goal IN ('strength', 'hypertrophy', 'weight_loss', 'endurance', 'general_fitness')),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ───────────────────────────────────────────────────────
-- WORKOUTS
-- ───────────────────────────────────────────────────────
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date DATE DEFAULT CURRENT_DATE,
  name TEXT,
  muscle_groups TEXT[] DEFAULT '{}',
  duration_minutes INTEGER DEFAULT 0,
  notes TEXT,
  total_volume_kg NUMERIC DEFAULT 0,
  is_template BOOLEAN DEFAULT false,
  template_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workouts_user_date ON workouts(user_id, workout_date DESC);
CREATE INDEX idx_workouts_user_id ON workouts(user_id);

-- ───────────────────────────────────────────────────────
-- EXERCISES (logged sets within a workout)
-- ───────────────────────────────────────────────────────
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  exercise_library_id UUID REFERENCES exercise_library(id),
  set_number INTEGER NOT NULL DEFAULT 1,
  reps INTEGER NOT NULL DEFAULT 0,
  weight_kg NUMERIC NOT NULL DEFAULT 0,
  rpe NUMERIC CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  is_warmup BOOLEAN DEFAULT false,
  notes TEXT,
  estimated_1rm NUMERIC GENERATED ALWAYS AS (
    CASE WHEN reps > 0 AND weight_kg > 0
      THEN ROUND(weight_kg * (1 + reps::NUMERIC / 30), 2)
      ELSE 0
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exercises_workout ON exercises(workout_id);
CREATE INDEX idx_exercises_name ON exercises(exercise_name);

-- ───────────────────────────────────────────────────────
-- PROGRESS (bodyweight tracking)
-- ───────────────────────────────────────────────────────
CREATE TABLE progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_weight NUMERIC NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_progress_user_date ON progress(user_id, date DESC);

-- ───────────────────────────────────────────────────────
-- PERSONAL RECORDS
-- ───────────────────────────────────────────────────────
CREATE TABLE personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('1rm', 'volume', 'reps')),
  value NUMERIC NOT NULL,
  previous_value NUMERIC,
  improvement_pct NUMERIC,
  achieved_at TIMESTAMPTZ DEFAULT now(),
  workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL
);

CREATE INDEX idx_prs_user ON personal_records(user_id, exercise_name);

-- ───────────────────────────────────────────────────────
-- WORKOUT TEMPLATES
-- ───────────────────────────────────────────────────────
CREATE TABLE workout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  muscle_groups TEXT[] DEFAULT '{}',
  exercises JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_user ON workout_templates(user_id);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════

-- Users: can only access own record
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_insert ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_update ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY users_delete ON users FOR DELETE USING (auth.uid() = id);

-- Workouts: can only access own workouts
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY workouts_select ON workouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY workouts_insert ON workouts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY workouts_update ON workouts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY workouts_delete ON workouts FOR DELETE USING (auth.uid() = user_id);

-- Exercises: access through workout ownership
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY exercises_select ON exercises FOR SELECT
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));
CREATE POLICY exercises_insert ON exercises FOR INSERT
  WITH CHECK (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));
CREATE POLICY exercises_update ON exercises FOR UPDATE
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));
CREATE POLICY exercises_delete ON exercises FOR DELETE
  USING (workout_id IN (SELECT id FROM workouts WHERE user_id = auth.uid()));

-- Progress: own data only
ALTER TABLE progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY progress_select ON progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY progress_insert ON progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY progress_update ON progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY progress_delete ON progress FOR DELETE USING (auth.uid() = user_id);

-- Personal Records: own data only
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY prs_select ON personal_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY prs_insert ON personal_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY prs_update ON personal_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY prs_delete ON personal_records FOR DELETE USING (auth.uid() = user_id);

-- Templates: own data only
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY templates_select ON workout_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY templates_insert ON workout_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY templates_update ON workout_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY templates_delete ON workout_templates FOR DELETE USING (auth.uid() = user_id);

-- Exercise Library: readable by all authenticated users
ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY exercise_lib_select ON exercise_library FOR SELECT
  USING (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════

-- Function to get exercise history for progress charts
CREATE OR REPLACE FUNCTION get_exercise_history(
  p_user_id UUID,
  p_exercise_name TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  workout_date DATE,
  set_number INTEGER,
  reps INTEGER,
  weight_kg NUMERIC,
  estimated_1rm NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT w.workout_date, e.set_number, e.reps, e.weight_kg, e.estimated_1rm
  FROM exercises e
  JOIN workouts w ON e.workout_id = w.id
  WHERE w.user_id = p_user_id
    AND e.exercise_name = p_exercise_name
    AND e.is_warmup = false
  ORDER BY w.workout_date DESC, e.set_number ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get best 1RM per session for an exercise
CREATE OR REPLACE FUNCTION get_1rm_progression(
  p_user_id UUID,
  p_exercise_name TEXT,
  p_days INTEGER DEFAULT 90
)
RETURNS TABLE (
  workout_date DATE,
  best_1rm NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT w.workout_date, MAX(e.estimated_1rm) as best_1rm
  FROM exercises e
  JOIN workouts w ON e.workout_id = w.id
  WHERE w.user_id = p_user_id
    AND e.exercise_name = p_exercise_name
    AND e.is_warmup = false
    AND w.workout_date >= CURRENT_DATE - p_days
  GROUP BY w.workout_date
  ORDER BY w.workout_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

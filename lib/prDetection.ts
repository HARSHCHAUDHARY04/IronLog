// ═══════════════════════════════════════════════════════
// Personal Record Detection System
// Auto-detects new PRs for 1RM, volume, and reps
// ═══════════════════════════════════════════════════════

import { calculate1RM, calculateVolume, ExerciseSet } from './overloadEngine';

export interface PersonalRecord {
  id: string;
  exercise_name: string;
  record_type: '1rm' | 'volume' | 'reps';
  value: number;
  previous_value: number | null;
  improvement_pct: number | null;
  achieved_at: string;
  workout_id: string;
}

export interface PRCheckResult {
  is_pr: boolean;
  record_type: '1rm' | 'volume' | 'reps';
  new_value: number;
  previous_value: number | null;
  improvement_pct: number | null;
  exercise_name: string;
}

/**
 * Check if current workout sets contain any new PRs for a given exercise
 */
export function checkForPRs(
  exerciseName: string,
  currentSets: ExerciseSet[],
  historicalPRs: { oneRM: number; volume: number; maxReps: number }
): PRCheckResult[] {
  const prs: PRCheckResult[] = [];
  const workingSets = currentSets.filter(s => !s.is_warmup && s.weight_kg > 0 && s.reps > 0);

  if (workingSets.length === 0) return prs;

  // Check 1RM PR
  const current1RM = Math.max(...workingSets.map(s => calculate1RM(s.weight_kg, s.reps)));
  if (current1RM > historicalPRs.oneRM && historicalPRs.oneRM > 0) {
    const improvement = ((current1RM - historicalPRs.oneRM) / historicalPRs.oneRM) * 100;
    prs.push({
      is_pr: true,
      record_type: '1rm',
      new_value: Math.round(current1RM * 100) / 100,
      previous_value: historicalPRs.oneRM,
      improvement_pct: Math.round(improvement * 10) / 10,
      exercise_name: exerciseName,
    });
  } else if (historicalPRs.oneRM === 0 && current1RM > 0) {
    // First time doing this exercise
    prs.push({
      is_pr: true,
      record_type: '1rm',
      new_value: Math.round(current1RM * 100) / 100,
      previous_value: null,
      improvement_pct: null,
      exercise_name: exerciseName,
    });
  }

  // Check Volume PR (total volume for this exercise in the session)
  const currentVolume = calculateVolume(currentSets);
  if (currentVolume > historicalPRs.volume && historicalPRs.volume > 0) {
    const improvement = ((currentVolume - historicalPRs.volume) / historicalPRs.volume) * 100;
    prs.push({
      is_pr: true,
      record_type: 'volume',
      new_value: Math.round(currentVolume),
      previous_value: historicalPRs.volume,
      improvement_pct: Math.round(improvement * 10) / 10,
      exercise_name: exerciseName,
    });
  }

  // Check Max Reps PR (highest reps at the heaviest weight used)
  const heaviestWeight = Math.max(...workingSets.map(s => s.weight_kg));
  const repsAtHeaviest = Math.max(
    ...workingSets.filter(s => s.weight_kg === heaviestWeight).map(s => s.reps)
  );
  if (repsAtHeaviest > historicalPRs.maxReps && historicalPRs.maxReps > 0) {
    prs.push({
      is_pr: true,
      record_type: 'reps',
      new_value: repsAtHeaviest,
      previous_value: historicalPRs.maxReps,
      improvement_pct: null,
      exercise_name: exerciseName,
    });
  }

  return prs;
}

/**
 * Format PR for display
 */
export function formatPR(pr: PRCheckResult): string {
  switch (pr.record_type) {
    case '1rm':
      if (pr.previous_value) {
        return `New estimated 1RM: ${pr.new_value}kg (+${pr.improvement_pct}%)`;
      }
      return `First 1RM recorded: ${pr.new_value}kg`;
    case 'volume':
      return `Volume PR: ${pr.new_value}kg total (+${pr.improvement_pct}%)`;
    case 'reps':
      return `Rep PR: ${pr.new_value} reps at heaviest weight`;
    default:
      return '';
  }
}

/**
 * Get PR emoji based on type
 */
export function getPREmoji(type: '1rm' | 'volume' | 'reps'): string {
  switch (type) {
    case '1rm': return '🏆';
    case 'volume': return '📊';
    case 'reps': return '🔥';
    default: return '⭐';
  }
}

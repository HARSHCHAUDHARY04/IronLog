// ═══════════════════════════════════════════════════════
// Progressive Overload Engine
// Core algorithm for strength progression recommendations
// Uses Epley formula and rolling window analysis
// ═══════════════════════════════════════════════════════

export interface ExerciseSet {
  id: string;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe?: number;
  is_warmup: boolean;
  estimated_1rm: number;
}

export interface SessionData {
  workout_date: string;
  sets: ExerciseSet[];
  best_1rm: number;
  total_volume: number;
}

export type OverloadStatus = 
  | 'progressing'
  | 'plateau' 
  | 'regression' 
  | 'new_exercise'
  | 'insufficient_data';

export type OverloadRecommendation = 
  | 'weight_up'
  | 'reps_up' 
  | 'maintain' 
  | 'deload' 
  | 'switch_variation';

export interface OverloadAnalysis {
  status: OverloadStatus;
  recommendation: OverloadRecommendation;
  details: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  current1RM: number;
  previous1RM?: number;
  changePercent?: number;
  sessionsAnalyzed: number;
}

// ───────────────────────────────────────────────────────
// 1RM Estimation (Epley Formula)
// ───────────────────────────────────────────────────────

/**
 * Calculate estimated 1RM using the Epley formula
 * 1RM = weight × (1 + reps / 30)
 */
export function calculate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 100) / 100;
}

/**
 * Calculate the best 1RM from a set of working sets (excluding warmups)
 */
export function bestSessionRM(sets: ExerciseSet[]): number {
  const workingSets = sets.filter(s => !s.is_warmup && s.weight_kg > 0 && s.reps > 0);
  if (workingSets.length === 0) return 0;
  return Math.max(...workingSets.map(s => calculate1RM(s.weight_kg, s.reps)));
}

/**
 * Calculate total volume for a set of exercises
 * Volume = sum(sets × reps × weight)
 */
export function calculateVolume(sets: ExerciseSet[]): number {
  return sets
    .filter(s => !s.is_warmup)
    .reduce((total, s) => total + (s.reps * s.weight_kg), 0);
}

// ───────────────────────────────────────────────────────
// Plateau Detection Algorithm
// ───────────────────────────────────────────────────────

const PLATEAU_THRESHOLD = 0.02; // 2% change
const REGRESSION_THRESHOLD = -0.02; // -2% change
const MIN_SESSIONS = 3; // Minimum sessions for analysis
const ROLLING_WINDOW = 3; // Sessions to analyze
const MIN_FREQUENCY_DAYS = 28; // Must have trained exercise within this window

/**
 * Analyze exercise history and determine overload status + recommendation
 */
export function analyzeOverload(sessions: SessionData[]): OverloadAnalysis {
  // Not enough data
  if (sessions.length < MIN_SESSIONS) {
    return {
      status: sessions.length === 0 ? 'new_exercise' : 'insufficient_data',
      recommendation: 'maintain',
      details: sessions.length === 0 
        ? 'First time performing this exercise. Focus on form and finding your working weight.'
        : `Need at least ${MIN_SESSIONS} sessions for analysis. Keep logging! (${sessions.length}/${MIN_SESSIONS})`,
      current1RM: sessions.length > 0 ? sessions[0].best_1rm : 0,
      sessionsAnalyzed: sessions.length,
    };
  }

  // Take the most recent sessions within the rolling window
  const recentSessions = sessions.slice(0, ROLLING_WINDOW);
  const current1RM = recentSessions[0].best_1rm;
  const oldest1RM = recentSessions[recentSessions.length - 1].best_1rm;

  // Calculate percentage change
  const changePercent = oldest1RM > 0 
    ? (current1RM - oldest1RM) / oldest1RM 
    : 0;

  // Determine status
  let status: OverloadStatus;
  let recommendation: OverloadRecommendation;
  let details: string;
  let suggestedWeight: number | undefined;
  let suggestedReps: number | undefined;

  if (changePercent > PLATEAU_THRESHOLD) {
    // ✅ Progressing
    status = 'progressing';
    recommendation = 'weight_up';
    suggestedWeight = Math.ceil((recentSessions[0].sets.find(s => !s.is_warmup)?.weight_kg || 0) + 2.5);
    details = `Great progress! Your estimated 1RM increased by ${(changePercent * 100).toFixed(1)}% over the last ${ROLLING_WINDOW} sessions. Consider adding 2.5kg.`;

  } else if (changePercent < REGRESSION_THRESHOLD) {
    // 🔴 Regression
    status = 'regression';
    
    // Check if regression persists across multiple sessions
    const consecutiveDeclines = countConsecutiveDeclines(recentSessions);
    
    if (consecutiveDeclines >= 3) {
      recommendation = 'deload';
      const currentWeight = recentSessions[0].sets.find(s => !s.is_warmup)?.weight_kg || 0;
      suggestedWeight = Math.round(currentWeight * 0.9 / 2.5) * 2.5; // Round to nearest 2.5
      details = `Performance has declined for ${consecutiveDeclines} consecutive sessions. Consider a deload week at ${suggestedWeight}kg (90% of current) to recover.`;
    } else {
      recommendation = 'maintain';
      details = `Your 1RM dropped ${Math.abs(changePercent * 100).toFixed(1)}%. This could be fatigue, poor sleep, or nutrition. Maintain current weight and monitor.`;
    }

  } else {
    // 🟡 Plateau
    status = 'plateau';
    
    // Check how many sessions at same performance
    const lastSet = recentSessions[0].sets.find(s => !s.is_warmup);
    const secondLastSet = recentSessions[1]?.sets.find(s => !s.is_warmup);
    
    const sameWeight = lastSet && secondLastSet && 
      lastSet.weight_kg === secondLastSet.weight_kg;
    const sameReps = lastSet && secondLastSet && 
      lastSet.reps === secondLastSet.reps;

    if (sameWeight && sameReps && lastSet && lastSet.reps >= 8) {
      // Same weight and reps, and reps are at target → increase weight
      recommendation = 'weight_up';
      suggestedWeight = (lastSet?.weight_kg || 0) + 2.5;
      details = `You've hit ${lastSet.reps} reps at ${lastSet.weight_kg}kg for 2+ sessions. Time to go heavier! Try ${suggestedWeight}kg.`;
    } else if (sameWeight && lastSet && lastSet.reps < 8) {
      // Same weight but reps below target → add reps
      recommendation = 'reps_up';
      suggestedReps = (lastSet?.reps || 0) + 1;
      details = `You're at ${lastSet.weight_kg}kg for ${lastSet.reps} reps. Try to push for ${suggestedReps} reps before increasing weight.`;
    } else {
      // Check session count at plateau
      const plateauSessionCount = countPlateauSessions(sessions);
      if (plateauSessionCount >= 6) {
        recommendation = 'switch_variation';
        details = `You've plateaued for ${plateauSessionCount}+ sessions. Consider switching to a variation of this exercise for 2-3 weeks to break through.`;
      } else {
        recommendation = 'maintain';
        details = `Your 1RM has been stable (±${(Math.abs(changePercent) * 100).toFixed(1)}%). This is normal — keep pushing and the breakthrough will come.`;
      }
    }
  }

  return {
    status,
    recommendation,
    details,
    suggestedWeight,
    suggestedReps,
    current1RM,
    previous1RM: oldest1RM,
    changePercent: changePercent * 100,
    sessionsAnalyzed: recentSessions.length,
  };
}

// ───────────────────────────────────────────────────────
// Helper Functions
// ───────────────────────────────────────────────────────

function countConsecutiveDeclines(sessions: SessionData[]): number {
  let count = 0;
  for (let i = 0; i < sessions.length - 1; i++) {
    if (sessions[i].best_1rm < sessions[i + 1].best_1rm) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function countPlateauSessions(sessions: SessionData[]): number {
  if (sessions.length < 2) return 0;
  const baseline = sessions[0].best_1rm;
  let count = 1;
  
  for (let i = 1; i < sessions.length; i++) {
    const change = Math.abs((sessions[i].best_1rm - baseline) / baseline);
    if (change < PLATEAU_THRESHOLD) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Generate smart auto-fill weight suggestion based on last session
 */
export function getAutoFillSuggestion(
  lastSets: ExerciseSet[],
  analysis?: OverloadAnalysis
): { weight: number; reps: number } | null {
  if (!lastSets || lastSets.length === 0) return null;

  const lastWorkingSet = lastSets.find(s => !s.is_warmup);
  if (!lastWorkingSet) return null;

  if (analysis?.suggestedWeight) {
    return {
      weight: analysis.suggestedWeight,
      reps: analysis.suggestedReps || lastWorkingSet.reps,
    };
  }

  return {
    weight: lastWorkingSet.weight_kg,
    reps: lastWorkingSet.reps,
  };
}

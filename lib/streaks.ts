// ═══════════════════════════════════════════════════════
// Streak calculation (pure — no storage or network access)
// ═══════════════════════════════════════════════════════

import { daysBetween, toLocalDateStr } from './date';

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}

/**
 * Streak = consecutive workout days where the gap between two workouts is
 * at most `allowedGap` days (1 = every day, 2 = one rest day allowed, ...).
 */
export function calculateStreaks(workoutDates: string[], allowedGap: number, today: string = toLocalDateStr()): StreakResult {
  const dates = [...new Set(workoutDates)].sort().reverse();
  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let currentStreak = 0;
  if (daysBetween(today, dates[0]) <= allowedGap) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      if (daysBetween(dates[i - 1], dates[i]) <= allowedGap) currentStreak++;
      else break;
    }
  }

  let longestStreak = 1;
  let temp = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i - 1], dates[i]) <= allowedGap) {
      temp++;
    } else {
      temp = 1;
    }
    longestStreak = Math.max(longestStreak, temp);
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) };
}

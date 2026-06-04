// ═══════════════════════════════════════════════════════
// AI Weekly Report — Gemini-powered training analysis
// Generates a personalized weekly training summary
// ═══════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateGeminiContent } from './gemini';
import { getWorkouts, getWorkoutStats, getPRs } from './storage';

const REPORT_CACHE_KEY = 'ironlog_weekly_report';
const REPORT_DATE_KEY = 'ironlog_weekly_report_date';

export interface WeeklyReport {
  grade: string;           // A+, A, B+, B, C, D, F
  summary: string;         // 2-sentence overview
  highlights: string[];    // 2-3 bullet point highlights
  recommendations: string[]; // 2-3 actionable recommendations
  muscle_balance: string;  // Comment on muscle group balance
  generated_at: string;
}

/**
 * Get cached report if available for today
 */
export async function getCachedReport(): Promise<WeeklyReport | null> {
  try {
    const dateStr = await AsyncStorage.getItem(REPORT_DATE_KEY);
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (dateStr === todayStr) {
      const cached = await AsyncStorage.getItem(REPORT_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Failed to read cached report:', e);
  }
  return null;
}

/**
 * Generate a fresh weekly report using Gemini AI
 */
export async function generateWeeklyReport(): Promise<WeeklyReport> {
  // Gather this week's data
  const [stats, workouts, prs] = await Promise.all([
    getWorkoutStats(),
    getWorkouts(),
    getPRs(),
  ]);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const thisWeekWorkouts = workouts.filter(w => new Date(w.workout_date) >= startOfWeek);
  const thisWeekPRs = prs.filter(p => new Date(p.achieved_at) >= startOfWeek);

  // Build muscle group summary
  const muscleGroups: Record<string, number> = {};
  thisWeekWorkouts.forEach(w => {
    w.muscle_groups.forEach(mg => {
      muscleGroups[mg] = (muscleGroups[mg] || 0) + 1;
    });
  });

  const exerciseNames = [...new Set(thisWeekWorkouts.flatMap(w => w.exercises.map(e => e.exercise_name)))];

  const dataContext = `
Weekly Training Data:
- Workouts completed: ${thisWeekWorkouts.length}
- Total volume: ${stats.thisWeekVolume} kg (last week: ${stats.lastWeekVolume} kg)
- Volume change: ${stats.lastWeekVolume > 0 ? ((stats.thisWeekVolume - stats.lastWeekVolume) / stats.lastWeekVolume * 100).toFixed(0) : 'N/A'}%
- Current streak: ${stats.currentStreak} days
- PRs hit this week: ${thisWeekPRs.length}
- Muscle groups trained: ${Object.entries(muscleGroups).map(([mg, count]) => `${mg} (${count}x)`).join(', ') || 'None'}
- Exercises performed: ${exerciseNames.slice(0, 8).join(', ') || 'None'}
- Total lifetime workouts: ${stats.totalWorkouts}
`;

  const payload = {
    contents: [{ parts: [{ text: `You are a certified CSCS strength coach analyzing a trainee's weekly performance.

${dataContext}

Based on this data, provide a structured weekly report card. Be specific, tactical, and brutally honest. Use the trainee's actual numbers. If they did 0 workouts, grade accordingly.` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          grade: { type: 'STRING', description: 'Letter grade: A+, A, B+, B, C+, C, D, or F' },
          summary: { type: 'STRING', description: 'Exactly 2 sentences summarizing the week performance' },
          highlights: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: '2-3 specific highlights/wins from the week'
          },
          recommendations: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: '2-3 specific, actionable recommendations for next week'
          },
          muscle_balance: { type: 'STRING', description: '1 sentence on muscle group balance or imbalances' }
        },
        required: ['grade', 'summary', 'highlights', 'recommendations', 'muscle_balance']
      }
    }
  };

  const responseData = await generateGeminiContent(payload);
  const textResponse = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textResponse) {
    throw new Error('No response from Gemini AI');
  }

  const parsed = JSON.parse(textResponse);
  const report: WeeklyReport = {
    ...parsed,
    generated_at: new Date().toISOString(),
  };

  // Cache the report
  const todayStr = new Date().toISOString().split('T')[0];
  await AsyncStorage.setItem(REPORT_CACHE_KEY, JSON.stringify(report));
  await AsyncStorage.setItem(REPORT_DATE_KEY, todayStr);

  return report;
}

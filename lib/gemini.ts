// ═══════════════════════════════════════════════════════
// Gemini AI Integration Layer
// Production requests go through the `ai` Supabase Edge Function
// (supabase/functions/ai) so the API key never ships in the APK.
// ═══════════════════════════════════════════════════════

import { supabase, isSupabaseConfigured } from './supabase';

const GEMINI_MODEL = 'gemini-2.5-flash';

export interface GeminiPayload {
  contents: { role?: 'user' | 'model'; parts: { text: string }[] }[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: object;
}

/**
 * Dev-only escape hatch: lets you iterate locally before the Edge Function
 * is deployed. `__DEV__` is false in release builds, so this branch (and the
 * key) is stripped from production bundles. Do NOT set this in EAS env.
 */
async function callGeminiDirect(payload: GeminiPayload, apiKey: string): Promise<any> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} - ${await response.text()}`);
  }
  return response.json();
}

export async function generateGeminiContent(payload: GeminiPayload): Promise<any> {
  if (__DEV__) {
    const devKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (devKey) return callGeminiDirect(payload, devKey);
  }

  if (!isSupabaseConfigured) {
    throw new Error('AI features need Supabase configured (the `ai` Edge Function holds the API key).');
  }

  const { data, error } = await supabase.functions.invoke('ai', { body: payload });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.json) detail = JSON.stringify(await ctx.json());
    } catch {}
    throw new Error(`AI service error: ${detail}`);
  }
  return data;
}

function extractText(responseData: any): string | undefined {
  return responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
}

const COACH_SYSTEM_PROMPT = `You are RepBot, an elite personal trainer, CSCS (Certified Strength and Conditioning Specialist), and nutrition coach for the Next Rep fitness app.

Deliver highly technical, science-based, and actionable fitness guidance.

STRICT CONSTRAINTS:
- No conversational preambles ("Sure!", "Hello!") and no sign-offs ("Keep lifting!", "Hope this helps!").
- Keep the entire response under 120 words.
- Format in clean Markdown: ### for section headers, **bold** for key directives, single-line "- " bullets.
- Use the trainee's training data when it is relevant. Never invent numbers they did not give you.
- Only answer fitness, training, recovery and nutrition questions; politely decline anything else.`;

export interface CoachTurn {
  role: 'user' | 'model';
  text: string;
}

/**
 * Multi-turn coaching chat. `history` is the conversation so far (oldest
 * first, ending with the user's latest message); `trainingContext` is a
 * short summary of the user's recent training.
 */
export async function getAICoachingAdvice(history: CoachTurn[], trainingContext?: string): Promise<string> {
  const systemText = trainingContext
    ? `${COACH_SYSTEM_PROMPT}\n\nTRAINEE DATA:\n${trainingContext}`
    : COACH_SYSTEM_PROMPT;

  const payload: GeminiPayload = {
    systemInstruction: { parts: [{ text: systemText }] },
    // Keep the last few turns to bound request size
    contents: history.slice(-12).map(turn => ({ role: turn.role, parts: [{ text: turn.text }] })),
  };

  const text = extractText(await generateGeminiContent(payload));
  return text || "Sorry, I couldn't generate coaching advice right now.";
}

export interface GeneratedWorkoutTemplate {
  name: string;
  muscle_groups: string[];
  exercises: {
    name: string;
    sets: number;
    reps: number;
  }[];
}

/**
 * Generate a custom, structured workout template using Gemini structured output.
 * `allowedExercises` constrains names to the app's library so history and
 * muscle mapping work for generated workouts.
 */
export async function generateSmartWorkout(
  fitnessGoal: string,
  equipment: string,
  targetDurationMin: number,
  allowedExercises: string[] = []
): Promise<GeneratedWorkoutTemplate> {
  const libraryHint = allowedExercises.length > 0
    ? `\nChoose exercise names EXACTLY from this list:\n${allowedExercises.join(', ')}`
    : '';

  const payload: GeminiPayload = {
    systemInstruction: {
      parts: [{
        text: `You are a certified Strength and Conditioning Specialist (CSCS). Generate a single custom workout session matching the user's criteria: a punchy session name, the primary muscle groups targeted, and 4-6 exercises with appropriate sets and rep targets.${libraryHint}`,
      }],
    },
    contents: [{
      role: 'user',
      parts: [{ text: `Goal: ${fitnessGoal}\nAvailable equipment: ${equipment}\nTarget duration: ${targetDurationMin} minutes` }],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Name of the workout session' },
          muscle_groups: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'List of muscle groups targeted (e.g. chest, back, quadriceps)'
          },
          exercises: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: 'Name of the exercise' },
                sets: { type: 'INTEGER', description: 'Number of working sets' },
                reps: { type: 'INTEGER', description: 'Target reps per set' }
              },
              required: ['name', 'sets', 'reps']
            },
            description: 'Ordered list of workout exercises'
          }
        },
        required: ['name', 'muscle_groups', 'exercises']
      }
    }
  };

  const text = extractText(await generateGeminiContent(payload));
  if (!text) throw new Error('No response content received from Gemini.');

  const parsed: GeneratedWorkoutTemplate = JSON.parse(text);
  // Clamp to sane values in case the model drifts
  parsed.exercises = parsed.exercises.slice(0, 8).map(e => ({
    name: e.name,
    sets: Math.min(Math.max(Math.round(e.sets) || 3, 1), 10),
    reps: Math.min(Math.max(Math.round(e.reps) || 8, 1), 100),
  }));
  return parsed;
}

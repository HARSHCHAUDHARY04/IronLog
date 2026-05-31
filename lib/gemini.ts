// ═══════════════════════════════════════════════════════
// Gemini AI API Integration Layer
// Lightweight, native-friendly REST interface for Gemini 2.5 Flash
// No external SDK dependencies to keep React Native bundle lean
// ═══════════════════════════════════════════════════════

const GEMINI_MODEL = 'gemini-2.5-flash';
const getApiKey = () => process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

/**
 * Base method to interact with the Gemini API using native fetch
 */
export async function generateGeminiContent(payload: object): Promise<any> {
  const apiKey = getApiKey();
  console.log('[Gemini API] Request sent. API Key loaded:', apiKey ? `Yes (...${apiKey.slice(-4)})` : 'No (MISSING)');
  
  if (!apiKey) {
    throw new Error('Gemini API key is missing. Please add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to communicate with Gemini API:', error);
    throw error;
  }
}

/**
 * Generate quick advice or coaching response
 */
export async function getAICoachingAdvice(userPrompt: string): Promise<string> {
  const payload = {
    contents: [
      {
        parts: [
          {
            text: `You are RepBot, an elite personal trainer, CSCS (Certified Strength and Conditioning Specialist), and nutrition coach for the Next Rep fitness app.
            
            Deliver a highly technical, science-based, and actionable fitness directive.
            
            STRICT CONSTRAINTS:
            - ZERO conversational preambles: Do NOT write "Sure!", "Hello!", "Here is some advice", or any introductory filler. Start directly with the first header or answer.
            - ZERO conversational sign-offs: Do NOT write "Keep lifting!", "Hope this helps!", "Let me know if you need anything else", or any friendly summaries at the end.
            - HIGH CONCISENESS: Keep the entire response extremely compact, high-density, and straight to the point (Strictly under 120 words).
            - Format PURE actionable coaching value in clean Markdown:
              - Use ### for clear section headers.
              - Use **concept** to emphasize tactical directives.
              - Use concise single-line bullet points (- ) for instructions.
              
            User Question: "${userPrompt}"`
          }
        ]
      }
    ]
  };

  const responseData = await generateGeminiContent(payload);
  const textResponse = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
  return textResponse || "Sorry, I couldn't generate coaching advice right now.";
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
 * Generate a custom, structured workout template using Gemini's Structured Outputs (JSON Schema)
 */
export async function generateSmartWorkout(
  fitnessGoal: string,
  equipment: string,
  targetDurationMin: number
): Promise<GeneratedWorkoutTemplate> {
  const systemPrompt = `You are a certified Strength and Conditioning Specialist (CSCS). 
  Generate a single custom workout session matching the user's criteria.
  Goal: ${fitnessGoal}
  Available Equipment: ${equipment}
  Target Duration: ${targetDurationMin} minutes.
  
  Return a structured JSON object detailing:
  1. A punchy name for the session.
  2. The primary muscle groups targeted.
  3. A list of 4-6 exercises, specifying appropriate sets and rep targets for each movement. Only use exercises that exist in standard training practices.`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt }
        ]
      }
    ],
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

  const responseData = await generateGeminiContent(payload);
  const textResponse = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error("No response content received from Gemini.");
  }

  const parsedTemplate: GeneratedWorkoutTemplate = JSON.parse(textResponse);
  return parsedTemplate;
}

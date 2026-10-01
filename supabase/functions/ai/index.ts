// ═══════════════════════════════════════════════════════
// Supabase Edge Function: ai
// Proxies Gemini requests so the API key never ships in the app.
//
// Deploy:
//   supabase secrets set GEMINI_API_KEY=your_key
//   supabase functions deploy ai
//
// JWT verification is on by default, so only signed-in users can call it.
// ═══════════════════════════════════════════════════════

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_BODY_BYTES = 32_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json({ error: 'GEMINI_API_KEY secret is not set' }, 500);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Request too large' }, 413);

  let payload: { contents?: unknown; generationConfig?: unknown; systemInstruction?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!Array.isArray(payload.contents)) return json({ error: 'contents is required' }, 400);

  // Forward only the fields the app uses
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: payload.contents,
        generationConfig: payload.generationConfig,
        systemInstruction: payload.systemInstruction,
      }),
    }
  );

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

const OPENAI_BASE = 'https://api.openai.com/v1';
const OPENAI_MODEL = 'gpt-4.1-mini';

function getApiKey() {
  return typeof import.meta !== 'undefined'
    && import.meta.env
    && (import.meta.env.VITE_OPENAI_API_KEY || import.meta.env.VITE_API_KEY);
}

function formatApiError(statusCode, statusMsg, rawBody) {
  const msg = (statusMsg || rawBody || '').toLowerCase();
  if (msg.includes('insufficient') && msg.includes('balance')) {
    return 'Your OpenAI account has insufficient credits.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'The OpenAI API rate limit was hit. Please wait a bit and try again.';
  }
  return statusMsg || rawBody || `OpenAI API error: ${statusCode}`;
}

/**
 * Call OpenAI chat completions API.
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Promise<string>} Assistant reply text
 */
export async function chatCompletion(messages) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OpenAI API key not set. Add VITE_OPENAI_API_KEY to .env');

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 2048,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatApiError(res.status, null, err) || `OpenAI API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text || !text.trim()) throw new Error('Empty response from assistant');
  return text;
}

// The rest of this file mirrors the previous AI helpers but uses OpenAI chatCompletion above.

const STUDY_PLAN_SYSTEM = `You are an agentic study-planning assistant for MindStudy AI. You receive the user's full context and must produce a single JSON object that is entirely tailored to that person. No generic advice. Reference their specific situation (name, mood, mental health, schedule, classes, goals, deadlines/test date, confidence) throughout. Output only valid JSON — no markdown, no code fence, no explanation.

JSON shape (use exactly these keys):
{
  "summary": "1–2 sentences addressing the user by name, summarizing how this plan is tailored to them.",
  "technique": "Name of the study technique (e.g. Gentle Progressive Study Method, Pomodoro Technique, Spaced Repetition) — choose one that fits THIS user's mood and situation.",
  "techniqueDescription": "2–3 sentences: what the technique is and why it fits this specific user (reference their mood, mental health, or circumstances).",
  "considerations": ["3–6 short bullets for Important Considerations. Write these yourself from the user's context. Be specific to their input, not generic."],
  "medReminders": [{"time": "e.g. 8:00 AM", "note": "string"}],
  "deadlines": [{"label": "e.g. Essay due Fri or Test date", "suggested": "short tailored tip"}],
  "studyBlocks": [{"id": "block-0", "title": "Subject or goal from their list", "durationMinutes": number, "suggestedTime": "any specific time e.g. 10:30 AM or Morning", "note": "optional or null"}],
  "tips": [
    {"title": "Short title (2–4 words)", "description": "One sentence tailored to this user (e.g. if anxious: start small; if they have meds: schedule around medication)."},
    {"title": "...", "description": "..."},
    {"title": "...", "description": "..."},
    {"title": "...", "description": "..."}
  ],
  "weeklyTimeline": [{"day": "Monday", "time": "any time e.g. 8:30 AM or 2:15 PM", "activity": "Subject name (45 min)"}]
}

Rules:
- confidence (1–10) controls total load and intensity: low confidence + test soon = more total minutes per day (e.g. 2+ hours/day when confidence ≤3 and the test is within 2–3 days); high confidence + test far away = lighter daily load.
- WEEKLY plan type: weeklyTimeline spans one week (Mon–Sun), one or more entries per day.
- TEST-BASED plan type: weeklyTimeline uses "date" (YYYY-MM-DD) and covers every day from TODAY through TEST_DATE; total minutes per day should increase as the test approaches and confidence decreases.
- Be specific and personal. No filler.

CRITICAL: Output ONLY the raw JSON object. Do not include any text, markdown, or code fence before or after. Start your response with { and end with }.`;

function buildStudyPlanPrompt(context) {
  const planType = context.planType || 'weekly';
  const confidence = context.confidence != null ? Number(context.confidence) : 5;
  const isTestPlan = planType === 'test';
  const deadlinesLabel = isTestPlan ? 'Test date' : 'Deadlines';

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const parts = [
    'Use ONLY the following user context to create a personalized plan. Every part of your response must reflect this specific person.',
    '',
    `Plan type: ${isTestPlan ? 'Test-based study plan (from today until test date)' : 'Weekly plan (7 days)'}`,
    ...(isTestPlan ? [
      `TODAY (start): ${todayStr}. TEST_DATE_ISO (end, inclusive): ${context.testDateISO || (context.deadlines || '').trim() || 'Not given'}.`,
      'Your weeklyTimeline must list every day from TODAY through TEST_DATE_ISO. For test plans, use "date" (YYYY-MM-DD), "time", and "activity".',
    ] : []),
    `Confidence (1–10, affects study intensity and session length): ${confidence}`,
    `Name: ${(context.name || '').trim() || 'Not given'}`,
    `Mood: ${context.mood || 'Okay'}`,
    `Circumstances: ${(context.circumstances || '').trim() || 'None'}`,
    `Health/sickness: ${(context.sickness || '').trim() || 'None'}`,
    `Mental health: ${(context.mentalHealth || '').trim() || 'None'}`,
    `Week plans/commitments: ${(context.weekPlans || '').trim() || 'None'}`,
    `Classes/subjects: ${(context.classes || '').trim() || 'None'}`,
    `Goals: ${(context.goals || '').trim() || 'None'}`,
    `${deadlinesLabel}: ${(context.deadlines || '').trim() || 'None'}`,
    `Anything else: ${(context.extra || '').trim() || 'None'}`,
  ];
  return parts.join('\n');
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  let str = text.trim();
  const codeFence = str.match(/^```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence) str = codeFence[1].trim();
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  let jsonStr = str.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    try {
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1').replace(/'/g, '"');
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  }
}

function ensurePlanShape(parsed) {
  const plan = {
    summary: '',
    technique: '',
    techniqueDescription: '',
    considerations: [],
    medReminders: [],
    deadlines: [],
    studyBlocks: [],
    tips: [],
    weeklyTimeline: [],
  };
  if (!parsed || typeof parsed !== 'object') return plan;
  if (typeof parsed.summary === 'string') plan.summary = parsed.summary;
  if (typeof parsed.technique === 'string') plan.technique = parsed.technique;
  if (typeof parsed.techniqueDescription === 'string') plan.techniqueDescription = parsed.techniqueDescription;
  if (Array.isArray(parsed.considerations)) plan.considerations = parsed.considerations;
  if (Array.isArray(parsed.medReminders)) plan.medReminders = parsed.medReminders;
  if (Array.isArray(parsed.deadlines)) plan.deadlines = parsed.deadlines;
  if (Array.isArray(parsed.studyBlocks)) plan.studyBlocks = parsed.studyBlocks;
  if (Array.isArray(parsed.tips)) {
    plan.tips = parsed.tips.slice(0, 4).map((t) => {
      if (typeof t === 'object' && t !== null && (t.title || t.description)) {
        return { title: t.title || 'Tip', description: t.description || '' };
      }
      const s = typeof t === 'string' ? t : String(t);
      const dot = s.indexOf('.');
      if (dot > 0 && dot < 50) {
        return { title: s.slice(0, dot).trim(), description: s.slice(dot + 1).trim() };
      }
      return { title: s.slice(0, 30), description: s.slice(30) || '' };
    });
  }
  while (plan.tips.length < 4) {
    plan.tips.push({ title: 'Stay consistent', description: 'Take breaks and keep a steady pace.' });
  }
  if (Array.isArray(parsed.weeklyTimeline)) plan.weeklyTimeline = parsed.weeklyTimeline;
  return plan;
}

/**
 * Generate a study plan using OpenAI from user context.
 * @param {object} context
 * @returns {Promise<object>}
 */
export async function generateStudyPlanWithAI(context) {
  const userPrompt = buildStudyPlanPrompt(context);
  const reply = await chatCompletion([
    { role: 'system', content: STUDY_PLAN_SYSTEM },
    { role: 'user', content: userPrompt },
  ]);
  const parsed = extractJson(reply);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI did not return valid plan data. Please try again.');
  }
  const plan = ensurePlanShape(parsed);
  const hasContent =
    (plan.technique && plan.technique.trim()) ||
    (plan.considerations && plan.considerations.length > 0) ||
    (plan.weeklyTimeline && plan.weeklyTimeline.length > 0) ||
    (plan.studyBlocks && plan.studyBlocks.length > 0);
  if (!hasContent) {
    throw new Error('AI returned an empty plan. Please try again.');
  }
  return plan;
}

/**
 * Rerank public library items by semantic relevance to a query.
 * @param {string} query
 * @param {Array<{id: string|number, type: string, title: string, description: string}>} items
 * @returns {Promise<Array>} reordered items (most relevant first)
 */
export async function rerankPublicLibraryItems(query, items) {
  const q = (query || '').trim();
  if (!q || !Array.isArray(items) || items.length === 0) return items;

  const MAX_ITEMS = 50;
  const slice = items.slice(0, MAX_ITEMS);
  const instructions = [
    'You are reranking study resources from a public library.',
    'Each item has: id, type (flashcards, study_guide, practice_test), title, and description.',
    'Given the user query, return ONLY a JSON array of item ids ordered from most relevant to least relevant.',
    'Consider semantic similarity: related topics and synonyms should also be surfaced, not just exact keyword matches.',
  ].join(' ');

  const userContent = JSON.stringify({
    query: q,
    items: slice.map((i) => ({
      id: i.id,
      type: i.type,
      title: i.title,
      description: i.description,
    })),
  });

  const reply = await chatCompletion([
    { role: 'system', content: instructions },
    { role: 'user', content: userContent },
  ]);

  let orderedIds = [];
  try {
    const parsed = JSON.parse(reply);
    if (Array.isArray(parsed)) {
      orderedIds = parsed;
    }
  } catch {
    // Fallback: leave as-is on parse failure
    return items;
  }

  const idSet = new Set(slice.map((i) => i.id));
  const byId = new Map(slice.map((i) => [i.id, i]));
  const result = [];

  for (const id of orderedIds) {
    if (idSet.has(id)) {
      result.push(byId.get(id));
      idSet.delete(id);
    }
  }

  // Append any remaining items that the model didn't mention
  for (const it of slice) {
    if (idSet.has(it.id)) {
      result.push(it);
      idSet.delete(it.id);
    }
  }

  return result;
}


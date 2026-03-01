const MINIMAX_BASE = 'https://api.minimax.io/v1';
const MODEL = 'M2-her';

function getApiKey() {
  return typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_MINIMAX_API_KEY;
}

function formatApiError(statusCode, statusMsg, rawBody) {
  const msg = (statusMsg || rawBody || '').toLowerCase();
  if (msg.includes('insufficient') && msg.includes('balance')) {
    return 'Your MiniMax account has insufficient balance. Add credits at platform.minimax.io (Billing / Recharge).';
  }
  if (msg.includes('token') && (msg.includes('exceed') || msg.includes('too many') || msg.includes('limit'))) {
    return 'Request used too many tokens. Try shortening your answers in the form, or we can use a smaller plan.';
  }
  return statusMsg || rawBody || `API error: ${statusCode}`;
}

/**
 * Call MiniMax chat completion API.
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Promise<string>} Assistant reply text
 */
export async function chatCompletion(messages) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('MiniMax API key not set. Add VITE_MINIMAX_API_KEY to .env');

  const res = await fetch(`${MINIMAX_BASE}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      top_p: 0.95,
      max_completion_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(formatApiError(res.status, null, err) || `MiniMax API error: ${res.status}`);
  }

  const data = await res.json();
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(formatApiError(data.base_resp.status_code, data.base_resp.status_msg));
  }
  const content = data.choices?.[0]?.message?.content ?? data.reply ?? data.base_resp?.content ?? '';
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  if (!text || !text.trim()) throw new Error('Empty response from AI');
  return text;
}

const STUDY_PLAN_SYSTEM = `You are an agentic study-planning assistant for MindStudy AI. You receive the user's full context and must produce a single JSON object that is entirely tailored to that person. No generic advice. Reference their specific situation (name, mood, mental health, schedule, classes, goals, deadlines) throughout. Output only valid JSON — no markdown, no code fence, no explanation.

JSON shape (use exactly these keys):
{
  "summary": "1–2 sentences addressing the user by name, summarizing how this plan is tailored to them.",
  "technique": "Name of the study technique (e.g. Gentle Progressive Study Method, Pomodoro Technique, Spaced Repetition) — choose one that fits THIS user's mood and situation.",
  "techniqueDescription": "2–3 sentences: what the technique is and why it fits this specific user (reference their mood, mental health, or circumstances).",
  "considerations": ["3–6 short bullets for Important Considerations. Write these yourself from the user's context. Examples: 'Current situation: working part time on Tuesdays', 'Mental health: [what they shared]', 'This week's commitments: [from their week plans]'. Be specific to their input, not generic."],
  "medReminders": [{"time": "e.g. 8:00 AM", "note": "string"}],
  "deadlines": [{"label": "e.g. Essay due Fri", "suggested": "short tailored tip"}],
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
- considerations: YOU write 3–6 bullets from their context (situation, mental health, week commitments). Do not output generic lines; use their actual details.
- technique + techniqueDescription: Pick a technique that fits their mood and situation; explain why it fits THEM.
- tips: Exactly 4 items. Each has "title" and "description". Tailor each tip to their mood, mental health, or schedule (e.g. medication timing, stress, energy).
- weeklyTimeline: Use ANY times that work (e.g. 7:00 AM, 10:30 AM, 12:15 PM, 3:45 PM, 6:00 PM). Spread study across MULTIPLE days of the week — include sessions on several different days, and multiple sessions per day when it fits. 8–20+ entries is fine. Each entry: day (Monday–Sunday), time (any specific time), activity with duration in parentheses. Work around their week commitments; do not limit yourself to a few fixed times.
- studyBlocks: Match their classes/goals; id block-0, block-1, ...; durationMinutes 20–50; suggestedTime can be any specific time (e.g. 9:15 AM) or time-of-day label.
- medReminders: Only if they mentioned medication times in mental health; else [].
- deadlines: From their deadlines list; add a short suggested tip per item.
- Be specific and personal. No filler.

CRITICAL: Output ONLY the raw JSON object. Do not include any text, markdown, or code fence before or after. Start your response with { and end with }.`;

function buildStudyPlanPrompt(context) {
  const parts = [
    'Use ONLY the following user context to create a personalized plan. Every part of your response must reflect this specific person.',
    '',
    `Name: ${(context.name || '').trim() || 'Not given'}`,
    `Mood: ${context.mood || 'Okay'}`,
    `Circumstances (sleep, stress, energy, etc.): ${(context.circumstances || '').trim() || 'None'}`,
    `Health/sickness: ${(context.sickness || '').trim() || 'None'}`,
    `Mental health (anything to consider, e.g. ADHD, medication, anxiety): ${(context.mentalHealth || '').trim() || 'None'}`,
    `Week plans/commitments: ${(context.weekPlans || '').trim() || 'None'}`,
    `Classes/subjects: ${(context.classes || '').trim() || 'None'}`,
    `Goals: ${(context.goals || '').trim() || 'None'}`,
    `Deadlines: ${(context.deadlines || '').trim() || 'None'}`,
    `Anything else: ${(context.extra || '').trim() || 'None'}`,
  ];
  return parts.join('\n');
}

function extractJson(text) {
  if (!text || typeof text !== 'string') return null;
  let str = text.trim();
  // Strip markdown code fence if present
  const codeFence = str.match(/^```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence) str = codeFence[1].trim();
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  let jsonStr = str.slice(start, end + 1);
  // Fix common LLM JSON issues: trailing commas, single quotes
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
 * Generate a study plan using MiniMax AI from user context.
 * @param {object} context - Same shape as OnboardingWizard submit
 * @returns {Promise<object>} Plan with summary, considerations, medReminders, deadlines, studyBlocks, tips
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

/** Extract JSON array or object from model reply. */
function extractJsonOrArray(text) {
  if (!text || typeof text !== 'string') return null;
  let str = text.trim();
  const codeFence = str.match(/^```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence) str = codeFence[1].trim();
  const startObj = str.indexOf('{');
  const startArr = str.indexOf('[');
  const endObj = str.lastIndexOf('}');
  const endArr = str.lastIndexOf(']');
  let start = -1, end = -1;
  if (startArr >= 0 && endArr >= 0 && (startObj < 0 || startArr < startObj)) {
    start = startArr; end = endArr;
  } else if (startObj >= 0 && endObj >= 0) {
    start = startObj; end = endObj;
  }
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

const FLASHCARDS_SYSTEM = `You are a study assistant. The user will paste notes or text and request a specific number of flashcards. Your job is to produce a JSON array of flashcards. Each card must have "front" and "back" (strings). Create the requested number of cards that capture key facts, definitions, and concepts. Output ONLY the JSON array, no markdown or explanation. Example: [{"front":"What is X?","back":"X is..."}]`;

/**
 * Generate flashcards from user text using MiniMax.
 * @param {string} userText - Notes or content to turn into flashcards
 * @param {number} [count=10] - Desired number of flashcards (1–50)
 * @returns {Promise<Array<{ front: string, back: string }>>}
 */
export async function generateFlashcards(userText, count = 10) {
  const trimmed = (userText || '').trim();
  if (!trimmed) throw new Error('Please paste or type some text first.');
  const num = Math.min(50, Math.max(1, parseInt(count, 10) || 10));
  const reply = await chatCompletion([
    { role: 'system', content: FLASHCARDS_SYSTEM },
    { role: 'user', content: `Turn this into exactly ${num} flashcards (JSON array of { "front", "back" }). Create ${num} cards:\n\n${trimmed.slice(0, 6000)}` },
  ]);
  const parsed = extractJsonOrArray(reply);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Could not generate flashcards. Try again with different text.');
  }
  return parsed
    .filter((c) => c && (c.front != null || c.back != null))
    .map((c) => ({ front: String(c.front ?? ''), back: String(c.back ?? '') }));
}

const STUDY_GUIDE_SYSTEM = `You are a study assistant. The user will paste notes or text and choose either a quick review (shorter) or long prep (longer) study guide. Output a JSON object with one key "sections" (array). Each section has "title" (string) and "content" (string). Output ONLY the JSON object, no markdown or explanation. Example: {"sections":[{"title":"Introduction","content":"..."}]}`;

/**
 * Generate a study guide from user text using MiniMax.
 * @param {string} userText - Notes or content to turn into a study guide
 * @param {'quick'|'long'} [mode='quick'] - 'quick' = shorter (2–4 sections), 'long' = longer (6–12 sections)
 * @returns {Promise<{ sections: Array<{ title: string, content: string }> }>}
 */
export async function generateStudyGuide(userText, mode = 'quick') {
  const trimmed = (userText || '').trim();
  if (!trimmed) throw new Error('Please paste or type some text first.');
  const isLong = mode === 'long';
  const lengthInstruction = isLong
    ? 'Create a COMPREHENSIVE study guide for long prep: 6–12 sections, detailed content in each section, thorough coverage.'
    : 'Create a SHORT study guide for quick review: 2–4 sections only, concise bullet points or short paragraphs.';
  const reply = await chatCompletion([
    { role: 'system', content: STUDY_GUIDE_SYSTEM },
    { role: 'user', content: `${lengthInstruction}\n\nTurn this into a structured study guide (JSON with "sections" array of { "title", "content" }):\n\n${trimmed.slice(0, 6000)}` },
  ]);
  const parsed = extractJson(reply);
  if (!parsed || !Array.isArray(parsed.sections)) {
    throw new Error('Could not generate study guide. Try again with different text.');
  }
  const sections = parsed.sections
    .filter((s) => s && (s.title != null || s.content != null))
    .map((s) => ({ title: String(s.title ?? ''), content: String(s.content ?? '') }));
  return { sections };
}

const PRACTICE_TEST_SYSTEM = `You are a study assistant. The user will paste notes or text and request a number of multiple-choice practice questions. Your job is to produce a JSON array of questions. Each question must have: "question" (string, the question text), "options" (array of exactly 4 strings, the answer choices A–D), and "correctIndex" (number 0–3, the index of the correct answer in "options"). Create clear, fair questions that test key concepts from the material. Output ONLY the JSON array, no markdown or explanation. Example: [{"question":"What is X?","options":["A","B","C","D"],"correctIndex":1}]`;

/**
 * Generate multiple-choice practice test questions from user text using MiniMax.
 * @param {string} userText - Notes or content to turn into questions
 * @param {number} [count=10] - Desired number of questions (1–30)
 * @returns {Promise<Array<{ question: string, options: string[], correctIndex: number }>>}
 */
export async function generatePracticeTest(userText, count = 10) {
  const trimmed = (userText || '').trim();
  if (!trimmed) throw new Error('Please paste or type some text first.');
  const num = Math.min(30, Math.max(1, parseInt(count, 10) || 10));
  const reply = await chatCompletion([
    { role: 'system', content: PRACTICE_TEST_SYSTEM },
    { role: 'user', content: `Turn this into exactly ${num} multiple-choice questions (JSON array). Each item: "question", "options" (array of 4 strings), "correctIndex" (0–3). Create ${num} questions:\n\n${trimmed.slice(0, 6000)}` },
  ]);
  const parsed = extractJsonOrArray(reply);
  const arr = Array.isArray(parsed) ? parsed : (parsed && parsed.questions) ? parsed.questions : null;
  if (!arr || !arr.length) {
    throw new Error('Could not generate practice test. Try again with different text.');
  }
  return arr
    .filter((q) => q && q.question != null && Array.isArray(q.options) && q.options.length >= 2 && typeof q.correctIndex === 'number')
    .slice(0, num)
    .map((q) => ({
      question: String(q.question ?? ''),
      options: q.options.slice(0, 4).map((o) => String(o ?? '')),
      correctIndex: Math.min(3, Math.max(0, parseInt(q.correctIndex, 10) || 0)),
    }));
}

const LECTURE_SUMMARY_SYSTEM = `You are a study assistant. The user will provide a transcript or description of a lecture. Your job is to produce a JSON object with two keys: "summary" (a short paragraph summarizing the main points, 2-4 sentences) and "notes" (an array of 5-12 bullet-point study notes as strings, each one clear and actionable). Output ONLY the raw JSON object, no markdown or explanation. Example: {"summary":"This lecture covered...","notes":["Key point one","Key point two"]}`;

/**
 * Generate summary and study notes from lecture transcript using MiniMax.
 * @param {string} transcript - Transcript or description of the lecture
 * @returns {Promise<{ summary: string, notes: string[] }>}
 */
export async function generateLectureSummary(transcript) {
  const trimmed = (transcript || '').trim();
  if (!trimmed) throw new Error('Please paste or type what was said (or describe the lecture) first.');
  const reply = await chatCompletion([
    { role: 'system', content: LECTURE_SUMMARY_SYSTEM },
    { role: 'user', content: `Create a summary and study notes from this lecture content:\n\n${trimmed.slice(0, 8000)}` },
  ]);
  const parsed = extractJson(reply);
  if (!parsed || typeof parsed.summary !== 'string') {
    throw new Error('Could not generate summary. Try again with different text.');
  }
  const notes = Array.isArray(parsed.notes) ? parsed.notes.map((n) => String(n ?? '')).filter(Boolean) : [];
  return { summary: parsed.summary.trim(), notes };
}

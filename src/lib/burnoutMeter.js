/**
 * Compute a burnout risk meter (0–100) and explanation from onboarding context.
 * Used for both new and saved plans so every plan can show "why" the meter is what it is.
 *
 * @param {object} context - User input from onboarding (mood, confidence, mentalHealth, etc.)
 * @param {object} [plan] - Optional plan object for fallback when context is missing (e.g. very old plans)
 * @returns {{ score: number, label: string, explanation: string }}
 */
export function computeBurnoutFromContext(context, plan = null) {
  if (!context || typeof context !== 'object') {
    return computeBurnoutFromPlanOnly(plan);
  }

  let score = 0;
  const reasons = [];

  // Mood (strong signal)
  const mood = (context.mood || '').trim().toLowerCase();
  const moodScores = {
    great: 0,
    good: 5,
    okay: 18,
    low: 38,
    anxious: 48,
    overwhelmed: 58,
    sick: 50,
  };
  const moodScore = moodScores[mood] ?? 15;
  score += moodScore;
  if (mood && ['low', 'anxious', 'overwhelmed', 'sick'].includes(mood)) {
    reasons.push(`your mood was "${context.mood}"`);
  }

  // Confidence 1–10: low = higher burnout risk
  const conf = parseInt(context.confidence, 10);
  if (Number.isFinite(conf)) {
    if (conf <= 2) {
      score += 28;
      reasons.push('low confidence (1–2)');
    } else if (conf <= 4) {
      score += 18;
      reasons.push('moderate confidence (3–4)');
    } else if (conf <= 6) {
      score += 8;
    }
    // 7–10 adds nothing
  }

  // Mental health free text
  const mh = (context.mentalHealth || '').trim().toLowerCase();
  if (mh.length > 2) {
    const stressWords = ['stress', 'anxious', 'anxiety', 'overwhelm', 'burnout', 'adhd', 'depress', 'tired', 'exhaust', 'panic', 'worry'];
    const hasStress = stressWords.some((w) => mh.includes(w));
    if (hasStress) {
      score += 22;
      reasons.push('you mentioned mental health or stress');
    }
  }

  // Circumstances (busy, sleep, energy)
  const circ = (context.circumstances || '').trim().toLowerCase();
  if (circ.length > 2) {
    const loadWords = ['busy', 'tired', 'sleep', 'energy', 'overwhelm', 'stress', 'too much', 'hectic', 'no time'];
    const hasLoad = loadWords.some((w) => circ.includes(w));
    if (hasLoad) {
      score += 15;
      reasons.push('your circumstances mentioned focus or energy limits');
    }
  }

  // Test-based plan with a deadline = more pressure
  if (context.planType === 'test' && (context.deadlines || context.testDateISO)) {
    score += 12;
    reasons.push('you have a test deadline');
  } else if ((context.deadlines || '').trim().length > 0) {
    score += 6;
    reasons.push('you have deadlines');
  }

  // Sickness flag
  if (context.sickness) {
    score += 10;
    reasons.push('you indicated you\'re not feeling well');
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  let label;
  if (score <= 25) label = 'Low';
  else if (score <= 50) label = 'Moderate';
  else if (score <= 75) label = 'High';
  else label = 'Very high';

  let explanation;
  if (reasons.length === 0) {
    explanation = 'Based on your answers (mood, confidence, and circumstances), your burnout risk is low. The plan is designed to be sustainable.';
  } else {
    explanation = `This level is based on what you told us: ${reasons.join('; ')}. We've tailored the plan to keep workload manageable and to respect your energy.`;
  }

  return { score, label, explanation };
}

/**
 * Fallback when no context exists (e.g. very old saved plans). Derive a rough signal from plan content.
 */
function computeBurnoutFromPlanOnly(plan) {
  if (!plan || typeof plan !== 'object') {
    return {
      score: 0,
      label: 'Unknown',
      explanation: 'Burnout risk wasn’t calculated for this plan because we don’t have the original answers. Create a new plan to get a personalized burnout meter.',
    };
  }

  let score = 25; // default moderate-low
  const reasons = [];

  const considerations = (plan.considerations || []).join(' ').toLowerCase();
  const summary = (plan.summary || '').toLowerCase();
  const text = `${considerations} ${summary}`;
  if (/\b(stress|anxious|overwhelm|rest|break|energy|tired|burnout)\b/.test(text)) {
    score += 20;
    reasons.push('the plan notes mention stress or energy');
  }
  const deadlines = plan.deadlines || [];
  if (Array.isArray(deadlines) && deadlines.length > 0) {
    score += 15;
    reasons.push('the plan includes deadlines');
  }
  if (plan.planType === 'test') {
    score += 10;
    reasons.push('this is a test-based plan');
  }

  score = Math.min(100, Math.max(0, Math.round(score)));

  let label;
  if (score <= 25) label = 'Low';
  else if (score <= 50) label = 'Moderate';
  else if (score <= 75) label = 'High';
  else label = 'Very high';

  const explanation = reasons.length > 0
    ? `We don’t have your original answers, so this is an estimate from the plan itself: ${reasons.join('; ')}.`
    : 'We don’t have your original answers for this plan, so the meter is a rough estimate. Create a new plan to get a meter based on your current mood and situation.';

  return { score, label, explanation };
}

/**
 * Attach burnout to a plan object (mutates plan). Use when we have context at save or load.
 * Idempotent: if plan already has burnoutMeter, only overwrite when context is provided and plan doesn’t.
 *
 * @param {object} plan - Plan object (may be mutated)
 * @param {object|null} context - Onboarding context
 * @returns {object} The same plan reference with burnoutMeter and burnoutExplanation set
 */
export function enrichPlanWithBurnout(plan, context) {
  if (!plan || typeof plan !== 'object') return plan;
  const hasExisting = plan.burnoutMeter != null && plan.burnoutExplanation != null;
  if (hasExisting && !context) return plan;

  const { score, label, explanation } = computeBurnoutFromContext(context || null, plan);
  plan.burnoutMeter = { score, label };
  plan.burnoutExplanation = explanation;
  return plan;
}

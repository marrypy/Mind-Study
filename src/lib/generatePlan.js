/**
 * Generates a tailored study plan from user context.
 * Replace this with an AI/API call when you have a backend.
 */
export function generatePlan(context) {
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

  const name = (context.name || '').trim();
  const mood = context.mood || 'Okay';
  const mentalHealth = (context.mentalHealth || '').trim();
  const classes = parseList(context.classes);
  const goals = parseList(context.goals);
  const deadlineText = (context.deadlines || '').trim();
  const weekPlans = (context.weekPlans || '').trim();
  const circumstances = (context.circumstances || '').trim();
  const sickness = (context.sickness || '').trim();
  const extra = (context.extra || '').trim();

  // Summary
  plan.summary = buildSummary(name, mood, circumstances, sickness, weekPlans, classes, goals);

  // Considerations from mood & circumstances
  if (mood === 'Low' || mood === 'Anxious' || mood === 'Overwhelmed') {
    plan.considerations.push(`You're ${mood.toLowerCase()} right now — the plan keeps sessions shorter and includes buffer time.`);
  }
  if (sickness) {
    plan.considerations.push(`Health: ${sickness}. Lighter load and more breaks suggested.`);
  }
  if (circumstances) {
    plan.considerations.push(`Context: ${circumstances.slice(0, 120)}${circumstances.length > 120 ? '…' : ''}`);
  }
  if (weekPlans) {
    plan.considerations.push(`Week commitments noted and avoided in scheduling.`);
  }
  if (extra) {
    plan.considerations.push(`You noted: ${extra.slice(0, 150)}${extra.length > 150 ? '…' : ''}`);
  }
  if (mentalHealth) {
    plan.considerations.push(`Mental health: ${mentalHealth.slice(0, 200)}${mentalHealth.length > 200 ? '…' : ''}`);
  }

  // Deadlines (parsed loosely)
  if (deadlineText) {
    const lines = deadlineText.split(/\n/).filter(Boolean);
    plan.deadlines = lines.map((line) => ({
      label: line.trim(),
      suggested: suggestDeadlineTiming(line, mood),
    }));
  }

  // Study technique (title + description)
  const techniqueName = pickTechnique(mood);
  plan.technique = techniqueName.name;
  plan.techniqueDescription = techniqueName.description;

  // Study blocks: one block per class/goal, with suggested duration based on mood
  const sessionMinutes = mood === 'Great' || mood === 'Good' ? 45 : mood === 'Okay' ? 35 : 25;
  const items = classes.length ? classes : goals.length ? goals : ['General study'];
  plan.studyBlocks = items.slice(0, 7).map((item, i) => ({
    id: `block-${i}`,
    title: item,
    durationMinutes: sessionMinutes,
    suggestedTime: suggestTimeOfDay(mood, i),
    note: getBlockNote(mood, item),
  }));

  // Exactly 4 tips for the tip cards
  plan.tips = getTips(mood, mentalHealth, circumstances, sickness).slice(0, 4);
  while (plan.tips.length < 4) {
    plan.tips.push(['Take short breaks.', 'Review notes at the end of each session.', 'Stay hydrated.', 'Find a quiet spot.'][plan.tips.length]);
  }

  // Weekly time-based timeline from study blocks
  plan.weeklyTimeline = buildWeeklyTimeline(plan.studyBlocks);

  return plan;
}

function pickTechnique(mood) {
  const techniques = [
    { name: 'Pomodoro Technique', description: 'Work in 25-minute focused blocks with 5-minute breaks. After four blocks, take a longer 15–20 minute break. Helps maintain focus and avoid burnout.' },
    { name: 'Spaced Repetition', description: 'Review material at increasing intervals (e.g. day 1, then 3 days, then a week). Strengthens long-term retention with less cramming.' },
    { name: 'Time Blocking', description: 'Assign fixed time slots to subjects or tasks each day. Reduces decision fatigue and keeps your week predictable.' },
    { name: 'Chunking', description: 'Break material into small chunks and master one at a time. Builds confidence and makes large goals feel manageable.' },
  ];
  const i = mood === 'Overwhelmed' ? 3 : mood === 'Low' || mood === 'Anxious' ? 0 : mood === 'Okay' ? 1 : 2;
  return techniques[i];
}

function buildWeeklyTimeline(studyBlocks) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // Many possible times across the day so fallback isn't limited to a few slots
  const times = [
    '7:00 AM', '8:00 AM', '8:30 AM', '9:15 AM', '10:00 AM', '10:45 AM', '11:30 AM',
    '12:00 PM', '1:00 PM', '2:15 PM', '3:00 PM', '3:45 PM', '4:30 PM', '5:00 PM',
    '6:00 PM', '6:30 PM', '7:15 PM', '8:00 PM',
  ];
  const timeline = [];
  studyBlocks.slice(0, 14).forEach((block, i) => {
    const day = days[i % days.length];
    const time = times[i % times.length];
    timeline.push({
      day,
      time,
      activity: `${block.title} (${block.durationMinutes} min)`,
    });
  });
  return timeline;
}

function parseList(text) {
  if (!text?.trim()) return [];
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildSummary(name, mood, circumstances, sickness, weekPlans, classes, goals) {
  const parts = [];
  if (name) parts.push(`${name}, `);
  parts.push(`based on your current mood (${mood})`);
  if (circumstances) parts.push('and your circumstances');
  if (sickness) parts.push('and health');
  parts.push(classes.length ? `we have planned focus for: ${classes.join(', ')}.` : 'we have set up a flexible study plan.');
  if (goals.length) parts.push(`Goals: ${goals.join('; ')}.`);
  return parts.join(' ');
}

function suggestDeadlineTiming(line, mood) {
  const lower = line.toLowerCase();
  let tip = 'Spread work before the due date.';
  if (mood === 'Overwhelmed' || mood === 'Low') tip = 'Start early; do a little each day.';
  if (lower.includes('essay') || lower.includes('paper')) tip = 'Draft early in the week, revise closer to due date.';
  if (lower.includes('quiz') || lower.includes('exam')) tip = 'Review in short sessions; last session day before.';
  return tip;
}

function suggestTimeOfDay(mood, index) {
  const options = [
    '7:00 AM', '8:30 AM', '9:15 AM', '10:00 AM', '11:00 AM', '12:30 PM',
    '2:00 PM', '3:30 PM', '4:45 PM', '6:00 PM', '7:30 PM',
  ];
  return options[index % options.length];
}

function getBlockNote(mood, title) {
  if (mood === 'Low' || mood === 'Anxious') return 'Short session — take breaks.';
  if (mood === 'Overwhelmed') return 'One topic at a time.';
  return null;
}

function getTips(mood, mentalHealth, circumstances, sickness) {
  const tips = [];
  tips.push('Take a 5–10 min break between blocks.');
  if (mood !== 'Great' && mood !== 'Good') {
    tips.push('Prioritize the most important 1–2 items if energy is limited.');
  }
  if (mentalHealth && /medication|meds|adhd|focus/i.test(mentalHealth)) {
    tips.push('Schedule focus blocks when your medication is active.');
  }
  if (sickness) {
    tips.push('Listen to your body; shorten sessions if needed.');
  }
  if (circumstances?.toLowerCase().includes('sleep')) {
    tips.push('A short walk or nap can help before a study block.');
  }
  return tips;
}

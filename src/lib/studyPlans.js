import { supabase } from './supabase.js';

const TABLE = 'study_plans';

/** Strip to JSON-serializable shape for Supabase jsonb (no undefined, no circular refs). */
function toJsonSafe(obj) {
  if (obj == null) return null;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return null;
  }
}

/**
 * Save a study plan for the current user. Requires auth.
 * @param {object} plan - Plan object (summary, considerations, etc.)
 * @param {object} context - Optional onboarding context
 */
export async function saveStudyPlan(plan, context = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to save a plan.');
  }

  const planJson = toJsonSafe(plan);
  if (!planJson || typeof planJson !== 'object') {
    throw new Error('Invalid plan data to save.');
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: user.id,
      plan: planJson,
      context: toJsonSafe(context),
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('[studyPlans] save error:', error);
    throw error;
  }
  return data;
}

/**
 * Get the most recent study plan for the current user.
 * @returns {object|null} { plan, context, created_at } or null
 */
export async function getLatestStudyPlan() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select('plan, context, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get all study plans for the current user, newest first.
 * @returns {Promise<Array<{ id: string, plan: object, context: object|null, created_at: string }>>}
 */
export async function getAllStudyPlans() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, plan, context, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Delete a study plan by id. Only deletes if it belongs to the current user.
 * @param {string} id - Row id from study_plans
 */
export async function deleteStudyPlan(id) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to delete a plan.');
  }

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
}

/**
 * Get "Week of Monday, Mon DD, YYYY" for a given date (e.g. plan created_at).
 * @param {string|Date} date
 * @returns {string}
 */
export function getWeekOfMondayLabel(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNum = monday.getDate();
  const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? 'st' : dayNum === 2 || dayNum === 22 ? 'nd' : dayNum === 3 || dayNum === 23 ? 'rd' : 'th';
  return `Week of Monday, ${months[monday.getMonth()]} ${dayNum}${suffix}, ${monday.getFullYear()}`;
}

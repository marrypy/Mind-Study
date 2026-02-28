const KEY = 'mindstudy_recent';
const MAX = 10;

function storageKey(userId) {
  return userId ? `${KEY}_${userId}` : `${KEY}_guest`;
}

/**
 * @param {string} userId
 * @param {'folder'|'plan'} type
 * @param {string} id
 * @param {string} label
 * @param {object} [plan] - For type 'plan', the plan object so we can reopen without fetching
 */
export function addRecentlyOpened(userId, type, id, label, plan = null) {
  try {
    const key = storageKey(userId);
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    const entry = { type, id, label, plan };
    const filtered = list.filter((e) => !(e.type === type && e.id === id));
    const next = [entry, ...filtered].slice(0, MAX);
    localStorage.setItem(key, JSON.stringify(next));
  } catch (e) {
    console.error('Failed to save recent:', e);
  }
}

/**
 * @param {string} userId
 * @returns {Array<{ type: string, id: string, label: string, plan?: object }>}
 */
export function getRecentlyOpened(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

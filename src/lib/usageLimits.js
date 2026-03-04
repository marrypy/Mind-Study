const USAGE_PREFIX = 'mindstudy_usage_v1';

function getWeekKey(d = new Date()) {
  // ISO week: year-Www
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function storageKey(userId) {
  const id = userId || 'guest';
  return `${USAGE_PREFIX}_${id}`;
}

function loadUsage(userId) {
  const week = getWeekKey();
  if (typeof localStorage === 'undefined') {
    return { week, chatCount: 0, itemCount: 0 };
  }
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { week, chatCount: 0, itemCount: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.week !== week) {
      return { week, chatCount: 0, itemCount: 0 };
    }
    return {
      week,
      chatCount: Number(parsed.chatCount) || 0,
      itemCount: Number(parsed.itemCount) || 0,
    };
  } catch {
    return { week, chatCount: 0, itemCount: 0 };
  }
}

function saveUsage(userId, usage) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(usage));
  } catch {
    // ignore
  }
}

export const FREE_CHAT_LIMIT_PER_WEEK = 5;
export const FREE_ITEM_LIMIT_PER_WEEK = 5;

export function getCurrentUsage(userId) {
  return loadUsage(userId);
}

export function canUseChat(userId, tier) {
  if (tier === 'pro') return { allowed: true, remaining: null };
  const usage = loadUsage(userId);
  const remaining = FREE_CHAT_LIMIT_PER_WEEK - usage.chatCount;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
}

export function recordChatUsage(userId) {
  const usage = loadUsage(userId);
  usage.chatCount += 1;
  saveUsage(userId, usage);
}

export function canCreateStudyItems(userId, tier, count = 1) {
  if (tier === 'pro') return { allowed: true, remaining: null };
  const usage = loadUsage(userId);
  const remaining = FREE_ITEM_LIMIT_PER_WEEK - usage.itemCount;
  return { allowed: remaining >= count, remaining: Math.max(0, remaining) };
}

export function recordStudyItems(userId, count = 1) {
  const usage = loadUsage(userId);
  usage.itemCount += count;
  saveUsage(userId, usage);
}


const RECORDINGS_KEY_PREFIX = 'mindstudy_recordings';
const MAX_RECORDINGS = 10;

function storageKey(userId) {
  return userId ? `${RECORDINGS_KEY_PREFIX}_${userId}` : `${RECORDINGS_KEY_PREFIX}_guest`;
}

export function loadRecordings(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function saveRecordings(userId, recordings) {
  try {
    const toSave = recordings.slice(-MAX_RECORDINGS);
    localStorage.setItem(storageKey(userId), JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save recordings', e);
  }
}

export function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

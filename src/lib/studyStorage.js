const STORAGE_PREFIX = 'mindstudy_study';

function storageKey(userId) {
  return userId ? `${STORAGE_PREFIX}_${userId}` : `${STORAGE_PREFIX}_guest`;
}

export function loadStudyData(userId) {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { folders: [], itemsByFolder: {} };
    const data = JSON.parse(raw);
    return {
      folders: Array.isArray(data.folders) ? data.folders : [],
      itemsByFolder: data.itemsByFolder && typeof data.itemsByFolder === 'object' ? data.itemsByFolder : {},
    };
  } catch {
    return { folders: [], itemsByFolder: {} };
  }
}

export function saveStudyData(userId, data) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save study data:', e);
  }
}

export function id() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

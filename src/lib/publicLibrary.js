import { supabase } from './supabase.js';
import { rerankPublicLibraryItems } from './openai.js';

const TABLE = 'public_study_items';
const LIBRARY_TIMEOUT_MS = 8000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Search timed out. Try again.')), ms),
    ),
  ]);
}

function toJsonSafe(obj) {
  if (obj == null) return null;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return null;
  }
}

export async function getPublicLibraryItems(query = '') {
  let request = supabase
    .from(TABLE)
    .select('id, user_id, type, title, description, data, created_at')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50);

  const trimmed = (query || '').trim();
  const run = async () => {
    const { data, error } = await request;
    if (error) throw error;
    const rows = data || [];
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    let usernameByUserId = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, username')
        .in('user_id', userIds);
      if (profiles) {
        profiles.forEach((p) => {
          usernameByUserId[p.user_id] = p.username || null;
        });
      }
    }
    let items = rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title || 'Untitled',
      description: row.description || '',
      data: row.data || {},
      creatorUsername: usernameByUserId[row.user_id] ?? null,
    }));

    if (trimmed) {
      try {
        items = await rerankPublicLibraryItems(trimmed, items);
      } catch {
        // On failure, just return the default ordering
      }
    }

    return items;
  };

  return withTimeout(run(), LIBRARY_TIMEOUT_MS);
}

export async function getPublicLibraryItem(id) {
  if (!id) throw new Error('Item ID is required.');
  const run = async () => {
    const { data: row, error } = await supabase
      .from(TABLE)
      .select('id, user_id, type, title, description, data, created_at')
      .eq('id', id)
      .eq('is_public', true)
      .maybeSingle();
    if (error) throw error;
    if (!row) return null;
    let creatorUsername = null;
    if (row.user_id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('user_id', row.user_id)
        .maybeSingle();
      creatorUsername = profile?.username ?? null;
    }
    return {
      id: row.id,
      type: row.type,
      title: row.title || 'Untitled',
      description: row.description || '',
      data: row.data || {},
      creatorUsername,
    };
  };
  return withTimeout(run(), LIBRARY_TIMEOUT_MS);
}

export async function publishStudyItem(item, folderName) {
  if (!item || !item.type || !item.title) {
    throw new Error('Missing item information to publish.');
  }

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user || null;
  if (!user) {
    throw new Error('You must be logged in to publish to the public library.');
  }

  const payload = {
    user_id: user.id,
    type: item.type,
    title: item.title,
    description: folderName || null,
    data: toJsonSafe(item.data),
    is_public: true,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select('id, is_public')
    .single();

  if (error) {
    throw new Error(error.message || 'Could not publish to the public library.');
  }

  return data;
}

export async function setPublicItemVisibility(id, isPublic) {
  if (!id) return;
  const { error } = await supabase
    .from(TABLE)
    .update({ is_public: isPublic })
    .eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not update public visibility.');
  }
}

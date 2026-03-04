import { supabase } from './supabase.js';

const TABLE = 'user_profiles';
const PROFILE_TIMEOUT_MS = 6000;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms),
    ),
  ]);
}

export async function isUsernameAvailable(username) {
  const trimmed = (username || '').trim();
  if (!trimmed) return false;

  const promise = (async () => {
    const { data, error } = await supabase
      .from(TABLE)
      .select('user_id')
      .ilike('username', trimmed)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    return !data;
  })();

  return withTimeout(
    promise,
    PROFILE_TIMEOUT_MS,
    'Username check timed out. Check your connection and try again.',
  );
}

export async function saveUsernameForCurrentUser(username) {
  const trimmed = (username || '').trim();
  if (!trimmed) throw new Error('Username cannot be empty.');

  const promise = (async () => {
    const { data: auth } = await supabase.auth.getUser();
    const currentUser = auth?.user;
    if (!currentUser) throw new Error('Not signed in.');

    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: currentUser.id,
          username: trimmed,
        },
        { onConflict: 'user_id' },
      );

    if (error) throw error;
  })();

  return withTimeout(
    promise,
    PROFILE_TIMEOUT_MS,
    'Could not save username. Try again later.',
  );
}

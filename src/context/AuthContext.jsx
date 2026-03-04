import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { isUsernameAvailable, saveUsernameForCurrentUser } from '../lib/profiles.js';

const AuthContext = createContext(null);

function generateRandomUsername() {
  const adjectives = ['focused', 'calm', 'bright', 'curious', 'steady', 'brave', 'kind', 'patient'];
  const nouns = ['panda', 'owl', 'tiger', 'dolphin', 'eagle', 'phoenix', 'otter', 'lynx'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}_${noun}_${num}`;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      setLoading(false);

      if (!currentUser) return;
      (async () => {
        try {
          if (!currentUser.user_metadata?.username) {
            let randomUsername = generateRandomUsername();
            for (let i = 0; i < 5; i += 1) {
              const available = await isUsernameAvailable(randomUsername);
              if (available) break;
              randomUsername = generateRandomUsername();
            }
            const { data, error } = await supabase.auth.updateUser({
              data: { ...(currentUser.user_metadata || {}), username: randomUsername },
            });
            if (!error && data?.user) {
              setUser(data.user);
              await saveUsernameForCurrentUser(randomUsername);
            }
          } else {
            await saveUsernameForCurrentUser(currentUser.user_metadata.username);
          }
        } catch {
          // Best-effort; user is already set
        }
      })();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) return;
      (async () => {
        try {
          if (!nextUser.user_metadata?.username) {
            let randomUsername = generateRandomUsername();
            for (let i = 0; i < 5; i += 1) {
              const available = await isUsernameAvailable(randomUsername);
              if (available) break;
              randomUsername = generateRandomUsername();
            }
            const { data, error } = await supabase.auth.updateUser({
              data: { ...(nextUser.user_metadata || {}), username: randomUsername },
            });
            if (!error && data?.user) {
              setUser(data.user);
              await saveUsernameForCurrentUser(randomUsername);
            }
          } else {
            await saveUsernameForCurrentUser(nextUser.user_metadata.username);
          }
        } catch {
          // Best-effort
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email, password, username) {
    const cleanUsername = (username || '').trim();
    if (!cleanUsername) throw new Error('Username is required.');
    const available = await isUsernameAvailable(cleanUsername);
    if (!available) throw new Error('That username is already taken.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: cleanUsername },
      },
    });
    if (error) throw error;
    if (data?.user) {
      try {
        await saveUsernameForCurrentUser(cleanUsername);
      } catch {
        // auth user still has username in metadata
      }
    }
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function updateUsername(newUsername) {
    const trimmed = (newUsername || '').trim();
    if (!trimmed) throw new Error('Username cannot be empty.');
    const available = await isUsernameAvailable(trimmed);
    if (!available) throw new Error('That username is already taken.');
    const { data, error } = await supabase.auth.updateUser({
      data: { ...(user?.user_metadata || {}), username: trimmed },
    });
    if (error) throw error;
    if (data?.user) {
      setUser(data.user);
      await saveUsernameForCurrentUser(trimmed);
    }
  }

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    updatePassword,
    updateUsername,
    isLoggedIn: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

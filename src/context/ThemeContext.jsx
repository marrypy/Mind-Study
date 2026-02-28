import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem('mindstudy-dark');
      if (stored != null) return JSON.parse(stored);
      return true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    try {
      localStorage.setItem('mindstudy-dark', JSON.stringify(dark));
    } catch (_) {}
  }, [dark]);

  return (
    <ThemeContext.Provider value={{ dark, setDark, toggle: () => setDark((d) => !d) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

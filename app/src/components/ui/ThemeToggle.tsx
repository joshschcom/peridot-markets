'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const KEY = 'peridot:theme';

/** Runs before paint (inlined in layout) so the stored or OS theme applies without a flash. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => { setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'); }, []);
  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch { /* Preference is kept for this page view only. */ }
    setTheme(next);
  };
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} title={theme === 'light' ? 'Dark theme' : 'Light theme'}>
    {theme === 'light' ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
  </button>;
}

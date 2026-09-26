'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';

/** Script inline anti-flash : applique le thème avant le premier rendu. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('kairos-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

export function useApplyTheme() {
  const theme = useStore((s) => s.prefs.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem('kairos-theme', theme);
    } catch {
      /* stockage indisponible */
    }
  }, [theme]);
}

export function ThemeToggle() {
  const theme = useStore((s) => s.prefs.theme);
  const setPrefs = useStore((s) => s.setPrefs);
  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label = { system: 'Thème : système', light: 'Thème : clair', dark: 'Thème : sombre' }[theme];
  return (
    <button onClick={() => setPrefs({ theme: next })} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink" title={label} aria-label={label}>
      <Icon size={18} />
    </button>
  );
}

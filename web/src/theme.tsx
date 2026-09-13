import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

/** Accent choices. Each is dark enough to carry white text at any size. */
export const ACCENTS = [
  '#6C8EF5', // zila / blue
  '#7C5CE0', // violeta / purple
  '#E0568B', // rozā / pink
  '#E8623C', // oranža / orange
  '#2FAE7D', // zaļa / green
  '#0EA5B7', // tirkīza / teal
  '#D4A017', // zelta / gold
  '#5B6474', // pelēka / slate
] as const;

interface ThemeCtx {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  accent: string;
  setAccent: (hex: string) => void;
  /** The theme actually on screen once `system` is resolved. */
  resolved: 'light' | 'dark';
}

const Ctx = createContext<ThemeCtx | null>(null);
const MODE_KEY = 'punkti.theme';
const ACCENT_KEY = 'punkti.accent';

/** Darkens a hex colour by `amount` (0–1) for the gradient's second stop. */
function darken(hex: string, amount = 0.14): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 - amount));
  const g = clamp(((n >> 8) & 255) * (1 - amount));
  const b = clamp((n & 255) * (1 - amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Relative luminance, so we can put black text on a light accent (gold) and
 * white on a dark one. Without this a custom accent can become unreadable.
 */
function readableInk(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return l > 0.45 ? '#16202e' : '#ffffff';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem(MODE_KEY) as ThemeMode | null) ?? 'system',
  );
  const [accent, setAccentState] = useState<string>(
    () => localStorage.getItem(ACCENT_KEY) ?? ACCENTS[0],
  );
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-strong', darken(accent));
    root.style.setProperty('--accent-ink', readableInk(accent));
    // Keeps the Android status bar in step with the app.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#0F1420' : accent);
    localStorage.setItem(MODE_KEY, mode);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [resolved, accent, mode]);

  const value = useMemo<ThemeCtx>(
    () => ({ mode, setMode: setModeState, accent, setAccent: setAccentState, resolved }),
    [mode, accent, resolved],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

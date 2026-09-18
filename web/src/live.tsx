/**
 * Dzīvie dati / live data — how the app stays current without anyone reaching
 * for reload.
 *
 * Two pieces, both built on polling. A LAN server and a family-sized database
 * make a request every fifteen seconds cost approximately nothing, and polling
 * survives the sleeping phones, dropped Wi-Fi and closed laptop lids that make
 * a long-lived socket a nuisance to keep alive.
 *
 *   usePoll     — a screen keeps its own data fresh.
 *   LiveProvider — the one poll that feeds tab badges and answer toasts, which
 *                  is what "notifications" means here: this app is served over
 *                  plain HTTP on the LAN, where the browser's push APIs do not
 *                  work at all.
 *
 * Both stop while the tab is hidden and catch up the moment it is looked at
 * again, so a phone in a pocket is not polling all afternoon.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { api } from './api.ts';
import { useAuth } from './auth.tsx';
import { useI18n } from './i18n.tsx';
import { useToast } from './components/ui.tsx';
import type { AnswerEvent, Notifications } from './types.ts';

const POLL_MS = 15_000;

// ---------------------------------------------------------------- usePoll

/**
 * Runs `load` now, then every `ms` while the tab is visible, and again whenever
 * it becomes visible. Runs never overlap: on a slow request the next tick is
 * skipped rather than queued up behind it.
 *
 * `load` handles its own errors — a page usually wants to show something in
 * their place. Anything that escapes is swallowed, because a failed background
 * poll must never take the screen down; the next one will most likely succeed.
 */
export function usePoll(load: () => Promise<unknown>, ms = POLL_MS): void {
  const loadRef = useRef(load);
  const running = useRef(false);

  const run = useCallback(() => {
    if (running.current) return;
    running.current = true;
    void Promise.resolve(loadRef.current())
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
      });
  }, []);

  // A screen that changes what it is looking at — another kid's history —
  // hands over a new `load` and gets fresh data at once, not in fifteen seconds.
  useEffect(() => {
    loadRef.current = load;
    run();
  }, [load, run]);

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) run();
    };
    const timer = setInterval(tick, ms);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [ms, run]);
}

// ---------------------------------------------------------------- LiveProvider

const EMPTY: Notifications = {
  pendingSubmissions: 0,
  pendingRedemptions: 0,
  pinRequests: 0,
  events: [],
};

interface Live {
  notifications: Notifications;
  /** Answers this kid has not been shown yet, split by the screen they belong to. */
  unseen: { deed: number; reward: number };
  /** Called by the screen that displays them — clears that badge. */
  markSeen: (kind: AnswerEvent['kind']) => void;
  /** Poll immediately, after an action that has just changed the numbers. */
  refresh: () => void;
}

const Ctx = createContext<Live | null>(null);

/** Which answers this device has already shown, per user — badges are personal. */
const seenKey = (userId: number) => `punkti.seen.${userId}`;

function readSeen(userId: number): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();

  const userId = user?.id ?? 0;
  const [notifications, setNotifications] = useState<Notifications>(EMPTY);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(userId));

  /*
   * Answers already on the server when the app opened are not news — they get a
   * badge, not a toast. Only what arrives while someone is watching is worth
   * interrupting them for, so the first poll fills this silently.
   */
  const announced = useRef<Set<string> | null>(null);

  useEffect(() => {
    announced.current = null;
    setSeen(readSeen(userId));
    setNotifications(EMPTY);
  }, [userId]);

  const load = useCallback(async () => {
    const next = await api.notifications().catch(() => null);
    if (!next) return;
    setNotifications(next);

    if (announced.current === null) {
      announced.current = new Set(next.events.map((event) => event.key));
      return;
    }
    for (const event of next.events) {
      if (announced.current.has(event.key)) continue;
      announced.current.add(event.key);
      const verb = event.status === 'approved' ? t('approved') : t('rejected');
      toast.show(
        `${event.icon || (event.kind === 'deed' ? '⭐' : '🎁')} ${event.title} — ${verb}`,
        event.status === 'approved' ? 'good' : 'neutral',
      );
    }
  }, [t, toast]);

  usePoll(load);

  const unseen = useMemo(() => {
    const counts = { deed: 0, reward: 0 };
    for (const event of notifications.events) {
      if (!seen.has(event.key)) counts[event.kind]++;
    }
    return counts;
  }, [notifications.events, seen]);

  const markSeen = useCallback(
    (kind: AnswerEvent['kind']) => {
      setSeen((current) => {
        const keys = notifications.events.filter((e) => e.kind === kind).map((e) => e.key);
        if (keys.every((key) => current.has(key))) return current;

        const next = new Set(current);
        for (const key of keys) next.add(key);

        // Keys the server has stopped sending are dropped here rather than
        // accumulating in storage for the life of the install.
        const live = new Set(notifications.events.map((e) => e.key));
        const kept = [...next].filter((key) => live.has(key));
        try {
          localStorage.setItem(seenKey(userId), JSON.stringify(kept));
        } catch {
          // A full or blocked storage only costs a badge that reappears.
        }
        return new Set(kept);
      });
    },
    [notifications.events, userId],
  );

  const refresh = useCallback(() => void load(), [load]);

  const value = useMemo<Live>(
    () => ({ notifications, unseen, markSeen, refresh }),
    [notifications, unseen, markSeen, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive(): Live {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLive must be used inside LiveProvider');
  return ctx;
}

/**
 * Clears a kid's badge for the kind of answer this screen shows, and keeps it
 * clear while they stay on it.
 */
export function useSeen(kind: AnswerEvent['kind']): void {
  const { markSeen, unseen } = useLive();
  useEffect(() => {
    if (unseen[kind] > 0) markSeen(kind);
  }, [kind, markSeen, unseen]);
}

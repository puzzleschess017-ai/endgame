// Training activity per day, for the Home dashboard (sessions, time, puzzles, accuracy over time).
// Every finished run of every mode adds one session to its day. Only day totals are stored, so the
// record stays small: about 100 bytes per day that was trained, the last 400 days.

export type ActivityMode = 'woodpecker' | 'coordinates' | 'streak' | 'race' | 'blindfold' | 'drills';

export const ACTIVITY_STORAGE_KEY = 'ctg_activity_v1';
export const ACTIVITY_DAYS_KEPT = 400;

export interface DayTotals {
  sessions: number;
  ms: number;
  /** Puzzles solved (puzzle modes only). */
  puzzles: number;
  /** Right and wrong answers of every mode, for the accuracy. */
  correct: number;
  wrong: number;
}

export type ActivityLog = Record<string, DayTotals>;

export interface ActivityInput {
  mode: ActivityMode;
  /** How long the run lasted. */
  ms: number;
  correct: number;
  wrong: number;
  /** Puzzles solved, 0 for modes that are not about puzzles. */
  puzzles?: number;
  /** For tests. */
  now?: number;
}

/** Local calendar day, "2026-11-24". */
export function dayKey(time: number): string {
  const d = new Date(time);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function emptyDay(): DayTotals {
  return { sessions: 0, ms: 0, puzzles: 0, correct: 0, wrong: 0 };
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function loadActivity(): ActivityLog {
  try {
    const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const log: ActivityLog = {};
    for (const [day, value] of Object.entries(parsed as Record<string, Record<string, unknown>>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !value || typeof value !== 'object') continue;
      log[day] = {
        sessions: num(value.sessions),
        ms: num(value.ms),
        puzzles: num(value.puzzles),
        correct: num(value.correct),
        wrong: num(value.wrong),
      };
    }
    return log;
  } catch {
    return {};
  }
}

/** Adds one finished run to today's totals. */
export function recordActivity(input: ActivityInput): void {
  try {
    const log = loadActivity();
    const key = dayKey(input.now ?? Date.now());
    const day = log[key] ?? emptyDay();
    day.sessions += 1;
    day.ms += Math.max(0, Math.round(input.ms));
    day.puzzles += Math.max(0, Math.floor(input.puzzles ?? 0));
    day.correct += Math.max(0, Math.floor(input.correct));
    day.wrong += Math.max(0, Math.floor(input.wrong));
    log[key] = day;
    const keys = Object.keys(log).sort();
    for (const old of keys.slice(0, Math.max(0, keys.length - ACTIVITY_DAYS_KEPT))) delete log[old];
    localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // ignore storage errors: training goes on without statistics
  }
}

export interface ActivityTotals {
  sessions: number;
  ms: number;
  puzzles: number;
  /** 0-100, or null when nothing was answered yet. */
  accuracy: number | null;
}

export function totalActivity(log: ActivityLog): ActivityTotals {
  const t = { sessions: 0, ms: 0, puzzles: 0, correct: 0, wrong: 0 };
  for (const day of Object.values(log)) {
    t.sessions += day.sessions;
    t.ms += day.ms;
    t.puzzles += day.puzzles;
    t.correct += day.correct;
    t.wrong += day.wrong;
  }
  const answered = t.correct + t.wrong;
  return {
    sessions: t.sessions,
    ms: t.ms,
    puzzles: t.puzzles,
    accuracy: answered === 0 ? null : Math.round((t.correct / answered) * 100),
  };
}

/** Local day keys of the last `count` days, oldest first, ending with the day of `now`. */
export function lastDays(count: number, now: number = Date.now()): string[] {
  const days: string[] = [];
  const base = new Date(now);
  for (let i = count - 1; i >= 0; i--) {
    // Noon avoids trouble on the days the clocks change.
    days.push(dayKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() - i, 12).getTime()));
  }
  return days;
}

export interface DayPoint {
  day: string;
  sessions: number;
  minutes: number;
  puzzles: number;
  /** 0-100, or null on days without answers. */
  accuracy: number | null;
}

/** One point per day for the charts. Days without training have zeros (and no accuracy). */
export function dailySeries(log: ActivityLog, count: number, now: number = Date.now()): DayPoint[] {
  return lastDays(count, now).map((day) => {
    const d = log[day];
    if (!d) return { day, sessions: 0, minutes: 0, puzzles: 0, accuracy: null };
    const answered = d.correct + d.wrong;
    return {
      day,
      sessions: d.sessions,
      minutes: Math.round((d.ms / 60000) * 10) / 10,
      puzzles: d.puzzles,
      accuracy: answered === 0 ? null : Math.round((d.correct / answered) * 100),
    };
  });
}

export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta, 12).getTime());
}

export interface DayStreaks {
  /** Days in a row ending today (or yesterday: today may still be ahead). */
  current: number;
  best: number;
}

export function dayStreaks(log: ActivityLog, now: number = Date.now()): DayStreaks {
  const trained = new Set(Object.keys(log).filter((k) => log[k].sessions > 0));
  const today = dayKey(now);
  let cursor = trained.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (trained.has(cursor)) {
    current += 1;
    cursor = shiftDay(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let previous = '';
  for (const key of [...trained].sort()) {
    run = previous && shiftDay(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return { current, best };
}

/** "5h 34m", "12m 05s", "40s". */
export function formatTotalTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

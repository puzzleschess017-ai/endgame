// Daily goal: how many puzzles to solve each day, how far today is, and how many days in a row the goal was reached.
// The goal is a setting of this device (it is not synced); the progress comes from the activity log.
import { dayKey, shiftDay, type ActivityLog } from './activity.ts';

export const GOAL_STORAGE_KEY = 'ctg_daily_goal_v1';
export const GOAL_OPTIONS = [10, 20, 30, 50, 100] as const;
export const DEFAULT_GOAL = 20;
export const MAX_GOAL = 1000;

/** A saved goal is a whole number from 1 to 1000; anything else is the default. */
export function parseGoal(raw: string | null): number {
  if (raw === null || !/^\d{1,4}$/.test(raw.trim())) return DEFAULT_GOAL;
  const n = Number(raw);
  return n >= 1 && n <= MAX_GOAL ? n : DEFAULT_GOAL;
}

export function loadGoal(): number {
  try {
    return parseGoal(localStorage.getItem(GOAL_STORAGE_KEY));
  } catch {
    return DEFAULT_GOAL;
  }
}

export function saveGoal(goal: number): void {
  try {
    localStorage.setItem(GOAL_STORAGE_KEY, String(Math.min(MAX_GOAL, Math.max(1, Math.round(goal)))));
  } catch {
    // storage blocked: the goal lasts until the page is closed
  }
}

export interface GoalProgress {
  /** Puzzles solved today. */
  today: number;
  goal: number;
  /** 0-100 (stays at 100 once the goal is passed). */
  percent: number;
  reached: boolean;
}

export function goalProgress(log: ActivityLog, goal: number, now: number = Date.now()): GoalProgress {
  const today = log[dayKey(now)]?.puzzles ?? 0;
  return { today, goal, percent: Math.min(100, Math.round((today / goal) * 100)), reached: today >= goal };
}

export interface GoalStreak {
  /** Days in a row with the goal reached, ending today, or yesterday while today is still ahead. */
  current: number;
  best: number;
}

/** Days in a row on which at least `goal` puzzles were solved (with the goal as it is now, for every day). */
export function goalStreak(log: ActivityLog, goal: number, now: number = Date.now()): GoalStreak {
  const met = new Set(Object.keys(log).filter((k) => log[k].puzzles >= goal));
  const today = dayKey(now);
  let cursor = met.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (met.has(cursor)) {
    current += 1;
    cursor = shiftDay(cursor, -1);
  }
  let best = 0;
  let run = 0;
  let previous = '';
  for (const key of [...met].sort()) {
    run = previous && shiftDay(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return { current, best };
}

export const GOAL_CELEBRATED_KEY = 'ctg_goal_celebrated_v1';

/** What was celebrated: a day and the goal that was reached that day ("2026-11-26:10"). */
export function celebrationKey(goal: number, now: number = Date.now()): string {
  return `${dayKey(now)}:${goal}`;
}

/** The goal card plays its short animation once for every goal reached, the first time it shows it as reached. */
export function celebrationDue(reached: boolean, celebrated: string | null, goal: number, now: number = Date.now()): boolean {
  return reached && celebrated !== celebrationKey(goal, now);
}

export function loadCelebrated(): string | null {
  try {
    return localStorage.getItem(GOAL_CELEBRATED_KEY);
  } catch {
    return null;
  }
}

export function saveCelebrated(goal: number, now: number = Date.now()): void {
  try {
    localStorage.setItem(GOAL_CELEBRATED_KEY, celebrationKey(goal, now));
  } catch {
    // storage blocked: the animation may play again on the next visit today
  }
}

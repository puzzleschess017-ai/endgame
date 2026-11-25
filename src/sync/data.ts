// What is saved on the account, and how two copies of it are put together (pure code, no browser).
// Only results are synced: the daily activity, the finished Woodpecker cycles and the personal bests.
// Settings (board colours, sound, the last chosen options) stay on the device.
import { ACTIVITY_DAYS_KEPT, ACTIVITY_STORAGE_KEY } from '../utils/activity.ts';
import { WOODPECKER_HISTORY_LIMIT, WOODPECKER_HISTORY_STORAGE_KEY } from '../utils/woodpeckerHistory.ts';

/** How the value of a key is merged. */
export type DataKind = 'activity' | 'history' | 'best-number' | 'best-map';

export const SYNCED: Array<{ key: string; kind: DataKind }> = [
  { key: ACTIVITY_STORAGE_KEY, kind: 'activity' },
  { key: WOODPECKER_HISTORY_STORAGE_KEY, kind: 'history' },
  { key: 'ctg_streak_best_v1', kind: 'best-number' },
  { key: 'ctg_survival_best_v1', kind: 'best-number' },
  { key: 'ctg_coordinates_best_v1', kind: 'best-map' },
  { key: 'ctg_blindfold_best_v1', kind: 'best-map' },
  { key: 'ctg_drills_best_v1', kind: 'best-map' },
];

export const SYNCED_KEYS = SYNCED.map((entry) => entry.key);

/**
 * "combine": two different sources (the results made as a guest, and the account's): totals are added up.
 * "reconcile": two copies of the same account's results: the larger number of each day wins, so putting
 * the same data together twice changes nothing.
 */
export type MergeMode = 'combine' | 'reconcile';

type Json = unknown;

function isObject(value: Json): value is Record<string, Json> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function count(value: Json): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

const ACTIVITY_FIELDS = ['sessions', 'ms', 'puzzles', 'correct', 'wrong'] as const;

function mergeActivity(a: Json, b: Json, mode: MergeMode): Json {
  const left = isObject(a) ? a : {};
  const right = isObject(b) ? b : {};
  const out: Record<string, Record<string, number>> = {};
  for (const day of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const x = isObject(left[day]) ? (left[day] as Record<string, Json>) : {};
    const y = isObject(right[day]) ? (right[day] as Record<string, Json>) : {};
    const merged: Record<string, number> = {};
    for (const field of ACTIVITY_FIELDS) {
      merged[field] = mode === 'combine' ? count(x[field]) + count(y[field]) : Math.max(count(x[field]), count(y[field]));
    }
    out[day] = merged;
  }
  const days = Object.keys(out).sort();
  for (const old of days.slice(0, Math.max(0, days.length - ACTIVITY_DAYS_KEPT))) delete out[old];
  return out;
}

function mergeHistory(a: Json, b: Json): Json {
  const byKey = new Map<string, Record<string, Json>>();
  for (const list of [a, b]) {
    if (!Array.isArray(list)) continue;
    for (const record of list) {
      if (isObject(record) && typeof record.key === 'string' && !byKey.has(record.key)) byKey.set(record.key, record);
    }
  }
  const sorted = [...byKey.values()].sort(
    (x, y) => count(x.completedAt) - count(y.completedAt) || String(x.key).localeCompare(String(y.key)),
  );
  return sorted.slice(-WOODPECKER_HISTORY_LIMIT);
}

function mergeBestMap(a: Json, b: Json): Json {
  const left = isObject(a) ? a : {};
  const right = isObject(b) ? b : {};
  const out: Record<string, number> = {};
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const best = Math.max(count(left[key]), count(right[key]));
    if (best > 0) out[key] = best;
  }
  return out;
}

/** Merges two parsed values of the same kind. A missing value (null/undefined) is empty. */
export function mergeData(kind: DataKind, a: Json, b: Json, mode: MergeMode): Json {
  switch (kind) {
    case 'activity':
      return mergeActivity(a, b, mode);
    case 'history':
      return mergeHistory(a, b);
    case 'best-number':
      return Math.max(count(a), count(b));
    case 'best-map':
      return mergeBestMap(a, b);
  }
}

/** True when the value holds nothing (no results). */
export function isEmptyData(kind: DataKind, value: Json): boolean {
  switch (kind) {
    case 'activity':
    case 'best-map':
      return !isObject(value) || Object.keys(value).length === 0;
    case 'history':
      return !Array.isArray(value) || value.length === 0;
    case 'best-number':
      return count(value) === 0;
  }
}

/**
 * What goes into localStorage for a value ("streak best" is a plain number, the rest is JSON). Keys are
 * sorted, so the same data always gives the same text, whatever order the server or the page had it in.
 */
export function serialize(value: Json): string {
  return JSON.stringify(value, (_key, v: Json) =>
    isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v,
  );
}

/** Reads what localStorage holds for a key: null for nothing or for text that is not JSON. */
export function parse(raw: string | null): Json {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** A short fingerprint of a stored text, to tell whether it changed since the last sync. */
export function fingerprint(raw: string | null): string {
  if (raw === null) return '';
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  return `${raw.length}:${(hash >>> 0).toString(36)}`;
}

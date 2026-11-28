// Unfinished runs (the Woodpecker cycle in progress, the Puzzle Streak run in progress) are kept on the device so a page
// reload or a closed tab does not lose them. They belong to whoever was using the device, not to the device:
// when another account signs in (or an account signs out) they must not be offered to the next person.
// A guest who signs in or signs up keeps what they were doing.
export const RUN_OWNER_KEY = 'ctg_run_owner_v1';

/** The Woodpecker session in progress (STORAGE_KEY of utils/chessHelpers.ts) and the Streak run (utils/streak.ts). */
export const IN_PROGRESS_KEYS = ['endgame_woodpecker_session_v1', 'ctg_streak_run_v1'];

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const GUEST = 'guest';

/**
 * Says who is using the device now (an account id, or null for a guest). Unfinished runs of an account that is no
 * longer the one using the device are removed. Returns true when something was removed.
 */
export function applyRunOwner(storage: Storage, userId: string | null): boolean {
  try {
    const now = userId ?? GUEST;
    const before = storage.getItem(RUN_OWNER_KEY);
    // Unknown (first visit with this version) or a guest before: nothing belongs to another account.
    const foreign = before !== null && before !== GUEST && before !== now;
    if (foreign) for (const key of IN_PROGRESS_KEYS) storage.removeItem(key);
    if (before !== now) storage.setItem(RUN_OWNER_KEY, now);
    return foreign;
  } catch {
    return false;
  }
}

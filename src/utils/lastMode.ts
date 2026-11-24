// Remembers the training mode visited last, so Home can offer "Continue".

export const LAST_MODE_STORAGE_KEY = 'ctg_last_mode_v1';

export function saveLastMode(path: string): void {
  try {
    localStorage.setItem(LAST_MODE_STORAGE_KEY, path);
  } catch {
    // ignore storage errors
  }
}

export function loadLastMode(): string | null {
  try {
    return localStorage.getItem(LAST_MODE_STORAGE_KEY);
  } catch {
    return null;
  }
}

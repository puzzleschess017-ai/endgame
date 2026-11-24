export const USERNAME_STORAGE_KEY = 'ctg_username_v1';

export function readSavedUsername(): string {
  try {
    return (localStorage.getItem(USERNAME_STORAGE_KEY) ?? '').trim();
  } catch {
    return '';
  }
}

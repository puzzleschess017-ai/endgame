// "Play as a guest" is a choice: a visitor who has neither signed in nor chosen it is asked first
// (see AccessGate). The choice is remembered in this browser until someone signs in or out.
import { useSyncExternalStore } from 'react';

export const GUEST_STORAGE_KEY = 'ctg_guest_v1';
const CHANGED = 'ctg:guest-choice';

export function hasChosenGuest(): boolean {
  try {
    return localStorage.getItem(GUEST_STORAGE_KEY) === 'yes';
  } catch {
    return false;
  }
}

export function chooseGuest(): void {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, 'yes');
  } catch {
    // storage blocked: the choice only lasts until the page is closed
    memoryChoice = true;
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function forgetGuestChoice(): void {
  memoryChoice = false;
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {
    // nothing to remove
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED));
}

let memoryChoice = false;

function snapshot(): boolean {
  return memoryChoice || hasChosenGuest();
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener('storage', listener);
  };
}

/** True once the visitor chose "Play as a guest" in this browser. */
export function useGuestChoice(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => true);
}

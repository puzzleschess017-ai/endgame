// Cookie choice for Google Analytics (loaded through Google Tag Manager). Nothing from Google is loaded
// until the visitor accepts; declining (or changing their mind later) removes its cookies again.
import { useSyncExternalStore } from 'react';

export const CONSENT_STORAGE_KEY = 'ctg_consent_v1';
export const GTM_ID = 'GTM-TKT6K2LM';
const CHANGED = 'ctg:consent';

export type Consent = 'granted' | 'denied';

export function parseConsent(raw: string | null): Consent | null {
  return raw === 'granted' || raw === 'denied' ? raw : null;
}

/** Names of the cookies Google Analytics and Tag Manager set (`_ga`, `_ga_XXXX`, `_gid`, `_gat…`, `_gcl_…`). */
export function analyticsCookieNames(cookieHeader: string): string[] {
  return cookieHeader
    .split(';')
    .map((part) => part.split('=')[0].trim())
    .filter((name) => /^(_ga|_gid|_gat|_gcl_)/.test(name));
}

let memoryChoice: Consent | null = null;

export function readConsent(): Consent | null {
  try {
    return parseConsent(localStorage.getItem(CONSENT_STORAGE_KEY)) ?? memoryChoice;
  } catch {
    return memoryChoice;
  }
}

/** Puts the Tag Manager script on the page, once. */
export function loadAnalytics(): void {
  if (typeof document === 'undefined' || document.getElementById('ctg-gtm')) return;
  const w = window as unknown as { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const script = document.createElement('script');
  script.id = 'ctg-gtm';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

/** Deletes the analytics cookies of this site (on the host and on its parent domain). */
export function clearAnalyticsCookies(): void {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname;
  const parts = host.split('.');
  const domains = new Set<string | null>([null, host]);
  for (let i = 1; i < parts.length - 1; i++) domains.add('.' + parts.slice(i).join('.'));
  for (const name of analyticsCookieNames(document.cookie)) {
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`;
    }
  }
}

export function setConsent(value: Consent | null): void {
  memoryChoice = value;
  try {
    if (value) localStorage.setItem(CONSENT_STORAGE_KEY, value);
    else localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // storage blocked: the choice only lasts until the page is closed
  }
  if (value === 'granted') loadAnalytics();
  if (value === 'denied') clearAnalyticsCookies();
  window.dispatchEvent(new Event(CHANGED));
}

/** Call once at start: a visitor who accepted earlier gets analytics straight away. */
export function initConsent(): void {
  if (readConsent() === 'granted') loadAnalytics();
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener('storage', listener);
  };
}

/** The visitor's cookie choice, or null while they have not chosen. */
export function useConsent(): Consent | null {
  return useSyncExternalStore(subscribe, readConsent, () => 'denied' as Consent);
}

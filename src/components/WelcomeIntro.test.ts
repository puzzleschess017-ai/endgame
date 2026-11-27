import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WelcomeIntro from './WelcomeIntro.tsx';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('the Start training and Login buttons shine, Login a moment later and in dark plum', () => {
  const html = renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: false, premium: false }));
  const tag = (testId: string) => html.match(new RegExp(`<a [^>]*data-testid="${testId}"[^>]*>`))![0];
  assert.match(tag('welcome-start'), /class="[^"]*\bbtn-shine\b/);
  assert.doesNotMatch(tag('welcome-start'), /btn-shine-late/);
  assert.match(tag('welcome-signin'), /class="[^"]*\bbtn-shine\b[^"]*\bbtn-shine-late\b/);
  assert.match(tag('welcome-signin'), /\[--glow:36,18,29\]/);
});

test('the outlined "Create a free account" button does not shine', () => {
  const html = renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: false, premium: false }));
  assert.doesNotMatch(html.match(/<a [^>]*data-testid="welcome-signup"[^>]*>/)![0], /btn-shine/);
});

test('the shine is switched off for people who ask for less motion, and on a disabled or "still" button', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.btn-shine,\s*\.btn-shine::after \{ animation: none; \}\s*\}/);
  assert.match(css, /@keyframes btn-sweep/);
  assert.match(css, /@keyframes btn-glow/);
  assert.match(css, /\.btn-still,\s*\.btn-shine:disabled,\s*\.btn-shine\[aria-disabled='true'\] \{ animation: none; \}/);
  assert.match(css, /@layer components \{\s*\.btn-shine \{/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WelcomeIntro from './WelcomeIntro.tsx';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('the Start training and Login buttons shine, each in its own colour', () => {
  const html = renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: false, premium: false }));
  const tag = (testId: string) => html.match(new RegExp(`<a [^>]*data-testid="${testId}"[^>]*>`))![0];
  assert.match(tag('welcome-start'), /class="[^"]*\bbtn-shine\b[^"]*\[--glow:57,255,136\]/);
  assert.match(tag('welcome-signin'), /class="[^"]*\bbtn-shine\b[^"]*\bbtn-shine-late\b[^"]*\[--glow:125,211,252\]/);
});

test('the other buttons do not shine, and a signed-in visitor has only the Start button', () => {
  const html = renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: true, premium: false }));
  assert.equal((html.match(/btn-shine\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /welcome-signin/);
});

test('the shine is switched off for people who ask for less motion', () => {
  const reduced = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\.btn-shine,\s*\.btn-shine::after \{ animation: none; \}\s*\}/);
  assert.ok(reduced, 'index.css has no reduced-motion rule for .btn-shine');
  assert.match(css, /@keyframes btn-sweep/);
  assert.match(css, /@keyframes btn-glow/);
});

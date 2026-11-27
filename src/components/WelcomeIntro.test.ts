import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WelcomeIntro from './WelcomeIntro.tsx';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('the Start training and Login buttons shine, Login a moment later and in blue', () => {
  const html = renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: false, premium: false }));
  const tag = (testId: string) => html.match(new RegExp(`<a [^>]*data-testid="${testId}"[^>]*>`))![0];
  assert.match(tag('welcome-start'), /class="[^"]*\bbtn-shine\b/);
  assert.doesNotMatch(tag('welcome-start'), /btn-shine-late/);
  assert.match(tag('welcome-signin'), /class="[^"]*\bbtn-shine\b[^"]*\bbtn-shine-late\b/);
  assert.match(tag('welcome-signin'), /\[--glow:125,211,252\]/);
});

test('the outlined "Create account" button does not shine', () => {
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

test('Login and Create account lift a little on hover, and not for people who ask for less motion', () => {
  const html = renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: false, premium: false }));
  const tag = (testId: string) => html.match(new RegExp(`<a [^>]*data-testid="${testId}"[^>]*>`))![0];
  for (const id of ['welcome-signin', 'welcome-signup']) {
    assert.match(tag(id), /\bhover:-translate-y-0\.5\b/);
    assert.match(tag(id), /\bmotion-reduce:hover:translate-y-0\b/);
  }
});

test('the home page shows two whole phone screenshots', () => {
  const html = renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: false, premium: false }));
  assert.equal((html.match(/<img [^>]*src="\/welcome\/phone-[a-z]+\.webp"/g) ?? []).length, 2);
});

test('the prices come last, and not for someone who has Premium', () => {
  const html = renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: false, premium: false }));
  assert.ok(html.indexOf('data-testid="welcome-premium"') > html.indexOf('data-testid="welcome-start"'));
  assert.match(html, /\$4\.99/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(WelcomeIntro, { signedIn: true, premium: true })), /welcome-premium/);
});

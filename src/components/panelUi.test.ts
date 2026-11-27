import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOGIN_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, START_BUTTON_CLASS, segmentClass } from './panelUi.tsx';

const shines = (cls: string) => cls.split(/\s+/).includes('btn-shine');

test('every filled main button shines: Start, Primary and Login (Login in dark plum)', () => {
  assert.ok(shines(START_BUTTON_CLASS));
  assert.ok(shines(PRIMARY_BUTTON_CLASS));
  assert.ok(shines(LOGIN_BUTTON_CLASS));
  assert.ok(LOGIN_BUTTON_CLASS.includes('[--glow:36,18,29]'));
  assert.ok(!PRIMARY_BUTTON_CLASS.includes('--glow'), 'green is the default glow');
});

test('outlined buttons and the choices of a segmented control do not shine', () => {
  assert.ok(!shines(SECONDARY_BUTTON_CLASS));
  assert.ok(!shines(segmentClass(true)));
  assert.ok(!shines(segmentClass(false)));
});

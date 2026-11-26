import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { test } from 'node:test';
import {
  BOARD_SOUND_URLS,
  DEFAULT_SOUND_SETTINGS,
  getSoundSettings,
  isSilent,
  parseSoundSettings,
  setSoundSettings,
  subscribeSoundSettings,
  volumeToGain,
} from './sound.ts';

test('no saved sound settings gives the defaults: half volume, not muted', () => {
  assert.deepEqual(parseSoundSettings(null), DEFAULT_SOUND_SETTINGS);
  assert.deepEqual(DEFAULT_SOUND_SETTINGS, { volume: 0.5, muted: false, style: 'board' });
});

test('saved settings are read back', () => {
  const saved = JSON.stringify({ volume: 0.8, muted: true, style: 'electronic' });
  assert.deepEqual(parseSoundSettings(saved), { volume: 0.8, muted: true, style: 'electronic' });
});

test('the removed "classic" and "pop" styles become the board style', () => {
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 0.4, style: 'classic' })).style, 'board');
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 0.4, style: 'pop' })).style, 'board');
});

test('the board style is a saved style', () => {
  assert.equal(parseSoundSettings(JSON.stringify({ style: 'board' })).style, 'board');
});

test('settings saved without a style, or with an unknown one, get the default style', () => {
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 0.3, muted: true })).style, 'board');
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 0.3, style: 'tuba' })).style, 'board');
});

test('broken or strange saved settings fall back safely', () => {
  assert.deepEqual(parseSoundSettings('not json'), DEFAULT_SOUND_SETTINGS);
  assert.deepEqual(parseSoundSettings('null'), DEFAULT_SOUND_SETTINGS);
  assert.deepEqual(parseSoundSettings(JSON.stringify({ volume: 'loud', muted: 'yes' })), DEFAULT_SOUND_SETTINGS);
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 7 })).volume, 1);
  assert.equal(parseSoundSettings(JSON.stringify({ volume: -3 })).volume, 0);
});

test('volumeToGain: 50 % is the old loudness, 100 % four times that, 0 % silence', () => {
  assert.equal(volumeToGain(0), 0);
  assert.equal(volumeToGain(0.5), 1);
  assert.equal(volumeToGain(1), 4);
  assert.equal(volumeToGain(5), 4);
  assert.equal(volumeToGain(-1), 0);
});

test('isSilent when muted or at zero volume', () => {
  assert.equal(isSilent({ volume: 0.5, muted: false, style: 'electronic' }), false);
  assert.equal(isSilent({ volume: 0.5, muted: true, style: 'electronic' }), true);
  assert.equal(isSilent({ volume: 0, muted: false, style: 'electronic' }), true);
});

test('setSoundSettings changes only what it is given, validates it and tells the listeners', () => {
  let calls = 0;
  const stop = subscribeSoundSettings(() => calls++);
  setSoundSettings({ volume: 0.8 });
  assert.deepEqual(getSoundSettings(), { volume: 0.8, muted: false, style: 'board' });
  setSoundSettings({ volume: 2 });
  assert.equal(getSoundSettings().volume, 1);
  assert.equal(getSoundSettings().muted, false);
  setSoundSettings({ muted: true });
  assert.equal(getSoundSettings().muted, true);
  assert.equal(calls, 3);
  setSoundSettings({ style: 'electronic' });
  assert.equal(getSoundSettings().style, 'electronic');
  assert.equal(calls, 4);
  setSoundSettings({ style: 'board' });
  stop();
  setSoundSettings({ muted: false, volume: 0.5 });
  assert.equal(calls, 5);
});

test('the board style has a recording for move, capture, check and success, and each file is small and exists', () => {
  assert.deepEqual(Object.keys(BOARD_SOUND_URLS).sort(), ['capture', 'check', 'move', 'success']);
  for (const url of Object.values(BOARD_SOUND_URLS)) {
    const file = new URL(`../../public${url}`, import.meta.url);
    assert.ok(existsSync(file), `${url} is missing from public/`);
    assert.ok(statSync(file).size < 30_000, `${url} should stay small: it is loaded before the first move`);
  }
});

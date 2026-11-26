import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
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
  assert.deepEqual(DEFAULT_SOUND_SETTINGS, { volume: 0.5, muted: false, style: 'electronic' });
});

test('saved settings are read back', () => {
  const saved = JSON.stringify({ volume: 0.8, muted: true, style: 'pop' });
  assert.deepEqual(parseSoundSettings(saved), { volume: 0.8, muted: true, style: 'pop' });
});

test('the old "classic" style name becomes pop', () => {
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 0.4, style: 'classic' })).style, 'pop');
});

test('settings saved without a style, or with an unknown one, get the default style', () => {
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 0.3, muted: true })).style, 'electronic');
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 0.3, style: 'tuba' })).style, 'electronic');
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
  assert.equal(isSilent({ volume: 0.5, muted: false, style: 'pop' }), false);
  assert.equal(isSilent({ volume: 0.5, muted: true, style: 'pop' }), true);
  assert.equal(isSilent({ volume: 0, muted: false, style: 'pop' }), true);
});

test('setSoundSettings changes only what it is given, validates it and tells the listeners', () => {
  let calls = 0;
  const stop = subscribeSoundSettings(() => calls++);
  setSoundSettings({ volume: 0.8 });
  assert.deepEqual(getSoundSettings(), { volume: 0.8, muted: false, style: 'electronic' });
  setSoundSettings({ volume: 2 });
  assert.equal(getSoundSettings().volume, 1);
  assert.equal(getSoundSettings().muted, false);
  setSoundSettings({ muted: true });
  assert.equal(getSoundSettings().muted, true);
  assert.equal(calls, 3);
  setSoundSettings({ style: 'pop' });
  assert.equal(getSoundSettings().style, 'pop');
  assert.equal(calls, 4);
  setSoundSettings({ style: 'electronic' });
  stop();
  setSoundSettings({ muted: false, volume: 0.5 });
  assert.equal(calls, 5);
});

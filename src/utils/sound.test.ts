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
  assert.deepEqual(DEFAULT_SOUND_SETTINGS, { volume: 0.5, muted: false });
});

test('saved settings are read back', () => {
  const saved = JSON.stringify({ volume: 0.8, muted: true });
  assert.deepEqual(parseSoundSettings(saved), { volume: 0.8, muted: true });
});

test('settings saved while the site had a sound style keep their volume and mute, and lose the style', () => {
  const old = JSON.stringify({ volume: 0.3, style: 'classic', muted: true });
  assert.deepEqual(parseSoundSettings(old), { volume: 0.3, muted: true });
  assert.equal('style' in parseSoundSettings(old), false);
});

test('broken or strange saved settings fall back safely', () => {
  assert.deepEqual(parseSoundSettings('not json'), DEFAULT_SOUND_SETTINGS);
  assert.deepEqual(parseSoundSettings('null'), DEFAULT_SOUND_SETTINGS);
  assert.deepEqual(parseSoundSettings(JSON.stringify({ volume: 'loud', muted: 'yes' })), DEFAULT_SOUND_SETTINGS);
  assert.equal(parseSoundSettings(JSON.stringify({ volume: 7 })).volume, 1);
  assert.equal(parseSoundSettings(JSON.stringify({ volume: -3 })).volume, 0);
});

test('volumeToGain: 50 % is the old loudness, 100 % twice that, 0 % silence', () => {
  assert.equal(volumeToGain(0), 0);
  assert.equal(volumeToGain(0.5), 1);
  assert.equal(volumeToGain(1), 2);
  assert.equal(volumeToGain(5), 2);
  assert.equal(volumeToGain(-1), 0);
});

test('isSilent when muted or at zero volume', () => {
  assert.equal(isSilent({ volume: 0.5, muted: false }), false);
  assert.equal(isSilent({ volume: 0.5, muted: true }), true);
  assert.equal(isSilent({ volume: 0, muted: false }), true);
});

test('setSoundSettings changes only what it is given, validates it and tells the listeners', () => {
  let calls = 0;
  const stop = subscribeSoundSettings(() => calls++);
  setSoundSettings({ volume: 0.8 });
  assert.deepEqual(getSoundSettings(), { volume: 0.8, muted: false });
  setSoundSettings({ volume: 2 });
  assert.equal(getSoundSettings().volume, 1);
  assert.equal(getSoundSettings().muted, false);
  setSoundSettings({ muted: true });
  assert.equal(getSoundSettings().muted, true);
  assert.equal(calls, 3);
  stop();
  setSoundSettings({ muted: false, volume: 0.5 });
  assert.equal(calls, 3);
});

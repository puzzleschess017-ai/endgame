import { useSyncExternalStore } from 'react';
import { getSoundSettings, setSoundSettings, subscribeSoundSettings } from '../utils/sound';
import type { SoundSettings } from '../utils/sound';

/** The site's sound settings (volume, style, mute) and a function to change them. */
export function useSoundSettings(): [SoundSettings, (patch: Partial<SoundSettings>) => void] {
  const settings = useSyncExternalStore(subscribeSoundSettings, getSoundSettings, getSoundSettings);
  return [settings, setSoundSettings];
}

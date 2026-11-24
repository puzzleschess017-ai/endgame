import { useEffect, useState } from 'react';
import type { AppearanceSettings } from '../types';
import { loadAppearanceSettings, saveAppearanceSettings } from '../utils/appearance';

/**
 * Board size, board colours and piece set, shared by Woodpecker and every training mode: read from
 * the browser when the page opens and written back whenever they change, so a size picked on one
 * page is the size on all of them.
 */
export function useAppearance() {
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => loadAppearanceSettings());

  useEffect(() => {
    saveAppearanceSettings(appearance);
  }, [appearance]);

  return [appearance, setAppearance] as const;
}

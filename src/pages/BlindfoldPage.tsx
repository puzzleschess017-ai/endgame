import { useState } from 'react';
import { readSavedUsername } from '../utils/profile';
import Drills from './blindfold/Drills';
import MateInOne from './blindfold/MateInOne';
import type { BlindfoldMode } from './blindfold/shared';

/**
 * Blindfold: puzzles without seeing the pieces ("Mate in 1") and visualization drills. A guest sees the
 * same page with every choice locked (a free account opens it), so the page is never empty.
 */
export default function BlindfoldPage() {
  const [mode, setMode] = useState<BlindfoldMode>('mate');
  const [username] = useState(() => readSavedUsername());
  const props = {
    username,
    mode,
    onModeChange: setMode,
  };
  return mode === 'mate' ? <MateInOne {...props} /> : <Drills {...props} />;
}

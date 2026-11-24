import { useState } from 'react';
import { readSavedUsername } from '../utils/profile';
import Drills from './blindfold/Drills';
import Mate from './blindfold/Mate';
import type { BlindfoldMode } from './blindfold/shared';

/**
 * Blindfold: puzzles without seeing the pieces (mate in 1, 2 or 3) and visualization drills. A guest sees the
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
  return mode === 'mate' ? <Mate {...props} /> : <Drills {...props} />;
}

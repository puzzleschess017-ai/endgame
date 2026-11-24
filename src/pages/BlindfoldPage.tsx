import { useState } from 'react';
import { readSavedUsername } from '../utils/profile';
import Drills from './blindfold/Drills';
import MateInOne from './blindfold/MateInOne';
import type { BlindfoldMode } from './blindfold/shared';

/** Blindfold: puzzles without seeing the pieces ("Mate in 1") and visualization drills. */
export default function BlindfoldPage() {
  const [mode, setMode] = useState<BlindfoldMode>('mate');
  const [muted, setMuted] = useState(false);
  const [username] = useState(() => readSavedUsername());
  const props = {
    username,
    muted,
    onToggleMute: () => setMuted((v) => !v),
    mode,
    onModeChange: setMode,
  };
  return mode === 'mate' ? <MateInOne {...props} /> : <Drills {...props} />;
}

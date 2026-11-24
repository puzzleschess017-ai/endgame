import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import AppShell from '../components/AppShell';
import { CARD_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from '../components/panelUi';
import { useAuth } from '../auth';
import { canOpenBlindfold } from '../utils/access';
import { readSavedUsername } from '../utils/profile';
import Drills from './blindfold/Drills';
import MateInOne from './blindfold/MateInOne';
import type { BlindfoldMode } from './blindfold/shared';

/** What a guest sees instead of Blindfold: a free account opens it. */
function ClosedForGuests({ username }: { username: string }) {
  useEffect(() => {
    document.title = 'Blindfold Chess Training | Chess Tactics Guide';
  }, []);
  const next = encodeURIComponent('/blindfold');
  return (
    <AppShell username={username}>
      <div className="max-w-[560px]" data-testid="blindfold-closed">
        <div className={CARD_CLASS}>
          <div className="flex items-center gap-3">
            <EyeOff className="w-7 h-7 text-[#39ff88]" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-white tracking-tight">Blindfold training</h2>
          </div>
          <p className="text-sm font-medium text-white/80 leading-relaxed">
            Memorize a position, then find the checkmate in one move without seeing the pieces. Blindfold
            training is free with an account: create one in a minute, no card needed.
          </p>
          <div className="flex flex-col gap-2.5">
            <a href={`/login?tab=signup&next=${next}`} data-testid="blindfold-create" className={`${PRIMARY_BUTTON_CLASS} flex items-center justify-center`}>
              Create a free account
            </a>
            <a href={`/login?next=${next}`} data-testid="blindfold-sign-in" className={`${SECONDARY_BUTTON_CLASS} flex items-center justify-center`}>
              I already have an account
            </a>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

/** Blindfold: puzzles without seeing the pieces ("Mate in 1") and visualization drills. */
export default function BlindfoldPage() {
  const { tier } = useAuth();
  const [mode, setMode] = useState<BlindfoldMode>('mate');
  const [username] = useState(() => readSavedUsername());
  if (!canOpenBlindfold(tier)) return <ClosedForGuests username={username} />;
  const props = {
    username,
    mode,
    onModeChange: setMode,
  };
  return mode === 'mate' ? <MateInOne {...props} /> : <Drills {...props} />;
}

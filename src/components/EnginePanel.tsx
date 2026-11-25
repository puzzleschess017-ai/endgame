import { Cpu } from 'lucide-react';
import { LOCKED_CLASS, LockMark, UnlockNotice, useLocks } from './locks';
import { formatScore, numberMoves, pvToSan, whiteShare } from '../engine/uci';
import { ENGINE_DEPTH, type EngineState } from '../hooks/useEngine';
import type { Tier } from '../utils/access';

interface EnginePanelProps {
  tier: Tier;
  fen: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  state: EngineState;
  /** A line is pointed at: show its first move on the board (null: none). */
  onHover: (uci: string | null) => void;
  /** A line was clicked: play its first move. */
  onPlay: (uci: string) => void;
}

const STATUS_TEXT: Partial<Record<EngineState['status'], string>> = {
  loading: 'Starting the engine…',
  over: 'The game is over, there is nothing to calculate.',
  missing: 'The engine is not installed on this server yet.',
  error: 'The engine could not be started. Try again later.',
};

/** The first move of the engine's best line, for an arrow on the board (null while there is none). */
export function bestEngineMove(state: EngineState): string | null {
  return state.lines[0]?.pv[0] ?? null;
}

/** "Check with engine": a switch that runs Stockfish on the position of the board. Premium. */
export default function EnginePanel({ tier, fen, on, onToggle, state, onHover, onPlay }: EnginePanelProps) {
  const locks = useLocks(tier);
  const needs: Tier = 'premium';
  const locked = locks.isLocked(needs);
  const top = state.lines[0];
  const share = top ? whiteShare(top) : 50;
  const message = STATUS_TEXT[state.status];

  return (
    <div className="flex flex-col gap-2" data-testid="engine">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled={locked || undefined}
        data-testid="engine-toggle"
        title={locked ? 'Premium' : undefined}
        onClick={locked ? locks.choose('Engine analysis', needs, () => {}) : () => onToggle(!on)}
        className={`${locked ? LOCKED_CLASS : ''} flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors cursor-pointer min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
          on ? 'border-[#39ff88]/60 bg-[#39ff88]/10' : 'border-white/20 bg-[#101b2f] hover:border-white/50'
        }`}
      >
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <Cpu className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          Check with engine
        </span>
        <span
          aria-hidden="true"
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-[#39ff88]' : 'bg-white/20'}`}
        >
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
        </span>
        {locked && <LockMark />}
      </button>
      <UnlockNotice notice={locks.notice} />

      {on && message && (
        <p
          data-testid="engine-message"
          role={state.status === 'error' || state.status === 'missing' ? 'alert' : 'status'}
          className={`text-sm font-semibold leading-snug ${state.status === 'error' || state.status === 'missing' ? 'text-[#ff7a7a]' : 'text-white/70'}`}
        >
          {message}
        </p>
      )}

      {on && !message && (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#101b2f] p-2.5" data-testid="engine-results" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span data-testid="engine-score" className="text-lg font-bold tabular-nums text-white">
              {top ? formatScore(top) : '…'}
            </span>
            <span data-testid="engine-depth" className="text-xs font-semibold tabular-nums text-white/60">
              {state.status === 'done' ? `Depth ${state.depth}` : `Depth ${state.depth} / ${ENGINE_DEPTH}`}
            </span>
          </div>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-[#2b2f3a]"
            role="img"
            aria-label={top ? `Evaluation ${formatScore(top)} for White` : 'Evaluation not known yet'}
          >
            <div data-testid="engine-bar" className="h-full bg-white transition-[width] duration-300" style={{ width: `${share}%` }} />
          </div>
          <ul className="flex flex-col gap-0.5" data-testid="engine-lines">
            {state.lines.map((line) => {
              const san = pvToSan(fen, line.pv, 8);
              return (
                <li key={line.multipv}>
                  <button
                    type="button"
                    data-testid={`engine-line-${line.multipv}`}
                    onClick={() => onPlay(line.pv[0])}
                    onMouseEnter={() => onHover(line.pv[0])}
                    onMouseLeave={() => onHover(null)}
                    onFocus={() => onHover(line.pv[0])}
                    onBlur={() => onHover(null)}
                    className="flex w-full items-baseline gap-2 rounded-lg px-1.5 py-1 text-left text-xs cursor-pointer hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#39ff88]"
                  >
                    <span className="w-10 shrink-0 font-bold tabular-nums text-white">{formatScore(line)}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-white/85">{numberMoves(fen, san)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

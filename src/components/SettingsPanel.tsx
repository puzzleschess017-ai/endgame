import type {
  CycleCountOption,
  Difficulty,
  PuzzleCountOption,
  PuzzleMode,
  TrainingConfig,
} from '../types';
import { tierFor, unlockHint, type Tier } from '../utils/access';
import { GetPremiumLink, LOCKED_CLASS, LockMark, UnlockNotice, useLocks } from './locks';
import { COMPACT_CARD_CLASS, SETUP_TEXT_CLASS, START_BUTTON_CLASS } from './panelUi';
import WoodpeckerExplainer from './WoodpeckerExplainer';

const PUZZLE_COUNTS: PuzzleCountOption[] = [10, 50, 100, 200, 300, 500];
const CYCLE_COUNTS: CycleCountOption[] = [2, 3, 4, 5, 6, 7, 8, 9];
const DIFFICULTIES: Array<{ value: Difficulty; label: string; range: string }> = [
  { value: 'easy', label: 'Easy', range: '< 1200' },
  { value: 'medium', label: 'Medium', range: '1200–1599' },
  { value: 'hard', label: 'Hard', range: '1600–1999' },
  { value: 'expert', label: 'Expert', range: '2000+' },
];
const PUZZLE_MODES: Array<{ value: PuzzleMode; label: string; hint: string }> = [
  { value: 'classic', label: 'Classic', hint: 'Puzzles of every kind' },
  { value: 'endgame', label: 'Endgame', hint: 'Endgames only' },
];
const MIXED: { value: Difficulty; label: string; range: string } = {
  value: 'mixed',
  label: 'Mixed',
  range: 'All ratings, even share',
};

interface SettingsPanelProps {
  config: TrainingConfig;
  onChange: (next: TrainingConfig) => void;
  onStart: () => void;
  loading: boolean;
  error: string | null;
  /** Who is training: decides which choices are open. */
  tier: Tier;
}

export default function SettingsPanel({
  config,
  onChange,
  onStart,
  loading,
  error,
  tier,
}: SettingsPanelProps) {
  const puzzleMode: PuzzleMode = config.puzzleMode ?? 'endgame';
  const locks = useLocks(tier);
  return (
    <div className={`${COMPACT_CARD_CLASS} !gap-2.5`}>
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          Woodpecker Setup
        </h2>
        <p className={SETUP_TEXT_CLASS}>
          {puzzleMode === 'classic'
            ? 'Solve the same set of puzzles again and again.'
            : 'Solve the same endgame set again and again.'}
        </p>
        <WoodpeckerExplainer />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Number of Puzzles</span>
          <span className="text-xs font-semibold text-white/70 tabular-nums">
            {config.puzzleCount} per cycle
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
          {PUZZLE_COUNTS.map((count) => {
            const active = config.puzzleCount === count;
            const needs = tierFor((a) => a.woodpecker.counts, count);
            const locked = locks.isLocked(needs);
            return (
              <button
                key={count}
                type="button"
                data-testid={`count-${count}`}
                aria-disabled={locked || undefined}
                title={locked ? unlockHint(tier, needs) : undefined}
                onClick={locks.choose(`${count} puzzles per cycle`, needs, () => onChange({ ...config, puzzleCount: count }))}
                className={`${locked ? LOCKED_CLASS : ''} py-1.5 px-2 rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[36px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {count}
                {locked && <LockMark />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Number of Cycles</span>
          <span className="text-xs font-semibold text-white/70 tabular-nums">
            {config.totalCycles} cycles
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
          {CYCLE_COUNTS.map((cycles) => {
            const active = config.totalCycles === cycles;
            const needs = tierFor((a) => a.woodpecker.cycles, cycles);
            const locked = locks.isLocked(needs);
            return (
              <button
                key={cycles}
                type="button"
                data-testid={`cycles-${cycles}`}
                aria-disabled={locked || undefined}
                title={locked ? unlockHint(tier, needs) : undefined}
                onClick={locks.choose(`${cycles} cycles`, needs, () => onChange({ ...config, totalCycles: cycles }))}
                className={`${locked ? LOCKED_CLASS : ''} py-1.5 px-1 rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[36px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {cycles}
                {locked && <LockMark />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-semibold text-white">Puzzle Type</span>
        <div className="grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
          {PUZZLE_MODES.map((m) => {
            const active = puzzleMode === m.value;
            const needs = tierFor((a) => a.woodpecker.types, m.value);
            const locked = locks.isLocked(needs);
            return (
              <button
                key={m.value}
                type="button"
                data-testid={`type-${m.value}`}
                aria-pressed={active}
                aria-disabled={locked || undefined}
                title={locked ? unlockHint(tier, needs) : undefined}
                onClick={locks.choose(`The ${m.label} puzzle type`, needs, () => onChange({ ...config, puzzleMode: m.value }))}
                className={`${locked ? LOCKED_CLASS : ''} py-1.5 px-3 rounded-lg text-left transition-all duration-150 cursor-pointer min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="text-sm font-bold leading-tight">{m.label}</div>
                <div className={`text-xs font-semibold mt-0.5 ${active ? 'text-[#101b2f]/75' : 'text-white/60'}`}>
                  {m.hint}
                </div>
                {locked && <LockMark />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Difficulty</span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {[...DIFFICULTIES, MIXED].map((d) => {
            const active = config.difficulty === d.value;
            const needs = tierFor((a) => a.woodpecker.difficulties, d.value);
            const locked = locks.isLocked(needs);
            return (
              <button
                key={d.value}
                type="button"
                data-testid={`difficulty-${d.value}`}
                onClick={locks.choose(`The ${d.label} difficulty`, needs, () => onChange({ ...config, difficulty: d.value }))}
                aria-pressed={active}
                aria-disabled={locked || undefined}
                title={locked ? unlockHint(tier, needs) : undefined}
                className={`${locked ? LOCKED_CLASS : ''} py-1.5 px-3 rounded-xl border text-left transition-all duration-150 cursor-pointer min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  d.value === 'expert' || d.value === 'mixed' ? 'col-span-3' : 'col-span-2'
                } ${
                  active
                    ? 'bg-[#39ff88]/15 border-[#39ff88] text-white'
                    : 'bg-[#101b2f] border-white/10 text-white/90 hover:border-white/40 hover:text-white'
                }`}
              >
                <div className="text-sm font-bold leading-tight">{d.label}</div>
                <div className={`text-xs font-semibold tabular-nums mt-0.5 ${active ? 'text-[#39ff88]' : 'text-white/65'}`}>
                  {d.range}
                </div>
                {locked && <LockMark />}
              </button>
            );
          })}
        </div>
      </div>

      <UnlockNotice notice={locks.notice} />
      <GetPremiumLink tier={tier} />

      {error && (
        <div
          role="alert"
          className="text-sm font-medium text-[#ffd2cc] bg-[#401a22] border border-[#8f3848] rounded-xl px-3.5 py-2.5"
        >
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={loading}
        className={START_BUTTON_CLASS}
      >
        {loading ? `Loading ${puzzleMode === 'classic' ? 'Classic' : 'Endgame'} Set...` : 'Start Training'}
      </button>
    </div>
  );
}

import type {
  CycleCountOption,
  Difficulty,
  PuzzleCountOption,
  PuzzleMode,
  TrainingConfig,
} from '../types';
import { tierFor, unlockHint, type Tier } from '../utils/access';
import { UnlockLinks, LOCKED_CLASS, LockMark, UnlockNotice, useLocks } from './locks';
import { SETUP_CARD_CLASS, SETUP_TEXT_CLASS, START_BUTTON_CLASS } from './panelUi';
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
    <div className={SETUP_CARD_CLASS}>
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">
          Woodpecker Setup
        </h2>
        <p className={`${SETUP_TEXT_CLASS} [@media(max-height:780px)]:hidden`}>
          {puzzleMode === 'classic'
            ? 'Solve the same set of puzzles again and again.'
            : 'Solve the same endgame set again and again.'}
        </p>
        <WoodpeckerExplainer />
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Number of Puzzles</span>
          <span className="text-xs font-semibold text-white/70 tabular-nums">
            {config.puzzleCount} per cycle
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1 bg-[#101b2f] p-1 rounded-xl border border-white/10">
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
                className={`${locked ? LOCKED_CLASS : ''} py-1 px-2 rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[32px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {count}
                {locked && <LockMark small />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Number of Cycles</span>
          <span className="text-xs font-semibold text-white/70 tabular-nums">
            {config.totalCycles} cycles
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1 bg-[#101b2f] p-1 rounded-xl border border-white/10">
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
                className={`${locked ? LOCKED_CLASS : ''} py-1 px-1 rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[32px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {cycles}
                {locked && <LockMark small />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Puzzle Type</span>
          <span className="text-xs font-semibold text-white/70">
            {PUZZLE_MODES.find((m) => m.value === puzzleMode)?.hint}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 bg-[#101b2f] p-1 rounded-xl border border-white/10">
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
                aria-label={`${m.label}: ${m.hint}`}
                title={locked ? unlockHint(tier, needs) : m.hint}
                onClick={locks.choose(`The ${m.label} puzzle type`, needs, () => onChange({ ...config, puzzleMode: m.value }))}
                className={`${locked ? LOCKED_CLASS : ''} py-1 px-2 rounded-lg text-sm font-bold transition-all duration-150 cursor-pointer min-h-[32px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {m.label}
                {locked && <LockMark small />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Difficulty</span>
          <span className="text-xs font-semibold text-white/70 tabular-nums">
            {[...DIFFICULTIES, MIXED].find((d) => d.value === config.difficulty)?.range}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-1 bg-[#101b2f] p-1 rounded-xl border border-white/10">
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
                aria-label={`${d.label}: ${d.range}`}
                title={locked ? unlockHint(tier, needs) : d.range}
                className={`${locked ? LOCKED_CLASS : ''} py-1 px-0.5 rounded-lg text-[13px] font-bold transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[32px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {d.label}
                {locked && <LockMark small />}
              </button>
            );
          })}
        </div>
      </div>

      <UnlockNotice notice={locks.notice} />
      <UnlockLinks tier={tier} />

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

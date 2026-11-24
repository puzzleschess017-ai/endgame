import type {
  CycleCountOption,
  Difficulty,
  PuzzleCountOption,
  PuzzleMode,
  TrainingConfig,
} from '../types';

const PUZZLE_COUNTS: PuzzleCountOption[] = [10, 50, 100, 200];
const CYCLE_COUNTS: CycleCountOption[] = [2, 3, 4, 5, 6, 7];
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
  range: 'All ratings, an even share of each',
};

interface SettingsPanelProps {
  config: TrainingConfig;
  onChange: (next: TrainingConfig) => void;
  onStart: () => void;
  loading: boolean;
  error: string | null;
}

export default function SettingsPanel({
  config,
  onChange,
  onStart,
  loading,
  error,
}: SettingsPanelProps) {
  const puzzleMode: PuzzleMode = config.puzzleMode ?? 'endgame';
  return (
    <div className="bg-[#16233b] border border-white/10 rounded-2xl p-6 flex flex-col gap-6 shadow-[0_16px_44px_rgba(4,9,20,0.45)]">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">
          Woodpecker Setup
        </h2>
        <p className="mt-1.5 text-sm font-medium text-white/75 leading-relaxed">
          {puzzleMode === 'classic'
            ? 'Solve the same set of puzzles of every kind across consecutive cycles to sharpen pattern recognition and calculation speed.'
            : 'Solve the same endgame set across consecutive cycles to sharpen pattern recognition and calculation speed.'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Number of Puzzles</span>
          <span className="text-xs font-semibold text-white/70 tabular-nums">
            {config.puzzleCount} per cycle
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
          {PUZZLE_COUNTS.map((count) => {
            const active = config.puzzleCount === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => onChange({ ...config, puzzleCount: count })}
                className={`py-2 px-2 rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {count}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Number of Cycles</span>
          <span className="text-xs font-semibold text-white/70 tabular-nums">
            {config.totalCycles} cycles
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
          {CYCLE_COUNTS.map((cycles) => {
            const active = config.totalCycles === cycles;
            return (
              <button
                key={cycles}
                type="button"
                onClick={() => onChange({ ...config, totalCycles: cycles })}
                className={`py-2 px-1 rounded-lg text-sm font-bold tabular-nums transition-all duration-150 cursor-pointer whitespace-nowrap min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                {cycles}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-semibold text-white">Puzzle Type</span>
        <div className="grid grid-cols-2 gap-1.5 bg-[#101b2f] p-1.5 rounded-xl border border-white/10">
          {PUZZLE_MODES.map((m) => {
            const active = puzzleMode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...config, puzzleMode: m.value })}
                className={`py-2 px-3 rounded-lg text-left transition-all duration-150 cursor-pointer min-h-[46px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  active
                    ? 'bg-[#39ff88] text-[#101b2f] shadow-sm'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="text-sm font-bold leading-tight">{m.label}</div>
                <div className={`text-xs font-semibold mt-0.5 ${active ? 'text-[#101b2f]/75' : 'text-white/60'}`}>
                  {m.hint}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-white">Difficulty</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[...DIFFICULTIES, MIXED].map((d) => {
            const active = config.difficulty === d.value;
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => onChange({ ...config, difficulty: d.value })}
                aria-pressed={active}
                className={`py-2.5 px-3.5 rounded-xl border text-left transition-all duration-150 cursor-pointer min-h-[46px] focus-visible:outline-2 focus-visible:outline-[#39ff88] ${
                  d.value === 'mixed' ? 'col-span-2' : ''
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
              </button>
            );
          })}
        </div>
      </div>

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
        className="w-full py-3.5 px-5 rounded-xl bg-[#39ff88] hover:bg-[#5cff9d] disabled:opacity-60 disabled:cursor-not-allowed text-[#101b2f] font-bold text-base tracking-tight transition-all duration-150 shadow-[0_6px_20px_rgba(57,255,136,0.22)] cursor-pointer min-h-[48px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#39ff88]"
      >
        {loading ? `Loading ${puzzleMode === 'classic' ? 'Classic' : 'Endgame'} Set...` : 'Start Training'}
      </button>
    </div>
  );
}

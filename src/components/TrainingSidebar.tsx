import { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  RotateCcw,
} from 'lucide-react';
import type { CycleResult, Puzzle, TrainingSession } from '../types';
import { formatDuration } from '../utils/chessHelpers';
import { selectReview, type ReviewItem } from '../utils/review';

interface TrainingSidebarProps {
  session: TrainingSession;
  currentPuzzle: Puzzle;
  playerColor: 'white' | 'black';
  feedback: { type: 'idle' | 'continue' | 'error' | 'solved'; message: string };
  hintActive: boolean;
  onRequestHint: () => void;
  onNextPuzzle: () => void;
  onResetSession: () => void;
  onStartNextCycleNow: () => void;
  onRepeatSameSet: () => void;
  /** Starts a run with only the given puzzles (the missed and the slowest of the last cycle). */
  onStartReview: (items: ReviewItem[]) => void;
  /** Leaves a review for the run it came from: straight into its next cycle (true) or as it was left (false). */
  onResumeAfterReview: (startNext: boolean) => void;
}

export default function TrainingSidebar({
  session,
  currentPuzzle,
  playerColor,
  feedback,
  hintActive,
  onRequestHint,
  onNextPuzzle,
  onResetSession,
  onStartNextCycleNow,
  onRepeatSameSet,
  onStartReview,
  onResumeAfterReview,
}: TrainingSidebarProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const totalPuzzles = session.puzzles.length;
  const attemptedCount = session.cycleCorrect + session.cycleIncorrect;
  const accuracyPct =
    attemptedCount > 0 ? ((session.cycleCorrect / attemptedCount) * 100).toFixed(1) : '0.0';

  if (session.status === 'cycle_complete') {
    const latestResult: CycleResult | undefined =
      session.cycleResults[session.cycleResults.length - 1];
    const nextCycleNum = session.currentCycle + 1;

    return (
      <div className="bg-[#16233b] border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-[0_16px_44px_rgba(4,9,20,0.45)]">
        <div>
          <div className="text-xs font-bold text-[#39ff88] uppercase tracking-wider">
            Cycle Complete
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Cycle {latestResult?.cycleNumber ?? session.currentCycle} of {session.config.totalCycles}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#101b2f] border border-white/10 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-white/70">Correctly Solved</div>
            <div className="text-2xl font-bold text-[#39ff88] tabular-nums mt-0.5">
              {latestResult?.correct ?? session.cycleCorrect}
            </div>
          </div>
          <div className="bg-[#101b2f] border border-white/10 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-white/70">Incorrect</div>
            <div className="text-2xl font-bold text-[#ff7b7b] tabular-nums mt-0.5">
              {latestResult?.incorrect ?? session.cycleIncorrect}
            </div>
          </div>
          <div className="bg-[#101b2f] border border-white/10 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-white/70">Accuracy</div>
            <div className="text-2xl font-bold text-white tabular-nums mt-0.5">
              {(latestResult?.accuracy ?? Number(accuracyPct)).toFixed(1)}%
            </div>
          </div>
          <div className="bg-[#101b2f] border border-white/10 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-white/70">Total Time</div>
            <div className="text-2xl font-bold text-white tabular-nums mt-0.5">
              {formatDuration(latestResult?.totalTimeMs ?? session.cycleElapsedMs)}
            </div>
          </div>
        </div>

        <CycleHistoryTable results={session.cycleResults} />

        <ReviewBox result={latestResult} onStart={onStartReview} midRun />

        <button
          type="button"
          onClick={onStartNextCycleNow}
          data-testid="start-next-cycle"
          className="w-full py-3 px-4 rounded-xl btn-shine bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] font-bold text-sm flex items-center justify-center gap-2 transition-all duration-150 shadow-[0_4px_16px_rgba(57,255,136,0.2)] cursor-pointer min-h-[44px] whitespace-nowrap"
        >
          <span>Start Cycle {nextCycleNum}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (session.status === 'all_complete' && session.review) {
    const result: CycleResult | undefined = session.cycleResults[session.cycleResults.length - 1];
    const parent = session.resume;
    const goOn = parent?.status === 'cycle_complete';

    return (
      <div className="bg-[#16233b] border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-[0_16px_44px_rgba(4,9,20,0.45)]" data-testid="review-complete">
        <div>
          <div className="text-xs font-bold text-[#39ff88] uppercase tracking-wider">Review Complete</div>
          <h2 className="text-xl font-bold text-white mt-1">
            {result ? `${result.correct} of ${result.correct + result.incorrect} solved` : 'Review finished'}
          </h2>
          {parent && (
            <p className="text-sm font-medium text-white/80 mt-1.5">
              This review is not one of your {parent.config.totalCycles} cycles
              {parent.status === 'cycle_complete'
                ? ` (${parent.cycleResults.length} done).`
                : ' (they are all done).'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#101b2f] border border-white/10 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-white/70">Accuracy</div>
            <div className="text-2xl font-bold text-white tabular-nums mt-0.5">{(result?.accuracy ?? 0).toFixed(1)}%</div>
          </div>
          <div className="bg-[#101b2f] border border-white/10 rounded-xl p-3.5">
            <div className="text-xs font-semibold text-white/70">Total Time</div>
            <div className="text-2xl font-bold text-white tabular-nums mt-0.5">{formatDuration(result?.totalTimeMs ?? 0)}</div>
          </div>
        </div>

        <ReviewBox result={result} onStart={onStartReview} />

        <div className="flex flex-col gap-2.5 pt-1">
          {parent && (
            <button
              type="button"
              data-testid="review-resume"
              onClick={() => onResumeAfterReview(true)}
              className="w-full py-3 px-4 rounded-xl btn-shine bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] font-bold text-sm flex items-center justify-center gap-2 transition-all duration-150 shadow-[0_4px_16px_rgba(57,255,136,0.2)] cursor-pointer min-h-[44px]"
            >
              <span>
                {goOn
                  ? `Continue with Cycle ${parent.currentCycle + 1} of ${parent.config.totalCycles}`
                  : 'Back to your results'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onResetSession}
            className="w-full py-3 px-4 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white text-white text-sm font-semibold transition-all duration-150 cursor-pointer min-h-[44px]"
          >
            {parent ? 'End Training & New Settings' : 'New Settings'}
          </button>
        </div>
      </div>
    );
  }

  if (session.status === 'all_complete') {
    const first = session.cycleResults[0];
    const last = session.cycleResults[session.cycleResults.length - 1];

    return (
      <div className="bg-[#16233b] border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-[0_16px_44px_rgba(4,9,20,0.45)]">
        <div>
          <div className="text-xs font-bold text-[#39ff88] uppercase tracking-wider">
            Training Complete
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            All {session.config.totalCycles} Cycles Finished
          </h2>
          {first && last && session.cycleResults.length > 1 && (
            <p className="text-sm font-medium text-white/80 mt-1.5 tabular-nums">
              Time changed from {formatDuration(first.totalTimeMs)} (Cycle 1) to{' '}
              {formatDuration(last.totalTimeMs)} (Cycle {last.cycleNumber}).
            </p>
          )}
        </div>

        <CycleHistoryTable results={session.cycleResults} />

        <ReviewBox result={last} onStart={onStartReview} />

        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            onClick={onRepeatSameSet}
            className="w-full py-3 px-4 rounded-xl btn-shine bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] font-bold text-sm transition-all duration-150 shadow-[0_4px_16px_rgba(57,255,136,0.2)] cursor-pointer min-h-[44px]"
          >
            Repeat Same Puzzle Set
          </button>
          <button
            type="button"
            onClick={onResetSession}
            className="w-full py-3 px-4 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white text-white text-sm font-semibold transition-all duration-150 cursor-pointer min-h-[44px]"
          >
            New Settings
          </button>
        </div>
      </div>
    );
  }

  // Active training view
  const cycleNumbers = Array.from({ length: session.config.totalCycles }, (_, i) => i + 1);
  const puzzleSolved = feedback.type === 'solved';

  return (
    <div className="bg-[#16233b] border border-white/10 rounded-2xl p-5 flex flex-col gap-4 shadow-[0_16px_44px_rgba(4,9,20,0.45)]">
      {/* Cycle Progress Strip */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-white tabular-nums">
            Cycle {session.currentCycle} of {session.config.totalCycles}
            {session.review && <span className="ml-2 text-xs font-bold text-[#39ff88] uppercase tracking-wider">Review</span>}
          </span>
          <span className="font-semibold text-white/80 tabular-nums">
            Puzzle {session.currentPuzzleIndex + 1} / {totalPuzzles}
          </span>
        </div>

        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${session.config.totalCycles}, minmax(0, 1fr))` }}
          aria-label="Cycle progress"
        >
          {cycleNumbers.map((c) => {
            const isCompleted = c < session.currentCycle;
            const isCurrent = c === session.currentCycle;
            const pct = isCurrent
              ? Math.round((session.currentPuzzleIndex / totalPuzzles) * 100)
              : isCompleted
                ? 100
                : 0;
            return (
              <div
                key={c}
                className="h-2 rounded-full bg-[#101b2f] overflow-hidden"
                title={`Cycle ${c}`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-200 ${
                    isCompleted || isCurrent ? 'bg-[#39ff88]' : 'bg-transparent'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Turn & Move Feedback Banner */}
      <div
        role="status"
        aria-live="polite"
        className={`rounded-xl px-3.5 py-2.5 border text-sm flex items-center gap-2.5 min-h-[46px] ${
          feedback.type === 'error'
            ? 'bg-[#401a22] border-[#8f3848] text-[#ffd2cc]'
            : feedback.type === 'solved' || feedback.type === 'continue'
              ? 'bg-[#39ff88]/12 border-[#39ff88]/60 text-white'
              : 'bg-[#101b2f] border-white/10 text-white'
        }`}
      >
        {feedback.type === 'error' ? (
          <AlertCircle className="w-4 h-4 shrink-0 text-[#ff7b7b]" />
        ) : feedback.type === 'solved' || feedback.type === 'continue' ? (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#39ff88]" />
        ) : (
          <span
            className={`w-3.5 h-3.5 rounded-sm shrink-0 border ${
              playerColor === 'white'
                ? 'bg-white border-white/80'
                : 'bg-[#101b2f] border-white/60'
            }`}
            aria-hidden="true"
          />
        )}
        <span className="font-semibold leading-snug">{feedback.message}</span>
      </div>

      {/* Live Statistics */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#101b2f] border border-white/10 rounded-xl px-3 py-2.5">
          <div className="text-[11px] font-semibold text-white/70">Correct</div>
          <div className="text-lg font-bold text-[#39ff88] tabular-nums mt-0.5">
            {session.cycleCorrect}
          </div>
        </div>
        <div className="bg-[#101b2f] border border-white/10 rounded-xl px-3 py-2.5">
          <div className="text-[11px] font-semibold text-white/70">Incorrect</div>
          <div className="text-lg font-bold text-[#ff7b7b] tabular-nums mt-0.5">
            {session.cycleIncorrect}
          </div>
        </div>
        <div className="bg-[#101b2f] border border-white/10 rounded-xl px-3 py-2.5">
          <div className="text-[11px] font-semibold text-white/70">Accuracy</div>
          <div className="text-lg font-bold text-white tabular-nums mt-0.5">
            {accuracyPct}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-[#101b2f] border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-white/70">Puzzle Time</span>
          <span className="text-sm font-bold text-white tabular-nums">
            {formatDuration(session.puzzleElapsedMs)}
          </span>
        </div>
        <div className="bg-[#101b2f] border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold text-white/70">Cycle Time</span>
          <span className="text-sm font-bold text-white tabular-nums">
            {formatDuration(session.cycleElapsedMs)}
          </span>
        </div>
      </div>

      {session.cycleResults.length > 0 && <CycleHistoryTable results={session.cycleResults} />}

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {!puzzleSolved && (
          <button
            type="button"
            onClick={onRequestHint}
            disabled={hintActive}
            title="Using the arrow counts this puzzle as incorrect"
            className="flex-1 py-2.5 px-3.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            <Eye className="w-4 h-4" />
            <span>{hintActive ? 'Arrow Shown' : 'Show Arrow'}</span>
          </button>
        )}

        {(puzzleSolved || session.currentPuzzleFailed) && (
          <button
            type="button"
            onClick={onNextPuzzle}
            className="flex-1 py-2.5 px-3.5 rounded-xl btn-still bg-[#39ff88] hover:bg-[#5cff9d] text-[#101b2f] text-sm font-bold flex items-center justify-center gap-1.5 transition-all duration-150 shadow-[0_4px_14px_rgba(57,255,136,0.2)] cursor-pointer min-h-[42px] whitespace-nowrap"
          >
            <span>Next Puzzle</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {session.review && session.resume && (
        <button
          type="button"
          data-testid="review-leave"
          onClick={() => onResumeAfterReview(false)}
          className="w-full py-2.5 px-3.5 rounded-xl bg-[#101b2f] border border-white/20 hover:border-white text-white text-sm font-semibold cursor-pointer min-h-[42px]"
        >
          Leave review and go back to your cycles
        </button>
      )}

      <div className="border-t border-white/10 pt-3 flex items-center justify-between">
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="text-xs font-semibold text-white/75 hover:text-white flex items-center gap-1.5 py-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>End Session &amp; Change Settings</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 w-full justify-between">
            <span className="text-xs font-semibold text-[#ffd2cc]">End current training?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetSession();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#8f3848] hover:bg-[#a94255] text-white cursor-pointer"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#101b2f] border border-white/20 text-white cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CycleHistoryTable({ results }: { results: CycleResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-[#101b2f]">
      <table className="w-full text-xs text-left">
        <thead className="bg-[#132038] text-white/70 border-b border-white/10">
          <tr>
            <th className="py-2.5 px-3 font-semibold">Cycle</th>
            <th className="py-2.5 px-3 font-semibold">Score</th>
            <th className="py-2.5 px-3 font-semibold">Accuracy</th>
            <th className="py-2.5 px-3 font-semibold text-right">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 tabular-nums font-medium">
          {results.map((r) => (
            <tr key={r.cycleNumber} className="text-white">
              <td className="py-2 px-3 font-bold">#{r.cycleNumber}</td>
              <td className="py-2 px-3">
                {r.correct}/{r.correct + r.incorrect}
              </td>
              <td className="py-2 px-3">{r.accuracy.toFixed(1)}%</td>
              <td className="py-2 px-3 text-right">{formatDuration(r.totalTimeMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The missed and the slowest puzzles of a cycle, with a button to practise only them. */
function ReviewBox({ result, onStart, midRun }: { result: CycleResult | undefined; onStart: (items: ReviewItem[]) => void; midRun?: boolean }) {
  const review = selectReview(result?.attempts);
  if (review.items.length === 0) return null;
  const slowest = review.items.filter((i) => i.reason === 'slow').reduce((m, i) => Math.max(m, i.ms), 0);
  const parts = [
    review.missed > 0 ? `${review.missed} missed` : 'No puzzle missed',
    review.slow > 0 ? `${review.slow} slowest (up to ${formatDuration(slowest)})` : '',
  ].filter(Boolean);
  return (
    <div data-testid="review-box" className="rounded-xl border border-white/10 bg-[#101b2f] p-3.5 flex flex-col gap-2">
      <div className="text-sm font-bold text-white">Review</div>
      <p className="text-[13px] font-medium text-white/80 leading-snug tabular-nums">{parts.join(' · ')}</p>
      <button
        type="button"
        data-testid="review-start"
        onClick={() => onStart(review.items)}
        className="w-full py-2.5 px-3.5 rounded-xl bg-[#16233b] border border-[#39ff88]/60 hover:border-[#39ff88] text-white text-sm font-bold cursor-pointer min-h-[42px]"
      >
        Practise these {review.items.length}
        {midRun ? ' now' : ''}
      </button>
      {midRun && <p className="text-xs font-medium text-white/60">One cycle, then you go on with your cycles.</p>}
    </div>
  );
}

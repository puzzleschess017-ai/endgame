// The position on the board before a run starts. Each mode has one of its own that always stays the same, and the
// three differ, so Woodpecker, Puzzle Streak and Puzzle Survival do not look alike. (Blindfold starts with an empty board.)
// All are ordinary positions that are not over: both kings, the side to move is not in check.
export type PreviewMode = 'woodpecker' | 'streak' | 'survival';

export const PREVIEW_BY_MODE: Readonly<Record<PreviewMode, string>> = {
  // a rook ending, the kind of position Woodpecker trains
  woodpecker: '2r3k1/5pp1/p3p2p/1p6/1P2P3/P4P2/5KPP/3R4 w - - 0 1',
  // an open Sicilian middlegame
  streak: 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5',
  // the Italian game
  survival: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
};

/** The position the board of a mode shows while it waits for a run to start. */
export function previewFen(mode: PreviewMode): string {
  return PREVIEW_BY_MODE[mode];
}

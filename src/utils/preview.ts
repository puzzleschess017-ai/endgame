// The position on the board before a run starts (Woodpecker, Puzzle Streak, Puzzle Survival, Blindfold). It used to be the
// same one every time; now one of these is picked each time the page opens, so the board looks different on every visit.
// All of them are ordinary positions that are not over: both kings, the side to move is not in check.
export const PREVIEW_FENS: readonly string[] = [
  '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
  'r3k2r/pppq1ppp/2n1bn2/3pp3/3PP3/2N1BN2/PPPQ1PPP/R3K2R w KQkq - 0 1',
  'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
  '2r3k1/5pp1/p3p2p/1p6/1P2P3/P4P2/5KPP/3R4 w - - 0 1',
  '3r2k1/1p3ppp/p7/8/8/P3Q3/1P3PPP/6K1 w - - 0 1',
  '8/5pk1/6p1/7p/7P/6P1/5PK1/8 w - - 0 1',
  '8/8/4k3/8/4PK2/8/8/8 w - - 0 1',
  'r1bq1rk1/ppp2ppp/2n1bn2/3pp3/1b2P3/2NP1N2/PPP1BPPP/R1BQ1RK1 w - - 0 1',
  '4r1k1/pp3ppp/2n5/3p4/3P1B2/2P2N2/PP3PPP/4R1K1 w - - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR w KQkq - 0 2',
  '3k4/8/3K4/3P4/8/8/8/8 w - - 0 1',
  'r4rk1/1pp2ppp/p1n1bn2/4p3/4P3/1BN1BN2/PPP2PPP/2KR3R w - - 0 1',
];

/** A position for the board that waits for a run to start; never `not` the one just shown, when that is given. */
export function randomPreviewFen(not?: string): string {
  const options = PREVIEW_FENS.filter((fen) => fen !== not);
  return options[Math.floor(Math.random() * options.length)];
}

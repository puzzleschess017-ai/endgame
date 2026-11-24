/** The four rating bands; `mixed` takes puzzles from all of them. */
export type RatingBand = 'easy' | 'medium' | 'hard' | 'expert';
export type Difficulty = RatingBand | 'mixed';

export type PuzzleCountOption = 10 | 50 | 100 | 200;

export type CycleCountOption = 2 | 3 | 4 | 5 | 6 | 7;

export interface Puzzle {
  puzzleId: string;
  fen: string;
  moves: string[];
  rating: number;
  ratingDeviation: number;
  popularity: number;
  themes: string[];
  numMoves: number;
}

export interface CycleResult {
  cycleNumber: number;
  correct: number;
  incorrect: number;
  totalTimeMs: number;
  accuracy: number;
  completedAt: number;
}

/** Where a Woodpecker set comes from: puzzles of every kind, or real endgames only. */
export type PuzzleMode = 'classic' | 'endgame';

export interface TrainingConfig {
  puzzleCount: PuzzleCountOption;
  totalCycles: CycleCountOption;
  /** Missing in sessions saved before Classic existed, which were all endgame sets. */
  puzzleMode?: PuzzleMode;
  difficulty: Difficulty;
}

export type SessionStatus = 'training' | 'cycle_complete' | 'all_complete';

export interface TrainingSession {
  id: string;
  config: TrainingConfig;
  puzzles: Puzzle[];
  currentCycle: number;
  currentPuzzleIndex: number;
  cycleCorrect: number;
  cycleIncorrect: number;
  cycleElapsedMs: number;
  puzzleElapsedMs: number;
  currentPuzzleFailed: boolean;
  status: SessionStatus;
  cycleResults: CycleResult[];
}

export interface DatabaseStats {
  totalPuzzles: number;
  dbSizeBytes: number;
  byDifficulty: Record<RatingBand, number>;
  byTheme: Record<string, number>;
}

export type BoardTheme = 'green' | 'brown' | 'maple' | 'blue' | 'purple' | 'grey' | 'pink';

export type PieceSet = 'merida' | 'cburnett' | 'alpha' | 'staunty' | 'chessnut' | 'neo';

export interface AppearanceSettings {
  boardSize: number;
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
}


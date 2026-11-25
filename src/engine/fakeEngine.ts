// A pretend engine for tests: answers the UCI commands like Stockfish would, with a made-up score that depends
// on the position, so the screens and the client can be tested without downloading the real engine.
import type { EngineWorker } from './client.ts';

export interface FakeEngineOptions {
  /** Milliseconds between two depths. */
  stepMs?: number;
  /** Positions with this text in the FEN never get an answer (to test waiting and stopping). */
  silentFor?: string;
  /** The moves of the best line, as "e2e4 e7e5"; default depends on the side to move. */
  pv?: string;
  /** Centipawns for the side to move (default 34). */
  cp?: number;
  /** Mate score for the side to move; replaces cp. */
  mate?: number;
  fail?: boolean;
}

export function createFakeEngine(options: FakeEngineOptions = {}): EngineWorker & { log: string[] } {
  const stepMs = options.stepMs ?? 5;
  const log: string[] = [];
  let fen = '';
  let multipv = 1;
  let timer: ReturnType<typeof setInterval> | null = null;
  const worker: EngineWorker & { log: string[] } = {
    log,
    onmessage: null,
    onerror: null,
    terminate() {
      if (timer) clearInterval(timer);
    },
    postMessage(message: string) {
      log.push(message);
      const reply = (line: string) => setTimeout(() => worker.onmessage?.({ data: line }), 0);
      if (message === 'uci') reply('uciok');
      else if (message === 'isready') reply('readyok');
      else if (message.startsWith('setoption name MultiPV value ')) multipv = Number(message.split(' ').pop());
      else if (message.startsWith('position fen ')) fen = message.slice('position fen '.length);
      else if (message === 'stop') {
        if (timer) clearInterval(timer);
        timer = null;
        reply('bestmove e2e4');
      } else if (message.startsWith('go depth ')) {
        const target = Number(message.split(' ')[2]);
        if (options.silentFor && fen.includes(options.silentFor)) return;
        const black = fen.split(' ')[1] === 'b';
        const best = options.pv ?? (black ? 'e7e5 g1f3 b8c6' : 'e2e4 e7e5 g1f3');
        let depth = 0;
        timer = setInterval(() => {
          depth += 1;
          for (let line = 1; line <= multipv; line++) {
            const score = options.mate !== undefined ? `mate ${options.mate}` : `cp ${(options.cp ?? 34) - (line - 1) * 20}`;
            const moves = line === 1 ? best : black ? 'd7d5 e2e3' : 'd2d4 d7d5';
            worker.onmessage?.({ data: `info depth ${depth} seldepth ${depth + 2} multipv ${line} score ${score} nodes ${depth * 1000} pv ${moves}` });
          }
          if (depth >= target) {
            if (timer) clearInterval(timer);
            timer = null;
            worker.onmessage?.({ data: `bestmove ${best.split(' ')[0]}` });
          }
        }, stepMs);
      }
    },
  };
  return worker;
}

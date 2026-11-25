import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { UciEngine, EngineMissingError, type WorkerFactory } from '../engine/client';
import { forWhite, type EngineLine } from '../engine/uci';

/** How deep the engine searches. Deep enough to be useful, shallow enough to finish in seconds in the browser. */
export const ENGINE_DEPTH = 18;

export type EngineStatus = 'off' | 'loading' | 'thinking' | 'done' | 'over' | 'missing' | 'error';

export interface EngineState {
  status: EngineStatus;
  /** Lines seen from White's side (positive = good for White), best first. */
  lines: EngineLine[];
  depth: number;
}

const IDLE: EngineState = { status: 'off', lines: [], depth: 0 };

/**
 * Runs the engine on `fen` while `enabled`. The engine files are only downloaded the first time it is switched
 * on, and the engine is closed when the page is left. Switching it off stops the search.
 */
export function useEngine(enabled: boolean, fen: string, factory?: WorkerFactory): EngineState {
  const [state, setState] = useState<EngineState>(IDLE);
  const engine = useRef<UciEngine | null>(null);
  const starting = useRef<Promise<void> | null>(null);

  useEffect(() => () => {
    engine.current?.dispose();
    engine.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      engine.current?.stop();
      setState(IDLE);
      return;
    }
    let cancelled = false;

    let turn: 'w' | 'b' = 'w';
    let over = false;
    try {
      const chess = new Chess(fen);
      turn = chess.turn();
      over = chess.isGameOver();
    } catch {
      setState({ status: 'error', lines: [], depth: 0 });
      return;
    }
    if (over) {
      engine.current?.stop();
      setState({ status: 'over', lines: [], depth: 0 });
      return;
    }

    if (!engine.current) engine.current = new UciEngine(factory);
    const current = engine.current;
    setState((s) => ({ status: s.lines.length > 0 ? 'thinking' : 'loading', lines: [], depth: 0 }));
    if (!starting.current) {
      starting.current = current.start().catch((error) => {
        starting.current = null;
        throw error;
      });
    }
    starting.current.then(
      () => {
        if (cancelled) return;
        setState({ status: 'thinking', lines: [], depth: 0 });
        current.analyse(fen, ENGINE_DEPTH, (update) => {
          if (cancelled) return;
          setState({
            status: update.done ? 'done' : 'thinking',
            lines: update.lines.map((line) => forWhite(line, turn)),
            depth: update.depth,
          });
        });
      },
      (error) => {
        if (cancelled) return;
        setState({ status: error instanceof EngineMissingError ? 'missing' : 'error', lines: [], depth: 0 });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, fen, factory]);

  return enabled ? state : IDLE;
}

// Talks to a chess engine running in a Web Worker (Stockfish), one search at a time. The worker is created
// by a factory, so tests can use a fake engine and the real one is only downloaded when it is first needed.
import { parseBestMove, parseInfo, type EngineLine } from './uci.ts';

export interface EngineWorker {
  postMessage(message: string): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type WorkerFactory = () => Promise<EngineWorker>;

/** The engine files are not on this server (the server was set up without them). */
export class EngineMissingError extends Error {
  constructor() {
    super('The engine is not installed on this server yet.');
    this.name = 'EngineMissingError';
  }
}

export interface SearchUpdate {
  /** The lines found so far, best first, all of the same depth. */
  lines: EngineLine[];
  depth: number;
  /** True after the search reached its depth (or ended because the game is over). */
  done: boolean;
}

interface Request {
  fen: string;
  depth: number;
  onUpdate: (update: SearchUpdate) => void;
}

/** Files of the engine, written by scripts/copy-engine.mjs when the server is set up. */
export interface EngineManifest {
  js: string;
  wasm: string;
}

export async function defaultWorkerFactory(): Promise<EngineWorker> {
  let manifest: EngineManifest;
  try {
    const response = await fetch('/engine/manifest.json', { cache: 'no-cache' });
    if (!response.ok) throw new EngineMissingError();
    manifest = (await response.json()) as EngineManifest;
  } catch (error) {
    throw error instanceof EngineMissingError ? error : new EngineMissingError();
  }
  if (typeof manifest.js !== 'string' || typeof manifest.wasm !== 'string') throw new EngineMissingError();
  // The page of the worker names its own .wasm file after a "#".
  return new Worker(`/engine/${manifest.js}#${manifest.wasm}`) as unknown as EngineWorker;
}

export class UciEngine {
  private worker: EngineWorker | null = null;
  private ready: Promise<void> | null = null;
  private disposed = false;
  /** A search is running in the engine (it has not sent its "bestmove" yet). */
  private busy = false;
  /** The running search was stopped and its output must be ignored until its "bestmove". */
  private stopping = false;
  private current: Request | null = null;
  private waiting: Request | null = null;
  private found = new Map<number, EngineLine>();
  private waiters: Array<(line: string) => boolean> = [];

  constructor(
    private readonly factory: WorkerFactory = defaultWorkerFactory,
    private readonly multiPv = 3,
  ) {}

  /** Starts the worker and waits until the engine is ready. Safe to call again. */
  start(): Promise<void> {
    if (!this.ready) {
      this.ready = this.boot().catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }

  private async boot(): Promise<void> {
    const worker = await this.factory();
    if (this.disposed) {
      worker.terminate();
      return;
    }
    this.worker = worker;
    worker.onmessage = (event) => this.onLine(String(event.data));
    worker.onerror = () => {
      this.waiters = [];
    };
    this.send('uci');
    await this.waitFor((line) => line === 'uciok');
    this.send(`setoption name MultiPV value ${this.multiPv}`);
    this.send('isready');
    await this.waitFor((line) => line === 'readyok');
  }

  private send(message: string) {
    this.worker?.postMessage(message);
  }

  private waitFor(match: (line: string) => boolean, timeoutMs = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The engine did not answer.')), timeoutMs);
      this.waiters.push((line) => {
        if (!match(line)) return false;
        clearTimeout(timer);
        resolve();
        return true;
      });
    });
  }

  private onLine(line: string) {
    const trimmed = line.trim();
    if (this.waiters.length > 0) {
      this.waiters = this.waiters.filter((waiter) => !waiter(trimmed));
    }
    if (trimmed.startsWith('bestmove')) {
      parseBestMove(trimmed); // the answer itself is not needed: the lines already hold it
      this.busy = false;
      const finished = this.current;
      const wasStopped = this.stopping;
      this.stopping = false;
      this.current = null;
      if (this.waiting) {
        const next = this.waiting;
        this.waiting = null;
        this.begin(next);
      } else if (finished && !wasStopped) {
        finished.onUpdate({ lines: this.sortedLines(), depth: this.deepest(), done: true });
      }
      return;
    }
    if (!this.current || this.stopping) return;
    const info = parseInfo(trimmed);
    if (!info) return;
    // A new depth starts a new set of lines: forget the shallower ones.
    const deepest = this.deepest();
    if (info.depth > deepest) this.found.clear();
    else if (info.depth < deepest) return;
    this.found.set(info.multipv, info);
    this.current.onUpdate({ lines: this.sortedLines(), depth: info.depth, done: false });
  }

  private sortedLines(): EngineLine[] {
    return [...this.found.values()].sort((a, b) => a.multipv - b.multipv);
  }

  private deepest(): number {
    let depth = 0;
    for (const line of this.found.values()) depth = Math.max(depth, line.depth);
    return depth;
  }

  private begin(request: Request) {
    this.current = request;
    this.busy = true;
    this.found = new Map();
    this.send(`position fen ${request.fen}`);
    this.send(`go depth ${request.depth}`);
  }

  /**
   * Searches a position. A search that is running is stopped first. `onUpdate` is called with better and better
   * lines and a last time with `done: true`. Wait for `start()` before the first call.
   */
  analyse(fen: string, depth: number, onUpdate: (update: SearchUpdate) => void): void {
    if (this.disposed || !this.worker) return;
    const request: Request = { fen, depth, onUpdate };
    if (this.busy) {
      this.waiting = request;
      if (!this.stopping) {
        this.stopping = true;
        this.send('stop');
      }
      return;
    }
    this.begin(request);
  }

  /** Stops the search (the engine keeps running, ready for the next one). */
  stop(): void {
    this.waiting = null;
    if (this.busy && !this.stopping) {
      this.stopping = true;
      this.send('stop');
    }
  }

  dispose(): void {
    this.disposed = true;
    this.waiting = null;
    this.current = null;
    this.waiters = [];
    this.worker?.terminate();
    this.worker = null;
  }
}

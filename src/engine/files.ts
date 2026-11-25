// Which files of the "stockfish" npm package the website serves. The package holds several builds (strong or
// light, one thread or many); the site uses the light single-thread one, which is small and needs no special
// server settings. Pure, so it is tested; scripts/copy-engine.mjs does the copying.

export interface FoundFile {
  /** Path relative to the package folder, with "/" separators. */
  path: string;
  size: number;
}

export interface PickedEngine {
  js: string;
  wasm: string;
}

const base = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const stem = (name: string) => name.replace(/\.(js|wasm)$/i, '');

function rank(name: string): number {
  const n = name.toLowerCase();
  let score = 0;
  if (n.includes('single')) score += 4;
  if (n.includes('lite')) score += 2;
  // Builds that need several threads and special server headers are never used.
  if (/multi|thread|mt\b/.test(n.replace('single', ''))) score -= 10;
  return score;
}

/** The JavaScript file and its WebAssembly file (same name) of the build to serve, or null when there is none. */
export function pickEngine(files: FoundFile[]): PickedEngine | null {
  const wasmByStem = new Map<string, FoundFile>();
  for (const f of files) if (f.path.toLowerCase().endsWith('.wasm')) wasmByStem.set(stem(base(f.path)), f);
  const candidates = files
    .filter((f) => f.path.toLowerCase().endsWith('.js') && !f.path.toLowerCase().endsWith('.min.js'))
    .map((f) => ({ file: f, wasm: wasmByStem.get(stem(base(f.path))) }))
    .filter((c): c is { file: FoundFile; wasm: FoundFile } => !!c.wasm)
    .map((c) => ({ ...c, score: rank(base(c.file.path)) }))
    // Best build first; of equal ones the smaller download.
    .sort((a, b) => b.score - a.score || a.wasm.size - b.wasm.size);
  const best = candidates[0];
  if (!best || best.score < 0) return null;
  return { js: best.file.path, wasm: best.wasm.path };
}

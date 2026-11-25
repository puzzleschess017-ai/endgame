// Copies the chess engine (Stockfish, from the "stockfish" npm package) into public/engine, where the website
// serves it, and writes public/engine/manifest.json for the page. Runs after "npm install" and before the build.
// It never fails: without the package the site simply has no engine ("Check with engine" says so).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.ENGINE_SOURCE ?? path.join(root, 'node_modules', 'stockfish');
const target = path.join(root, 'public', 'engine');

function walk(dir, depth = 0) {
  const out = [];
  if (depth > 4) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, depth + 1));
    else if (entry.isFile()) out.push({ path: path.relative(source, full).split(path.sep).join('/'), size: fs.statSync(full).size });
  }
  return out;
}

try {
  // Loaded here, so that a problem with it can never stop an install or a build.
  const { pickEngine } = await import('../src/engine/files.ts');
  fs.rmSync(target, { recursive: true, force: true });
  if (!fs.existsSync(source)) {
    console.log('[engine] the "stockfish" package is not installed: the site will have no engine.');
  } else {
    const picked = pickEngine(walk(source));
    if (!picked) {
      console.log('[engine] no usable single-thread build found in the "stockfish" package: the site will have no engine.');
    } else {
      fs.mkdirSync(target, { recursive: true });
      const js = path.basename(picked.js);
      const wasm = path.basename(picked.wasm);
      fs.copyFileSync(path.join(source, picked.js), path.join(target, js));
      fs.copyFileSync(path.join(source, picked.wasm), path.join(target, wasm));
      fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify({ js, wasm }));
      const mb = (fs.statSync(path.join(target, wasm)).size / 1e6).toFixed(1);
      console.log(`[engine] serving ${js} (${mb} MB of WebAssembly)`);
    }
  }
} catch (error) {
  console.log(`[engine] could not copy the engine: ${error instanceof Error ? error.message : error}`);
}

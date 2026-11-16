// SIMMER & SERVE — entrypoint for the make.fun best-game-01 round 3 entry.
//
// What this script does, in plain terms: it stages the finished game for
// the judge. The game itself lives in the game/ folder next to this file
// (plain static files: game/index.html plus its ES modules, no libraries,
// no network calls), and the screenshots live in screenshots/. This script
// copies both folders into the output directory, then asks the vendored
// make.fun helper to write dossier.json there — the summary the scorer
// reads (file inventory, sizes, screenshot list, and the caps the entry
// was checked against).
//
// Run it locally with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// Inside the grader's container the output directory is /output, which is
// the default when MAKEFUN_OUTPUT_DIR is not set. Only the Node standard
// library is used here, plus the vendored helper in ./vendor/.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's limits for this round. They are passed straight through to
// buildDossier, which refuses an entry that breaks them instead of handing
// the judge something it would reject: at most 4 screenshots, each at most
// 256 KiB; at most 993 files inside game/ totalling at most 48 MiB; no path
// under game/ longer than 1000 bytes; and the text budget of 160 KiB that
// shapes the dossier bytes themselves.
const SCORER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Where this file lives, and where the staged entry goes.
const SOURCE_DIR = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function copyFolder(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}

function countFiles(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return total;
}

function stageGame(): void {
  const gameSource = join(SOURCE_DIR, 'game');
  const shotsSource = join(SOURCE_DIR, 'screenshots');

  // The entry is not shippable without its front door. Fail loudly here,
  // before anything is copied, rather than staging a broken game.
  if (!existsSync(join(gameSource, 'index.html'))) {
    throw new Error(`game/index.html not found next to main.ts (${gameSource})`);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  copyFolder(gameSource, join(OUTPUT_DIR, 'game'));

  // Screenshots are optional for the copy step but expected by the entry:
  // the folder is always created so the layout is stable, and its contents
  // are copied when the folder exists beside this file.
  const shotsTarget = join(OUTPUT_DIR, 'screenshots');
  mkdirSync(shotsTarget, { recursive: true });
  if (existsSync(shotsSource)) {
    cpSync(shotsSource, shotsTarget, { recursive: true });
  }
}

function writeDossier(): string {
  const dossier = buildDossier(OUTPUT_DIR, SCORER_CAPS);
  const dossierPath = join(OUTPUT_DIR, 'dossier.json');
  writeFileSync(dossierPath, dossier);
  return dossierPath;
}

stageGame();
const dossierPath = writeDossier();
console.log(
  `Simmer & Serve staged: ${countFiles(join(OUTPUT_DIR, 'game'))} game files, dossier at ${dossierPath}`,
);

// Meridian Heat — the hand-in program for make.fun gta6-01 ("Make GTA 6").
// Node 22, standard library only. It takes the game and its screenshots from
// beside this file and lays them out in the output directory exactly as the
// sealed scorer expects: game/ and screenshots/ copied whole, plus a dossier
// written by the vendored make.fun library (vendor/makefun-game.ts), which the
// gate rebuilds and compares byte for byte.
//
// The output directory is /output inside the grader. Anywhere else, the
// MAKEFUN_OUTPUT_DIR environment variable stands in for it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run is deterministic: the same repository always writes the same bytes,
// so the grader's two runs of this program agree with each other.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The repository root: the directory that holds this file.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from an empty output directory so a stale file from an earlier run
// can never leak into the hand-in.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

// The playable game: plain static files, game/index.html at its root.
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });

// The screenshots of the game itself; the first by name is the cover.
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier the judge reads, built from exactly the files just copied.
// The caps are the scorer's own (reference/gate.json): the text cap shapes the
// bytes; the others refuse an entry the scorer would refuse — more than 4
// screenshots, one over 256 KiB, more than 993 files in game/, 48 MiB of game
// files in all, or a path under game/ over 1000 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

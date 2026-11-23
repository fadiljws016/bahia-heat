// Bahia Heat — the entry program for make.fun's "Make GTA 6" bounty
// (gta6-01). This file is deliberately boring: the game itself lives in
// game/ as plain static files (index.html, the ES modules in game/src/,
// the vendored three.js build in game/vendor/) and the maker's four
// screenshots live in screenshots/. The program copies both into the
// output directory and then asks the kit's own dossier builder
// (vendor/makefun-game.ts) to summarise what it shipped into
// dossier.json — the document the bounty judge reads.
//
// The game it ships: an original open-world crime game set in Puerto
// Alba — a full island city with six named districts, a story chain of
// jobs for Marisol "La Jefa" Quintana, PAPD cruisers and foot officers,
// the FALCON-1 air unit, modelled weapons with real crossfire gunfights
// whose flashes stay at the muzzles, gun smoke in warm greys, a painted
// city chart with a working route finder, and district signs over the
// streets, the MARINA ALTA fascia sized to sit whole inside the cover
// frame.
//
// Run it the way the grader does (Node 22, standard library only):
//   node main.ts                         -> writes to /output
//   MAKEFUN_OUTPUT_DIR=out node main.ts  -> writes to ./out (dry run)
// To play instead: `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Address everything from this file's own folder, so the program works
// no matter which directory the grader invokes it from.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game first, then the screenshots; both target folders are created
// because /output starts empty in the grader.
mkdirSync(join(outputDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own limits for this bounty, passed through
// unchanged: the judge's text view is capped at 160 KiB, screenshots are
// at most four files of at most 256 KiB each, and game/ may hold at most
// 993 entries totalling 48 MiB with no path longer than 1000 bytes.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);

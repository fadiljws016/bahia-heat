// Bahia Heat — entry program for the make.fun "Make GTA 6" bounty (gta6-01).
// Round six changes nothing here: the fascia headroom (city.js) and the
// combat camera (shots.js) live in the game files this program copies,
// and the dossier it writes summarises them exactly as before.
// Round seven changes nothing here either: the mirrored combat seat,
// the thinned staged volley and the re-spread PAPD line all live in
// shots.js, inside the game files this program copies.
// Round eight changes nothing here again: FALCON-1 shown in full over
// the chase, a sixth staged officer and the runner's stepped-out
// stance all live in shots.js and helicopter.js, inside the game
// files this program copies, and the dossier summarises them as
// before.
//
// What this file does, and all it does: it takes the finished game that lives
// in the game/ folder next to this file (plain static files: index.html, ES
// modules under game/src/, and the vendored three.js build under
// game/vendor/), plus the maker's screenshots in screenshots/, copies both
// into the output directory, and writes dossier.json there — the summary the
// bounty judge reads — using the kit's own dossier builder from
// vendor/makefun-game.ts. The game it ships is the round-five build:
// modelled weapons and real crossfire gunfights whose flashes stay at the
// muzzles, painted ground under the whole city, a filmic colour grade, and
// the districts naming themselves on signs over the streets — the MARINA
// ALTA fascia sized to sit whole inside the cover frame, gun smoke in
// warm greys instead of white, and a staged cast whose every gun points
// the way its owner faces (measured, not eyeballed).
//
// Run it the way the grader does (Node 22, standard library only, no install):
//   node main.ts                        -> writes to /output
//   MAKEFUN_OUTPUT_DIR=out node main.ts  -> writes to ./out (local dry run)
//
// To play the game itself instead: `node serve.ts`, then open
// http://localhost:8080 in a desktop browser.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The folder this program sits in is the repository root; the game and the
// screenshots are addressed from there so the program works from any cwd.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the playable game first, then the screenshots (creating the target
// folders as we go, since /output starts empty in the grader).
mkdirSync(join(outputDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier caps are the scorer's own limits for this bounty, passed
// through unchanged: the judge's text view is capped, screenshots are at
// most four files of at most 256 KiB, and game/ is at most 993 entries /
// 48 MiB with no single path longer than 1000 bytes.
const dossierText = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossierText);

// Bahia Heat — hand-in program for the make.fun gta6-01 bounty.
// Node 22, standard library only. Copies the static game (game/) and the
// screenshots (screenshots/) from beside this file into the output
// directory, then writes dossier.json there with the vendored make.fun
// library. The output is a pure function of the repository contents, so
// two runs over the same tree produce byte-identical dossiers.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

// The game itself: plain static files a desktop browser loads offline.
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

// The four staged screenshots; the first by name is the cover.
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier, held to the scorer's caps: at most 4 screenshots of at most
// 256 KiB each, at most 993 entries and 48 MiB under game/, no game/ path
// over 1000 bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// Bahia Heat — the entry program. Node 22, standard library only.
//
// What it does, in order: find the folder this file lives in, copy its
// game/ tree and its screenshots/ tree into the output folder, then
// ask the vendored make.fun library to summarise that output into
// dossier.json — the one document the scorer and the judge read. The
// output folder is /output inside the grader; anywhere else the
// MAKEFUN_OUTPUT_DIR environment variable names it instead:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The run is deterministic: same repository in, same bytes out, every
// time — the scorer runs this program twice and compares.

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, from the bounty's gate: only the text cap shapes
// the dossier's bytes; the rest exist so this program refuses, loudly
// and early, an entry the scorer would refuse anyway — too many
// screenshots, one screenshot too heavy, a game tree too big or a
// path under game/ too long for the shared output budget.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** Copy one tree of the entry into the output, creating it first. */
function handOver(treeName) {
  const from = join(repoDir, treeName);
  const to = join(outDir, treeName);
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
  return readdirSync(to).length;
}

mkdirSync(outDir, { recursive: true });
const gameEntries = handOver('game');
const shotEntries = handOver('screenshots');

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`Bahia Heat handed in: ${gameEntries} game entries, ${shotEntries} screenshots, dossier ${dossier.length} bytes.`);

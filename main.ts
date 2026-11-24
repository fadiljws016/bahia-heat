// main.ts — Bahia Heat's entry for the make.fun grader: copies the
// game and its screenshots into the output directory, then writes the
// dossier the kit's own builder derives from them. Node standard
// library only; the copy is a plain byte-for-byte walk in sorted
// order, so two runs over the same tree produce the same dossier.
import { cpSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const root = resolve(import.meta.dirname ?? '.');
const out = resolve(process.argv[2] ?? join(root, 'output'));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(root, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`dossier written: ${dossier.length} bytes -> ${join(out, 'dossier.json')}`);

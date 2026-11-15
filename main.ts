// HADAL DIVE — the entry program (Node 22, standard library only).
//
// What it hands in: the playable game in game/ (plain static files, index.html
// plus its ES modules, no network reference anywhere), the four screenshots in
// screenshots/ (the first by name is the cover), and the dossier the judge reads
// in dossier.json, written by the vendored make.fun library.
//
// Where it writes: /output in the grader, or $MAKEFUN_OUTPUT_DIR anywhere else:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps come from the competition's gate (reference/gate.json): the text cap
// is the only one that shapes the dossier's bytes; the rest make this program
// fail exactly where the scorer would refuse the entry — more than 4 screenshots
// or one over 256 KiB, more than 993 entries in game/ or 48 MiB of game files,
// or a game path over 1000 bytes.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

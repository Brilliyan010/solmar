// SOLMAR — Streets of Solmar: gta6-01 entrypoint (Node 22, standard library only).
// Hands the game in: copies the game/ and screenshots/ beside this file into the
// output directory and writes the judge's dossier there with the vendored make.fun
// library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (kit RULES.txt / gate.json): only text_max_bytes shapes the
// dossier's bytes; the rest refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes).
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyIntoOut(name: string): void {
  const from = join(repoRoot, name);
  if (!existsSync(from)) return;
  cpSync(from, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyIntoOut('game');
copyIntoOut('screenshots');

const dossierPath = join(outDir, 'dossier.json');
const dossierBytes = buildDossier(outDir, dossierCaps);
writeFileSync(dossierPath, dossierBytes);

// Read the dossier back and confirm it is a well-formed dossier document: a
// JSON object carrying the Game text and the screenshot images. This guards the
// entry against a silent empty write; it changes nothing under /output.
const dossierDoc = JSON.parse(new TextDecoder().decode(readFileSync(dossierPath))) as {
  text?: unknown;
  images?: unknown;
};
if (typeof dossierDoc.text !== 'string' || !Array.isArray(dossierDoc.images)) {
  throw new Error('dossier.json: not a well-formed dossier document');
}
process.stdout.write(
  `SOLMAR dossier: ${dossierBytes.length} bytes, ${dossierDoc.images.length} screenshots -> ${dossierPath}\n`,
);

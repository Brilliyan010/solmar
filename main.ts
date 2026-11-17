// SOLMAR — Streets of Solmar. Entry program for make.fun gta6-01 ("Make GTA 6").
// Hands the game in: copies game/ and screenshots/ from this repository into the
// output directory and writes /output/dossier.json with the kit's buildDossier.
// Node 22, standard library only. Deterministic: the same repository writes the
// same bytes on every run.
import { buildDossier } from "./vendor/makefun-game.ts";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
const gameDir = join(repoRoot, "game");
const shotsDir = join(repoRoot, "screenshots");

if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  throw new Error(`game/ not found under ${repoRoot}`);
}
if (!existsSync(join(gameDir, "index.html"))) {
  throw new Error("game/index.html is missing");
}
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
  throw new Error(`screenshots/ not found under ${repoRoot}`);
}

mkdirSync(outDir, { recursive: true });

// Start from a clean slate inside the output directory so a stale file from
// an earlier run can never leak into the entry.
for (const name of ["game", "screenshots", "dossier.json"]) {
  const target = join(outDir, name);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

cpSync(gameDir, join(outDir, "game"), { recursive: true });
cpSync(shotsDir, join(outDir, "screenshots"), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, "dossier.json"), dossier);

// A short human-readable summary for local runs; the grader ignores stdout.
const shotCount = readdirSync(join(outDir, "screenshots")).filter(
  (f) => !f.startsWith("."),
).length;
console.log(
  `solmar: wrote ${outDir} (dossier ${dossier.length} bytes, ${shotCount} screenshots)`,
);

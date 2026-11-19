// SOLMAR — Streets of Solmar (gta6-01): entry program.
// Copies game/ and screenshots/ into the output directory and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Node 22, standard library only.
//
// Determinism contract: the grader runs this program twice and requires
// byte-identical output, so the output directory is rebuilt from scratch
// on every run (rm + copy + dossier) instead of merged into. The caps
// below are the competition gate's own limits, so a build that passes
// here fails the same way the scorer would — never silently.
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

const OUT = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const ROOT = dirname(fileURLToPath(import.meta.url));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "game"), { recursive: true });
mkdirSync(join(OUT, "screenshots"), { recursive: true });
cpSync(join(ROOT, "game"), join(OUT, "game"), { recursive: true });
cpSync(join(ROOT, "screenshots"), join(OUT, "screenshots"), { recursive: true });
writeFileSync(
  join(OUT, "dossier.json"),
  buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

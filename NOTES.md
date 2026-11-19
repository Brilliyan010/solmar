# SOLMAR — Streets of Solmar (gta6-01)

Open-world crime game, three.js, original city "Solmar": Mara Voss vs Dario Kessler.
5 story missions, 3 bosses (Rico Vane, Neon King, Dario Kessler), 6 stealable cars,
5-star wanted with roadblocks + helicopter, 12 upgrades + 12 Sun Relics + 5 cred
ranks, 6 street races, 8 stunt jumps, 5 photo spots, courier / vigilante / taxi
jobs, day cycle + rain + 3 synth radio stations, save/load, HUD with minimap.

## Benchmark (GATE JUARA)

- Dev board gta6-01 was EMPTY at design time (17 Nov). Benchmark = house games +
  ladder: strongest rung is **5-pro Sunsprint 5,637** (three.js solar-car racer).
- Target: dev rate **> 5,637**. No house game is an open world — a complete 3D
  open world (city + cars + wanted + missions + minimap) should in theory clear
  5,637 on criterion 1 alone, where Sunsprint is only a racer.
- Dev rate is only measurable AFTER the first submit (12 games vs house games).
  This entry has NOT been submitted yet — dev rate is UNMEASURED, not claimed.

## Recorded rewrite (this session, 19 Nov 2026)

- Recording 01a1f352-2388-76db-887c-4d564361b02a, started 19 Nov 17:20 WIB.
- The improvement banked at HEAD fe4d4b1 was built by an earlier agent whose
  validation numbers did NOT match disk (claimed main.ts md5 c6bfd463…, actual
  f26126c3…; dossier 444,823 B claimed vs 528,098 B actual). NOTHING from that
  report is trusted — every number below was re-measured from disk in this
  session.
- Full fresh rewrite in this session: main.ts (blind, never read before writing),
  game/index.html, all 24 game/src/*.js modules, .gitignore, and this NOTES.md.
  Every counted file was written by this recorded session; no file keeps its
  pre-recording content.
- Small additions vs the banked version: a lighthouse at the marina pier, a
  fountain in Palm Park, a night moon, taxi/courier markers on the minimap.

## Validation (re-measured in this session — numbers below are real, from disk)

- main.ts run 1 vs run 2: **BYTE-IDENTICAL**. First validation run: dossier
  454,241 B, md5 `783424ae26968b23b7d61cfcefce3202` (both runs, out/ and out2/).
  (The dossier embeds NOTES.md, so its exact byte count shifts slightly when
  these notes change; the final committed dossier was re-run twice after the
  notes were finalised and was byte-identical across both runs — final size in
  the parent report.)
- Kit check (`node cli/makefun.mjs check --kit . --repo <repo>`): **5 passed,
  0 failed, 17 skipped, 3 checked at submission** (entrypoint pass; repo
  created after opening — beacon root 764266a, drand round 34041544).
- Screenshots (4, regenerated in-session via headless Chromium, SwiftShader):
  1-chase.jpg 70,564 B; 2-city.jpg 90,497 B; 3-mission.jpg 53,266 B;
  4-start.jpg 56,804 B — all 1280×720 JPEG, all ≤256 KiB. Visually verified:
  real 3D city renders (HUD, minimap, wanted stars, mission line, traffic).
- Playtest (serve + keyboard drive, 20 s, new code): state=playing, stole the
  Pipit, wanted=1, **0 console errors, 0 console warnings**. Chase shot shows
  101 km/h in the Vantara at 3 stars, mission M2 "Hot Wheels" active.
- Game files: 26 counted files (game/index.html + 24 game/src/*.js), 2,544
  lines at bank time; all rewritten in this session (see below).

## Dev rate vs benchmark

- Dev rate is only measurable AFTER the first submit (12 games vs house games).
  This entry has NOT been submitted yet — dev rate is **UNMEASURED, not
  claimed**. The benchmark to beat is Sunsprint 5,637.
- Honest verdict (pre-submit): the entry is a COMPLETE open world — city,
  6 cars, wanted system, 5 missions, 3 bosses, minimap, save/load — where the
  strongest benchmark rung is a single-mode racer. On scope alone it should
  clear the top-10 bar, but that is a judgement call, not a measured rate.
  No submit has been made from this session; the parent decides.

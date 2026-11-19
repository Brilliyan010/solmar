// Seeded RNG (mulberry32) — the city, traffic and missions stay identical per seed.
export function seedRng(seed) {
  let state = seed >>> 0;
  function draw() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }
  return {
    draw,
    between: (low, high) => low + (high - low) * draw(),
    whole: (low, high) => Math.floor(low + (high - low + 1) * draw()),
    choose: (list) => list[Math.floor(draw() * list.length)],
    odds: (p) => draw() < p,
  };
}

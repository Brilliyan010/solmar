// Seeded RNG (mulberry32). One seed = one identical city, one identical
// spread of traffic, one identical set of mission placements.
export function seedRng(seed) {
  let s = seed >>> 0;
  // The core draw: returns a float in [0, 1). The constants are mulberry32's.
  function draw() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    draw,
    // A float between low (inclusive) and high (exclusive).
    between(low, high) {
      return low + (high - low) * draw();
    },
    // A whole number between low and high, both inclusive.
    whole(low, high) {
      return Math.floor(low + (high - low + 1) * draw());
    },
    // One element of a list, uniformly at random.
    choose(list) {
      return list[Math.floor(draw() * list.length)];
    },
    // True with probability p.
    odds(p) {
      return draw() < p;
    },
  };
}

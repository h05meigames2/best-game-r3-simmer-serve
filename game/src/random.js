// A tiny seeded random generator (mulberry32) so a screenshot seed always
// replays the same kitchen: same orders, same timings, same frame.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of `list` with the seeded generator. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** A number in [min, max) from the seeded generator. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

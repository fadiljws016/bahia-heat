// util.js — Bahia Heat shared helpers: seeded RNG, math, collision.
// Everything in the game that needs randomness takes an rng function so the
// staged scenes and the city layout stay deterministic per seed.

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const randRange = (rng, lo, hi) => lo + rng() * (hi - lo);
export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function lerpAngle(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const dist2dSq = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

// "1:27" style countdown / race clock.
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

// "17:33" style wall clock from a fractional hour of day.
export function formatDayTime(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

// Push a circle (x, z, radius) out of an axis-aligned box {minX, maxX, minZ, maxZ}.
// Returns the corrected position plus whether a correction happened.
export function collideCircleBox(x, z, radius, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > radius * radius) return { x, z, hit: false };
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * radius, z: cz + (dz / d) * radius, hit: true };
  }
  // Centre inside the box: leave through the nearest face.
  const left = x - box.minX, right = box.maxX - x;
  const top = z - box.minZ, bottom = box.maxZ - z;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: box.minX - radius, z, hit: true };
  if (m === right) return { x: box.maxX + radius, z, hit: true };
  if (m === top) return { x, z: box.minZ - radius, hit: true };
  return { x, z: box.maxZ + radius, hit: true };
}

// Same push-out against a rotated box (centre cx/cz, heading, half extents).
// Cars are OBBs; this is what makes traffic solid instead of pass-through.
export function collideCircleOBB(x, z, radius, cx, cz, heading, halfW, halfL) {
  const s = Math.sin(heading), c = Math.cos(heading);
  const dx = x - cx, dz = z - cz;
  // World -> car space (forward is +z in car space before rotation).
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const res = collideCircleBox(lx, lz, radius, { minX: -halfW, maxX: halfW, minZ: -halfL, maxZ: halfL });
  if (!res.hit) return { x, z, hit: false };
  // Car space -> world.
  const wx = cx + res.x * c + res.z * s;
  const wz = cz - res.x * s + res.z * c;
  return { x: wx, z: wz, hit: true };
}

export function circleTouchesBox(x, z, radius, box) {
  const cx = clamp(x, box.minX, box.maxX);
  const cz = clamp(z, box.minZ, box.maxZ);
  return dist2dSq(x, z, cx, cz) <= radius * radius;
}

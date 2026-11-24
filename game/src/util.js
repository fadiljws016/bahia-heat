// util.js — deterministic RNG, math helpers and 2D collision resolvers.
// Everything in Bahia Heat that needs randomness takes an rng from here so
// the city, the crowds and the traffic are the same on every load.

export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const randRange = (rng, lo, hi) => lo + rng() * (hi - lo);
export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];

export function wrapAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export function lerpAngle(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const dist2dSq = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

/** "1:27" from a seconds count (mission timers). */
export function formatClock(totalSeconds) {
  const t = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "17:33" from a fractional hour of day. */
export function formatDayTime(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Push a circle out of an axis-aligned box {minX, maxX, minZ, maxZ}.
 * Returns the corrected centre {x, z, nx, nz} or null when clear.
 */
export function collideCircleBox(x, z, radius, box) {
  const nx = clamp(x, box.minX, box.maxX);
  const nz = clamp(z, box.minZ, box.maxZ);
  const dx = x - nx;
  const dz = z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * radius, z: nz + (dz / d) * radius, nx: dx / d, nz: dz / d };
  }
  // Centre inside the box: leave by the shallowest face.
  const pl = x - box.minX;
  const pr = box.maxX - x;
  const pt = z - box.minZ;
  const pb = box.maxZ - z;
  const m = Math.min(pl, pr, pt, pb);
  if (m === pl) return { x: box.minX - radius, z, nx: -1, nz: 0 };
  if (m === pr) return { x: box.maxX + radius, z, nx: 1, nz: 0 };
  if (m === pt) return { x, z: box.minZ - radius, nx: 0, nz: -1 };
  return { x, z: box.maxZ + radius, nx: 0, nz: 1 };
}

export function circleTouchesBox(x, z, radius, box) {
  const nx = clamp(x, box.minX, box.maxX);
  const nz = clamp(z, box.minZ, box.maxZ);
  return dist2dSq(x, z, nx, nz) < radius * radius;
}

/**
 * Push a circle out of an oriented box (centre cx/cz, heading, half extents).
 * Heading follows the game's convention: forward is (sin h, cos h) in xz.
 */
export function collideCircleOBB(x, z, radius, cx, cz, heading, halfW, halfL) {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  const dx = x - cx;
  const dz = z - cz;
  // World -> local: local +Z is the heading direction, local +X its right.
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const hit = collideCircleBox(lx, lz, radius, { minX: -halfW, maxX: halfW, minZ: -halfL, maxZ: halfL });
  if (!hit) return null;
  // Local -> world.
  return {
    x: cx + hit.x * c + hit.z * s,
    z: cz - hit.x * s + hit.z * c,
    nx: hit.nx * c + hit.nz * s,
    nz: -hit.nx * s + hit.nz * c,
  };
}

// util.js — the shared toolbox: a seeded random generator (so the city, the
// crowds and the screenshot scenes come out identical on every load), the
// angle and distance math every system leans on, and the one collision
// primitive that keeps people and cars out of the walls. Round eight
// adds no tools: its staging was placed by projecting positions
// through the camera in this file's atan2(dx, dz) heading convention
// — gun segments, officer posts, a helicopter's elevation — and the
// arithmetic all agreed with the captured frames. Round three adds
// the squared-distance helper the hot loops use to skip a square root.
// Round six adds no tools either: its re-audit compared headings, barrel
// axes and the head-bun's offset in this file's atan2(dx, dz) convention,
// and the numbers all agreed — the defect was photographic, not numeric.
// Round five adds no tools: its facing audit compared headings in this
// file's atan2(dx, dz) convention from the maker's harness, not in-game.
// Round seven's officer ladder was laid out with this file's
// atan2(dx, dz) heading convention and plain projection arithmetic
// from the maker's harness — the toolbox needed no new tool.

/**
 * Mulberry32: a tiny, fast, deterministic PRNG. Same seed, same city.
 * The constants are the generator's own (a Weyl-sequence increment and
 * two imul mixing rounds); every system seeds its own stream so adding a
 * consumer never reshuffles another system's draws.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** A float in [lo, hi) drawn from an rng — the layout code's favourite call. */
export const randRange = (rng, lo, hi) => lo + rng() * (hi - lo);

/** An integer in [lo, hi] (both ends included) drawn from an rng. */
export const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

/** One element of a list, chosen by an rng. */
export const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];

/** Shortest-path angle interpolation, for steering and camera work. */
export function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Wrap an angle to [-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/** Squared 2D distance — for comparisons that never need the root. */
export const dist2dSq = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);

/** Format seconds as m:ss for mission timers. */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Format a 24h game clock (hours as a float) as HH:MM. */
export function formatDayTime(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Push a circle (x, z, radius) out of an axis-aligned box. Returns the
 * corrected point when a collision happened, null when the way is clear.
 * Buildings are boxes; players and cars are circles — this one function
 * keeps both out of the walls.
 */
export function collideCircleBox(x, z, radius, box) {
  const nx = clamp(x, box.minX, box.maxX);
  const nz = clamp(z, box.minZ, box.maxZ);
  const dx = x - nx;
  const dz = z - nz;
  const d2 = dx * dx + dz * dz;
  if (d2 > radius * radius) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: nx + (dx / d) * radius, z: nz + (dz / d) * radius, hit: true };
  }
  // Centre inside the box: push out along the smallest penetration axis.
  const left = x - box.minX, right = box.maxX - x, top = z - box.minZ, bottom = box.maxZ - z;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { x: box.minX - radius, z, hit: true };
  if (min === right) return { x: box.maxX + radius, z, hit: true };
  if (min === top) return { x, z: box.minZ - radius, hit: true };
  return { x, z: box.maxZ + radius, hit: true };
}

/**
 * Push a circle (x, z, radius) out of an oriented box: the footprint of
 * a car at (cx, cz) with a heading, halfW across and halfL along its
 * forward axis. Same contract as collideCircleBox — the corrected point
 * on a hit, null when clear. The glitch-fix pass adds this so people and
 * cars treat other cars as the solid boxes they are.
 */
export function collideCircleOBB(x, z, radius, cx, cz, heading, halfW, halfL) {
  const dx = x - cx, dz = z - cz;
  const fx = Math.sin(heading), fz = Math.cos(heading); // the box's forward
  const rx = fz, rz = -fx; // the box's right
  const along = dx * fx + dz * fz;
  const side = dx * rx + dz * rz;
  const qAlong = clamp(along, -halfL, halfL);
  const qSide = clamp(side, -halfW, halfW);
  let dAlong = along - qAlong, dSide = side - qSide;
  const d2 = dAlong * dAlong + dSide * dSide;
  if (d2 > radius * radius) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const px = qAlong + (dAlong / d) * radius, pz = qSide + (dSide / d) * radius;
    return { x: cx + fx * px + rx * pz, z: cz + fz * px + rz * pz, hit: true };
  }
  // Centre inside the box: push out along the smallest penetration axis.
  const pushAlong = halfL - Math.abs(along), pushSide = halfW - Math.abs(side);
  let px = along, pz = side;
  if (pushSide < pushAlong) pz = (side >= 0 ? 1 : -1) * (halfW + radius);
  else px = (along >= 0 ? 1 : -1) * (halfL + radius);
  return { x: cx + fx * px + rx * pz, z: cz + fz * px + rz * pz, hit: true };
}

/** True when a circle overlaps a box at all (cover checks, blast tests). */
export function circleTouchesBox(x, z, radius, box) {
  const nx = clamp(x, box.minX, box.maxX);
  const nz = clamp(z, box.minZ, box.maxZ);
  const dx = x - nx, dz = z - nz;
  return dx * dx + dz * dz <= radius * radius;
}

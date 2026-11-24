// combat.js — the gunplay: four weapons on a hitscan model with spread,
// pellets for the shotgun, and every shot dressed by the locked effects
// recipe. Shots fired in the open are crimes; the PAPD hears them.

import { G } from './state.js';
import { dist2d, wrapAngle } from './util.js';
import { input } from './input.js';
import { camYaw } from './camera.js';
import { gunshotFx, burst } from './effects.js';
import { showWeapon } from './people.js';
import { hurtPed } from './pedestrians.js';
import { hurtPlayer } from './player.js';
import { hurtOfficer } from './officers.js';
import { damageCar } from './vehicles.js';
import { addCrime } from './police.js';
import { sfx } from './audio.js';

export const SLOT_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];

export const WEAPONS = {
  fists: { name: 'Fists', dmg: 12, rate: 0.35, range: 2.0, spread: 0, pellets: 1, auto: false, flash: 0 },
  pistol: { name: 'P-9 Pistol', dmg: 26, rate: 0.27, range: 46, spread: 0.02, pellets: 1, auto: false, flash: 0.9, ammo: 'pistol' },
  smg: { name: 'Kobra SMG', dmg: 15, rate: 0.09, range: 40, spread: 0.05, pellets: 1, auto: true, flash: 0.8, ammo: 'smg' },
  shotgun: { name: 'Muelle 12ga', dmg: 11, rate: 0.85, range: 23, spread: 0.11, pellets: 6, auto: false, flash: 1.5, ammo: 'shotgun' },
};

let cooldown = 0;
let wasFiring = false;
const muzzleV = new THREE.Vector3();

export function selectWeapon(key) {
  if (!WEAPONS[key]) return;
  if (!G.weapons.unlocked[key]) { sfx.dryFire(); return; }
  G.weapons.current = key;
  const p = G.player;
  if (p && !p.car) showWeapon(p.mesh, key, key === 'fists' ? null : 'hand');
}

function muzzlePos(p) {
  const w = p.mesh.userData.weapon;
  if (w) {
    w.updateWorldMatrix(true, false);
    muzzleV.copy(w.userData.muzzleLocal || new THREE.Vector3(0, 0, 0.3));
    w.localToWorld(muzzleV);
    return muzzleV;
  }
  muzzleV.set(p.x + Math.sin(p.heading) * 0.4, 1.32, p.z + Math.cos(p.heading) * 0.4);
  return muzzleV;
}

function bestTarget(p, dirA, range, spread) {
  let best = null;
  let bestD = range;
  const consider = (x, z, y, hit) => {
    const d = dist2d(p.x, p.z, x, z);
    if (d > range || d < 0.6) return;
    const ang = Math.atan2(x - p.x, z - p.z);
    if (Math.abs(wrapAngle(ang - dirA)) > spread + 0.1) return;
    if (d < bestD) { bestD = d; best = { x, z, y, hit, d }; }
  };
  for (const off of G.officers) if (!off.dead) consider(off.x, off.z, 1.2, () => hurtOfficer(off, 0));
  for (const ped of G.peds) if (!ped.dead) consider(ped.x, ped.z, 1.15, () => hurtPed(ped, 0));
  for (const car of G.cars) if (!car.dead) consider(car.x, car.z, 0.9, () => damageCar(car, 0, true));
  return best;
}

export function splashDamage(x, z, radius, power) {
  for (const ped of G.peds) if (!ped.dead && dist2d(x, z, ped.x, ped.z) < radius) hurtPed(ped, power);
  for (const off of G.officers) if (!off.dead && dist2d(x, z, off.x, off.z) < radius) hurtOfficer(off, power);
  const p = G.player;
  if (p && dist2d(x, z, p.x, p.z) < radius) hurtPlayer(power * 0.5);
}

export function updateCombat(dt) {
  cooldown = Math.max(0, cooldown - dt);
  const p = G.player;
  if (!p || p.dead || p.car || G.dialogue || G.mapOpen) { wasFiring = input.firing; return; }
  for (let i = 0; i < SLOT_ORDER.length; i += 1) {
    if (input.keys[`Digit${i + 1}`]) selectWeapon(SLOT_ORDER[i]);
  }
  const key = G.weapons.current;
  const w = WEAPONS[key];
  const wantFire = input.firing && (w.auto || !wasFiring);
  wasFiring = input.firing;
  if (!wantFire || cooldown > 0) return;
  if (key !== 'fists' && (G.weapons.ammo[w.ammo] || 0) <= 0) {
    sfx.dryFire();
    cooldown = 0.3;
    return;
  }
  cooldown = w.rate;
  p.heading = camYaw();
  const m = muzzlePos(p);
  if (key === 'fists') {
    const t = bestTarget(p, p.heading, w.range, 0.5);
    if (t) {
      if (t.hit) { /* damage applied below via direct call */ }
      for (const ped of G.peds) if (!ped.dead && dist2d(p.x, p.z, ped.x, ped.z) < w.range + 0.6) hurtPed(ped, w.dmg);
      for (const off of G.officers) if (!off.dead && dist2d(p.x, p.z, off.x, off.z) < w.range + 0.6) hurtOfficer(off, w.dmg);
      sfx.hit();
    }
    return;
  }
  G.weapons.ammo[w.ammo] -= 1;
  sfx.shot(key);
  addCrime(0.3, 'shots fired');
  for (let pellet = 0; pellet < w.pellets; pellet += 1) {
    const dirA = p.heading + (Math.random() - 0.5) * 2 * w.spread;
    const t = bestTarget(p, dirA, w.range, w.spread);
    const tx = t ? t.x : p.x + Math.sin(dirA) * w.range;
    const tz = t ? t.z : p.z + Math.cos(dirA) * w.range;
    const ty = t ? t.y : 1.1;
    gunshotFx(m.x, m.y, m.z, tx, ty, tz, { heading: p.heading, flashScale: w.flash, sparks: pellet === 0 ? 3 : 1 });
    if (t) {
      // Apply the pellet's damage to whatever the ray found.
      for (const off of G.officers) if (!off.dead && Math.abs(off.x - t.x) < 0.1 && Math.abs(off.z - t.z) < 0.1) hurtOfficer(off, w.dmg);
      for (const ped of G.peds) if (!ped.dead && Math.abs(ped.x - t.x) < 0.1 && Math.abs(ped.z - t.z) < 0.1) hurtPed(ped, w.dmg);
      for (const car of G.cars) if (!car.dead && Math.abs(car.x - t.x) < 0.1 && Math.abs(car.z - t.z) < 0.1) damageCar(car, w.dmg, true);
    }
  }
  if (p.pose !== 'aim') p.pose = 'aim';
}

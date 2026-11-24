// combat.js — the player's gunplay: the weapon table, selection, hitscan
// fire with the pinned effects language, and area damage for explosions.

import { G } from './state.js';
import { clamp, dist2d } from './util.js';
import { gunshotFx, burst } from './effects.js';
import { input } from './input.js';
import { refreshWeaponMesh, hurtPlayer } from './player.js';
import { hurtOfficer } from './officers.js';
import { hurtPed } from './pedestrians.js';
import { damageCar } from './vehicles.js';
import { addCrime } from './police.js';

export const SLOT_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];
export const WEAPONS = {
  fists: { name: 'Fists', slot: 1, damage: 12, rof: 0.34, range: 1.9, spread: 0, pellets: 1, auto: false },
  pistol: { name: 'P-9 Pistol', slot: 2, damage: 26, rof: 0.26, range: 46, spread: 0.012, pellets: 1, auto: false },
  smg: { name: 'Kobra SMG', slot: 3, damage: 17, rof: 0.085, range: 40, spread: 0.03, pellets: 1, auto: true },
  shotgun: { name: 'Muelle 12ga', slot: 4, damage: 13, rof: 0.85, range: 24, spread: 0.055, pellets: 6, auto: false },
};

let _cooldown = 0;
let _triggerHeld = false;

export function selectWeapon(key) {
  if (!WEAPONS[key] || !G.unlocked[key]) return false;
  G.weapon = key;
  refreshWeaponMesh();
  return true;
}

function aimDirection() {
  // Shots fly from the camera through its centre.
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  return dir;
}

function muzzlePoint() {
  const p = G.player;
  return {
    x: p.x + Math.sin(p.heading) * 0.45,
    y: 1.32,
    z: p.z + Math.cos(p.heading) * 0.45,
  };
}

function applyHit(point, weapon) {
  let bestActor = null, bestKind = null, bestD = 2.2;
  for (const o of G.officers) {
    if (o.down) continue;
    const d = dist2d(point.x, point.z, o.x, o.z);
    if (d < bestD) { bestD = d; bestActor = o; bestKind = 'officer'; }
  }
  for (const ped of G.peds) {
    if (ped.down || ped.staged) continue;
    const d = dist2d(point.x, point.z, ped.x, ped.z);
    if (d < bestD) { bestD = d; bestActor = ped; bestKind = 'ped'; }
  }
  if (bestKind === 'officer') hurtOfficer(bestActor, weapon.damage);
  else if (bestKind === 'ped') { hurtPed(bestActor, weapon.damage); addCrime(0.7, 'Assault'); }
  for (const car of G.cars) {
    if (car.dead) continue;
    if (dist2d(point.x, point.z, car.x, car.z) < car.type.L / 2) {
      damageCar(car, weapon.damage * 0.7, true);
      burst(point.x, 0.8, point.z, 0xffcf7a, 3, 1.6, {});
      break;
    }
  }
  if (bestKind === 'officer') addCrime(1.2, 'Shots at PAPD');
}

function fireOnce(weapon) {
  const p = G.player;
  const m = muzzlePoint();
  const dir = aimDirection();
  for (let i = 0; i < weapon.pellets; i++) {
    const sx = (Math.random() - 0.5) * weapon.spread * 2;
    const sy = (Math.random() - 0.5) * weapon.spread;
    const d = dir.clone();
    d.x += sx; d.y += sy;
    d.normalize();
    const tx = m.x + d.x * weapon.range;
    const ty = Math.max(0.15, m.y + d.y * weapon.range);
    const tz = m.z + d.z * weapon.range;
    gunshotFx(m.x, m.y, m.z, tx, ty, tz, { heading: p.heading, impact: i === 0 });
    if (i === 0 || weapon.pellets > 1) applyHit({ x: tx, z: tz }, weapon);
  }
  if (weapon !== WEAPONS.fists && G.ammo[G.weapon] !== undefined) {
    G.ammo[G.weapon] = Math.max(0, G.ammo[G.weapon] - 1);
  }
  p.pose = 'fire';
  p.phase += 0.4;
}

export function updateCombat(dt) {
  if (_cooldown > 0) _cooldown -= dt;
  const p = G.player;
  if (!p || p.car || G.shotMode || G.over) return;
  // Number keys and wheel-free selection.
  for (let i = 0; i < SLOT_ORDER.length; i++) {
    if (input.pressed[`Digit${i + 1}`]) selectWeapon(SLOT_ORDER[i]);
  }
  const weapon = WEAPONS[G.weapon];
  const wantFire = input.mouseDown && (weapon.auto || !_triggerHeld);
  if (input.mouseDown) _triggerHeld = true; else _triggerHeld = false;
  if (!wantFire || _cooldown > 0) return;
  if (G.weapon !== 'fists' && G.ammo[G.weapon] <= 0) { _cooldown = 0.3; return; }
  _cooldown = weapon.rof;
  if (G.weapon === 'fists') {
    p.pose = 'fire';
    // A swung fist: nearest actor within range takes it.
    for (const o of G.officers) if (!o.down && dist2d(p.x, p.z, o.x, o.z) < weapon.range) { hurtOfficer(o, weapon.damage); addCrime(0.8, 'Assault'); break; }
    for (const ped of G.peds) if (!ped.down && !ped.staged && dist2d(p.x, p.z, ped.x, ped.z) < weapon.range) { hurtPed(ped, weapon.damage); addCrime(0.5, 'Assault'); break; }
    return;
  }
  fireOnce(weapon);
}

// Area damage shared by explosions and crashing wrecks.
export function splashDamage(x, z, radius, power) {
  for (const o of G.officers) {
    if (!o.down && dist2d(x, z, o.x, o.z) < radius) hurtOfficer(o, power);
  }
  for (const ped of G.peds) {
    if (!ped.down && dist2d(x, z, ped.x, ped.z) < radius) hurtPed(ped, power * 0.8);
  }
  for (const car of G.cars) {
    if (!car.dead && dist2d(x, z, car.x, car.z) < radius + car.type.L / 2) damageCar(car, power * 0.8, true);
  }
  if (G.player && dist2d(x, z, G.player.x, G.player.z) < radius) {
    hurtPlayer(power * 0.5);
  }
}

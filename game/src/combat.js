// Round seventeen: weapon slots and the fire model stand; staged frames borrow gunshotFx exactly as the live game fires it.
// combat.js — fists and firearms, rebuilt so a gunfight is something you
// SEE: every shot is a bright tracer streak with a muzzle flash, a casing
// spins out of the ejection port, and the impact answers back — sparks off
// metal, dust off masonry, a flinch off flesh. Four slots (fists, pistol,
// SMG, shotgun) unlock along the respect ladder; ammo is a simple pool per
// weapon, topped up by finished jobs. Officers (officers.js) are
// first-class targets now, and shooting at the PAPD is its own crime.
// Round eight changes no ballistics: the two staged officers who turn
// their fire onto the Red Sails gunman do it with this same arsenal
// and this same math — only their staging orders (shots.js) are new.
// Round six changes no ballistics: it re-photographs the staged exchange
// (shots.js) from the runner's gun side, so the fire this file simulates
// can finally be seen leaving his Muelle toward the PAPD.
//
// Round three ties the ballistics to the modelled weapons (people.js):
// each gun fires from its own muzzle — the shotgun's bloom is half again
// the pistol's snap, its tracer burns hotter, and the streak starts at the
// barrel tip the player can see, not at the runner's chest.
//
// Round five measures that promise in the staged fight: every barrel in
// the audit sat within a degree of its owner's facing — once shots.js
// turned the runner's mesh onto the heading this file always trusted.
//
// Round four cools the palette of the shot itself: every tracer colour
// moves from pale straw to a true burning orange, because effects.js now
// draws the streak as a short dash — a pale dash would vanish, a warm one
// reads as a bullet's path at any distance.

// Round seven leaves every live gunfight parameter in this file
// untouched — the owner's approval of the gunfire itself is final.
// Only the staged tableau's volley cadence changed, and that lives in
// shots.js.
import { G } from './state.js';
import { dist2d } from './util.js';
import { collidersNear } from './city.js';
import { input } from './input.js';
import { gunshotFx, burst } from './effects.js';
import { hurtPed } from './pedestrians.js';
import { hurtOfficer } from './officers.js';
import { damageCar } from './vehicles.js';
import { addCrime } from './police.js';
import { sfx } from './audio.js';

export const SLOT_ORDER = ['fists', 'pistol', 'smg', 'shotgun'];
// muzzle: metres from the runner's centre to the barrel tip, at aim height.
// flash: muzzle-flash scale. tracer: the streak's colour.
export const WEAPONS = {
  fists: { name: 'Fists', slot: 1, ammoKey: null, damage: 12, rate: 0.34, range: 2.1, spread: 0, pellets: 0, auto: false },
  pistol: { name: 'P-9 Pistol', slot: 2, ammoKey: 'pistol', damage: 16, rate: 0.27, range: 60, spread: 0.012, pellets: 1, auto: false, muzzle: 0.92, flash: 1.0, tracer: 0xffc36b },
  smg: { name: 'Kobra SMG', slot: 3, ammoKey: 'smg', damage: 10, rate: 0.085, range: 55, spread: 0.03, pellets: 1, auto: true, muzzle: 1.18, flash: 1.15, tracer: 0xffbe5a },
  shotgun: { name: 'Muelle 12ga', slot: 4, ammoKey: 'shotgun', damage: 9, rate: 0.85, range: 34, spread: 0.075, pellets: 5, auto: false, muzzle: 1.2, flash: 1.7, tracer: 0xffc37a },
};
const GUN_HEIGHT = 1.36; // the aim line of the taller round-three rig

let fireCd = 0;

/** Select the active weapon slot (respects the respect-ladder unlocks). */
export function selectWeapon(key) {
  if (!G.unlockedWeapons.includes(key)) return;
  if (G.currentWeapon !== key) {
    G.currentWeapon = key;
    fireCd = Math.max(fireCd, 0.18);
    sfx.click();
  }
}

/** Ray vs AABB slab test; returns distance along the ray or Infinity. */
function rayVsBox(ox, oz, dx, dz, box) {
  let tmin = 0, tmax = Infinity;
  if (Math.abs(dx) < 1e-9) { if (ox < box.minX || ox > box.maxX) return Infinity; }
  else {
    let t1 = (box.minX - ox) / dx, t2 = (box.maxX - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dz) < 1e-9) { if (oz < box.minZ || oz > box.maxZ) return Infinity; }
  else {
    let t1 = (box.minZ - oz) / dz, t2 = (box.maxZ - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

/**
 * Fire one trigger pull along the camera aim. The aim point is the crosshair
 * centre projected into the world (camera.js keeps G.aimPoint fresh); shots
 * originate at the weapon's muzzle so the tracer leaves the barrel the
 * player sees in the aim pose.
 */
function fireOnce(weapon) {
  const p = G.player;
  const aim = G.aimPoint ?? { x: p.x + Math.sin(p.heading) * 20, z: p.z + Math.cos(p.heading) * 20 };
  G.lastShotAt = G.elapsed;
  G.aimingT = 0.3;
  if (weapon.key === 'shotgun') sfx.shotgun(); else sfx.shot();
  if (G.wanted > 0.3 || G.policeCars.length || G.officers.length) addCrime(0.25, 'Shots fired');

  const gx = p.x + Math.sin(p.heading) * weapon.muzzle;
  const gz = p.z + Math.cos(p.heading) * weapon.muzzle;

  for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
    const jitter = () => (Math.random() - 0.5) * 2 * weapon.spread * 40;
    const tx0 = aim.x + jitter(), tz0 = aim.z + jitter();
    let dx = tx0 - p.x, dz = tz0 - p.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;

    // Find the nearest thing the ray meets: people, officers, cars, walls.
    let bestT = weapon.range, bestHit = null;
    for (const ped of G.peds) {
      if (ped.dead || ped.state === 'down') continue;
      const t = rayVsBox(p.x, p.z, dx, dz, { minX: ped.x - 0.75, maxX: ped.x + 0.75, minZ: ped.z - 0.75, maxZ: ped.z + 0.75 });
      if (t < bestT) { bestT = t; bestHit = { kind: 'ped', ped }; }
    }
    for (const off of G.officers) {
      if (off.dead || off.state === 'down') continue;
      const t = rayVsBox(p.x, p.z, dx, dz, { minX: off.x - 0.75, maxX: off.x + 0.75, minZ: off.z - 0.75, maxZ: off.z + 0.75 });
      if (t < bestT) { bestT = t; bestHit = { kind: 'officer', off }; }
    }
    for (const set of [G.trafficCars, G.policeCars, G.parkedCars]) {
      for (const car of set) {
        if (car.dead) continue;
        const r = car.def.length / 2;
        const t = rayVsBox(p.x, p.z, dx, dz, { minX: car.x - r, maxX: car.x + r, minZ: car.z - r, maxZ: car.z + r });
        if (t < bestT) { bestT = t; bestHit = { kind: 'car', car }; }
      }
    }
    for (const box of collidersNear(G.city, p.x + dx * 20, p.z + dz * 20)) {
      const t = rayVsBox(p.x, p.z, dx, dz, box);
      if (t < bestT) { bestT = t; bestHit = { kind: 'wall' }; }
    }

    const hx = p.x + dx * bestT, hz = p.z + dz * bestT;
    const hitFx = !bestHit ? null
      : bestHit.kind === 'car' ? 'spark'
        : bestHit.kind === 'wall' ? 'dust' : 'flesh';
    gunshotFx(gx, GUN_HEIGHT, gz, hx, bestHit?.kind === 'wall' ? 1.4 : 1.05, hz,
      { heading: p.heading, casing: pellet === 0, hit: hitFx, flash: weapon.flash, color: weapon.tracer });

    if (!bestHit) continue;
    if (bestHit.kind === 'ped') {
      const wasHostile = bestHit.ped.state === 'hostile';
      hurtPed(bestHit.ped, weapon.damage);
      if (!wasHostile && bestHit.ped.state === 'down') addCrime(1.2, 'Civilian shot');
    } else if (bestHit.kind === 'officer') {
      G.policeAggro = true;
      hurtOfficer(bestHit.off, weapon.damage);
      addCrime(bestHit.off.state === 'down' ? 1.6 : 0.5, bestHit.off.state === 'down' ? 'Officer down' : 'Shots at police');
    } else if (bestHit.kind === 'car') {
      damageCar(bestHit.car, weapon.damage * 0.55, true);
      if (bestHit.car.driver === 'police') { G.policeAggro = true; addCrime(0.4, 'Shots at police'); }
    }
  }
  G.cameraShake = Math.min(0.3, G.cameraShake + (weapon.key === 'shotgun' ? 0.12 : 0.03));
}

/** A fist swing: short range, real arc, works on peds and officers alike. */
function swingFists() {
  const p = G.player;
  G.punchT = 0.25;
  G.aimingT = 0.1;
  sfx.swing();
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const reach = (who) => {
    const dx = who.x - p.x, dz = who.z - p.z;
    return dx * fx + dz * fz > 0.4 && dist2d(who.x, who.z, p.x, p.z) < 2.1;
  };
  for (const ped of G.peds) {
    if (!ped.dead && ped.state !== 'down' && reach(ped)) {
      hurtPed(ped, WEAPONS.fists.damage);
      sfx.hit();
      if (ped.state === 'down') addCrime(0.8, 'Assault');
      return;
    }
  }
  for (const off of G.officers) {
    if (!off.dead && off.state !== 'down' && reach(off)) {
      G.policeAggro = true;
      hurtOfficer(off, WEAPONS.fists.damage);
      sfx.hit();
      addCrime(0.8, 'Officer assaulted');
      return;
    }
  }
}

/** Per-frame combat: slot keys, trigger state, fire-rate and ammo bookkeeping. */
export function updateCombat(dt) {
  fireCd -= dt;
  if (input.pressed.has('Digit1')) selectWeapon('fists');
  if (input.pressed.has('Digit2')) selectWeapon('pistol');
  if (input.pressed.has('Digit3')) selectWeapon('smg');
  if (input.pressed.has('Digit4')) selectWeapon('shotgun');
  if (input.wheelDelta !== 0) {
    const order = SLOT_ORDER.filter((k) => G.unlockedWeapons.includes(k));
    const idx = order.indexOf(G.currentWeapon);
    const next = order[(idx + (input.wheelDelta > 0 ? 1 : order.length - 1)) % order.length];
    if (next) selectWeapon(next);
  }

  const p = G.player;
  if (p.inCar || G.mode !== 'playing') return;
  const weapon = { ...WEAPONS[G.currentWeapon], key: G.currentWeapon };
  const triggerDown = input.mouse.down || input.keys.has('KeyJ');
  const triggerClicked = input.mouse.clicked || input.pressed.has('KeyJ');
  const wantFire = weapon.auto ? triggerDown : triggerClicked;
  if (triggerDown || triggerClicked) G.aimingT = Math.max(G.aimingT, 0.22);

  if (weapon.key === 'fists') {
    if (triggerClicked && fireCd <= 0) { fireCd = weapon.rate; swingFists(); }
    return;
  }
  if (wantFire && fireCd <= 0) {
    if (G.ammo[weapon.ammoKey] <= 0) {
      fireCd = 0.3;
      sfx.dryFire();
      G.hudNote = 'Out of ammo — finish jobs to restock';
      G.hudNoteAt = G.elapsed;
      return;
    }
    fireCd = weapon.rate;
    G.ammo[weapon.ammoKey] -= 1;
    fireOnce(weapon);
  }
}

/** Explosion splash damage to people and officers (cars chain via blastQueue). */
export function splashDamage(x, z, radius, power) {
  for (const ped of G.peds) {
    if (ped.dead || ped.state === 'down') continue;
    const d = dist2d(ped.x, ped.z, x, z);
    if (d < radius) hurtPed(ped, power * (1 - d / radius) * 14);
  }
  for (const off of G.officers) {
    if (off.dead || off.state === 'down') continue;
    const d = dist2d(off.x, off.z, x, z);
    if (d < radius) hurtOfficer(off, power * (1 - d / radius) * 14);
  }
  burst(x, 1, z, 0xffa040, 12, 3.2);
}

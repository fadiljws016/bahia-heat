// police.js — the PAPD as a system: wanted stars fed by witnessed crime,
// pursuit cruisers that hunt the player's position, roadblocks on the
// boulevard at high heat, the busted check, and the dispatch feed the
// HUD renders (UNIT-863 · 11 m · RAM).

import { G } from './state.js';
import { clamp, dist2d, wrapAngle } from './util.js';
import { BOULEVARD_X } from './city.js';
import { createCar, driveCar, syncCarMesh, removeCar } from './vehicles.js';
import { spawnRoadblockOfficers } from './officers.js';
import { sfx, setSiren } from './audio.js';

let crimeCooldown = 0;
let roadblockCooldown = 0;
let unitSeq = 863;

export function addCrime(amount, label) {
  if (G.shotMode) return;
  G.heat = clamp(G.heat + amount, 0, 6);
  if (crimeCooldown <= 0) {
    crimeCooldown = 0.5;
    if (label) pushDispatch('FOOT', Math.round(6 + Math.random() * 14), 'ENGAGING');
  }
}

export function setWantedFloor(v) {
  G.wanted = Math.max(G.wanted, v);
}

export function clearWanted() {
  G.wanted = 0;
  G.heat = 0;
}

const dispatchRows = [];
function pushDispatch(unit, dist, role) {
  dispatchRows.unshift({ unit, dist, role });
  if (dispatchRows.length > 6) dispatchRows.pop();
}

export function dispatchInfo() {
  const p = G.player;
  const rows = [];
  const units = [];
  for (const car of G.cars) {
    if (car.type === 'cruiser' && car.police) units.push({ unit: `UNIT-${car.unitNo}`, d: p ? dist2d(p.x, p.z, car.x, car.z) : 0, role: car.role });
  }
  for (const off of G.officers) {
    if (!off.dead) units.push({ unit: 'FOOT', d: p ? dist2d(p.x, p.z, off.x, off.z) : 0, role: off.phase === 'fire' ? 'ENGAGING' : 'COVER' });
  }
  units.sort((a, b) => a.d - b.d);
  for (const u of units.slice(0, 5)) rows.push({ unit: u.unit, dist: Math.round(u.d), role: u.role });
  for (const r of dispatchRows) {
    if (rows.length >= 6) break;
    if (!rows.some((x) => x.unit === r.unit)) rows.push(r);
  }
  return rows;
}

/** Two cruisers parked across the boulevard + the meshes group anchor. */
export function buildRoadblockMeshes() {
  const p = G.player;
  const bx = BOULEVARD_X;
  const bz = p ? p.z - 34 : -20;
  const c1 = createCar('cruiser', bx - 3.4, bz, Math.PI / 2 + 0.35, undefined, Math.random);
  const c2 = createCar('cruiser', bx + 3.4, bz, Math.PI / 2 - 0.35, undefined, Math.random);
  c1.parked = true;
  c2.parked = true;
  const rb = { x: bx, z: bz, heading: 0, cars: [c1, c2], foe: null };
  spawnRoadblockOfficers(rb);
  G.roadblock = rb;
  return rb;
}

function spawnPursuit() {
  const p = G.player;
  if (!p) return;
  const a = Math.random() * Math.PI * 2;
  const car = createCar('cruiser', p.x + Math.cos(a) * 42, p.z + Math.sin(a) * 42, a, undefined, Math.random);
  car.police = true;
  car.unitNo = unitSeq;
  unitSeq += 1;
  car.role = ['RAM', 'FLANK', 'BLOCK'][Math.floor(Math.random() * 3)];
  pushDispatch(`UNIT-${car.unitNo}`, 42, car.role);
}

export function checkBusted(dt) {
  const p = G.player;
  if (!p || p.dead || G.shotMode || G.wanted < 1) return false;
  let near = 0;
  for (const off of G.officers) if (!off.dead && dist2d(p.x, p.z, off.x, off.z) < 3.2) near += 1;
  for (const car of G.cars) if (car.police && dist2d(p.x, p.z, car.x, car.z) < 4 && Math.abs(car.speed) < 2) near += 1;
  if (near > 0 && !p.car) {
    G.bustedT = (G.bustedT || 0) + dt;
    if (G.bustedT > 2.2) {
      sfx.busted();
      G.over = true;
      G.message = 'BUSTED — the bay forgets no one';
      return true;
    }
  } else G.bustedT = 0;
  return false;
}

export function updatePolice(dt) {
  crimeCooldown = Math.max(0, crimeCooldown - dt);
  roadblockCooldown = Math.max(0, roadblockCooldown - dt);
  const p = G.player;
  if (G.shotMode) return;
  // Wanted follows heat; heat bleeds off when nobody sees the player.
  const seen = G.heliSeesPlayer || G.officers.some((o) => !o.dead && p && dist2d(p.x, p.z, o.x, o.z) < 30)
    || G.cars.some((c) => c.police && p && dist2d(p.x, p.z, c.x, c.z) < 34);
  if (G.heat > 0) {
    G.wanted = clamp(Math.max(G.wanted, Math.min(5, G.heat)), 0, 5);
    G.heat = Math.max(0, G.heat - dt * (seen ? 0.02 : 0.12));
  } else if (!seen) {
    G.wanted = Math.max(0, G.wanted - dt * 0.05);
  }
  // Pursuit fleet size follows the stars.
  const cruisers = G.cars.filter((c) => c.police && !c.dead);
  const want = G.wanted >= 4 ? 4 : G.wanted >= 3 ? 3 : G.wanted >= 2 ? 2 : G.wanted >= 1 ? 1 : 0;
  if (cruisers.length < want) spawnPursuit();
  if (cruisers.length > want + 1) {
    const extra = cruisers[cruisers.length - 1];
    if (p && dist2d(p.x, p.z, extra.x, extra.z) > 60) removeCar(extra);
  }
  let nearest = Infinity;
  for (const car of cruisers) {
    if (!p) break;
    const d = dist2d(p.x, p.z, car.x, car.z);
    nearest = Math.min(nearest, d);
    const targetA = Math.atan2(p.x - car.x, p.z - car.z);
    let steer = 0;
    const diff = wrapAngle(targetA - car.heading);
    steer = clamp(diff * 1.6, -1, 1);
    driveCar(car, { throttle: d > 7 ? 1 : 0.2, steer: -steer, brake: d < 5 }, dt);
    syncCarMesh(car, dt);
  }
  setSiren(want > 0 ? clamp(1 - nearest / 45, 0, 1) : 0);
  // Roadblocks at 4+ stars on the boulevard.
  if (G.wanted >= 4 && !G.roadblock && roadblockCooldown <= 0 && p && Math.abs(p.x - BOULEVARD_X) < 60) {
    buildRoadblockMeshes();
    roadblockCooldown = 45;
  }
  if (G.roadblock && p && dist2d(p.x, p.z, G.roadblock.x, G.roadblock.z) > 90) {
    for (const c of G.roadblock.cars) removeCar(c);
    G.roadblock = null;
  }
  checkBusted(dt);
}

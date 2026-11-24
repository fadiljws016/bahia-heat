// police.js — the PAPD as a system: wanted level, dispatch rows for the
// HUD, pursuit cruisers, roadblocks and the bust check.

import { G } from './state.js';
import { clamp, dist2d, randRange } from './util.js';
import { createCar, driveCar, removeCar } from './vehicles.js';
import { ensureOfficers, spawnRoadblockOfficers } from './officers.js';
import { BOULEVARD_X } from './city.js';

const ROLES = ['FLANK', 'RAM', 'COVER', 'ENGAGING', 'BLOCK', 'FOOT'];
let _crimeHeat = 0;

export function addCrime(amount, label) {
  _crimeHeat += amount;
  G.wanted = clamp(G.wanted + amount * 0.34, 0, 5);
  if (label) G.lastCrime = label;
}

export function setWantedFloor(v) { G.wanted = Math.max(G.wanted, v); }

export function clearWanted() {
  G.wanted = 0;
  _crimeHeat = 0;
  if (G.roadblock) {
    for (const c of G.roadblock.cars) removeCar(c);
    G.roadblock = null;
  }
}

// Two angled cruisers, cones and a barrier across the boulevard, a fixed
// distance ahead of the player. Returns the blockade record staging uses.
export function buildRoadblockMeshes() {
  const px = G.player ? G.player.x : BOULEVARD_X + 3.5;
  const pz = G.player ? G.player.z : 16;
  const rb = { x: BOULEVARD_X, z: pz - 26, cars: [] };
  const c1 = createCar('cruiser', BOULEVARD_X - 3.4, rb.z, Math.PI / 2 + 0.5, 0xf2f2f2);
  const c2 = createCar('cruiser', BOULEVARD_X + 3.6, rb.z - 1.5, Math.PI / 2 - 0.45, 0xf2f2f2);
  c1.unit = 863; c2.unit = 864;
  c1.parked = true; c2.parked = true;
  rb.cars.push(c1, c2);
  if (G.scene) {
    const coneMat = new THREE.MeshLambertMaterial({ color: 0xe8641e });
    const coneGeo = new THREE.ConeGeometry(0.3, 0.8, 7);
    for (let i = 0; i < 5; i++) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(BOULEVARD_X - 6 + i * 3, 0.4, rb.z + 1.8);
      cone.castShadow = true;
      G.scene.add(cone);
    }
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.9, 0.3),
      new THREE.MeshLambertMaterial({ color: 0xf2ead8 }));
    barrier.position.set(BOULEVARD_X, 0.45, rb.z - 3.4);
    G.scene.add(barrier);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(11, 0.24, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xc23b2e }));
    stripe.position.set(BOULEVARD_X, 0.62, rb.z - 3.4);
    G.scene.add(stripe);
  }
  G.roadblock = rb;
  return rb;
}

function spawnPursuitCar() {
  if (!G.player) return;
  const p = G.player;
  const side = Math.random() < 0.5 ? -1 : 1;
  const x = clamp(p.x + side * randRange(Math.random, 34, 48), -246, 286);
  const z = clamp(p.z + randRange(Math.random, -40, 40), -302, 302);
  const car = createCar('cruiser', x, z, Math.atan2(p.x - x, p.z - z), 0xf2f2f2);
  car.driver = 'police';
  car.unit = 860 + (G.cars.length % 9);
  return car;
}

export function updatePolice(dt) {
  if (G.shotMode) return;
  // Heat cools slowly when no fresh crime feeds it.
  _crimeHeat = Math.max(0, _crimeHeat - dt * 0.02);
  if (_crimeHeat <= 0 && G.wanted > 0) G.wanted = Math.max(G.wantedFloor || 0, G.wanted - dt * 0.03);
  G.wanted = clamp(G.wanted, 0, 5);

  const cruisers = G.cars.filter((c) => c.typeKey === 'cruiser' && c.driver === 'police' && !c.dead);
  const wantCars = G.wanted >= 3.5 ? 3 : G.wanted >= 2 ? 2 : G.wanted >= 1 ? 1 : 0;
  if (cruisers.length < wantCars) spawnPursuitCar();
  if (G.wanted >= 4 && !G.roadblock && G.player && Math.abs(G.player.x - BOULEVARD_X) < 60) {
    const rb = buildRoadblockMeshes();
    spawnRoadblockOfficers(rb);
  }
  ensureOfficers();

  // Pursuit driving: chase the player's position, ram when close.
  if (G.player) {
    for (const car of cruisers) {
      const p = G.player;
      const d = dist2d(car.x, car.z, p.x, p.z);
      const tx = p.car ? p.car.x : p.x;
      const tz = p.car ? p.car.z : p.z;
      const want = Math.atan2(tx - car.x, tz - car.z);
      let steer = 0;
      const diff = ((want - car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      steer = clamp(diff * 1.6, -1, 1);
      driveCar(car, { throttle: d > 6 ? 1 : 0.4, steer }, dt);
      if (d < 3.4 && !p.car) checkBusted(dt);
    }
  }
}

// Standing next to a live cruiser or officer with stars up ends the run.
export function checkBusted(dt) {
  if (G.shotMode || G.wanted < 1 || !G.player || G.player.car) return false;
  let near = false;
  for (const c of G.cars) {
    if (c.typeKey === 'cruiser' && !c.dead && dist2d(c.x, c.z, G.player.x, G.player.z) < 3.2) near = true;
  }
  for (const o of G.officers) {
    if (!o.down && dist2d(o.x, o.z, G.player.x, G.player.z) < 2.4) near = true;
  }
  if (!near) { G.bustTimer = 0; return false; }
  G.bustTimer = (G.bustTimer || 0) + dt;
  if (G.bustTimer > 1.6) {
    G.over = true;
    G.busted = true;
    return true;
  }
  return false;
}

// Rows for the HUD dispatch panel: nearest units first, PAPD phrasing.
export function dispatchInfo() {
  const rows = [];
  const px = G.player ? G.player.x : 0, pz = G.player ? G.player.z : 0;
  let i = 0;
  for (const c of G.cars) {
    if (c.typeKey !== 'cruiser' || c.dead) continue;
    rows.push({
      label: `UNIT-${c.unit || 860 + (i % 9)}`,
      dist: Math.round(dist2d(c.x, c.z, px, pz)),
      role: ROLES[i % ROLES.length],
    });
    i++;
  }
  for (const o of G.officers) {
    if (o.down) continue;
    rows.push({
      label: 'FOOT',
      dist: Math.round(dist2d(o.x, o.z, px, pz)),
      role: o.phase === 'fire' ? 'ENGAGING' : o.phase === 'crouch' ? 'COVER' : ROLES[i % ROLES.length],
    });
    i++;
  }
  rows.sort((a, b) => a.dist - b.dist);
  return rows.slice(0, 7);
}

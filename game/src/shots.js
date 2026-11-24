// shots.js — the film sets. Four staged scenes (cover, drive, chase,
// combat) built from the same systems the live game uses: real staging
// values, real officers, real cars, the real colonnade. The camera seats
// and every offset are locked — the approved frames were composed with
// exactly these numbers.

import { G } from './state.js';
import { BOULEVARD_X, PLACES, facadeTexture } from './city.js';
import { MISSIONS } from './story.js';
import { spawnPlayer, putPlayerInCar } from './player.js';
import { spawnPedAt, removePed, hurtPed, crowd } from './pedestrians.js';
import { spawnOfficerAt, removeOfficer } from './officers.js';
import { createCar, removeCar, syncCarMesh } from './vehicles.js';
import { buildRoadblockMeshes } from './police.js';
import { setHeliAltitude, setHeliOrbit } from './helicopter.js';
import { stageCamera } from './camera.js';
import { posePerson, showWeapon } from './people.js';
import { gunshotFx } from './effects.js';

const staged = { ally: null, officers: [], foe: null };

function clearStage() {
  for (let i = G.cars.length - 1; i >= 0; i -= 1) removeCar(G.cars[i]);
  for (let i = G.peds.length - 1; i >= 0; i -= 1) removePed(G.peds[i]);
  for (let i = G.officers.length - 1; i >= 0; i -= 1) removeOfficer(G.officers[i]);
  G.roadblock = null;
  staged.ally = null;
  staged.officers = [];
  staged.foe = null;
}

function fakeMission(mi, si, timerLeft = null) {
  G.mission = {
    def: MISSIONS[mi], stageIndex: si, state: 'active',
    timerLeft, stageT: 0, raceIndex: 0, fareIndex: 0, killsLeft: 0, targetCar: null,
  };
}

function trafficCar(type, x, z, heading, color) {
  const car = createCar(type, x, z, heading, color, Math.random);
  car.parked = true;
  syncCarMesh(car, 0);
  return car;
}

/** A window-textured backdrop slab: guaranteed architecture in frame. */
function backdrop(x, z, w, h, tint, variant, rotY = 0, dense = false) {
  const tex = facadeTexture(variant);
  tex.repeat.set(Math.max(1, Math.round(w / (dense ? 6 : 12))), Math.max(1, Math.round(h / (dense ? 6 : 12))));
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: tint });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), mat);
  m.position.set(x, h / 2, z);
  m.rotation.y = rotY;
  G.scene.add(m);
  return m;
}

/** The corner house's staged balconies fold away for the combat frame. */
export function collapseStagedBalconies() {
  const group = G.cityMeshes;
  if (!group || !group.userData.balconies) return;
  for (const bm of group.userData.balconies) {
    const b = bm.userData.building;
    if (b && b.face === 'S' && b.name === 'CORNER') bm.position.y = -60;
  }
}

function stageCover() {
  G.timeHours = 17.55;
  G.cash = 250;
  G.respect = 40;
  G.wanted = 0;
  G.weapons.unlocked = { fists: true, pistol: true, smg: false, shotgun: false };
  G.weapons.ammo = { pistol: 60, smg: 0, shotgun: 0 };
  G.weapons.current = 'pistol';
  const p = spawnPlayer(-191.9, -5.0);
  p.heading = -2.53;
  p.mesh.rotation.y = -2.53;
  posePerson(p.mesh, 'chat', 1.1);
  showWeapon(p.mesh, 'pistol', 'hip');
  const marisol = spawnPedAt(-193.5, -7.3, 'stand', { name: 'marisol', color: 0xd8402e, heading: 0.61, pose: 'chat', phase: 0.2 });
  marisol.heading = 0.61;
  const pair = (x1, z1, x2, z2, seed) => {
    const a = spawnPedAt(x1, z1, 'stand', { pose: 'chat', seed, phase: seed });
    const b = spawnPedAt(x2, z2, 'stand', { pose: 'chat', seed: seed + 40, phase: seed + 1 });
    a.heading = Math.atan2(b.x - a.x, b.z - a.z);
    b.heading = Math.atan2(a.x - b.x, a.z - b.z);
  };
  pair(-190.2, -3.2, -190.2, -1.6, 3);
  pair(-189.5, -6.5, -189.5, -4.9, 7);
  spawnPedAt(-190.6, -11.5, 'stand', { heading: Math.PI / 2, pose: 'idle', seed: 11 });
  spawnPedAt(-189.6, -2.5, 'stand', { heading: Math.PI / 2, pose: 'idle', seed: 12 });
  spawnPedAt(-192.5, -14.5, 'stand', { heading: 2.6, pose: 'idle', seed: 13 });
  spawnPedAt(-196, -15, 'stand', { heading: 2.2, pose: 'idle', seed: 14 });
  spawnPedAt(-200.3, -20, 'sit', { heading: -Math.PI / 2, pose: 'sit', seed: 15 });
  // Crowds further down the promenade.
  crowd(-196, 10, 6, 11);
  crowd(-188, 26, 4, 13, ['walk', 'idle']);
  trafficCar('sedan', BOULEVARD_X - 3.5, 48, Math.PI, 0xe8e3d5);
  trafficCar('taxi', BOULEVARD_X + 3.5, -34, 0, undefined);
  trafficCar('sport', BOULEVARD_X - 3.5, -58, Math.PI, 0xffcf3f);
  trafficCar('sedan', -222.6, 14, 0, 0x8a9db5);
  trafficCar('truck', -201.4, 34, Math.PI, undefined);
  fakeMission(0, 0);
  G.dialogue = { lines: MISSIONS[0].intro, index: 1, onDone: null };
  stageCamera(-195.9, 1.55, -3.1, -192.9, 1.2, -6.1);
}

function stageDrive() {
  G.timeHours = 17.3;
  G.cash = 1450;
  G.respect = 640;
  G.wanted = 0;
  G.weapons.unlocked = { fists: true, pistol: true, smg: true, shotgun: false };
  G.weapons.ammo = { pistol: 42, smg: 80, shotgun: 0 };
  G.weapons.current = 'pistol';
  spawnPlayer(140, -36.5);
  const car = putPlayerInCar('sport', 140, -36.5, Math.PI / 2, 0xff5347);
  if (car) car.speed = 15;
  trafficCar('sedan', 172, -36.5, Math.PI / 2, 0xe8e3d5);
  trafficCar('taxi', 104, -43.5, Math.PI / 2, undefined);
  trafficCar('truck', 143.5, 8, Math.PI, undefined);
  trafficCar('sedan', 96, -36.5, Math.PI / 2, 0x35b06f);
  crowd(126, -22, 5, 23);
  crowd(168, -52, 4, 29);
  fakeMission(1, 2, 87);
  G.mapOpen = true;
  stageCamera(128, 4.2, -36.5, 152, 1.1, -36.5);
}

function stageChase() {
  G.timeHours = 19.05;
  G.cash = 2320;
  G.respect = 905;
  G.weapons.unlocked = { fists: true, pistol: true, smg: true, shotgun: true };
  G.weapons.ammo = { pistol: 31, smg: 55, shotgun: 12 };
  G.weapons.current = 'shotgun';
  const px = BOULEVARD_X + 3.5;
  spawnPlayer(px, 16);
  const car = putPlayerInCar('sedan', px, 16, Math.PI, 0xd8402e);
  if (car) car.speed = 23;
  const rb = buildRoadblockMeshes();
  // The pursuit sandwich: two Interceptors fill the foreground, close
  // enough that dispatch reads them at arm's length.
  const hunt1 = createCar('cruiser', BOULEVARD_X - 2.0, 26.5, Math.PI + 0.1, undefined, Math.random);
  hunt1.police = true;
  hunt1.unitNo = 168;
  hunt1.role = 'FLANK';
  const hunt2 = createCar('cruiser', BOULEVARD_X + 10, 27, Math.PI - 0.08, undefined, Math.random);
  hunt2.police = true;
  hunt2.unitNo = 166;
  hunt2.role = 'RAM';
  for (const rc of rb.cars) { rc.police = true; rc.unitNo = 167; rc.role = 'BLOCK'; }
  for (const off of G.officers) {
    if (off.roadblock === rb) off.heading = Math.atan2(px - off.x, 16 - off.z);
  }
  trafficCar('sedan', BOULEVARD_X + 3.5, 8, Math.PI, 0xe8e3d5);
  trafficCar('taxi', BOULEVARD_X - 3.5, 10, 0, undefined);
  G.wanted = 4.4;
  G.heliSeesPlayer = true;
  setHeliAltitude(22);
  setHeliOrbit(-3.53);
  fakeMission(2, 1);
  // Set backdrop: a wall of lit facades behind the roadblock.
  backdrop(BOULEVARD_X - 26, -46, 20, 15, 0xe8b48c, 1);
  backdrop(BOULEVARD_X - 3, -47, 22, 19, 0xd8c9a8, 3);
  backdrop(BOULEVARD_X + 22, -46, 20, 13, 0xcbb79a, 5);
  stageCamera(BOULEVARD_X + 6.5, 3.8, 36.5, BOULEVARD_X + 2.5, 1.0, -4);
}

function stageCombat() {
  const at = PLACES.alleyShootout;
  G.timeHours = 18.25;
  G.cash = 1980;
  G.respect = 780;
  G.wanted = 2.2;
  G.weapons.unlocked = { fists: true, pistol: true, smg: true, shotgun: true };
  G.weapons.ammo = { pistol: 26, smg: 64, shotgun: 7 };
  G.weapons.current = 'shotgun';
  collapseStagedBalconies();
  const p = spawnPlayer(at.x - 5.6, at.z - 5.4);
  p.heading = 0.62;
  p.mesh.rotation.y = 0.62;
  posePerson(p.mesh, 'aim', 0);
  showWeapon(p.mesh, 'shotgun', 'hand');
  // The Red Sails ally, shoulder to shoulder with the player.
  const ally = spawnPedAt(at.x - 3.9, at.z - 4.2, 'stand', { color: 0xd8402e, pose: 'aim', seed: 31 });
  ally.heading = 0.9;
  ally.mesh.rotation.y = 0.9;
  posePerson(ally.mesh, 'aim', 0.3);
  showWeapon(ally.mesh, 'pistol', 'hand');
  staged.ally = ally;
  // One hostile already down in the open.
  const down = spawnPedAt(at.x + 6, at.z + 3, 'stand', { color: 0xd8402e, seed: 32 });
  hurtPed(down, 500);
  // The surrendering civilian by the crates.
  const civ = spawnPedAt(at.x + 5.8, at.z - 5.8, 'stand', { pose: 'surrender', seed: 33 });
  civ.heading = -2.2;
  posePerson(civ.mesh, 'surrender', 0);
  // Crates.
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7648 });
  const crate = (x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), crateMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    G.scene.add(m);
  };
  crate(at.x + 6.6, 0.55, at.z - 4.4);
  crate(at.x + 6.6, 1.65, at.z - 4.4);
  crate(at.x + 7.8, 0.55, at.z - 4.6);
  // The staged cruiser the officers belong to.
  const copCar = trafficCar('cruiser', at.x + 2, at.z + 7, 2.6, undefined);
  copCar.police = true;
  copCar.unitNo = 166;
  copCar.role = 'RAM';
  const face = (o) => { o.heading = Math.atan2(ally.x - o.x, ally.z - o.z); o.foe = ally; };
  const offOpen = spawnOfficerAt(at.x - 0.8, at.z + 1.8, { phase: 'fire', homeCar: copCar });
  const offRoof = spawnOfficerAt(at.x - 3.6, at.z + 13.6, { phase: 'fire', homeCar: copCar });
  const offFlank = spawnOfficerAt(at.x - 7.2, at.z + 7.8, { phase: 'fire', homeCar: copCar });
  const downOff = spawnOfficerAt(at.x - 7.0, at.z - 2.2, { phase: 'crouch', homeCar: copCar });
  const offCiv = spawnOfficerAt(at.x + 4.4, at.z - 5.0, { phase: 'fire', homeCar: copCar });
  for (const o of [offOpen, offRoof, offFlank, offCiv]) face(o);
  downOff.dead = true;
  posePerson(downOff.mesh, 'down', 0);
  staged.officers = [offOpen, offRoof, offFlank, offCiv];
  staged.foe = ally;
  fakeMission(3, 2);
  // Set backdrops behind the alley: dense windows, warm tints.
  backdrop(at.x + 2, at.z + 27, 26, 16, 0xe8c9a0, 2, 0, true);
  backdrop(at.x + 26, at.z + 8, 24, 13, 0xd8b490, 4, -Math.PI / 2, true);
  stageCamera(at.x - 9.5, 2.7, at.z - 8.5, at.x + 1.2, 1.0, at.z + 2.8);
}

export function stageShotScene(name, seed = 1) {
  void seed;
  clearStage();
  G.shotMode = name;
  G.mode = 'playing';
  G.dialogue = null;
  G.mapOpen = false;
  G.messageT = 0;
  if (name === 'cover') stageCover();
  else if (name === 'drive') stageDrive();
  else if (name === 'chase') stageChase();
  else if (name === 'combat') stageCombat();
  // One settle pass so every mesh sits exactly where staging put it.
  for (const car of G.cars) syncCarMesh(car, 0);
}

/**
 * Per-frame staging driver: the combat set runs a continuous volley from
 * frame 10 so the shutter (frame ~90) always catches live tracers and a
 * fresh muzzle flash — the approved frame is mid-exchange, not posed.
 */
export function updateShotScene(frame) {
  if (G.shotMode !== 'combat' || frame < 30) return;
  const ally = staged.ally;
  const p = G.player;
  if (!ally || !p) return;
  // A live-fire cadence, not a barrage: at the recipe's per-shot smoke
  // counts, a shot every few frames keeps the air Wispy the way the
  // approved frame reads — a shot every frame stacks into a cloud.
  const officers = staged.officers.filter((o) => !o.dead);
  if (frame % 5 === 0 && officers.length) {
    const o = officers[Math.floor(frame / 5) % officers.length];
    gunshotFx(o.x + Math.sin(o.heading) * 0.45, 1.28, o.z + Math.cos(o.heading) * 0.45, ally.x, 1.1, ally.z, 'pistol');
  }
  if (frame % 7 === 3 && officers.length) {
    const o = officers[frame % officers.length];
    gunshotFx(ally.x + Math.sin(ally.heading) * 0.45, 1.3, ally.z + Math.cos(ally.heading) * 0.45, o.x, 1.15, o.z, 'pistol');
  }
  if (frame % 9 === 4 && officers.length) {
    gunshotFx(p.x + Math.sin(p.heading) * 0.6, 1.32, p.z + Math.cos(p.heading) * 0.6,
      officers[0].x, 1.1, officers[0].z, 'shotgun');
  }
}

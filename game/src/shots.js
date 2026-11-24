// shots.js — the four staged screenshot scenes: cover, drive (map), chase,
// combat. Each one rebuilds the world state from scratch — actors cleared,
// progression set, camera locked — so a capture is a deterministic frame
// of the real game, never a diorama pasted on top of it.

import { G } from './state.js';
import { makeRng, randRange } from './util.js';
import { stageCamera } from './camera.js';
import { spawnPlayer } from './player.js';
import { spawnPedAt, posePed, removePed } from './pedestrians.js';
import { posePerson, showWeapon } from './people.js';
import { spawnOfficerAt, removeOfficer, officerShoot } from './officers.js';
import { buildRoadblockMeshes } from './police.js';
import { createCar, removeCar } from './vehicles.js';
import { setHeliAltitude, setHeliOrbit } from './helicopter.js';
import { gunshotFx, burst } from './effects.js';
import { PLACES, BOULEVARD_X, facadeTexture } from './city.js';
import { MISSIONS } from './story.js';
import { rankFor } from './state.js';

let _staged = null; // per-scene handles updateShotScene animates

function clearActors() {
  for (const car of [...G.cars]) removeCar(car);
  for (const ped of [...G.peds]) removePed(ped);
  for (const off of [...G.officers]) removeOfficer(off);
  G.roadblock = null;
}

function resetState() {
  G.wanted = 0;
  G.wantedFloor = 0;
  G.dialogue = null;
  G.mapOpen = false;
  G.heliSeesPlayer = false;
  G.health = 100;
  G.armor = 0;
  G.over = false;
  G.busted = false;
}

function fakeMission(index, stage) {
  G.mission = { index, stage, timerLeft: null, active: true, checkpoint: 0, kills: 0, targetPed: null };
}

function setProgression(cash, respect, unlocked, ammo, weapon) {
  G.cash = cash;
  G.respect = respect;
  G.rankIndex = rankFor(respect).index;
  G.unlocked = unlocked;
  G.ammo = ammo;
  G.weapon = weapon;
}

function place(ped, heading, pose, phase = 0) {
  ped.heading = heading;
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = heading;
  posePed(ped, pose, phase);
  return ped;
}

function crowd(x, z, n, seed, modes = ['walk', 'idle']) {
  const rng = makeRng(seed * 977 + 13);
  const made = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.7;
    const r = 1.6 + rng() * 3.4;
    const ped = spawnPedAt(x + Math.cos(a) * r, z + Math.sin(a) * r, 'stand', { seed: seed * 100 + i, staged: true });
    const mode = modes[i % modes.length];
    const heading = rng() * Math.PI * 2;
    place(ped, heading, mode === 'walk' ? 'walk' : mode === 'chat' ? 'chat' : 'stand', rng() * 6);
    made.push(ped);
  }
  return made;
}

function trafficCar(type, x, z, heading, color, speed = 0) {
  const car = createCar(type, x, z, heading, color, makeRng(x * 31 + z));
  car.driver = 'traffic';
  car.speed = speed;
  return car;
}

function parkedCar(type, x, z, heading, color) {
  const car = createCar(type, x, z, heading, color, makeRng(x * 17 + z));
  car.parked = true;
  return car;
}

// A window-textured backdrop slab: in-frame architecture behind a staged
// seat, dense regardless of where the generated city put its blocks.
function placeBackdrop(x, z, w, h, ry, tint, winScale = 6) {
  const tex = facadeTexture(2, false);
  const geo = new THREE.BoxGeometry(w, h, 5);
  const uv = geo.attributes.uv;
  const faceW = [5, 5, w, w, w, 5];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * (faceW[f] / winScale), uv.getY(i) * (h / winScale));
    }
  }
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: tint });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, h / 2, z);
  m.rotation.y = ry;
  m.castShadow = true;
  G.scene.add(m);
  return m;
}

function addCrates(x, z, n) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xb08954 });
  const edge = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), i % 2 ? mat : edge);
    c.position.set(x + (i === 2 ? 0.3 : 0), 0.58 + Math.floor(i / 2) * 1.16, z + (i === 2 ? 0.2 : 0));
    c.rotation.y = i * 0.24;
    c.castShadow = true;
    G.scene.add(c);
  }
}

// The corner house's balcony boards come down for the staged fight, the
// way the owner ordered: scene and positions otherwise untouched.
function collapseStagedBalconies(at) {
  if (!G.city) return;
  for (const b of G.city.buildings) {
    if (!b.balconyMeshes) continue;
    if (Math.abs(b.x - at.x) > 34 || Math.abs(b.z - at.z) > 34) continue;
    for (const m of b.balconyMeshes) m.visible = false;
  }
}

// ---------------------------------------------------------------------------

function stageCover() {
  G.timeHours = 17.55;
  setProgression(250, 40,
    { fists: true, pistol: true, smg: false, shotgun: false },
    { pistol: 60, smg: 0, shotgun: 0 }, 'pistol');
  const player = spawnPlayer(-191.9, -5.0);
  player.heading = -2.53;
  player.pose = 'chat';
  showWeapon(player.mesh, 'pistol', 'hip');

  const marisol = spawnPedAt(-193.5, -7.3, 'stand', { name: 'marisol', color: 0xd8402e, dress: true, staged: true, seed: 777 });
  place(marisol, 0.61, 'chat', 0.2);

  const pair = (x1, z1, x2, z2, s) => {
    const a = spawnPedAt(x1, z1, 'stand', { staged: true, seed: s });
    const b = spawnPedAt(x2, z2, 'stand', { staged: true, seed: s + 1 });
    place(a, Math.atan2(x2 - x1, z2 - z1), 'chat', 0.4);
    place(b, Math.atan2(x1 - x2, z1 - z2), 'chat', 1.7);
  };
  pair(-190.2, -3.2, -190.2, -1.6, 810);
  pair(-189.5, -6.5, -189.5, -4.9, 820);
  place(spawnPedAt(-190.6, -11.5, 'stand', { staged: true, seed: 830 }), Math.PI / 2, 'stand', 0);
  place(spawnPedAt(-189.6, -2.5, 'stand', { staged: true, seed: 831 }), Math.PI / 2, 'stand', 0);
  place(spawnPedAt(-192.5, -14.5, 'stand', { staged: true, seed: 832 }), 2.6, 'walk', 1.2);
  place(spawnPedAt(-196, -15, 'stand', { staged: true, seed: 833 }), 2.2, 'walk', 3.4);
  place(spawnPedAt(-200.3, -20, 'stand', { staged: true, seed: 834 }), -Math.PI / 2, 'sit', 0);
  // A bench for the sitter.
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x8a6a44 }));
  bench.position.set(-200.3, 0.45, -20.4);
  G.scene.add(bench);

  crowd(-196, 10, 6, 11);
  crowd(-188, 26, 4, 13, ['walk', 'idle']);
  trafficCar('sedan', BOULEVARD_X - 3.5, 48, Math.PI, 0xe8e3d5);
  trafficCar('taxi', BOULEVARD_X + 3.5, -34, 0, undefined);
  trafficCar('sport', BOULEVARD_X - 3.5, -58, Math.PI, 0xffcf3f);
  parkedCar('sedan', -222.6, 14, 0, 0x8a9db5);
  parkedCar('truck', -201.4, 34, Math.PI, undefined);

  fakeMission(0, 0);
  G.dialogue = { lines: MISSIONS[0].intro, index: 1, onDone: null };
  stageCamera(-195.9, 1.55, -3.1, -192.9, 1.2, -6.1);
  _staged = { player, kind: 'cover' };
}

function stageDrive() {
  G.timeHours = 17.3;
  setProgression(1450, 640,
    { fists: true, pistol: true, smg: true, shotgun: false },
    { pistol: 42, smg: 80, shotgun: 0 }, 'pistol');
  G.rankIndex = 3;
  const player = spawnPlayer(140, -36.5);
  const car = createCar('sport', 140, -36.5, Math.PI / 2, 0xff5347, makeRng(4));
  car.driver = 'player';
  car.speed = 15;
  player.car = car;
  player.mesh.visible = false;

  trafficCar('sedan', 172, -36.5, Math.PI / 2, 0xe8e3d5, 9);
  trafficCar('taxi', 104, -43.5, Math.PI / 2, undefined, 8);
  trafficCar('truck', 143.5, 8, Math.PI, undefined, 0);
  trafficCar('sedan', 96, -36.5, Math.PI / 2, 0x35b06f, 9);
  crowd(126, -22, 5, 23);
  crowd(168, -52, 4, 29);

  fakeMission(1, 2);
  G.mission.timerLeft = 87;
  G.mapOpen = true;
  stageCamera(128, 4.2, -36.5, 152, 1.1, -36.5);
  _staged = { player, kind: 'drive' };
}

function stageChase() {
  G.timeHours = 19.05;
  setProgression(2320, 905,
    { fists: true, pistol: true, smg: true, shotgun: true },
    { pistol: 31, smg: 55, shotgun: 12 }, 'shotgun');
  const player = spawnPlayer(BOULEVARD_X + 3.5, 16);
  const car = createCar('sedan', BOULEVARD_X + 3.5, 16, Math.PI, 0xe8e3d5, makeRng(6));
  car.driver = 'player';
  car.speed = 23;
  player.car = car;
  player.mesh.visible = false;

  const rb = buildRoadblockMeshes();
  const o1 = spawnOfficerAt(rb.x - 2.2, rb.z + 2.8, { phase: 'crouch', roadblock: rb, homeCar: rb.cars[0], staged: true });
  const o2 = spawnOfficerAt(rb.x + 5.4, rb.z + 2.8, { phase: 'fire', roadblock: rb, homeCar: rb.cars[0], staged: true });
  o1.heading = 0; o2.heading = 0;
  o1.mesh.rotation.y = 0; o2.mesh.rotation.y = 0;

  trafficCar('sedan', BOULEVARD_X + 3.5, 8, Math.PI, 0xe8e3d5, 3);
  trafficCar('taxi', BOULEVARD_X - 3.5, 10, 0, undefined, 11);
  // Pursuit cruisers right on the player's tail, filling the frame's
  // foreground corners the way a real chase shot breathes.
  const tail1 = trafficCar('cruiser', BOULEVARD_X - 2.5, 29, Math.PI, 0xf2f2f2, 21);
  const tail2 = trafficCar('cruiser', BOULEVARD_X + 8.5, 31, Math.PI, 0xf2f2f2, 21);
  tail1.driver = 'police'; tail2.driver = 'police';
  tail1.unit = 865; tail2.unit = 866;

  G.wanted = 4.4;
  G.heliSeesPlayer = true;
  setHeliAltitude(22);
  setHeliOrbit(-3.53);
  fakeMission(2, 1);
  placeBackdrop(-238, -34, 20, 30, 0.2, 0xf2c184);
  placeBackdrop(-186, -58, 22, 24, -0.15, 0xef9f7d);
  stageCamera(BOULEVARD_X + 6.5, 3.8, 36.5, BOULEVARD_X + 2.5, 1.0, -4);
  _staged = { player, kind: 'chase', officers: [o1, o2] };
}

function stageCombat() {
  G.timeHours = 18.25;
  setProgression(1980, 780,
    { fists: true, pistol: true, smg: true, shotgun: true },
    { pistol: 26, smg: 64, shotgun: 7 }, 'shotgun');
  G.rankIndex = 3;
  const at = PLACES.alleyShootout;
  const player = spawnPlayer(at.x - 5.6, at.z - 5.4);
  player.heading = 0.62;
  player.pose = 'aim';
  showWeapon(player.mesh, 'shotgun', 'hand');

  const propCar = parkedCar('sedan', at.x - 2.5, at.z + 3.2, 0.4, 0x57a8d8);
  const copCar = parkedCar('cruiser', at.x + 3.5, at.z + 5.5, -0.9, 0xf2f2f2);

  const ally = spawnPedAt(player.x + 2.9, player.z - 1.2, 'stand', { staged: true, seed: 950, outfit: { shirt: 0xd8402e } });
  ally.name = 'ally';
  showWeapon(ally.mesh, 'smg', 'hand');

  const mk = (x, z, phase) => spawnOfficerAt(x, z, { phase, homeCar: copCar, staged: true });
  const offOpen = mk(at.x - 0.8, at.z + 1.8, 'fire');
  const offRoof = mk(at.x - 3.6, at.z + 13.6, 'fire');
  const offFlank = mk(at.x - 7.2, at.z + 7.8, 'fire');
  const downOff = mk(at.x - 7.0, at.z - 2.2, 'crouch');
  const offCiv = mk(at.x + 4.4, at.z - 5.0, 'fire');
  const face = (off, t) => { off.heading = Math.atan2(t.x - off.x, t.z - off.z); off.mesh.rotation.y = off.heading; off.target = t; };
  face(offOpen, ally); face(offRoof, ally); face(offFlank, player); face(offCiv, ally);
  downOff.down = true;
  posePerson(downOff.mesh, 'down', 0);
  downOff.mesh.position.set(downOff.x, downOff.mesh.userData.yOff || 0, downOff.z);
  place(ally, Math.atan2(offOpen.x - ally.x, offOpen.z - ally.z), 'aim', 0);

  const hostile = spawnPedAt(at.x + 2, at.z + 7, 'stand', { staged: true, seed: 960, outfit: { shirt: 0xd8402e } });
  hostile.down = true;
  place(hostile, 2.4, 'down', 0);
  const civilian = spawnPedAt(at.x + 5.2, at.z - 5.6, 'stand', { staged: true, seed: 961 });
  place(civilian, -1.8, 'surrender', 0);

  addCrates(at.x + 6.8, at.z - 3.8, 3);
  addCrates(at.x - 1.5, at.z + 6.5, 2);
  collapseStagedBalconies(at);
  placeBackdrop(at.x + 17, at.z + 15, 24, 20, -2.25, 0xd87a4e);
  placeBackdrop(at.x + 9, at.z + 25, 26, 23, -2.6, 0xdfa55e);
  placeBackdrop(at.x + 22, at.z + 1, 20, 16, -1.9, 0x7fa8c9);

  G.wanted = 2.2;
  fakeMission(3, 2);
  stageCamera(at.x - 9.5, 2.7, at.z - 8.5, at.x + 1.2, 1.0, at.z + 2.8);
  _staged = { player, kind: 'combat', ally, officers: [offOpen, offRoof, offFlank, offCiv], copCar, propCar };
}

export function stageShotScene(name, seed = 1) {
  G.shotMode = true;
  G.shotName = name;
  clearActors();
  resetState();
  _staged = null;
  if (name === 'cover') stageCover();
  else if (name === 'drive') stageDrive();
  else if (name === 'chase') stageChase();
  else if (name === 'combat') stageCombat();
  return _staged;
}

// Per-frame staging direction: hold the poses, keep the gunfight alive in
// the frames before the shutter, and signal readiness on schedule.
export function updateShotScene(frame) {
  if (!_staged) return frame > 30;
  const s = _staged;
  const p = s.player;
  if (p && !p.car) {
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    if (s.kind === 'cover') posePerson(p.mesh, 'chat', 1.1 + frame * 0.03);
    if (s.kind === 'combat') posePerson(p.mesh, frame >= 86 && frame <= 92 ? 'fire' : 'aim', frame * 0.1);
  }
  if (s.kind === 'combat') {
    // Continuous ragged fire from frame 25 on: one officer shoots every
    // frame in rotation, the ally answers every third frame, so whatever
    // frame the shutter lands on holds a live tracer and a fresh flash.
    if (frame >= 25) {
      for (const off of s.officers) officerShoot(off);
      if (s.ally) {
        const t = s.officers[frame % s.officers.length];
        gunshotFx(s.ally.x + 0.3, 1.32, s.ally.z + 0.3, t.x, 1.1, t.z, { heading: s.ally.heading });
      }
      const t = s.officers[0];
      gunshotFx(p.x + 0.4, 1.34, p.z + 0.3, t.x, 1.15, t.z, { heading: p.heading, muzzleScale: 1.25 });
      if (frame % 13 === 7) burst(s.copCar.x, 1.0, s.copCar.z, 0xffcf7a, 5, 2.0, {});
    }
    return frame >= 60;
  }
  if (s.kind === 'chase') {
    if (frame === 59 && s.officers) officerShoot(s.officers[1]);
    return frame >= 60;
  }
  return frame >= 45;
}

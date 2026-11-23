// shots.js — the deterministic screenshot scenes behind ?shot=<name>&seed=<n>.
// Each one builds a real, populated moment of the game — the actual mission
// state, police cars, officers, helicopter and HUD data — then hands main.js
// a camera. Nothing here is drawn or faked: it is the game, arranged. Round
// two stages them CLOSE: the subjects fill the frame, the market crowds the
// cover, the chase sits on the boulevard with its roadblock in view, the
// combat is a genuine crossfire — and the drive shot opens the full-screen
// city map over the delivery run. updateShotScene() keeps the frozen frames
// alive (lightbars, tracers, sparks) while the shutter settles.

import { G } from './state.js';
import { PLACES, BOULEVARD_X } from './city.js';
import { MISSIONS } from './story.js';
import { createCar, flashLightbars, syncCarMesh } from './vehicles.js';
import { spawnPedAt, posePed } from './pedestrians.js';
import { spawnOfficerAt } from './officers.js';
import { buildRoadblockMeshes } from './police.js';
import { spawnPlayer } from './player.js';
import { setHeliOrbit } from './helicopter.js';
import { stageCamera } from './camera.js';
import { posePerson } from './people.js';
import { burst, burstSmoke, gunshotFx } from './effects.js';
import { makeRng } from './util.js';

function fakeMission(defIndex, stageIndex, extra = {}) {
  const def = MISSIONS[defIndex];
  G.mission = {
    def, stageIndex, targetCar: null, hostiles: [], hostilesLeft: 0,
    timerLeft: null, farePhase: null, farePair: null, fareCount: 0, raceIndex: 0,
    onEnterCar: null, onPedDown: null, ...extra,
  };
  return G.mission;
}

function trafficCar(type, x, z, heading, color = null) {
  const car = createCar(type, x, z, heading, color, makeRng(x * 31 + z));
  car.driver = 'traffic';
  G.trafficCars.push(car);
  return car;
}

function parkedCar(type, x, z, heading, color = null) {
  const car = createCar(type, x, z, heading, color, makeRng(x * 17 + z * 3));
  car.driver = 'parked';
  G.parkedCars.push(car);
  return car;
}

function cruiser(x, z, heading, tactic) {
  const car = createCar('cruiser', x, z, heading, 0xf2f2f2, null);
  car.driver = 'police';
  car.tactic = tactic;
  G.policeCars.push(car);
  return car;
}

function putPlayerInCar(type, x, z, heading, color = null) {
  const car = createCar(type, x, z, heading, color, null);
  car.driver = 'player';
  G.player.inCar = car;
  G.player.x = x; G.player.z = z; G.player.heading = heading;
  if (G.player.mesh) G.player.mesh.visible = false; // seated: no figure through the roof
  return car;
}

/** A little crowd, posed where they stand (shot mode never animates them). */
function crowd(cx, cz, n, seed, poses = ['walk', 'idle', 'chat']) {
  const rng = makeRng(seed);
  for (let i = 0; i < n; i += 1) {
    const ped = spawnPedAt(cx + (rng() - 0.5) * 20, cz + (rng() - 0.5) * 20, 'walk', { ambient: false });
    ped.heading = rng() * Math.PI * 2;
    posePed(ped, poses[Math.floor(rng() * poses.length)], rng() * 6, { armsUp: false });
  }
}

let shotKind = null;

/** Stage the named scene. Returns nothing; the camera is placed here. */
export function stageShotScene(name, seed = 1) {
  const rng = makeRng(seed * 1013 + 7);
  G.mode = 'playing';
  shotKind = name;

  if (name === 'drive') return stageDrive(rng);
  if (name === 'chase') return stageChase(rng);
  if (name === 'combat') return stageCombat(rng);
  return stageCover(rng);
}

// ------------------------------------------------------------------- cover
function stageCover(rng) {
  G.timeHours = 17.55;
  G.cash = 250; G.respect = 40;
  spawnPlayer(-191.5, -4.5);
  G.player.heading = -2.48; // facing Marisol
  posePed(G.player, 'chat', 1.1);
  // Marisol, mid-conversation on her corner, in her red dress.
  const marisol = spawnPedAt(-193.8, -7.6, 'stand', { name: 'marisol', color: 0xd8402e });
  marisol.heading = 0.66;
  posePed(marisol, 'chat', 0.2);

  // The market crowds in: a chatting pair between the subjects and the
  // stalls, browsers at the goods, walkers crossing, a sitter on the bench.
  const a = spawnPedAt(-190.2, -3.2, 'chat', {});
  const b = spawnPedAt(-190.2, -1.6, 'chat', {});
  a.heading = Math.atan2(b.x - a.x, b.z - a.z);
  b.heading = Math.atan2(a.x - b.x, a.z - b.z);
  posePed(a, 'chat', 0.7); posePed(b, 'chat', 2.1);
  const c2 = spawnPedAt(-189.5, -6.5, 'chat', {});
  const d2 = spawnPedAt(-189.5, -4.9, 'chat', {});
  c2.heading = Math.atan2(d2.x - c2.x, d2.z - c2.z);
  d2.heading = Math.atan2(c2.x - d2.x, c2.z - d2.z);
  posePed(c2, 'chat', 1.9); posePed(d2, 'chat', 0.4);
  const browser = spawnPedAt(-190.6, -11.5, 'stand', {});
  browser.heading = Math.PI / 2;
  posePed(browser, 'idle', 1.4);
  const browser2 = spawnPedAt(-189.6, -2.5, 'stand', {});
  browser2.heading = Math.PI / 2;
  posePed(browser2, 'idle', 2.8);
  const walker = spawnPedAt(-192.5, -14.5, 'walk', {});
  walker.heading = 2.6;
  posePed(walker, 'walk', 2.2);
  const walker2 = spawnPedAt(-196, -15, 'walk', {});
  walker2.heading = 2.2;
  posePed(walker2, 'walk', 4.4);
  const sitter = spawnPedAt(-200.3, -20, 'sit', {});
  sitter.heading = -Math.PI / 2;
  posePed(sitter, 'sit', 0.5);
  crowd(-196, 10, 6, 11);
  crowd(-188, 26, 4, 13, ['walk', 'idle']);

  trafficCar('sedan', BOULEVARD_X - 3.5, 48, Math.PI, 0xe8e3d5);
  trafficCar('taxi', BOULEVARD_X + 3.5, -34, 0, null);
  trafficCar('sport', BOULEVARD_X - 3.5, -58, Math.PI, 0xffcf3f);
  parkedCar('sedan', -222.6, 14, 0, 0x8a9db5);
  parkedCar('truck', -201.4, 34, Math.PI, null);

  fakeMission(0, 0);
  G.dialogue = { lines: MISSIONS[0].intro, index: 1, onDone: null };
  // A close profile two-shot from the beach side: the pair large, the market
  // stalls, colonnade and signed facades stacked behind them.
  stageCamera(-197.2, 1.6, -2.2, -192.9, 1.25, -6.1);
}

// ------------------------------------------------------------------- drive
function stageDrive(rng) {
  G.timeHours = 17.3;
  G.cash = 1450; G.respect = 640; G.rankIndex = 3;
  G.unlockedWeapons = ['fists', 'pistol', 'smg'];
  G.ammo = { pistol: 42, smg: 80, shotgun: 0 };
  G.currentWeapon = 'pistol';
  spawnPlayer(140, -36.5);
  const car = putPlayerInCar('sport', 140, -36.5, Math.PI / 2, 0xff5347);
  car.speed = 15;
  trafficCar('sedan', 172, -36.5, Math.PI / 2, 0xe8e3d5);
  trafficCar('taxi', 104, -43.5, Math.PI / 2, null);
  trafficCar('truck', 143.5, 8, Math.PI, null);
  trafficCar('sedan', 96, -36.5, Math.PI / 2, 0x35b06f);
  crowd(126, -22, 5, 23);
  crowd(168, -52, 4, 29);
  const m = fakeMission(1, 2); // Hot Delivery, the timed marina run
  m.timerLeft = 87;
  // The full-screen city map is open over the run: route to the marina gate.
  G.mapOpen = true;
  stageCamera(128, 4.2, -36.5, 152, 1.1, -36.5);
}

// ------------------------------------------------------------------- chase
function stageChase(rng) {
  G.timeHours = 19.05;
  G.cash = 2320; G.respect = 905; G.rankIndex = 4;
  G.unlockedWeapons = ['fists', 'pistol', 'smg', 'shotgun'];
  G.ammo = { pistol: 31, smg: 55, shotgun: 12 };
  G.currentWeapon = 'smg';
  spawnPlayer(BOULEVARD_X + 3.5, 16);
  const car = putPlayerInCar('sedan', BOULEVARD_X + 3.5, 16, Math.PI, 0xd84f35);
  car.speed = 23;
  car.hp = 30; // smoking hard
  syncCarMesh(car, 0);

  // The hunt, tight around the player: two rammers behind, a flanker in the
  // oncoming lane at the quarter panel, and the roadblock ahead.
  cruiser(BOULEVARD_X + 5.5, 27, Math.PI, 'RAM');
  cruiser(BOULEVARD_X + 2.5, 29.5, Math.PI, 'RAM');
  cruiser(BOULEVARD_X - 3.8, 18, Math.PI * 0.97, 'FLANK');
  const rbCars = [
    cruiser(BOULEVARD_X + 0.1, -2, Math.PI / 2, 'BLOCK'),
    cruiser(BOULEVARD_X + 7.1, -2, -Math.PI / 2, 'BLOCK'),
  ];
  for (const c of rbCars) c.anchored = true;
  const rb = { x: BOULEVARD_X + 3.5, z: -2, axis: 'z', cars: rbCars, timer: 999, gone: false, meshes: null };
  const meshes = buildRoadblockMeshes();
  meshes.position.set(rb.x, 0, rb.z);
  G.scene.add(meshes);
  rb.meshes = meshes;
  G.roadblock = rb;
  const o1 = spawnOfficerAt(rb.x - 2.2, rb.z + 2.8, { phase: 'crouch', roadblock: rb });
  const o2 = spawnOfficerAt(rb.x + 5.4, rb.z + 2.8, { phase: 'fire', roadblock: rb });
  o1.heading = Math.PI; o2.heading = Math.PI;
  posePerson(o1.mesh, 'aim', 0, { crouch: 0.8 });
  posePerson(o2.mesh, 'aim', 0, { crouch: 0.15 });

  // Traffic in the frame: one braking hard ahead, one fleeing southbound.
  const braking = trafficCar('sedan', BOULEVARD_X + 3.5, 8, Math.PI, 0xe8e3d5);
  braking.speed = 3;
  braking.brakeLight = true;
  syncCarMesh(braking, 0);
  const fleeing = trafficCar('taxi', BOULEVARD_X - 3.5, 10, 0, null);
  fleeing.speed = 17;
  // Parked cars line the promenade kerb.
  parkedCar('sedan', BOULEVARD_X + 10.6, 6, Math.PI, 0x57d7e8);
  parkedCar('sport', BOULEVARD_X + 10.6, -34, Math.PI, 0xf2b13c);
  parkedCar('truck', BOULEVARD_X + 10.6, 46, Math.PI, null);

  // Sidewalk panic, close enough to read.
  const f1 = spawnPedAt(BOULEVARD_X + 16.5, 4, 'flee', {});
  f1.heading = Math.PI * 0.8;
  posePed(f1, 'flee', 2.4, { armsUp: true });
  const f2 = spawnPedAt(BOULEVARD_X + 17, -12, 'flee', {});
  f2.heading = Math.PI;
  posePed(f2, 'flee', 4.1, { armsUp: false });
  const f3 = spawnPedAt(BOULEVARD_X + 16, 27, 'flee', {});
  f3.heading = Math.PI * 1.15;
  posePed(f3, 'flee', 5.3, { armsUp: true });
  const w1 = spawnPedAt(BOULEVARD_X - 12, 24, 'walk', {});
  w1.heading = 0.4;
  posePed(w1, 'walk', 1.2);

  G.wanted = 4.4;
  G.sightState = 'insight';
  G.timeSinceSeen = 0;
  G.heliSeesPlayer = true;
  setHeliOrbit(-2.74); // settles north-west of the player, up-frame
  fakeMission(2, 1);
  // Tight behind-and-above the player car, over the asphalt so no palm
  // trunk eats the frame: rammers big, the roadblock readable ahead.
  stageCamera(BOULEVARD_X + 6.5, 3.8, 36.5, BOULEVARD_X + 2.5, 1.0, -4);
}

// ------------------------------------------------------------------ combat
/** A static dressing prop for staged scenes (dumpster, crate stack). */
function prop(kind, x, z, heading = 0) {
  const grp = new THREE.Group();
  const box = (mat, sx, sy, sz, bx, by, bz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(bx, by, bz);
    m.castShadow = true;
    grp.add(m);
    return m;
  };
  if (kind === 'dumpster') {
    const green = new THREE.MeshLambertMaterial({ color: 0x3d6e46 });
    box(green, 2.7, 1.35, 1.7, 0, 0.68, 0);
    box(new THREE.MeshLambertMaterial({ color: 0x2e5636 }), 2.8, 0.12, 1.8, 0, 1.4, 0);
  } else {
    const wood = new THREE.MeshLambertMaterial({ color: 0x7d5f38 });
    box(wood, 1.3, 1.3, 1.3, 0, 0.65, 0);
    box(wood, 1.1, 1.1, 1.1, 0.2, 1.85, 0.1);
    box(wood, 1.2, 1.2, 1.2, 1.45, 0.6, 0.3);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = heading;
  G.scene.add(grp);
  return grp;
}

function stageCombat(rng) {
  G.timeHours = 18.25;
  G.cash = 1980; G.respect = 780; G.rankIndex = 3;
  G.unlockedWeapons = ['fists', 'pistol', 'smg', 'shotgun'];
  G.ammo = { pistol: 26, smg: 64, shotgun: 7 };
  G.currentWeapon = 'smg';
  const at = PLACES.alleyShootout;
  spawnPlayer(at.x - 5, at.z - 5);
  G.player.heading = 0.785; // facing the cruiser, up the alley
  posePerson(G.player.mesh, 'aim', 0, { crouch: 0.5 });
  const pParts = G.player.mesh.userData.parts;
  if (pParts?.gun) pParts.gun.visible = true;

  // His cover: a parked sedan, sideways, doors to the fight.
  const cover = parkedCar('sedan', at.x - 2.5, at.z - 2.5, Math.PI / 2, 0x2f7fd0);
  cover.hp = 55;
  // Alley dressing fills the frame's edges.
  prop('dumpster', at.x - 10.5, at.z + 1, 0.4);
  prop('crates', at.x + 10, at.z - 4, 0.2);
  prop('crates', at.x - 1, at.z + 10.5, 1.1);

  // The PAPD answers, close: a cruiser across the alley, three officers
  // behind it — two up and firing, one crouched, one already down.
  const copCar = cruiser(at.x + 1.2, at.z + 3.2, 0.5, 'RAM');
  copCar.anchored = true;
  const aimAtPlayer = (off) => { off.heading = Math.atan2(G.player.x - off.x, G.player.z - off.z); };
  const offs = [
    spawnOfficerAt(at.x + 0.5, at.z + 3.4, { phase: 'fire', homeCar: copCar }),
    spawnOfficerAt(at.x + 4.5, at.z - 1.5, { phase: 'fire', homeCar: copCar }),
    spawnOfficerAt(at.x - 0.5, at.z + 6.8, { phase: 'crouch', homeCar: copCar }),
  ];
  aimAtPlayer(offs[0]); posePerson(offs[0].mesh, 'aim', 0, { crouch: 0.15 });
  aimAtPlayer(offs[1]); posePerson(offs[1].mesh, 'aim', 0, { crouch: 0.1 });
  aimAtPlayer(offs[2]); posePerson(offs[2].mesh, 'aim', 0, { crouch: 0.85 });
  const downOff = spawnOfficerAt(at.x + 4, at.z + 5.6, { phase: 'crouch', homeCar: copCar });
  downOff.state = 'down';
  posePerson(downOff.mesh, 'down');
  downOff.mesh.rotation.x = -Math.PI / 2;
  downOff.mesh.position.y = 0.25;

  // A Red Sails hostile already down, a civilian running for her life
  // across the frame's right side.
  const downHostile = spawnPedAt(at.x + 8, at.z + 7, 'hostile', { hp: 34 });
  downHostile.state = 'down';
  posePed(downHostile, 'down');
  downHostile.mesh.rotation.x = -Math.PI / 2;
  downHostile.mesh.position.y = 0.25;
  const civ = spawnPedAt(at.x + 8, at.z - 7, 'flee', {});
  civ.heading = Math.PI / 2 + 0.3;
  posePed(civ, 'flee', 3.2, { armsUp: true });
  crowd(at.x - 14, at.z - 12, 3, 41, ['flee', 'walk']);

  // A smoking wreck behind the cruiser sells the fight's history.
  const wreck = parkedCar('sedan', at.x + 12, at.z + 11, 2.2, 0x30363e);
  wreck.hp = 10;

  const m = fakeMission(3, 2); // Palma Showdown, the escape stage
  m.hostilesLeft = 0;
  G.wanted = 2.6; // under the FALCON-1 threshold: the frame stays on the fight
  G.sightState = 'searching';
  G.timeSinceSeen = 3;
  // Close over the player's shoulder, low: his aim, their aim, the cars
  // between — and the corner building's awning kept out of the top frame.
  stageCamera(at.x - 6.4, 1.7, at.z - 6.6, at.x + 2.5, 1.05, at.z + 2);
}

/**
 * Per-frame life for the frozen scenes (main.js's shot loop calls this):
 * lightbars keep turning, the firefight keeps exchanging, the chase keeps
 * scraping and smoking — so frame 45 catches the action mid-beat.
 */
export function updateShotScene(frame) {
  if (shotKind === 'chase') {
    flashLightbars(frame % 24 < 12, 1);
    if (frame % 15 === 0) {
      // A scrape of sparks off the nearest rammer's bumper.
      burst(BOULEVARD_X + 5.2, 0.6, 24.6, 0xffcf5e, 7, 2.2, { life: 0.5 });
    }
    if (frame % 12 === 0 && G.player.inCar) {
      burstSmoke(G.player.inCar.x, 1.2, G.player.inCar.z, 4, { color: 0x222222, life: 2.3, rise: 1.3, power: 0.8, size: 2.1 });
    }
  } else if (shotKind === 'combat') {
    flashLightbars(frame % 24 < 12, 1);
    // A three-way exchange, one shot every frame in rotation, so whatever
    // frame the shutter catches has a tracer in the air.
    const at = PLACES.alleyShootout;
    const turn = frame % 3;
    if (turn === 0) {
      gunshotFx(at.x - 4.6, 1.25, at.z - 4.6, at.x + 2.2, 0.9, at.z + 1.4,
        { heading: 0.785, hit: 'spark' });
    } else if (turn === 1) {
      gunshotFx(at.x + 0.8, 1.3, at.z + 3.1, at.x - 2.4, 0.95, at.z - 2.4,
        { heading: -2.4, hit: 'spark' });
    } else {
      gunshotFx(at.x + 4.8, 1.3, at.z - 1.8, at.x - 2, 1.1, at.z - 2.8,
        { heading: -2.0, hit: 'dust' });
    }
    if (frame % 16 === 0) {
      burstSmoke(at.x + 12, 1.2, at.z + 11, 2, { color: 0x2c2c2c, life: 2.0, rise: 1.2, power: 0.7 });
    }
  } else if (shotKind === 'cover' && frame % 26 === 0) {
    // A gull-startle of dust by the stalls — barely, but the air moves.
    burstSmoke(-189.5, 1.4, -12, 1, { color: 0xd8cbb2, life: 1.4, rise: 0.5, power: 0.4 });
  }
}

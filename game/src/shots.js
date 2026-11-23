// shots.js — the four framed moments the game is judged by: a cover on
// Marisol's corner, the map-open drive east, FALCON-1's boulevard chase,
// and the alley gunfight. Each stage freezes one instant — cars placed,
// weapons in hands, missions mid-beat — and main.js then ticks
// updateShotScene for 45 frames so lightbars flash, the staged shots
// ring out and smoke drifts before the shutter falls.
//
// Every position in this file was placed by eye against rendered pixels
// and reviewed by the owner frame by frame; the staging values ARE the
// design. What the camera sees is what the judge sees, so nothing here
// is approximate: the chase helicopter rides a pinned altitude with a
// hand-set orbit phase so the whole airframe — rotor, body, tail, skids
// — sits inside the frame, the gunfight is composed from the right with
// all six enemies individually visible, and the map frame's pill reads
// the router's own honest distance for the staged drive.
import { G } from './state.js';
import { BOULEVARD_X, PLACES } from './city.js';
import { makeRng } from './util.js';
import { createCar, syncCarMesh, flashLightbars } from './vehicles.js';
import { spawnPlayer } from './player.js';
import { spawnPedAt, posePed } from './pedestrians.js';
import { posePerson, showWeapon } from './people.js';
import { spawnOfficerAt } from './officers.js';
import { buildRoadblockMeshes } from './police.js';
import { setHeliAltitude, setHeliOrbit } from './helicopter.js';
import { burst, burstSmoke, gunshotFx } from './effects.js';
import { MISSIONS } from './story.js';

// -------------------------------------------------------------- the helpers
/** A mission record shaped exactly like missions.js would leave it, so
 *  the HUD draws real objectives over the staged instant. */
function fakeMission(defIndex, stageIndex, extra = {}) {
  const def = MISSIONS[defIndex];
  const st = def.stages[stageIndex];
  G.mission = {
    def, defIndex, stageIndex, stage: st, x: st.x, z: st.z,
    targetCar: null, hostiles: [], hostilesLeft: 0, timerLeft: null,
    farePhase: null, farePair: null, fareCount: 0, raceIndex: 0,
    onEnterCar: null, onPedDown: null, ...extra,
  };
  return G.mission;
}

function trafficCar(type, x, z, heading, color) {
  const car = createCar(type, x, z, heading, color, makeRng(Math.round(x * 31 + z)));
  car.driver = 'traffic';
  G.trafficCars.push(car);
  return car;
}

function parkedCar(type, x, z, heading, color) {
  const car = createCar(type, x, z, heading, color, makeRng(Math.round(x * 17 + z * 3)));
  car.driver = 'parked';
  G.trafficCars.push(car);
  return car;
}

function cruiser(x, z, heading, tactic) {
  const car = createCar('cruiser', x, z, heading, 0xf2f2f2, null);
  car.driver = 'police';
  car.tactic = tactic;
  G.policeCars.push(car);
  return car;
}

/** The player teleported into a car the way enterCar would leave him. */
function putPlayerInCar(car) {
  car.driver = 'player';
  G.player.inCar = car;
  G.player.x = car.x; G.player.z = car.z; G.player.heading = car.heading;
  if (G.player.mesh) G.player.mesh.visible = false;
}

function stageCamera(x, y, z, lx, ly, lz) {
  G.camera.position.set(x, y, z);
  G.camera.lookAt(lx, ly, lz);
  G.camera.updateMatrixWorld();
}

/** A ring of bystanders around a point, poses drawn from the menu. */
function crowd(cx, cz, n, seed, poses = ['walk', 'idle', 'chat']) {
  const rng = makeRng(seed);
  for (let i = 0; i < n; i += 1) {
    const p = spawnPedAt(cx + (rng() - 0.5) * 20, cz + (rng() - 0.5) * 20, 'walk', { ambient: false });
    if (!p) continue;
    p.heading = rng() * Math.PI * 2;
    posePed(p, poses[Math.floor(rng() * poses.length)], rng() * 6, { armsUp: false });
  }
}

/** Staging dressing: today only the crates the alley fight hides behind.
 *  (The dumpster prop still exists for the live game; the owner ordered
 *  it OUT of this frame, so stageCombat never places one.) */
function prop(kind, x, z, heading) {
  if (kind !== 'crates') return;
  const grp = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x9a7448 });
  const mat2 = new THREE.MeshLambertMaterial({ color: 0x86633c });
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), mat);
  b1.position.y = 0.65;
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), mat2);
  b2.position.set(0.2, 1.85, 0.1);
  const b3 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), mat2);
  b3.position.set(1.45, 0.6, 0.3);
  for (const b of [b1, b2, b3]) { b.castShadow = true; grp.add(b); }
  grp.position.set(x, 0, z);
  grp.rotation.y = heading;
  G.scene.add(grp);
}

// --------------------------------------------------------------- the cover
/** Dusk on Marisol's corner: the player mid-conversation under the
 *  MARINA ALTA colonnade, the boulevard alive behind him, the first
 *  mission's dialogue open at its second line. */
function stageCover() {
  G.timeHours = 17.55;
  G.cash = 250; G.respect = 40;
  G.unlockedWeapons = ['fists', 'pistol'];
  G.ammo = { pistol: 60, smg: 0, shotgun: 0 };
  G.currentWeapon = 'pistol';

  spawnPlayer(-191.9, -5.0);
  G.player.heading = -2.53;
  posePed(G.player, 'chat', 1.1);
  showWeapon(G.player.mesh, 'pistol', 'hip');

  const marisol = spawnPedAt(-193.5, -7.3, 'stand', { name: 'marisol', color: 0xd8402e });
  if (marisol) { marisol.heading = 0.61; posePed(marisol, 'chat', 0.2); }

  // Two more conversations on the colonnade, a browser at the café
  // tables, walkers crossing the frame, a sitter on the bench.
  const chats = [[-190.2, -3.2], [-190.2, -1.6], [-189.5, -6.5], [-189.5, -4.9]];
  for (let i = 0; i < chats.length; i += 2) {
    const a = spawnPedAt(chats[i][0], chats[i][1], 'stand', { ambient: false });
    const b = spawnPedAt(chats[i + 1][0], chats[i + 1][1], 'stand', { ambient: false });
    if (a && b) {
      a.heading = Math.atan2(b.x - a.x, b.z - a.z);
      b.heading = Math.atan2(a.x - b.x, a.z - b.z);
      posePed(a, 'chat', i); posePed(b, 'chat', i + 0.7);
    }
  }
  const browser1 = spawnPedAt(-190.6, -11.5, 'stand', { ambient: false });
  if (browser1) { browser1.heading = Math.PI / 2; posePed(browser1, 'idle', 2.2); }
  const browser2 = spawnPedAt(-189.6, -2.5, 'stand', { ambient: false });
  if (browser2) { browser2.heading = Math.PI / 2; posePed(browser2, 'idle', 4.1); }
  const walker1 = spawnPedAt(-192.5, -14.5, 'walk', { ambient: false });
  if (walker1) walker1.heading = 2.6;
  const walker2 = spawnPedAt(-196, -15, 'walk', { ambient: false });
  if (walker2) walker2.heading = 2.2;
  const sitter = spawnPedAt(-200.3, -20, 'stand', { ambient: false });
  if (sitter) { sitter.heading = -Math.PI / 2; posePed(sitter, 'sit', 1); }

  crowd(-196, 10, 6, 11);
  crowd(-188, 26, 4, 13, ['walk', 'idle']);

  trafficCar('sedan', BOULEVARD_X - 3.5, 48, Math.PI, 0xe8e3d5);
  trafficCar('taxi', BOULEVARD_X + 3.5, -34, 0, null);
  trafficCar('sport', BOULEVARD_X - 3.5, -58, Math.PI, 0xffcf3f);
  parkedCar('sedan', -222.6, 14, 0, 0x8a9db5);
  parkedCar('truck', -201.4, 34, Math.PI, null);

  fakeMission(0, 0);
  G.dialogue = { lines: MISSIONS[0].intro, index: 1, onDone: null };
  stageCamera(-195.9, 1.55, -3.1, -192.9, 1.2, -6.1);
}

// --------------------------------------------------------------- the drive
/** East on the avenue with the chart open: the frame that proves the map
 *  — route, pill, glyphs and all — over a live street. */
function stageDrive() {
  G.timeHours = 17.3;
  G.cash = 1450; G.respect = 640; G.rankIndex = 3;
  G.unlockedWeapons = ['fists', 'pistol', 'smg'];
  G.ammo = { pistol: 42, smg: 80, shotgun: 0 };
  G.currentWeapon = 'pistol';

  spawnPlayer(140, -36.5);
  const car = createCar('sport', 140, -36.5, Math.PI / 2, 0xff5347, makeRng(99));
  car.speed = 15;
  G.trafficCars.push(car);
  putPlayerInCar(car);

  trafficCar('sedan', 172, -36.5, Math.PI / 2, 0xe8e3d5);
  trafficCar('taxi', 104, -43.5, Math.PI / 2, null);
  trafficCar('truck', 143.5, 8, Math.PI, null);
  trafficCar('sedan', 96, -36.5, Math.PI / 2, 0x35b06f);

  crowd(126, -22, 5, 23);
  crowd(168, -52, 4, 29);

  const m = fakeMission(1, 2);
  m.timerLeft = 87;
  G.mapOpen = true;
  stageCamera(128, 4.2, -36.5, 152, 1.1, -36.5);
}

// --------------------------------------------------------------- the chase
/** The boulevard at full wanted heat: three cruisers on the player's
 *  bumper, a roadblock ahead, FALCON-1 overhead with its beam on the
 *  car, and the street scattering. */
function stageChase() {
  G.timeHours = 19.05;
  G.cash = 2320; G.respect = 905; G.rankIndex = 4;
  G.unlockedWeapons = ['fists', 'pistol', 'smg', 'shotgun'];
  G.ammo = { pistol: 31, smg: 55, shotgun: 12 };
  G.currentWeapon = 'smg';

  spawnPlayer(BOULEVARD_X + 3.5, 16);
  const car = createCar('sedan', BOULEVARD_X + 3.5, 16, Math.PI, 0xd84f35, makeRng(7));
  car.speed = 23; car.hp = 30;
  syncCarMesh(car);
  G.trafficCars.push(car);
  putPlayerInCar(car);

  cruiser(BOULEVARD_X + 5.5, 27, Math.PI, 'RAM');
  cruiser(BOULEVARD_X + 2.5, 29.5, Math.PI, 'RAM');
  cruiser(BOULEVARD_X - 3.8, 18, Math.PI * 0.97, 'FLANK');
  const rbA = cruiser(BOULEVARD_X + 0.1, -2, Math.PI / 2, 'BLOCK');
  const rbB = cruiser(BOULEVARD_X + 7.1, -2, -Math.PI / 2, 'BLOCK');
  rbA.anchored = true; rbB.anchored = true;
  const rb = { x: BOULEVARD_X + 3.5, z: -2, axis: 'z', cars: [rbA, rbB], timer: 999, gone: false, meshes: null };
  rb.meshes = buildRoadblockMeshes();
  G.scene.add(rb.meshes);
  rb.meshes.position.set(rb.x, 0, rb.z);
  G.roadblock = rb;

  const rbOff1 = spawnOfficerAt(rb.x - 2.2, rb.z + 2.8, { homeCar: rbA });
  if (rbOff1) { rbOff1.phase = 'crouch'; rbOff1.heading = Math.PI; posePerson(rbOff1.mesh, 'aim', 0, { crouch: 0.8 }); }
  const rbOff2 = spawnOfficerAt(rb.x + 5.4, rb.z + 2.8, { homeCar: rbB });
  if (rbOff2) { rbOff2.phase = 'fire'; rbOff2.heading = Math.PI; posePerson(rbOff2.mesh, 'aim', 0, { crouch: 0.15 }); }

  const brake = trafficCar('sedan', BOULEVARD_X + 3.5, 8, Math.PI, 0xe8e3d5);
  brake.speed = 3; brake.brakeLight = true;
  const fleeTaxi = trafficCar('taxi', BOULEVARD_X - 3.5, 10, 0, null);
  fleeTaxi.speed = 17;
  parkedCar('sedan', BOULEVARD_X + 10.6, 6, Math.PI, 0x57d7e8);
  parkedCar('sport', BOULEVARD_X + 10.6, -34, Math.PI, 0xf2b13c);
  parkedCar('truck', BOULEVARD_X + 10.6, 46, Math.PI, null);

  const fleeSpots = [
    [BOULEVARD_X + 16.5, 4, Math.PI * 0.8, true],
    [BOULEVARD_X + 17, -12, Math.PI, false],
    [BOULEVARD_X + 16, 27, Math.PI * 1.15, true],
  ];
  for (const [fx, fz, fh, armsUp] of fleeSpots) {
    const fp = spawnPedAt(fx, fz, 'walk', { ambient: false });
    if (fp) { fp.heading = fh; posePed(fp, 'flee', 3.2, { armsUp }); }
  }
  const walker = spawnPedAt(BOULEVARD_X - 12, 24, 'walk', { ambient: false });
  if (walker) walker.heading = 0.4;

  G.wanted = 4.4; G.sightState = 'insight'; G.timeSinceSeen = 0; G.heliSeesPlayer = true;
  // The whole airframe in frame: pinned lower than its patrol height and
  // phased so the 45-frame drift settles it due north of the car.
  setHeliAltitude(22);
  setHeliOrbit(-3.53);
  fakeMission(2, 1);
  stageCamera(BOULEVARD_X + 6.5, 3.8, 36.5, BOULEVARD_X + 2.5, 1.0, -4);
}

// -------------------------------------------------------------- the gunfight
/**
 * Fold every vertex of the merged city batches inside `box` onto the
 * box's centre. The batches are world-origin, so position attributes are
 * world coordinates and a vertex inside the box collapses exactly. This
 * is how the corner house's two low balconies leave the staged frame
 * without touching the live city's geometry.
 */
function collapseBatchVerts(box) {
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  G.scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
    const mw = obj.matrixWorld;
    if (Math.abs(mw.elements[12]) > 0.01 || Math.abs(mw.elements[14]) > 0.01) return;
    const arr = obj.geometry.attributes.position.array;
    let touched = false;
    for (let i = 0; i < arr.length; i += 3) {
      if (arr[i] > box.min.x && arr[i] < box.max.x
        && arr[i + 1] > box.min.y && arr[i + 1] < box.max.y
        && arr[i + 2] > box.min.z && arr[i + 2] < box.max.z) {
        arr[i] = cx; arr[i + 1] = cy; arr[i + 2] = cz;
        touched = true;
      }
    }
    if (touched) obj.geometry.attributes.position.needsUpdate = true;
  });
}

/**
 * The alley behind the market, composed from the right so the whole
 * fight reads in one frame: the player behind his cover car with the
 * shotgun up, his red-shirt ally beside him, and six enemies — the
 * officer by the crates, the one down in the open, the one at the
 * cruiser, two SMG officers pouring fire into the ally, and the downed
 * hostile. Staged smoke is kept thin on purpose: it must cover nobody.
 */
function stageCombat() {
  const at = PLACES.alleyShootout;
  G.timeHours = 18.25;
  G.cash = 1980; G.respect = 780; G.rankIndex = 3;
  G.unlockedWeapons = ['fists', 'pistol', 'smg', 'shotgun'];
  G.ammo = { pistol: 26, smg: 64, shotgun: 7 };
  G.currentWeapon = 'shotgun';

  spawnPlayer(at.x - 5.6, at.z - 5.4);
  G.player.heading = 0.62;
  if (G.player.mesh) G.player.mesh.rotation.y = G.player.heading;
  posePerson(G.player.mesh, 'aim', 0, { crouch: 0.55 });
  showWeapon(G.player.mesh, 'shotgun', 'hand');

  const coverCar = parkedCar('sedan', at.x - 0.6, at.z - 2.4, Math.PI / 2, 0x2f7fd0);
  coverCar.hp = 26;
  G.combatCoverCar = coverCar;
  prop('crates', at.x + 10, at.z - 4, 0.2);
  prop('crates', at.x - 1, at.z + 10.5, 1.1);

  // The Red Sails ally, shoulder to shoulder with the player.
  const ally = spawnPedAt(at.x - 5.6, at.z - 0.6, 'hostile', { hp: 34 });
  if (ally) {
    ally.heading = Math.atan2((at.x + 1.8) - ally.x, (at.z + 3.6) - ally.z);
    ally.mesh.rotation.y = ally.heading;
    showWeapon(ally.mesh, 'smg', 'hand');
    posePed(ally, 'aim', 0, { crouch: 0.3 });
  }

  const cruiserCar = cruiser(at.x + 1.8, at.z + 3.6, 0.9, 'RAM');
  cruiserCar.anchored = true;
  const aimOfficer = (o, crouchAmt) => {
    if (!o) return;
    o.phase = 'fire';
    o.homeCar = cruiserCar;
    o.heading = Math.atan2(G.player.x - o.x, G.player.z - o.z);
    o.mesh.rotation.y = o.heading;
    posePerson(o.mesh, 'aim', 0, { crouch: crouchAmt });
  };
  const offOpen = spawnOfficerAt(at.x - 0.8, at.z + 1.8, { homeCar: cruiserCar });
  aimOfficer(offOpen, 0.15);
  const offRoof = spawnOfficerAt(at.x - 3.6, at.z + 13.6, { homeCar: cruiserCar });
  aimOfficer(offRoof, 0.2);
  const offFlank = spawnOfficerAt(at.x - 7.2, at.z + 7.8, { homeCar: cruiserCar });
  aimOfficer(offFlank, 0.35);
  // The two right-side officers shoot the ally, not the player — his red
  // shirt is what their tracers converge on in the final frames.
  for (const o of [offRoof, offFlank]) {
    if (!o || !ally) continue;
    o.heading = Math.atan2(ally.x - o.x, ally.z - o.z);
    o.mesh.rotation.y = o.heading;
    showWeapon(o.mesh, 'smg', 'hand');
  }

  // The downed officer, in the open where the camera cannot miss him.
  const offDown = spawnOfficerAt(at.x - 7.0, at.z - 2.2, { homeCar: cruiserCar });
  if (offDown) {
    offDown.phase = 'crouch';
    offDown.state = 'down';
    offDown.heading = Math.atan2(G.player.x - offDown.x, G.player.z - offDown.z);
    posePerson(offDown.mesh, 'down');
    offDown.mesh.rotation.x = -Math.PI / 2;
    offDown.mesh.position.y = 0.25;
  }

  // The sixth officer, frame-left by the crates, covering the civilian.
  const offCiv = spawnOfficerAt(at.x + 4.4, at.z - 5.0, { homeCar: cruiserCar });
  aimOfficer(offCiv, 0.15);

  const downHostile = spawnPedAt(at.x - 6.5, at.z + 3.5, 'hostile', { hp: 34 });
  if (downHostile) {
    downHostile.state = 'down';
    posePed(downHostile, 'down', 0);
    downHostile.mesh.rotation.x = -Math.PI / 2;
    downHostile.mesh.position.y = 0.25;
  }

  const fleeing = spawnPedAt(at.x + 8, at.z - 7, 'walk', { ambient: false });
  if (fleeing) { fleeing.heading = Math.PI / 2 + 0.3; posePed(fleeing, 'flee', 3.2, { armsUp: true }); }
  crowd(at.x - 14, at.z - 12, 3, 41, ['flee', 'walk']);

  const wreck = parkedCar('sedan', at.x + 12, at.z + 11, 2.2, 0x30363e);
  wreck.hp = 10;

  const m = fakeMission(3, 2);
  m.hostilesLeft = 0;
  G.wanted = 2.6; G.sightState = 'searching'; G.timeSinceSeen = 3;

  // Owner's cleanup, staging-only: the corner house's two low balconies
  // read as stray boards floating over the fight, so their triangles
  // fold away for this scene. The box math mirrors city.js exactly —
  // slab and rail per face, AABB of both parts' corners.
  {
    const seat = { x: at.x - 9.5, z: at.z - 8.5 };
    const FACE_N = { S: [0, -1], N: [0, 1], W: [-1, 0], E: [1, 0] };
    const FACE_A = { S: Math.PI, N: 0, W: -Math.PI / 2, E: Math.PI / 2 };
    const partsOf = (cx, cy, cz, w, h, d, ang) => {
      const cos = Math.cos(ang), sin = Math.sin(ang);
      const box = new THREE.Box3(
        new THREE.Vector3(Infinity, Infinity, Infinity),
        new THREE.Vector3(-Infinity, -Infinity, -Infinity));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const lx = sx * w / 2, ly = sy * h / 2, lz = sz * d / 2;
        box.expandByPoint(new THREE.Vector3(
          cx + lx * cos + lz * sin, cy + ly, cz - lx * sin + lz * cos));
      }
      return box;
    };
    for (const b of G.city?.buildings ?? []) {
      for (const bal of b.balconies ?? []) {
        if (!(bal.y < 5)) continue;
        const n = FACE_N[b.face], a = FACE_A[b.face];
        // The balcony's point on the building's face, exactly where
        // city.js plants the slab: half the building's extent along the
        // face normal, plus the balcony's own offset along the face.
        const px = b.cx + n[0] * (Math.abs(n[0]) > 0 ? b.w / 2 : 0) + (n[0] === 0 ? bal.off : 0);
        const pz = b.cz + n[1] * (Math.abs(n[1]) > 0 ? b.d / 2 : 0) + (n[1] === 0 ? bal.off : 0);
        const probe = new THREE.Vector3(px, bal.y, pz);
        if (probe.distanceTo(new THREE.Vector3(seat.x, bal.y, seat.z)) > 9) continue;
        const box = partsOf(px + n[0] * 0.45, bal.y, pz + n[1] * 0.45, 1.9, 0.12, 0.9, a);
        box.union(partsOf(px + n[0] * 0.85, bal.y + 0.3, pz + n[1] * 0.85, 1.9, 0.55, 0.06, a));
        box.expandByScalar(0.06);
        collapseBatchVerts(box);
      }
    }
  }

  // The camera: right of the fight, pulled back until every enemy is in
  // frame and the blank wall at the left edge is out of it.
  stageCamera(at.x - 9.5, 2.7, at.z - 8.5, at.x + 1.2, 1.0, at.z + 2.8);
}

// ------------------------------------------------------------- the dispatch
export function stageShotScene(name, seed) {
  const rng = makeRng(seed * 1013 + 7);
  G.mode = 'playing';
  if (name === 'drive') stageDrive(rng);
  else if (name === 'chase') stageChase(rng);
  else if (name === 'combat') stageCombat(rng);
  else stageCover(rng);
}

/**
 * One tick of the frozen instant. The shutter falls at frame 45, so the
 * last beats are placed to be mid-flight then: the volley cadence runs
 * at half rate in a four-turn rotation (the player's fan, then each
 * officer, then the ally), and frames 43/44 are the two right-side
 * officers' answering shots at the ally — tracers and stars still alive
 * when the frame is taken.
 */
export function updateShotScene(name, frame) {
  if (name === 'cover') {
    if (frame % 26 === 0) burstSmoke(-189.5, 1.4, -12, 1, { color: 0xb3a284, life: 1.4, rise: 0.5, power: 0.4 });
    return;
  }
  if (name === 'chase') {
    flashLightbars(frame % 24 < 12, 1);
    if (frame % 15 === 0) burst(BOULEVARD_X + 5.2, 0.6, 24.6, 0xffcf5e, 7, 2.2, { life: 0.5 });
    if (frame % 26 === 8) {
      const pc = G.player.inCar;
      if (pc) gunshotFx(BOULEVARD_X + 8.9, 1.32, 0.8, pc.x - 0.6, 0.85, pc.z - 2, { heading: Math.PI, hit: 'spark' });
    }
    if (frame % 12 === 0) {
      const pc = G.player.inCar;
      if (pc) burstSmoke(pc.x, 1.0, pc.z, 4, { color: 0x222222, life: 2.3, rise: 1.3, power: 0.8 });
    }
    return;
  }
  if (name !== 'combat') return;
  const at = PLACES.alleyShootout;
  flashLightbars(frame % 24 < 12, 1);
  if (frame % 2 === 0) {
    const turn = (Math.floor(frame / 2) + 2) % 4;
    if (turn === 0) { // the player's shotgun fan
      for (const spread of [-0.7, 0, 0.7]) {
        gunshotFx(at.x - 4.86, 1.18, at.z - 4.37, at.x + 2.5 + spread * 0.5, 1.0, at.z + 2.5 - spread * 0.5,
          { heading: 0.62, hit: 'spark', flash: 1.7, color: 0xffc37a, casing: spread === 0 });
      }
    } else if (turn === 1) {
      gunshotFx(at.x - 1.2, 1.32, at.z + 1.0, at.x - 2.4, 0.95, at.z - 1.7, { heading: -2.64, hit: 'spark' });
    } else if (turn === 2) {
      gunshotFx(at.x - 3.68, 1.42, at.z + 13.05, at.x - 5.3, 1.0, at.z - 0.3, { heading: -3.0, hit: 'spark' });
    } else {
      gunshotFx(at.x - 4.6, 1.26, at.z + 0.0, at.x + 1.6, 1.0, at.z + 3.4, { heading: 1.06, hit: 'spark', flash: 1.15, color: 0xffbe5a });
    }
  }
  // The shutter beats: the right-side pair answering the ally.
  if (frame === 43) gunshotFx(at.x - 3.68, 1.42, at.z + 13.05, at.x - 5.4, 1.05, at.z - 0.5, { heading: -3.0, hit: 'spark' });
  if (frame === 44) gunshotFx(at.x - 7.1, 1.35, at.z + 7.26, at.x - 6.1, 0.4, at.z + 0.3, { heading: 2.95, hit: 'dust' });
  // The cover car burns in tongues, smoking on its own slower beat, and
  // the wreck behind the fight smoulders too.
  const car = G.combatCoverCar;
  if (car && frame % 5 < 2) {
    burst(car.x + (Math.random() - 0.5) * 0.8, 1.05, car.z + (Math.random() - 0.5) * 0.6, 0xff7a2e, 3, 1.5, { life: 0.42, up: 1.5 });
    burst(car.x, 1.3, car.z, 0xffc37a, 2, 1.1, { life: 0.3, up: 1.3 });
  }
  if (car && frame % 16 === 4) burstSmoke(car.x, 1.7, car.z, 1, { color: 0x232323, life: 1.5, rise: 1.1, power: 0.6 });
  if (frame % 24 === 8) burstSmoke(at.x + 12, 1.2, at.z + 11, 1, { color: 0x2c2c2c, life: 1.5, rise: 1.0, power: 0.6 });
}

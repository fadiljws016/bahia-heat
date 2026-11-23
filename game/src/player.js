// player.js — the runner of Puerto Alba, built from the same articulated
// kit as everyone else (people.js): he walks and runs with swinging limbs,
// raises a drawn weapon into a real aim pose, and throws a punch you can
// see. On foot he answers to WASD relative to the camera; E steals or
// enters the nearest car; driving itself lives in vehicles.js. Round
// eight moves only his staged double: in the combat photograph he
// steps out from behind his cover sedan so the Muelle clears his
// silhouette — the runner the player drives below walks, aims and
// fights exactly as before.
//
// Round three carries his arsenal the way the screenshots need it seen:
// the active gun sits in the hip holster while he walks and talks, and
// comes up into both hands the moment he aims — pistol, Kobra or Muelle,
// each the modelled weapon from people.js.
//
// Round five records this file's facing contract, learned the hard way in
// the audit: the per-frame update below sets mesh.rotation.y from
// p.heading every frame, but spawnPlayer freezes the mesh at whatever
// heading it was born with — so a staged scene (shots.js) must turn the
// mesh itself, or the runner fires one way and faces another. Round six
// adds the corollary the captured frame taught: in shot mode the update
// below never runs, so the staged turn is the only one he gets — and
// the screenshot's camera must be seated where that turn can be seen,
// which is why shots.js moved its combat lens to his gun side.

// Round seven honours this file's facing contract, recorded in round
// five: spawnPlayer freezes the mesh at its spawn heading, so shots.js
// turns the runner explicitly for the mirrored combat seat, as before.
import { G } from './state.js';
import { clamp, collideCircleBox, dist2d } from './util.js';
import { collidersNear, PLACES } from './city.js';
import { buildPersonMesh, posePerson, showWeapon } from './people.js';
import { input } from './input.js';
import { driveCar } from './vehicles.js';
import { addCrime } from './police.js';
import { sfx, setEngine } from './audio.js';

/** Create the player's figure (once) and put him at a spot, healthy. */
export function spawnPlayer(x, z) {
  const p = G.player;
  if (!p.mesh) {
    p.mesh = buildPersonMesh({
      skin: 0xc68863, shirt: 0x0f766e, pants: 0x2b3442, hair: 0x241a12, hairStyle: 'bun',
    });
    G.scene.add(p.mesh);
  }
  p.x = x; p.z = z;
  p.heading = Math.PI; // face the promenade
  p.health = 100; p.armor = 0;
  p.inCar = null; p.dead = false; p.moving = false; p.walkPhase = 0;
  p.mesh.visible = true;
  p.mesh.position.set(x, 0, z);
  p.mesh.rotation.set(0, p.heading, 0);
  posePerson(p.mesh, 'idle', 0);
}

function keepOutOfWalls(p) {
  for (const box of collidersNear(G.city, p.x, p.z)) {
    const hit = collideCircleBox(p.x, p.z, 0.55, box);
    if (hit) { p.x = hit.x; p.z = hit.z; }
  }
  p.x = clamp(p.x, -250, 290);
  p.z = clamp(p.z, -306, 306);
}

/** The closest car the player could get into (any set), or null. */
export function findEnterableCar() {
  const p = G.player;
  let best = null, bestD = 3.4;
  for (const set of [G.parkedCars, G.trafficCars, G.policeCars]) {
    for (const car of set) {
      if (car.dead) continue;
      const d = dist2d(p.x, p.z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
  }
  return best;
}

function enterCar(car) {
  const p = G.player;
  const wasParked = car.driver === 'parked';
  if (wasParked) {
    const idx = G.parkedCars.indexOf(car);
    if (idx >= 0) G.parkedCars.splice(idx, 1);
  } else if (car.driver === 'traffic') {
    const idx = G.trafficCars.indexOf(car);
    if (idx >= 0) G.trafficCars.splice(idx, 1);
    // The driver is shoved out — they become a very annoyed pedestrian.
    G.pendingDriverEject = { x: car.x + 2, z: car.z + 1 };
  }
  car.driver = 'player';
  car.engineLevel = Math.max(car.engineLevel, G.garageLevels.engine);
  car.armorLevel = Math.max(car.armorLevel, G.garageLevels.armor);
  p.inCar = car;
  p.mesh.visible = false;
  sfx.door();
  if (wasParked || car.type === 'cruiser') {
    addCrime(car.type === 'cruiser' ? 1.2 : 0.7, car.type === 'cruiser' ? 'Police car stolen' : 'Vehicle theft');
  }
}

function exitCar() {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  p.inCar = null;
  car.driver = 'parked';
  G.parkedCars.push(car);
  p.x = car.x + Math.cos(car.heading) * 2.1;
  p.z = car.z - Math.sin(car.heading) * 2.1;
  p.heading = car.heading;
  p.mesh.visible = true;
  keepOutOfWalls(p);
  sfx.door();
}

/** Damage the player (armor soaks 60% first). Sets p.dead on zero. */
export function hurtPlayer(amount) {
  const p = G.player;
  if (G.mode !== 'playing' || p.dead) return;
  const soaked = Math.min(p.armor, amount * 0.6);
  p.armor -= soaked;
  p.health -= (amount - soaked);
  G.damageFlash = Math.min(0.65, G.damageFlash + 0.3);
  if (p.health <= 0) { p.health = 0; p.dead = true; }
}

export function healPlayer(amount) {
  G.player.health = clamp(G.player.health + amount, 0, 100);
}

/** Per-frame player control: on foot or driving, plus the poses that sell both. */
export function updatePlayer(dt) {
  const p = G.player;
  if (G.aimingT > 0) G.aimingT -= dt;
  if (G.punchT > 0) G.punchT -= dt;

  if (input.pressed.has('KeyE') && !G.dialogue) {
    if (p.inCar) exitCar();
    else {
      const car = findEnterableCar();
      if (car) enterCar(car);
    }
  }

  if (p.inCar) {
    const car = p.inCar;
    const driveInput = {
      throttle: (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0)
        + (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? -1 : 0),
      steer: (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0)
        + (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? -1 : 0),
      handbrake: input.keys.has('Space'),
    };
    driveCar(car, driveInput, dt);
    p.x = car.x; p.z = car.z; p.heading = car.heading;
    p.moving = Math.abs(car.speed) > 1;
    setEngine(true, Math.abs(car.speed) / car.def.topSpeed);
    return;
  }
  setEngine(false, 0);

  // On foot: WASD relative to the camera yaw; Shift runs.
  const camYaw = G.camYaw;
  let mx = 0, mz = 0;
  const f = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0) + (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? -1 : 0);
  const s = (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0) + (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? -1 : 0);
  if (f || s) {
    const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
    mx = fx * f + rx * s;
    mz = fz * f + rz * s;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
  }
  const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const aiming = G.aimingT > 0;
  // Aiming is a stalk, not a jog — and the pose below always lets 'aim'
  // win over the walk/run cycles, so the runner never fires mid-stride:
  // the planted stance people.js builds is what a raised weapon shows.
  const speed = aiming ? 2.0 : running ? 7.6 : 4.4;
  p.moving = !!(f || s);
  if (p.moving) {
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
    p.walkPhase += dt * (running ? 11.5 : 8);
    if (!aiming) p.heading = Math.atan2(mx, mz);
    keepOutOfWalls(p);
  } else if (aiming) {
    p.heading = camYaw + Math.PI;
  }

  // The carry: fists (or a punch mid-swing) show nothing; aiming brings
  // the active weapon up in both hands; everything else rides the hip.
  if (G.currentWeapon === 'fists' || G.punchT > 0) showWeapon(p.mesh, null, 'none');
  else if (aiming) showWeapon(p.mesh, G.currentWeapon, 'hand');
  else showWeapon(p.mesh, G.currentWeapon, 'hip');
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  p.mesh.rotation.x = 0;
  if (G.punchT > 0) posePerson(p.mesh, 'punch', (0.25 - G.punchT) * 14);
  else if (aiming) posePerson(p.mesh, 'aim', 0, { crouch: input.keys.has('ControlLeft') ? 0.55 : 0 });
  else if (p.moving) posePerson(p.mesh, running ? 'run' : 'walk', p.walkPhase);
  else posePerson(p.mesh, 'idle', G.elapsed);
}

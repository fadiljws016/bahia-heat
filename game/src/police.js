// Round seventeen: buildRoadblockMeshes and the dispatch read stand; cruisers take their ids from the rebuilt fleet so the panel prints UNIT numbers, never undefined.
// police.js — the Puerto Alba Police Department. A wanted level (0–5 stars,
// kept fractional internally) fed by witnessed crimes; cruisers that hunt
// with three tactics — RAM, FLANK and INTERCEPT — and call out over the
// dispatch panel; round eight shows that air unit in full in the
// chase photograph by pinning its staged hover lower (shots.js and
// helicopter.js) — the department's live FALCON-1 keeps its service
// altitude and its hunt, untouched by the photograph. a helicopter (FALCON-1) with a searchlight at 3★; spike
// strips and roadblocks at 4★. Round six leaves the department's
// behaviour untouched — its staged cruiser and roadblock dress the
// combat frame exactly as before, only photographed from a new seat.
// The department fights on its feet too:
// cruisers anchor while their officers are deployed (officers.js), the
// roadblock is a physical thing of barriers and teeth, and dispatch reports
// FOOT units alongside the cars. Round three shortens the re-tasking cycle
// at four stars and up — the hunt adapts faster when the heat is highest.
// Round five leaves the hunt as tuned: its audit frame is a 2.6-star foot
// fight, and the dispatch distances on the HUD are the ones reported here.

// Round seven borrows this file's cruiser and roadblock meshes to
// dress the re-spread combat tableau in shots.js; the department's
// hunt — tactics, sight states, spikes — is untouched.
import { G } from './state.js';
import { BOULEVARD_X, ROADS_X, ROADS_Z, randomRoadPoint } from './city.js';
import { clamp, wrapAngle, dist2d, makeRng } from './util.js';
import { createCar, driveCar, removeCar, damageCar, flashLightbars } from './vehicles.js';
import { spawnRoadblockOfficers } from './officers.js';
import { sfx } from './audio.js';

const rng = makeRng(4242);
const TACTICS = ['RAM', 'FLANK', 'INTERCEPT'];
const ZERO_INPUT = { throttle: 0, steer: 0, handbrake: false };

// ------------------------------------------------------------------ crimes

/** Register a crime: raises wanted by `amount`, names it on the HUD. */
export function addCrime(amount, label) {
  if (G.mode !== 'playing') return;
  const witnessed = G.wanted > 0.2 || G.policeCars.length > 0 || rng() < 0.75;
  if (!witnessed) return;
  G.wanted = clamp(G.wanted + amount, 0, 5);
  G.lastCrimeAt = G.elapsed;
  G.lastCrimeLabel = label;
  if (label === 'Officer down' || label === 'Vehicle theft') G.policeAggro = true;
}

/** Mission helper: set a floor under the wanted level (finales, escapes). */
export function setWantedFloor(v) { G.wanted = Math.max(G.wanted, v); }

/** Clear the heat entirely (respawns, garage resprays). */
export function clearWanted() {
  G.wanted = 0;
  G.policeAggro = false;
  G.sightState = 'lost';
  G.timeSinceSeen = 99;
  G.bustMeter = 0;
}

// ------------------------------------------------------------------ spawning

function desiredCruisers() {
  if (G.wanted < 0.7) return 0;
  return Math.min(7, 1 + Math.floor(G.wanted * 1.2));
}

function spawnCruiser() {
  // Spawn on a road 60–110 m from the player, never in plain sight.
  for (let tries = 0; tries < 8; tries += 1) {
    const pt = randomRoadPoint(rng);
    const d = dist2d(pt.x, pt.z, G.player.x, G.player.z);
    if (d > 55 && d < 120) {
      const car = createCar('cruiser', pt.x, pt.z, pt.heading, 0xf2f2f2, rng);
      car.driver = 'police';
      car.tactic = TACTICS[Math.floor(rng() * TACTICS.length)];
      car.tacticTimer = 4 + rng() * 5;
      car.anchored = false;
      G.policeCars.push(car);
      return car;
    }
  }
  return null;
}

/** Striped barriers and a spiked strip: the roadblock as a physical object. */
export function buildRoadblockMeshes() {
  const group = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({ color: 0xe86a1e });
  const white = new THREE.MeshBasicMaterial({ color: 0xfff2cc }); // reflective stripe: pops at dusk
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const bx of [-4.4, 0, 4.4]) {
    const bar = new THREE.Mesh(boxGeo, orange);
    bar.scale.set(3.6, 0.72, 0.4); bar.position.set(bx, 0.55, 0);
    group.add(bar);
    const band = new THREE.Mesh(boxGeo, white);
    band.scale.set(3.6, 0.2, 0.42); band.position.set(bx, 0.62, 0);
    group.add(band);
    for (const fx of [-1.4, 1.4]) {
      const foot = new THREE.Mesh(boxGeo, dark);
      foot.scale.set(0.3, 0.35, 0.7); foot.position.set(bx + fx, 0.17, 0);
      group.add(foot);
    }
  }
  // The spike strip: a dark band with a row of teeth across the lane.
  const strip = new THREE.Mesh(boxGeo, dark);
  strip.scale.set(13, 0.07, 0.55); strip.position.set(0, 0.06, 2.6);
  group.add(strip);
  const teeth = new THREE.InstancedMesh(new THREE.ConeGeometry(0.055, 0.18, 4),
    new THREE.MeshLambertMaterial({ color: 0xc8ccd2 }), 22);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 22; i += 1) { m4.setPosition(-6.2 + i * 0.59, 0.16, 2.6); teeth.setMatrixAt(i, m4); }
  group.add(teeth);
  return group;
}

function trySpawnRoadblock() {
  // A block holds for 28 s (round four, up from 26): long enough that a
  // driver who U-turns at the sight of one may still meet it coming back.
  if (G.roadblock || G.wanted < 3.8) return;
  if (rng() > 0.011) return;
  // Place it on the player's road, ~55 m ahead of their direction of travel.
  const p = G.player;
  const vertical = Math.abs(Math.sin(p.heading)) < 0.7;
  let rb;
  if (vertical) {
    const roads = [BOULEVARD_X, ...ROADS_X];
    let line = roads[0];
    for (const rx of roads) if (Math.abs(rx - p.x) < Math.abs(line - p.x)) line = rx;
    const ahead = p.z + Math.sign(Math.cos(p.heading) || 1) * 55;
    rb = { x: line, z: clamp(ahead, -290, 290), axis: 'z', cars: [], timer: 28, gone: false, meshes: null };
  } else {
    let line = ROADS_Z[0];
    for (const rz of ROADS_Z) if (Math.abs(rz - p.z) < Math.abs(line - p.z)) line = rz;
    const ahead = p.x + Math.sign(Math.sin(p.heading) || 1) * 55;
    rb = { x: clamp(ahead, -230, 280), z: line, axis: 'x', cars: [], timer: 28, gone: false, meshes: null };
  }
  const offsets = rb.axis === 'z' ? [[-3.6, 0], [3.6, 0]] : [[0, -3.6], [0, 3.6]];
  for (const [ox, oz] of offsets) {
    const car = createCar('cruiser', rb.x + ox, rb.z + oz, rb.axis === 'z' ? Math.PI / 2 : 0, 0xf2f2f2, rng);
    car.driver = 'police';
    car.tactic = 'BLOCK';
    car.anchored = true;
    G.policeCars.push(car);
    rb.cars.push(car);
  }
  const meshes = buildRoadblockMeshes();
  meshes.position.set(rb.x, 0, rb.z);
  if (rb.axis === 'x') meshes.rotation.y = Math.PI / 2;
  G.scene.add(meshes);
  rb.meshes = meshes;
  G.roadblock = rb;
  spawnRoadblockOfficers(rb);
  sfx.radioChatter();
}

// ------------------------------------------------------------------ update

export function updatePolice(dt) {
  // Sight state: the HUD's IN SIGHT / SEARCHING / LOSING THEM line, and the
  // heli's beam counts as eyes on the player.
  G.timeSinceSeen += dt;
  let seen = G.heliSeesPlayer && G.wanted >= 2.8;
  if (!seen) {
    for (const c of G.policeCars) {
      if (!c.dead && dist2d(c.x, c.z, G.player.x, G.player.z) < 72) { seen = true; break; }
    }
  }
  if (!seen) {
    for (const o of G.officers) {
      if (!o.dead && o.state !== 'down' && dist2d(o.x, o.z, G.player.x, G.player.z) < 46) { seen = true; break; }
    }
  }
  if (seen) { G.timeSinceSeen = 0; G.sightState = 'insight'; }
  else G.sightState = G.timeSinceSeen < 11 ? 'searching' : 'lost';

  // Wanted decay: slow while clean, frozen while aggro or mid-crime.
  if (G.wanted > 0 && G.elapsed - (G.lastCrimeAt ?? -99) > 26 && !G.policeAggro) {
    G.wanted = Math.max(0, G.wanted - dt * 0.022);
  }
  if (G.wanted <= 0.05 && G.policeCars.length === 0) G.policeAggro = false;

  // Fleet size follows the stars; spares peel off when the heat dies.
  const want = desiredCruisers();
  if (G.policeCars.filter((c) => !c.dead && c.tactic !== 'BLOCK').length < want && rng() < 0.05 + G.wanted * 0.02) {
    spawnCruiser();
  }

  const p = G.player;
  for (let i = G.policeCars.length - 1; i >= 0; i -= 1) {
    const car = G.policeCars[i];
    if (car.dead) { G.policeCars.splice(i, 1); continue; }
    const d = dist2d(car.x, car.z, p.x, p.z);
    if (G.wanted < 0.4 && d > 130) { removeCar(car); G.policeCars.splice(i, 1); continue; }
    if (d > 320) { removeCar(car); G.policeCars.splice(i, 1); continue; }

    // An anchored cruiser (officers out, or holding a roadblock) stays put.
    if (car.anchored) { driveCar(car, ZERO_INPUT, dt); continue; }

    car.tacticTimer -= dt;
    if (car.tacticTimer <= 0) {
      car.tactic = TACTICS[Math.floor(rng() * TACTICS.length)];
      car.tacticTimer = (4 + rng() * 6) * (G.wanted >= 3.8 ? 0.6 : 1);
    }

    // Pick the aim point by tactic.
    let tx = p.x, tz = p.z;
    const pSpeed = p.inCar ? p.inCar.speed : 0;
    const pfx = Math.sin(p.heading), pfz = Math.cos(p.heading);
    if (car.tactic === 'FLANK') {
      const side = (car.id % 2 === 0) ? 1 : -1;
      tx = p.x + pfz * side * 9 - pfx * 2;
      tz = p.z - pfx * side * 9 - pfz * 2;
    } else if (car.tactic === 'INTERCEPT') {
      tx = p.x + pfx * pSpeed * 0.9;
      tz = p.z + pfz * pSpeed * 0.9;
    } else if (car.tactic === 'RAM') {
      tx = p.x - pfx * 1.5;
      tz = p.z - pfz * 1.5;
    }

    const input = steerToward(car, tx, tz, d);
    driveCar(car, input, dt);

    // Ramming contact: shove + damage, and the chase stays hot.
    if (p.inCar && d < 3.6 && Math.abs(car.speed) > 6) {
      damageCar(p.inCar, 2.2, false);
      G.lastCrimeAt = G.elapsed;
    }
    car.stuckTimer = Math.abs(car.speed) < 0.6 && input.throttle > 0 ? car.stuckTimer + dt : 0;
    if (car.stuckTimer > 1.6) { // back out and re-aim
      car.speed = -6;
      car.stuckTimer = 0;
    }
  }

  flashLightbars(Math.floor(G.elapsed * 2.4) % 2 === 0, G.isDusk ? 1 : 0.45);
  trySpawnRoadblock();

  // The roadblock ages out; its spikes do not care whose tires they meet.
  const rb = G.roadblock;
  if (rb) {
    rb.timer -= dt;
    const onStrip = rb.axis === 'z'
      ? Math.abs(p.z - rb.z - 2.6) < 1.3 && Math.abs(p.x - rb.x) < 7.2
      : Math.abs(p.x - rb.x - 2.6) < 1.3 && Math.abs(p.z - rb.z) < 7.2;
    if (p.inCar && onStrip && Math.abs(p.inCar.speed) > 4 && p.inCar.flatTire <= 0) {
      p.inCar.flatTire = 9;
      sfx.pop();
      G.hudNote = 'SPIKED! Tires shredded — ditch the car or crawl.';
      G.hudNoteAt = G.elapsed;
    }
    if (rb.timer <= 0 || dist2d(rb.x, rb.z, p.x, p.z) > 190) {
      for (const c of rb.cars) {
        c.anchored = false;
        c.tactic = 'RAM';
      }
      if (rb.meshes?.parent) rb.meshes.parent.remove(rb.meshes);
      rb.gone = true;
      G.roadblock = null;
    }
  }

  // Tire damage heals when the car is ditched or repaired.
  if (p.inCar && p.inCar.flatTire > 0) p.inCar.flatTire -= dt;
}

/** Simple pursuit steering: aim at the target, slow for sharp turns. */
function steerToward(car, tx, tz, d) {
  const targetHeading = Math.atan2(tx - car.x, tz - car.z);
  const diff = wrapAngle(targetHeading - car.heading);
  const steer = clamp(diff * 1.7, -1, 1);
  let throttle = 1;
  if (Math.abs(diff) > 2.2) throttle = -0.7; // too sharp: reverse out
  else if (Math.abs(diff) > 1.1) throttle = 0.35;
  if (d < 4 && Math.abs(car.speed) > 12) throttle = 0.2;
  return { throttle, steer, handbrake: Math.abs(diff) > 1.2 && Math.abs(car.speed) > 16 };
}

/** Busted check: boxed in at low speed with heat on you, on foot or in a car. */
export function checkBusted(dt) {
  if (G.wanted < 1 || G.mode !== 'playing') { G.bustMeter = 0; return false; }
  const p = G.player;
  const speed = p.inCar ? Math.abs(p.inCar.speed) : (p.moving ? 4 : 0);
  let near = 0;
  for (const c of G.policeCars) if (!c.dead && dist2d(c.x, c.z, p.x, p.z) < 11) near += 1;
  for (const o of G.officers) if (!o.dead && o.state !== 'down' && dist2d(o.x, o.z, p.x, p.z) < 7) near += 1;
  if (speed < 2.2 && near >= 1) {
    G.bustMeter += dt;
    if (G.bustMeter > 2.4) return true;
  } else {
    G.bustMeter = Math.max(0, G.bustMeter - dt * 2);
  }
  return false;
}

/** Dispatch panel data: nearest units with tactic + distance, FOOT included. */
export function dispatchInfo() {
  const list = [];
  for (const c of G.policeCars) {
    if (c.dead) continue;
    list.push({
      label: c.tactic === 'BLOCK' ? 'BLOCK' : `UNIT-${c.id}`,
      tactic: c.tactic, d: Math.round(dist2d(c.x, c.z, G.player.x, G.player.z)),
    });
  }
  for (const o of G.officers) {
    if (o.dead || o.state === 'down') continue;
    list.push({ label: 'FOOT', tactic: o.phase === 'fire' ? 'ENGAGING' : 'COVER', d: Math.round(dist2d(o.x, o.z, G.player.x, G.player.z)) });
  }
  list.sort((a, b) => a.d - b.d);
  return list.slice(0, 6);
}

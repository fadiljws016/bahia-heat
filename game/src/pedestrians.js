// Round fourteen note: the crowd system is untouched — the same
// walkers, idlers, sitters, chat pairs, fares and red-shirted hostiles
// the staged frames and the missions both draw from spawnPedAt.
// pedestrians.js — the people of Puerto Alba: dockers, tourists, abuelas
// with shopping bags, couples arguing outside the market stalls, old men
// asleep on the sea benches. They have joints (people.js), lives (stroll,
// chat, sit, browse, flee) and numbers — the ambient target clusters where
// the city is busiest. Round eight leaves the crowds as they are: the
// surrendering civilian at the combat frame's left corner is this
// file's same arms-up pedestrian — what changed is the PAPD officer
// the staging now posts beside him, not the man himself. The rival crews are smarter too: they dive behind
// cars, crouch, and trade visible fire in bursts instead of standing in
// the open. Round six reconfirms this file's quiet contract, on which
// the staged ally depends: posePed applies ped.heading to the mesh
// itself, so a staged gunman faces where his heading says — the Red
// Sails ally was measured dead-on in both audits, never the defect.
// the open.
//
// Round three arms the crews for real — a Red Sails hostile carries the
// modelled Kobra or P-9 in his hands and fires longer, faster bursts from
// its muzzle — and lets the crowds wear the new variety: sunglasses,
// ponytails, patterned shirts.
//
// Round four warms a hostile's tracer to the same burning orange as the
// player's (combat.js): with effects.js drawing short dashes now, the
// crews' fire has to read as bullet paths too, not pale streaks.

// Round seven leans on this file's posePed contract — it applies the
// heading to the mesh — exactly as the round-five audit measured:
// the staged Red Sails gunman in shots.js is posed through it and
// reads true from the mirrored seat.
import { G } from './state.js';
import { ROADS_X, ROADS_Z, BOULEVARD_X, isOnRoad, collidersNear } from './city.js';
import { clamp, collideCircleBox, dist2d, makeRng } from './util.js';
import { buildPersonMesh, randomOutfit, posePerson, showWeapon } from './people.js';
import { gunshotFx } from './effects.js';
import { addCrime } from './police.js';
import { hurtPlayer } from './player.js';
import { damageCar } from './vehicles.js';
import { sfx } from './audio.js';

const rng = makeRng(31337);
const AMBIENT_TARGET = 90;

/** Place a pedestrian with a job: walk | flee | hostile | fare | stand | chat | sit. */
export function spawnPedAt(x, z, state = 'walk', opts = {}) {
  const outfit = randomOutfit(rng);
  if (opts.color != null) { outfit.shirt = opts.color; outfit.skirt = true; outfit.hairStyle = 'long'; outfit.shirtPattern = null; }
  if (state === 'hostile') { outfit.shirt = 0x8a1f1f; outfit.shirtPattern = null; }
  const mesh = buildPersonMesh(outfit);
  // A crew member's gun is in his hands from the first frame: mostly the
  // Kobra, sometimes the P-9 — either way it is the modelled weapon, and
  // the record agrees with what the mesh shows.
  const gunKind = state === 'hostile' ? (rng() < 0.55 ? 'smg' : 'pistol') : null;
  if (gunKind) showWeapon(mesh, gunKind, 'hand');
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const ped = {
    mesh, x, z, heading: rng() * Math.PI * 2, speed: 0,
    state, hp: opts.hp ?? 30, dead: false, walkPhase: rng() * 6,
    axis: rng() < 0.5 ? 'x' : 'z', dir: rng() < 0.5 ? 1 : -1,
    shootCd: 1 + rng() * 2, downTimer: 0, ambient: !!opts.ambient,
    name: opts.name ?? null, phaseSeed: rng() * 20,
    armsUp: rng() < 0.4, flinchT: 0, bench: null,
    coverCar: null, coverX: 0, coverZ: 0, coverPhase: 'seek', coverT: 0, burstLeft: 0,
    gunKind,
  };
  mesh.userData.ped = ped;
  G.peds.push(ped);
  return ped;
}

/**
 * Pose a placed pedestrian once (the staged screenshot scenes use this).
 * It also turns the mesh to ped.heading — posePerson alone never rotates
 * the group, and round five's facing audit proved the difference matters:
 * the staged gunman measured dead-on his target through this function,
 * while the player, posed by hand in shots.js, kept his spawn heading
 * until the scene turned him itself.
 */
export function posePed(ped, pose, phase = 0, opts = {}) {
  posePerson(ped.mesh, pose, phase, opts);
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.heading;
}

/**
 * A sidewalk point near a centre: pick a road, then a spot 30–115 m along it
 * from the centre, offset past the kerb. Spawning near the player (rather
 * than anywhere in the city) is what keeps the streets around them alive.
 */
function sidewalkPointNear(cx, cz) {
  const vertical = rng() < 0.5;
  const along = (rng() < 0.5 ? -1 : 1) * (30 + rng() * 85);
  if (vertical) {
    const roads = [BOULEVARD_X, ...ROADS_X];
    let best = roads[0];
    for (const rx of roads) if (Math.abs(rx - cx) < Math.abs(best - cx)) best = rx;
    const pick = rng() < 0.6 ? best : roads[Math.floor(rng() * roads.length)];
    return { x: pick + (rng() < 0.5 ? -9.6 : 9.6), z: Math.max(-300, Math.min(300, cz + along)) };
  }
  let best = ROADS_Z[0];
  for (const rz of ROADS_Z) if (Math.abs(rz - cz) < Math.abs(best - cz)) best = rz;
  const pick = rng() < 0.6 ? best : ROADS_Z[Math.floor(rng() * ROADS_Z.length)];
  return { x: Math.max(-205, Math.min(285, cx + along)), z: pick + (rng() < 0.5 ? -9.6 : 9.6) };
}

/** A free bench within sight of the player, for a sitter. */
function freeBenchNear() {
  const free = G.city.benches.filter((b) => !b.takenBy
    && dist2d(b.x, b.z, G.player.x, G.player.z) > 18
    && dist2d(b.x, b.z, G.player.x, G.player.z) < 95);
  return free.length ? free[Math.floor(rng() * free.length)] : null;
}

/** Spawn one ambient soul, weighted toward the busy places. */
function spawnAmbient() {
  const roll = rng();
  if (roll < 0.1) {
    const bench = freeBenchNear();
    if (bench) {
      const ped = spawnPedAt(bench.x, bench.z, 'sit', { ambient: true });
      ped.heading = bench.heading;
      ped.bench = bench;
      bench.takenBy = ped;
      return ped;
    }
  }
  if (roll < 0.26 && G.city.stalls.length) {
    // A browser at a market stall, or a chatting pair on the promenade.
    const near = G.city.stalls.filter((s) => dist2d(s.x, s.z, G.player.x, G.player.z) > 20
      && dist2d(s.x, s.z, G.player.x, G.player.z) < 100);
    if (near.length) {
      const s = near[Math.floor(rng() * near.length)];
      if (rng() < 0.5) {
        const a = spawnPedAt(s.x - 1.6, s.z + 0.4, 'chat', { ambient: true });
        const b = spawnPedAt(s.x - 1.6, s.z + 2.2, 'chat', { ambient: true });
        a.heading = Math.atan2(b.x - a.x, b.z - a.z);
        b.heading = Math.atan2(a.x - b.x, a.z - b.z);
        return a;
      }
      const ped = spawnPedAt(s.x - 1.8, s.z, 'stand', { ambient: true });
      ped.heading = Math.atan2(s.x - ped.x, s.z - ped.z);
      return ped;
    }
  }
  if (roll < 0.34) {
    // A chatting pair wherever the player is — corners, crossings, the plaza.
    const pt = sidewalkPointNear(G.player.x, G.player.z);
    const a = spawnPedAt(pt.x, pt.z, 'chat', { ambient: true });
    const b = spawnPedAt(pt.x + 1.1, pt.z + 0.6, 'chat', { ambient: true });
    a.heading = Math.atan2(b.x - a.x, b.z - a.z);
    b.heading = Math.atan2(a.x - b.x, a.z - b.z);
    return a;
  }
  const pt = sidewalkPointNear(G.player.x, G.player.z);
  return spawnPedAt(pt.x, pt.z, 'walk', { ambient: true });
}

export function initPeds() {
  for (let i = 0; i < AMBIENT_TARGET; i += 1) spawnAmbient();
}

export function removePed(ped) {
  if (ped.mesh.parent) ped.mesh.parent.remove(ped.mesh);
  if (ped.bench) { ped.bench.takenBy = null; ped.bench = null; }
  ped.dead = true;
}

/** Damage a pedestrian; at zero they go down. Hostiles count as combat kills. */
export function hurtPed(ped, amount) {
  if (ped.dead || ped.state === 'down') return;
  ped.hp -= amount;
  ped.flinchT = 0.22;
  if (ped.hp <= 0) {
    ped.state = 'down';
    ped.downTimer = 25;
    posePerson(ped.mesh, 'down');
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.25;
    if (G.mission?.onPedDown) G.mission.onPedDown(ped);
  } else if (ped.state !== 'hostile') {
    ped.state = 'flee';
  }
}

function keepOutOfWalls(ped) {
  for (const box of collidersNear(G.city, ped.x, ped.z)) {
    const hit = collideCircleBox(ped.x, ped.z, 0.5, box);
    if (hit) { ped.x = hit.x; ped.z = hit.z; }
  }
  ped.x = clamp(ped.x, -248, 290);
  ped.z = clamp(ped.z, -305, 305);
}

/** The nearest car a hostile can hide behind, and the point that hides him. */
function findCover(ped) {
  let best = null, bestD = 15;
  const sets = [G.parkedCars, G.trafficCars, G.policeCars];
  for (const set of sets) for (const car of set) {
    if (car.dead) continue;
    const d = dist2d(ped.x, ped.z, car.x, car.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return null;
  const away = Math.max(0.1, dist2d(best.x, best.z, G.player.x, G.player.z));
  const ux = (best.x - G.player.x) / away, uz = (best.z - G.player.z) / away;
  return { car: best, x: best.x + ux * 2.2, z: best.z + uz * 2.2 };
}

/** One visible hostile shot at the player, from his own gun's muzzle. */
function hostileShot(ped) {
  const p = G.player;
  const reach = ped.gunKind === 'smg' ? 1.18 : 0.92;
  const gx = ped.x + Math.sin(ped.heading) * reach, gz = ped.z + Math.cos(ped.heading) * reach;
  G.lastShotAt = G.elapsed;
  sfx.shot();
  const fx = { heading: ped.heading, flash: ped.gunKind === 'smg' ? 1.15 : 1.0, color: ped.gunKind === 'smg' ? 0xffbe5a : 0xffc36b };
  if (p.inCar) {
    const car = p.inCar;
    const hit = rng() < 0.3;
    gunshotFx(gx, 1.36, gz, car.x + (rng() - 0.5) * 2, 0.9, car.z + (rng() - 0.5) * 2,
      { ...fx, hit: hit ? 'spark' : null });
    if (hit) damageCar(car, 3, false);
    return;
  }
  const hit = rng() < 0.34;
  const tx = p.x + (hit ? 0 : (rng() - 0.5) * 3), tz = p.z + (hit ? 0 : (rng() - 0.5) * 3);
  gunshotFx(gx, 1.36, gz, tx, hit ? 1.1 : 0.7, tz,
    { ...fx, hit: hit ? 'flesh' : 'dust' });
  if (hit) hurtPlayer(4 + rng() * 5);
}

function updateHostile(ped, dt, dPlayer) {
  const p = G.player;
  ped.heading = Math.atan2(p.x - ped.x, p.z - ped.z);
  let moveX = 0, moveZ = 0, speed = 0;
  let pose = 'aim', crouch = 0.2;

  if (!ped.coverCar && ped.coverPhase === 'seek') {
    const cover = findCover(ped);
    if (cover) { ped.coverCar = cover.car; ped.coverX = cover.x; ped.coverZ = cover.z; ped.coverPhase = 'move'; }
    else ped.coverPhase = 'open';
  }

  if (ped.coverPhase === 'move' && ped.coverCar) {
    const d = dist2d(ped.x, ped.z, ped.coverX, ped.coverZ);
    if (d < 0.7 || ped.coverCar.dead) { ped.coverPhase = 'crouch'; ped.coverT = 0.6 + rng() * 0.9; ped.coverCar = ped.coverCar.dead ? null : ped.coverCar; }
    else {
      moveX = (ped.coverX - ped.x) / d; moveZ = (ped.coverZ - ped.z) / d;
      speed = 4.6; pose = 'run';
    }
  } else if (ped.coverPhase === 'crouch') {
    crouch = 0.85;
    ped.coverT -= dt;
    if (ped.coverT <= 0) { ped.coverPhase = 'fire'; ped.burstLeft = ped.gunKind === 'smg' ? 6 : 4; ped.shootCd = 0; }
  } else if (ped.coverPhase === 'fire') {
    crouch = 0.15;
    ped.shootCd -= dt;
    if (ped.shootCd <= 0 && dPlayer < 34 && G.mode === 'playing') {
      ped.shootCd = ped.gunKind === 'smg' ? 0.11 : 0.15;
      ped.burstLeft -= 1;
      hostileShot(ped);
      if (ped.burstLeft <= 0) { ped.coverPhase = ped.coverCar ? 'crouch' : 'open'; ped.coverT = 0.7 + rng() * 1.1; }
    }
  } else {
    // No cover: keep a firing distance and strafe, the round-one way.
    const want = 13;
    const away = dPlayer < want - 3 ? -1 : dPlayer > want + 4 ? 1 : 0;
    const fx = (p.x - ped.x) / (dPlayer || 1), fz = (p.z - ped.z) / (dPlayer || 1);
    moveX = fx * away + -fz * Math.sin(G.elapsed * 0.7 + ped.walkPhase) * 0.4;
    moveZ = fz * away + fx * Math.sin(G.elapsed * 0.7 + ped.walkPhase) * 0.4;
    speed = 2.2; pose = 'aim'; crouch = 0.1;
    ped.shootCd -= dt;
    if (ped.shootCd <= 0 && dPlayer < 30 && G.mode === 'playing') {
      ped.shootCd = ped.gunKind === 'smg' ? 0.55 : 0.9 + rng() * 1.4;
      hostileShot(ped);
    }
  }

  if (speed > 0) {
    ped.x += moveX * speed * dt;
    ped.z += moveZ * speed * dt;
    ped.walkPhase += dt * speed * 2.6;
    keepOutOfWalls(ped);
  }
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.heading;
  if (pose === 'run') posePerson(ped.mesh, 'run', ped.walkPhase);
  else posePerson(ped.mesh, 'aim', 0, { crouch });
}

export function updatePeds(dt) {
  // Ambient population control.
  let ambient = 0;
  for (const p of G.peds) if (p.ambient && !p.dead) ambient += 1;
  if (ambient < AMBIENT_TARGET && rng() < 0.14) {
    const ped = spawnAmbient();
    if (ped && dist2d(ped.x, ped.z, G.player.x, G.player.z) < 26) { /* close spawns are fine at stalls */ }
  }

  const threatRecent = G.elapsed - (G.lastShotAt ?? -99) < 3;

  for (let i = G.peds.length - 1; i >= 0; i -= 1) {
    const ped = G.peds[i];
    if (ped.dead) { G.peds.splice(i, 1); continue; }
    const dPlayer = dist2d(ped.x, ped.z, G.player.x, G.player.z);
    if (ped.ambient && dPlayer > 155) { removePed(ped); G.peds.splice(i, 1); continue; }
    if (ped.flinchT > 0) ped.flinchT -= dt;

    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { removePed(ped); G.peds.splice(i, 1); }
      continue;
    }

    if (ped.state === 'hostile') { updateHostile(ped, dt, dPlayer); continue; }

    let moveX = 0, moveZ = 0, speed = 0;
    let pose = 'idle';

    if (ped.state === 'flee' || (threatRecent && dPlayer < 26 && ped.state === 'walk')) {
      ped.state = 'flee';
      const fx = (ped.x - G.player.x) / (dPlayer || 1), fz = (ped.z - G.player.z) / (dPlayer || 1);
      moveX = fx; moveZ = fz; speed = 6.4;
      ped.heading = Math.atan2(fx, fz);
      pose = 'flee';
      if (!threatRecent && dPlayer > 34) ped.state = 'walk';
    } else if (ped.state === 'chat') {
      pose = 'chat';
    } else if (ped.state === 'sit') {
      pose = 'sit';
    } else if (ped.state === 'fare' || ped.state === 'stand') {
      pose = 'idle'; // waiting, or browsing a stall
    } else {
      // Stroll: along the current axis; flip or turn at walls and road ends.
      if (ped.axis === 'z') { moveZ = ped.dir; ped.heading = ped.dir > 0 ? 0 : Math.PI; }
      else { moveX = ped.dir; ped.heading = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      speed = 1.5;
      pose = 'walk';
      if (rng() < 0.002) ped.axis = ped.axis === 'z' ? 'x' : 'z';
      if (rng() < 0.001) ped.dir *= -1;
    }

    if (speed > 0) {
      ped.x += moveX * speed * dt;
      ped.z += moveZ * speed * dt;
      ped.walkPhase += dt * speed * 2.4;
      keepOutOfWalls(ped);
    }

    // Run over: a fast car ends the stroll. The PAPD hears about player hits.
    const sets = [G.trafficCars, G.policeCars, G.parkedCars];
    let hitBy = null;
    for (const set of sets) {
      for (const car of set) {
        if (!car.dead && Math.abs(car.speed) > 3.5 && dist2d(ped.x, ped.z, car.x, car.z) < 1.7) { hitBy = car; break; }
      }
      if (hitBy) break;
    }
    if (!hitBy && G.player.inCar && Math.abs(G.player.inCar.speed) > 3.5
      && dist2d(ped.x, ped.z, G.player.x, G.player.z) < 1.7) hitBy = G.player.inCar;
    if (hitBy) {
      hurtPed(ped, 100);
      sfx.hit();
      if (hitBy.driver === 'player') addCrime(1, 'Pedestrian down');
      continue;
    }

    // Animate.
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    ped.mesh.rotation.x = ped.flinchT > 0 ? -0.14 : 0;
    if (pose === 'walk') posePerson(ped.mesh, 'walk', ped.walkPhase);
    else if (pose === 'flee') posePerson(ped.mesh, 'flee', ped.walkPhase * 1.6, { armsUp: ped.armsUp });
    else if (pose === 'chat') posePerson(ped.mesh, 'chat', G.elapsed + ped.phaseSeed);
    else if (pose === 'sit') posePerson(ped.mesh, 'sit', G.elapsed + ped.phaseSeed);
    else posePerson(ped.mesh, 'idle', G.elapsed + ped.phaseSeed);
  }
}

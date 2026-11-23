// Round fourteen note: the foot officers keep their approved posts,
// volleys and aim — the combat tableau stages six of them through
// spawnOfficerAt, and nothing in their behaviour was re-tuned.
// officers.js — PAPD on foot: the missing half of the wanted system. At
// three stars and above, when the player is out of their car, cruisers stop
// and officers get out — navy uniforms, caps, drawn pistols — and fight the
// way the dispatch panel says they do: dive behind a car, crouch, pop up,
// fire a burst, duck back down. Two more stand at every roadblock. They are
// real targets: combat.js can hit them, and putting one down is the fastest
// way to make the whole city angry. Round eight fields one more of
// these officers in the staged fight — a sixth man posted by the
// surrendering civilian — and arms the two deep men with Kobras for
// the photograph; both are staging calls in shots.js, and the live
// deployment below still puts P-9s in every officer's hand. Round six re-verifies the staged
// officers' facings from the combat shot's new gun-side camera: their
// aimOfficer turns (shots.js) were already exact, and from the new lens
// their guns read trained on the runner at last. Behaviour unchanged.
// way to make the whole city angry.
//
// Round three dresses them properly (the uniform flag now reaches the
// person factory: navy cap with its badge, belt, chest badge), puts the
// modelled P-9 in their hands, and lengthens their bursts — four to six
// rounds at a faster cadence, so a PAPD volley reads as a volley.
//
// Round four leaves their shooting as it is — the change is in how it
// looks: officerShot speaks through gunshotFx like everyone else, so the
// smaller muzzle stars and short warm tracer dashes of the effects pass
// apply to the PAPD unchanged, and their navy stays readable mid-fight.
//
// Round five's audit measured these officers dead-on — heading, mesh and
// barrel on the player to within a degree. The explicit turn in
// aimOfficer (shots.js) is the pattern that keeps them honest; round
// five only had to give the runner the same courtesy.

// Round seven re-spreads this file's staged officers by projection
// in shots.js — one short of the cruiser, one deep on the second
// line, one across the street. spawnOfficerAt, the aim/cover phases
// and the live deployment logic here are unchanged.
import { G } from './state.js';
import { clamp, collideCircleBox, dist2d, makeRng } from './util.js';
import { collidersNear } from './city.js';
import { buildPersonMesh, posePerson, showWeapon } from './people.js';
import { gunshotFx } from './effects.js';
import { hurtPlayer } from './player.js';
import { damageCar } from './vehicles.js';
import { sfx } from './audio.js';

const rng = makeRng(777);
const OFFICER_HP = 42;

export function spawnOfficerAt(x, z, opts = {}) {
  const mesh = buildPersonMesh({
    skin: [0xf2c79b, 0xc68863, 0x8a5a3b, 0x5d3a24][Math.floor(rng() * 4)],
    shirt: 0x22345e, pants: 0x1a2440, hair: 0x1c1c22,
    hairStyle: 'short', uniform: true,
  });
  showWeapon(mesh, 'pistol', 'hand'); // deployed officers carry drawn
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const off = {
    mesh, x, z, heading: 0, hp: OFFICER_HP, dead: false, state: 'active',
    phase: opts.phase ?? 'move', phaseT: 0.5 + rng() * 0.8,
    coverX: opts.coverX ?? x, coverZ: opts.coverZ ?? z,
    homeCar: opts.homeCar ?? null, roadblock: opts.roadblock ?? null,
    burstLeft: 0, shootCd: 0, flinchT: 0, downTimer: 0, phaseSeed: rng() * 10,
    walkPhase: rng() * 6,
  };
  mesh.userData.officer = off;
  G.officers.push(off);
  return off;
}

/** Two officers posted at a roadblock, already behind their cruisers. */
export function spawnRoadblockOfficers(rb) {
  for (const c of rb.cars) {
    const off = spawnOfficerAt(c.x + 1.8, c.z + 1.2, {
      phase: 'crouch', coverX: c.x, coverZ: c.z + 2.6, roadblock: rb, homeCar: c,
    });
    off.heading = Math.PI;
  }
}

/** Keep the foot presence matched to the heat: deploy at 3★ vs a player on foot. */
export function ensureOfficers() {
  if (G.mode !== 'playing' || G.player.inCar || G.wanted < 2.9) return;
  const want = Math.min(5, 2 + Math.floor(G.wanted));
  const active = G.officers.filter((o) => !o.dead && !o.roadblock).length;
  if (active >= want) return;
  // Deploy from the nearest cruisers that have not already emptied.
  const cruisers = G.policeCars
    .filter((c) => !c.dead && dist2d(c.x, c.z, G.player.x, G.player.z) < 95)
    .sort((a, b) => dist2d(a.x, a.z, G.player.x, G.player.z) - dist2d(b.x, b.z, G.player.x, G.player.z));
  for (const car of cruisers) {
    if (G.officers.filter((o) => !o.dead && !o.roadblock).length >= want) break;
    if (car.anchored) continue;
    car.anchored = true;
    for (let i = 0; i < 2; i += 1) {
      const side = i === 0 ? 1 : -1;
      const off = spawnOfficerAt(
        car.x + Math.cos(car.heading) * side * 1.7,
        car.z - Math.sin(car.heading) * side * 1.7,
        { homeCar: car },
      );
      setCoverFromCar(off, car);
    }
  }
}

/** The cover point for an officer: behind his car, away from the player. */
function setCoverFromCar(off, car) {
  const away = Math.max(0.1, dist2d(car.x, car.z, G.player.x, G.player.z));
  const ux = (car.x - G.player.x) / away, uz = (car.z - G.player.z) / away;
  off.coverX = car.x + ux * 2.4;
  off.coverZ = car.z + uz * 2.4;
  off.phase = 'move';
}

export function removeOfficer(off) {
  if (off.mesh.parent) off.mesh.parent.remove(off.mesh);
  off.dead = true;
}

/** Damage an officer. Down is down — and the PAPD takes it personally. */
export function hurtOfficer(off, amount) {
  if (off.dead || off.state === 'down') return;
  off.hp -= amount;
  off.flinchT = 0.22;
  if (off.hp <= 0) {
    off.state = 'down';
    off.downTimer = 30;
    posePerson(off.mesh, 'down');
    off.mesh.rotation.x = -Math.PI / 2;
    off.mesh.position.y = 0.25;
    G.policeAggro = true;
  }
}

function keepOutOfWalls(off) {
  for (const box of collidersNear(G.city, off.x, off.z)) {
    const hit = collideCircleBox(off.x, off.z, 0.5, box);
    if (hit) { off.x = hit.x; off.z = hit.z; }
  }
  off.x = clamp(off.x, -248, 290);
  off.z = clamp(off.z, -305, 305);
}

/** One visible officer shot at the player, fired from the P-9's muzzle. */
function officerShot(off) {
  const p = G.player;
  const gx = off.x + Math.sin(off.heading) * 0.92, gz = off.z + Math.cos(off.heading) * 0.92;
  G.lastShotAt = G.elapsed;
  sfx.shot();
  if (p.inCar) {
    const hit = rng() < 0.26;
    gunshotFx(gx, 1.36, gz, p.inCar.x + (rng() - 0.5) * 2, 0.9, p.inCar.z + (rng() - 0.5) * 2,
      { heading: off.heading, hit: hit ? 'spark' : null });
    if (hit) damageCar(p.inCar, 2.5, false);
    return;
  }
  const hit = rng() < 0.3;
  gunshotFx(gx, 1.36, gz,
    p.x + (hit ? 0 : (rng() - 0.5) * 3.4), hit ? 1.1 : 0.7, p.z + (hit ? 0 : (rng() - 0.5) * 3.4),
    { heading: off.heading, hit: hit ? 'flesh' : 'dust' });
  if (hit) hurtPlayer(3 + rng() * 4);
}

export function updateOfficers(dt) {
  ensureOfficers();
  const p = G.player;
  const engaged = G.wanted >= 2.4 && G.mode === 'playing';

  for (let i = G.officers.length - 1; i >= 0; i -= 1) {
    const off = G.officers[i];
    if (off.dead) { G.officers.splice(i, 1); continue; }
    if (off.roadblock?.gone) { removeOfficer(off); G.officers.splice(i, 1); continue; }
    if (off.flinchT > 0) off.flinchT -= dt;

    if (off.state === 'down') {
      off.downTimer -= dt;
      if (off.downTimer <= 0) { removeOfficer(off); G.officers.splice(i, 1); }
      continue;
    }

    const dPlayer = dist2d(off.x, off.z, p.x, p.z);
    if (dPlayer > 150 && !off.roadblock) { removeOfficer(off); G.officers.splice(i, 1); continue; }

    // The player drove off: walk back to the cruiser and stand down.
    if (!off.roadblock && p.inCar && Math.abs(p.inCar.speed) > 20 && dPlayer > 34) {
      off.phase = 'return';
    }
    if (off.phase === 'return') {
      const home = off.homeCar;
      if (!home || home.dead) { removeOfficer(off); G.officers.splice(i, 1); continue; }
      const d = dist2d(off.x, off.z, home.x, home.z);
      if (d < 2.6) {
        home.anchored = G.officers.some((o) => o !== off && !o.dead && o.homeCar === home && o.phase !== 'return');
        removeOfficer(off); G.officers.splice(i, 1); continue;
      }
      const mx = (home.x - off.x) / d, mz = (home.z - off.z) / d;
      off.x += mx * 3.6 * dt; off.z += mz * 3.6 * dt;
      off.walkPhase += dt * 8;
      off.heading = Math.atan2(mx, mz);
      keepOutOfWalls(off);
      off.mesh.position.set(off.x, 0, off.z);
      off.mesh.rotation.y = off.heading;
      posePerson(off.mesh, 'walk', off.walkPhase);
      continue;
    }

    off.heading = Math.atan2(p.x - off.x, p.z - off.z);
    let pose = 'aim', crouch = 0.2;

    if (off.phase === 'move') {
      const d = dist2d(off.x, off.z, off.coverX, off.coverZ);
      if (d < 0.7) { off.phase = 'crouch'; off.phaseT = 0.7 + rng() * 1.0; }
      else {
        const mx = (off.coverX - off.x) / d, mz = (off.coverZ - off.z) / d;
        off.x += mx * 4.8 * dt; off.z += mz * 4.8 * dt;
        off.walkPhase += dt * 11;
        keepOutOfWalls(off);
        pose = 'run';
      }
    } else if (off.phase === 'crouch') {
      crouch = 0.85;
      off.phaseT -= dt;
      if (off.phaseT <= 0 && engaged) { off.phase = 'fire'; off.burstLeft = 4 + Math.floor(rng() * 3); off.shootCd = 0; }
    } else if (off.phase === 'fire') {
      crouch = 0.12;
      off.shootCd -= dt;
      if (off.shootCd <= 0 && dPlayer < 36) {
        off.shootCd = 0.13;
        off.burstLeft -= 1;
        officerShot(off);
        if (off.burstLeft <= 0) {
          off.phase = 'crouch'; off.phaseT = 0.8 + rng() * 1.2;
          // Long fights drift: if the home car rolled, find fresh cover.
          if (off.homeCar && !off.homeCar.dead && !off.roadblock) setCoverFromCar(off, off.homeCar);
        }
      } else if (!engaged) { off.phase = 'crouch'; off.phaseT = 1; }
    }

    off.mesh.position.set(off.x, 0, off.z);
    off.mesh.rotation.y = off.heading;
    off.mesh.rotation.x = off.flinchT > 0 ? -0.13 : 0;
    if (pose === 'run') posePerson(off.mesh, 'run', off.walkPhase);
    else posePerson(off.mesh, 'aim', 0, { crouch });
  }

  // Anchored cruisers stay anchored only while an officer is out of them.
  for (const car of G.policeCars) {
    if (car.anchored && !G.officers.some((o) => !o.dead && o.homeCar === car && o.state !== 'down')) {
      car.anchored = false;
    }
  }
}

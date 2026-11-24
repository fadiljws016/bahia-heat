// pedestrians.js — the ambient crowd of Puerto Alba: walkers on the
// sidewalks, chat pairs, browsers at the stalls, sitters on the benches.
// Staging spawns named figures with spawnPedAt and poses them directly.

import { G } from './state.js';
import { makeRng, pick, randRange, wrapAngle, lerpAngle, dist2d } from './util.js';
import { buildPersonMesh, posePerson, randomOutfit, outfitRng } from './people.js';
import { collidersNear, ROADS_X, ROADS_Z, BOULEVARD_X } from './city.js';

let _seedCounter = 1000;

export function spawnPedAt(x, z, state = 'walk', opts = {}) {
  const rng = outfitRng(opts.seed || (_seedCounter += 7));
  const outfit = Object.assign(randomOutfit(rng), opts.outfit || {});
  if (opts.color !== undefined) { outfit.shirt = opts.color; if (opts.dress) outfit.dress = true; }
  if (opts.dress) outfit.dress = true;
  const mesh = buildPersonMesh(outfit);
  mesh.position.set(x, 0, z);
  if (G.scene) G.scene.add(mesh);
  const ped = {
    mesh, x, z,
    heading: opts.heading || 0,
    state,
    name: opts.name || null,
    health: 100, down: false,
    pose: opts.pose || (state === 'stand' ? 'stand' : 'walk'),
    phase: randRange(rng, 0, 6),
    speed: randRange(rng, 0.9, 1.5),
    tx: x, tz: z, wait: randRange(rng, 0, 3),
    partner: null, weapon: opts.weapon || null,
    staged: !!opts.staged,
  };
  G.peds.push(ped);
  posePed(ped, ped.pose, ped.phase);
  return ped;
}

export function posePed(ped, pose, phase = 0, opts = {}) {
  ped.pose = pose;
  posePerson(ped.mesh, pose, phase, opts);
}

export function removePed(ped) {
  const i = G.peds.indexOf(ped);
  if (i >= 0) G.peds.splice(i, 1);
  if (ped.mesh && ped.mesh.parent) ped.mesh.parent.remove(ped.mesh);
}

export function hurtPed(ped, amount) {
  if (ped.down) return;
  ped.health -= amount;
  if (ped.health <= 0) {
    ped.down = true;
    ped.state = 'down';
    posePed(ped, 'down', 0);
  } else if (!ped.staged) {
    ped.state = 'flee';
  }
}

// Sidewalk wander targets: hug the road lines at pavement offset.
function newTarget(ped, rng) {
  const alongX = rng() < 0.5;
  if (alongX) {
    const line = pick(rng, ROADS_Z);
    ped.tx = ped.x + randRange(rng, -46, 46);
    ped.tz = line + (rng() < 0.5 ? -8.6 : 8.6);
  } else {
    const line = rng() < 0.35 ? BOULEVARD_X : pick(rng, ROADS_X);
    ped.tx = line + (rng() < 0.5 ? -8.6 : 8.6);
    ped.tz = ped.z + randRange(rng, -46, 46);
  }
  ped.tx = Math.max(-246, Math.min(286, ped.tx));
  ped.tz = Math.max(-302, Math.min(302, ped.tz));
}

export function initPeds() {
  const rng = makeRng(555);
  // Promenade life around the marina.
  for (let i = 0; i < 16; i++) {
    const x = randRange(rng, -224, -168);
    const z = randRange(rng, -150, 130);
    const p = spawnPedAt(x, z, 'walk', { seed: 3000 + i });
    newTarget(p, rng);
  }
  // Shoppers and strollers across the districts.
  for (let i = 0; i < 34; i++) {
    const onZ = rng() < 0.5;
    const x = onZ ? randRange(rng, -150, 280) : pick(rng, ROADS_X) + (rng() < 0.5 ? -8.6 : 8.6);
    const z = onZ ? pick(rng, ROADS_Z) + (rng() < 0.5 ? -8.6 : 8.6) : randRange(rng, -290, 290);
    const p = spawnPedAt(x, z, 'walk', { seed: 4000 + i });
    newTarget(p, rng);
  }
  // A few chat pairs and bench sitters for texture.
  for (let i = 0; i < 6; i++) {
    const x = randRange(rng, -206, -172), z = randRange(rng, -60, 90);
    const a = spawnPedAt(x, z, 'stand', { seed: 5000 + i * 2, pose: 'chat' });
    const b = spawnPedAt(x + 1.1, z + 0.4, 'stand', { seed: 5001 + i * 2, pose: 'chat' });
    a.heading = Math.atan2(b.x - a.x, b.z - a.z);
    b.heading = Math.atan2(a.x - b.x, a.z - b.z);
    a.partner = b; b.partner = a;
  }
}

export function updatePeds(dt) {
  const rng = Math.random;
  for (const ped of G.peds) {
    if (ped.down) continue;
    ped.phase += dt * (ped.state === 'walk' ? 1.6 : 1);
    if (G.shotMode) {
      // Staged figures hold their marks; only the pose breathes.
      posePed(ped, ped.pose, ped.phase);
      ped.mesh.position.set(ped.x, ped.mesh.userData.yOff || 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      continue;
    }
    if (ped.state === 'walk' || ped.state === 'flee') {
      const speed = ped.state === 'flee' ? 3.4 : ped.speed;
      const dx = ped.tx - ped.x, dz = ped.tz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.2) {
        ped.wait -= dt;
        posePed(ped, 'stand', ped.phase);
        if (ped.wait <= 0) { newTarget(ped, rng); ped.wait = randRange(rng, 0, 2.5); }
      } else {
        const want = Math.atan2(dx, dz);
        ped.heading = lerpAngle(ped.heading, want, Math.min(1, dt * 6));
        ped.x += Math.sin(ped.heading) * speed * dt;
        ped.z += Math.cos(ped.heading) * speed * dt;
        for (const b of collidersNear(G.city, ped.x, ped.z)) {
          const cx = Math.max(b.minX, Math.min(ped.x, b.maxX));
          const cz = Math.max(b.minZ, Math.min(ped.z, b.maxZ));
          if (dist2d(ped.x, ped.z, cx, cz) < 0.45) { ped.x += (ped.x - cx) * 0.4 + 0.2; ped.z += (ped.z - cz) * 0.4; newTarget(ped, rng); }
        }
        posePed(ped, ped.state === 'flee' ? 'run' : 'walk', ped.phase * 2.2);
      }
    } else if (ped.state === 'stand') {
      if (ped.partner) ped.heading = Math.atan2(ped.partner.x - ped.x, ped.partner.z - ped.z);
      posePed(ped, ped.pose, ped.phase);
    }
    ped.mesh.position.set(ped.x, ped.mesh.userData.yOff || 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

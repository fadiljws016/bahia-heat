// pedestrians.js — the ambient city: walkers on the sidewalks, browsers
// at the stalls, sitters on the promenade, chat pairs, and — when a job
// turns hot — hostile gunmen. Peds are thin wrappers over people.js rigs.

import { G } from './state.js';
import { makeRng, pick, randRange, dist2d, wrapAngle, lerpAngle } from './util.js';
import { buildPersonMesh, posePerson, showWeapon, randomOutfit, outfitRng } from './people.js';
import { isOnRoad, ROADS_X, ROADS_Z, BOULEVARD_X } from './city.js';
import { gunshotFx } from './effects.js';
import { hurtPlayer } from './player.js';

let pedSeq = 1;

export function spawnPedAt(x, z, state = 'walk', opts = {}) {
  const rng = outfitRng((opts.seed || 0) * 1000 + pedSeq * 37);
  const outfit = opts.outfit || randomOutfit(rng);
  if (opts.color) outfit.shirt = opts.color;
  if (opts.name === 'marisol') { outfit.dress = true; outfit.hair = 0x14100c; }
  const mesh = buildPersonMesh(outfit);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = opts.heading || 0;
  G.scene.add(mesh);
  const ped = {
    id: pedSeq, x, z, heading: opts.heading || 0, mesh,
    state, pose: opts.pose || null, phase: opts.phase || 0,
    hp: opts.hp || 100, hostile: !!opts.hostile, name: opts.name || null,
    speed: 0, targetSpeed: state === 'walk' ? randRange(rng, 1.1, 1.7) : 0,
    wanderT: randRange(rng, 2, 6), fireT: randRange(rng, 0.4, 1.2),
    dead: false, seed: opts.seed || 0,
  };
  pedSeq += 1;
  if (ped.hostile) showWeapon(mesh, 'pistol', 'hand');
  G.peds.push(ped);
  return ped;
}

export function posePed(ped, pose, phase = 0, opts = {}) {
  ped.pose = pose;
  posePerson(ped.mesh, pose, phase, opts);
}

/** A little crowd: n figures around (x, z) in the given modes. */
export function crowd(x, z, n, seed, modes = ['idle', 'chat', 'walk']) {
  const rng = makeRng(seed * 977 + 5);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const a = rng() * Math.PI * 2;
    const r = 1.5 + rng() * 5;
    const mode = pick(rng, modes);
    const ped = spawnPedAt(x + Math.cos(a) * r, z + Math.sin(a) * r, mode === 'walk' ? 'walk' : 'stand', {
      heading: rng() * Math.PI * 2, seed: seed * 31 + i, pose: mode === 'walk' ? null : mode,
    });
    out.push(ped);
  }
  return out;
}

export function initPeds() {
  const rng = makeRng(31337);
  // Sidewalk walkers along the avenues.
  for (let i = 0; i < 46; i += 1) {
    const onX = rng() < 0.6;
    const line = onX ? pick(rng, ROADS_X) : pick(rng, ROADS_Z);
    const side = (rng() < 0.5 ? -1 : 1) * 8.6;
    const x = onX ? line + side : randRange(rng, -230, 280);
    const z = onX ? randRange(rng, -290, 290) : line + side;
    spawnPedAt(x, z, 'walk', { heading: rng() * Math.PI * 2, seed: i + 1 });
  }
  // Promenade life: browsers and sitters facing the bay.
  for (let i = 0; i < 14; i += 1) {
    const z = randRange(rng, -140, 160);
    const mode = pick(rng, ['stand', 'stand', 'sit']);
    spawnPedAt(-219 + randRange(rng, -3, 3), z, mode === 'sit' ? 'sit' : 'stand', {
      heading: -Math.PI / 2, seed: 100 + i, pose: mode === 'sit' ? 'sit' : 'idle',
    });
  }
  // Chat pairs in the plazas and along the arcade.
  for (let i = 0; i < 8; i += 1) {
    const x = randRange(rng, -200, 240);
    const z = randRange(rng, -200, 240);
    if (isOnRoad(x, z)) continue;
    const a = spawnPedAt(x, z, 'stand', { seed: 200 + i, pose: 'chat', phase: rng() * 3 });
    const b = spawnPedAt(x + 1.1, z + 0.4, 'stand', { seed: 300 + i, pose: 'chat', phase: rng() * 3 });
    a.heading = Math.atan2(b.x - a.x, b.z - a.z);
    b.heading = Math.atan2(a.x - b.x, a.z - b.z);
  }
}

export function removePed(ped) {
  const i = G.peds.indexOf(ped);
  if (i >= 0) G.peds.splice(i, 1);
  if (ped.mesh && ped.mesh.parent) ped.mesh.parent.remove(ped.mesh);
}

export function hurtPed(ped, amount) {
  if (ped.dead) return;
  ped.hp -= amount;
  if (ped.hp <= 0) {
    ped.dead = true;
    ped.state = 'down';
    posePed(ped, 'down');
    if (ped.hostile && G.mission && G.mission.state === 'active') {
      G.mission.killsLeft = Math.max(0, (G.mission.killsLeft || 0) - 1);
    }
  } else if (!ped.hostile) {
    ped.state = 'flee';
    ped.targetSpeed = 3.6;
  }
}

export function updatePeds(dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    ped.phase += dt * (ped.state === 'walk' || ped.state === 'flee' ? 5.2 : 1.6);
    if (ped.hostile && p && !p.dead) {
      // Gunmen hold their ground and shoot on a cadence.
      const d = dist2d(ped.x, ped.z, p.x, p.z);
      ped.heading = lerpAngle(ped.heading, Math.atan2(p.x - ped.x, p.z - ped.z), dt * 6);
      ped.fireT -= dt;
      posePed(ped, ped.fireT < 0.18 ? 'fire' : 'aim', ped.phase, { recoil: ped.fireT < 0 ? 1 : 0 });
      if (ped.fireT <= 0 && d < 30) {
        ped.fireT = 0.55 + Math.random() * 0.8;
        const from = new THREE.Vector3(0, 1.32, 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), ped.heading);
        gunshotFx(ped.x + from.x, 1.32, ped.z + from.z, p.x, 1.15, p.z, { heading: ped.heading, sparks: 2 });
        if (Math.random() < 0.4) hurtPlayer(4 + Math.random() * 5);
      }
    } else if (ped.state === 'walk' || ped.state === 'flee') {
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = 2 + Math.random() * 5;
        ped.heading += (Math.random() - 0.5) * 1.8;
        // Prefer sidewalks: steer away from the carriageway centre lines.
        if (isOnRoad(ped.x, ped.z) && Math.random() < 0.7) ped.heading += Math.PI / 2;
      }
      ped.speed += ((ped.targetSpeed || 1.4) - ped.speed) * Math.min(1, dt * 3);
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      if (ped.x < -246) ped.heading = Math.PI / 2;
      if (ped.x > 286) ped.heading = -Math.PI / 2;
      if (ped.z < -302) ped.heading = 0;
      if (ped.z > 302) ped.heading = Math.PI;
      posePed(ped, ped.state === 'flee' ? 'run' : 'walk', ped.phase);
      if (ped.state === 'flee' && ped.phase > 40) { ped.state = 'walk'; ped.targetSpeed = 1.3; }
    } else if (ped.state === 'sit') {
      posePed(ped, 'sit', ped.phase);
    } else {
      posePed(ped, ped.pose || 'idle', ped.phase);
    }
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

// officers.js — PAPD foot units: they spawn at cruisers and roadblocks,
// take cover, fire on cadence, go down, and get replaced while the heat
// is on. spawnOfficerAt is also the staging API shots.js uses, with
// phases 'fire' and 'crouch' frozen for the camera.

import { G } from './state.js';
import { dist2d, lerpAngle } from './util.js';
import { buildPersonMesh, posePerson, showWeapon } from './people.js';
import { gunshotFx } from './effects.js';
import { hurtPlayer } from './player.js';

let officerSeq = 1;

export function spawnOfficerAt(x, z, opts = {}) {
  const mesh = buildPersonMesh({ skin: 0xc98a5e, shirt: 0x27313a, pants: 0x27313a, hair: 0x1d1410, uniform: 0x27313a });
  mesh.position.set(x, 0, z);
  mesh.rotation.y = opts.heading || 0;
  G.scene.add(mesh);
  showWeapon(mesh, 'pistol', 'hand');
  const off = {
    id: officerSeq, x, z, heading: opts.heading || 0, mesh,
    hp: 100, dead: false, phase: opts.phase || 'cover',
    homeCar: opts.homeCar || null, roadblock: opts.roadblock || null,
    fireT: 0.3 + Math.random() * 0.9, phaseT: Math.random() * 3,
    posePhase: Math.random() * 4,
  };
  officerSeq += 1;
  G.officers.push(off);
  return off;
}

export function spawnRoadblockOfficers(rb) {
  const a = spawnOfficerAt(rb.x - 2.2, rb.z + 2.8, { phase: 'crouch', roadblock: rb, heading: Math.PI });
  const b = spawnOfficerAt(rb.x + 5.4, rb.z + 2.8, { phase: 'fire', roadblock: rb, heading: Math.PI });
  return [a, b];
}

export function ensureOfficers() {
  const want = G.wanted >= 3.5 ? 5 : G.wanted >= 2 ? 3 : G.wanted >= 1 ? 1 : 0;
  const alive = G.officers.filter((o) => !o.dead && !o.roadblock).length;
  if (alive >= want || !G.player) return;
  const p = G.player;
  const a = Math.random() * Math.PI * 2;
  spawnOfficerAt(p.x + Math.cos(a) * 26, p.z + Math.sin(a) * 26, { phase: 'cover' });
}

export function removeOfficer(off) {
  const i = G.officers.indexOf(off);
  if (i >= 0) G.officers.splice(i, 1);
  if (off.mesh && off.mesh.parent) off.mesh.parent.remove(off.mesh);
}

export function hurtOfficer(off, amount) {
  if (off.dead) return;
  off.hp -= amount;
  if (off.hp <= 0) {
    off.dead = true;
    posePerson(off.mesh, 'down', 0);
    if (typeof window !== 'undefined') {
      // The response escalates when an officer goes down.
      G.heat += 0.8;
    }
  }
}

export function updateOfficers(dt) {
  const p = G.player;
  for (const off of G.officers) {
    if (off.dead) continue;
    off.posePhase += dt * 1.7;
    off.phaseT -= dt;
    if (p && !G.shotMode) {
      const d = dist2d(off.x, off.z, p.x, p.z);
      const targetHeading = Math.atan2(p.x - off.x, p.z - off.z);
      off.heading = lerpAngle(off.heading, targetHeading, dt * 5);
      // Phase machine: advance, cover, fire.
      if (off.phaseT <= 0) {
        off.phaseT = 1.6 + Math.random() * 2.4;
        off.phase = off.phase === 'fire' ? 'cover' : (d < 26 ? 'fire' : 'advance');
      }
      if (off.phase === 'advance' && d > 13) {
        off.x += Math.sin(off.heading) * 2.6 * dt;
        off.z += Math.cos(off.heading) * 2.6 * dt;
        posePerson(off.mesh, 'run', off.posePhase * 2.2);
      } else if (off.phase === 'fire') {
        posePerson(off.mesh, off.fireT < 0.15 ? 'fire' : 'aim', off.posePhase, { recoil: off.fireT < 0 ? 1 : 0 });
        off.fireT -= dt;
        if (off.fireT <= 0 && d < 30 && !p.dead) {
          off.fireT = 0.6 + Math.random() * 0.9;
          gunshotFx(off.x + Math.sin(off.heading) * 0.4, 1.32, off.z + Math.cos(off.heading) * 0.4, p.x, 1.15, p.z, { heading: off.heading, sparks: 2 });
          if (Math.random() < 0.34) hurtPlayer(3 + Math.random() * 5);
        }
      } else {
        posePerson(off.mesh, Math.random() < 0.5 ? 'crouch' : 'aim', off.posePhase);
      }
    } else {
      // Staged: hold the phase the staging asked for, firing on cadence.
      if (off.phase === 'fire') {
        off.fireT -= dt;
        posePerson(off.mesh, off.fireT < 0.15 ? 'fire' : 'aim', off.posePhase, { recoil: off.fireT < 0 ? 1 : 0 });
        if (off.fireT <= 0 && p) {
          off.fireT = 0.5 + Math.random() * 0.7;
          const foe = off.foe || (off.roadblock && off.roadblock.foe) || p;
          const tx = foe.x;
          const tz = foe.z;
          gunshotFx(off.x + Math.sin(off.heading) * 0.4, 1.32, off.z + Math.cos(off.heading) * 0.4, tx, 1.15, tz, { heading: off.heading, sparks: 2 });
        }
      } else if (off.phase === 'crouch') {
        posePerson(off.mesh, 'crouch', off.posePhase);
      } else {
        posePerson(off.mesh, 'aim', off.posePhase);
      }
    }
    off.mesh.position.set(off.x, 0, off.z);
    off.mesh.rotation.y = off.heading;
  }
  if (!G.shotMode) ensureOfficers();
}

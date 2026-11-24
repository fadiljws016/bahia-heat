// officers.js — PAPD foot officers: the navy figures who hold roadblocks,
// take cover behind their cruisers and keep up a live fire pattern in the
// staged scenes. spawnOfficerAt is the staging entry point.

import { G } from './state.js';
import { randRange, lerpAngle, dist2d } from './util.js';
import { buildPersonMesh, posePerson, showWeapon } from './people.js';
import { gunshotFx } from './effects.js';
import { hurtPlayer } from './player.js';

const NAVY = 0x27355a;
let _unitCounter = 863;

export function spawnOfficerAt(x, z, opts = {}) {
  const mesh = buildPersonMesh({
    skin: 0xc98a5e, shirt: NAVY, pants: 0x1f2733, hair: 0x1d1410,
    dress: false, cap: true, capColor: 0x1f2c44, belt: 0xd8b13c, seed: 7000 + G.officers.length * 13,
  });
  mesh.position.set(x, 0, z);
  if (G.scene) G.scene.add(mesh);
  const off = {
    mesh, x, z,
    heading: opts.heading || 0,
    phase: opts.phase || 'stand',     // 'fire' | 'crouch' | 'chase' | 'stand'
    homeCar: opts.homeCar || null,
    roadblock: opts.roadblock || null,
    target: opts.target || null,      // {x, z} or an actor with x/z
    health: 100, down: false,
    unit: _unitCounter++,
    fireTimer: randRange(Math.random, 0.2, 1.4),
    posePhase: randRange(Math.random, 0, 6),
    staged: !!opts.staged,
  };
  showWeapon(mesh, 'pistol', off.phase === 'fire' || off.phase === 'crouch' ? 'hand' : 'hip');
  G.officers.push(off);
  applyPose(off, 0);
  return off;
}

function applyPose(off, phase) {
  const pose = off.down ? 'down'
    : off.phase === 'fire' ? 'fire'
    : off.phase === 'crouch' ? 'crouch'
    : off.phase === 'chase' ? 'run'
    : 'stand';
  posePerson(off.mesh, pose, phase);
  off.mesh.position.set(off.x, off.mesh.userData.yOff || 0, off.z);
  off.mesh.rotation.y = off.heading;
}

export function spawnRoadblockOfficers(rb) {
  const made = [];
  made.push(spawnOfficerAt(rb.x - 2.2, rb.z + 2.8, { phase: 'crouch', roadblock: rb, staged: G.shotMode }));
  made.push(spawnOfficerAt(rb.x + 5.4, rb.z + 2.8, { phase: 'fire', roadblock: rb, staged: G.shotMode }));
  return made;
}

// Live play keeps a small foot presence near the station and the marina.
export function ensureOfficers() {
  if (G.shotMode) return;
  const want = G.wanted >= 2 ? 4 : 2;
  const alive = G.officers.filter((o) => !o.down && !o.staged);
  if (alive.length >= want) return;
  const spots = [[168, 44], [-196, 20], [104, -36], [30, 26]];
  for (const [x, z] of spots) {
    if (alive.length >= want) break;
    if (alive.some((o) => dist2d(o.x, o.z, x, z) < 6)) continue;
    spawnOfficerAt(x, z, { phase: 'stand' });
  }
}

export function removeOfficer(off) {
  const i = G.officers.indexOf(off);
  if (i >= 0) G.officers.splice(i, 1);
  if (off.mesh && off.mesh.parent) off.mesh.parent.remove(off.mesh);
}

export function hurtOfficer(off, amount) {
  if (off.down) return;
  off.health -= amount;
  if (off.health <= 0) {
    off.down = true;
    applyPose(off, 0);
  }
}

function targetPoint(off) {
  if (off.target && typeof off.target.x === 'number') return off.target;
  if (G.player) return G.player;
  return { x: off.x + Math.sin(off.heading) * 8, z: off.z + Math.cos(off.heading) * 8 };
}

// One live round from a staged 'fire' officer: muzzle at the gun tip,
// tracer to the target's chest, sparks where it lands.
export function officerShoot(off) {
  const t = targetPoint(off);
  const mx = off.x + Math.sin(off.heading) * 0.45;
  const mz = off.z + Math.cos(off.heading) * 0.45;
  gunshotFx(mx, 1.32, mz, t.x, 1.15, t.z, { heading: off.heading });
}

export function updateOfficers(dt) {
  for (const off of G.officers) {
    if (off.down) continue;
    off.posePhase += dt * 2;
    const t = targetPoint(off);
    if (off.phase === 'fire' || off.phase === 'crouch') {
      // Hold position, track the target, fire in ragged bursts.
      const want = Math.atan2(t.x - off.x, t.z - off.z);
      off.heading = lerpAngle(off.heading, want, Math.min(1, dt * 5));
      off.fireTimer -= dt;
      if (off.fireTimer <= 0) {
        officerShoot(off);
        off.fireTimer = off.phase === 'fire' ? randRange(Math.random, 0.35, 1.1) : randRange(Math.random, 0.9, 1.8);
        if (!G.shotMode && G.player && dist2d(off.x, off.z, G.player.x, G.player.z) < 26 && Math.random() < 0.3) {
          hurtPlayer(3 + Math.random() * 4);
        }
      }
    } else if (!G.shotMode && off.phase === 'chase' && G.player) {
      const d = dist2d(off.x, off.z, G.player.x, G.player.z);
      const want = Math.atan2(G.player.x - off.x, G.player.z - off.z);
      off.heading = lerpAngle(off.heading, want, Math.min(1, dt * 6));
      if (d > 2.2) {
        off.x += Math.sin(off.heading) * 3.6 * dt;
        off.z += Math.cos(off.heading) * 3.6 * dt;
      } else if (Math.random() < dt * 0.8) {
        officerShoot(off);
        if (Math.random() < 0.4) hurtPlayer(2 + Math.random() * 3);
      }
    }
    applyPose(off, off.posePhase);
  }
}

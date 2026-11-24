// people.js — the figure kit: articulated low-poly bodies built from a
// rig of pivoted parts, the outfit lottery that dresses Puerto Alba,
// the weapon models, and the pose set every system acts through.
// Poses bend joints only — a pose NEVER rotates the figure's root;
// facing is the caller's heading, applied to the mesh itself. (That
// contract was measured the hard way in a facing audit: a posed man
// aims where his mesh points, not where his record says.)
import { makeRng, clamp } from './util.js';

export const SKIN_TONES = [0xc98a5e, 0x8a5a3b, 0xe8b48c, 0x6e4530, 0xa06a42, 0xdb9f6e];
export const SHIRT_COLORS = [0xd84f35, 0x2f7fd0, 0xf2b13c, 0x35b06f, 0xf5f0e6, 0xff7ab0, 0x57d7e8, 0x8a5fc0, 0xe8e3d5, 0x30363e, 0xff8c42, 0x2ea8a0, 0xc94f78];
export const PANTS_COLORS = [0x2c3a55, 0x4a3b2c, 0x6b6f75, 0x27313a, 0x8a7a5c, 0x3d5a80, 0xd8cfc0, 0x7a2e2e];
export const HAIR_COLORS = [0x1d1410, 0x3a2415, 0x6e4a26, 0xb08a4f, 0xd8d3c8, 0x8a2f1d];

export function outfitRng(seed) { return makeRng(seed); }

/** Dress a random citizen: tones, a hair style, sometimes a pattern. */
export function randomOutfit(rng) {
  const pickOne = (list) => list[Math.floor(rng() * list.length) % list.length];
  return {
    skin: pickOne(SKIN_TONES),
    shirt: pickOne(SHIRT_COLORS),
    pants: pickOne(PANTS_COLORS),
    hair: pickOne(HAIR_COLORS),
    hairStyle: pickOne(['short', 'long', 'bun', 'cap', 'bald', 'short']),
    skirt: rng() < 0.22,
    shirtPattern: rng() < 0.3 ? pickOne(['stripes', 'dots', 'floral']) : null,
    glasses: rng() < 0.18,
    uniform: false,
  };
}

function patternTexture(kind, colorHex) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const base = `#${new THREE.Color(colorHex).getHexString()}`;
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  if (kind === 'stripes') { for (let y = 4; y < 64; y += 12) g.fillRect(0, y, 64, 4); }
  else if (kind === 'dots') { for (let y = 8; y < 64; y += 16) for (let x = 8; x < 64; x += 16) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } }
  else { for (let i = 0; i < 10; i += 1) { g.beginPath(); g.arc(6 + (i * 37) % 52, 6 + (i * 23) % 52, 4, 0, 7); g.fill(); } }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function box(parent, mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

/** Build one articulated figure from an outfit record. */
export function buildPersonMesh(opts = {}) {
  const o = {
    skin: 0xc98a5e, shirt: 0x2f7fd0, pants: 0x2c3a55, hair: 0x1d1410,
    hairStyle: 'short', skirt: false, shirtPattern: null, glasses: false, uniform: false, ...opts,
  };
  const skinMat = new THREE.MeshLambertMaterial({ color: o.skin });
  const shirtMat = o.shirtPattern
    ? new THREE.MeshLambertMaterial({ map: patternTexture(o.shirtPattern, o.shirt) })
    : new THREE.MeshLambertMaterial({ color: o.shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: o.pants });
  const hairMat = new THREE.MeshLambertMaterial({ color: o.hair });

  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  // Legs pivot at the hip (y 0.95).
  const mkLeg = (side) => {
    const leg = new THREE.Group();
    leg.position.set(0.11 * side, 0.95, 0);
    box(leg, pantsMat, 0.15, 0.9, 0.17, 0, -0.45, 0);
    box(leg, new THREE.MeshLambertMaterial({ color: 0x2a2d33 }), 0.15, 0.08, 0.27, 0, -0.93, 0.045);
    rig.add(leg);
    return leg;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  // Torso and head.
  const torso = new THREE.Group();
  torso.position.set(0, 0.95, 0);
  box(torso, shirtMat, 0.44, 0.62, 0.24, 0, 0.31, 0);
  if (o.skirt) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 0.42, 8), shirtMat);
    skirt.position.set(0, 0.02, 0);
    skirt.castShadow = true;
    torso.add(skirt);
  }
  if (o.uniform) box(torso, new THREE.MeshLambertMaterial({ color: 0xd8b13c }), 0.07, 0.09, 0.02, -0.12, 0.42, 0.13);
  rig.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 1.58, 0);
  box(head, skinMat, 0.24, 0.28, 0.24, 0, 0.12, 0);
  if (o.hairStyle !== 'bald') box(head, hairMat, 0.26, 0.1, 0.26, 0, 0.27, 0);
  if (o.hairStyle === 'long') box(head, hairMat, 0.26, 0.36, 0.07, 0, 0.08, -0.115);
  if (o.hairStyle === 'bun') box(head, hairMat, 0.13, 0.13, 0.13, 0, 0.3, -0.1);
  if (o.hairStyle === 'cap') box(head, new THREE.MeshLambertMaterial({ color: o.uniform ? 0x22345e : o.shirt }), 0.27, 0.07, 0.3, 0, 0.26, 0.03);
  if (o.uniform) box(head, new THREE.MeshLambertMaterial({ color: 0x22345e }), 0.27, 0.07, 0.3, 0, 0.26, 0.03);
  if (o.glasses) box(head, new THREE.MeshLambertMaterial({ color: 0x14161a }), 0.25, 0.06, 0.03, 0, 0.14, 0.125);
  rig.add(head);

  // Arms pivot at the shoulder (y 1.5); the right hand carries a
  // weapon anchor, the right hip a holster anchor.
  const mkArm = (side) => {
    const arm = new THREE.Group();
    arm.position.set(0.285 * side, 1.5, 0);
    box(arm, shirtMat, 0.11, 0.6, 0.12, 0, -0.26, 0);
    box(arm, skinMat, 0.1, 0.12, 0.11, 0, -0.6, 0);
    rig.add(arm);
    return arm;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  const handR = new THREE.Group();
  handR.position.set(0, -0.62, 0.02);
  armR.add(handR);
  const hipAnchor = new THREE.Group();
  hipAnchor.position.set(0.27, 1.04, 0.04);
  rig.add(hipAnchor);

  root.userData.parts = { rig, legL, legR, torso, head, armL, armR, handR, hipAnchor };
  root.userData.weapons = { hand: null, hip: null };
  posePerson(root, 'idle', 0);
  return root;
}

/** The modelled guns: P-9 pistol, Kobra SMG, Muelle shotgun. */
export function buildWeaponMesh(kind) {
  const grp = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ color: 0x1c1e22 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2c2f34 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x7d5f38 });
  const add = (mat, sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    grp.add(m);
    return m;
  };
  if (kind === 'pistol') {
    add(dark, 0.05, 0.12, 0.19, 0, -0.03, 0.02);
    add(steel, 0.04, 0.05, 0.15, 0, 0.05, 0.1);
  } else if (kind === 'smg') {
    add(dark, 0.06, 0.13, 0.46, 0, 0, 0);
    add(steel, 0.04, 0.04, 0.16, 0, 0.03, 0.3);
    add(steel, 0.05, 0.17, 0.07, 0, -0.13, 0.04);
    add(wood, 0.05, 0.09, 0.15, 0, 0.01, -0.29);
  } else if (kind === 'shotgun') {
    add(wood, 0.07, 0.12, 0.34, 0, 0, -0.16);
    add(steel, 0.055, 0.055, 0.5, 0, 0.045, 0.22);
    add(wood, 0.085, 0.085, 0.2, 0, -0.01, 0.18);
  }
  return grp;
}

/** Put a weapon in the hand or on the hip; clears what was there. */
export function showWeapon(mesh, kind, where) {
  const parts = mesh.userData.parts;
  const store = mesh.userData.weapons;
  if (!parts || !store) return;
  if (store[where]) {
    store[where].parent?.remove(store[where]);
    store[where] = null;
  }
  if (!kind || kind === 'fists') return;
  const gun = buildWeaponMesh(kind);
  if (where === 'hip') {
    gun.position.set(0, 0, 0);
    gun.rotation.x = 0.5;
    parts.hipAnchor.add(gun);
  } else {
    gun.position.set(0, -0.02, 0.06);
    parts.handR.add(gun);
  }
  store[where] = gun;
}

/**
 * Pose a figure. Joints only: legs, arms, torso, head and the rig's
 * height (for sitting and crouching) — the root's rotation is never
 * touched, so a posed figure faces exactly where its mesh was turned.
 * opts: { crouch: 0..1, armsUp: bool }.
 */
export function posePerson(mesh, pose, phase = 0, opts = {}) {
  const P = mesh.userData.parts;
  if (!P) return;
  const crouch = clamp(opts.crouch ?? 0, 0, 1);
  P.rig.position.y = 0;
  P.legL.rotation.set(0, 0, 0); P.legR.rotation.set(0, 0, 0);
  P.armL.rotation.set(0, 0, 0); P.armR.rotation.set(0, 0, 0);
  P.torso.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0);

  if (crouch > 0) {
    P.rig.position.y -= 0.26 * crouch;
    P.legL.rotation.x = -0.55 * crouch;
    P.legR.rotation.x = 0.3 * crouch;
    P.torso.rotation.x = 0.16 * crouch;
  }

  switch (pose) {
    case 'walk': {
      const s = Math.sin(phase);
      P.legL.rotation.x = s * 0.55; P.legR.rotation.x = -s * 0.55;
      P.armL.rotation.x = -s * 0.4; P.armR.rotation.x = s * 0.4;
      break;
    }
    case 'run': {
      const s = Math.sin(phase);
      P.legL.rotation.x = s * 0.95; P.legR.rotation.x = -s * 0.95;
      P.armL.rotation.x = -s * 0.8; P.armR.rotation.x = s * 0.8;
      P.torso.rotation.x += 0.14;
      break;
    }
    case 'flee': {
      const s = Math.sin(phase * 1.3);
      P.legL.rotation.x = s * 1.0; P.legR.rotation.x = -s * 1.0;
      if (opts.armsUp) {
        P.armL.rotation.x = -2.9 + Math.sin(phase * 2.2) * 0.16;
        P.armR.rotation.x = -2.9 - Math.sin(phase * 2.2) * 0.16;
      } else {
        P.armL.rotation.x = -s * 0.9; P.armR.rotation.x = s * 0.9;
      }
      P.torso.rotation.x += 0.18;
      break;
    }
    case 'chat': {
      P.armR.rotation.x = -0.55 + Math.sin(phase * 1.7) * 0.28;
      P.armR.rotation.z = -0.15;
      P.armL.rotation.x = -0.2 + Math.cos(phase * 1.3) * 0.14;
      P.head.rotation.y = Math.sin(phase * 0.6) * 0.14;
      break;
    }
    case 'sit': {
      P.rig.position.y = -0.44;
      P.legL.rotation.x = -1.5; P.legR.rotation.x = -1.45;
      P.armL.rotation.x = -0.42; P.armR.rotation.x = -0.42;
      break;
    }
    case 'aim': {
      // Planted: feet apart, knees soft (the crouch above), the gun
      // arm level at the shoulder, the support arm tucked under it —
      // the whole shotgun silhouette clear of the torso.
      P.armR.rotation.x = -Math.PI / 2 + 0.05;
      P.armL.rotation.x = -Math.PI / 2 + 0.3;
      P.armL.rotation.z = 0.55;
      P.legL.rotation.z = 0.1; P.legR.rotation.z = -0.1;
      P.torso.rotation.y = -0.1;
      if (!opts.crouch) {
        P.rig.position.y -= 0.06;
        P.legL.rotation.x = -0.12; P.legR.rotation.x = 0.08;
      }
      break;
    }
    case 'down': {
      P.armL.rotation.z = 2.5; P.armR.rotation.z = -2.3;
      P.armL.rotation.x = -0.4; P.armR.rotation.x = 0.3;
      P.legL.rotation.x = 0.12; P.legR.rotation.x = -0.06;
      break;
    }
    case 'punch': {
      P.armR.rotation.x = -1.85;
      P.torso.rotation.y = 0.3;
      break;
    }
    default: { // idle / stand: breathing, a little weight shift
      P.armL.rotation.x = Math.sin(phase * 0.9) * 0.05;
      P.armR.rotation.x = -Math.sin(phase * 0.9) * 0.05;
      P.torso.rotation.y = Math.sin(phase * 0.45) * 0.03;
    }
  }
}

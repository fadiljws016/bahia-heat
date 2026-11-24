// people.js — articulated low-poly figures: pivoted limbs, outfits, weapon
// models and the pose set. Poses move limbs around their pivots; the root
// itself never rotates, so a posed figure keeps its footing and heading.

import { makeRng, pick, randRange } from './util.js';

export const SKIN_TONES = [0xc98a5e, 0x8a5a3b, 0xe8b48c, 0x6e4530, 0xa06a42, 0xdb9f6e];
export const SHIRT_COLORS = [0xd84f35, 0x2f7fd0, 0xf2b13c, 0x35b06f, 0xf5f0e6, 0xff7ab0, 0x57d7e8, 0x8a5fc0, 0xe8e3d5, 0x30363e, 0xff8c42, 0x2ea8a0, 0xc94f78];
export const PANTS_COLORS = [0x2c3a55, 0x4a3b2c, 0x6b6f75, 0x27313a, 0x8a7a5c, 0x3d5a80, 0xd8cfc0, 0x7a2e2e];
export const HAIR_COLORS = [0x1d1410, 0x3a2415, 0x6e4a26, 0xb08a4f, 0xd8d3c8, 0x8a2f1d];

export function outfitRng(seed) { return makeRng(seed); }

export function randomOutfit(rng) {
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, SHIRT_COLORS),
    pants: pick(rng, PANTS_COLORS),
    hair: pick(rng, HAIR_COLORS),
    dress: rng() < 0.22,
    cap: rng() < 0.18,
  };
}

const mat = (color) => new THREE.MeshLambertMaterial({ color });
function pbox(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// A limb pivot: a group at the joint with the limb mesh hanging below it.
function limb(w, len, color, shoeColor) {
  const g = new THREE.Group();
  const seg = pbox(w, len, w, color, 0, -len / 2, 0);
  g.add(seg);
  if (shoeColor !== undefined) g.add(pbox(w + 0.04, 0.09, w + 0.14, shoeColor, 0, -len + 0.02, 0.04));
  return g;
}

// Weapon models: chunky silhouettes that read at screenshot distance.
export function buildWeaponMesh(kind) {
  const g = new THREE.Group();
  const dark = 0x1d1f24, wood = 0x6e4a26, steel = 0x565d66;
  if (kind === 'pistol') {
    g.add(pbox(0.07, 0.13, 0.3, dark, 0, 0, 0.08));
    g.add(pbox(0.06, 0.2, 0.09, dark, 0, -0.13, -0.02));
  } else if (kind === 'smg') {
    g.add(pbox(0.08, 0.14, 0.62, dark, 0, 0, 0.16));
    g.add(pbox(0.06, 0.26, 0.08, steel, 0, -0.16, 0.1));
    g.add(pbox(0.06, 0.18, 0.08, dark, 0, -0.1, -0.14));
    g.add(pbox(0.05, 0.05, 0.2, steel, 0, 0.09, 0.3));
  } else if (kind === 'shotgun') {
    g.add(pbox(0.09, 0.13, 0.95, steel, 0, 0.02, 0.2));
    g.add(pbox(0.1, 0.16, 0.34, wood, 0, -0.03, -0.32));
    g.add(pbox(0.11, 0.14, 0.3, wood, 0, -0.05, 0.18));
  }
  g.userData.kind = kind;
  return g;
}

// Attach (or hide) a weapon on a figure: 'hand', 'hip' or 'none'.
export function showWeapon(mesh, kind, where) {
  const u = mesh.userData;
  if (u.weaponMesh) { u.weaponMesh.parent.remove(u.weaponMesh); u.weaponMesh = null; }
  if (!kind || kind === 'fists' || where === 'none') return;
  const w = buildWeaponMesh(kind);
  if (where === 'hip') {
    w.position.set(0.16, -0.34, -0.05);
    w.rotation.x = Math.PI / 2.4;
    u.hips.add(w);
  } else {
    w.position.set(0, -0.62, 0.14);
    w.rotation.x = -Math.PI / 2 + 0.3;
    u.armR.add(w);
  }
  u.weaponMesh = w;
}

// Figure layout (metres): legs pivot at hip height 0.86, torso above, arms
// pivot at shoulder height 1.42, head on top. Total height ~1.78.
export function buildPersonMesh(opts = {}) {
  const o = Object.assign(randomOutfit(makeRng(opts.seed || 7)), opts);
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.86;
  root.add(hips);

  const legL = limb(0.17, 0.86, o.dress ? o.skin : o.pants, 0x2a2320);
  legL.position.set(-0.13, 0.86, 0);
  root.add(legL);
  const legR = limb(0.17, 0.86, o.dress ? o.skin : o.pants, 0x2a2320);
  legR.position.set(0.13, 0.86, 0);
  root.add(legR);

  if (o.dress) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.4, 0.52, 7), mat(o.shirt));
    skirt.position.y = 0.22; skirt.castShadow = true;
    hips.add(skirt);
  }
  const torso = pbox(0.46, 0.62, 0.24, o.shirt, 0, 0.31, 0);
  hips.add(torso);
  if (o.belt !== undefined) hips.add(pbox(0.47, 0.08, 0.25, o.belt, 0, 0.03, 0));

  const headG = new THREE.Group();
  headG.position.y = 0.68;
  hips.add(headG);
  headG.add(pbox(0.3, 0.34, 0.3, o.skin, 0, 0.16, 0));
  if (o.cap) {
    headG.add(pbox(0.34, 0.09, 0.34, o.capColor || 0x274b63, 0, 0.35, 0));
    headG.add(pbox(0.3, 0.05, 0.2, o.capColor || 0x274b63, 0, 0.31, 0.22));
  } else {
    headG.add(pbox(0.32, 0.12, 0.32, o.hair, 0, 0.36, -0.01));
  }

  const armL = limb(0.13, 0.68, o.shirt, undefined);
  armL.position.set(-0.31, 0.56, 0);
  armL.children[0].material = mat(o.shirt);
  hips.add(armL);
  const armR = limb(0.13, 0.68, o.shirt, undefined);
  armR.position.set(0.31, 0.56, 0);
  hips.add(armR);
  // Hands in skin tone at the limb ends.
  for (const a of [armL, armR]) {
    const hand = pbox(0.12, 0.12, 0.12, o.skin, 0, -0.68, 0);
    a.add(hand);
  }

  root.userData = { hips, head: headG, armL, armR, legL, legR, outfit: o, weaponMesh: null };
  return root;
}

function setLimb(g, x, y, z) { g.rotation.set(x, y, z); }

// The pose set. `phase` animates walk cycles and chat gestures; opts.aimYaw
// lets a shooter track a target without turning the root.
export function posePerson(mesh, pose, phase = 0, opts = {}) {
  const u = mesh.userData;
  const { hips, head, armL, armR, legL, legR } = u;
  u.yOff = 0;
  hips.position.y = 0.86;
  hips.rotation.set(0, 0, 0);
  head.rotation.set(0, 0, 0);
  setLimb(armL, 0, 0, 0.06);
  setLimb(armR, 0, 0, -0.06);
  setLimb(legL, 0, 0, 0.02);
  setLimb(legR, 0, 0, -0.02);
  const sway = Math.sin(phase * 2) * 0.03;
  switch (pose) {
    case 'walk': {
      const s = Math.sin(phase * 6);
      setLimb(legL, s * 0.55, 0, 0.02);
      setLimb(legR, -s * 0.55, 0, -0.02);
      setLimb(armL, -s * 0.4, 0, 0.06);
      setLimb(armR, s * 0.4, 0, -0.06);
      hips.position.y = 0.86 + Math.abs(Math.cos(phase * 6)) * 0.03;
      break;
    }
    case 'run': {
      const s = Math.sin(phase * 9);
      setLimb(legL, s * 0.85, 0, 0.02);
      setLimb(legR, -s * 0.85, 0, -0.02);
      setLimb(armL, -s * 0.7, 0, 0.1);
      setLimb(armR, s * 0.7, 0, -0.1);
      hips.rotation.x = 0.14;
      hips.position.y = 0.86 + Math.abs(Math.cos(phase * 9)) * 0.05;
      break;
    }
    case 'chat': {
      const g = Math.sin(phase * 2.2);
      setLimb(armR, -0.7 + g * 0.22, 0, -0.15);
      setLimb(armL, -0.25 - g * 0.12, 0, 0.2);
      head.rotation.y = Math.sin(phase * 0.9) * 0.14;
      hips.rotation.z = sway * 0.4;
      break;
    }
    case 'sit': {
      setLimb(legL, -Math.PI / 2, 0, 0.02);
      setLimb(legR, -Math.PI / 2, 0, -0.02);
      hips.position.y = 0.48;
      setLimb(armL, -0.35, 0, 0.12);
      setLimb(armR, -0.35, 0, -0.12);
      break;
    }
    case 'aim': {
      // Planted stance: feet apart, both arms up on the weapon.
      setLimb(legL, 0.06, 0, 0.16);
      setLimb(legR, -0.1, 0, -0.16);
      setLimb(armR, -Math.PI / 2 + 0.06, 0, -0.05);
      setLimb(armL, -Math.PI / 2 + 0.16, -0.25, 0.3);
      hips.rotation.x = 0.07;
      if (opts.aimYaw) head.rotation.y = opts.aimYaw;
      break;
    }
    case 'fire': {
      const kick = Math.abs(Math.sin(phase * 31)) * 0.05;
      setLimb(legL, 0.06, 0, 0.16);
      setLimb(legR, -0.12, 0, -0.16);
      setLimb(armR, -Math.PI / 2 - kick, 0, -0.05);
      setLimb(armL, -Math.PI / 2 + 0.14, -0.25, 0.3);
      hips.rotation.x = 0.09;
      hips.position.y = 0.85;
      break;
    }
    case 'crouch': {
      setLimb(legL, -1.9, 0, 0.05);
      setLimb(legR, -0.5, 0, -0.05);
      hips.position.y = 0.45;
      hips.rotation.x = 0.3;
      setLimb(armR, -Math.PI / 2 + 0.1, 0, -0.05);
      setLimb(armL, -0.9, -0.2, 0.25);
      break;
    }
    case 'surrender': {
      setLimb(armL, Math.PI - 0.25, 0, 0.5);
      setLimb(armR, Math.PI - 0.25, 0, -0.5);
      head.rotation.x = 0.18;
      hips.position.y = 0.84 + sway * 0.2;
      break;
    }
    case 'down': {
      // Lying flat on the back: legs swing forward horizontal, torso folds
      // back horizontal at the same height, and the whole figure drops by
      // yOff so the body line rests on the ground instead of floating.
      setLimb(legL, Math.PI / 2 - 0.05, 0, 0.05);
      setLimb(legR, Math.PI / 2 + 0.04, 0, -0.04);
      hips.rotation.x = Math.PI / 2 - 0.05;
      hips.position.y = 0.86;
      setLimb(armL, 0.4, 0, 0.85);
      setLimb(armR, -0.3, 0, -0.65);
      head.rotation.x = -0.35;
      u.yOff = -0.68;
      break;
    }
    case 'drive': {
      setLimb(legL, -Math.PI / 2 + 0.15, 0, 0.02);
      setLimb(legR, -Math.PI / 2 + 0.3, 0, -0.02);
      hips.position.y = 0.5;
      setLimb(armL, -0.85, 0, 0.15);
      setLimb(armR, -0.85, 0, -0.15);
      break;
    }
    default: { // stand / idle: a breathing figure, weight shifting
      hips.position.y = 0.86 + sway * 0.3;
      setLimb(armL, sway, 0, 0.07);
      setLimb(armR, -sway, 0, -0.07);
    }
  }
}

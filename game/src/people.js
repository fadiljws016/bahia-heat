// people.js — the low-poly citizens of Puerto Alba: pivoted figures with
// articulated limbs, painted outfits and readable weapon models. Poses
// never rotate the root — a pose is limb angles plus a body bob, so a
// staged figure stays planted exactly where the staging put it.

import { makeRng, pick } from './util.js';

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
    dress: rng() < 0.3,
    hat: rng() < 0.22,
  };
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function part(parent, mat, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function limb(mat, x, y, z, sx, sy, sz) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(sx, sy, sz);
  m.position.y = -sy / 2;
  m.castShadow = true;
  pivot.add(m);
  return pivot;
}

/** A readable little gun: body, barrel, grip, magazine. */
export function buildWeaponMesh(kind) {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x1d2026 });
  const steel = new THREE.MeshLambertMaterial({ color: 0x4a5058 });
  if (kind === 'pistol') {
    part(g, dark, 0.07, 0.11, 0.3, 0, 0, 0.02);
    part(g, steel, 0.05, 0.05, 0.14, 0, 0.03, 0.2);
    part(g, dark, 0.06, 0.17, 0.09, 0, -0.12, -0.05).rotation.x = 0.25;
  } else if (kind === 'smg') {
    part(g, dark, 0.08, 0.13, 0.52, 0, 0, 0.05);
    part(g, steel, 0.05, 0.05, 0.2, 0, 0.02, 0.38);
    part(g, dark, 0.06, 0.2, 0.08, 0, -0.15, 0.08);
    part(g, steel, 0.05, 0.16, 0.06, 0, -0.13, -0.14);
  } else if (kind === 'shotgun') {
    part(g, new THREE.MeshLambertMaterial({ color: 0x6e4a26 }), 0.08, 0.1, 0.34, 0, -0.01, -0.24);
    part(g, steel, 0.06, 0.07, 0.62, 0, 0.03, 0.18);
    part(g, dark, 0.07, 0.09, 0.2, 0, -0.03, 0.02);
    part(g, new THREE.MeshLambertMaterial({ color: 0x6e4a26 }), 0.07, 0.08, 0.22, 0, -0.06, 0.3);
  } else if (kind === 'rifle') {
    part(g, dark, 0.08, 0.12, 0.66, 0, 0, 0.06);
    part(g, steel, 0.05, 0.05, 0.24, 0, 0.03, 0.48);
    part(g, dark, 0.06, 0.18, 0.08, 0, -0.14, 0.02);
  }
  g.userData.kind = kind;
  // Muzzle tip marker: effects read this world position for flashes.
  g.userData.muzzleLocal = new THREE.Vector3(0, 0.02, kind === 'pistol' ? 0.28 : kind === 'smg' ? 0.5 : 0.52);
  return g;
}

export function showWeapon(mesh, kind, where) {
  const rig = mesh.userData;
  if (rig.weapon) {
    rig.weapon.parent.remove(rig.weapon);
    rig.weapon = null;
  }
  if (!kind || kind === 'fists') return;
  const w = buildWeaponMesh(kind);
  if (where === 'hip') {
    w.position.set(0.3, 0.92, 0.05);
    w.rotation.x = Math.PI / 2.4;
    mesh.add(w);
  } else {
    // Held: in the right hand, pointing where the arm points.
    w.position.set(0, -0.52, 0.06);
    w.rotation.x = Math.PI / 2;
    rig.armR.add(w);
  }
  rig.weapon = w;
}

/**
 * A person: torso, head, two arm pivots at the shoulders, two leg pivots
 * at the hips. opts: outfit fields plus uniform (PAPD), dress, name.
 * The rig lives in mesh.userData: { torso, head, armL, armR, legL, legR }.
 */
export function buildPersonMesh(opts = {}) {
  const o = { skin: 0xc98a5e, shirt: 0x2f7fd0, pants: 0x2c3a55, hair: 0x1d1410, dress: false, hat: false, ...opts };
  const root = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: o.skin });
  const shirtMat = new THREE.MeshLambertMaterial({ color: o.uniform || o.shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: o.uniform ? 0x27313a : o.pants });
  const hairMat = new THREE.MeshLambertMaterial({ color: o.hair });

  const body = new THREE.Group();
  root.add(body);
  const torso = part(body, shirtMat, 0.52, 0.62, 0.3, 0, 1.12, 0);
  if (o.dress) {
    const skirt = part(body, shirtMat, 0.56, 0.5, 0.34, 0, 0.62, 0);
    skirt.geometry = boxGeo;
  }
  if (o.uniform) {
    part(body, new THREE.MeshLambertMaterial({ color: 0xf2c13c }), 0.12, 0.12, 0.02, -0.16, 1.24, 0.16); // badge
    part(body, new THREE.MeshLambertMaterial({ color: 0x1d2026 }), 0.54, 0.1, 0.32, 0, 0.86, 0); // belt
  }
  const head = new THREE.Group();
  head.position.set(0, 1.52, 0);
  const skull = part(head, skinMat, 0.34, 0.36, 0.34, 0, 0.16, 0);
  part(head, hairMat, 0.36, 0.12, 0.36, 0, 0.36, 0);
  if (o.hat || o.uniform) {
    part(head, new THREE.MeshLambertMaterial({ color: o.uniform ? 0x27313a : o.hair }), 0.44, 0.06, 0.44, 0, 0.33, 0);
    part(head, new THREE.MeshLambertMaterial({ color: o.uniform ? 0x27313a : o.hair }), 0.4, 0.14, 0.4, 0, 0.4, 0);
  }
  body.add(head);
  const armL = limb(shirtMat, -0.33, 1.38, 0, 0.15, 0.58, 0.15);
  const armR = limb(shirtMat, 0.33, 1.38, 0, 0.15, 0.58, 0.15);
  const handL = part(armL, skinMat, 0.13, 0.12, 0.13, 0, -0.62, 0);
  const handR = part(armR, skinMat, 0.13, 0.12, 0.13, 0, -0.62, 0);
  body.add(armL);
  body.add(armR);
  const legL = limb(pantsMat, -0.14, 0.82, 0, 0.17, 0.8, 0.17);
  const legR = limb(pantsMat, 0.14, 0.82, 0, 0.17, 0.8, 0.17);
  part(legL, new THREE.MeshLambertMaterial({ color: 0x2a2118 }), 0.18, 0.09, 0.3, 0, -0.8, 0.05);
  part(legR, new THREE.MeshLambertMaterial({ color: 0x2a2118 }), 0.18, 0.09, 0.3, 0, -0.8, 0.05);
  body.add(legL);
  body.add(legR);
  root.userData = { torso, head, armL, armR, legL, legR, body, outfit: o, weapon: null };
  return root;
}

/**
 * Pose a figure. phase drives walk/run cycles and chat gestures.
 * The root group is never rotated or lifted — only limbs and the inner
 * body group move — so staged positions stay exact.
 */
export function posePerson(mesh, pose, phase = 0, opts = {}) {
  const r = mesh.userData;
  const { armL, armR, legL, legR, head, body } = r;
  armL.rotation.set(0, 0, 0.06);
  armR.rotation.set(0, 0, -0.06);
  legL.rotation.set(0, 0, 0.02);
  legR.rotation.set(0, 0, -0.02);
  head.rotation.set(0, 0, 0);
  body.rotation.set(0, 0, 0);
  body.position.y = 0;
  const sw = Math.sin(phase);
  switch (pose) {
    case 'walk':
      legL.rotation.x = sw * 0.55;
      legR.rotation.x = -sw * 0.55;
      armL.rotation.x = -sw * 0.4;
      armR.rotation.x = sw * 0.4;
      body.position.y = Math.abs(Math.cos(phase)) * 0.04;
      break;
    case 'run':
      legL.rotation.x = sw * 0.95;
      legR.rotation.x = -sw * 0.95;
      armL.rotation.x = -sw * 0.8 - 0.3;
      armR.rotation.x = sw * 0.8 - 0.3;
      body.rotation.x = 0.12;
      body.position.y = Math.abs(Math.cos(phase)) * 0.07;
      break;
    case 'sit':
      legL.rotation.x = -Math.PI / 2;
      legR.rotation.x = -Math.PI / 2;
      body.position.y = -0.42;
      armL.rotation.x = -0.25;
      armR.rotation.x = -0.25;
      break;
    case 'chat':
      armR.rotation.x = -0.5 + Math.sin(phase * 2) * 0.16;
      armL.rotation.x = -0.2 + Math.cos(phase * 2) * 0.1;
      head.rotation.y = Math.sin(phase * 0.7) * 0.14;
      body.position.y = Math.sin(phase * 2) * 0.012;
      break;
    case 'aim':
      // Planted shooting stance: right arm straight at the target, left
      // arm up supporting, slight crouch in the legs, head level.
      armR.rotation.x = -Math.PI / 2 + 0.04;
      armL.rotation.x = -Math.PI / 2 + 0.22;
      armL.rotation.z = 0.38;
      legL.rotation.x = 0.14;
      legR.rotation.x = -0.2;
      body.position.y = -0.05;
      break;
    case 'fire':
      armR.rotation.x = -Math.PI / 2 + 0.04 - (opts.recoil || 0) * 0.1;
      armL.rotation.x = -Math.PI / 2 + 0.22;
      armL.rotation.z = 0.38;
      legL.rotation.x = 0.14;
      legR.rotation.x = -0.2;
      body.position.y = -0.05;
      break;
    case 'crouch':
      legL.rotation.x = -1.9;
      legR.rotation.x = -0.7;
      body.position.y = -0.52;
      armR.rotation.x = -Math.PI / 2 + 0.1;
      armL.rotation.x = -0.9;
      head.rotation.x = 0.15;
      break;
    case 'surrender':
      armL.rotation.z = Math.PI - 0.25;
      armR.rotation.z = -(Math.PI - 0.25);
      head.rotation.x = 0.2;
      break;
    case 'down':
      // Lying flat: the inner body pitches over, the root stays put.
      body.rotation.x = -Math.PI / 2;
      body.position.y = 0.24;
      armL.rotation.x = -0.4;
      armR.rotation.x = -2.6;
      legL.rotation.x = 0.1;
      legR.rotation.x = -0.16;
      break;
    case 'drive':
      legL.rotation.x = -Math.PI / 2 + 0.2;
      legR.rotation.x = -Math.PI / 2 + 0.2;
      body.position.y = -0.42;
      armL.rotation.x = -0.85;
      armR.rotation.x = -0.85;
      break;
    case 'phone':
      armR.rotation.x = -0.7;
      armR.rotation.z = -0.5;
      head.rotation.x = 0.3;
      break;
    case 'idle':
    default:
      armL.rotation.x = Math.sin(phase * 0.8) * 0.05;
      armR.rotation.x = -Math.sin(phase * 0.8) * 0.05;
      body.position.y = Math.sin(phase * 0.8) * 0.012;
      break;
  }
}

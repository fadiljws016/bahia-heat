// people.js — the articulated low-poly person factory every human in Puerto
// Alba is built from: the player, the crowds, the rival crews and the PAPD's
// foot officers alike. Round one walked stiff torso-and-two-legs figures;
// these have jointed shoulders, elbows, hips and knees, hair and hats,
// dresses and uniforms — and a pose system (walk, run, flee, aim, chat, sit,
// crouch, down) the systems drive per frame. Geometry and materials are
// shared across every person; only the group hierarchy is per character.

import { makeRng, clamp } from './util.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

/** A limb segment whose origin sits at its joint and reaches down -Y. */
function limbGeo(w, len, d) {
  const g = new THREE.BoxGeometry(w, len, d);
  g.translate(0, -len / 2, 0);
  return g;
}
const armUpGeo = limbGeo(0.13, 0.34, 0.13);
const armLoGeo = limbGeo(0.11, 0.32, 0.11);
const legUpGeo = limbGeo(0.17, 0.46, 0.17);
const legLoGeo = limbGeo(0.14, 0.44, 0.14);
const skirtGeo = new THREE.CylinderGeometry(0.21, 0.33, 0.46, 7);

const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}

export const SKIN_TONES = [0xc98a5e, 0x8a5a3b, 0xe8b48c, 0x6e4530, 0xa06a42, 0xdb9f6e];
export const SHIRT_COLORS = [0xd84f35, 0x2f7fd0, 0xf2b13c, 0x35b06f, 0xf5f0e6, 0xff7ab0, 0x57d7e8, 0x8a5fc0, 0xe8e3d5, 0x30363e, 0xff8c42, 0x2ea8a0, 0xc94f78];
export const PANTS_COLORS = [0x2c3a55, 0x4a3b2c, 0x6b6f75, 0x27313a, 0x8a7a5c, 0x3d5a80, 0xd8cfc0, 0x7a2e2e];
export const HAIR_COLORS = [0x1d1410, 0x3a2415, 0x6e4a26, 0xb08a4f, 0xd8d3c8, 0x8a2f1d];
const HAIR_STYLES = ['short', 'long', 'cap', 'hat', 'bun', 'bald'];

/** A random civilian outfit drawn from an rng. */
export function randomOutfit(rng) {
  return {
    skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)],
    shirt: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
    pants: PANTS_COLORS[Math.floor(rng() * PANTS_COLORS.length)],
    hair: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
    hairStyle: HAIR_STYLES[Math.floor(rng() * HAIR_STYLES.length)],
    skirt: rng() < 0.3,
    hatColor: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
  };
}

function part(geo, material, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * Build one articulated person. opts: skin, shirt, pants, hair, hairStyle,
 * hatColor, skirt, uniform (navy PAPD dress with cap and belt), shoes.
 * The returned group's userData.parts holds every joint posePerson drives.
 */
export function buildPersonMesh(opts = {}) {
  const skin = mat(opts.skin ?? 0xc98a5e);
  const shirt = mat(opts.shirt ?? 0x2f7fd0);
  const pants = mat(opts.pants ?? 0x2c3a55);
  const hairM = mat(opts.hair ?? 0x1d1410);
  const shoeM = mat(opts.shoes ?? 0xf2f2f2);

  const g = new THREE.Group();
  const rig = new THREE.Group(); // lowered for crouches and sits
  g.add(rig);

  const pelvis = part(boxGeo, pants, 0, 0.99, 0, rig);
  pelvis.scale.set(0.42, 0.24, 0.26);
  const torso = part(boxGeo, shirt, 0, 1.33, 0, rig);
  torso.scale.set(0.54, 0.5, 0.3);
  torso.castShadow = true;
  if (opts.uniform) {
    const belt = part(boxGeo, mat(0x14161c), 0, 1.13, 0, rig);
    belt.scale.set(0.44, 0.07, 0.28);
    const badge = part(boxGeo, mat(0xffcf5e), 0.14, 1.42, 0.16, rig);
    badge.scale.set(0.07, 0.09, 0.02);
  }

  // Head and hair, on a small neck joint so chats can tilt.
  const headG = new THREE.Group();
  headG.position.set(0, 1.6, 0);
  rig.add(headG);
  const head = part(boxGeo, skin, 0, 0.13, 0, headG);
  head.scale.set(0.31, 0.33, 0.3);
  const style = opts.hairStyle ?? 'short';
  if (style === 'short' || style === 'bun' || style === 'long') {
    const top = part(boxGeo, hairM, 0, 0.31, -0.01, headG);
    top.scale.set(0.34, 0.1, 0.33);
    if (style === 'long') { const back = part(boxGeo, hairM, 0, 0.12, -0.16, headG); back.scale.set(0.33, 0.34, 0.07); }
    if (style === 'bun') { const bun = part(boxGeo, hairM, 0, 0.36, -0.14, headG); bun.scale.set(0.14, 0.13, 0.14); }
  } else if (style === 'cap') {
    const top = part(boxGeo, mat(opts.hatColor ?? 0xd84f35), 0, 0.3, 0, headG);
    top.scale.set(0.35, 0.1, 0.34);
    const brim = part(boxGeo, mat(opts.hatColor ?? 0xd84f35), 0, 0.25, 0.22, headG);
    brim.scale.set(0.32, 0.04, 0.18);
  } else if (style === 'hat') {
    const brim = part(boxGeo, mat(opts.hatColor ?? 0xe8d9b0), 0, 0.29, 0, headG);
    brim.scale.set(0.5, 0.045, 0.5);
    const crown = part(boxGeo, mat(opts.hatColor ?? 0xe8d9b0), 0, 0.37, 0, headG);
    crown.scale.set(0.27, 0.15, 0.27);
  }
  if (opts.uniform) {
    // The PAPD cap sits over whatever hair the officer was drawn with.
    const capTop = part(boxGeo, mat(0x1d3a5f), 0, 0.31, 0, headG);
    capTop.scale.set(0.35, 0.1, 0.34);
    const capBrim = part(boxGeo, mat(0x10151c), 0, 0.26, 0.22, headG);
    capBrim.scale.set(0.32, 0.04, 0.18);
  }

  // Arms: shoulder groups at the torso top, elbow groups at their ends.
  const mkArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(0.34 * side, 1.52, 0);
    rig.add(sh);
    const up = part(armUpGeo, shirt, 0, 0, 0, sh);
    up.castShadow = true;
    const el = new THREE.Group();
    el.position.set(0, -0.34, 0);
    sh.add(el);
    part(armLoGeo, skin, 0, 0, 0, el);
    return { sh, el };
  };
  const armL = mkArm(-1), armR = mkArm(1);

  // The held gun rides the right forearm; callers toggle its visibility.
  const gun = part(boxGeo, mat(0x1b1d22), 0, -0.3, 0.12, armR.el);
  gun.scale.set(0.07, 0.11, 0.42);
  gun.visible = false;

  // Legs: hip groups at the pelvis, knee groups at their ends.
  const mkLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(0.12 * side, 0.98, 0);
    rig.add(hip);
    part(legUpGeo, pants, 0, 0, 0, hip);
    const knee = new THREE.Group();
    knee.position.set(0, -0.46, 0);
    hip.add(knee);
    part(legLoGeo, opts.skirt ? skin : pants, 0, 0, 0, knee);
    const shoe = part(boxGeo, shoeM, 0, -0.42, 0.04, knee);
    shoe.scale.set(0.15, 0.09, 0.3);
    return { hip, knee };
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  if (opts.skirt) {
    const skirt = part(skirtGeo, shirt, 0, 0.82, 0, rig);
    skirt.castShadow = true;
  }

  g.userData.parts = { rig, torso, headG, armL, armR, legL, legR, gun };
  return g;
}

/** Zero every joint, then let the pose writers start from a clean figure. */
function resetPose(P) {
  P.rig.position.y = 0; P.rig.rotation.x = 0;
  P.torso.rotation.x = 0;
  P.headG.rotation.set(0, 0, 0);
  for (const a of [P.armL, P.armR]) { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); }
  for (const l of [P.legL, P.legR]) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
}

/**
 * Pose a person. pose: idle | walk | run | flee | aim | chat | sit | down.
 * phase drives the cycles; opts: { amp, crouch 0..1, armsUp, gesture seed }.
 */
export function posePerson(mesh, pose, phase = 0, opts = {}) {
  const P = mesh.userData.parts;
  if (!P) return;
  resetPose(P);
  const amp = opts.amp ?? 1;

  if (pose === 'walk' || pose === 'run' || pose === 'flee') {
    const big = pose !== 'walk';
    const s = Math.sin(phase), c = Math.sin(phase + Math.PI);
    const legAmp = (big ? 0.85 : 0.55) * amp;
    P.legL.hip.rotation.x = -s * legAmp;
    P.legR.hip.rotation.x = -c * legAmp;
    P.legL.knee.rotation.x = Math.max(0, c) * (big ? 1.0 : 0.7) * amp;
    P.legR.knee.rotation.x = Math.max(0, s) * (big ? 1.0 : 0.7) * amp;
    if (pose === 'flee' && opts.armsUp) {
      P.armL.sh.rotation.x = -2.6; P.armR.sh.rotation.x = -2.9;
      P.armL.el.rotation.x = -0.4; P.armR.el.rotation.x = -0.3;
    } else {
      const armAmp = (big ? 0.95 : 0.5) * amp;
      P.armL.sh.rotation.x = -c * armAmp;
      P.armR.sh.rotation.x = -s * armAmp;
      P.armL.el.rotation.x = -0.25 - Math.max(0, s) * 0.5 * amp;
      P.armR.el.rotation.x = -0.25 - Math.max(0, c) * 0.5 * amp;
    }
    P.torso.rotation.x = big ? 0.1 : 0.04;
    return;
  }

  if (pose === 'aim') {
    // Both arms up and forward on the gun, legs braced, optional crouch.
    const cr = clamp(opts.crouch ?? 0, 0, 1);
    P.armR.sh.rotation.x = -1.52;
    P.armR.el.rotation.x = -0.12;
    P.armL.sh.rotation.x = -1.38;
    P.armL.sh.rotation.z = 0.38;
    P.armL.el.rotation.x = -0.5;
    P.legL.hip.rotation.x = -0.28 - cr * 0.9;
    P.legR.hip.rotation.x = 0.22 + cr * 0.5;
    P.legL.knee.rotation.x = 0.25 + cr * 1.15;
    P.legR.knee.rotation.x = 0.12 + cr * 0.8;
    P.rig.position.y = -cr * 0.34;
    P.torso.rotation.x = 0.08 + cr * 0.16;
    P.gun.visible = true;
    return;
  }

  if (pose === 'chat') {
    // Standing talk: weight shifts, one forearm gestures in slow arcs.
    const t = phase;
    P.rig.position.y = Math.sin(t * 1.7) * 0.012;
    P.armR.el.rotation.x = -0.55 - Math.max(0, Math.sin(t * 0.9)) * 0.55;
    P.armR.sh.rotation.x = -0.12 - Math.max(0, Math.sin(t * 0.9)) * 0.2;
    P.armL.el.rotation.x = -0.18;
    P.headG.rotation.y = Math.sin(t * 0.5) * 0.14;
    P.headG.rotation.z = Math.sin(t * 0.8) * 0.04;
    return;
  }

  if (pose === 'sit') {
    P.rig.position.y = -0.47;
    P.legL.hip.rotation.x = -1.52; P.legR.hip.rotation.x = -1.52;
    P.legL.knee.rotation.x = 1.48; P.legR.knee.rotation.x = 1.48;
    P.armL.sh.rotation.x = -0.35; P.armR.sh.rotation.x = -0.35;
    P.armL.el.rotation.x = -0.5; P.armR.el.rotation.x = -0.5;
    P.rig.position.y += Math.sin(phase * 1.4) * 0.006; // breathing, barely
    return;
  }

  if (pose === 'down') {
    P.armL.sh.rotation.z = 1.25; P.armR.sh.rotation.z = -0.7;
    P.armL.sh.rotation.x = -0.4; P.armR.sh.rotation.x = -1.1;
    P.legL.hip.rotation.x = -0.22; P.legR.hip.rotation.x = 0.3;
    P.legR.knee.rotation.x = 0.5;
    return;
  }

  if (pose === 'punch') {
    P.armR.sh.rotation.x = -1.7 - Math.sin(phase * Math.PI) * 0.5;
    P.armR.el.rotation.x = -0.15;
    P.armL.sh.rotation.x = 0.4;
    P.torso.rotation.x = 0.14;
    return;
  }

  // idle: a breath of sway, arms hanging loose.
  P.armL.sh.rotation.x = Math.sin(phase * 1.3) * 0.05;
  P.armR.sh.rotation.x = -Math.sin(phase * 1.3) * 0.05;
  P.armL.el.rotation.x = -0.08; P.armR.el.rotation.x = -0.08;
  P.rig.position.y = Math.sin(phase * 1.9) * 0.008;
}

/** A fresh rng for outfit rolls, shared so callers stay deterministic. */
export function outfitRng(seed) { return makeRng(seed); }

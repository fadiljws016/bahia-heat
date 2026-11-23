// people.js — the person factory: one articulated low-poly figure kit
// that builds every body in Puerto Alba — the runner, the crowds, the
// crews, the PAPD — and the modelled weapons they carry. A figure is a
// root group with jointed parts (hips, torso, head, two arms, two legs)
// that posePerson bends by name: walk, run, idle, chat, sit, flee, aim,
// punch, down. The poses never rotate the root — facing is the caller's
// heading, a contract the screenshot audits rely on. Weapons are real
// little models with readable silhouettes (the P-9's slide, the Kobra's
// long magazine, the Muelle's tan pump), carried on the hip between
// fights and raised into the hands to aim, exactly as the HUD's drawn
// slots promise. Outfits come from the colour tables below: skin, shirt
// (sometimes striped, checked or floral), trousers, hair in five cuts,
// and the options a uniform or a red dress need.
// THREE is the vendored global: index.html loads vendor/three.min.js
// as a classic script before the modules, like every system here.
import { makeRng, pick } from './util.js';

export const SKIN_TONES = [0xc98a5e, 0x8a5a3b, 0xe8b48c, 0x6e4530, 0xa06a42, 0xdb9f6e];
export const SHIRT_COLORS = [0xd84f35, 0x2f7fd0, 0xf2b13c, 0x35b06f, 0xf5f0e6, 0xff7ab0, 0x57d7e8, 0x8a5fc0, 0xe8e3d5, 0x30363e, 0xff8c42, 0x2ea8a0, 0xc94f78];
export const PANTS_COLORS = [0x2c3a55, 0x4a3b2c, 0x6b6f75, 0x27313a, 0x8a7a5c, 0x3d5a80, 0xd8cfc0, 0x7a2e2e];
export const HAIR_COLORS = [0x1d1410, 0x3a2415, 0x6e4a26, 0xb08a4f, 0xd8d3c8, 0x8a2f1d];

const HAIR_STYLES = ['short', 'long', 'bun', 'ponytail', 'flat'];
const PATTERNS = ['stripes', 'checks', 'floral'];

/** A private random stream for one seed (outfit rolls that repeat). */
export function outfitRng(seed) { return makeRng(seed); }

/** Roll a full outfit for one citizen. */
export function randomOutfit(rng) {
  return {
    skin: pick(rng, SKIN_TONES),
    shirt: pick(rng, SHIRT_COLORS),
    pants: pick(rng, PANTS_COLORS),
    hair: pick(rng, HAIR_COLORS),
    hairStyle: pick(rng, HAIR_STYLES),
    shirtPattern: rng() < 0.3 ? pick(rng, PATTERNS) : null,
    skirt: rng() < 0.2,
    hat: rng() < 0.16,
    sunglasses: rng() < 0.18,
    uniform: false,
  };
}

// ------------------------------------------------------------ materials
const matCache = new Map();
function lambert(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}

const patternTexCache = new Map();
/** A mostly-white cloth print (stripes / checks / floral) that the shirt colour tints. */
function patternTexture(kind) {
  if (patternTexCache.has(kind)) return patternTexCache.get(kind);
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(70,60,50,0.35)';
  if (kind === 'stripes') {
    for (let x = 4; x < 64; x += 12) g.fillRect(x, 0, 4, 64);
  } else if (kind === 'checks') {
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 7, 64);
    for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 7);
  } else {
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 37) % 60 + 2, y = (i * 23) % 60 + 2;
      g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  patternTexCache.set(kind, tex);
  return tex;
}

function shirtMaterial(outfit) {
  if (!outfit.shirtPattern) return lambert(outfit.shirt);
  const key = `${outfit.shirt}:${outfit.shirtPattern}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshLambertMaterial({ color: outfit.shirt, map: patternTexture(outfit.shirtPattern) }));
  }
  return matCache.get(key);
}

function box(mat, sx, sy, sz, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// -------------------------------------------------------------- weapons
/**
 * A modelled firearm, barrel toward +z, grip at the origin: the P-9's
 * short slide and wooden grip, the Kobra's long magazine, stock and
 * foregrip, the Muelle's thick barrel with its tan pump and stock.
 */
export function buildWeaponMesh(kind) {
  const grp = new THREE.Group();
  const dark = lambert(0x23252b);
  const steel = lambert(0x3a3f47);
  if (kind === 'pistol') {
    box(dark, 0.05, 0.075, 0.26, 0, 0.03, 0.03, grp); // slide
    box(steel, 0.04, 0.03, 0.05, 0, 0.055, 0.15, grp); // muzzle block
    const grip = box(lambert(0x7a4a2a), 0.05, 0.15, 0.07, 0, -0.06, -0.06, grp);
    grip.rotation.x = 0.35;
  } else if (kind === 'smg') {
    box(dark, 0.06, 0.1, 0.54, 0, 0.03, 0.02, grp); // receiver + barrel shroud
    box(steel, 0.045, 0.045, 0.14, 0, 0.045, 0.33, grp); // barrel tip
    box(steel, 0.05, 0.24, 0.08, 0, -0.13, 0.05, grp); // the long magazine
    box(dark, 0.05, 0.08, 0.2, 0, 0.02, -0.32, grp); // stock
    const grip = box(dark, 0.05, 0.13, 0.06, 0, -0.07, -0.1, grp);
    grip.rotation.x = 0.3;
    box(dark, 0.045, 0.11, 0.05, 0, -0.06, 0.2, grp); // foregrip
  } else if (kind === 'shotgun') {
    box(steel, 0.075, 0.075, 0.85, 0, 0.05, 0.14, grp); // the thick barrel
    box(lambert(0xc9a86a), 0.095, 0.095, 0.24, 0, -0.01, 0.3, grp); // tan pump
    box(dark, 0.07, 0.11, 0.2, 0, 0.02, -0.18, grp); // receiver
    const stock = box(lambert(0xc9a86a), 0.06, 0.13, 0.24, 0, -0.01, -0.42, grp);
    stock.rotation.x = -0.12;
  }
  grp.visible = true;
  return grp;
}

/**
 * Put a weapon on a figure: 'hand' raises it into the right hand
 * (barrel down the arm, so an aim pose points it at the world), 'hip'
 * holsters it at the right hip, and null/'none' takes it away. Called
 * every frame by the player loop, so an unchanged carry is a no-op.
 */
export function showWeapon(mesh, kind, where) {
  if (!mesh) return;
  const u = mesh.userData;
  if (u.weaponKind === kind && u.weaponWhere === where) return;
  if (u.weaponGroup) {
    u.weaponGroup.parent?.remove(u.weaponGroup);
    u.weaponGroup = null;
  }
  u.weaponKind = kind;
  u.weaponWhere = where;
  if (!kind || where === 'none') return;
  const grp = buildWeaponMesh(kind);
  const parts = u.parts;
  if (where === 'hand' && parts?.armR) {
    grp.position.set(0, -0.62, 0.04);
    grp.rotation.set(Math.PI / 2, 0, 0); // barrel along the arm's reach
    parts.armR.add(grp);
  } else if (parts?.torsoG) {
    grp.position.set(0.32, 0.2, 0.0);
    grp.rotation.set(1.25, 0, 0.12); // holstered, muzzle down
    parts.torsoG.add(grp);
  }
  u.weaponGroup = grp;
}

// --------------------------------------------------------------- figure
/**
 * Build one articulated figure from an outfit. The root group carries
 * userData.parts — the joint groups posePerson bends — and stands 1.8 m
 * tall with its feet at the origin.
 */
export function buildPersonMesh(opts = {}) {
  const o = {
    skin: 0xc98a5e, shirt: 0x2f7fd0, pants: 0x2c3a55, hair: 0x3a2415,
    hairStyle: 'short', shirtPattern: null, skirt: false, hat: false,
    sunglasses: false, uniform: false, ...opts,
  };
  const root = new THREE.Group();
  const skin = lambert(o.skin);
  const shirt = o.uniform ? lambert(o.shirt) : shirtMaterial(o);
  const pants = lambert(o.pants);
  const hairMat = lambert(o.hair);
  const parts = {};

  // Legs, pivoting at the hip (y 0.84). A skirt wears bare legs under it.
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0.11 * side, 0.84, 0);
    box(o.skirt ? skin : pants, 0.17, 0.8, 0.19, 0, -0.42, 0, leg);
    box(lambert(0x24262a), 0.18, 0.09, 0.3, 0, -0.8, 0.05, leg); // shoe
    root.add(leg);
    parts[side < 0 ? 'legL' : 'legR'] = leg;
  }

  // Torso (and the dress, when the outfit wears one).
  const torsoG = new THREE.Group();
  torsoG.position.set(0, 0.84, 0);
  box(shirt, 0.54, 0.64, 0.3, 0, 0.32, 0, torsoG);
  if (o.skirt) box(shirt, 0.62, 0.5, 0.38, 0, -0.02, 0, torsoG);
  if (o.uniform) {
    box(lambert(0x141c30), 0.56, 0.09, 0.32, 0, 0.05, 0, torsoG); // belt
    box(lambert(0xffd23e), 0.07, 0.09, 0.02, 0.15, 0.42, 0.16, torsoG); // chest badge
  }
  root.add(torsoG);
  parts.torsoG = torsoG;

  // Arms, pivoting at the shoulder (y 1.42): sleeve, then a skin hand.
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0.34 * side, 1.42, 0);
    box(shirt, 0.14, 0.58, 0.16, 0, -0.26, 0, arm);
    box(skin, 0.12, 0.15, 0.13, 0, -0.62, 0, arm);
    arm.rotation.z = side * -0.06;
    root.add(arm);
    parts[side < 0 ? 'armL' : 'armR'] = arm;
  }

  // Head, pivoting at the neck (y 1.48), with its hair or headgear.
  const headG = new THREE.Group();
  headG.position.set(0, 1.48, 0);
  box(skin, 0.32, 0.36, 0.32, 0, 0.18, 0, headG);
  if (o.uniform) {
    box(lambert(0x22345e), 0.37, 0.1, 0.37, 0, 0.4, 0, headG); // cap top
    box(lambert(0x22345e), 0.36, 0.04, 0.2, 0, 0.34, 0.24, headG); // brim
    box(lambert(0xffd23e), 0.06, 0.06, 0.02, 0, 0.38, 0.19, headG); // cap badge
  } else if (o.hat) {
    const straw = lambert(0xe8d9a8);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.04, 10), straw);
    brim.position.set(0, 0.37, 0); brim.castShadow = true; headG.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.15, 10), straw);
    top.position.set(0, 0.45, 0); top.castShadow = true; headG.add(top);
    box(hairMat, 0.34, 0.08, 0.34, 0, 0.33, 0, headG);
  } else if (o.hairStyle === 'long') {
    box(hairMat, 0.35, 0.1, 0.35, 0, 0.38, 0, headG);
    box(hairMat, 0.36, 0.54, 0.12, 0, 0.1, -0.21, headG); // down the back
  } else if (o.hairStyle === 'bun') {
    box(hairMat, 0.35, 0.09, 0.35, 0, 0.38, 0, headG);
    box(hairMat, 0.15, 0.15, 0.15, 0, 0.38, -0.2, headG); // the bun, on the back
  } else if (o.hairStyle === 'ponytail') {
    box(hairMat, 0.35, 0.09, 0.35, 0, 0.38, 0, headG);
    const tail = box(hairMat, 0.12, 0.42, 0.1, 0, 0.16, -0.23, headG);
    tail.rotation.x = 0.28;
  } else if (o.hairStyle === 'flat') {
    box(hairMat, 0.34, 0.05, 0.34, 0, 0.37, 0, headG);
  } else { // short
    box(hairMat, 0.35, 0.12, 0.35, 0, 0.37, 0, headG);
  }
  if (o.sunglasses) box(lambert(0x14161c), 0.3, 0.07, 0.03, 0, 0.2, 0.17, headG);
  root.add(headG);
  parts.headG = headG;

  root.userData.parts = parts;
  root.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return root;
}

// ---------------------------------------------------------------- poses
function resetPose(P) {
  P.legL.rotation.set(0, 0, 0); P.legR.rotation.set(0, 0, 0);
  P.legL.position.y = 0.84; P.legR.position.y = 0.84;
  P.armL.rotation.set(0, 0, 0.06); P.armR.rotation.set(0, 0, -0.06);
  P.armL.position.y = 1.42; P.armR.position.y = 1.42;
  P.torsoG.rotation.set(0, 0, 0); P.torsoG.position.y = 0.84;
  P.headG.rotation.set(0, 0, 0); P.headG.position.y = 1.48;
}

/** Lower the whole upper body for a crouch, knees bent in a planted stance. */
function applyCrouch(P, crouch) {
  if (crouch <= 0) return;
  const drop = crouch * 0.3;
  P.torsoG.position.y -= drop;
  P.headG.position.y -= drop;
  P.armL.position.y -= drop; P.armR.position.y -= drop;
  P.legL.rotation.x = -0.72 * crouch;
  P.legR.rotation.x = 0.5 * crouch;
  P.legL.rotation.z = 0.1; P.legR.rotation.z = -0.1;
  P.torsoG.rotation.x = 0.16 * crouch;
}

/**
 * Bend a figure into a named pose. `phase` is the caller's animation
 * clock; opts carries { crouch } for the aim stance and { armsUp } for
 * flight and surrender. The root itself is never rotated — the figure
 * faces wherever its owner turned it.
 */
export function posePerson(mesh, pose, phase = 0, opts = {}) {
  const P = mesh?.userData.parts;
  if (!P) return;
  resetPose(P);
  const s = Math.sin(phase);
  switch (pose) {
    case 'walk':
      P.legL.rotation.x = s * 0.55; P.legR.rotation.x = -s * 0.55;
      P.armL.rotation.x = -s * 0.42; P.armR.rotation.x = s * 0.42;
      P.torsoG.position.y += Math.abs(Math.cos(phase)) * 0.03;
      break;
    case 'run':
      P.legL.rotation.x = s * 0.95; P.legR.rotation.x = -s * 0.95;
      P.armL.rotation.x = -s * 0.72; P.armR.rotation.x = s * 0.72;
      P.torsoG.position.y += Math.abs(Math.cos(phase)) * 0.05;
      P.torsoG.rotation.x = 0.12;
      break;
    case 'flee':
      P.legL.rotation.x = s * 0.95; P.legR.rotation.x = -s * 0.95;
      P.torsoG.position.y += Math.abs(Math.cos(phase)) * 0.05;
      P.torsoG.rotation.x = 0.16;
      if (opts.armsUp) {
        P.armL.rotation.x = -2.7 + Math.sin(phase * 2) * 0.14;
        P.armR.rotation.x = -2.7 - Math.sin(phase * 2) * 0.14;
        P.armL.rotation.z = 0.3; P.armR.rotation.z = -0.3;
      } else {
        P.armL.rotation.x = -s * 0.8; P.armR.rotation.x = s * 0.8;
      }
      break;
    case 'chat':
      P.armR.rotation.x = -0.55 + Math.sin(phase * 1.7) * 0.22;
      P.armR.rotation.z = -0.18;
      P.armL.rotation.x = Math.sin(phase * 1.3) * 0.08;
      P.headG.rotation.y = Math.sin(phase * 0.4) * 0.2;
      P.torsoG.rotation.z = Math.sin(phase * 0.5) * 0.02;
      break;
    case 'sit':
      P.legL.rotation.x = -1.45; P.legR.rotation.x = -1.45;
      P.legL.position.y = 0.52; P.legR.position.y = 0.52;
      P.torsoG.position.y -= 0.32; P.headG.position.y -= 0.32;
      P.armL.position.y -= 0.32; P.armR.position.y -= 0.32;
      P.armL.rotation.x = -0.28; P.armR.rotation.x = -0.28;
      break;
    case 'aim': {
      const crouch = opts.crouch ?? 0;
      applyCrouch(P, crouch);
      P.legL.rotation.z = 0.13; P.legR.rotation.z = -0.13;
      P.armR.rotation.x = -1.38; P.armR.rotation.z = -0.05;
      P.armL.rotation.x = -1.24; P.armL.rotation.z = 0.52;
      P.headG.rotation.x = 0.05;
      break;
    }
    case 'punch': {
      const swing = Math.sin(Math.min(Math.max(phase, 0), Math.PI));
      P.armR.rotation.x = -1.85 * swing;
      P.armL.rotation.x = -0.3 * swing;
      P.torsoG.rotation.y = 0.32 * swing;
      break;
    }
    case 'down':
      break; // the caller lays the whole figure flat
    case 'idle':
    default:
      P.armL.rotation.x = Math.sin(phase * 0.9) * 0.06;
      P.armR.rotation.x = Math.sin(phase * 0.9 + 1) * 0.06;
      P.headG.rotation.y = Math.sin(phase * 0.23) * 0.14;
      break;
  }
}

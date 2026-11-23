// people.js — the articulated low-poly person factory every human in Puerto
// Alba is built from: the player, the crowds, the rival crews and the PAPD's
// foot officers alike. Jointed shoulders, elbows, hips and knees, hair and
// hats, dresses and uniforms — and a pose system (walk, run, flee, aim,
// chat, sit, crouch, down) the systems drive per frame. Round eight
// leans on a contract this factory has kept since round three: every
// person carries all three firearm models on the forearm mount, so
// the staging can swap a staged officer's P-9 for the longer Kobra
// with one showWeapon call — no new model, no factory change.
//
// Round three gives every firearm a real model: the P-9, the Kobra and the
// Muelle are built part by part (slide, barrel, magazine, pump, stock) so a
// weapon reads at screenshot distance, carried either in the hand or in the
// hip holster. Proportions grow a touch taller and narrower through the
// shoulders, idles shift their weight, and outfits gain sunglasses,
// ponytails and patterned shirts. Geometry and materials are shared across
// every person; only the group hierarchy is per character.
//
// Round four re-plants the aim pose: feet apart, knees bent, weight low —
// a shooter standing his ground, where round three's long front lunge
// read as a man running while he fired.
//
// Round five audits this rig rather than changing it: the weapon mount
// turns each barrel onto the forearm's axis, so a gun follows its owner's
// mesh exactly (barrel-versus-facing measured 0.0° across the staged
// fight). Every misalignment the audit found lived in the staging.
// Round six audits the rig once more — full arm chain this time:
// shoulder, elbow, hand, grip and muzzle tip all sit on the aim line,
// and the isolated figure reads as a clean aimed profile. The combat
// frame's misread lived in the camera's seat, not in this rig; the rig
// is unchanged.

// Round seven poses nobody new: the planted aim stance and the
// part-by-part Muelle the combat frame is judged on are this file's
// round-three/four work, re-photographed from the right in shots.js.
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
const legUpGeo = limbGeo(0.17, 0.50, 0.17);
const legLoGeo = limbGeo(0.14, 0.47, 0.14);
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
const HAIR_STYLES = ['short', 'long', 'cap', 'hat', 'bun', 'bald', 'ponytail', 'flat'];
const SHIRT_PATTERNS = ['stripes', 'floral', 'check'];

/** A random civilian outfit drawn from an rng. */
export function randomOutfit(rng) {
  const patterned = rng() < 0.2;
  return {
    skin: SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)],
    shirt: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
    pants: PANTS_COLORS[Math.floor(rng() * PANTS_COLORS.length)],
    hair: HAIR_COLORS[Math.floor(rng() * HAIR_COLORS.length)],
    hairStyle: HAIR_STYLES[Math.floor(rng() * HAIR_STYLES.length)],
    skirt: rng() < 0.3,
    hatColor: SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)],
    shades: rng() < 0.22,
    shirtPattern: patterned ? SHIRT_PATTERNS[Math.floor(rng() * SHIRT_PATTERNS.length)] : null,
  };
}

function part(geo, material, x, y, z, parent) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function box(parent, material, sx, sy, sz, x, y, z, rx = 0) {
  const m = part(boxGeo, material, x, y, z, parent);
  m.scale.set(sx, sy, sz);
  if (rx) m.rotation.x = rx;
  return m;
}

// ------------------------------------------------------------ shirt cloth
const patternCache = new Map();
/** A cloth material: flat colour, or a small canvas pattern over it. */
function shirtMat(opts) {
  if (!opts.shirtPattern) return mat(opts.shirt ?? 0x2f7fd0);
  const key = `${opts.shirtPattern}:${opts.shirt}`;
  if (patternCache.has(key)) return patternCache.get(key);
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const base = `#${(opts.shirt ?? 0x2f7fd0).toString(16).padStart(6, '0')}`;
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  if (opts.shirtPattern === 'stripes') {
    g.fillStyle = 'rgba(255,250,238,0.85)';
    for (let y = 6; y < 64; y += 16) g.fillRect(0, y, 64, 6);
  } else if (opts.shirtPattern === 'floral') {
    g.fillStyle = 'rgba(255,244,214,0.9)';
    for (const [x, y] of [[10, 12], [34, 8], [52, 20], [20, 34], [44, 40], [8, 52], [30, 56], [56, 54]]) {
      g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 4, y + 3, 2.2, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,150,170,0.8)';
    for (const [x, y] of [[22, 20], [48, 32], [14, 44]]) { g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill(); }
  } else { // check
    g.fillStyle = 'rgba(255,255,255,0.28)';
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 7, 64);
    for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 7);
    g.fillStyle = 'rgba(20,20,30,0.18)';
    for (let x = 8; x < 64; x += 16) g.fillRect(x, 0, 3, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshLambertMaterial({ map: tex });
  patternCache.set(key, m);
  return m;
}

// ------------------------------------------------------------- the weapons
const STEEL = 0x2e3542;   // blued slide steel
const GUNMETAL = 0x23262c; // frames and receivers
const DARK = 0x14161a;    // barrels' mouths, sights
const WOOD = 0x6e4a2c;    // pistol grip panels
const TAN = 0xb0864e;     // shotgun furniture
const TAN_DARK = 0x8f6c3a;

/**
 * One firearm, modelled part by part with its barrel along +Z and the
 * gripping hand at the origin — so it can ride a forearm or a holster and
 * point wherever the arm points. Silhouettes are the point: the pistol is
 * short and tall, the SMG long with its magazine hanging, the shotgun thick
 * with a pale pump and a wooden stock.
 */
export function buildWeaponMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'pistol') {
    box(g, mat(STEEL), 0.058, 0.07, 0.30, 0, 0.05, 0.10);          // slide
    box(g, mat(GUNMETAL), 0.05, 0.05, 0.27, 0, 0.005, 0.08);       // frame
    box(g, mat(DARK), 0.032, 0.032, 0.05, 0, 0.052, 0.265);        // muzzle
    box(g, mat(WOOD), 0.052, 0.17, 0.075, 0, -0.095, -0.055, 0.28); // grip
    box(g, mat(DARK), 0.014, 0.032, 0.02, 0, 0.10, 0.225);         // front sight
    box(g, mat(DARK), 0.045, 0.026, 0.02, 0, 0.095, -0.035);       // rear sight
  } else if (kind === 'smg') {
    box(g, mat(GUNMETAL), 0.062, 0.095, 0.44, 0, 0.025, 0.10);     // receiver
    box(g, mat(STEEL), 0.036, 0.036, 0.24, 0, 0.05, 0.42);         // barrel
    box(g, mat(DARK), 0.014, 0.05, 0.02, 0, 0.095, 0.50);          // front post
    box(g, mat(0x3a3f47), 0.046, 0.26, 0.075, 0, -0.155, 0.15, 0.1); // the long magazine
    box(g, mat(GUNMETAL), 0.05, 0.14, 0.06, 0, -0.085, -0.075, 0.25); // grip
    box(g, mat(DARK), 0.046, 0.105, 0.05, 0, -0.065, 0.315, 0.12); // foregrip
    box(g, mat(GUNMETAL), 0.052, 0.085, 0.20, 0, 0.035, -0.205);   // stock
  } else if (kind === 'shotgun') {
    box(g, mat(STEEL), 0.078, 0.078, 0.56, 0, 0.055, 0.22);        // the thick barrel
    box(g, mat(GUNMETAL), 0.05, 0.05, 0.42, 0, -0.008, 0.17);      // magazine tube
    box(g, mat(TAN), 0.095, 0.095, 0.17, 0, -0.008, 0.27);         // pump grip, pale wood
    box(g, mat(GUNMETAL), 0.066, 0.105, 0.21, 0, 0.025, -0.085);   // receiver
    box(g, mat(TAN_DARK), 0.062, 0.14, 0.26, 0, -0.005, -0.30, 0.1); // wooden stock
    box(g, mat(0xffcf5e), 0.016, 0.016, 0.016, 0, 0.105, 0.485);   // brass bead sight
  }
  return g;
}

/**
 * Show a person's weapon: in the hand ('hand'), as the holstered sidearm
 * ('hip'), or not at all ('none' / fists). The holster always carries the
 * pistol — it is the runner's sidearm whatever the long gun of the moment.
 */
export function showWeapon(mesh, kind, where) {
  const P = mesh?.userData?.parts;
  if (!P) return;
  for (const key of ['pistol', 'smg', 'shotgun']) {
    P.weapons[key].visible = where === 'hand' && key === kind;
  }
  P.holster.visible = where === 'hip' && !!kind && kind !== 'fists';
}

/**
 * Build one articulated person. opts: skin, shirt, pants, hair, hairStyle,
 * hatColor, skirt, uniform (navy PAPD dress with cap, belt and badge),
 * shoes, shades, shirtPattern. The returned group's userData.parts holds
 * every joint posePerson drives, plus the weapon mounts showWeapon drives.
 */
export function buildPersonMesh(opts = {}) {
  const skin = mat(opts.skin ?? 0xc98a5e);
  const shirt = shirtMat(opts);
  const pants = mat(opts.pants ?? 0x2c3a55);
  const hairM = mat(opts.hair ?? 0x1d1410);
  const shoeM = mat(opts.shoes ?? 0xf2f2f2);

  const g = new THREE.Group();
  const rig = new THREE.Group(); // lowered for crouches and sits
  g.add(rig);

  const pelvis = part(boxGeo, pants, 0, 1.04, 0, rig);
  pelvis.scale.set(0.42, 0.24, 0.26);
  const torso = part(boxGeo, shirt, 0, 1.39, 0, rig);
  torso.scale.set(0.50, 0.52, 0.29);
  torso.castShadow = true;
  if (opts.uniform) {
    const belt = part(boxGeo, mat(0x14161c), 0, 1.18, 0, rig);
    belt.scale.set(0.44, 0.07, 0.28);
    const badge = part(boxGeo, mat(0xffcf5e), 0.13, 1.48, 0.155, rig);
    badge.scale.set(0.07, 0.09, 0.02);
  }

  // Head and hair, on a small neck joint so chats can tilt.
  const headG = new THREE.Group();
  headG.position.set(0, 1.67, 0);
  rig.add(headG);
  const head = part(boxGeo, skin, 0, 0.13, 0, headG);
  head.scale.set(0.31, 0.33, 0.3);
  if (opts.shades) {
    const shades = part(boxGeo, mat(0x101318), 0, 0.17, 0.155, headG);
    shades.scale.set(0.30, 0.075, 0.03);
  }
  // A uniformed officer's own cap replaces any civilian hair style.
  const style = opts.uniform ? 'short' : (opts.hairStyle ?? 'short');
  if (style === 'short' || style === 'bun' || style === 'long' || style === 'ponytail') {
    const top = part(boxGeo, hairM, 0, 0.31, -0.01, headG);
    top.scale.set(0.34, 0.1, 0.33);
    if (style === 'long') { const back = part(boxGeo, hairM, 0, 0.12, -0.16, headG); back.scale.set(0.33, 0.34, 0.07); }
    if (style === 'bun') { const bun = part(boxGeo, hairM, 0, 0.36, -0.14, headG); bun.scale.set(0.14, 0.13, 0.14); }
    if (style === 'ponytail') { const tail = part(boxGeo, hairM, 0, 0.1, -0.19, headG); tail.scale.set(0.11, 0.3, 0.08); tail.rotation.x = 0.18; }
  } else if (style === 'flat') {
    const top = part(boxGeo, hairM, 0, 0.315, 0, headG);
    top.scale.set(0.33, 0.07, 0.32);
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
    // The PAPD cap: navy crown, black peak, a glint of badge on the front.
    const capTop = part(boxGeo, mat(0x1d3a5f), 0, 0.31, 0, headG);
    capTop.scale.set(0.35, 0.1, 0.34);
    const capBrim = part(boxGeo, mat(0x10151c), 0, 0.26, 0.22, headG);
    capBrim.scale.set(0.32, 0.04, 0.18);
    const capBadge = part(boxGeo, mat(0xffcf5e), 0, 0.315, 0.175, headG);
    capBadge.scale.set(0.06, 0.06, 0.015);
  }

  // Arms: shoulder groups at the torso top, elbow groups at their ends.
  const mkArm = (side) => {
    const sh = new THREE.Group();
    sh.position.set(0.315 * side, 1.58, 0);
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

  // The firearms ride the right forearm, one model per slot, all hidden
  // until showWeapon picks the carry. The mount sits at the hand and turns
  // each model — built barrel-along-+Z — onto the forearm's own axis, so
  // the barrel points where the forearm points: down at rest, dead ahead
  // in the aim pose, sights up. (An unrotated mount aims at the sky.)
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.31, 0.02);
  weaponMount.rotation.x = Math.PI / 2;
  armR.el.add(weaponMount);
  const weapons = {};
  for (const kind of ['pistol', 'smg', 'shotgun']) {
    const w = buildWeaponMesh(kind);
    w.visible = false;
    weaponMount.add(w);
    weapons[kind] = w;
  }
  // The hip holster: a leather bucket on the right hip with the sidearm in
  // it, grip up — how a runner carries between fights.
  const holster = new THREE.Group();
  holster.position.set(0.26, 1.08, 0.03);
  holster.rotation.x = 0.35;
  rig.add(holster);
  const bucket = part(boxGeo, mat(0x3a2a1c), 0, -0.05, 0, holster);
  bucket.scale.set(0.1, 0.2, 0.13);
  const sidearm = buildWeaponMesh('pistol');
  sidearm.rotation.x = Math.PI / 2 + 0.35; // barrel down into the bucket
  sidearm.position.set(0, 0.06, -0.01);
  holster.add(sidearm);
  holster.visible = false;

  // Legs: hip groups at the pelvis, knee groups at their ends.
  const mkLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(0.12 * side, 1.03, 0);
    rig.add(hip);
    part(legUpGeo, pants, 0, 0, 0, hip);
    const knee = new THREE.Group();
    knee.position.set(0, -0.50, 0);
    hip.add(knee);
    part(legLoGeo, opts.skirt ? skin : pants, 0, 0, 0, knee);
    const shoe = part(boxGeo, shoeM, 0, -0.45, 0.04, knee);
    shoe.scale.set(0.15, 0.09, 0.3);
    return { hip, knee };
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  if (opts.skirt) {
    const skirt = part(skirtGeo, shirt, 0, 0.87, 0, rig);
    skirt.castShadow = true;
  }

  g.userData.parts = { rig, torso, headG, armL, armR, legL, legR, weapons, holster };
  return g;
}

/** Zero every joint, then let the pose writers start from a clean figure. */
function resetPose(P) {
  P.rig.position.y = 0; P.rig.rotation.x = 0; P.rig.rotation.z = 0;
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
    // Both arms up and forward on the gun, optional crouch. The right arm
    // runs straight down the barrel line; the left comes under to support —
    // the two-handed grip long guns are aimed with.
    // The legs are a planted shooting stance, never a stride: feet set
    // apart sideways, one a half-step forward, both knees bent and the
    // weight low. (Round three's deep front lunge read as a runner caught
    // mid-stride in the combat screenshot; the owner called it, and this
    // narrower, wider base is the fix — live aim inherits it too, since
    // player.js poses 'aim' the whole time a weapon is raised.)
    const cr = clamp(opts.crouch ?? 0, 0, 1);
    P.armR.sh.rotation.x = -1.52;
    P.armR.el.rotation.x = -0.1;
    P.armL.sh.rotation.x = -1.34;
    P.armL.sh.rotation.z = 0.34;
    P.armL.el.rotation.x = -0.55;
    P.legL.hip.rotation.x = -0.14 - cr * 0.42;
    P.legR.hip.rotation.x = 0.1 + cr * 0.22;
    P.legL.hip.rotation.z = 0.1 + cr * 0.06;
    P.legR.hip.rotation.z = -0.1 - cr * 0.06;
    P.legL.knee.rotation.x = 0.24 + cr * 1.05;
    P.legR.knee.rotation.x = 0.18 + cr * 0.85;
    P.rig.position.y = -0.05 - cr * 0.3;
    P.torso.rotation.x = 0.08 + cr * 0.16;
    P.headG.rotation.x = 0.06; // cheek down toward the sights
    return;
  }

  if (pose === 'chat') {
    // Standing talk: weight shifts, one forearm gestures in slow arcs.
    const t = phase;
    P.rig.position.y = Math.sin(t * 1.7) * 0.012;
    P.rig.rotation.z = Math.sin(t * 0.6) * 0.02;
    P.armR.el.rotation.x = -0.55 - Math.max(0, Math.sin(t * 0.9)) * 0.55;
    P.armR.sh.rotation.x = -0.12 - Math.max(0, Math.sin(t * 0.9)) * 0.2;
    P.armL.el.rotation.x = -0.18;
    P.headG.rotation.y = Math.sin(t * 0.5) * 0.14;
    P.headG.rotation.z = Math.sin(t * 0.8) * 0.04;
    return;
  }

  if (pose === 'sit') {
    P.rig.position.y = -0.52;
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

  // idle: weight settled on one leg, one elbow bent, the head alive —
  // a person standing around, not a mannequin at attention.
  const sway = Math.sin(phase * 0.55);
  P.rig.rotation.z = sway * 0.028;
  P.rig.position.y = Math.sin(phase * 1.9) * 0.008;
  P.armL.sh.rotation.x = Math.sin(phase * 1.3) * 0.05;
  P.armR.sh.rotation.x = -Math.sin(phase * 1.3) * 0.05;
  P.armL.sh.rotation.z = 0.05;
  P.armR.sh.rotation.z = -0.07;
  P.armL.el.rotation.x = -0.12;
  P.armR.el.rotation.x = -0.38 - Math.sin(phase * 0.9) * 0.06;
  P.headG.rotation.y = Math.sin(phase * 0.4) * 0.12;
  P.headG.rotation.z = Math.sin(phase * 0.7) * 0.045;
  P.legL.hip.rotation.x = 0.03;
  P.legR.hip.rotation.x = -0.02;
  P.legR.knee.rotation.x = 0.05;
}

/** A fresh rng for outfit rolls, shared so callers stay deterministic. */
export function outfitRng(seed) { return makeRng(seed); }

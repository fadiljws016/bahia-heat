// world.js — the sky, the sun, the sea and the palms: Puerto Alba's light.
// The grade is ACES filmic at 1.12 and the sky is a painted gradient dome
// whose stops are locked to the DAY STOPS table — the wide warm horizon
// (the sky colour holds from 0.55 to the bottom of the canvas) is what
// keeps golden hour dusty instead of saturated.

import { G } from './state.js';
import { makeRng, clamp, lerp } from './util.js';
import { ROADS_Z, BOULEVARD_X } from './city.js';

// h, sky, skyTop, band, fog, sun colour, sun intensity, hemi intensity,
// ambient colour, ground colour — interpolated smoothly between stops.
const DAY_STOPS = [
  { h: 0.0, sky: 0x131c31, top: 0x0a1224, band: 0x1a2440, fog: 0x1b2740, sun: 0x223355, sunI: 0.12, hemiI: 0.25, amb: 0x2a3550, gnd: 0x1e2638 },
  { h: 5.5, sky: 0x27304f, top: 0x131c38, band: 0x4a4468, fog: 0x353c5c, sun: 0x445588, sunI: 0.2, hemiI: 0.3, amb: 0x35405c, gnd: 0x2c3048 },
  { h: 7.0, sky: 0xf59a58, top: 0x6a7cc4, band: 0xe88a7a, fog: 0xf5b878, sun: 0xffab5e, sunI: 0.9, hemiI: 0.48, amb: 0xffdcb0, gnd: 0x5c4a3c },
  { h: 12.0, sky: 0x54b6ec, top: 0x2b6cd4, band: 0x6fc3ee, fog: 0xbfe0ea, sun: 0xfff2d8, sunI: 1.32, hemiI: 0.66, amb: 0xf4f9ff, gnd: 0x51624e },
  { h: 16.5, sky: 0x58aee6, top: 0x3a78c8, band: 0x74c2e6, fog: 0xcfe4da, sun: 0xffe9bb, sunI: 1.22, hemiI: 0.6, amb: 0xfff0d8, gnd: 0x55624a },
  { h: 18.0, sky: 0xffab52, top: 0x4c63b4, band: 0xf28a5e, fog: 0xf7ab66, sun: 0xff8438, sunI: 1.05, hemiI: 0.5, amb: 0xffd9a8, gnd: 0x6e4c34 },
  { h: 19.3, sky: 0x5f5296, top: 0x2c2a55, band: 0xb05a7a, fog: 0x9c6a84, sun: 0xff7040, sunI: 0.42, hemiI: 0.34, amb: 0xc9a0c0, gnd: 0x4c3644 },
  { h: 20.3, sky: 0x1d2745, top: 0x0d1428, band: 0x232c4c, fog: 0x27324e, sun: 0x334466, sunI: 0.14, hemiI: 0.27, amb: 0x303c5c, gnd: 0x1e2638 },
  { h: 24.0, sky: 0x131c31, top: 0x0a1224, band: 0x1a2440, fog: 0x1b2740, sun: 0x223355, sunI: 0.12, hemiI: 0.25, amb: 0x2a3550, gnd: 0x1e2638 },
];

let renderer = null;
let skyMesh = null;
let skyTex = null;
let sunLight = null;
let hemiLight = null;
let ambLight = null;
let lastSkyHour = -1;
let boatsRef = [];
let ferrisRef = null;
let ferrisWheel = null;

const cA = new THREE.Color();
const cB = new THREE.Color();

function mixHex(a, b, t) {
  cA.setHex(a);
  cB.setHex(b);
  cA.lerp(cB, t);
  return cA;
}

function daySample(hours) {
  let i = 0;
  while (i < DAY_STOPS.length - 2 && hours >= DAY_STOPS[i + 1].h) i += 1;
  const a = DAY_STOPS[i];
  const b = DAY_STOPS[i + 1];
  const t = clamp((hours - a.h) / Math.max(0.001, b.h - a.h), 0, 1);
  return { a, b, t };
}

function css(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function paintSky(hours) {
  const { a, b, t } = daySample(hours);
  const sky = mixHex(a.sky, b.sky, t).getHex();
  const top = mixHex(a.top, b.top, t).getHex();
  const band = mixHex(a.band, b.band, t).getHex();
  const warm = clamp(1 - Math.abs(hours - 18) / 3.2, 0, 1);
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, css(top));
  grad.addColorStop(0.34, css(band));
  grad.addColorStop(0.55, css(sky));
  grad.addColorStop(0.62, css(sky));
  grad.addColorStop(1, css(sky));
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);
  // Sun glow, low over the bay in the west.
  const sunX = 180;
  const sunY = 300 - warm * 60;
  const glow = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  glow.addColorStop(0, `rgba(255,238,196,${0.9 * warm})`);
  glow.addColorStop(0.25, `rgba(255,192,112,${0.5 * warm})`);
  glow.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 1024, 512);
  // Flat cloud smudges tinted by the hour.
  const rng = makeRng(4242);
  g.fillStyle = `rgba(255,${200 + Math.floor(warm * 30)},190,0.16)`;
  for (let i = 0; i < 12; i += 1) {
    const x = rng() * 1024;
    const y = 40 + rng() * 150;
    const w = 90 + rng() * 190;
    g.beginPath();
    g.ellipse(x, y, w, 9 + rng() * 10, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (skyTex) skyTex.dispose();
  skyTex = new THREE.CanvasTexture(c);
  skyMesh.material.map = skyTex;
  skyMesh.material.needsUpdate = true;
  return { sky, fog: mixHex(a.fog, b.fog, t).getHex() };
}

export function setBoats(boats) { boatsRef = boats; }
export function setFerris(ferris) { ferrisRef = ferris; }

function frondTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#2f8f3e';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64, 64);
    g.quadraticCurveTo(
      64 + Math.cos(a) * 34, 64 + Math.sin(a) * 30 - 12,
      64 + Math.cos(a) * 60, 64 + Math.sin(a) * 56 + 14,
    );
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function plantPalms(scene) {
  const rng = makeRng(20240);
  const spots = [];
  for (let z = -120; z <= 130; z += 15) {
    if (rng() < 0.7) spots.push({ x: -202 + rng() * 3, z, lean: (rng() - 0.5) * 0.2, s: 0.8 + rng() * 0.4 });
  }
  for (const rz of ROADS_Z) {
    for (let k = 0; k < 3; k += 1) {
      spots.push({ x: -140 + rng() * 380, z: rz + (rng() < 0.5 ? -10.8 : 10.8), lean: (rng() - 0.5) * 0.1, s: 0.8 + rng() * 0.35 });
    }
  }
  for (let z = -280; z <= 280; z += 35) {
    spots.push({ x: BOULEVARD_X, z, lean: (rng() - 0.5) * 0.08, s: 0.85 + rng() * 0.3 });
  }
  // Keep the four film-set camera seats clear: a crown plane six metres
  // wide reads as a green wall when it grows inside the lens.
  const SEATS = [[-195.9, -3.1], [128, -36.5], [BOULEVARD_X + 6.5, 36.5], [100.5, -78.5]];
  for (let i = spots.length - 1; i >= 0; i -= 1) {
    if (SEATS.some(([sx, sz]) => Math.hypot(spots[i].x - sx, spots[i].z - sz) < 9.5)) spots.splice(i, 1);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.34, 7.5, 6);
  trunkGeo.translate(0, 3.75, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x9a7648 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const crownGeo = new THREE.PlaneGeometry(6.4, 6.4);
  crownGeo.translate(0, 7.7, 0);
  const crownMat = new THREE.MeshLambertMaterial({ map: frondTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const crownsA = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const crownsB = new THREE.InstancedMesh(crownGeo, crownMat, spots.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach((p, i) => {
    e.set(p.lean, rng() * Math.PI, 0);
    q.setFromEuler(e);
    const sc = new THREE.Vector3(p.s, p.s, p.s);
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, sc);
    trunks.setMatrixAt(i, m4);
    crownsA.setMatrixAt(i, m4);
    e.set(p.lean, rng() * Math.PI + Math.PI / 2, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q, sc);
    crownsB.setMatrixAt(i, m4);
  });
  trunks.castShadow = true;
  scene.add(trunks);
  scene.add(crownsA);
  scene.add(crownsB);
}

function buildBoat(b) {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color: [0xf2f2f2, 0xd84a30, 0x2f8fae, 0xf2b13c][Math.floor(Math.abs(b.z) / 12.5) % 4] });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 6.4), hullMat);
  hull.position.y = 0.4;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.1, 1.6, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.4, 3.9);
  g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 2.0), new THREE.MeshLambertMaterial({ color: 0xe8e3d5 }));
  cabin.position.set(0, 1.25, -0.4);
  g.add(cabin);
  g.position.set(b.x, 0.1, b.z);
  g.rotation.y = b.heading;
  return g;
}

function buildFerris(at) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: 0xd8d5cc });
  for (const off of [-2.4, 2.4]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 17, 6), frameMat);
    leg.position.set(off, 8.5, 0);
    leg.rotation.z = off > 0 ? 0.16 : -0.16;
    g.add(leg);
  }
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(13, 0.28, 6, 28), new THREE.MeshLambertMaterial({ color: 0xf2b13c }));
  wheel.add(rim);
  const spokeMat = new THREE.MeshLambertMaterial({ color: 0xd8d5cc });
  for (let i = 0; i < 6; i += 1) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 25.6, 5), spokeMat);
    spoke.rotation.z = (i / 6) * Math.PI;
    wheel.add(spoke);
  }
  const cabMat = new THREE.MeshLambertMaterial({ color: 0xd84f35 });
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, 1.7), cabMat);
    cab.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0);
    wheel.add(cab);
  }
  wheel.position.set(0, 15, 0);
  g.add(wheel);
  g.position.set(at.x, 0, at.z);
  g.rotation.y = Math.PI / 2;
  ferrisWheel = wheel;
  return g;
}

export function initWorld(container) {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7ab66, 170, 820);
  G.scene = scene;
  G.renderer = renderer;
  G.camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 1500);

  skyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 24, 14),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false }),
  );
  scene.add(skyMesh);

  sunLight = new THREE.DirectionalLight(0xff9440, 1.0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -70;
  sunLight.shadow.camera.right = 70;
  sunLight.shadow.camera.top = 70;
  sunLight.shadow.camera.bottom = -70;
  sunLight.shadow.camera.far = 400;
  scene.add(sunLight);
  scene.add(sunLight.target);
  hemiLight = new THREE.HemisphereLight(0xffe4bb, 0x4a5a48, 0.55);
  scene.add(hemiLight);
  ambLight = new THREE.AmbientLight(0xffd9a8, 0.5);
  scene.add(ambLight);

  // The bay: one big Phong sheet west of the sand.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 1400),
    new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 90, specular: 0x99ccee }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-560, -0.4, 0);
  scene.add(sea);

  plantPalms(scene);
  for (const b of boatsRef) scene.add(buildBoat(b));
  if (ferrisRef) scene.add(buildFerris(ferrisRef));
  lastSkyHour = -1;
  updateWorld(0);
  return renderer;
}

export function updateWorld(dt) {
  const hours = G.timeHours;
  const { a, b, t } = daySample(hours);
  if (Math.abs(hours - lastSkyHour) > 0.02 || lastSkyHour < 0) {
    const cols = paintSky(hours);
    G.scene.fog.color.setHex(cols.fog);
    lastSkyHour = hours;
  }
  const sunI = lerp(a.sunI, b.sunI, t);
  sunLight.intensity = sunI;
  sunLight.color.copy(mixHex(a.sun, b.sun, t));
  hemiLight.intensity = lerp(a.hemiI, b.hemiI, t);
  hemiLight.color.copy(mixHex(a.amb, b.amb, t));
  hemiLight.groundColor.copy(mixHex(a.gnd, b.gnd, t));
  ambLight.intensity = 0.32;
  ambLight.color.copy(mixHex(a.amb, b.amb, t));
  // Sun path: rises east, sets into the bay in the west.
  const ang = ((hours - 6) / 12) * Math.PI;
  const focus = G.player || { x: 0, z: 0 };
  sunLight.position.set(focus.x + Math.cos(ang) * 120, 40 + Math.sin(ang) * 130, focus.z + 55);
  sunLight.target.position.set(focus.x, 0, focus.z);
  G.isDusk = hours > 16.8 && hours < 20.6;
  if (skyMesh && G.camera) skyMesh.position.copy(G.camera.position);
  if (ferrisWheel) ferrisWheel.rotation.z += dt * 0.05;
}

export function clampToCity(p) {
  p.x = clamp(p.x, -250, 290);
  p.z = clamp(p.z, -306, 306);
  return p;
}

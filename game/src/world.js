
// world.js — Puerto Alba's sky, sea, light and weather, and the
// renderer itself. initWorld builds the WebGL renderer, the scene,
// the camera and every light, and registers them on G where the rest
// of the game expects its handles. The sky is a painted thing: a big
// inverted sphere wearing a canvas gradient — zenith colour at the
// crown, a saturated band of the hour's colour beneath it, the
// horizon colour at the rim, and soft cloud smudges tinted by the
// hour. The canvas repaints only when the hour actually changes, so
// the per-frame cost of a living sky is zero. The day is a table of
// stops; fog, sun and hemisphere fill interpolate between them, and
// the clock itself lives on G (timeHours, dayLengthSec) so the staged
// scenes can pin an hour and watch it hold.

// THREE is the vendored global: index.html loads vendor/three.min.js
// as a classic script before the modules, like every system here.
import { G } from './state.js';
import { makeRng } from './util.js';

// (h, sky, skyTop, band, fog, sun, sunI, hemiI, amb, gnd) — locked.
const DAY_STOPS = [
  [0.0, 0x131c31, 0x0a1224, 0x1a2440, 0x1b2740, 0x223355, 0.12, 0.25, 0x2a3550, 0x1e2638],
  [5.5, 0x27304f, 0x131c38, 0x4a4468, 0x353c5c, 0x445588, 0.2, 0.3, 0x35405c, 0x2c3048],
  [7.0, 0xf59a58, 0x6a7cc4, 0xe88a7a, 0xf5b878, 0xffab5e, 0.9, 0.48, 0xffdcb0, 0x5c4a3c],
  [12.0, 0x54b6ec, 0x2b6cd4, 0x6fc3ee, 0xbfe0ea, 0xfff2d8, 1.32, 0.66, 0xf4f9ff, 0x51624e],
  [16.5, 0x58aee6, 0x3a78c8, 0x74c2e6, 0xcfe4da, 0xffe9bb, 1.22, 0.6, 0xfff0d8, 0x55624a],
  [18.0, 0xffab52, 0x4c63b4, 0xf28a5e, 0xf7ab66, 0xff8438, 1.05, 0.5, 0xffd9a8, 0x6e4c34],
  [19.3, 0x5f5296, 0x2c2a55, 0xb05a7a, 0x9c6a84, 0xff7040, 0.42, 0.34, 0xc9a0c0, 0x4c3644],
  [20.3, 0x1d2745, 0x0d1428, 0x232c4c, 0x27324e, 0x334466, 0.14, 0.27, 0x303c5c, 0x1e2638],
  [24.0, 0x131c31, 0x0a1224, 0x1a2440, 0x1b2740, 0x223355, 0.12, 0.25, 0x2a3550, 0x1e2638],
];

const _ca = new THREE.Color();
const _cb = new THREE.Color();

function lerpHex(a, b, t, out) {
  _ca.setHex(a);
  _cb.setHex(b);
  return out.copy(_ca).lerp(_cb, t);
}

/** Sample the day table at hour h into a record of lerped values. */
function sampleDay(h) {
  let i = 0;
  while (i < DAY_STOPS.length - 2 && DAY_STOPS[i + 1][0] <= h) i += 1;
  const A = DAY_STOPS[i], B = DAY_STOPS[i + 1];
  const t = Math.min(1, Math.max(0, (h - A[0]) / (B[0] - A[0])));
  const out = {
    sky: new THREE.Color(), skyTop: new THREE.Color(), band: new THREE.Color(),
    fog: new THREE.Color(), sun: new THREE.Color(), amb: new THREE.Color(), gnd: new THREE.Color(),
    sunI: A[6] + (B[6] - A[6]) * t,
    hemiI: A[7] + (B[7] - A[7]) * t,
  };
  lerpHex(A[1], B[1], t, out.sky);
  lerpHex(A[2], B[2], t, out.skyTop);
  lerpHex(A[3], B[3], t, out.band);
  lerpHex(A[4], B[4], t, out.fog);
  lerpHex(A[5], B[5], t, out.sun);
  lerpHex(A[8], B[8], t, out.amb);
  lerpHex(A[9], B[9], t, out.gnd);
  return out;
}

function hexCss(col) { return `#${col.getHexString()}`; }

// ------------------------------------------------------------- painting
let skyCtx = null;
let skyTex = null;
let lastSkyHour = -99;

function paintSky(day) {
  const W = 1024, H = 512;
  const grad = skyCtx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, hexCss(day.skyTop));
  grad.addColorStop(0.45, hexCss(day.band));
  grad.addColorStop(0.60, hexCss(day.sky));
  grad.addColorStop(1.0, hexCss(day.sky));
  skyCtx.fillStyle = grad;
  skyCtx.fillRect(0, 0, W, H);
  const rng = makeRng(9182);
  const tint = day.band.clone().lerp(new THREE.Color(0xffffff), 0.45);
  skyCtx.fillStyle = hexCss(tint);
  for (let i = 0; i < 30; i += 1) {
    const cx = rng() * W, cy = rng() * H * 0.42 + 12;
    const rx = 40 + rng() * 130, ry = 6 + rng() * 13;
    skyCtx.globalAlpha = 0.05 + rng() * 0.1;
    skyCtx.beginPath();
    skyCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    skyCtx.fill();
    skyCtx.beginPath();
    skyCtx.ellipse(cx + rx * 0.3, cy + ry * 0.7, rx * 0.6, ry * 0.7, 0, 0, Math.PI * 2);
    skyCtx.fill();
  }
  skyCtx.globalAlpha = 1;
  skyTex.needsUpdate = true;
}

function oceanTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#9fd4e8';
  g.fillRect(0, 0, 128, 128);
  const rng = makeRng(5150);
  for (let i = 0; i < 46; i += 1) {
    g.strokeStyle = rng() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(70,130,170,0.3)';
    g.lineWidth = 1.4;
    const y = rng() * 128, x = rng() * 100, len = 12 + rng() * 22;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + len / 2, y - 2.5, x + len, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(11, 14);
  return tex;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const rng = makeRng(777);
  for (let i = 0; i < 22; i += 1) {
    const x = 30 + rng() * 196, y = 44 + rng() * 40, r = 16 + rng() * 30;
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

// ---------------------------------------------------------------- state
const weather = { name: 'Clear', wet: 0, cloud: 0.3, wind: 0.4 };
let boats = [];
let ferrisWheel = null;
let clouds = [];
let ocean = null;
let elapsed = 0;

/** The marina's boats, handed over by main.js once the city is built. */
export function setBoats(list) { boats = list || []; }

/** The Playa Brava wheel, same handover. */
export function setFerris(wheel) { ferrisWheel = wheel; }

/** Point every light and the painted sky at hour h (repaint cached). */
function applyHour(h) {
  const day = sampleDay(h);
  if (G.scene && G.scene.fog) G.scene.fog.color.copy(day.fog);
  G.hemi.color.copy(day.amb);
  G.hemi.groundColor.copy(day.gnd);
  G.hemi.intensity = day.hemiI;
  G.sun.color.copy(day.sun);
  G.sun.intensity = day.sunI;
  const theta = ((h - 6) / 12) * Math.PI;
  const elev = Math.max(Math.sin(theta), 0.05);
  G.sun.position.set(Math.cos(theta) * 340, elev * 300 + 12, 150);
  G.sunTarget.position.set(0, 0, 0);
  G.sunTarget.updateMatrixWorld();
  G.isDusk = h >= 16.8 || h < 6.8;
  if (Math.abs(h - lastSkyHour) >= 0.03 || lastSkyHour < -90) {
    paintSky(day);
    lastSkyHour = h;
    const tint = day.band.clone().lerp(new THREE.Color(0xffffff), 0.3);
    for (const spr of clouds) spr.material.color.copy(tint);
  }
}

// ----------------------------------------------------------------- boot
/**
 * Build the renderer, scene, camera, lights, sky and sea inside the
 * given container; register the handles on G; return the renderer.
 */
export function initWorld(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7ab66, 170, 820);

  const camera = new THREE.PerspectiveCamera(64, width / height, 0.1, 2400);
  camera.position.set(-205, 14, 45);
  camera.lookAt(-196, 1, -10);

  const hemi = new THREE.HemisphereLight(0xffe4bb, 0x4a5a48, 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xff9440, 1.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -280;
  sun.shadow.camera.right = 280;
  sun.shadow.camera.top = 280;
  sun.shadow.camera.bottom = -280;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  G.renderer = renderer;
  G.scene = scene;
  G.camera = camera;
  G.sun = sun;
  G.sunTarget = sun.target;
  G.hemi = hemi;
  G.fog = scene.fog;

  // The painted sky dome.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1024;
  skyCanvas.height = 512;
  skyCtx = skyCanvas.getContext('2d');
  skyTex = new THREE.CanvasTexture(skyCanvas);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(880, 28, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);

  // Drifting cloud sprites, tinted by the hour like everything else.
  const cloudTex = cloudTexture();
  const crng = makeRng(G.seed + 31);
  clouds = [];
  for (let i = 0; i < 10; i += 1) {
    const mat = new THREE.SpriteMaterial({
      map: cloudTex, transparent: true, opacity: 0.14 + crng() * 0.16, depthWrite: false, fog: false,
    });
    const spr = new THREE.Sprite(mat);
    const scale = 150 + crng() * 160;
    spr.scale.set(scale, scale * 0.42, 1);
    spr.position.set(-520 + crng() * 1040, 120 + crng() * 130, -520 + crng() * 1040);
    scene.add(spr);
    clouds.push(spr);
  }

  // The bay: a Phong sheet with a painted wave texture, catching the sun.
  ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(780, 1040),
    new THREE.MeshPhongMaterial({ color: 0x9fd4e8, map: oceanTexture(), shininess: 90, specular: 0x99ccee }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-640, 0.06, 0);
  ocean.receiveShadow = true;
  scene.add(ocean);

  window.addEventListener('resize', () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  applyHour(G.timeHours);
  return renderer;
}

// ---------------------------------------------------------------- frame
/** Advance the clock, relight the hour, and keep the dressing alive. */
export function updateWorld(dt) {
  G.timeHours = (G.timeHours + (dt * 24) / G.dayLengthSec) % 24;
  applyHour(G.timeHours);
  elapsed += dt;
  const t = elapsed;
  for (const boat of boats) {
    boat.position.y = 0.1 + Math.sin(t * 0.7 + boat.userData.phase) * 0.05;
    boat.rotation.z = Math.sin(t * 0.55 + boat.userData.phase) * 0.02;
    boat.rotation.x = Math.cos(t * 0.45 + boat.userData.phase) * 0.012;
  }
  if (ferrisWheel && ferrisWheel.userData.spin) {
    ferrisWheel.userData.spin.rotation.z += dt * 0.12;
  }
  if (ocean && ocean.material.map) {
    ocean.material.map.offset.x += dt * 0.004;
    ocean.material.map.offset.y += dt * 0.0016;
  }
  const drift = weather.wind * dt * 1.4;
  for (const spr of clouds) {
    spr.position.x += drift;
    if (spr.position.x > 560) spr.position.x = -560;
  }
}

// minimap.js — the cartography of Puerto Alba, painted once and read at
// two sizes. A static layer holds the whole chart in world coordinates:
// a bay that deepens away from the shore with pale depth rings, the sand
// edge, six district washes with soft borders, the road hierarchy with
// the palm boulevard drawn proud, the marina with its boats at their
// real berths, the plaza hearts and the landmarks. The round HUD minimap
// blits the slice around the player; the full-screen chart (M) draws the
// whole layer and adds district names, landmark glyphs, the compass
// rose, the gold route and its distance pill. The route is no decoration:
// Dijkstra over the road grid's intersections, cached until it moves.
//
// The wash colours below are the districts' identities — aqua Marina
// Alta, palm-green Las Palmas, warm-rose Centro Alba, ochre Viejo
// Puerto, violet El Faro, sand Playa Brava — firmed up until each
// territory reads at a glance while roads, labels and blips stay legible
// on top of them.
import { G } from './state.js';
import { ROADS_X, ROADS_Z, BOULEVARD_X, ROAD_WIDTH, DISTRICTS, PLACES } from './city.js';
import { objectivePoint } from './missions.js';

const WORLD = { minX: -300, maxX: 320, minZ: -340, maxZ: 340 };
const PX_PER_M = 1.6; // resolution of the painted layer
let layer = null;
let mini = null; let miniCtx = null;
let big = null; let bigCtx = null;

const WASH = {
  'El Faro': 'rgba(198,180,232,0.46)',
  'Playa Brava': 'rgba(250,228,158,0.50)',
  'Marina Alta': 'rgba(118,214,236,0.50)',
  'Las Palmas': 'rgba(146,219,150,0.50)',
  'Centro Alba': 'rgba(255,196,178,0.44)',
  'Viejo Puerto': 'rgba(233,176,106,0.52)',
};

// ------------------------------------------------------------ the painting
function paintLayer() {
  const w = (WORLD.maxX - WORLD.minX) * PX_PER_M;
  const h = (WORLD.maxZ - WORLD.minZ) * PX_PER_M;
  layer = document.createElement('canvas');
  layer.width = w; layer.height = h;
  const g = layer.getContext('2d');
  const X = (x) => (x - WORLD.minX) * PX_PER_M;
  const Z = (z) => (z - WORLD.minZ) * PX_PER_M;
  const rect = (x, z, mw, mh) => g.fillRect(X(x), Z(z), mw * PX_PER_M, mh * PX_PER_M);

  // The bay first: a gradient deepening off the shore, a pale shallow
  // shelf against the land, then fainter rings stepping out to sea. The
  // land painted over it keeps only the water's share of the shading.
  const sea = g.createLinearGradient(0, 0, X(-200), 0);
  sea.addColorStop(0, '#123a58');
  sea.addColorStop(0.75, '#1f6390');
  sea.addColorStop(1, '#3583ac');
  g.fillStyle = sea; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(126,204,230,0.30)';
  g.fillRect(X(-264), 0, (316 + 264) * PX_PER_M, h);
  for (const [off, col] of [[22, 'rgba(170,222,246,0.26)'], [36, 'rgba(170,222,246,0.16)'], [54, 'rgba(170,222,246,0.09)']]) {
    g.strokeStyle = col; g.lineWidth = 2;
    g.strokeRect(X(-252 - off), Z(-340 - off), (544 + off * 2) * PX_PER_M, (680 + off * 2) * PX_PER_M);
  }

  // Land, its sand edge along Playa Brava, and the waterline's glint.
  g.fillStyle = '#77805f'; rect(-252, WORLD.minZ, 292 + 252, WORLD.maxZ - WORLD.minZ);
  g.fillStyle = '#ecd49c'; g.fillRect(X(-252), 0, 27 * PX_PER_M, h);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(X(-226.5), 0, 1.6 * PX_PER_M, h);

  // District territories: the wash, then a soft border to close it.
  for (const d of DISTRICTS) {
    g.fillStyle = WASH[d.name] ?? 'rgba(255,255,255,0.12)';
    rect(d.minX, d.minZ, d.maxX - d.minX, d.maxZ - d.minZ);
    g.strokeStyle = 'rgba(255,250,235,0.55)';
    g.lineWidth = 1.4;
    g.strokeRect(X(d.minX), Z(d.minZ), (d.maxX - d.minX) * PX_PER_M, (d.maxZ - d.minZ) * PX_PER_M);
  }

  // Blocks the city leaves open: courtyard hearts planted green,
  // parking slabs in pale asphalt.
  for (const pz of G.city?.plazas ?? []) {
    g.fillStyle = pz.parking ? 'rgba(216,211,200,0.55)' : 'rgba(96,164,84,0.50)';
    rect(pz.minX, pz.minZ, pz.maxX - pz.minX, pz.maxZ - pz.minZ);
  }
  // The Plaza del Reloj: green heart, the tower's footprint in cream.
  g.fillStyle = '#5f9c4e'; rect(PLACES.plaza.x - 15, PLACES.plaza.z - 15, 30, 30);
  g.fillStyle = '#e8d9b0'; rect(PLACES.clockTower.x - 2, PLACES.clockTower.z - 2, 4, 4);

  // Roads: side streets pale, the boulevard a proud golden band with a
  // bright centre line.
  g.fillStyle = '#dcd9d0';
  for (const rx of ROADS_X) g.fillRect(X(rx) - (ROAD_WIDTH / 2) * PX_PER_M, 0, ROAD_WIDTH * PX_PER_M, h);
  for (const rz of ROADS_Z) g.fillRect(0, Z(rz) - (ROAD_WIDTH / 2) * PX_PER_M, w, ROAD_WIDTH * PX_PER_M);
  g.fillStyle = '#f0dfa8';
  g.fillRect(X(BOULEVARD_X) - ((ROAD_WIDTH + 5) / 2) * PX_PER_M, 0, (ROAD_WIDTH + 5) * PX_PER_M, h);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(X(BOULEVARD_X) - 0.4 * PX_PER_M, 0, 0.8 * PX_PER_M, h);

  // Marina piers, the pleasure pier, and the moored boats at the very
  // berths city.js floats them — white hulls, their real trim colours.
  g.fillStyle = '#8a6844';
  for (let i = 0; i < 4; i += 1) g.fillRect(X(-259), Z(198 + i * 22), 26 * PX_PER_M, 4 * PX_PER_M);
  if (G.city?.pier) {
    g.fillRect(X(G.city.pier.toX), Z(G.city.pier.z - 2.5), (G.city.pier.fromX - G.city.pier.toX) * PX_PER_M, 5 * PX_PER_M);
  }
  const TRIMS = ['#d84f35', '#2f7fd0', '#35b06f', '#f2b13c'];
  for (let i = 0; i < 8; i += 1) {
    const bx = -254 - (i % 3) * 7.5, bz = 194 + i * 12.5;
    g.fillStyle = '#f0ede6';
    g.beginPath(); g.roundRect(X(bx - 1.6), Z(bz - 4), 3.2 * PX_PER_M, 8 * PX_PER_M, 2); g.fill();
    g.fillStyle = TRIMS[i % 4];
    g.fillRect(X(bx - 1.7), Z(bz - 0.4), 3.4 * PX_PER_M, 0.8 * PX_PER_M);
  }

  // The Ferris wheel: a small gold ring on the beach.
  if (G.city?.ferris) {
    g.strokeStyle = '#ffcf5e'; g.lineWidth = 2;
    g.beginPath(); g.arc(X(G.city.ferris.x), Z(G.city.ferris.z), 6 * PX_PER_M, 0, Math.PI * 2); g.stroke();
  }
  // The lighthouse point: white ring, red heart.
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(X(PLACES.lighthouse.x), Z(PLACES.lighthouse.z), 3.4 * PX_PER_M, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d8402e';
  g.beginPath(); g.arc(X(PLACES.lighthouse.x), Z(PLACES.lighthouse.z), 1.7 * PX_PER_M, 0, Math.PI * 2); g.fill();
}

export function initMinimap() {
  mini = document.getElementById('minimap');
  miniCtx = mini.getContext('2d');
  big = document.getElementById('bigmap');
  if (big) bigCtx = big.getContext('2d');
  paintLayer();
}

// --------------------------------------------------------------- the router
const COLS = [BOULEVARD_X, ...ROADS_X]; // vertical road lines
const ROWS = ROADS_Z;                   // horizontal road lines
let routeMemo = { key: '', pts: null, dist: 0 };

const nodeIndex = (i, j) => i * ROWS.length + j;
const nodePoint = (idx) => ({ x: COLS[Math.floor(idx / ROWS.length)], z: ROWS[idx % ROWS.length] });

function nearestNode(x, z) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < COLS.length; i += 1) for (let j = 0; j < ROWS.length; j += 1) {
    const d = (COLS[i] - x) ** 2 + (ROWS[j] - z) ** 2;
    if (d < bestD) { bestD = d; best = nodeIndex(i, j); }
  }
  return best;
}

/** Dijkstra across the intersection grid; world points from→to. */
function findRoute(fx, fz, tx, tz) {
  const start = nearestNode(fx, fz);
  const goal = nearestNode(tx, tz);
  const n = COLS.length * ROWS.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const settled = new Array(n).fill(false);
  dist[start] = 0;
  for (let step = 0; step < n; step += 1) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i += 1) if (!settled[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u === -1 || u === goal) break;
    settled[u] = true;
    const ui = Math.floor(u / ROWS.length), uj = u % ROWS.length;
    const up = nodePoint(u);
    for (const [vi, vj] of [[ui - 1, uj], [ui + 1, uj], [ui, uj - 1], [ui, uj + 1]]) {
      if (vi < 0 || vj < 0 || vi >= COLS.length || vj >= ROWS.length) continue;
      const v = nodeIndex(vi, vj);
      const vp = nodePoint(v);
      const wgt = Math.hypot(vp.x - up.x, vp.z - up.z);
      if (dist[u] + wgt < dist[v]) { dist[v] = dist[u] + wgt; prev[v] = u; }
    }
  }
  const chain = [];
  let cur = goal;
  while (cur !== -1) { chain.push(nodePoint(cur)); if (cur === start) break; cur = prev[cur]; }
  chain.reverse();
  const pts = [{ x: fx, z: fz }, ...chain, { x: tx, z: tz }];
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return { pts, dist: total };
}

/** The route to the live objective; recomputed only when it has moved. */
export function currentRoute() {
  const obj = objectivePoint();
  if (!obj) { routeMemo = { key: '', pts: null, dist: 0 }; return null; }
  const p = G.player;
  const key = `${Math.round(obj.x / 4)},${Math.round(obj.z / 4)},${Math.round(p.x / 25)},${Math.round(p.z / 25)}`;
  if (routeMemo.key !== key) {
    const r = findRoute(p.x, p.z, obj.x, obj.z);
    routeMemo = { key, pts: r.pts, dist: r.dist };
  }
  return routeMemo;
}

// ------------------------------------------------------------ shared stamps
/** The gold route: a glowing band with a pale dashed heart that flows. */
function stampRoute(g, toMap, width) {
  const route = currentRoute();
  if (!route?.pts || route.pts.length < 2) return;
  const trace = () => {
    g.beginPath();
    route.pts.forEach((pt, i) => {
      const [mx, my] = toMap(pt.x, pt.z);
      if (i === 0) g.moveTo(mx, my); else g.lineTo(mx, my);
    });
  };
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = '#ffb340';
  g.lineWidth = width;
  g.shadowColor = 'rgba(255,179,64,0.9)';
  g.shadowBlur = width * 2.4;
  trace(); g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,240,200,0.85)';
  g.lineWidth = Math.max(1, width * 0.45);
  g.setLineDash([9, 7]);
  g.lineDashOffset = -G.elapsed * 26;
  trace(); g.stroke();
  g.restore();
}

/** Live traffic, the job's target car, the PAPD and FALCON-1 as blips. */
function stampBlips(g, toMap, inView, big) {
  const phase = Math.floor(G.elapsed * 2.4) % 2 === 0;
  if (big) { // traffic: quiet grey dots, big chart only
    g.fillStyle = 'rgba(215,220,225,0.8)';
    for (const car of G.trafficCars) {
      if (car.dead) continue;
      const [mx, my] = toMap(car.x, car.z);
      g.fillRect(mx - 1.6, my - 1.6, 3.2, 3.2);
    }
  }
  if (G.mission?.targetCar && !G.mission.targetCar.dead) {
    const [mx, my] = toMap(G.mission.targetCar.x, G.mission.targetCar.z);
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.arc(mx, my, big ? 5 : 4, 0, Math.PI * 2); g.fill();
  }
  for (const car of G.policeCars) { // flashing red/blue, edge-clamped
    if (car.dead) continue;
    const [mx, my] = inView(car.x, car.z);
    g.fillStyle = phase ? '#ff3b30' : '#3a7bff';
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1;
    g.beginPath(); g.arc(mx, my, big ? 4.4 : 3.4, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  g.fillStyle = '#7ab0ff'; // officers on foot: small navy squares
  for (const o of G.officers) {
    if (o.dead || o.state === 'down') continue;
    const [mx, my] = inView(o.x, o.z);
    g.fillRect(mx - 2.2, my - 2.2, 4.4, 4.4);
  }
  if (G.heli?.active) {
    const [mx, my] = inView(G.heli.x, G.heli.z);
    g.fillStyle = '#ffffff';
    g.fillRect(mx - 2.6, my - 2.6, 5.2, 5.2);
  }
}

/** The objective diamond, pulsing; returns its chart point or null. */
function stampObjective(g, clampPt, big) {
  const obj = objectivePoint();
  if (!obj) return null;
  const [mx, my] = clampPt(obj.x, obj.z);
  const r = (big ? 7 : 5) + Math.sin(G.elapsed * 5) * 1.2;
  g.save();
  g.translate(mx, my);
  g.rotate(Math.PI / 4);
  g.fillStyle = obj.kind === 'giver' ? '#57d7e8' : '#ffb340';
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(-r / 1.6, -r / 1.6, r * 1.25, r * 1.25);
  g.strokeRect(-r / 1.6, -r / 1.6, r * 1.25, r * 1.25);
  g.restore();
  return { x: mx, y: my, obj };
}

/** The player's arrow: white, dark-edged, nose against the heading. */
function stampArrow(g, mx, my, heading, scale = 1) {
  g.save();
  g.translate(mx, my);
  g.rotate(Math.PI - heading);
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(0,0,0,0.65)';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(0, -7 * scale); g.lineTo(4.6 * scale, 5.5 * scale);
  g.lineTo(0, 2.6 * scale); g.lineTo(-4.6 * scale, 5.5 * scale);
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

// -------------------------------------------------------------- the minimap
const VIEW = 95; // metres from the player to the round map's edge

export function drawMinimap() {
  if (!miniCtx) return;
  const p = G.player;
  const size = mini.width;
  const half = size / 2;
  const pxPerM = half / VIEW;

  miniCtx.fillStyle = '#16202b';
  miniCtx.fillRect(0, 0, size, size);
  const srcHalf = VIEW * PX_PER_M;
  const cx = (p.x - WORLD.minX) * PX_PER_M;
  const cz = (p.z - WORLD.minZ) * PX_PER_M;
  miniCtx.drawImage(layer, cx - srcHalf, cz - srcHalf, srcHalf * 2, srcHalf * 2, 0, 0, size, size);

  const toMap = (x, z) => [half + (x - p.x) * pxPerM, half + (z - p.z) * pxPerM];
  const clampPt = (x, z) => toMap(
    Math.max(p.x - VIEW + 6, Math.min(p.x + VIEW - 6, x)),
    Math.max(p.z - VIEW + 6, Math.min(p.z + VIEW - 6, z)));

  stampRoute(miniCtx, toMap, 2.6);
  stampBlips(miniCtx, clampPt, clampPt, false);
  stampObjective(miniCtx, clampPt, false);

  const pulse = (G.elapsed % 1.6) / 1.6;
  miniCtx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - pulse)})`;
  miniCtx.lineWidth = 2;
  miniCtx.beginPath(); miniCtx.arc(half, half, 6 + pulse * 9, 0, Math.PI * 2); miniCtx.stroke();
  stampArrow(miniCtx, half, half, p.heading, 1);

  // The blit never rotates, so north is always the top of the glass.
  miniCtx.fillStyle = 'rgba(255,248,234,0.85)';
  miniCtx.font = '700 11px "Segoe UI", Arial, sans-serif';
  miniCtx.textAlign = 'center';
  miniCtx.fillText('N', half, 15);
}

// --------------------------------------------------------------- the big map
export function drawBigMap() {
  if (!bigCtx) return;
  const g = bigCtx;
  const W = big.width, H = big.height;
  g.clearRect(0, 0, W, H);

  const margin = 30;
  const scale = Math.min((W - margin * 2) / (WORLD.maxX - WORLD.minX), (H - margin * 2) / (WORLD.maxZ - WORLD.minZ));
  const mapW = (WORLD.maxX - WORLD.minX) * scale;
  const mapH = (WORLD.maxZ - WORLD.minZ) * scale;
  const ox = (W - mapW) / 2, oy = (H - mapH) / 2;
  const toMap = (x, z) => [ox + (x - WORLD.minX) * scale, oy + (z - WORLD.minZ) * scale];

  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 24;
  g.drawImage(layer, 0, 0, layer.width, layer.height, ox, oy, mapW, mapH);
  g.restore();
  g.strokeStyle = 'rgba(255,248,234,0.35)';
  g.lineWidth = 1.5;
  g.strokeRect(ox, oy, mapW, mapH);

  // District names, haloed so they sit on any wash.
  g.textAlign = 'center';
  g.font = '600 15px "Segoe UI", Arial, sans-serif';
  for (const d of DISTRICTS) {
    const [mx, my] = toMap((d.minX + d.maxX) / 2, (d.minZ + d.maxZ) / 2);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(10,18,28,0.65)';
    const label = d.name.toUpperCase();
    g.strokeText(label, mx, my);
    g.fillStyle = '#fff8ea';
    g.fillText(label, mx, my);
  }

  stampRoute(g, toMap, 3.6);
  stampBlips(g, toMap, toMap, true);

  // Landmark glyphs, one per real place: the garage, the PAPD station,
  // the hospital, Marisol's corner in her own gold, Tito's race lights,
  // the marina docks, and the lighthouse drawn as a lighthouse.
  glyphBadge(g, toMap(PLACES.garagePad.x, PLACES.garagePad.z), '#e8862e', 'G');
  glyphShield(g, toMap(PLACES.policeStation.x, PLACES.policeStation.z));
  glyphCross(g, toMap(PLACES.hospital.x, PLACES.hospital.z));
  glyphBadge(g, toMap(PLACES.marisolCorner.x, PLACES.marisolCorner.z), '#ffb340', 'M', '#503a08');
  glyphFlag(g, toMap(PLACES.raceStart.x, PLACES.raceStart.z));
  glyphAnchor(g, toMap(PLACES.marinaDock.x, PLACES.marinaDock.z));
  glyphLighthouse(g, toMap(PLACES.lighthouse.x, PLACES.lighthouse.z));

  // The objective diamond and its distance pill.
  const marker = stampObjective(g, toMap, true);
  const route = currentRoute();
  if (marker && route?.dist) {
    const label = route.dist >= 1000 ? `${(route.dist / 1000).toFixed(1)} km` : `${Math.round(route.dist)} m`;
    g.font = '700 13px "Segoe UI", Arial, sans-serif';
    const tw = g.measureText(label).width + 18;
    const px = marker.x - tw / 2, py = marker.y - 40;
    g.fillStyle = 'rgba(10,16,24,0.88)';
    g.beginPath(); g.roundRect(px, py, tw, 22, 11); g.fill();
    g.strokeStyle = '#ffb340'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = '#ffcf6e';
    g.fillText(label, marker.x, py + 15);
  }

  // The player: a double pulse ring and the arrow, larger than life.
  const [pxx, pyy] = toMap(G.player.x, G.player.z);
  const pulse = (G.elapsed % 1.6) / 1.6;
  g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - pulse)})`;
  g.lineWidth = 2;
  g.beginPath(); g.arc(pxx, pyy, 8 + pulse * 12, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.arc(pxx, pyy, 9, 0, Math.PI * 2); g.stroke();
  stampArrow(g, pxx, pyy, G.player.heading, 1.35);

  // Compass rose at the chart's top-right: a glass disc, a two-tone
  // needle with red flying north, and the N riding above it.
  const ccx = ox + mapW - 27, ccy = oy + 31;
  g.save();
  g.fillStyle = 'rgba(10,16,24,0.55)';
  g.beginPath(); g.arc(ccx, ccy, 14, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(255,248,234,0.5)';
  g.lineWidth = 1;
  g.stroke();
  g.beginPath(); g.moveTo(ccx, ccy - 10); g.lineTo(ccx + 3.4, ccy); g.lineTo(ccx - 3.4, ccy); g.closePath();
  g.fillStyle = '#ff5a3c'; g.fill();
  g.beginPath(); g.moveTo(ccx, ccy + 10); g.lineTo(ccx + 3.4, ccy); g.lineTo(ccx - 3.4, ccy); g.closePath();
  g.fillStyle = 'rgba(255,248,234,0.85)'; g.fill();
  g.fillStyle = '#fff8ea';
  g.font = '700 10px "Segoe UI", Arial, sans-serif';
  g.fillText('N', ccx, ccy - 17);
  g.restore();
}

// ------------------------------------------------------------------ glyphs
function glyphBadge(g, [mx, my], color, letter, letterColor = '#ffffff') {
  g.save();
  g.fillStyle = color;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(mx, my, 8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = letterColor;
  g.font = '900 11px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(letter, mx, my + 4);
  g.restore();
}

function glyphFlag(g, [mx, my]) {
  g.save();
  g.strokeStyle = 'rgba(15,20,26,0.85)';
  g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(mx - 5, my + 7); g.lineTo(mx - 5, my - 7); g.stroke();
  const fw = 11, fh = 8, fx = mx - 5, fy = my - 7, cell = fw / 3;
  for (let r = 0; r < 2; r += 1) for (let c = 0; c < 3; c += 1) {
    g.fillStyle = (r + c) % 2 === 0 ? '#20242a' : '#ffffff';
    g.fillRect(fx + c * cell, fy + r * (fh / 2), cell, fh / 2);
  }
  g.strokeStyle = 'rgba(15,20,26,0.65)';
  g.lineWidth = 1;
  g.strokeRect(fx, fy, fw, fh);
  g.restore();
}

function glyphAnchor(g, [mx, my]) {
  g.save();
  g.fillStyle = '#175d7a';
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(mx, my, 8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.5;
  g.lineCap = 'round';
  g.beginPath(); g.arc(mx, my - 4.6, 1.7, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  g.moveTo(mx, my - 2.9); g.lineTo(mx, my + 5.4);
  g.moveTo(mx - 3.4, my - 0.6); g.lineTo(mx + 3.4, my - 0.6);
  g.moveTo(mx - 4.6, my + 1.8); g.quadraticCurveTo(mx, my + 7.6, mx + 4.6, my + 1.8);
  g.stroke();
  g.restore();
}

function glyphLighthouse(g, [mx, my]) {
  g.save();
  const tower = new Path2D();
  tower.moveTo(mx - 2.4, my - 12); tower.lineTo(mx + 2.4, my - 12);
  tower.lineTo(mx + 4.2, my); tower.lineTo(mx - 4.2, my);
  tower.closePath();
  g.save();
  g.clip(tower);
  g.fillStyle = '#ffffff'; g.fillRect(mx - 5, my - 12, 10, 12);
  g.fillStyle = '#d8402e';
  g.fillRect(mx - 5, my - 10, 10, 2.6);
  g.fillRect(mx - 5, my - 5.4, 10, 2.6);
  g.restore();
  g.strokeStyle = 'rgba(10,18,28,0.55)';
  g.lineWidth = 1;
  g.stroke(tower);
  g.fillStyle = '#26313d';
  g.fillRect(mx - 2.8, my - 15.4, 5.6, 3.4);
  g.fillStyle = '#ffd76a';
  g.beginPath(); g.arc(mx, my - 13.7, 1.5, 0, Math.PI * 2); g.fill();
  g.restore();
}

function glyphShield(g, [mx, my]) {
  g.save();
  g.fillStyle = '#2b4a73';
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(mx, my - 9);
  g.lineTo(mx + 7.5, my - 6);
  g.lineTo(mx + 7.5, my + 2);
  g.quadraticCurveTo(mx + 7.5, my + 8, mx, my + 10.5);
  g.quadraticCurveTo(mx - 7.5, my + 8, mx - 7.5, my + 2);
  g.lineTo(mx - 7.5, my - 6);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#ffd23e';
  g.font = '11px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('★', mx, my + 3.5);
  g.restore();
}

function glyphCross(g, [mx, my]) {
  g.save();
  g.fillStyle = '#f2f4f4';
  g.strokeStyle = 'rgba(20,30,40,0.5)';
  g.lineWidth = 1;
  g.beginPath(); g.arc(mx, my, 8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#d8402e';
  g.fillRect(mx - 1.8, my - 5.4, 3.6, 10.8);
  g.fillRect(mx - 5.4, my - 1.8, 10.8, 3.6);
  g.restore();
}

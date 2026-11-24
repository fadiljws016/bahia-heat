// minimap.js — Puerto Alba cartography: one pre-rendered static layer
// (painted once at 1.6 px per metre from the same roads/districts data
// the 3D city is built from) shared by the corner minimap and the full
// map. The route is a real Dijkstra run over the road graph, so the
// distance pill is honest: staged at (140,-36.5) with the objective at
// the marina gate it reads 686 m because that is the road distance.

import { G } from './state.js';
import { ROADS_X, ROADS_Z, BOULEVARD_X, ROAD_WIDTH, DISTRICTS, PLACES } from './city.js';
import { objectivePoint } from './missions.js';

const WORLD = { minX: -300, maxX: 320, minZ: -340, maxZ: 340 };
const SCALE = 1.6;

let staticLayer = null;
let ctx = null;
let canvas = null;
let bigCtx = null;
let bigCanvas = null;

const DISTRICT_WASH = {
  'El Faro': 'rgba(198,180,232,0.46)',
  'Playa Brava': 'rgba(250,228,158,0.50)',
  'Marina Alta': 'rgba(118,214,236,0.50)',
  'Las Palmas': 'rgba(146,219,150,0.50)',
  'Centro Alba': 'rgba(255,196,178,0.44)',
  'Viejo Puerto': 'rgba(233,176,106,0.52)',
};

const X = (x) => (x - WORLD.minX) * SCALE;
const Z = (z) => (z - WORLD.minZ) * SCALE;

function paintStatic() {
  const w = (WORLD.maxX - WORLD.minX) * SCALE;
  const h = (WORLD.maxZ - WORLD.minZ) * SCALE;
  staticLayer = document.createElement('canvas');
  staticLayer.width = w;
  staticLayer.height = h;
  const g = staticLayer.getContext('2d');
  // The bay: a gradient that deepens away from the shore.
  const sea = g.createLinearGradient(0, 0, X(-200), 0);
  sea.addColorStop(0, '#123a58');
  sea.addColorStop(0.75, '#1f6390');
  sea.addColorStop(1, '#3583ac');
  g.fillStyle = sea;
  g.fillRect(0, 0, w, h);
  // Shallow shelf + depth rings stepping out into the bay.
  g.fillStyle = 'rgba(126,204,230,0.30)';
  g.fillRect(X(-264), 0, (316 + 264) * SCALE, h);
  const RINGS = [[22, 'rgba(170,222,246,0.26)'], [36, 'rgba(170,222,246,0.16)'], [54, 'rgba(170,222,246,0.09)']];
  for (const [off, col] of RINGS) {
    g.strokeStyle = col;
    g.lineWidth = 2;
    g.strokeRect(X(-252 - off), Z(-340 - off), (544 + off * 2) * SCALE, (680 + off * 2) * SCALE);
  }
  // Land, then the sand edge along Playa Brava.
  g.fillStyle = '#77805f';
  g.fillRect(X(-252), 0, (292 + 252) * SCALE, h);
  g.fillStyle = '#ecd49c';
  g.fillRect(X(-252), 0, 27 * SCALE, h);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(X(-226.5), 0, 1.6 * SCALE, h); // the waterline
  // District washes.
  for (const d of DISTRICTS) {
    g.fillStyle = DISTRICT_WASH[d.name] ?? 'rgba(255,255,255,0.12)';
    g.fillRect(X(d.minX), Z(d.minZ), (d.maxX - d.minX) * SCALE, (d.maxZ - d.minZ) * SCALE);
  }
  // Plaza greens.
  if (G.city) {
    g.fillStyle = '#5f9c4e';
    for (const p of G.city.plazas) {
      g.fillRect(X(p.minX), Z(p.minZ), (p.maxX - p.minX) * SCALE, (p.maxZ - p.minZ) * SCALE);
    }
  }
  // Marina timber.
  g.fillStyle = '#8a6844';
  for (let i = 0; i < 4; i += 1) g.fillRect(X(-272), Z(200 + i * 37 - 1.3), 20 * SCALE, 2.6 * SCALE);
  // Roads: pale casing, dark carriageway; the boulevard glows warm.
  const road = (vertical, line, len, from, tint) => {
    g.fillStyle = '#c9c2ae';
    if (vertical) g.fillRect(X(line) - (ROAD_WIDTH / 2 + 2) * SCALE, Z(from), (ROAD_WIDTH + 4) * SCALE, len * SCALE);
    else g.fillRect(X(from), Z(line) - (ROAD_WIDTH / 2 + 2) * SCALE, len * SCALE, (ROAD_WIDTH + 4) * SCALE);
    g.fillStyle = tint;
    if (vertical) g.fillRect(X(line) - (ROAD_WIDTH / 2) * SCALE, Z(from), ROAD_WIDTH * SCALE, len * SCALE);
    else g.fillRect(X(from), Z(line) - (ROAD_WIDTH / 2) * SCALE, len * SCALE, ROAD_WIDTH * SCALE);
  };
  for (const rx of ROADS_X) road(true, rx, 616, -308, '#efe9da');
  for (const rz of ROADS_Z) road(false, rz, 544, -252, '#efe9da');
  road(true, BOULEVARD_X, 616, -308, '#f5c86e');
  // District labels, once each, at rect centres.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const d of DISTRICTS) {
    const cx = X((d.minX + d.maxX) / 2);
    const cy = Z((d.minZ + d.maxZ) / 2);
    g.font = '700 19px system-ui, sans-serif';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(20,24,30,0.55)';
    const label = d.name.toUpperCase();
    g.strokeText(label, cx, cy);
    g.fillStyle = 'rgba(255,252,244,0.95)';
    g.fillText(label, cx, cy);
  }
}

// ------------------------------------------------------------- the router

const NODES = [];
const NODE_ID = new Map();
function nodeId(x, z) {
  const key = `${x},${z}`;
  if (!NODE_ID.has(key)) {
    NODE_ID.set(key, NODES.length);
    NODES.push({ x, z, edges: [] });
  }
  return NODE_ID.get(key);
}
{
  const xs = [BOULEVARD_X, ...ROADS_X];
  for (const x of xs) for (const z of ROADS_Z) nodeId(x, z);
  const link = (a, b) => {
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    a.edges.push({ to: b, d });
    b.edges.push({ to: a, d });
  };
  for (const x of xs) {
    const col = ROADS_Z.map((z) => NODES[nodeId(x, z)]).sort((a, b) => a.z - b.z);
    for (let i = 0; i < col.length - 1; i += 1) link(col[i], col[i + 1]);
  }
  for (const z of ROADS_Z) {
    const row = xs.map((x) => NODES[nodeId(x, z)]).sort((a, b) => a.x - b.x);
    for (let i = 0; i < row.length - 1; i += 1) link(row[i], row[i + 1]);
  }
}

function nearestNode(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const n of NODES) {
    const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

let routeCache = { key: '', pts: null, dist: 0 };

function computeRoute(fx, fz, tx, tz) {
  const start = nearestNode(fx, fz);
  const goal = nearestNode(tx, tz);
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const open = new Set([start]);
  while (open.size) {
    let cur = null;
    let curD = Infinity;
    for (const n of open) {
      const d = dist.get(n);
      if (d < curD) { curD = d; cur = n; }
    }
    if (cur === goal) break;
    open.delete(cur);
    for (const e of cur.edges) {
      const nd = curD + e.d;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur);
        open.add(e.to);
      }
    }
  }
  const pts = [{ x: fx, z: fz }];
  const chain = [];
  let n = goal;
  while (n && n !== start) {
    chain.unshift({ x: n.x, z: n.z });
    n = prev.get(n);
  }
  chain.unshift({ x: start.x, z: start.z });
  pts.push(...chain, { x: tx, z: tz });
  let total = 0;
  for (let i = 0; i < pts.length - 1; i += 1) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
  return { pts, dist: total };
}

export function currentRoute() {
  const obj = objectivePoint();
  const p = G.player;
  if (!obj || !p) { routeCache = { key: '', pts: null, dist: 0 }; return null; }
  const key = `${Math.round(p.x)},${Math.round(p.z)}->${obj.x},${obj.z}`;
  if (routeCache.key !== key) {
    const r = computeRoute(p.x, p.z, obj.x, obj.z);
    routeCache = { key, pts: r.pts, dist: r.dist };
  }
  return routeCache;
}

// ------------------------------------------------------------ live drawing

function drawRoute(g, toMap, width) {
  const r = currentRoute();
  if (!r || !r.pts) return;
  g.strokeStyle = '#ffb340';
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.beginPath();
  r.pts.forEach((pt, i) => {
    const [mx, my] = toMap(pt.x, pt.z);
    if (i === 0) g.moveTo(mx, my);
    else g.lineTo(mx, my);
  });
  g.stroke();
  const obj = objectivePoint();
  if (obj) {
    const [mx, my] = toMap(obj.x, obj.z);
    g.save();
    g.translate(mx, my);
    g.rotate(Math.PI / 4);
    g.fillStyle = '#ffb340';
    g.fillRect(-width * 1.1, -width * 1.1, width * 2.2, width * 2.2);
    g.restore();
  }
}

function drawPlayerArrow(g, x, y, heading, s) {
  g.save();
  g.translate(x, y);
  g.rotate(heading);
  g.fillStyle = '#ffffff';
  g.strokeStyle = 'rgba(10,14,20,0.8)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(0, -8 * s);
  g.lineTo(5.4 * s, 7 * s);
  g.lineTo(0, 3.6 * s);
  g.lineTo(-5.4 * s, 7 * s);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

function glyphBase(g, x, y, r, fill) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = 1.6;
  g.strokeStyle = 'rgba(12,16,22,0.75)';
  g.stroke();
}

function drawGlyphs(g, toMap, s) {
  const P = PLACES;
  // Marisol: gold M.
  {
    const [x, y] = toMap(P.marisol.x, P.marisol.z);
    glyphBase(g, x, y, 8 * s, '#e8a33c');
    g.fillStyle = '#241a08';
    g.font = `700 ${11 * s}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('M', x, y + 0.5);
  }
  // Garage: G in a slate roundel.
  {
    const [x, y] = toMap(P.garage.x, P.garage.z);
    glyphBase(g, x, y, 8 * s, '#5a6672');
    g.fillStyle = '#fff';
    g.font = `700 ${11 * s}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText('G', x, y + 0.5);
  }
  // Hospital: white roundel, red cross.
  {
    const [x, y] = toMap(P.hospital.x, P.hospital.z);
    glyphBase(g, x, y, 8 * s, '#f4f6f6');
    g.fillStyle = '#d8402e';
    g.fillRect(x - 1.8 * s, y - 5 * s, 3.6 * s, 10 * s);
    g.fillRect(x - 5 * s, y - 1.8 * s, 10 * s, 3.6 * s);
  }
  // PAPD: blue shield.
  {
    const [x, y] = toMap(P.papd.x, P.papd.z);
    g.beginPath();
    g.moveTo(x, y - 8 * s);
    g.lineTo(x + 6.4 * s, y - 4.8 * s);
    g.lineTo(x + 6.4 * s, y + 2 * s);
    g.quadraticCurveTo(x + 6.4 * s, y + 7 * s, x, y + 9 * s);
    g.quadraticCurveTo(x - 6.4 * s, y + 7 * s, x - 6.4 * s, y + 2 * s);
    g.lineTo(x - 6.4 * s, y - 4.8 * s);
    g.closePath();
    g.fillStyle = '#2f6fb1';
    g.fill();
    g.fillStyle = '#ffd23e';
    g.font = `700 ${9 * s}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText('P', x, y + 1);
  }
  // Race start: chequered flag square.
  {
    const [x, y] = toMap(P.raceStart.x, P.raceStart.z);
    const q = 3.4 * s;
    for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1) {
      g.fillStyle = (i + j) % 2 ? '#f4f4f4' : '#14181e';
      g.fillRect(x - q + i * q, y - q + j * q, q, q);
    }
    g.strokeStyle = 'rgba(12,16,22,0.75)';
    g.strokeRect(x - q, y - q, q * 2, q * 2);
  }
  // Marina: anchor.
  {
    const [x, y] = toMap(P.marina.x, P.marina.z);
    glyphBase(g, x, y, 8 * s, '#dce8ee');
    g.strokeStyle = '#274b63';
    g.lineWidth = 1.8 * s;
    g.beginPath();
    g.moveTo(x, y - 5 * s);
    g.lineTo(x, y + 5 * s);
    g.moveTo(x - 3.6 * s, y - 2.6 * s);
    g.lineTo(x + 3.6 * s, y - 2.6 * s);
    g.moveTo(x - 4.6 * s, y + 1.6 * s);
    g.quadraticCurveTo(x - 4.2 * s, y + 5.4 * s, x, y + 5.4 * s);
    g.quadraticCurveTo(x + 4.2 * s, y + 5.4 * s, x + 4.6 * s, y + 1.6 * s);
    g.stroke();
  }
  // Lighthouse: a little tower.
  {
    const [x, y] = toMap(P.lighthouse.x, P.lighthouse.z);
    g.fillStyle = '#f4f6f6';
    g.beginPath();
    g.moveTo(x - 3 * s, y + 7 * s);
    g.lineTo(x - 1.8 * s, y - 3 * s);
    g.lineTo(x + 1.8 * s, y - 3 * s);
    g.lineTo(x + 3 * s, y + 7 * s);
    g.closePath();
    g.fill();
    g.fillStyle = '#d8402e';
    g.fillRect(x - 2.5 * s, y - 0.5 * s, 5 * s, 2 * s);
    g.fillStyle = '#ffd23e';
    g.fillRect(x - 1.8 * s, y - 5.6 * s, 3.6 * s, 2.6 * s);
  }
}

function drawPolice(g, toMap, s) {
  for (const car of G.cars) {
    if (car.type !== 'cruiser') continue;
    const [x, y] = toMap(car.x, car.z);
    g.fillStyle = Math.floor(G.elapsed * 3) % 2 ? '#2a7fff' : '#d8402e';
    g.beginPath();
    g.arc(x, y, 3.4 * s, 0, Math.PI * 2);
    g.fill();
  }
  for (const off of G.officers) {
    if (off.dead) continue;
    const [x, y] = toMap(off.x, off.z);
    g.fillStyle = '#2a7fff';
    g.beginPath();
    g.arc(x, y, 2.6 * s, 0, Math.PI * 2);
    g.fill();
  }
  if (G.heli && G.heli.active) {
    const [x, y] = toMap(G.heli.x, G.heli.z);
    g.fillStyle = '#f4f6f6';
    g.font = `700 ${10 * s}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.fillText('H', x, y);
  }
}

export function initMinimap() {
  canvas = document.getElementById('minimap');
  bigCanvas = document.getElementById('bigmap');
  if (canvas) ctx = canvas.getContext('2d');
  if (bigCanvas) bigCtx = bigCanvas.getContext('2d');
  paintStatic();
}

export function drawMinimap() {
  if (!ctx || !staticLayer) return;
  const p = G.player;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#123a58';
  ctx.fillRect(0, 0, w, h);
  if (p) {
    const view = 150; // metres across the corner map
    const k = w / (view * SCALE);
    const sx = X(p.x) - (view * SCALE) / 2;
    const sy = Z(p.z) - (view * SCALE) / 2;
    ctx.drawImage(staticLayer, sx, sy, view * SCALE, view * SCALE, 0, 0, w, h);
    const toMap = (x, z) => [w / 2 + (x - p.x) * SCALE * k, h / 2 + (z - p.z) * SCALE * k];
    drawRoute(ctx, toMap, 3);
    drawPolice(ctx, toMap, 0.8);
    drawPlayerArrow(ctx, w / 2, h / 2, p.car ? p.car.heading : p.heading, 1);
    void k;
  }
  ctx.restore();
}

export function drawBigMap() {
  if (!bigCtx || !staticLayer) return;
  const g = bigCtx;
  const w = bigCanvas.width;
  const h = bigCanvas.height;
  g.clearRect(0, 0, w, h);
  const k = Math.min(w / staticLayer.width, h / staticLayer.height);
  const dw = staticLayer.width * k;
  const dh = staticLayer.height * k;
  const ox = (w - dw) / 2;
  const oy = (h - dh) / 2;
  g.drawImage(staticLayer, ox, oy, dw, dh);
  const toMap = (x, z) => [ox + X(x) * k, oy + Z(z) * k];
  drawRoute(g, toMap, 3.4);
  drawGlyphs(g, toMap, 1);
  drawPolice(g, toMap, 1);
  const p = G.player;
  if (p) {
    const [px, py] = toMap(p.x, p.z);
    const pulse = 1 + Math.sin(G.elapsed * 4) * 0.15;
    drawPlayerArrow(g, px, py, p.car ? p.car.heading : p.heading, pulse);
  }
  // Compass rose.
  const cx = w - 44;
  const cy = 44;
  g.beginPath();
  g.arc(cx, cy, 26, 0, Math.PI * 2);
  g.fillStyle = 'rgba(10,16,24,0.72)';
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.stroke();
  g.fillStyle = '#ffb340';
  g.beginPath();
  g.moveTo(cx, cy - 17);
  g.lineTo(cx + 5, cy + 2);
  g.lineTo(cx - 5, cy + 2);
  g.closePath();
  g.fill();
  g.fillStyle = '#f4f6f6';
  g.font = '700 12px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('N', cx, cy + 15);
  // Route distance pill, riding just above the objective diamond.
  const r = currentRoute();
  const obj = objectivePoint();
  if (r && r.pts && obj) {
    const label = `${Math.round(r.dist)} m`;
    g.font = '700 15px system-ui, sans-serif';
    const tw = g.measureText(label).width + 22;
    const [cx, cy] = toMap(obj.x, obj.z);
    const px = cx - tw / 2;
    const py = cy - 40;
    g.fillStyle = 'rgba(10,16,24,0.85)';
    g.beginPath();
    g.roundRect(px, py, tw, 24, 12);
    g.fill();
    g.strokeStyle = '#ffb340';
    g.lineWidth = 1.4;
    g.stroke();
    g.fillStyle = '#ffedc2';
    g.textAlign = 'center';
    g.fillText(label, px + tw / 2, py + 16.5);
  }
  void ox;
  void dw;
  void dh;
}

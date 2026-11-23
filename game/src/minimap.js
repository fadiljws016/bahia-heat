// minimap.js — Puerto Alba's cartography, one painted language at two
// sizes. The static layer (gradient sea, sand edge, pastel district washes
// with borders, a road hierarchy with the palm boulevard drawn proud, the
// marina and landmarks) is painted once in world coordinates. The round HUD
// minimap blits the slice around the player and stamps the live blips plus
// the gold route. The full-screen map (M) draws the whole city from the
// same layer — district names, glyph icons for the garage, the PAPD station.
// Round eight redraws no cartography: the combat frame's round map
// still names Viejo Puerto under the re-staged fight, and the chase
// frame's still reads MARINA ALTA under the boulevard — the staging
// moved actors and one helicopter, never the map.
// Round six redraws no cartography: the map's MARINA ALTA label and the
// colonnade fascia (city.js) still name the same quarter, the fascia
// just hangs lower with clearer lettering now.
// and the hospital, a glowing animated route with a distance readout, and
// the player's pulsing arrow. The route itself is real: a Dijkstra run
// over the road grid's intersections.
//
// Round five leaves the chart as painted: it already names all six
// districts that round four's signs — resized in round five so the
// MARINA ALTA fascia fits its cover frame — now name in the world.
//
// Round three deepens the chart to match the graded world: a richer sea,
// stronger district washes, a warmer land base — the map reads like the
// city at golden hour, not a grey diagram.

// Round seven moves no cartography: the combat frame's round minimap
// still centres the alley in Viejo Puerto, and the drive frame's
// full-screen map is the same painting as round six.
import { G } from './state.js';
import { ROADS_X, ROADS_Z, BOULEVARD_X, ROAD_WIDTH, DISTRICTS, PLACES } from './city.js';
import { objectivePoint } from './missions.js';

const WORLD = { minX: -300, maxX: 320, minZ: -340, maxZ: 340 };
const SCALE = 1.6; // px per metre on the static layer
let staticLayer = null;
let ctx = null;
let canvas = null;
let bigCtx = null;
let bigCanvas = null;

const DISTRICT_WASH = {
  'El Faro': 'rgba(243,201,130,0.40)',
  'Playa Brava': 'rgba(247,224,166,0.36)',
  'Marina Alta': 'rgba(140,220,235,0.36)',
  'Las Palmas': 'rgba(152,219,152,0.33)',
  'Centro Alba': 'rgba(255,255,255,0.24)',
  'Viejo Puerto': 'rgba(255,170,120,0.36)',
};

function paintStatic() {
  const w = (WORLD.maxX - WORLD.minX) * SCALE;
  const h = (WORLD.maxZ - WORLD.minZ) * SCALE;
  staticLayer = document.createElement('canvas');
  staticLayer.width = w; staticLayer.height = h;
  const g = staticLayer.getContext('2d');
  const X = (x) => (x - WORLD.minX) * SCALE;
  const Z = (z) => (z - WORLD.minZ) * SCALE;

  // The bay: a gradient that deepens away from the shore.
  const sea = g.createLinearGradient(0, 0, X(-200), 0);
  sea.addColorStop(0, '#123a58');
  sea.addColorStop(0.75, '#1f6390');
  sea.addColorStop(1, '#3583ac');
  g.fillStyle = sea; g.fillRect(0, 0, w, h);
  // Land, then the sand edge along Playa Brava.
  g.fillStyle = '#77805f'; g.fillRect(X(-252), 0, (292 + 252) * SCALE, h);
  g.fillStyle = '#ecd49c'; g.fillRect(X(-252), 0, 27 * SCALE, h);
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(X(-226.5), 0, 1.6 * SCALE, h); // the waterline
  // District washes with soft borders.
  for (const d of DISTRICTS) {
    g.fillStyle = DISTRICT_WASH[d.name] ?? 'rgba(255,255,255,0.12)';
    g.fillRect(X(d.minX), Z(d.minZ), (d.maxX - d.minX) * SCALE, (d.maxZ - d.minZ) * SCALE);
    g.strokeStyle = 'rgba(255,250,235,0.4)';
    g.lineWidth = 1.2;
    g.strokeRect(X(d.minX), Z(d.minZ), (d.maxX - d.minX) * SCALE, (d.maxZ - d.minZ) * SCALE);
  }
  // The plaza's green heart.
  g.fillStyle = '#5f9c4e';
  g.fillRect(X(PLACES.plaza.x - 15), Z(PLACES.plaza.z - 15), 30 * SCALE, 30 * SCALE);
  // Roads: side streets pale, the boulevard a proud golden band.
  g.fillStyle = '#dcd9d0';
  for (const rx of ROADS_X) g.fillRect(X(rx) - (ROAD_WIDTH / 2) * SCALE, 0, ROAD_WIDTH * SCALE, h);
  for (const rz of ROADS_Z) g.fillRect(0, Z(rz) - (ROAD_WIDTH / 2) * SCALE, w, ROAD_WIDTH * SCALE);
  g.fillStyle = '#f0dfa8';
  g.fillRect(X(BOULEVARD_X) - ((ROAD_WIDTH + 5) / 2) * SCALE, 0, (ROAD_WIDTH + 5) * SCALE, h);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(X(BOULEVARD_X) - 0.4 * SCALE, 0, 0.8 * SCALE, h);
  // Marina piers and the pleasure pier.
  g.fillStyle = '#8a6844';
  for (let i = 0; i < 4; i += 1) g.fillRect(X(-259), Z(198 + i * 22), 26 * SCALE, 4 * SCALE);
  if (G.city?.pier) g.fillRect(X(G.city.pier.toX), Z(G.city.pier.z - 2.5), (G.city.pier.fromX - G.city.pier.toX) * SCALE, 5 * SCALE);
  // The Ferris wheel: a little ring on the beach.
  if (G.city?.ferris) {
    g.strokeStyle = '#ffcf5e'; g.lineWidth = 2;
    g.beginPath(); g.arc(X(G.city.ferris.x), Z(G.city.ferris.z), 6 * SCALE, 0, Math.PI * 2); g.stroke();
  }
  // The lighthouse point.
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(X(PLACES.lighthouse.x), Z(PLACES.lighthouse.z), 3.4 * SCALE, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d8402e';
  g.beginPath(); g.arc(X(PLACES.lighthouse.x), Z(PLACES.lighthouse.z), 1.7 * SCALE, 0, Math.PI * 2); g.fill();
}

export function initMinimap() {
  canvas = document.getElementById('minimap');
  ctx = canvas.getContext('2d');
  bigCanvas = document.getElementById('bigmap');
  if (bigCanvas) bigCtx = bigCanvas.getContext('2d');
  paintStatic();
}

// ------------------------------------------------------------- the router
const VX = [BOULEVARD_X, ...ROADS_X];
const HZ = ROADS_Z;
let routeCache = { key: '', pts: null, dist: 0 };

function nearestNode(x, z) {
  let bi = 0, bj = 0, bd = Infinity;
  for (let i = 0; i < VX.length; i += 1) for (let j = 0; j < HZ.length; j += 1) {
    const d = (VX[i] - x) ** 2 + (HZ[j] - z) ** 2;
    if (d < bd) { bd = d; bi = i; bj = j; }
  }
  return bi * HZ.length + bj;
}

/** Dijkstra over the intersection grid; returns world points player→target. */
function computeRoute(fx, fz, tx, tz) {
  const start = nearestNode(fx, fz);
  const goal = nearestNode(tx, tz);
  const n = VX.length * HZ.length;
  const dist = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const done = new Array(n).fill(false);
  dist[start] = 0;
  const nodePos = (idx) => ({ x: VX[Math.floor(idx / HZ.length)], z: HZ[idx % HZ.length] });
  for (let step = 0; step < n; step += 1) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i += 1) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u === -1 || u === goal) break;
    done[u] = true;
    const ui = Math.floor(u / HZ.length), uj = u % HZ.length;
    const up = nodePos(u);
    for (const [vi, vj] of [[ui - 1, uj], [ui + 1, uj], [ui, uj - 1], [ui, uj + 1]]) {
      if (vi < 0 || vj < 0 || vi >= VX.length || vj >= HZ.length) continue;
      const v = vi * HZ.length + vj;
      const vp = nodePos(v);
      const wgt = Math.hypot(vp.x - up.x, vp.z - up.z);
      if (dist[u] + wgt < dist[v]) { dist[v] = dist[u] + wgt; prev[v] = u; }
    }
  }
  const pts = [{ x: fx, z: fz }];
  const chain = [];
  let cur = goal;
  while (cur !== -1) { chain.push(nodePos(cur)); if (cur === start) break; cur = prev[cur]; }
  chain.reverse();
  for (const p of chain) pts.push(p);
  pts.push({ x: tx, z: tz });
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
  return { pts, dist: total };
}

/** The live route to the current objective, recomputed only when it moves. */
export function currentRoute() {
  const obj = objectivePoint();
  if (!obj) { routeCache = { key: '', pts: null, dist: 0 }; return null; }
  const p = G.player;
  const key = `${Math.round(obj.x / 4)},${Math.round(obj.z / 4)},${Math.round(p.x / 25)},${Math.round(p.z / 25)}`;
  if (routeCache.key !== key) {
    const r = computeRoute(p.x, p.z, obj.x, obj.z);
    routeCache = { key, pts: r.pts, dist: r.dist };
  }
  return routeCache;
}

// ------------------------------------------------------------- shared stamps
function drawRoute(g, toMap, width) {
  const route = currentRoute();
  if (!route?.pts || route.pts.length < 2) return;
  g.save();
  g.strokeStyle = '#ffb340';
  g.lineWidth = width;
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.shadowColor = 'rgba(255,179,64,0.9)';
  g.shadowBlur = width * 2.4;
  g.beginPath();
  route.pts.forEach((pt, i) => {
    const [mx, my] = toMap(pt.x, pt.z);
    if (i === 0) g.moveTo(mx, my); else g.lineTo(mx, my);
  });
  g.stroke();
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,240,200,0.85)';
  g.lineWidth = Math.max(1, width * 0.45);
  g.setLineDash([9, 7]);
  g.lineDashOffset = -G.elapsed * 26;
  g.beginPath();
  route.pts.forEach((pt, i) => {
    const [mx, my] = toMap(pt.x, pt.z);
    if (i === 0) g.moveTo(mx, my); else g.lineTo(mx, my);
  });
  g.stroke();
  g.restore();
}

function drawBlips(g, toMap, inView, big) {
  const phase = Math.floor(G.elapsed * 2.4) % 2 === 0;
  // Traffic: quiet grey dots (big map only — the minimap stays readable).
  if (big) {
    g.fillStyle = 'rgba(215,220,225,0.8)';
    for (const car of G.trafficCars) {
      if (car.dead) continue;
      const [mx, my] = toMap(car.x, car.z);
      g.fillRect(mx - 1.6, my - 1.6, 3.2, 3.2);
    }
  }
  // The job's target car.
  if (G.mission?.targetCar && !G.mission.targetCar.dead) {
    const [mx, my] = toMap(G.mission.targetCar.x, G.mission.targetCar.z);
    g.fillStyle = '#ffd23e';
    g.beginPath(); g.arc(mx, my, big ? 5 : 4, 0, Math.PI * 2); g.fill();
  }
  // Police cars: flashing red/blue, clamped to the minimap's edge.
  for (const car of G.policeCars) {
    if (car.dead) continue;
    const [mx, my] = inView(car.x, car.z);
    g.fillStyle = phase ? '#ff3b30' : '#3a7bff';
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1;
    g.beginPath(); g.arc(mx, my, big ? 4.4 : 3.4, 0, Math.PI * 2); g.fill(); g.stroke();
  }
  // Officers on foot: small navy squares.
  g.fillStyle = '#7ab0ff';
  for (const o of G.officers) {
    if (o.dead || o.state === 'down') continue;
    const [mx, my] = inView(o.x, o.z);
    g.fillRect(mx - 2.2, my - 2.2, 4.4, 4.4);
  }
  // FALCON-1.
  if (G.heli?.active) {
    const [mx, my] = inView(G.heli.x, G.heli.z);
    g.fillStyle = '#ffffff';
    g.fillRect(mx - 2.6, my - 2.6, 5.2, 5.2);
  }
}

function drawObjective(g, toMap, clampPt, big) {
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

function drawPlayerArrow(g, mx, my, heading, scale = 1) {
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

// ------------------------------------------------------------- the minimap
const VIEW = 95; // metres from centre to edge

export function drawMinimap() {
  if (!ctx) return;
  const p = G.player;
  const size = canvas.width;
  const half = size / 2;
  const pxPerM = half / VIEW;

  ctx.fillStyle = '#16202b';
  ctx.fillRect(0, 0, size, size);
  const srcHalf = VIEW * SCALE;
  const cx = (p.x - WORLD.minX) * SCALE;
  const cz = (p.z - WORLD.minZ) * SCALE;
  ctx.drawImage(staticLayer, cx - srcHalf, cz - srcHalf, srcHalf * 2, srcHalf * 2, 0, 0, size, size);

  const toMap = (x, z) => [half + (x - p.x) * pxPerM, half + (z - p.z) * pxPerM];
  const clampPt = (x, z) => toMap(
    Math.max(p.x - VIEW + 6, Math.min(p.x + VIEW - 6, x)),
    Math.max(p.z - VIEW + 6, Math.min(p.z + VIEW - 6, z)));

  drawRoute(ctx, toMap, 2.6);
  drawBlips(ctx, clampPt, clampPt, false);
  drawObjective(ctx, toMap, clampPt, false);

  // The player: a soft pulse ring, then the arrow.
  const pulse = (G.elapsed % 1.6) / 1.6;
  ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - pulse)})`;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(half, half, 6 + pulse * 9, 0, Math.PI * 2); ctx.stroke();
  drawPlayerArrow(ctx, half, half, p.heading, 1);

  // North sits at the top of the round map (the blit never rotates), and
  // saying so on the glass keeps the arrow's swing readable at a glance.
  ctx.fillStyle = 'rgba(255,248,234,0.85)';
  ctx.font = '700 11px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', half, 15);
}

// ------------------------------------------------------------- the big map
export function drawBigMap() {
  if (!bigCtx) return;
  const g = bigCtx;
  const W = bigCanvas.width, H = bigCanvas.height;
  g.clearRect(0, 0, W, H);

  // Fit the whole world into the canvas with a margin.
  const margin = 30;
  const scale = Math.min((W - margin * 2) / (WORLD.maxX - WORLD.minX), (H - margin * 2) / (WORLD.maxZ - WORLD.minZ));
  const mapW = (WORLD.maxX - WORLD.minX) * scale;
  const mapH = (WORLD.maxZ - WORLD.minZ) * scale;
  const ox = (W - mapW) / 2, oy = (H - mapH) / 2;
  const toMap = (x, z) => [ox + (x - WORLD.minX) * scale, oy + (z - WORLD.minZ) * scale];

  // The chart itself, with a soft edge shadow.
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = 24;
  g.drawImage(staticLayer, 0, 0, staticLayer.width, staticLayer.height, ox, oy, mapW, mapH);
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

  drawRoute(g, toMap, 3.6);
  drawBlips(g, toMap, toMap, true);

  // Landmark glyphs: garage wrench-badge, PAPD shield-star, hospital cross.
  drawBadge(g, toMap(PLACES.garagePad.x, PLACES.garagePad.z), '#e8862e', 'G');
  drawShield(g, toMap(PLACES.policeStation.x, PLACES.policeStation.z));
  drawCross(g, toMap(PLACES.hospital.x, PLACES.hospital.z));
  // The lighthouse point itself is already painted on the static layer, and
  // the district label names it — no second caption crowding the corner.

  // The objective diamond + its distance pill.
  const marker = drawObjective(g, toMap, toMap, true);
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

  // The player: pulse ring + arrow, larger than life.
  const [pxx, pyy] = toMap(G.player.x, G.player.z);
  const pulse = (G.elapsed % 1.6) / 1.6;
  g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - pulse)})`;
  g.lineWidth = 2;
  g.beginPath(); g.arc(pxx, pyy, 8 + pulse * 12, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.beginPath(); g.arc(pxx, pyy, 9, 0, Math.PI * 2); g.stroke();
  drawPlayerArrow(g, pxx, pyy, G.player.heading, 1.35);

  // North arrow, top-right of the chart.
  g.fillStyle = 'rgba(255,248,234,0.9)';
  g.font = '700 13px "Segoe UI", Arial, sans-serif';
  g.fillText('N', ox + mapW - 16, oy + 20);
  g.beginPath();
  g.moveTo(ox + mapW - 16, oy + 26); g.lineTo(ox + mapW - 11, oy + 38); g.lineTo(ox + mapW - 21, oy + 38);
  g.closePath(); g.fill();
}

function drawBadge(g, [mx, my], color, letter) {
  g.save();
  g.fillStyle = color;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(mx, my, 8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#ffffff';
  g.font = '900 11px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(letter, mx, my + 4);
  g.restore();
}

function drawShield(g, [mx, my]) {
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

function drawCross(g, [mx, my]) {
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

// minimap.js — Puerto Alba on paper: the corner minimap and the full city
// map. Districts are painted from the real DISTRICTS rectangles in their
// tints, POIs are glyphs drawn from real PLACES data, and the route is a
// road-following line along the boulevard to the live objective.

import { G } from './state.js';
import { clamp, dist2d } from './util.js';
import { DISTRICTS, PLACES, ROADS_X, ROADS_Z, BOULEVARD_X, BEACH_X, CITY_BOUNDS, districtAt } from './city.js';
import { objectivePoint } from './missions.js';

let _mini = null, _miniCtx = null, _big = null, _bigCtx = null;
const ROUTE_LANE_X = BOULEVARD_X - 4; // the boulevard's far lane, -216

export function initMinimap() {
  _mini = document.getElementById('minimap');
  if (_mini) _miniCtx = _mini.getContext('2d');
  _big = document.getElementById('bigmap');
  if (_big) _bigCtx = _big.getContext('2d');
}

// The driving route: along the player's road to the boulevard lane, down
// the boulevard to the objective's latitude, then in to the objective.
// Its length is the number the distance pill shows.
export function currentRoute() {
  const obj = objectivePoint();
  if (!obj || !G.player) return null;
  const px = G.player.car ? G.player.car.x : G.player.x;
  const pz = G.player.car ? G.player.car.z : G.player.z;
  let roadZ = ROADS_Z[0], best = Infinity;
  for (const rz of ROADS_Z) {
    const d = Math.abs(rz - pz);
    if (d < best) { best = d; roadZ = rz; }
  }
  const points = [
    { x: px, z: pz },
    { x: ROUTE_LANE_X, z: pz },
    { x: ROUTE_LANE_X, z: obj.z },
    { x: obj.x, z: obj.z },
  ];
  const dist = Math.abs(px - ROUTE_LANE_X) + Math.abs(obj.z - roadZ);
  return { points, dist: Math.round(dist), objective: obj };
}

// Paint the shared base: bay, district tints, plaza greens, road grid.
function paintBase(ctx, toMap, view) {
  const B = CITY_BOUNDS;
  // Bay water with depth rings hugging the shore.
  const [wx, wy] = toMap(B.minX - 60, B.minZ);
  const [wx2, wy2] = toMap(BEACH_X, B.maxZ);
  ctx.fillStyle = '#7fb8d8';
  ctx.fillRect(wx, wy, wx2 - wx, wy2 - wy);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.4;
  for (let i = 1; i <= 3; i++) {
    const [rx] = toMap(BEACH_X - i * 9, 0);
    ctx.beginPath();
    ctx.moveTo(rx, wy);
    ctx.lineTo(rx, wy2);
    ctx.stroke();
  }
  // Land base.
  const [lx, ly] = toMap(BEACH_X, B.minZ);
  const [lx2, ly2] = toMap(B.maxX, B.maxZ);
  ctx.fillStyle = '#d9c9a3';
  ctx.fillRect(lx, ly, lx2 - lx, ly2 - ly);
  // District tints.
  for (const d of DISTRICTS) {
    const [x1, y1] = toMap(d.minX, d.minZ);
    const [x2, y2] = toMap(d.maxX, d.maxZ);
    ctx.fillStyle = d.tint;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.globalAlpha = 1;
  }
  // Beach sand strip.
  const [sx1, sy1] = toMap(B.minX, B.minZ);
  const [sx2] = toMap(BEACH_X, B.minZ);
  ctx.fillStyle = '#ecd29a';
  ctx.fillRect(sx1, sy1, sx2 - sx1, ly2 - ly);
  // Plaza greens from the live city data.
  if (G.city) {
    ctx.fillStyle = '#79b264';
    for (const p of G.city.plazas) {
      if (!p.green) continue;
      const [x1, y1] = toMap(p.x - p.w / 2, p.z - p.d / 2);
      const [x2, y2] = toMap(p.x + p.w / 2, p.z + p.d / 2);
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
  }
  // Roads.
  ctx.strokeStyle = '#f4efe2';
  ctx.lineWidth = Math.max(1.4, (view.scale || 1) * 3.2);
  ctx.beginPath();
  for (const lx of [...ROADS_X, BOULEVARD_X]) {
    const [x, y1] = toMap(lx, B.minZ);
    const [, y2] = toMap(lx, B.maxZ);
    ctx.moveTo(x, y1); ctx.lineTo(x, y2);
  }
  for (const lz of ROADS_Z) {
    const [x1, y] = toMap(B.minX, lz);
    const [x2] = toMap(B.maxX, lz);
    ctx.moveTo(x1, y); ctx.lineTo(x2, y);
  }
  ctx.stroke();
  // Marina piers.
  ctx.strokeStyle = '#8a7355';
  ctx.lineWidth = Math.max(1.2, (view.scale || 1) * 1.6);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const [x1, y] = toMap(-252, 194 + i * 12.5);
    const [x2] = toMap(-269, 194 + i * 12.5);
    ctx.moveTo(x1, y); ctx.lineTo(x2, y);
  }
  ctx.stroke();
}

function drawPlayerArrow(ctx, x, y, heading, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#20303c';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, -8 * scale);
  ctx.lineTo(5.4 * scale, 6.4 * scale);
  ctx.lineTo(0, 3.4 * scale);
  ctx.lineTo(-5.4 * scale, 6.4 * scale);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawObjective(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffb340';
  ctx.strokeStyle = '#7a4a08';
  ctx.lineWidth = 1.2;
  const s = 5.6 * scale;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.strokeRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}

export function drawMinimap() {
  if (!_miniCtx || !G.player) return;
  const ctx = _miniCtx;
  const W = _mini.width, H = _mini.height;
  const scale = 1.05; // px per metre
  const px = G.player.x, pz = G.player.z;
  const toMap = (x, z) => [W / 2 + (x - px) * scale, H / 2 + (z - pz) * scale];
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, W / 2 - 2, 0, 7);
  ctx.clip();
  ctx.fillStyle = '#20303c';
  ctx.fillRect(0, 0, W, H);
  paintBase(ctx, toMap, { scale });
  // Police dots.
  for (const c of G.cars) {
    if (c.typeKey !== 'cruiser' || c.dead) continue;
    const [x, y] = toMap(c.x, c.z);
    ctx.fillStyle = '#2a7fff';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
  }
  const obj = objectivePoint();
  if (obj) {
    const [x, y] = toMap(obj.x, obj.z);
    if (x > -10 && x < W + 10 && y > -10 && y < H + 10) drawObjective(ctx, x, y, 0.9);
  }
  ctx.restore();
  // Compass tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', W / 2, 14);
  drawPlayerArrow(ctx, W / 2, H / 2, G.player.heading, 1);
}

// --- The big map -------------------------------------------------------------

function glyphCircle(ctx, x, y, r, fill, label, labelColor) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,26,34,0.65)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  if (label) {
    ctx.fillStyle = labelColor || '#ffffff';
    ctx.font = `bold ${r * 1.15}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 0.5);
  }
}

function glyphFlag(ctx, x, y, s) {
  ctx.strokeStyle = '#20303c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y - s); ctx.stroke();
  const cell = s / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#20303c' : '#ffffff';
    ctx.fillRect(x + i * cell, y - s + j * cell, cell, cell);
  }
}

function glyphAnchor(ctx, x, y, s) {
  ctx.strokeStyle = '#20506e';
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(x, y - s * 0.55, s * 0.28, 0, 7); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.3); ctx.lineTo(x, y + s * 0.7);
  ctx.moveTo(x - s * 0.6, y + s * 0.1); ctx.lineTo(x + s * 0.6, y + s * 0.1);
  ctx.moveTo(x - s * 0.6, y + s * 0.1); ctx.lineTo(x - s * 0.45, y + s * 0.65);
  ctx.moveTo(x + s * 0.6, y + s * 0.1); ctx.lineTo(x + s * 0.45, y + s * 0.65);
  ctx.stroke();
}

function glyphLighthouse(ctx, x, y, s) {
  ctx.fillStyle = '#f4f1e8';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y + s);
  ctx.lineTo(x - s * 0.25, y - s * 0.6);
  ctx.lineTo(x + s * 0.25, y - s * 0.6);
  ctx.lineTo(x + s * 0.4, y + s);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c23b2e';
  ctx.fillRect(x - s * 0.32, y - s * 0.05, s * 0.64, s * 0.3);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath(); ctx.arc(x, y - s * 0.78, s * 0.2, 0, 7); ctx.fill();
}

function glyphCross(ctx, x, y, s) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(x, y, s * 0.95, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(20,26,34,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#d8402e';
  ctx.fillRect(x - s * 0.18, y - s * 0.55, s * 0.36, s * 1.1);
  ctx.fillRect(x - s * 0.55, y - s * 0.18, s * 1.1, s * 0.36);
}

function glyphShield(ctx, x, y, s) {
  ctx.fillStyle = '#274b63';
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.8, y - s * 0.55);
  ctx.lineTo(x + s * 0.8, y + s * 0.2);
  ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.8, x, y + s);
  ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.8, x - s * 0.8, y + s * 0.2);
  ctx.lineTo(x - s * 0.8, y - s * 0.55);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.font = `bold ${s}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('P', x, y);
}

export function drawBigMap() {
  if (!_bigCtx) return;
  const ctx = _bigCtx;
  const W = _big.width, H = _big.height;
  const B = CITY_BOUNDS;
  const pad = 26;
  const scale = Math.min((W - pad * 2) / (B.maxX - B.minX + 60), (H - pad * 2) / (B.maxZ - B.minZ));
  const ox = pad + 30 * scale, oy = pad;
  const toMap = (x, z) => [ox + (x - B.minX) * scale, oy + (z - B.minZ) * scale];
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(0, 0, W, H);
  paintBase(ctx, toMap, { scale });

  // District labels, once each, centred on their rectangles.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const d of DISTRICTS) {
    const [x, y] = toMap((d.minX + d.maxX) / 2, (d.minZ + d.maxZ) / 2);
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(24,30,40,0.75)';
    const label = d.name.toUpperCase();
    ctx.strokeText(label, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x, y);
  }

  // Route and its distance pill.
  const route = currentRoute();
  if (route) {
    ctx.strokeStyle = '#ffb340';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    route.points.forEach((p, i) => {
      const [x, y] = toMap(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    const end = route.points[route.points.length - 1];
    const [ex, ey] = toMap(end.x, end.z);
    const label = `${route.dist} m`;
    ctx.font = 'bold 13px system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 16;
    ctx.fillStyle = '#141a22';
    ctx.beginPath();
    ctx.roundRect(ex - tw / 2, ey + 12, tw, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(label, ex, ey + 23.5);
    drawObjective(ctx, ex, ey, 1.1);
  }

  // POI glyphs from real PLACES.
  const P = PLACES;
  const at = (p) => toMap(p.x, p.z);
  let [x, y] = at(P.marisol);
  glyphCircle(ctx, x, y, 9, '#e8a33c', 'M', '#3a2a05');
  [x, y] = at(P.raceStart);
  glyphFlag(ctx, x, y, 10);
  [x, y] = at(P.marina);
  glyphAnchor(ctx, x, y, 10);
  [x, y] = at(P.lighthouse);
  glyphLighthouse(ctx, x, y, 10);
  [x, y] = at(P.garage);
  glyphCircle(ctx, x, y, 9, '#5a6a76', 'G');
  [x, y] = at(P.papd);
  glyphShield(ctx, x, y, 10);
  [x, y] = at(P.hospital);
  glyphCross(ctx, x, y, 10);
  [x, y] = at(P.clockTower);
  glyphCircle(ctx, x, y, 7, '#e8d9b0', '◷', '#4a3b28');

  // Police dots and the player.
  for (const c of G.cars) {
    if (c.typeKey !== 'cruiser' || c.dead) continue;
    const [cx2, cy2] = toMap(c.x, c.z);
    ctx.fillStyle = '#e0482e';
    ctx.beginPath(); ctx.arc(cx2, cy2, 4, 0, 7); ctx.fill();
  }
  if (G.player) {
    const [px2, py2] = toMap(G.player.x, G.player.z);
    drawPlayerArrow(ctx, px2, py2, G.player.heading, 1.15);
  }

  // Compass rose.
  const cxr = W - 44, cyr = 44;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cxr, cyr, 17, 0, 7); ctx.stroke();
  ctx.fillStyle = '#ffb340';
  ctx.beginPath();
  ctx.moveTo(cxr, cyr - 14); ctx.lineTo(cxr + 4.4, cyr + 2); ctx.lineTo(cxr - 4.4, cyr + 2);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.fillText('N', cxr, cyr - 24);

  // Header district: where the route is taking you.
  const headEl = document.getElementById('bigmap-district');
  if (headEl) {
    const obj = objectivePoint();
    headEl.textContent = obj ? districtAt(obj.x, obj.z).name.toUpperCase() : (G.district || 'PUERTO ALBA').toUpperCase();
  }
}

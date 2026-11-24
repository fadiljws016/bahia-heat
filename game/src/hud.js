// hud.js — every panel the screenshots are judged by: mission card,
// PAPD dispatch, cash/respect/stars, weapon slots, health and armour,
// the radio line, the dialogue box, the speedo and the district caption.
// buildHud caches the DOM once; updateHud writes only what changed.

import { G } from './state.js';
import { RANKS } from './state.js';
import { formatClock, formatDayTime, clamp } from './util.js';
import { missionPanelInfo } from './missions.js';
import { dispatchInfo } from './police.js';
import { WEAPONS, SLOT_ORDER } from './combat.js';
import { currentStation } from './audio.js';
import { districtAt } from './city.js';

const el = {};
const last = {};
let _weaponSig = '';

function $(id) { return document.getElementById(id); }

function setText(id, value) {
  if (last[id] === value) return;
  last[id] = value;
  if (el[id]) el[id].textContent = value;
}

function setShow(id, on) {
  const key = `show:${id}`;
  if (last[key] === on) return;
  last[key] = on;
  if (el[id]) el[id].style.display = on ? '' : 'none';
}

function setBar(id, frac) {
  const key = `bar:${id}`;
  const v = Math.round(frac * 200);
  if (last[key] === v) return;
  last[key] = v;
  if (el[id]) el[id].style.width = `${clamp(frac, 0, 1) * 100}%`;
}

export function buildHud() {
  const ids = [
    'mission-panel', 'mission-title', 'mission-stage', 'mission-objective', 'mission-next', 'mission-timer',
    'dispatch-panel', 'dispatch-rows', 'clock', 'cash', 'respect-line', 'stars',
    'weapons', 'health-fill', 'armor-fill', 'radio-line',
    'dialogue', 'dlg-name', 'dlg-text', 'speedo', 'speed-val', 'car-name', 'condition-fill',
    'district-caption', 'interact', 'garage-panel', 'wanted-label',
  ];
  for (const id of ids) el[id] = $(id);
  // Weapon slots are built once; updateHud only repaints their state.
  if (el.weapons) {
    el.weapons.innerHTML = '';
    SLOT_ORDER.forEach((key, i) => {
      const w = WEAPONS[key];
      const slot = document.createElement('div');
      slot.className = 'wslot';
      slot.id = `wslot-${key}`;
      slot.innerHTML = `<div class="wkey">${i + 1}</div><div class="wicon">${weaponGlyph(key)}</div>` +
        `<div class="wname">${w.name}</div><div class="wammo"></div>`;
      el.weapons.appendChild(slot);
    });
  }
}

// Tiny inline-SVG weapon silhouettes — they render identically everywhere,
// unlike emoji, which some systems draw as empty boxes.
function weaponGlyph(key) {
  const fill = '#e8e3d5';
  if (key === 'fists') {
    return `<svg width="30" height="20" viewBox="0 0 30 20"><g fill="${fill}">` +
      '<rect x="3" y="6" width="5" height="9" rx="2"/><rect x="9" y="3" width="5" height="12" rx="2"/>' +
      '<rect x="15" y="4" width="5" height="11" rx="2"/><rect x="21" y="7" width="5" height="8" rx="2"/></g></svg>';
  }
  if (key === 'pistol') {
    return `<svg width="34" height="20" viewBox="0 0 34 20"><g fill="${fill}">` +
      '<rect x="2" y="5" width="24" height="5" rx="1"/><rect x="20" y="3" width="6" height="4"/>' +
      '<rect x="6" y="9" width="6" height="10" rx="1" transform="rotate(12 9 9)"/></g></svg>';
  }
  if (key === 'smg') {
    return `<svg width="40" height="20" viewBox="0 0 40 20"><g fill="${fill}">` +
      '<rect x="2" y="6" width="30" height="5" rx="1"/><rect x="32" y="7" width="7" height="3"/>' +
      '<rect x="16" y="10" width="5" height="9"/><rect x="5" y="9" width="5" height="7" rx="1"/></g></svg>';
  }
  return `<svg width="44" height="20" viewBox="0 0 44 20"><g fill="${fill}">` +
    '<rect x="10" y="7" width="33" height="4" rx="2"/><rect x="14" y="10" width="9" height="4" rx="1"/>' +
    '<path d="M1 6 L11 6 L11 12 L3 13 Z"/></g></svg>';
}

export function setInteract(text) {
  G.interactText = text || '';
}

export function showGaragePanel(on) { G.garageOpen = on; }

function updateWeapons() {
  const sig = SLOT_ORDER.map((k) => `${G.unlocked[k] ? 1 : 0}:${G.ammo[k] || 0}:${G.weapon === k ? 1 : 0}`).join('|');
  if (sig === _weaponSig) return;
  _weaponSig = sig;
  for (const key of SLOT_ORDER) {
    const slot = el[`wslot-${key}`] || $(`wslot-${key}`);
    if (!slot) continue;
    el[`wslot-${key}`] = slot;
    slot.classList.toggle('active', G.weapon === key);
    slot.classList.toggle('locked', !G.unlocked[key]);
    const ammo = slot.querySelector('.wammo');
    if (ammo) ammo.textContent = !G.unlocked[key] ? 'LOCKED' : key === 'fists' ? '∞' : String(G.ammo[key] || 0);
  }
}

function updateDispatch() {
  const rows = (G.wanted > 0.3 || G.shotMode) ? dispatchInfo() : [];
  setShow('dispatch-panel', rows.length > 0);
  if (!rows.length) return;
  const sig = rows.map((r) => `${r.label}${r.dist}${r.role}`).join('|');
  if (last.dispatchSig === sig) return;
  last.dispatchSig = sig;
  if (el['dispatch-rows']) {
    el['dispatch-rows'].innerHTML = rows.map((r) =>
      `<div class="drow"><span class="dunit">${r.label}${r.label === 'FOOT' ? '' : ''}</span>` +
      `<span class="ddist">${r.dist} m</span><span class="drole">${r.role}</span></div>`).join('') +
      (G.heliSeesPlayer || G.wanted >= 2 ? '<div class="dair">FALCON-1 · AIR SUPPORT<br>ACTIVE</div>' : '');
  }
}

export function updateHud(dt) {
  if (!el['mission-panel']) return;
  // Mission card.
  const info = missionPanelInfo();
  setShow('mission-panel', !!info && !G.mapOpen);
  if (info) {
    setText('mission-title', info.title);
    setText('mission-stage', info.stage);
    setText('mission-objective', info.objective);
    setText('mission-next', `NEXT ${info.next}`);
    const hasTimer = info.timer !== null && info.timer !== undefined;
    setShow('mission-timer', hasTimer);
    if (hasTimer) setText('mission-timer', formatClock(info.timer));
  }
  updateDispatch();
  // Top-right stack.
  setText('clock', formatDayTime(G.timeHours));
  setText('cash', `$${G.cash}`);
  setText('respect-line', `${RANKS[G.rankIndex].name} · Respect ${G.respect}`);
  const stars = Math.round(G.wanted);
  setText('stars', '★★★★★'.slice(0, stars) + '☆☆☆☆☆'.slice(0, 5 - stars));
  setShow('wanted-label', G.wanted >= 1);
  if (G.wanted >= 1) setText('wanted-label', G.wanted >= 4 ? 'HEAT' : 'SEARCHING');
  // Bars and weapons.
  setBar('health-fill', G.health / 100);
  setBar('armor-fill', G.armor / 100);
  updateWeapons();
  // Radio.
  const st = currentStation();
  setText('radio-line', `${st.name} · ${st.song}`);
  // Dialogue.
  const d = G.dialogue;
  setShow('dialogue', !!d);
  if (d) {
    const line = d.lines[Math.min(d.index, d.lines.length - 1)];
    setText('dlg-name', line.who);
    setText('dlg-text', line.text);
  }
  // Speedo while driving.
  const car = G.player && G.player.car;
  setShow('speedo', !!car);
  if (car) {
    setText('speed-val', String(Math.round(Math.abs(car.speed) * 3.6)));
    setText('car-name', car.type.name);
    setBar('condition-fill', car.hp / car.maxHp);
  }
  // District caption + interact prompt.
  if (G.player) {
    const dist = districtAt(G.player.x, G.player.z).name;
    if (dist !== G.district) {
      G.district = dist;
      setText('district-caption', dist.toUpperCase());
    }
  }
  setShow('interact', !!G.interactText && !G.dialogue);
  if (G.interactText) setText('interact', G.interactText);
  setShow('garage-panel', !!G.garageOpen);
}

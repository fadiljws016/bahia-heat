// hud.js — every piece of chrome over the 3D view: mission panel,
// PAPD dispatch feed, cash/respect/rank, wanted stars, the clock, weapon
// slots, health and armor, the dialogue box, the speedo, the district
// caption and the corner minimap. It only reads G and paints DOM.

import { G, RANKS } from './state.js';
import { CHARACTERS } from './story.js';
import { missionPanelInfo } from './missions.js';
import { dispatchInfo } from './police.js';
import { districtAt } from './city.js';
import { currentStation } from './audio.js';
import { formatClock, formatDayTime } from './util.js';
import { drawMinimap, drawBigMap } from './minimap.js';
import { SLOT_ORDER, WEAPONS } from './combat.js';

const el = {};
let interactText = '';
let lastDistrict = '';

function grab(id) {
  el[id] = document.getElementById(id);
  return el[id];
}

export function buildHud() {
  const ids = [
    'mission-panel', 'mp-title', 'mp-stage', 'mp-objective', 'mp-next', 'mp-timer',
    'dispatch-panel', 'dispatch-rows', 'cash-value', 'respect-value', 'rank-name',
    'clock-value', 'wanted-stars', 'health-fill', 'armor-fill', 'dialogue-box',
    'dlg-name', 'dlg-text', 'interact-prompt', 'speedo', 'speed-value', 'speed-car',
    'speed-cond-fill', 'district-name', 'toast', 'garage-panel', 'garage-list',
    'map-overlay', 'map-district', 'radio-line', 'slot-fists', 'slot-pistol',
    'slot-smg', 'slot-shotgun', 'end-overlay', 'end-title',
  ];
  for (const id of ids) grab(id);
}

export function setInteract(text) {
  interactText = text || '';
}

export function showGaragePanel(on) {
  if (el['garage-panel']) el['garage-panel'].style.display = on ? 'block' : 'none';
  if (on && el['garage-list']) {
    const prices = { sedan: 900, sport: 2400, taxi: 1100, truck: 1600, cruiser: 0 };
    el['garage-list'].innerHTML = Object.entries(prices)
      .filter(([, v]) => v > 0)
      .map(([k, v], i) => `<div class="garage-row"><span>${i + 1} · ${k.toUpperCase()}</span><b>$${v}</b></div>`)
      .join('') + '<div class="garage-hint">Number keys buy · E closes</div>';
  }
}

function starsText() {
  const full = Math.round(G.wanted);
  let s = '';
  for (let i = 0; i < 5; i += 1) s += i < full ? '★' : '☆';
  return s;
}

export function updateHud(dt) {
  if (!el['cash-value']) return;
  const p = G.player;
  el['cash-value'].textContent = `$${G.cash}`;
  el['respect-value'].textContent = `Respect ${G.respect}`;
  el['rank-name'].textContent = RANKS[G.rankIndex].name;
  el['clock-value'].textContent = formatDayTime(G.timeHours);
  el['wanted-stars'].textContent = starsText();
  el['wanted-stars'].style.opacity = G.wanted > 0.2 ? '1' : '0.25';
  const st = currentStation();
  el['radio-line'].textContent = `Radio Alba 98.4 · "${st.style}" — Los Faros`;

  // Mission panel.
  const info = missionPanelInfo();
  if (info && !G.shotMode) el['mission-panel'].style.display = 'block';
  if (info) {
    el['mission-panel'].style.display = 'block';
    el['mp-title'].textContent = info.title;
    el['mp-stage'].textContent = info.stage;
    el['mp-objective'].textContent = info.objective;
    el['mp-next'].innerHTML = info.next ? `<span class="next-tag">NEXT</span> ${info.next}` : '';
    if (info.timer !== null && info.timer !== undefined) {
      el['mp-timer'].style.display = 'block';
      el['mp-timer'].textContent = formatClock(info.timer);
    } else el['mp-timer'].style.display = 'none';
  } else el['mission-panel'].style.display = 'none';

  // Dispatch feed (only while wanted).
  if (G.wanted >= 1) {
    el['dispatch-panel'].style.display = 'block';
    const rows = dispatchInfo();
    el['dispatch-rows'].innerHTML = rows
      .map((r) => `<div class="drow"><span>${r.unit} · ${r.dist} m</span><b>${r.role}</b></div>`)
      .join('') + (G.heliSeesPlayer ? '<div class="drow air"><span>FALCON-1 · AIR SUPPORT</span><b>ACTIVE</b></div>' : '');
  } else el['dispatch-panel'].style.display = 'none';

  // Vitals.
  if (p) {
    el['health-fill'].style.width = `${Math.max(0, p.hp)}%`;
    el['armor-fill'].style.width = `${Math.max(0, p.armor)}%`;
  }

  // Weapon slots.
  for (const key of SLOT_ORDER) {
    const slot = el[`slot-${key}`];
    if (!slot) continue;
    const unlocked = G.weapons.unlocked[key];
    slot.classList.toggle('active', G.weapons.current === key);
    slot.classList.toggle('locked', !unlocked);
    const ammoEl = slot.querySelector('.wammo');
    if (ammoEl) {
      ammoEl.textContent = !unlocked ? 'LOCKED' : key === 'fists' ? '∞' : `${G.weapons.ammo[WEAPONS[key].ammo]}`;
    }
  }

  // Dialogue.
  const d = G.dialogue;
  if (d && d.lines[d.index]) {
    const [who, text] = d.lines[d.index];
    const ch = CHARACTERS[who] || CHARACTERS.marisol;
    el['dialogue-box'].style.display = 'block';
    el['dlg-name'].textContent = ch.name;
    el['dlg-name'].style.color = `#${ch.color.toString(16).padStart(6, '0')}`;
    el['dlg-text'].textContent = text;
    const badge = el['dialogue-box'].querySelector('.dlg-badge');
    if (badge) {
      badge.textContent = ch.initials;
      badge.style.background = `#${ch.color.toString(16).padStart(6, '0')}`;
    }
  } else el['dialogue-box'].style.display = 'none';

  // Interact prompt + toast.
  el['interact-prompt'].style.display = interactText ? 'block' : 'none';
  if (interactText) el['interact-prompt'].textContent = interactText;
  if (G.messageT > 0) {
    G.messageT -= dt;
    el['toast'].style.display = 'block';
    el['toast'].textContent = G.message;
  } else el['toast'].style.display = 'none';

  // Speedo while driving.
  if (p && p.car) {
    el['speedo'].style.display = 'block';
    el['speed-value'].innerHTML = `${Math.round(Math.abs(p.car.speed) * 3.6)} <small>km/h</small>`;
    el['speed-car'].textContent = p.car.spec.name;
    el['speed-cond-fill'].style.width = `${Math.max(0, (p.car.hp / p.car.spec.hp) * 100)}%`;
  } else el['speedo'].style.display = 'none';

  // District caption + maps.
  if (p) {
    const dName = districtAt(p.x, p.z).name;
    if (dName !== lastDistrict) {
      lastDistrict = dName;
      el['district-name'].textContent = dName.toUpperCase();
      if (el['map-district']) el['map-district'].textContent = dName.toUpperCase();
    }
  }
  drawMinimap();
  if (G.mapOpen) {
    el['map-overlay'].style.display = 'block';
    drawBigMap();
  } else el['map-overlay'].style.display = 'none';

  // End overlay.
  if (G.over) {
    el['end-overlay'].style.display = 'flex';
    el['end-title'].textContent = G.message && G.message.startsWith('BUSTED') ? 'BUSTED' : 'WASTED';
  }
}

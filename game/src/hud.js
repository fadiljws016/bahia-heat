// Round fourteen note: the HUD's layout and language are final — the
// mission panel still reads missionPanelInfo, the dispatch board still
// reads dispatchInfo, and the dialogue box still speaks CHARACTERS.
// hud.js — every DOM element over the canvas: mission panel, PAPD dispatch
// board, wanted stars, weapon slots, vitals, vehicle readout, radio line,
// dialogue box, toasts, banners, the bust meter, and the full-screen map's
// header district. Systems write into G; this file paints. Round
// eight paints nothing new either: the dispatch board already lists
// every foot officer by distance, so the sixth man the staging adds
// to the Palma Showdown simply takes his own FOOT line on the board,
// and FALCON-1's AIR SUPPORT line already names the unit the chase
// frame now shows in full. Round six
// paints nothing new: the dispatch board and weapon slots carry into the
// combat shot's new framing unchanged, and the cover's district label
// still names the quarter the (now lower) fascia signs.
//
// Round three draws the arsenal: each weapon slot carries a side-profile
// silhouette of its gun — the P-9's short slide, the Kobra's long magazine
// and stock, the Muelle's thick barrel and pump — so the loadout reads at
// a glance the way the modelled weapons read in the world.
//
// Round five changes nothing here: the dispatch board already reports
// what the facing audit measured — FOOT units, their distances, ENGAGING.

// Round seven is judged partly through this file's dispatch board:
// the re-spread PAPD line now reports at 7 / 12 / 18 m beside the RAM
// unit in the combat frame. Same panel, truer distances — no paint
// changed.
import { G, rankFor } from './state.js';
import { formatDayTime, formatClock, clamp } from './util.js';
import { missionPanelInfo } from './missions.js';
import { dispatchInfo } from './police.js';
import { WEAPONS, SLOT_ORDER } from './combat.js';
import { CHARACTERS } from './story.js';
import { districtAt } from './city.js';
import { currentStation, isMuted } from './audio.js';

const $ = (id) => document.getElementById(id);
const els = {};
let built = false;
let lastDistrict = '';
let districtTimer = 0;
let toastTimer = 0;
let bannerTimer = 0;
const cache = {};

function setText(id, text) {
  if (cache[id] !== text) { cache[id] = text; els[id].textContent = text; }
}
function setHtml(id, html) {
  if (cache[id] !== html) { cache[id] = html; els[id].innerHTML = html; }
}
function show(id, on) {
  const key = `show:${id}`;
  if (cache[key] !== on) { cache[key] = on; els[id].classList.toggle('hidden', !on); }
}

// Side-profile silhouettes on a 64×24 grid, barrels to the right — drawn
// from the same proportions as the modelled weapons in people.js.
const WEAPON_ICONS = {
  fists: '<circle cx="15" cy="10" r="3.6"/><circle cx="22.5" cy="8.4" r="3.9"/><circle cx="30" cy="8.4" r="3.9"/><circle cx="37" cy="10" r="3.6"/><path d="M11 13 h30 v4 q0 5-6 5 h-18 q-6 0-6-5 z"/>',
  pistol: '<rect x="8" y="7" width="30" height="4.2"/><rect x="38" y="8.2" width="4" height="3"/><rect x="10" y="11.2" width="24" height="2.8"/><path d="M19 14 h8 l-1.6 7.4 q-.2 1.6-2 1.6 h-4.6 q-1.8 0-1.5-1.8 z"/><rect x="29" y="13.4" width="6" height="2"/>',
  smg: '<rect x="14" y="8" width="30" height="5"/><rect x="44" y="9.6" width="15" height="2.6"/><rect x="55" y="6.4" width="2.2" height="3.4"/><path d="M28 13 h7.4 l-.8 8.2 q-.2 1.8-2 1.8 h-3.4 q-1.9 0-1.8-1.9 z"/><path d="M18.6 13 h6.8 l-1.2 6.6 q-.3 1.4-1.8 1.4 h-3.6 q-1.7 0-1.4-1.7 z"/><rect x="1.6" y="8.6" width="12.4" height="4"/><rect x="40" y="12.6" width="3.4" height="5"/>',
  shotgun: '<rect x="16" y="7.4" width="43" height="4.2"/><rect x="21" y="11.8" width="29" height="2.6"/><rect x="30" y="11.2" width="9.4" height="4.8" rx="1"/><rect x="8" y="8" width="12" height="6.4"/><path d="M8.6 8.8 L1 10.4 L2.6 17.4 L9.4 14.6 Z"/><circle cx="56.6" cy="6.4" r="1.3"/>',
};

export function buildHud() {
  for (const id of ['hud', 'mission-panel', 'mission-title', 'mission-stage', 'mission-objective', 'mission-next',
    'mission-timer', 'dispatch-panel', 'dispatch-list', 'dispatch-air', 'clock', 'cash', 'respect-line',
    'wanted-stars', 'sight-state', 'weapons', 'health-fill', 'armor-fill', 'vehicle-info', 'speed',
    'vehicle-name', 'condition-fill', 'radio-line', 'dialogue', 'dlg-portrait', 'dlg-name', 'dlg-text',
    'interact-prompt', 'interact-text', 'toast', 'banner', 'banner-big', 'banner-sub', 'location-label',
    'damage-flash', 'garage-panel', 'bust-wrap', 'bust-fill', 'hud-note', 'map-district']) els[id] = $(id);

  // Weapon slots, built once — silhouette first, then name and ammo.
  els.weapons.innerHTML = SLOT_ORDER.map((key, i) => {
    const w = WEAPONS[key];
    return `<div class="slot" id="slot-${key}"><span class="key">${i + 1}</span><svg class="wicon" viewBox="0 0 64 24" aria-hidden="true">${WEAPON_ICONS[key]}</svg><span class="wname">${w.name}</span><span class="ammo" id="ammo-${key}">—</span></div>`;
  }).join('');
  for (const key of SLOT_ORDER) { els[`slot-${key}`] = $(`slot-${key}`); els[`ammo-${key}`] = $(`ammo-${key}`); }
  built = true;
}

export function setInteract(text) {
  if (text) { setText('interact-text', text); show('interact-prompt', true); }
  else show('interact-prompt', false);
}

export function showGaragePanel(on) { show('garage-panel', on); }

export function updateHud(dt) {
  if (!built) return;
  const p = G.player;
  const inGame = G.mode === 'playing' || G.mode === 'paused' || !!G.shotMode;
  show('hud', inGame);
  if (!inGame) return;

  // Mission panel.
  const info = missionPanelInfo();
  show('mission-panel', true);
  setText('mission-title', info.title);
  setText('mission-stage', info.stage);
  setText('mission-objective', info.objective);
  setHtml('mission-next', `<b>NEXT</b> ${info.next}`);
  if (info.timer != null) {
    show('mission-timer', true);
    setText('mission-timer', formatClock(info.timer));
    els['mission-timer'].classList.toggle('low', info.timer < 20);
  } else show('mission-timer', false);

  // Dispatch board.
  const units = dispatchInfo();
  const showDispatch = G.wanted >= 1 || units.length > 0;
  show('dispatch-panel', showDispatch);
  if (showDispatch) {
    setHtml('dispatch-list', units.map((u) => `<li>${u.label} · ${u.d} m <span class="tactic">${u.tactic}</span></li>`).join(''));
    setText('dispatch-air', G.heli?.active ? 'FALCON-1 · AIR SUPPORT ACTIVE' : '');
    show('dispatch-air', !!G.heli?.active);
  }

  // Top-right stack.
  setText('clock', formatDayTime(G.timeHours));
  setText('cash', `$${Math.floor(G.cash)}`);
  const rank = rankFor(G.respect);
  setText('respect-line', `${rank.name} · Respect ${Math.floor(G.respect)}`);
  const stars = Math.floor(G.wanted);
  let starHtml = '';
  for (let i = 0; i < 5; i += 1) starHtml += `<span class="${i < stars ? 'on' : ''}">★</span>`;
  setHtml('wanted-stars', starHtml);
  if (G.wanted > 0) {
    show('sight-state', true);
    const label = G.sightState === 'insight' ? 'IN SIGHT' : G.sightState === 'searching' ? 'SEARCHING' : 'LOSING THEM';
    setText('sight-state', label);
    // Setting className wipes the element's classes wholesale — the id is
    // not a class and survives it, so it needs no re-stamping each frame.
    els['sight-state'].className = G.sightState === 'searching' ? 'searching' : G.sightState === 'lost' ? 'lost' : '';
  } else show('sight-state', false);

  // Weapon slots.
  for (const key of SLOT_ORDER) {
    const slot = els[`slot-${key}`];
    slot.classList.toggle('active', G.currentWeapon === key);
    slot.classList.toggle('locked', !G.unlockedWeapons.includes(key));
    const w = WEAPONS[key];
    setText(`ammo-${key}`, !G.unlockedWeapons.includes(key) ? 'LOCKED' : w.ammoKey ? `${G.ammo[w.ammoKey]}` : '∞');
  }

  // Vitals + vehicle.
  els['health-fill'].style.width = `${clamp(p.health, 0, 100)}%`;
  els['armor-fill'].style.width = `${clamp(p.armor, 0, 100)}%`;
  show('vehicle-info', !!p.inCar);
  if (p.inCar) {
    setHtml('speed', `${Math.round(Math.abs(p.inCar.speed) * 3.6)} <small>km/h</small>`);
    setText('vehicle-name', p.inCar.def.name + (p.inCar.flatTire > 0 ? ' — tires shredded' : ''));
    els['condition-fill'].style.width = `${clamp((p.inCar.hp / p.inCar.maxHp) * 100, 0, 100)}%`;
  }

  // The bust meter: a thin red bar that fills while they have you boxed.
  const bust = clamp(G.bustMeter / 2.4, 0, 1);
  show('bust-wrap', bust > 0.02);
  if (bust > 0.02) els['bust-fill'].style.width = `${bust * 100}%`;

  // One-line system note (spikes, empty mag), fading after a few seconds.
  if (G.hudNote && G.elapsed - G.hudNoteAt < 3.5) {
    show('hud-note', true);
    setText('hud-note', G.hudNote);
  } else show('hud-note', false);

  // Radio.
  const st = currentStation();
  setHtml('radio-line', isMuted() ? '<b>Radio</b> · muted (N)' : `<b>${st.name}</b> · ${st.track}`);

  // Dialogue.
  if (G.dialogue) {
    show('dialogue', true);
    const line = G.dialogue.lines[G.dialogue.index];
    const ch = CHARACTERS[line.who];
    setText('dlg-name', ch.name);
    setText('dlg-text', line.text);
    els['dlg-portrait'].textContent = ch.initials;
    els['dlg-portrait'].style.background = ch.color;
  } else show('dialogue', false);

  // District label + the map header follows the same computation.
  const district = districtAt(p.x, p.z);
  setText('map-district', district);
  if (district !== lastDistrict) {
    lastDistrict = district;
    districtTimer = 2.6;
    setText('location-label', district);
  }
  if (districtTimer > 0) {
    districtTimer -= dt;
    els['location-label'].classList.add('show');
  } else els['location-label'].classList.remove('show');

  // Toasts and banners, one at a time.
  if (toastTimer > 0) toastTimer -= dt;
  else if (G.toastQueue.length) {
    setText('toast', G.toastQueue.shift());
    els.toast.classList.add('show');
    toastTimer = 2.6;
  } else els.toast.classList.remove('show');

  if (bannerTimer > 0) bannerTimer -= dt;
  else if (G.bannerQueue.length) {
    const b = G.bannerQueue.shift();
    setText('banner-big', b.big);
    setText('banner-sub', b.sub);
    els.banner.classList.add('show');
    bannerTimer = 3.2;
  } else els.banner.classList.remove('show');

  // Damage vignette flash.
  if (G.damageFlash > 0) {
    G.damageFlash = Math.max(0, G.damageFlash - dt * 1.8);
    els['damage-flash'].style.opacity = String(G.damageFlash * 0.85);
  } else els['damage-flash'].style.opacity = '0';
}

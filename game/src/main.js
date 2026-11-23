// main.js — Bahia Heat's boot and heartbeat. Builds the city, wires every
// system, runs the frame loop, and owns the mode machine: title menu, play,
// pause, the full-screen map, and the wasted/busted endings. With
// ?shot=<name> it instead stages one frozen scene (shots.js) for the
// maker's screenshots and says so on window.__shotReady when settled.

import { G, MODE } from './state.js';
import { buildCityData, buildCityMeshes, PLACES } from './city.js';
import { initWorld, updateWorld, setBoats, setFerris } from './world.js';
import { initEffects, updateEffects } from './effects.js';
import { initInput, input, endFrame, requestLock } from './input.js';
import { spawnPlayer, updatePlayer, findEnterableCar, hurtPlayer } from './player.js';
import { spawnParkedCars, collideCars, damageCar, HEADLIGHT_MAT, HEADLIGHT_CONE_MAT } from './vehicles.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initPeds, updatePeds, spawnPedAt } from './pedestrians.js';
import { updatePolice, clearWanted, checkBusted } from './police.js';
import { updateOfficers } from './officers.js';
import { initHeli, updateHeli } from './helicopter.js';
import { updateCombat } from './combat.js';
import { updateMissions, advanceDialogue, restartCurrentJob } from './missions.js';
import { buildHud, updateHud, setInteract, showGaragePanel } from './hud.js';
import { initMinimap, drawMinimap, drawBigMap } from './minimap.js';
import { initAudio, sfx, setSiren, cycleStation, toggleMute } from './audio.js';
import { hasSave, readSave, wipeSave, writeSave } from './save.js';
import { stageShotScene, updateShotScene } from './shots.js';
import { updateCamera } from './camera.js';
import { dist2d, clamp, makeRng } from './util.js';

window.__bahia = G; // a handle for the maker's own playtest scripts

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') || 1);
if (shotName) { G.shotMode = shotName; document.body.classList.add('shot'); }

// --------------------------------------------------------------------- boot
G.city = buildCityData(G.seed);
const renderer = initWorld(document.getElementById('app'));
const { boats, ferris } = buildCityMeshes(G.scene, G.city, G.seed);
setBoats(boats);
setFerris(ferris);
initEffects(G.scene);
initHeli();
buildHud();
initMinimap();
initInput(renderer.domElement);

spawnPlayer(PLACES.playerStart.x, PLACES.playerStart.z);
spawnParkedCars(makeRng(1234));
initTraffic();
initPeds();

const $ = (id) => document.getElementById(id);
const fade = $('fade');
const mapScreen = $('map-screen');

function setMapOpen(on) {
  G.mapOpen = on;
  mapScreen.classList.toggle('hidden', !on);
  mapScreen.classList.toggle('open', on);
}

if (G.shotMode) {
  $('start-screen').classList.add('hidden');
  stageShotScene(G.shotMode, shotSeed);
  // Keep the frame clean: no ambient parked car may sit on the camera.
  for (let i = G.parkedCars.length - 1; i >= 0; i -= 1) {
    const car = G.parkedCars[i];
    if (Math.hypot(car.x - G.camera.position.x, car.z - G.camera.position.z) < 8) {
      G.scene.remove(car.mesh);
      G.parkedCars.splice(i, 1);
    }
  }
  setMapOpen(!!G.mapOpen);
  G.mode = MODE.PLAYING;
  fade.style.opacity = '0';
} else {
  $('btn-continue').disabled = !hasSave();
  fade.style.opacity = '0';
}

// -------------------------------------------------------------------- menus
function startGame(fresh) {
  initAudio();
  if (fresh) wipeSave();
  else readSave();
  spawnPlayer(PLACES.playerStart.x, PLACES.playerStart.z);
  G.mode = MODE.PLAYING;
  $('start-screen').classList.add('hidden');
  $('end-screen').classList.add('hidden');
  sfx.chime();
}

$('btn-new').addEventListener('click', () => startGame(true));
$('btn-continue').addEventListener('click', () => startGame(false));
$('btn-help').addEventListener('click', () => { $('help-panel').classList.toggle('hidden'); sfx.ui(); });
$('btn-resume').addEventListener('click', () => togglePause(false));
$('btn-map').addEventListener('click', () => { togglePause(false); setMapOpen(true); sfx.ui(); });
$('btn-restart').addEventListener('click', () => { restartCurrentJob(); togglePause(false); });
$('btn-quit').addEventListener('click', () => {
  togglePause(false);
  setMapOpen(false);
  G.mode = MODE.MENU;
  $('start-screen').classList.remove('hidden');
  $('btn-continue').disabled = !hasSave();
});
$('btn-respawn').addEventListener('click', () => respawn());

function togglePause(on) {
  if (G.mode !== MODE.PLAYING && G.mode !== MODE.PAUSED) return;
  G.mode = on ? MODE.PAUSED : MODE.PLAYING;
  $('pause-screen').classList.toggle('hidden', !on);
  sfx.ui();
}

function endRun(kind) {
  G.mode = MODE.ENDED;
  const title = $('end-title');
  if (kind === 'busted') {
    title.textContent = 'Busted';
    title.classList.add('busted');
    $('end-sub').textContent = 'The PAPD impounds your pride. The fine stings worse.';
  } else {
    title.textContent = 'Wasted';
    title.classList.remove('busted');
    $('end-sub').textContent = 'Hospital Santa Alba patches you up and bills you.';
  }
  $('end-screen').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

function respawn() {
  const busted = $('end-title').textContent === 'Busted';
  const fine = Math.min(G.cash, busted ? 400 : 300);
  G.cash -= fine;
  if (G.player.inCar) {
    G.player.inCar.driver = 'parked';
    G.parkedCars.push(G.player.inCar);
    G.player.inCar = null;
  }
  clearWanted();
  if (G.mission) restartCurrentJob();
  const at = busted ? PLACES.policeStation : PLACES.hospital;
  spawnPlayer(at.x + 8, at.z + 10);
  G.busted = false;
  $('end-screen').classList.add('hidden');
  G.mode = MODE.PLAYING;
  G.toastQueue.push(busted ? `Released — $${fine} fine paid` : `Discharged — $${fine} hospital bill`);
  writeSave();
}

// ------------------------------------------------------------------- garage
let garageOpen = false;
function updateGarage() {
  const p = G.player;
  const near = dist2d(p.x, p.z, PLACES.garagePad.x, PLACES.garagePad.z) < 8.5;
  const slow = !p.inCar || Math.abs(p.inCar.speed) < 1;
  garageOpen = near && slow && G.mode === MODE.PLAYING && !G.dialogue;
  showGaragePanel(garageOpen);
  if (!garageOpen) return;
  const buy = (cost, fn, okText, noText) => {
    if (G.cash >= cost) { G.cash -= cost; fn(); sfx.cash(); G.toastQueue.push(okText); writeSave(); }
    else { sfx.fail(); G.toastQueue.push(noText ?? 'Not enough cash'); }
  };
  if (input.pressed.has('Digit1')) {
    input.pressed.delete('Digit1');
    if (p.inCar) buy(150, () => { p.inCar.hp = p.inCar.maxHp; p.inCar.burning = 0; p.inCar.flatTire = 0; }, 'Repaired and rolling');
    else G.toastQueue.push('Bring a car in to repair it');
  }
  if (input.pressed.has('Digit2')) {
    input.pressed.delete('Digit2');
    buy(300, () => clearWanted(), 'Fresh paint — the PAPD loses interest');
  }
  if (input.pressed.has('Digit3')) {
    input.pressed.delete('Digit3');
    if (G.garageLevels.engine >= 3) G.toastQueue.push('Engine is fully tuned');
    else buy(800, () => { G.garageLevels.engine += 1; if (p.inCar) p.inCar.engineLevel = G.garageLevels.engine; }, `Engine tune level ${G.garageLevels.engine + 1}`);
  }
  if (input.pressed.has('Digit4')) {
    input.pressed.delete('Digit4');
    if (G.garageLevels.armor >= 3) G.toastQueue.push('Armor is fully plated');
    else buy(800, () => { G.garageLevels.armor += 1; if (p.inCar) p.inCar.armorLevel = G.garageLevels.armor; }, `Armor plating level ${G.garageLevels.armor + 1}`);
  }
}

// --------------------------------------------------------------- blast drain
function drainBlasts() {
  if (!G.blastQueue || !G.blastQueue.length) return;
  for (const blast of G.blastQueue) {
    const pd = dist2d(G.player.x, G.player.z, blast.x, blast.z);
    if (pd < blast.radius) {
      if (G.player.inCar) damageCar(G.player.inCar, (blast.radius - pd) * blast.power * 0.7, false);
      else hurtPlayer((blast.radius - pd) * blast.power);
    }
    const sets = [G.trafficCars, G.policeCars, G.parkedCars];
    for (const set of sets) for (const car of set) {
      if (car === blast.sourceCar || car.dead) continue;
      const d = dist2d(car.x, car.z, blast.x, blast.z);
      if (d < blast.radius) damageCar(car, (blast.radius - d) * blast.power, false);
    }
  }
  G.blastQueue.length = 0;
}

// --------------------------------------------------------------------- loop
let last = performance.now();
let menuAngle = 0;
let shotFrames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (G.shotMode) {
    // Frozen tableau with a pulse: light, rotor, particles and the staged
    // FX beats stay alive; nothing moves house.
    G.elapsed += 0.016;
    updateWorld(0.016);
    updateHeli(0.016);
    updateEffects(0.016);
    updateShotScene(shotFrames);
    updateHud(0.016);
    if (G.mapOpen) drawBigMap(); else drawMinimap();
    renderer.render(G.scene, G.camera);
    shotFrames += 1;
    if (shotFrames === 45) window.__shotReady = true;
    endFrame();
    return;
  }

  if (G.mode === MODE.MENU) {
    dt = Math.min(dt, 0.05);
    updateWorld(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updateEffects(dt);
    menuAngle += dt * 0.05;
    const cx = -205 + Math.sin(menuAngle) * 55;
    const cz = -10 + Math.cos(menuAngle) * 55;
    G.camera.position.set(cx, 13 + Math.sin(menuAngle * 2.3) * 2, cz);
    G.camera.lookAt(-196, 1, -10);
    renderer.render(G.scene, G.camera);
    endFrame();
    return;
  }

  if (G.mode === MODE.PAUSED) { endFrame(); return; }

  if (G.mode === MODE.ENDED) {
    updateWorld(dt);
    updateEffects(dt);
    renderer.render(G.scene, G.camera);
    endFrame();
    return;
  }

  // The map freezes play behind it; M or Esc closes it.
  if (input.pressed.has('KeyM') || (G.mapOpen && input.pressed.has('Escape'))) {
    setMapOpen(!G.mapOpen);
    sfx.ui();
    endFrame();
    if (G.mapOpen) { updateHud(0); drawBigMap(); renderer.render(G.scene, G.camera); return; }
  }
  if (G.mapOpen) {
    G.elapsed += dt;
    updateEffects(dt);
    updateHud(dt);
    drawBigMap();
    renderer.render(G.scene, G.camera);
    endFrame();
    return;
  }

  // Playing.
  if (input.pressed.has('KeyP') || input.pressed.has('Escape')) { togglePause(true); endFrame(); return; }
  if (G.dialogue && input.pressed.has('KeyE')) {
    input.pressed.delete('KeyE');
    advanceDialogue();
  }
  if (input.pressed.has('KeyR')) { const st = cycleStation(); G.toastQueue.push(`${st.name} — ${st.track}`); }
  if (input.pressed.has('KeyN')) G.toastQueue.push(toggleMute() ? 'Sound muted' : 'Sound on');

  updateWorld(dt);
  updateGarage();
  updatePlayer(dt);
  if (G.pendingDriverEject) {
    spawnPedAt(G.pendingDriverEject.x, G.pendingDriverEject.z, 'flee', {});
    G.pendingDriverEject = null;
  }
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(dt);
  updateOfficers(dt);
  updateHeli(dt);
  updateCombat(dt);
  updateMissions(dt);
  const allCars = [...G.parkedCars, ...G.trafficCars, ...G.policeCars];
  if (G.mission?.targetCar && !allCars.includes(G.mission.targetCar)) allCars.push(G.mission.targetCar);
  collideCars(allCars, dt);
  drainBlasts();
  if (G.pendingPlayerBlast) { hurtPlayer(G.pendingPlayerBlast); G.pendingPlayerBlast = 0; }
  updateEffects(dt);
  if (checkBusted(dt)) G.busted = true;

  // Siren loudness follows the nearest cruiser.
  let nearestCop = Infinity;
  for (const c of G.policeCars) if (!c.dead) nearestCop = Math.min(nearestCop, dist2d(c.x, c.z, G.player.x, G.player.z));
  setSiren(G.wanted > 0 ? clamp(1 - nearestCop / 70, 0, 1) : 0);

  // Headlights and their cones on at dusk.
  HEADLIGHT_MAT.color.setHex(G.isDusk ? 0xffe9a3 : 0x8a8578);
  HEADLIGHT_CONE_MAT.opacity = G.isDusk ? 0.13 : 0;

  // Interact prompt.
  if (!G.player.inCar && !G.dialogue) {
    const car = findEnterableCar();
    if (car) setInteract(car.driver === 'traffic' ? `Steal the ${car.def.name}` : `Enter the ${car.def.name}`);
    else setInteract(null);
  } else setInteract(null);

  // Camera + HUD + render.
  updateCamera(dt);
  updateHud(dt);
  drawMinimap();
  renderer.render(G.scene, G.camera);

  if (G.player.dead) endRun('wasted');
  else if (G.busted) endRun('busted');

  endFrame();
}

// Clicking the game locks the pointer for mouse-orbit (real play only).
renderer.domElement.addEventListener('click', () => {
  if (G.mode === MODE.PLAYING && !G.shotMode) {
    initAudio();
    requestLock(renderer.domElement);
  }
});

requestAnimationFrame(frame);

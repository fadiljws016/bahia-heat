// main.js — boot and the two loops of Bahia Heat. With ?shot=<scene> in
// the URL the game stages that screenshot scene and runs a fixed-step
// loop until the scene reports itself ready (window.__shotReady); without
// it, the full live game runs: missions, police, traffic and all.

import { G, MODE } from './state.js';
import { initWorld, updateWorld } from './world.js';
import { initEffects, updateEffects } from './effects.js';
import { initInput, input, endFrame, requestLock } from './input.js';
import { buildHud, updateHud } from './hud.js';
import { initMinimap, drawMinimap, drawBigMap } from './minimap.js';
import { initPeds, updatePeds } from './pedestrians.js';
import { spawnPlayer, updatePlayer, findEnterableCar } from './player.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { spawnParkedCars, flashLightbars, syncCarMesh, collideCars } from './vehicles.js';
import { initHeli, updateHeli } from './helicopter.js';
import { updatePolice, checkBusted } from './police.js';
import { updateOfficers } from './officers.js';
import { updateCombat } from './combat.js';
import { updateMissions, offerFirstMission, advanceDialogue, restartCurrentJob } from './missions.js';
import { updateCamera } from './camera.js';
import { initAudio, updateAudio, setEngine, setSiren, cycleStation, toggleMute, sfx } from './audio.js';
import { readSave, hasSave } from './save.js';
import { stageShotScene, updateShotScene } from './shots.js';
import { makeRng } from './util.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = parseInt(params.get('seed') || '1', 10) || 1;

const container = document.getElementById('game');
initWorld(container);
initEffects(G.scene);
initInput(G.renderer.domElement);
buildHud();
initMinimap();
initHeli();

const bigmapWrap = document.getElementById('bigmap-wrap');
const startScreen = document.getElementById('start-screen');
const overScreen = document.getElementById('over-screen');
const overTitle = document.getElementById('over-title');

if (shotName) {
  // --- Screenshot staging: fixed-step, deterministic, no ambient life.
  G.shotMode = true;
  G.shotName = shotName;
  G.mode = MODE.PLAYING;
  if (startScreen) startScreen.style.display = 'none';
  stageShotScene(shotName, seed);
  let frame = 0;
  const step = () => {
    frame++;
    const dt = 1 / 30;
    updateWorld(dt);
    updatePeds(dt);
    updateOfficers(dt);
    updateHeli(dt);
    updateEffects(dt);
    flashLightbars(frame * dt * 1.6);
    for (const car of G.cars) syncCarMesh(car, dt);
    updateHud(0);
    drawMinimap();
    if (G.mapOpen && bigmapWrap) { bigmapWrap.style.display = 'flex'; drawBigMap(); }
    const ready = updateShotScene(frame);
    G.renderer.render(G.scene, G.camera);
    if (ready) window.__shotReady = true;
    if (frame < 420) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
} else {
  // --- The live game.
  if (hasSave()) readSave();
  initPeds();
  initTraffic();
  spawnParkedCars(makeRng(31));
  const player = spawnPlayer(-191.9, -2);
  player.heading = -2.4;
  offerFirstMission();
  G.mode = MODE.PLAYING;

  let started = false;
  if (startScreen) {
    startScreen.addEventListener('click', () => {
      started = true;
      startScreen.style.display = 'none';
      initAudio();
      requestLock(G.renderer.domElement);
    });
  } else {
    started = true;
  }
  const overBtn = document.getElementById('over-button');
  if (overBtn) overBtn.addEventListener('click', () => window.location.reload());
  G.renderer.domElement.addEventListener('click', () => {
    if (started && !input.locked) requestLock(G.renderer.domElement);
  });

  let last = performance.now();
  let overShown = false;
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!started) {
      G.renderer.render(G.scene, G.camera);
      return;
    }
    // Dialogue owns the E key while it is open.
    if (G.dialogue && (input.pressed['KeyE'] || input.pressed['Enter'])) {
      advanceDialogue();
      sfx.ui();
      delete input.pressed['KeyE'];
      delete input.pressed['Enter'];
    }
    if (input.pressed['KeyM'] || input.pressed['Escape']) {
      G.mapOpen = !G.mapOpen && input.pressed['KeyM'] ? true : false;
      if (input.pressed['Escape']) G.mapOpen = false;
    }
    if (input.pressed['KeyC']) cycleStation();
    if (input.pressed['KeyN']) toggleMute();

    updateWorld(dt);
    updatePlayer(dt);
    updateCombat(dt);
    updateMissions(dt);
    updatePolice(dt);
    checkBusted(dt);
    updateOfficers(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updateHeli(dt);
    updateEffects(dt);
    collideCars(G.cars, dt);
    flashLightbars(now * 0.0016);
    for (const car of G.cars) if (car.driver !== 'player' && car.driver !== 'traffic' && car.driver !== 'police') syncCarMesh(car, dt);

    // Interact prompt.
    if (G.dialogue) G.interactText = '';
    else if (player.car) G.interactText = 'E — EXIT';
    else if (findEnterableCar()) G.interactText = 'E — ENTER CAR';
    else G.interactText = '';

    // Engine and siren beds follow the action.
    setEngine(!!player.car, player.car ? Math.abs(player.car.speed) / player.car.type.topSpeed : 0);
    setSiren(G.wanted >= 1);
    updateAudio(dt);

    updateCamera(dt);
    updateHud(dt);
    drawMinimap();
    if (bigmapWrap) {
      bigmapWrap.style.display = G.mapOpen ? 'flex' : 'none';
      if (G.mapOpen) drawBigMap();
    }
    if (G.over && !overShown) {
      overShown = true;
      if (overTitle) overTitle.textContent = G.busted ? 'BUSTED' : 'WASTED';
      if (overScreen) overScreen.style.display = 'flex';
      if (G.busted) sfx.busted();
    }
    G.renderer.render(G.scene, G.camera);
    endFrame();
  };
  requestAnimationFrame(loop);
}

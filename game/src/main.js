// main.js — boot and the frame loop. Live play runs the full simulation;
// ?shot=<scene> boots straight into a staged film set with a frozen
// clock, a fixed timestep and window.__shotReady raised at frame 90 so
// the capture pipeline can take its frame.

import { G } from './state.js';
import { makeRng, clamp } from './util.js';
import { buildCityData, buildCityMeshes, PLACES } from './city.js';
import { initWorld, updateWorld, setBoats, setFerris } from './world.js';
import { initEffects, updateEffects } from './effects.js';
import { initPeds, updatePeds } from './pedestrians.js';
import { spawnPlayer, updatePlayer, findEnterableCar } from './player.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { initHeli, updateHeli } from './helicopter.js';
import { buildHud, updateHud, setInteract, showGaragePanel } from './hud.js';
import { initMinimap } from './minimap.js';
import { initInput, input } from './input.js';
import { initAudio, sfx, toggleMute } from './audio.js';
import { updateCombat } from './combat.js';
import { updateOfficers } from './officers.js';
import { updatePolice } from './police.js';
import { updateMissions, advanceDialogue } from './missions.js';
import { updateCamera } from './camera.js';
import { stageShotScene, updateShotScene } from './shots.js';
import { loadSave, readSave, writeSave } from './save.js';
import { createCar, syncCarMesh, CAR_TYPES } from './vehicles.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

function boot() {
  const app = document.getElementById('app');
  const data = buildCityData(makeRng(20261123));
  G.city = data;
  setBoats(data.boats);
  setFerris(data.ferris);
  initWorld(app);
  G.cityMeshes = buildCityMeshes(G.scene, data, 20261123);
  initEffects(G.scene);
  initMinimap();
  buildHud();
  initInput(G.renderer.domElement);
  initHeli();

  if (shotName) {
    document.getElementById('menu-overlay').style.display = 'none';
    stageShotScene(shotName);
    G.mode = 'playing';
  } else {
    spawnPlayer(PLACES.marisol.x + 3, PLACES.marisol.z + 4);
    initPeds();
    initTraffic();
    loadSave();
    wireMenu();
  }

  const onGesture = () => { initAudio(); };
  window.addEventListener('pointerdown', onGesture, { once: true });
  window.addEventListener('keydown', onGesture, { once: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('beforeunload', () => { if (!G.shotMode) writeSave(); });
  requestAnimationFrame(loop);
}

function onResize() {
  if (!G.renderer || !G.camera) return;
  G.renderer.setSize(window.innerWidth, window.innerHeight);
  G.camera.aspect = window.innerWidth / window.innerHeight;
  G.camera.updateProjectionMatrix();
}

function wireMenu() {
  const menu = document.getElementById('menu-overlay');
  const start = document.getElementById('btn-start');
  const cont = document.getElementById('btn-continue');
  const mute = document.getElementById('btn-mute');
  if (readSave()) cont.style.display = 'block';
  const begin = (fresh) => {
    if (fresh) {
      G.cash = 250;
      G.respect = 0;
      G.weapons.unlocked = { fists: true, pistol: false, smg: false, shotgun: false };
    }
    menu.style.display = 'none';
    G.mode = 'playing';
    sfx.cash();
  };
  start.addEventListener('click', () => begin(true));
  cont.addEventListener('click', () => begin(false));
  mute.addEventListener('click', () => { mute.textContent = toggleMute() ? 'SOUND: OFF' : 'SOUND: ON'; });
  const restart = document.getElementById('btn-restart');
  if (restart) restart.addEventListener('click', () => location.reload());
  const resume = document.getElementById('btn-resume');
  if (resume) resume.addEventListener('click', () => {
    G.paused = false;
    document.getElementById('pause-overlay').style.display = 'none';
  });
}

const GARAGE_PRICES = { sedan: 900, taxi: 1100, truck: 1600, sport: 2400 };
const GARAGE_KEYS = ['sedan', 'taxi', 'truck', 'sport'];

function garageLogic() {
  const p = G.player;
  if (!p) return;
  const near = Math.hypot(p.x - PLACES.garage.x, p.z - PLACES.garage.z) < 7;
  if (near && input.interact && !G.dialogue) {
    G.garageOpen = !G.garageOpen;
    showGaragePanel(G.garageOpen);
    input.interact = false;
  }
  if (G.garageOpen) {
    if (!near) { G.garageOpen = false; showGaragePanel(false); return; }
    for (let i = 0; i < GARAGE_KEYS.length; i += 1) {
      if (input.keys[`Digit${i + 1}`]) {
        input.keys[`Digit${i + 1}`] = false;
        const type = GARAGE_KEYS[i];
        const price = GARAGE_PRICES[type];
        if (G.cash >= price) {
          G.cash -= price;
          const car = createCar(type, p.x + Math.sin(p.heading) * 4, p.z + Math.cos(p.heading) * 4, p.heading, undefined, Math.random);
          syncCarMesh(car, 0);
          sfx.door();
          G.message = `${CAR_TYPES[type].name} delivered`;
          G.messageT = 2.4;
        } else {
          G.message = 'Not enough cash';
          G.messageT = 1.6;
        }
      }
    }
  }
}

let last = performance.now();
let shotFrame = 0;

function loop(now) {
  requestAnimationFrame(loop);
  let dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (!G.renderer) return;

  if (G.shotMode) {
    dt = 1 / 30;
    shotFrame += 1;
    updateShotScene(shotFrame);
    updateOfficers(dt);
    updateHeli(0);
    updateWorld(0);
    updateEffects(dt);
    updateHud(0);
    G.renderer.render(G.scene, G.camera);
    if (shotFrame === 90) window.__shotReady = true;
    return;
  }

  if (G.mode === 'playing' && !G.paused && !G.over) {
    G.elapsed += dt;
    G.timeHours = (G.timeHours + dt / 240) % 24; // a game hour every 4 real minutes
    if (G.dialogue && input.advance) {
      advanceDialogue();
      input.advance = false;
      input.interact = false;
    }
    if (input.mapToggle) {
      G.mapOpen = !G.mapOpen;
      input.mapToggle = false;
    }
    if (input.pause) {
      G.paused = true;
      document.getElementById('pause-overlay').style.display = 'flex';
      input.pause = false;
    }
    garageLogic();
    updatePlayer(dt);
    updateCombat(dt);
    updatePeds(dt);
    updateOfficers(dt);
    updatePolice(dt);
    updateTraffic(dt);
    updateHeli(dt);
    updateMissions(dt);
    updateWorld(dt);
    updateEffects(dt);
    updateCamera(dt);
    // Contextual prompt.
    const p = G.player;
    if (G.dialogue) setInteract('');
    else if (G.garageOpen) setInteract('');
    else if (p && !p.car && findEnterableCar()) setInteract(`E — ENTER ${findEnterableCar().spec.name.toUpperCase()}`);
    else if (p && p.car) setInteract('E — EXIT');
    else setInteract('');
  }
  updateHud(dt);
  G.renderer.render(G.scene, G.camera);
}

boot();

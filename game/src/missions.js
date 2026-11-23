
// missions.js — the job engine: Marisol's corner, Tito's flag, Bruno's
// crates and Dario's garage, run as a list of stages. Walk up to a
// giver and the intro dialogue plays (E walks it, main.js owns the
// key); when the last line lands the job begins. Each stage kind is a
// small machine — goto, steal, deliverCar, timed, escape, fight,
// race, fare, takedown — and the engine owns the bookkeeping the HUD
// and the map read: missionPanelInfo for the panel, objectivePoint
// for the marker and the route line. Finishing a job pays cash and
// respect, banks unlocks, records the title and writes the save;
// failing one cleans its actors up and leaves the job on offer.

import { G, rankFor } from './state.js';
import { MISSIONS, CHARACTERS } from './story.js';
import { PLACES } from './city.js';
import { createCar, driveCar, removeCar } from './vehicles.js';
import { spawnPedAt, removePed } from './pedestrians.js';
import { writeSave } from './save.js';
import { clamp, dist2d, wrapAngle, makeRng } from './util.js';
import { sfx } from './audio.js';

/** Where each giver holds court — the corner the marker points to. */
const GIVER_PLACES = {
  marisol: 'marisolCorner',
  tito: 'raceStart',
  bruno: 'marinaDock',
  dario: 'garagePad',
};

/** Tito's Street Crown: three legs of checkpoints on real roads. */
const RACE_LEGS = [
  [{ x: -212, z: 0 }, { x: -212, z: -100 }, { x: -212, z: -200 }, { x: -226, z: -282 }],
  [{ x: -160, z: -220 }, { x: -40, z: -220 }, { x: 80, z: -160 }, { x: 140, z: -40 }, { x: 200, z: 80 }],
  [{ x: 140, z: 140 }, { x: 20, z: 200 }, { x: -100, z: 140 }, { x: -212, z: 58 }],
];

/** Where fares want to go: named places make honest destinations. */
const FARE_PLACES = ['marinaDock', 'hospital', 'plaza', 'clockTower', 'barLaOla', 'garagePad', 'lighthouse', 'raceStart'];

let offerCooldown = 0;

/** A fresh runtime record for a job about to start. */
function newMission(def) {
  return {
    def,
    stageIndex: 0,
    stageT: 0,
    timer: null,
    targetCar: null,
    hostiles: [],
    hostilesSpawned: false,
    raceIndex: 0,
    faresLeft: 0,
    fareLeg: 'pickup',
    farePoint: null,
  };
}

/** Set up whatever the current stage needs before its first frame. */
function beginStage() {
  const m = G.mission;
  if (!m) return;
  const stage = m.def.stages[m.stageIndex];
  m.stageT = 0;
  m.timer = null;
  if (stage.kind === 'timed') m.timer = stage.time;
  if (stage.kind === 'steal') {
    const at = PLACES[stage.at];
    const isKingpin = m.def.title === "Kingpin's Gambit";
    m.targetCar = createCar(isKingpin ? 'sport' : 'sedan', at.x + 6, at.z + 4, 0.6, {
      color: isKingpin ? 0xd8b13c : 0x2f6fb2, driver: 'parked',
    });
    if (stage.wanted) { G.wanted = Math.max(G.wanted, stage.wanted); G.heat = Math.max(G.heat, stage.wanted); }
  }
  if (stage.kind === 'takedown') {
    const at = PLACES[stage.at];
    m.targetCar = createCar('truck', at.x + 10, at.z + 6, -0.8, { color: 0xd8d5cc, driver: 'mission' });
  }
  if (stage.kind === 'escape' && G.wanted < 1) {
    G.wanted = 2;
    G.heat = Math.max(G.heat, 2);
  }
  if (stage.kind === 'race') {
    m.raceIndex = 0;
    G.race = { checkpoints: RACE_LEGS[stage.leg] ?? RACE_LEGS[0], index: 0 };
  }
  if (stage.kind === 'fare') {
    m.faresLeft = stage.fares;
    nextFarePoint();
  }
  if (stage.kind === 'fight') {
    m.hostiles = [];
    m.hostilesSpawned = false;
  }
}

/** Point the fare machine at its next pickup or drop-off. */
function nextFarePoint() {
  const m = G.mission;
  const rng = makeRng(Math.floor(G.elapsed * 7) + m.faresLeft * 131 + (m.fareLeg === 'dropoff' ? 17 : 0));
  let place = PLACES[FARE_PLACES[Math.floor(rng() * FARE_PLACES.length)]];
  if (m.fareLeg === 'pickup') {
    // Pickups wait near the player, on a corner they can reach.
    const near = PLACES[FARE_PLACES[Math.floor(rng() * FARE_PLACES.length)]];
    place = dist2d(G.player.x, G.player.z, near.x, near.z) < 190 ? near : PLACES.plaza;
  }
  m.farePoint = { x: place.x + 3, z: place.z + 3 };
}

/** Start a job's stages (its intro dialogue has just finished). */
function beginMission(def) {
  G.mission = newMission(def);
  G.bannerQueue.push(def.title);
  sfx.chime();
  beginStage();
}

/** Walk the open dialogue one line; the last line fires its callback. */
export function advanceDialogue() {
  if (!G.dialogue) return;
  G.dialogue.index += 1;
  sfx.ui();
  if (G.dialogue.index >= G.dialogue.lines.length) {
    const onDone = G.dialogue.onDone;
    G.dialogue = null;
    if (onDone) onDone();
  }
}

/** Tidy a job's actors without paying anyone: shared by fail/restart. */
function cleanupMission() {
  const m = G.mission;
  if (!m) return;
  if (m.targetCar && !m.targetCar.dead) {
    m.targetCar.driver = 'parked';
    if (!G.parkedCars.includes(m.targetCar)) G.parkedCars.push(m.targetCar);
  }
  if (m.targetCar && m.targetCar.dead) removeCar(m.targetCar);
  for (const ped of m.hostiles) if (!ped.dead) removePed(ped);
  G.race = null;
  G.mission = null;
}

function failMission(reason) {
  cleanupMission();
  G.bannerQueue.push('Job failed');
  G.toastQueue.push(reason);
  offerCooldown = 8;
  sfx.fail();
}

function completeMission() {
  const m = G.mission;
  const def = m.def;
  cleanupMission();
  G.cash += def.reward.cash;
  G.respect += def.reward.respect;
  if (def.unlock && !G.unlockedWeapons.includes(def.unlock)) {
    G.unlockedWeapons.push(def.unlock);
    if (def.unlock === 'smg') G.ammo.smg = Math.max(G.ammo.smg, 120);
    if (def.unlock === 'shotgun') G.ammo.shotgun = Math.max(G.ammo.shotgun, 24);
    G.toastQueue.push(`Unlocked: ${def.unlock.toUpperCase()}`);
  }
  G.completedJobs.push(def.title);
  G.missionIndex += 1;
  const rank = rankFor(G.respect);
  if (rank.index > G.rankIndex) {
    G.rankIndex = rank.index;
    G.bannerQueue.push(`Rank up — ${rank.name}`);
  } else {
    G.bannerQueue.push('Job complete');
  }
  G.toastQueue.push(`+$${def.reward.cash} · +${def.reward.respect} respect`);
  offerCooldown = 6;
  sfx.cash();
  writeSave();
}

function advanceStage() {
  const m = G.mission;
  m.stageIndex += 1;
  if (m.stageIndex >= m.def.stages.length) { completeMission(); return; }
  sfx.ui();
  beginStage();
}

/** Pause-menu restart: same job, stage one, no dialogue. */
export function restartCurrentJob() {
  if (!G.mission) return;
  const def = G.mission.def;
  cleanupMission();
  G.mission = newMission(def);
  beginStage();
}

// ------------------------------------------------------------- the panel
/** What the HUD's mission panel shows this frame. */
export function missionPanelInfo() {
  const m = G.mission;
  if (m) {
    const stage = m.def.stages[m.stageIndex];
    return {
      title: m.def.title,
      stage: `Stage ${m.stageIndex + 1} of ${m.def.stages.length}`,
      objective: stage.objective,
      next: stage.next,
      timer: m.timer != null ? Math.max(0, m.timer) : null,
    };
  }
  if (G.missionIndex < MISSIONS.length) {
    const def = MISSIONS[G.missionIndex];
    const giver = CHARACTERS[def.giver];
    return {
      title: 'Bahia Heat',
      stage: 'Free roam',
      objective: `Meet ${giver ? giver.name : 'your fixer'} — work is waiting`,
      next: def.title,
      timer: null,
    };
  }
  return {
    title: 'Bahia Heat',
    stage: 'Free roam',
    objective: 'Puerto Alba is yours — the fares and the night remain',
    next: 'Kingpin of Puerto Alba',
    timer: null,
  };
}

/** The world point the map marker and route line aim at, or null. */
export function objectivePoint() {
  const m = G.mission;
  const p = G.player;
  if (!m) {
    if (G.missionIndex < MISSIONS.length) {
      const def = MISSIONS[G.missionIndex];
      const at = PLACES[GIVER_PLACES[def.giver]];
      return at ? { x: at.x, z: at.z } : null;
    }
    return null;
  }
  const stage = m.def.stages[m.stageIndex];
  switch (stage.kind) {
    case 'steal':
    case 'takedown':
      return m.targetCar ? { x: m.targetCar.x, z: m.targetCar.z } : { x: PLACES[stage.at].x, z: PLACES[stage.at].z };
    case 'race': {
      const legs = RACE_LEGS[stage.leg] ?? RACE_LEGS[0];
      const cp = legs[Math.min(m.raceIndex, legs.length - 1)];
      return { x: cp.x, z: cp.z };
    }
    case 'fare':
      return m.farePoint ? { x: m.farePoint.x, z: m.farePoint.z } : null;
    default: {
      const at = PLACES[stage.at];
      return at ? { x: at.x, z: at.z } : { x: p.x, z: p.z };
    }
  }
}

// --------------------------------------------------------------- the loop
/** Offer jobs on corners; run the active stage's machine. */
export function updateMissions(dt) {
  if (offerCooldown > 0) offerCooldown -= dt;
  if (G.dialogue) return;
  const p = G.player;

  if (!G.mission) {
    if (G.missionIndex >= MISSIONS.length || offerCooldown > 0) return;
    const def = MISSIONS[G.missionIndex];
    const corner = PLACES[GIVER_PLACES[def.giver]];
    if (corner && dist2d(p.x, p.z, corner.x, corner.z) < 3.4 && !p.inCar) {
      G.dialogue = { lines: def.intro, index: 0, onDone: () => beginMission(def) };
      sfx.ui();
    }
    return;
  }

  const m = G.mission;
  const stage = m.def.stages[m.stageIndex];
  m.stageT += dt;
  const at = PLACES[stage.at];

  switch (stage.kind) {
    case 'goto':
      if (at && dist2d(p.x, p.z, at.x, at.z) < 4.6) advanceStage();
      break;

    case 'steal':
      if (!m.targetCar || m.targetCar.dead) { failMission('The car is wrecked — the job is blown'); break; }
      if (p.inCar === m.targetCar) advanceStage();
      break;

    case 'deliverCar':
      if (!m.targetCar) { advanceStage(); break; }
      if (m.targetCar.dead) { failMission('The delivery is a wreck — Dario will hear about it'); break; }
      if (p.inCar === m.targetCar && at && dist2d(p.x, p.z, at.x, at.z) < 6) {
        const delivered = m.targetCar;
        m.targetCar = null;
        delivered.driver = 'parked';
        if (!G.parkedCars.includes(delivered)) G.parkedCars.push(delivered);
        advanceStage();
      }
      break;

    case 'timed':
      m.timer -= dt;
      if (at && dist2d(p.x, p.z, at.x, at.z) < 5.5) { advanceStage(); break; }
      if (m.timer <= 0) failMission('Out of time — the window closed');
      break;

    case 'escape':
      if (G.wanted <= 0 && m.stageT > 1) advanceStage();
      break;

    case 'fight': {
      if (!m.hostilesSpawned && at && dist2d(p.x, p.z, at.x, at.z) < 50) {
        m.hostilesSpawned = true;
        const n = stage.hostiles ?? 4;
        for (let i = 0; i < n; i += 1) {
          const a = (i / n) * Math.PI * 2;
          m.hostiles.push(spawnPedAt(at.x + Math.sin(a) * 7, at.z + Math.cos(a) * 7, 'hostile', {}));
        }
        G.toastQueue.push('Ambush — Red Sails!');
      }
      if (m.hostilesSpawned && m.hostiles.every((ped) => ped.dead || ped.hp <= 0)) advanceStage();
      break;
    }

    case 'race': {
      const legs = RACE_LEGS[stage.leg] ?? RACE_LEGS[0];
      const cp = legs[m.raceIndex];
      if (G.race) G.race.index = m.raceIndex;
      if (cp && p.inCar && dist2d(p.x, p.z, cp.x, cp.z) < 8.5) {
        m.raceIndex += 1;
        sfx.chime();
        if (m.raceIndex >= legs.length) { G.race = null; advanceStage(); }
      }
      break;
    }

    case 'fare': {
      if (!m.farePoint) nextFarePoint();
      if (p.inCar && dist2d(p.x, p.z, m.farePoint.x, m.farePoint.z) < 5.5) {
        if (m.fareLeg === 'pickup') {
          m.fareLeg = 'dropoff';
          G.toastQueue.push('Fare aboard — drive smooth');
          nextFarePoint();
        } else {
          G.cash += 45;
          G.taxiFaresDone += 1;
          m.faresLeft -= 1;
          sfx.cash();
          G.toastQueue.push('Fare paid — $45');
          if (m.faresLeft <= 0) { advanceStage(); break; }
          m.fareLeg = 'pickup';
          nextFarePoint();
        }
      }
      break;
    }

    case 'takedown': {
      const truck = m.targetCar;
      if (!truck || truck.dead) { failMission('The courier is gone — and so is the cargo'); break; }
      const away = Math.atan2(truck.x - p.x, truck.z - p.z);
      const steer = clamp(wrapAngle(away - truck.heading) * 1.5, -1, 1);
      driveCar(truck, { throttle: 0.85, steer, handbrake: false }, dt);
      const broken = truck.hp < truck.maxHp * 0.45;
      const boxed = truck.speed < 0.4 && m.stageT > 3 && dist2d(p.x, p.z, truck.x, truck.z) < 12;
      if (broken || boxed) {
        truck.driver = 'parked';
        G.toastQueue.push('Courier stopped — the truck is yours');
        advanceStage();
      }
      break;
    }

    default:
      break;
  }
}

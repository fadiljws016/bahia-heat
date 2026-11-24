// missions.js — the job engine: dialogue flow, stage activation and
// completion for every stage kind (goto / steal / deliverCar / timed /
// escape / fight / race / fare / takedown), rewards and rank-ups.
// G.mission is the live runtime; shots.js stages it directly for the
// screenshots, so missionPanelInfo reads plain fields, not closures.

import { G } from './state.js';
import { PLACES } from './city.js';
import { MISSIONS } from './story.js';
import { dist2d } from './util.js';
import { input } from './input.js';
import { createCar } from './vehicles.js';
import { spawnPedAt } from './pedestrians.js';
import { addCrime, setWantedFloor } from './police.js';
import { sfx } from './audio.js';
import { writeSave } from './save.js';

const RACE_POINTS = [
  { x: 140, z: 140 }, { x: 200, z: 20 }, { x: 140, z: -100 }, { x: 20, z: -160 },
  { x: -100, z: -100 }, { x: -160, z: 20 }, { x: -100, z: 140 }, { x: 20, z: 200 },
];

export function startDialogue(lines, onDone) {
  G.dialogue = { lines, index: 0, onDone: onDone || null };
}

export function advanceDialogue() {
  const d = G.dialogue;
  if (!d) return;
  d.index += 1;
  if (d.index >= d.lines.length) {
    G.dialogue = null;
    if (d.onDone) d.onDone();
  }
}

function placeOf(stage) {
  return stage.at ? PLACES[stage.at] : null;
}

export function objectivePoint() {
  const m = G.mission;
  if (!m || m.state !== 'active') return null;
  const stage = m.def.stages[m.stageIndex];
  if (!stage) return null;
  if (stage.kind === 'race') return RACE_POINTS[m.raceIndex] || null;
  if (stage.kind === 'fare') return PLACES.fares[m.fareIndex % PLACES.fares.length] || null;
  if (stage.kind === 'takedown' && m.targetCar) return { x: m.targetCar.x, z: m.targetCar.z };
  if (stage.kind === 'escape') return null;
  return placeOf(stage);
}

export function missionPanelInfo() {
  const m = G.mission;
  if (!m || !m.def) return null;
  const stage = m.def.stages[m.stageIndex];
  if (!stage) return null;
  return {
    title: m.def.title,
    stage: `STAGE ${m.stageIndex + 1}/${m.def.stages.length}`,
    objective: stage.label,
    next: stage.next || '',
    timer: m.timerLeft !== null && m.timerLeft !== undefined ? m.timerLeft : (stage.kind === 'timed' ? stage.time : null),
  };
}

function saveProgress() {
  writeSave({
    cash: G.cash,
    respect: G.respect,
    missionIndex: G.missionIndex || 0,
    unlocked: G.weapons.unlocked,
    ammo: G.weapons.ammo,
    garage: G.garage || [],
  });
}

function activateStage(m) {
  const stage = m.def.stages[m.stageIndex];
  m.timerLeft = stage.kind === 'timed' ? stage.time : null;
  m.stageT = 0;
  if (stage.kind === 'steal') {
    const at = placeOf(stage);
    m.targetCar = createCar('sedan', at.x + 3.5, at.z + 2, Math.PI / 2, 0x2478cc, Math.random);
    m.targetCar.parked = true;
  }
  if (stage.kind === 'escape') {
    setWantedFloor(stage.wanted || 3);
    addCrime(0, 'escape');
  }
  if (stage.kind === 'fight') {
    const at = placeOf(stage);
    m.killsLeft = stage.count || 4;
    for (let i = 0; i < m.killsLeft; i += 1) {
      const a = (i / m.killsLeft) * Math.PI * 2;
      const ped = spawnPedAt(at.x + Math.cos(a) * 9, at.z + Math.sin(a) * 9, 'stand', { hostile: true, color: 0xd8402e });
      ped.hostile = true;
      ped.hp = 60;
    }
  }
  if (stage.kind === 'race') m.raceIndex = 0;
  if (stage.kind === 'fare') { m.fareIndex = 0; m.faresDone = 0; m.fareWait = 0; }
  if (stage.kind === 'takedown') {
    const at = placeOf(stage);
    m.targetCar = createCar('sport', at.x, at.z, 0.6, 0xff4438, Math.random);
    m.targetCar.driver = { flee: true };
  }
}

function completeMission(m) {
  const def = m.def;
  G.cash += def.reward.cash;
  G.respect += def.reward.respect;
  sfx.cash();
  G.missionIndex = Math.max(G.missionIndex || 0, MISSIONS.indexOf(def) + 1);
  G.mission = null;
  saveProgress();
  if (def.outro) startDialogue(def.outro, null);
  G.message = `${def.title} complete — $${def.reward.cash}`;
  G.messageT = 4;
}

function failMission(m) {
  sfx.fail();
  G.mission = null;
  G.message = 'Job failed — the giver will still take your call';
  G.messageT = 4;
}

export function restartCurrentJob() {
  const m = G.mission;
  if (!m) return;
  startMission(MISSIONS.indexOf(m.def));
}

function startMission(index) {
  const def = MISSIONS[index];
  if (!def) return;
  const m = { def, stageIndex: 0, state: 'intro', timerLeft: null, stageT: 0, raceIndex: 0, fareIndex: 0, killsLeft: 0, targetCar: null };
  G.mission = m;
  startDialogue(def.intro, () => {
    m.state = 'active';
    activateStage(m);
  });
}

const GIVERS = [
  { key: 'marisol', at: 'marisol' },
  { key: 'tito', at: 'raceStart' },
  { key: 'dario', at: 'garage' },
];

export function updateMissions(dt) {
  const p = G.player;
  if (!p) return;
  // Offer the next job at a giver's spot.
  if (!G.mission && !G.dialogue && G.mode === 'playing') {
    for (const g of GIVERS) {
      const at = PLACES[g.at];
      if (dist2d(p.x, p.z, at.x, at.z) < 4.5) {
        const next = MISSIONS.findIndex((m, i) => m.giver === g.key && i >= (G.missionIndex || 0));
        const idx = MISSIONS.findIndex((m, i) => m.giver === g.key && i === (G.missionIndex || 0));
        if (idx >= 0 && input.interact) startMission(idx);
        else if (next >= 0 && idx < 0 && input.interact) startMission(next);
        break;
      }
    }
  }
  const m = G.mission;
  if (!m || m.state !== 'active') return;
  const stage = m.def.stages[m.stageIndex];
  if (!stage) { completeMission(m); return; }
  m.stageT += dt;
  let done = false;
  const at = placeOf(stage);
  switch (stage.kind) {
    case 'goto':
      done = at && dist2d(p.x, p.z, at.x, at.z) < 6;
      break;
    case 'steal':
      done = !!(m.targetCar && p.car === m.targetCar);
      if (done) addCrime(1.2, 'grand theft');
      break;
    case 'deliverCar':
      done = !!(p.car && at && dist2d(p.x, p.z, at.x, at.z) < 8);
      break;
    case 'timed':
      m.timerLeft -= dt;
      if (m.timerLeft <= 0) { failMission(m); return; }
      done = !!(p.car && at && dist2d(p.x, p.z, at.x, at.z) < 8);
      break;
    case 'escape':
      done = G.wanted < 0.4 && m.stageT > 4;
      break;
    case 'fight':
      done = (m.killsLeft || 0) <= 0;
      break;
    case 'race': {
      const cp = RACE_POINTS[m.raceIndex];
      if (cp && p.car && dist2d(p.x, p.z, cp.x, cp.z) < 10) {
        sfx.checkpoint();
        m.raceIndex += 1;
        if (m.raceIndex >= RACE_POINTS.length) done = true;
      }
      break;
    }
    case 'fare': {
      const stop = PLACES.fares[m.fareIndex % PLACES.fares.length];
      if (stop && dist2d(p.x, p.z, stop.x, stop.z) < 7) {
        m.fareWait += dt;
        if (m.fareWait > 1.2) {
          m.fareWait = 0;
          m.fareIndex += 1;
          m.faresDone += 1;
          sfx.cash();
          if (m.faresDone >= (stage.count || 3)) done = true;
        }
      } else m.fareWait = 0;
      break;
    }
    case 'takedown': {
      const car = m.targetCar;
      if (car) {
        if (car.driver && car.driver.flee && !car.dead) {
          const away = Math.atan2(car.x - p.x, car.z - p.z);
          car.heading += Math.max(-dt, Math.min(dt, (away - car.heading + Math.PI * 3) % (Math.PI * 2) - Math.PI));
          car.speed = Math.min(car.spec.topSpeed * 0.8, car.speed + car.spec.accel * dt);
          car.x += Math.sin(car.heading) * car.speed * dt;
          car.z += Math.cos(car.heading) * car.speed * dt;
        }
        done = car.dead || car.hp < car.spec.hp * 0.4;
      }
      break;
    }
    default:
      break;
  }
  if (done) {
    sfx.checkpoint();
    m.stageIndex += 1;
    if (m.stageIndex >= m.def.stages.length) completeMission(m);
    else activateStage(m);
  }
}

// missions.js — the job engine: offers work when the runner stands in
// front of the giver, runs the dialogue, then walks the stage list —
// go, steal, deliver, beat the clock, escape, fight, race, fares,
// takedown — paying out in cash and respect and writing the save.
// Round seventeen rebuilds the engine on the same stage vocabulary
// the staged frames freeze mid-job: a mission record is
// { def, stageIndex, ...stage transients }, and the panel and the map
// both read their answers out of objectivePoint/missionPanelInfo.
import { G, rankFor } from './state.js';
import { MISSIONS, CHARACTERS } from './story.js';
import { PLACES } from './city.js';
import { createCar, driveCar, removeCar } from './vehicles.js';
import { spawnPedAt, removePed } from './pedestrians.js';
import { writeSave } from './save.js';
import { clamp, dist2d, wrapAngle, makeRng } from './util.js';
import { sfx } from './audio.js';

const rng = makeRng(4242);
const FARE_POINTS = [PLACES.hospital, PLACES.policeStation, PLACES.clockTower, PLACES.beachBar,
  PLACES.marinaDock, PLACES.lighthouse, PLACES.warehouse, PLACES.plaza];

/** Open a conversation; onDone fires when the last line is read. */
export function startDialogue(lines, onDone) {
  G.dialogue = { lines, index: 0, onDone: onDone ?? null };
}

/** Advance the open conversation one line (the E key, via main.js). */
export function advanceDialogue() {
  if (!G.dialogue) return;
  G.dialogue.index += 1;
  sfx.ui();
  if (G.dialogue.index >= G.dialogue.lines.length) {
    const cb = G.dialogue.onDone;
    G.dialogue = null;
    if (cb) cb();
  }
}

/** The world point the current business points at, or null. */
export function objectivePoint() {
  const m = G.mission;
  if (!m || m.pending) {
    const def = MISSIONS[G.missionIndex];
    return def ? { x: def.startAt.x, z: def.startAt.z } : null;
  }
  const stage = m.def.stages[m.stageIndex];
  if (!stage) return null;
  switch (stage.kind) {
    case 'race': return m.racePoint ?? stage.at;
    case 'fare': return m.farePair ? (m.farePhase === 'drop' ? m.farePair.drop : m.farePair.pickup) : stage.at ?? PLACES.plaza;
    case 'takedown': return m.targetCar ? { x: m.targetCar.x, z: m.targetCar.z } : stage.at;
    default: return stage.at ?? null;
  }
}

/** The mission panel's four lines, as hud.js prints them. */
export function missionPanelInfo() {
  const m = G.mission;
  if (!m) {
    const def = MISSIONS[G.missionIndex];
    return {
      title: def ? def.title : 'Puerto Alba',
      stage: def ? 'NEW JOB' : '',
      objective: def ? `See ${CHARACTERS[def.giver].name.split(' ')[0]} — ${def.title}` : 'The city is yours',
      next: def ? def.stages[0].text : '',
      timer: null,
    };
  }
  const stage = m.def.stages[m.stageIndex];
  const following = m.def.stages[m.stageIndex + 1];
  return {
    title: m.def.title,
    stage: `STAGE ${m.stageIndex + 1} OF ${m.def.stages.length}`,
    objective: stage ? stage.text : '',
    next: following ? following.next ?? following.text : (m.def.outro?.[0]?.text ?? 'Collect your cut'),
    timer: m.timerLeft != null ? Math.max(0, m.timerLeft) : null,
  };
}

// ------------------------------------------------------------- lifecycle
function cleanupStageSpawns(m) {
  for (const ped of m.hostiles ?? []) if (!ped.dead) { removePed(ped); }
  m.hostiles = [];
  if (m.targetCar) { removeCar(m.targetCar); m.targetCar = null; }
}

function activateStage(m, index) {
  cleanupStageSpawns(m);
  m.stageIndex = index;
  m.timerLeft = null;
  m.hostilesLeft = 0;
  const stage = m.def.stages[index];
  if (!stage) return;
  if (stage.kind === 'timed') m.timerLeft = stage.time;
  if (stage.kind === 'fight') {
    const at = stage.at;
    for (let i = 0; i < (stage.count ?? 3); i += 1) {
      const a = (i / (stage.count ?? 3)) * Math.PI * 2;
      const ped = spawnPedAt(at.x + Math.cos(a) * 9, at.z + Math.sin(a) * 9, 'hostile', { hp: 40 });
      m.hostiles.push(ped);
    }
    m.hostilesLeft = m.hostiles.length;
    m.onPedDown = (ped) => {
      if (m.hostiles.includes(ped)) {
        m.hostilesLeft -= 1;
        G.toastQueue.push(`${m.hostilesLeft} still standing`);
      }
    };
  }
  if (stage.kind === 'race') {
    const c = PLACES.raceStart;
    m.racePoints = [];
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      m.racePoints.push({ x: c.x + Math.cos(a) * 85, z: c.z + Math.sin(a) * 85 });
    }
    m.raceIndex = 0;
    m.racePoint = m.racePoints[0];
  }
  if (stage.kind === 'fare') {
    m.fareCount = 0;
    nextFare(m);
  }
  if (stage.kind === 'takedown') {
    const at = stage.at;
    const car = createCar('sport', at.x + 14, at.z + 6, 0.6, 0x6b6f75, rng);
    car.driver = 'traffic';
    car.hp = 60; car.maxHp = 60;
    m.targetCar = car;
    G.trafficCars.push(car);
  }
}

function nextFare(m) {
  const pickup = FARE_POINTS[Math.floor(rng() * FARE_POINTS.length) % FARE_POINTS.length];
  let drop = FARE_POINTS[Math.floor(rng() * FARE_POINTS.length) % FARE_POINTS.length];
  if (drop === pickup) drop = PLACES.plaza;
  m.farePair = { pickup, drop };
  m.farePhase = 'pickup';
}

function beginMission(def) {
  G.mission = {
    def, stageIndex: 0, targetCar: null, hostiles: [], hostilesLeft: 0,
    timerLeft: null, farePhase: null, farePair: null, fareCount: 0, raceIndex: 0,
    racePoints: null, racePoint: null, onEnterCar: null, onPedDown: null, pending: true,
  };
  startDialogue(def.intro, () => {
    G.mission.pending = false;
    activateStage(G.mission, 0);
  });
}

function completeMission(m) {
  const def = m.def;
  G.cash += def.cash;
  G.respect += def.respect;
  G.rankIndex = rankFor(G.respect).index;
  G.completedJobs.push(def.id);
  G.missionIndex += 1;
  cleanupStageSpawns(m);
  G.mission = null;
  sfx.cash();
  G.toastQueue.push(`${def.title} done — $${def.cash}, +${def.respect} respect`);
  if (def.outro?.length) startDialogue(def.outro, null);
  writeSave();
}

function completeStage(m) {
  sfx.chime();
  if (m.stageIndex + 1 >= m.def.stages.length) completeMission(m);
  else activateStage(m, m.stageIndex + 1);
}

/** Restart the active job from its first stage (pause menu / failure). */
export function restartCurrentJob() {
  const m = G.mission;
  if (!m) return;
  cleanupStageSpawns(m);
  m.pending = false;
  G.dialogue = null;
  activateStage(m, 0);
  G.toastQueue.push(`${m.def.title} — from the top`);
}

// ---------------------------------------------------------------- loop
export function updateMissions(dt) {
  // Offer the next job when the runner reaches its giver.
  if (!G.mission && !G.dialogue && G.missionIndex < MISSIONS.length) {
    const def = MISSIONS[G.missionIndex];
    if (dist2d(G.player.x, G.player.z, def.startAt.x, def.startAt.z) < 7) beginMission(def);
    return;
  }
  const m = G.mission;
  if (!m || m.pending || G.dialogue) return;
  const stage = m.def.stages[m.stageIndex];
  if (!stage) return;
  const p = G.player;
  const dAt = stage.at ? dist2d(p.x, p.z, stage.at.x, stage.at.z) : Infinity;

  if (m.timerLeft != null) {
    m.timerLeft -= dt;
    if (m.timerLeft <= 0) {
      G.toastQueue.push('Out of time — the job resets');
      sfx.fail();
      restartCurrentJob();
      return;
    }
  }

  switch (stage.kind) {
    case 'goto':
      if (dAt < 5.5) completeStage(m);
      break;
    case 'steal':
      if (p.inCar && dAt < 30) completeStage(m);
      break;
    case 'deliverCar':
      if (p.inCar && dAt < 7) {
        const car = p.inCar;
        p.inCar = null;
        removeCar(car);
        G.player.mesh.visible = true;
        completeStage(m);
      }
      break;
    case 'timed':
      if (dAt < 7) completeStage(m);
      break;
    case 'escape':
      if (dAt < 7 && G.wanted < 0.5) completeStage(m);
      break;
    case 'fight':
      if (m.hostilesLeft <= 0) completeStage(m);
      break;
    case 'race': {
      const cp = m.racePoint;
      if (cp && dist2d(p.x, p.z, cp.x, cp.z) < 9) {
        m.raceIndex += 1;
        if (m.raceIndex >= m.racePoints.length) completeStage(m);
        else m.racePoint = m.racePoints[m.raceIndex];
      }
      break;
    }
    case 'fare': {
      const target = m.farePhase === 'drop' ? m.farePair.drop : m.farePair.pickup;
      if (dist2d(p.x, p.z, target.x, target.z) < 6) {
        if (m.farePhase === 'pickup') {
          m.farePhase = 'drop';
          G.toastQueue.push('Fare aboard — drive smooth');
        } else {
          m.fareCount += 1;
          sfx.cash();
          if (m.fareCount >= (stage.count ?? 3)) completeStage(m);
          else nextFare(m);
        }
      }
      break;
    }
    case 'takedown': {
      const car = m.targetCar;
      if (!car || car.dead) { completeStage(m); break; }
      // The wheelman runs: steer him away from the runner, always.
      const away = Math.atan2(car.x - p.x, car.z - p.z);
      const steer = clamp(wrapAngle(away - car.heading), -1, 1);
      driveCar(car, { throttle: 0.95, steer, handbrake: false }, dt);
      break;
    }
    default:
      break;
  }
}

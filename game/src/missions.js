// missions.js — the stage engine: reads story.js data, tracks the live
// stage, feeds the HUD panel and the map objective, pays out at the end.

import { G } from './state.js';
import { dist2d } from './util.js';
import { PLACES } from './city.js';
import { MISSIONS, CHARACTERS } from './story.js';
import { rankFor } from './state.js';
import { writeSave } from './save.js';
import { spawnPedAt, hurtPed } from './pedestrians.js';
import { addCrime, clearWanted } from './police.js';

export function currentMission() {
  if (!G.mission) return null;
  return MISSIONS[G.mission.index] || null;
}

export function currentStage() {
  const m = currentMission();
  if (!m || !G.mission) return null;
  return m.stages[G.mission.stage] || null;
}

export function startMission(index) {
  const m = MISSIONS[index];
  if (!m) return;
  G.mission = { index, stage: 0, timerLeft: null, active: true, checkpoint: 0, kills: 0, targetPed: null };
  armStage();
  startDialogue(m.intro, null);
}

function armStage() {
  const st = currentStage();
  if (!st || !G.mission) return;
  G.mission.timerLeft = st.time || null;
  G.mission.checkpoint = 0;
  G.mission.kills = 0;
  if (st.type === 'fight' || st.type === 'takedown') spawnStageEnemies(st);
}

function spawnStageEnemies(st) {
  const at = st.place ? PLACES[st.place] : { x: G.player.x + 8, z: G.player.z + 8 };
  if (st.type === 'takedown') {
    const ped = spawnPedAt(at.x + 3, at.z + 2, 'stand', { outfit: { shirt: 0xd8402e }, seed: 9101 });
    ped.name = 'lieutenant';
    G.mission.targetPed = ped;
    return;
  }
  const n = st.enemies || 3;
  for (let i = 0; i < n; i++) {
    const ped = spawnPedAt(at.x + (i - n / 2) * 3.2, at.z + 4 + (i % 2) * 3, 'stand', {
      outfit: { shirt: 0xd8402e }, seed: 9200 + i, weapon: 'smg',
    });
    ped.name = 'hostile';
    ped.state = 'hostile';
  }
}

export function objectivePoint() {
  const st = currentStage();
  if (!st || !G.mission || !G.mission.active) return null;
  if (st.type === 'escape') return null;
  if ((st.type === 'race' || st.type === 'fare') && st.checkpoints) {
    const key = st.checkpoints[Math.min(G.mission.checkpoint, st.checkpoints.length - 1)];
    const p = PLACES[key];
    return p ? { x: p.x, z: p.z, label: p.label } : null;
  }
  if (st.place && PLACES[st.place]) {
    const p = PLACES[st.place];
    return { x: p.x, z: p.z, label: p.label };
  }
  return null;
}

export function missionPanelInfo() {
  const m = currentMission();
  const st = currentStage();
  if (!m || !st || !G.mission.active) return null;
  return {
    title: m.title,
    stage: `STAGE ${G.mission.stage + 1} OF ${m.stages.length}`,
    objective: st.objective,
    next: st.next,
    timer: G.mission.timerLeft,
  };
}

// --- Dialogue ---------------------------------------------------------------

export function startDialogue(lines, onDone) {
  if (!lines || !lines.length) { if (onDone) onDone(); return; }
  G.dialogue = { lines, index: 0, onDone: onDone || null };
}

export function advanceDialogue() {
  const d = G.dialogue;
  if (!d) return;
  d.index++;
  if (d.index >= d.lines.length) {
    G.dialogue = null;
    if (d.onDone) d.onDone();
  }
}

// --- Flow -------------------------------------------------------------------

export function restartCurrentJob() {
  if (!G.mission) return;
  const idx = G.mission.index;
  clearWanted();
  G.health = Math.max(G.health, 60);
  startMission(idx);
}

function completeMission() {
  const m = currentMission();
  if (!m) return;
  G.cash += m.reward.cash;
  G.respect += m.reward.respect;
  const r = rankFor(G.respect);
  G.rankIndex = r.index;
  if (m.unlock && !G.unlocked[m.unlock]) {
    G.unlocked[m.unlock] = true;
    G.ammo[m.unlock] = m.unlock === 'pistol' ? 48 : m.unlock === 'smg' ? 90 : 12;
  }
  const nextIndex = G.mission.index + 1;
  G.mission = null;
  writeSave();
  startDialogue(m.outro, () => {
    if (nextIndex < MISSIONS.length) startMission(nextIndex);
  });
}

function advanceStage() {
  const m = currentMission();
  if (!m || !G.mission) return;
  G.mission.stage++;
  if (G.mission.stage >= m.stages.length) { completeMission(); return; }
  armStage();
}

function stageSatisfied(st) {
  const p = G.player;
  if (!p) return false;
  const obj = objectivePoint();
  switch (st.type) {
    case 'goto':
      return obj && dist2d(p.x, p.z, obj.x, obj.z) < (st.radius || 7);
    case 'steal':
      return !!p.car;
    case 'deliverCar':
      return !!p.car && obj && dist2d(p.x, p.z, obj.x, obj.z) < (st.radius || 8);
    case 'timed':
      return !!obj && dist2d(p.car ? p.car.x : p.x, p.car ? p.car.z : p.z, obj.x, obj.z) < (st.radius || 9);
    case 'escape':
      return G.wanted < 0.4;
    case 'fight': {
      const alive = G.peds.filter((x) => x.name === 'hostile' && !x.down);
      return alive.length === 0;
    }
    case 'takedown':
      return !!(G.mission.targetPed && G.mission.targetPed.down);
    case 'race':
    case 'fare': {
      if (!obj) return false;
      const px = p.car ? p.car.x : p.x, pz = p.car ? p.car.z : p.z;
      if (dist2d(px, pz, obj.x, obj.z) < (st.radius || 9)) {
        G.mission.checkpoint++;
        if (G.mission.checkpoint >= st.checkpoints.length) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

export function updateMissions(dt) {
  if (!G.mission || !G.mission.active || G.shotMode || G.dialogue) return;
  const st = currentStage();
  if (!st) return;
  if (G.mission.timerLeft !== null && G.mission.timerLeft !== undefined) {
    G.mission.timerLeft -= dt;
    if (G.mission.timerLeft <= 0) {
      G.mission.timerLeft = st.time || 60;
      addCrime(0.4, 'Running late');
    }
  }
  if (stageSatisfied(st)) advanceStage();
}

// Boot helper for a fresh game: Marisol's first job is always on the board.
export function offerFirstMission() {
  if (!G.mission) startMission(0);
}

export { CHARACTERS };

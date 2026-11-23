// missions.js — the job engine. It offers the next story job at its
// giver's corner (cyan beacon), plays the intro dialogue, then walks
// the job's stages (story.js data) one by one: gold beacon on the
// objective, HUD panel fed from here, timers, fleeing target cars,
// shootout crews (their health scales with the job's place in the
// story, to match the heavier arsenal they face), checkpoint races and
// taxi fares. Finishing pays cash and respect, saves, and offers the
// next job. After the finale, Dario keeps handing out single taxi
// fares. The staged screenshots borrow this engine's record shape
// (shots.js builds the same mission object by hand) so the HUD over a
// frozen frame reports a real job at a real stage.
import { G, rankFor } from './state.js';
import { MISSIONS, CHARACTERS } from './story.js';
import { PLACES } from './city.js';
import { createCar, driveCar, removeCar } from './vehicles.js';
import { spawnPedAt, removePed } from './pedestrians.js';
import { writeSave } from './save.js';
import { clamp, dist2d, wrapAngle, makeRng } from './util.js';
import { sfx } from './audio.js';

const rng = makeRng(555);

let beacon = null;
let beaconRing = null;

function ensureBeacon() {
  if (beacon) return;
  const geo = new THREE.CylinderGeometry(1.5, 1.5, 36, 14, 1, true);
  beacon = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color: 0xffb340, transparent: true, opacity: 0.2,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  beacon.position.y = 18;
  const ringGeo = new THREE.RingGeometry(2.1, 2.9, 26);
  beaconRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: 0xffb340, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false,
  }));
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.15;
  G.scene.add(beacon); G.scene.add(beaconRing);
}

function placeBeacon(x, z, colorHex) {
  ensureBeacon();
  // Up close the pillar is a white-out column; the ring alone guides the last metres.
  const nearPlayer = Math.hypot(G.player.x - x, G.player.z - z) < 6.5;
  beacon.visible = !nearPlayer;
  beaconRing.visible = true;
  beacon.position.x = x; beacon.position.z = z;
  beaconRing.position.x = x; beaconRing.position.z = z;
  beacon.material.color.setHex(colorHex);
  beaconRing.material.color.setHex(colorHex);
}

function hideBeacon() {
  if (beacon) { beacon.visible = false; beaconRing.visible = false; }
}

/** The point the minimap and HUD should point at right now. */
export function objectivePoint() {
  const m = G.mission;
  if (!m) {
    const def = MISSIONS[G.missionIndex];
    return def ? { x: def.startAt.x, z: def.startAt.z, kind: 'giver' } : null;
  }
  const s = m.def.stages[m.stageIndex];
  if (!s) return null;
  if (s.kind === 'fare') {
    const pt = m.farePhase === 'pickup' ? m.farePair.from : m.farePair.to;
    return { x: pt.x, z: pt.z, kind: m.farePhase };
  }
  if (s.kind === 'race') {
    const cp = s.checkpoints[Math.min(m.raceIndex, s.checkpoints.length - 1)];
    return { x: cp.x, z: cp.z, kind: 'race' };
  }
  if (s.kind === 'escape') return null;
  if (m.targetCar && (s.kind === 'steal' || s.kind === 'chase' || s.kind === 'pickup')) {
    return { x: m.targetCar.x, z: m.targetCar.z, kind: 'target' };
  }
  return s.at ? { x: s.at.x, z: s.at.z, kind: s.kind } : null;
}

/** Lines for the HUD mission panel. */
export function missionPanelInfo() {
  const m = G.mission;
  if (!m) {
    const def = MISSIONS[G.missionIndex];
    if (!def) return { title: 'Puerto Alba is yours', stage: 'Free roam', objective: 'Every job is done. The garage still runs fares — or just drive.', next: 'Visit Dario’s garage for taxi work' };
    const giver = CHARACTERS[def.giver];
    return { title: `Next job: ${def.title}`, stage: `${giver.short} is waiting`, objective: `Meet ${giver.name} to start.`, next: 'Follow the cyan beacon' };
  }
  const s = m.def.stages[m.stageIndex];
  if (!s) {
    // The intro conversation is still running; the stages have not begun.
    return { title: m.def.title, stage: 'A conversation', objective: 'Hear them out.', next: 'E — continue' };
  }
  let objective = s.objective;
  if (s.kind === 'fare') objective = m.farePhase === 'pickup'
    ? `Pick up ${m.farePair.fareName}` : `Drop off ${m.farePair.fareName}`;
  if (s.kind === 'race') objective = `${s.objective} — gate ${m.raceIndex + 1}/${s.checkpoints.length}`;
  if (s.kind === 'shootout') objective = `${s.objective} (${m.hostilesLeft} still standing)`;
  return {
    title: m.def.title,
    stage: `Stage ${m.stageIndex + 1}/${m.def.stages.length}`,
    objective, next: s.next ?? '',
    timer: m.timerLeft != null ? m.timerLeft : null,
  };
}

// ---------------------------------------------------------------- dialogues
export function startDialogue(lines, onDone) {
  G.dialogue = { lines, index: 0, onDone };
  sfx.ui();
}

export function advanceDialogue() {
  const d = G.dialogue;
  if (!d) return;
  d.index += 1;
  sfx.ui();
  if (d.index >= d.lines.length) {
    G.dialogue = null;
    if (d.onDone) d.onDone();
  }
}

// ---------------------------------------------------------------- lifecycle
function beginMission(def) {
  G.mission = {
    def, stageIndex: -1, targetCar: null, hostiles: [], hostilesLeft: 0,
    timerLeft: null, farePhase: null, farePair: null, fareCount: 0, raceIndex: 0,
    onEnterCar: null, onPedDown: null,
  };
  startDialogue(def.intro, () => nextStage());
}

function nextStage() {
  const m = G.mission;
  if (!m) return;
  cleanupStage();
  m.stageIndex += 1;
  const s = m.def.stages[m.stageIndex];
  if (!s) { completeMission(); return; }
  m.timerLeft = s.timer ?? null;
  if (s.heat) { G.wanted = Math.max(G.wanted, s.heat); G.lastCrimeAt = G.elapsed; }

  if (s.kind === 'steal') {
    m.targetCar = createCar(s.carType, s.at.x, s.at.z, rng() * Math.PI * 2, null, rng);
    m.targetCar.driver = 'parked';
    m.targetCar.missionTarget = true;
    G.parkedCars.push(m.targetCar);
  }
  if (s.kind === 'chase') {
    m.targetCar = createCar(s.carType, m.def.stages[m.stageIndex - 1]?.at?.x ?? G.player.x + 30,
      m.def.stages[m.stageIndex - 1]?.at?.z ?? G.player.z + 30, 0, 0xffcf3f, rng);
    m.targetCar.driver = 'target';
    m.targetCar.hp = m.targetCar.maxHp = 130;
  }
  if (s.kind === 'shootout') {
    m.hostiles = [];
    const crewHp = 34 + G.missionIndex * 3; // later crews have eaten more lead
    for (let i = 0; i < s.count; i += 1) {
      const a = (i / s.count) * Math.PI * 2;
      const ped = spawnPedAt(s.at.x + Math.sin(a) * (6 + rng() * 6), s.at.z + Math.cos(a) * (6 + rng() * 6), 'hostile', { hp: crewHp });
      ped.missionHostile = true;
      m.hostiles.push(ped);
    }
    m.hostilesLeft = s.count;
    m.onPedDown = (ped) => { if (ped.missionHostile) m.hostilesLeft -= 1; };
  }
  if (s.kind === 'race') m.raceIndex = 0;
  if (s.kind === 'fare') { m.fareCount = 0; startFarePair(); }
}

function startFarePair() {
  const m = G.mission;
  const s = m.def.stages[m.stageIndex];
  m.farePair = s.pairs[m.fareCount];
  m.farePhase = 'pickup';
  m.farePed = spawnPedAt(m.farePair.from.x + 2, m.farePair.from.z + 2, 'fare', {});
}

function cleanupStage() {
  const m = G.mission;
  if (!m) return;
  m.onEnterCar = null; m.onPedDown = null;
  if (m.farePed && !m.farePed.dead) { removePed(m.farePed); m.farePed = null; }
}

function failMission(reason) {
  const m = G.mission;
  if (!m) return;
  sfx.fail();
  G.bannerQueue.push({ big: 'Job failed', sub: reason });
  if (m.targetCar && m.targetCar.missionTarget) {
    const idx = G.parkedCars.indexOf(m.targetCar);
    if (idx >= 0) G.parkedCars.splice(idx, 1);
    removeCar(m.targetCar);
  }
  if (m.hostiles) for (const ped of m.hostiles) if (!ped.dead) removePed(ped);
  cleanupStage();
  G.mission = null;
  hideBeacon();
}

function completeMission() {
  const m = G.mission;
  const def = m.def;
  cleanupStage();
  G.mission = null;
  hideBeacon();
  G.cash += def.pay;
  G.respect += def.respect;
  G.ammo.pistol += 24; G.ammo.smg += 40; G.ammo.shotgun += 10;
  sfx.cash();
  const newRank = rankFor(G.respect);
  let unlockNote = '';
  if (newRank.index > G.rankIndex) {
    G.rankIndex = newRank.index;
    if (newRank.name === 'Fixer' && !G.unlockedWeapons.includes('smg')) { G.unlockedWeapons.push('smg'); unlockNote = 'SMG unlocked (slot 3)'; }
    if (newRank.name === 'Shotgun' && !G.unlockedWeapons.includes('shotgun')) { G.unlockedWeapons.push('shotgun'); unlockNote = 'Shotgun unlocked (slot 4)'; }
  }
  if (!def.repeatable) {
    G.completedJobs.push(def.id);
    G.missionIndex = Math.min(G.missionIndex + 1, MISSIONS.length);
  }
  writeSave();
  G.bannerQueue.push({ big: 'Job complete', sub: `${def.title} — $${def.pay} · +${def.respect} respect${unlockNote ? ` · ${unlockNote}` : ''}` });
  if (def.outro) startDialogue(def.outro, null);
}

/** Pause-menu restart: abandon the current job back to its offer. */
export function restartCurrentJob() {
  if (G.mission) failMission('Job abandoned — the offer still stands');
}

// ------------------------------------------------------------- repeat fares
function repeatFareDef() {
  const spots = [PLACES.plaza, PLACES.hospital, PLACES.marinaGate, PLACES.beachBar, PLACES.policeStation, PLACES.lighthouse];
  const from = spots[Math.floor(rng() * spots.length)];
  let to = spots[Math.floor(rng() * spots.length)];
  if (to === from) to = PLACES.plaza;
  return {
    id: 'fare-repeat', title: 'Taxi Fare', giver: 'dario', startAt: PLACES.garagePad,
    pay: 130, respect: 12, repeatable: true, intro: null, outro: null,
    stages: [
      { kind: 'steal', at: { x: -196, z: -52 }, carType: 'taxi', objective: 'Take the Taxi Alba cab', next: 'Parked by the garage' },
      { kind: 'fare', objective: 'Work the fare', next: 'Gold: pickup · Blue: dropoff', pairs: [{ from, to, fareName: 'a fare' }] },
      { kind: 'goto', at: PLACES.garagePad, radius: 8, objective: 'Bring the cab home', next: 'Park it by the garage' },
    ],
  };
}

// ------------------------------------------------------------------- update
export function updateMissions(dt) {
  const p = G.player;

  // No active job: offer the next one at its beacon.
  if (!G.mission) {
    const def = MISSIONS[G.missionIndex];
    if (def) {
      placeBeacon(def.startAt.x, def.startAt.z, 0x57d7e8);
      if (!p.inCar && !G.dialogue && dist2d(p.x, p.z, def.startAt.x, def.startAt.z) < 3.4) beginMission(def);
    } else {
      // Story done: Dario's endless fares from the garage.
      placeBeacon(PLACES.garagePad.x, PLACES.garagePad.z, 0x57d7e8);
      if (!p.inCar && !G.dialogue && dist2d(p.x, p.z, PLACES.garagePad.x, PLACES.garagePad.z) < 3.4) {
        const def2 = repeatFareDef();
        G.mission = {
          def: def2, stageIndex: -1, targetCar: null, hostiles: [], hostilesLeft: 0,
          timerLeft: null, farePhase: null, farePair: null, fareCount: 0, raceIndex: 0,
          onEnterCar: null, onPedDown: null,
        };
        nextStage();
      }
    }
    return;
  }

  const m = G.mission;
  const s = m.def.stages[m.stageIndex];
  if (!s || G.dialogue) { hideBeaconIfIdle(); return; }

  // Objective beacon (gold; blue for fare dropoffs).
  const pt = objectivePoint();
  if (pt) placeBeacon(pt.x, pt.z, pt.kind === 'dropoff' ? 0x5f8dff : 0xffb340);
  else hideBeacon();

  // Timers.
  if (m.timerLeft != null) {
    m.timerLeft -= dt;
    if (m.timerLeft <= 0) { failMission('Out of time'); return; }
  }

  // The chase target flees while its stage runs.
  if (m.targetCar && m.targetCar.driver === 'target' && !m.targetCar.dead) {
    const car = m.targetCar;
    const away = Math.atan2(car.x - p.x, car.z - p.z);
    const desired = away + Math.sin(G.elapsed * 0.6) * 0.35;
    const steer = clamp(wrapAngle(desired - car.heading) * 1.5, -1, 1);
    driveCar(car, { throttle: 0.95, steer, handbrake: false }, dt);
    if (car.hp <= car.maxHp * 0.3) {
      car.driver = 'wreck';
      G.toastQueue.push('Target disabled — grab the case!');
    }
  }
  if (m.targetCar && m.targetCar.driver === 'wreck') m.targetCar.speed *= 0.9;

  // Target car destroyed where the job needed it whole.
  if (m.targetCar && m.targetCar.dead && (s.kind === 'steal' || s.kind === 'deliver')) {
    failMission('The car was destroyed');
    return;
  }

  const at = s.at ?? (m.targetCar ? { x: m.targetCar.x, z: m.targetCar.z } : null);
  const near = at ? dist2d(p.x, p.z, at.x, at.z) : Infinity;

  switch (s.kind) {
    case 'goto': if (near < (s.radius ?? 7)) nextStage(); break;
    case 'pickup': if (!p.inCar && near < (s.radius ?? 5)) nextStage(); break;
    case 'steal': if (p.inCar === m.targetCar) nextStage(); break;
    case 'deliver': {
      const inRightCar = s.anyCar ? !!p.inCar : p.inCar === m.targetCar;
      if (inRightCar && near < (s.radius ?? 8)) nextStage();
      break;
    }
    case 'drive': {
      const inRightCar = s.anyCar ? !!p.inCar : (m.targetCar ? p.inCar === m.targetCar : !!p.inCar);
      if (inRightCar && near < (s.radius ?? 9)) nextStage();
      break;
    }
    case 'chase':
      if (m.targetCar && (m.targetCar.driver === 'wreck' || m.targetCar.dead)) nextStage();
      break;
    case 'shootout':
      if (m.hostilesLeft <= 0) nextStage();
      break;
    case 'escape':
      if (G.wanted <= 0.02) nextStage();
      break;
    case 'race': {
      const cp = s.checkpoints[m.raceIndex];
      // An 11 m gate: at boulevard speed the old 10 m circle could be
      // crossed inside one frame's travel and still feel missed.
      if (p.inCar && dist2d(p.x, p.z, cp.x, cp.z) < 11) {
        m.raceIndex += 1;
        sfx.chime();
        if (m.raceIndex >= s.checkpoints.length) nextStage();
      }
      break;
    }
    case 'fare': {
      if (m.farePhase === 'pickup') {
        if (p.inCar && dist2d(p.x, p.z, m.farePair.from.x, m.farePair.from.z) < 7 && Math.abs(p.inCar.speed) < 1.5) {
          removePed(m.farePed); m.farePed = null;
          m.farePhase = 'dropoff';
          sfx.door();
          G.toastQueue.push('Passenger in — drive gentle');
        }
      } else if (p.inCar && dist2d(p.x, p.z, m.farePair.to.x, m.farePair.to.z) < 8 && Math.abs(p.inCar.speed) < 1.5) {
        m.fareCount += 1;
        G.cash += 45;
        sfx.cash();
        G.toastQueue.push('Fare paid — $45 tip included');
        if (m.fareCount >= s.pairs.length) nextStage();
        else startFarePair();
      }
      break;
    }
    default: break;
  }
}

function hideBeaconIfIdle() { /* beacon stays on the objective during dialogue */ }

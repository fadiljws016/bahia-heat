// state.js — the single game-state object G plus rank progression.
// Every module imports G from here; nothing else owns global state.

export const MODE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', ENDED: 'ended' };

export const RANKS = [
  { name: 'Nobody', at: 0 },
  { name: 'Runner', at: 25 },
  { name: 'Wheelman', at: 150 },
  { name: 'Fixer', at: 400 },
  { name: 'Shot Caller', at: 900 },
  { name: 'Kingpin', at: 1600 },
];

export function rankFor(respect) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (respect >= RANKS[i].at) idx = i;
  return { index: idx, name: RANKS[idx].name };
}

export const G = {
  mode: MODE.MENU,
  timeHours: 17.4,          // golden-hour start for a fresh game
  dayLength: 480,           // seconds per full in-game day in live play
  shotMode: false,
  shotName: '',
  // World handles, filled by world.js initWorld.
  scene: null,
  camera: null,
  renderer: null,
  city: null,               // buildCityData result
  stagedCam: null,          // camera.js override while staging
  // Actors.
  player: null,             // { mesh, x, z, heading, car, health, ... }
  cars: [],
  peds: [],
  officers: [],
  heli: null,
  // Progression.
  cash: 120,
  respect: 10,
  rankIndex: 0,
  health: 100,
  armor: 0,
  wanted: 0,                // 0..5, fractional while it builds
  wantedFloor: 0,
  // Weapons: fists always owned, the rest unlock through the story.
  unlocked: { fists: true, pistol: false, smg: false, shotgun: false },
  ammo: { pistol: 0, smg: 0, shotgun: 0 },
  weapon: 'fists',
  // Mission runtime: { index, stage, timerLeft, active, stageData }.
  mission: null,
  dialogue: null,           // { lines, index, onDone }
  // Systems flags the HUD and staging read.
  mapOpen: false,
  garageOpen: false,
  interactText: '',
  heliSeesPlayer: false,
  roadblock: null,          // { x, z, cars } while a blockade stands
  isDusk: false,
  district: '',
  over: false,
};

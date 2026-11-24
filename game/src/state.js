// state.js — the single game-state object G plus the rank ladder and modes.
// Every module imports G from here; nothing keeps a private copy of the
// truth, which is what lets the screenshot staging drive the whole game
// from shots.js by writing a handful of fields.

export const MODE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', ENDED: 'ended' };

export const RANKS = [
  { name: 'Runner', at: 0 },
  { name: 'Courier', at: 150 },
  { name: 'Wheelman', at: 350 },
  { name: 'Fixer', at: 640 },
  { name: 'Shot Caller', at: 1000 },
  { name: 'Kingpin', at: 1500 },
];

export function rankFor(respect) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i += 1) {
    if (respect >= RANKS[i].at) idx = i;
  }
  return idx;
}

export const G = {
  mode: MODE.MENU,
  shotMode: null, // 'cover' | 'drive' | 'chase' | 'combat' while staging
  elapsed: 0, // seconds since boot; frozen in shot mode
  timeHours: 17.55, // hour of day that drives the sky
  isDusk: false, // set by world.js from timeHours
  scene: null,
  camera: null,
  renderer: null,
  city: null, // buildCityData result
  player: null, // { x, z, heading, mesh, hp, car, ... }
  cars: [],
  peds: [],
  officers: [],
  heli: null, // { x, z, active }
  heliSeesPlayer: false,
  roadblock: null, // { x, z, heading } while a PAPD roadblock stands
  wanted: 0, // 0..5 stars, fractional
  heat: 0, // builds wanted when crimes are witnessed
  cash: 250,
  respect: 40,
  get rankIndex() { return rankFor(this.respect); },
  weapons: {
    unlocked: { fists: true, pistol: true, smg: false, shotgun: false },
    ammo: { pistol: 60, smg: 0, shotgun: 0 },
    current: 'pistol',
  },
  dialogue: null, // { lines, index, onDone }
  mission: null, // live mission runtime (missions.js)
  mapOpen: false,
  over: false, // busted / wasted overlay latch
  message: '', // transient centre-screen toast
  messageT: 0,
  garageOpen: false,
  race: null, // live race runtime
};

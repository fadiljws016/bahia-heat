// state.js — G, the one shared game state. Every system imports it and
// reads or writes its own slice; there is no other global. main.js owns
// the mode machine (menu / playing / paused / ended) and the clock; the
// systems own their actors; the presentation queues (toasts, banners,
// blasts) are drained by whoever renders them. Fields a screenshot stage
// needs to fake — mission, dialogue, wanted heat — are ordinary slices
// here, which is exactly why shots.js can arrange a believable frozen
// instant without special-casing anything.

export const MODE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', ENDED: 'ended' };

export const G = {
  mode: MODE.MENU,
  shotMode: null,          // ?shot=<name> — stage a frozen scene instead of the menu
  seed: 20261123,          // the city's seed: Puerto Alba is the same on every visit

  // three.js handles, filled by world.js
  renderer: null, scene: null, camera: null, sun: null, sunTarget: null,
  hemi: null, fog: null, spotlight: null, isDusk: false,

  timeHours: 17.2,         // the port runs on golden hour: 17:12 at boot
  dayLengthSec: 600,       // a full day passes in ten real minutes
  elapsed: 0,

  city: null,              // the generated city, filled by city.js

  // the player (player.js) — a plain record the systems share
  player: {
    mesh: null, x: 0, z: 0, heading: 0, speed: 0,
    health: 100, armor: 0, inCar: null, dead: false,
    walkPhase: 0, punchTimer: 0, lastDamageAt: -99, aimPose: 0,
  },

  // actors, each filled by its own system
  trafficCars: [],         // traffic.js
  policeCars: [],          // police.js
  officers: [],            // officers.js — PAPD on foot
  parkedCars: [],          // vehicles.js spawns, anyone may enter
  peds: [],                // pedestrians.js
  heli: null,              // helicopter.js

  // wanted / police pressure (police.js)
  wanted: 0,               // 0..5 stars, fractional heat underneath
  heat: 0,
  sightState: 'lost',      // 'insight' | 'searching' | 'lost'
  timeSinceSeen: 99,
  bustedTimer: 0,
  busted: false,
  lastShotAt: -99,
  lastCrimeAt: -99,
  lastCrimeLabel: '',

  // economy & progression (the save.js shape)
  cash: 250,
  respect: 0,
  rankIndex: 0,
  unlockedWeapons: ['fists', 'pistol'],
  currentWeapon: 'fists',
  ammo: { pistol: 60, smg: 0, shotgun: 0 },
  missionIndex: 0,         // next story job to offer
  completedJobs: [],
  garageLevels: { engine: 0, armor: 0 },
  taxiFaresDone: 0,

  // the mission engine (missions.js)
  mission: null,           // { def, stageIndex, stage data... }
  dialogue: null,          // { lines, index, ... } while a conversation is up
  race: null,              // active checkpoint race state

  mapOpen: false,          // the full-screen city map; play freezes behind it

  // presentation helpers other systems poke
  toastQueue: [],
  bannerQueue: [],
  blastQueue: [],
  damageFlash: 0,
  cameraShake: 0,
  heliSeesPlayer: false,
  policeAggro: false,
  hudNote: null,           // a one-line note under the crosshair
  hudNoteAt: -99,
  bustMeter: 0,            // 0..1 while the PAPD is close to a bust
  aimingT: 0,              // > 0 while the player holds an aim pose
  punchT: 0,               // > 0 during a fist swing
  camYaw: 0, camPitch: 0.32, // camera orbit (camera.js)
  aimPoint: null,          // crosshair ground point, kept fresh by camera.js
};

// The ladder the respect total climbs, Runner to Kingpin of Puerto Alba.
export const RANKS = [
  { name: 'Runner', at: 0 },
  { name: 'Courier', at: 150 },
  { name: 'Wheelman', at: 350 },
  { name: 'Fixer', at: 600 },
  { name: 'Shotgun', at: 900 },
  { name: 'Kingpin of Puerto Alba', at: 1300 },
];

/** The rank record a respect total has earned, with its ladder index. */
export function rankFor(respect) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i += 1) if (respect >= RANKS[i].at) idx = i;
  return { ...RANKS[idx], index: idx };
}

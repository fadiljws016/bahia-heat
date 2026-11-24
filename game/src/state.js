// Round seventeen adds no slice either: the staged altitude and orbit pins live in helicopter.js, the ambient clear is a shots.js local, and the rebuilt city keeps its data on the same G.city record.
// state.js — the one shared game state object. Every system imports G and
// reads or writes its slice; nothing else is global. Round eight adds
// no slice: the helicopter's staged altitude pin lives in
// helicopter.js beside the unit it moves, and the combat tableau's
// extra officer is an ordinary officers.js actor in G.officers. main.js owns the mode
// machine (menu / playing / paused / ended) and the clock; the systems own
// their actors. Its slices: the foot officers the PAPD puts on the street
// at high heat, the full-screen city map's open flag, and the presentation
// queues every HUD element drains. Round six adds no state: its two
// fixes — fascia placement in city.js, the combat lens in shots.js —
// are constants in their own files, read fresh at staging time.
// (The district signs of round four need
// no slice here — they are static city dressing, built once by city.js.)
// Round five adds no slice either: a resized fascia, greyer smoke and one
// explicitly turned runner all live in city.js, effects.js and shots.js.
// Round seven adds no state: the combat seat, the volley phase and
// the officers' new posts are constants inside shots.js, read fresh
// at staging time like every round before.

export const MODE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', ENDED: 'ended' };

export const G = {
  mode: MODE.MENU,
  shotMode: null,          // set from ?shot=<name> — stages a frozen scene instead of the menu
  seed: 20261123,          // the city's seed: Puerto Alba is the same on every visit

  // three.js handles, filled by world.js
  renderer: null, scene: null, camera: null, sun: null, sunTarget: null,
  hemi: null, fog: null, spotlight: null, isDusk: false,

  timeHours: 17.2,         // the port runs on golden hour: 17:12 at boot
  dayLengthSec: 600,       // a full day passes in ten real minutes
  elapsed: 0,

  // the city, filled by city.js
  city: null,

  // the player (player.js) — a plain record the systems share
  player: {
    mesh: null, x: 0, z: 0, heading: 0, speed: 0,
    health: 100, armor: 0, inCar: null, dead: false,
    walkPhase: 0, punchTimer: 0, lastDamageAt: -99, aimPose: 0,
  },

  // actors, filled by their systems
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

  // economy & progression (save.js shape)
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

  // mission engine (missions.js)
  mission: null,           // { def, stageIndex, stage data..., dialogue queue }
  dialogue: null,          // { lines, index, speaker... } while a conversation is up
  race: null,              // active checkpoint race state

  // the full-screen city map (minimap.js); while open, play freezes behind it
  mapOpen: false,

  // presentation helpers other systems poke
  toastQueue: [],
  bannerQueue: [],
  blastQueue: [],
  damageFlash: 0,
  cameraShake: 0,
  heliSeesPlayer: false,
  policeAggro: false,
  hudNote: null,           // a one-line note under the crosshair (spikes, empty mag)
  hudNoteAt: -99,
  bustMeter: 0,            // 0..1 while the PAPD is close to a bust (hud bar)
  aimingT: 0,              // > 0 while the player holds an aim pose (combat sets it)
  punchT: 0,               // > 0 during a fist swing (player.js poses it)
  camYaw: 0, camPitch: 0.32, // camera orbit (camera.js)
  aimPoint: null,          // crosshair ground point (camera.js keeps it fresh)
};

export const RANKS = [
  { name: 'Runner', at: 0 },
  { name: 'Courier', at: 150 },
  { name: 'Wheelman', at: 350 },
  { name: 'Fixer', at: 600 },
  { name: 'Shotgun', at: 900 },
  { name: 'Kingpin of Puerto Alba', at: 1300 },
];

/** The rank record for a respect total. */
export function rankFor(respect) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i += 1) if (respect >= RANKS[i].at) idx = i;
  return { ...RANKS[idx], index: idx };
}

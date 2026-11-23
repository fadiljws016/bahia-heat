// shots.js — the deterministic screenshot scenes behind ?shot=<name>&seed=<n>.
// Each one builds a real, populated moment of the game — the actual mission
// state, police cars, officers, helicopter and HUD data — then hands main.js
// a camera. Nothing here is drawn or faked: it is the game, arranged.
//
// Round three stages the fight the owner asked for: the combat frame is a
// four-way crossfire — the runner with the Muelle up, a Red Sails gunman at
// his side, three PAPD officers answering from behind their cruiser — with
// the runner's cover car catching fire mid-exchange and a four-beat volley
// rotation in updateShotScene so several tracers and flashes are always in
// the air. The cover shot wears the pistol on the runner's hip, the chase
// takes fire from its own roadblock, and the drive shot still opens the
// full-screen city map over the delivery run.
//
// Round four restages that fight on the owner's notes: the runner stands
// planted in the new aim pose instead of striding, the flashes shrink to
// the muzzles so the PAPD line stays visible through the exchange, and the
// officers are spread around their cruiser in the open — turned to face
// the runner at last — so every enemy can be pointed at in the frame. The
// cover shot gains the MARINA ALTA fascia over the colonnade (city.js).
//
// Round five is a facing audit, measured in the browser, not eyeballed:
// every staged shooter's mesh rotation and barrel axis was compared
// against the line to his target. The officers and the Red Sails gunman
// were dead-on; the runner was not — his mesh still wore its spawn
// heading, so he faced back down the alley while firing up it. He is
// turned explicitly now, the officers' staged impacts sit on their own
// aim lines, and his pellet fan lands on the cruiser he is aiming at.
//
// Round six re-opens that verdict from the captured pixels, because the
// owner still read the runner as backward in the finished frame — and
// the frame was telling its own truth. Re-measured three ways (rotY,
// the barrel's world axis, the bun's offset from the head's centre: the
// bun sits on the BACK of the head), the round-five turn is real: body,
// face and barrel all point up the alley. What round five never checked
// is what the staged lens does with a correct facing: it sat dead
// astern of him, on his exact facing axis, where his torso hides the
// Muelle outright, the muzzle smoke swallows the sliver that escapes
// his right shoulder, and his raised support arm — the only weapon-ish
// shape left — reads as a small gun held up beside his head, pointing
// back at the viewer. A correct aim the camera cannot show is, in the
// screenshot that gets judged, a wrong one. The combat lens therefore
// moves off his axis to his gun-side rear three-quarter (see
// stageCombat), where the shotgun's whole silhouette stands clear of
// his body against the street, aimed at the PAPD line.
//
// Round seven takes the owner's verdict on the two frames themselves:
// of the pair, he keeps the round-five composition — the runner
// centre-foreground with the whole fight in front of him — and rejects
// round six's southern seat, which played the fight leftward across
// the frame ("yang ini kan dari kiri" — this one is from the left).
// "Coba POV-nya dari kanan": try the point of view from the right.
// So the lens swings to the alley's far side and the picture mirrors:
// the runner in the left foreground with the Muelle laid toward
// frame-right, his gunman beside him, the cruiser and its PAPD line
// spread across the middle — every enemy inside the frame and
// pointable, the line itself re-spread by projection after the old
// one stacked two officers behind the gunman (see stageCombat). And
// because the round-five frame's other flaw was smoke blanketing
// those enemies, the staged volley thins its own air (see
// updateShotScene): half the cadence, a whisper of car smoke — the
// gunfire itself (dashes, stars, sparks, casings) is exactly the
// round-four recipe the owner approved, untouched.
//
// Round eight answers the owner's last note, on the chase frame:
// the FALCON-1's body hung above the top edge — the shot showed its
// spotlight cone and the dispatch line, but no helicopter. He wants
// the air unit shown in full. So the chase staging (and only the
// chase staging — live flight is untouched) pins the hover lower
// through setHeliAltitude and re-phases the orbit so that at the
// shutter the whole airframe — rotor disc, fuselage, tail, skids —
// sits inside the frame over the boulevard, its cone still raking
// down to the runner's car (see stageChase).
//
// The same round reopens the combat frame on three more of the
// owner's annotations. First, a SIXTH enemy joins the fight: a PAPD
// officer posted in the open beside the surrendering civilian at
// frame-left, where the round-seven frame had a bystander but no
// law. Second, the runner steps out from behind his cover sedan and
// the lens settles a touch further west, because from the round-
// seven seat his Muelle projected to a 16-pixel stub swallowed by
// his torso and the sedan — measured by projection, the new seat
// and stance lay the shotgun out at ~80 pixels, stock to muzzle,
// against the pale street. Third, the two right-side officers the
// owner circled — the second-line man and the far flank — read as
// unarmed dark figures: their P-9s are in their hands but a pistol
// is six dark pixels at that range, and neither had a shot in the
// air at the shutter. They now carry Kobras in the staging, turn
// their aim onto the Red Sails gunman beside the runner, and fire
// on him in the closing beats so the shutter catches their flashes
// and tracers mid-flight (see stageCombat and updateShotScene).
// The gunfire recipe itself — dashes, stars, sparks, casings — is
// untouched, exactly as approved.

import { G } from './state.js';
import { PLACES, BOULEVARD_X } from './city.js';
import { MISSIONS } from './story.js';
import { createCar, flashLightbars, syncCarMesh } from './vehicles.js';
import { spawnPedAt, posePed } from './pedestrians.js';
import { spawnOfficerAt } from './officers.js';
import { buildRoadblockMeshes } from './police.js';
import { spawnPlayer } from './player.js';
import { setHeliOrbit, setHeliAltitude } from './helicopter.js';
import { stageCamera } from './camera.js';
import { posePerson, showWeapon } from './people.js';
import { burst, burstSmoke, gunshotFx } from './effects.js';
import { makeRng } from './util.js';

function fakeMission(defIndex, stageIndex, extra = {}) {
  const def = MISSIONS[defIndex];
  G.mission = {
    def, stageIndex, targetCar: null, hostiles: [], hostilesLeft: 0,
    timerLeft: null, farePhase: null, farePair: null, fareCount: 0, raceIndex: 0,
    onEnterCar: null, onPedDown: null, ...extra,
  };
  return G.mission;
}

function trafficCar(type, x, z, heading, color = null) {
  const car = createCar(type, x, z, heading, color, makeRng(x * 31 + z));
  car.driver = 'traffic';
  G.trafficCars.push(car);
  return car;
}

function parkedCar(type, x, z, heading, color = null) {
  const car = createCar(type, x, z, heading, color, makeRng(x * 17 + z * 3));
  car.driver = 'parked';
  G.parkedCars.push(car);
  return car;
}

function cruiser(x, z, heading, tactic) {
  const car = createCar('cruiser', x, z, heading, 0xf2f2f2, null);
  car.driver = 'police';
  car.tactic = tactic;
  G.policeCars.push(car);
  return car;
}

function putPlayerInCar(type, x, z, heading, color = null) {
  const car = createCar(type, x, z, heading, color, null);
  car.driver = 'player';
  G.player.inCar = car;
  G.player.x = x; G.player.z = z; G.player.heading = heading;
  if (G.player.mesh) G.player.mesh.visible = false; // seated: no figure through the roof
  return car;
}

/** A little crowd, posed where they stand (shot mode never animates them). */
function crowd(cx, cz, n, seed, poses = ['walk', 'idle', 'chat']) {
  const rng = makeRng(seed);
  for (let i = 0; i < n; i += 1) {
    const ped = spawnPedAt(cx + (rng() - 0.5) * 20, cz + (rng() - 0.5) * 20, 'walk', { ambient: false });
    ped.heading = rng() * Math.PI * 2;
    posePed(ped, poses[Math.floor(rng() * poses.length)], rng() * 6, { armsUp: false });
  }
}

let shotKind = null;
let combatCoverCar = null; // the sedan that burns through the combat frame

/** Stage the named scene. Returns nothing; the camera is placed here. */
export function stageShotScene(name, seed = 1) {
  const rng = makeRng(seed * 1013 + 7);
  G.mode = 'playing';
  shotKind = name;

  if (name === 'drive') return stageDrive(rng);
  if (name === 'chase') return stageChase(rng);
  if (name === 'combat') return stageCombat(rng);
  return stageCover(rng);
}

// ------------------------------------------------------------------- cover
function stageCover(rng) {
  G.timeHours = 17.55;
  G.cash = 250; G.respect = 40;
  G.currentWeapon = 'pistol';
  spawnPlayer(-191.9, -5.0);
  G.player.heading = -2.53; // facing Marisol
  posePed(G.player, 'chat', 1.1);
  // The sidearm rides his hip through the conversation — drawn steel on
  // the holster, the runner's silhouette complete even at peace.
  showWeapon(G.player.mesh, 'pistol', 'hip');
  // Marisol, mid-conversation on her corner, in her red dress.
  const marisol = spawnPedAt(-193.5, -7.3, 'stand', { name: 'marisol', color: 0xd8402e });
  marisol.heading = 0.61;
  posePed(marisol, 'chat', 0.2);

  // The market crowds in: a chatting pair between the subjects and the
  // stalls, browsers at the goods, walkers crossing, a sitter on the bench.
  const a = spawnPedAt(-190.2, -3.2, 'chat', {});
  const b = spawnPedAt(-190.2, -1.6, 'chat', {});
  a.heading = Math.atan2(b.x - a.x, b.z - a.z);
  b.heading = Math.atan2(a.x - b.x, a.z - b.z);
  posePed(a, 'chat', 0.7); posePed(b, 'chat', 2.1);
  const c2 = spawnPedAt(-189.5, -6.5, 'chat', {});
  const d2 = spawnPedAt(-189.5, -4.9, 'chat', {});
  c2.heading = Math.atan2(d2.x - c2.x, d2.z - c2.z);
  d2.heading = Math.atan2(c2.x - d2.x, c2.z - d2.z);
  posePed(c2, 'chat', 1.9); posePed(d2, 'chat', 0.4);
  const browser = spawnPedAt(-190.6, -11.5, 'stand', {});
  browser.heading = Math.PI / 2;
  posePed(browser, 'idle', 1.4);
  const browser2 = spawnPedAt(-189.6, -2.5, 'stand', {});
  browser2.heading = Math.PI / 2;
  posePed(browser2, 'idle', 2.8);
  const walker = spawnPedAt(-192.5, -14.5, 'walk', {});
  walker.heading = 2.6;
  posePed(walker, 'walk', 2.2);
  const walker2 = spawnPedAt(-196, -15, 'walk', {});
  walker2.heading = 2.2;
  posePed(walker2, 'walk', 4.4);
  const sitter = spawnPedAt(-200.3, -20, 'sit', {});
  sitter.heading = -Math.PI / 2;
  posePed(sitter, 'sit', 0.5);
  crowd(-196, 10, 6, 11);
  crowd(-188, 26, 4, 13, ['walk', 'idle']);

  trafficCar('sedan', BOULEVARD_X - 3.5, 48, Math.PI, 0xe8e3d5);
  trafficCar('taxi', BOULEVARD_X + 3.5, -34, 0, null);
  trafficCar('sport', BOULEVARD_X - 3.5, -58, Math.PI, 0xffcf3f);
  parkedCar('sedan', -222.6, 14, 0, 0x8a9db5);
  parkedCar('truck', -201.4, 34, Math.PI, null);

  fakeMission(0, 0);
  G.dialogue = { lines: MISSIONS[0].intro, index: 1, onDone: null };
  // A close profile two-shot from the beach side: the pair large, the market
  // stalls, colonnade and signed facades stacked behind them — over paving
  // slabs now, not a bare floor.
  stageCamera(-195.9, 1.55, -3.1, -192.9, 1.2, -6.1);
}

// ------------------------------------------------------------------- drive
function stageDrive(rng) {
  G.timeHours = 17.3;
  G.cash = 1450; G.respect = 640; G.rankIndex = 3;
  G.unlockedWeapons = ['fists', 'pistol', 'smg'];
  G.ammo = { pistol: 42, smg: 80, shotgun: 0 };
  G.currentWeapon = 'pistol';
  spawnPlayer(140, -36.5);
  const car = putPlayerInCar('sport', 140, -36.5, Math.PI / 2, 0xff5347);
  car.speed = 15;
  trafficCar('sedan', 172, -36.5, Math.PI / 2, 0xe8e3d5);
  trafficCar('taxi', 104, -43.5, Math.PI / 2, null);
  trafficCar('truck', 143.5, 8, Math.PI, null);
  trafficCar('sedan', 96, -36.5, Math.PI / 2, 0x35b06f);
  crowd(126, -22, 5, 23);
  crowd(168, -52, 4, 29);
  const m = fakeMission(1, 2); // Hot Delivery, the timed marina run
  m.timerLeft = 87;
  // The full-screen city map is open over the run: route to the marina gate.
  G.mapOpen = true;
  stageCamera(128, 4.2, -36.5, 152, 1.1, -36.5);
}

// ------------------------------------------------------------------- chase
function stageChase(rng) {
  G.timeHours = 19.05;
  G.cash = 2320; G.respect = 905; G.rankIndex = 4;
  G.unlockedWeapons = ['fists', 'pistol', 'smg', 'shotgun'];
  G.ammo = { pistol: 31, smg: 55, shotgun: 12 };
  G.currentWeapon = 'smg';
  spawnPlayer(BOULEVARD_X + 3.5, 16);
  const car = putPlayerInCar('sedan', BOULEVARD_X + 3.5, 16, Math.PI, 0xd84f35);
  car.speed = 23;
  car.hp = 30; // smoking hard
  syncCarMesh(car, 0);

  // The hunt, tight around the player: two rammers behind, a flanker in the
  // oncoming lane at the quarter panel, and the roadblock ahead.
  cruiser(BOULEVARD_X + 5.5, 27, Math.PI, 'RAM');
  cruiser(BOULEVARD_X + 2.5, 29.5, Math.PI, 'RAM');
  cruiser(BOULEVARD_X - 3.8, 18, Math.PI * 0.97, 'FLANK');
  const rbCars = [
    cruiser(BOULEVARD_X + 0.1, -2, Math.PI / 2, 'BLOCK'),
    cruiser(BOULEVARD_X + 7.1, -2, -Math.PI / 2, 'BLOCK'),
  ];
  for (const c of rbCars) c.anchored = true;
  const rb = { x: BOULEVARD_X + 3.5, z: -2, axis: 'z', cars: rbCars, timer: 999, gone: false, meshes: null };
  const meshes = buildRoadblockMeshes();
  meshes.position.set(rb.x, 0, rb.z);
  G.scene.add(meshes);
  rb.meshes = meshes;
  G.roadblock = rb;
  const o1 = spawnOfficerAt(rb.x - 2.2, rb.z + 2.8, { phase: 'crouch', roadblock: rb });
  const o2 = spawnOfficerAt(rb.x + 5.4, rb.z + 2.8, { phase: 'fire', roadblock: rb });
  o1.heading = Math.PI; o2.heading = Math.PI;
  posePerson(o1.mesh, 'aim', 0, { crouch: 0.8 });
  posePerson(o2.mesh, 'aim', 0, { crouch: 0.15 });

  // Traffic in the frame: one braking hard ahead, one fleeing southbound.
  const braking = trafficCar('sedan', BOULEVARD_X + 3.5, 8, Math.PI, 0xe8e3d5);
  braking.speed = 3;
  braking.brakeLight = true;
  syncCarMesh(braking, 0);
  const fleeing = trafficCar('taxi', BOULEVARD_X - 3.5, 10, 0, null);
  fleeing.speed = 17;
  // Parked cars line the promenade kerb.
  parkedCar('sedan', BOULEVARD_X + 10.6, 6, Math.PI, 0x57d7e8);
  parkedCar('sport', BOULEVARD_X + 10.6, -34, Math.PI, 0xf2b13c);
  parkedCar('truck', BOULEVARD_X + 10.6, 46, Math.PI, null);

  // Sidewalk panic, close enough to read.
  const f1 = spawnPedAt(BOULEVARD_X + 16.5, 4, 'flee', {});
  f1.heading = Math.PI * 0.8;
  posePed(f1, 'flee', 2.4, { armsUp: true });
  const f2 = spawnPedAt(BOULEVARD_X + 17, -12, 'flee', {});
  f2.heading = Math.PI;
  posePed(f2, 'flee', 4.1, { armsUp: false });
  const f3 = spawnPedAt(BOULEVARD_X + 16, 27, 'flee', {});
  f3.heading = Math.PI * 1.15;
  posePed(f3, 'flee', 5.3, { armsUp: true });
  const w1 = spawnPedAt(BOULEVARD_X - 12, 24, 'walk', {});
  w1.heading = 0.4;
  posePed(w1, 'walk', 1.2);

  G.wanted = 4.4;
  G.sightState = 'insight';
  G.timeSinceSeen = 0;
  G.heliSeesPlayer = true;
  // Round eight: FALCON-1 in full, inside the frame. The live hover
  // (y 30) projects above this lens's top edge — the geometry is
  // unforgiving: the lens pitches ~4° down with 31° of half-field,
  // so its top ray climbs at ~27°, and the airframe's centre at
  // y 30 over ~52 m of boulevard sits at ~27.4°. The staged hover
  // therefore pins at y 22, which drops the whole machine —
  // strobe at the top, skids at the bottom — to between ~18° and
  // ~21° of elevation: fully in frame with sky to spare. The
  // orbit pin is phased for the shutter, not the start: the shot
  // loop advances the angle 0.00512 rad a frame, so pinning −3.53
  // here settles the orbit at ≈ −3.30 on frame 45, due north of
  // the player over the roadblock. The sector matters as much as
  // the height, twice learned: the first attempt settled it
  // north-west, dead behind the PAPD dispatch panel — in frame on
  // paper, invisible in the picture; the second swung it further
  // east and the boulevard palms ate its tail. Due north threads
  // the gap — open sky between the dispatch panel and the palm
  // crowns — its cone raking back down the road onto the pool
  // that pins the runner's car. Staging only: the live unit
  // still orbits at y 30 (helicopter.js reads the pin only when
  // set).
  setHeliAltitude(22);
  setHeliOrbit(-3.53); // settles due north of the player, over the roadblock
  fakeMission(2, 1);
  // Tight behind-and-above the player car, over the asphalt so no palm
  // trunk eats the frame: rammers big, the roadblock readable ahead.
  stageCamera(BOULEVARD_X + 6.5, 3.8, 36.5, BOULEVARD_X + 2.5, 1.0, -4);
}

// ------------------------------------------------------------------ combat
/** A static dressing prop for staged scenes (dumpster, crate stack). */
function prop(kind, x, z, heading = 0) {
  const grp = new THREE.Group();
  const box = (mat, sx, sy, sz, bx, by, bz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    m.position.set(bx, by, bz);
    m.castShadow = true;
    grp.add(m);
    return m;
  };
  if (kind === 'dumpster') {
    const green = new THREE.MeshLambertMaterial({ color: 0x3d6e46 });
    box(green, 2.7, 1.35, 1.7, 0, 0.68, 0);
    box(new THREE.MeshLambertMaterial({ color: 0x2e5636 }), 2.8, 0.12, 1.8, 0, 1.4, 0);
  } else {
    const wood = new THREE.MeshLambertMaterial({ color: 0x7d5f38 });
    box(wood, 1.3, 1.3, 1.3, 0, 0.65, 0);
    box(wood, 1.1, 1.1, 1.1, 0.2, 1.85, 0.1);
    box(wood, 1.2, 1.2, 1.2, 1.45, 0.6, 0.3);
  }
  grp.position.set(x, 0, z);
  grp.rotation.y = heading;
  G.scene.add(grp);
  return grp;
}

/**
 * Pose an officer AND turn his mesh toward the player. posePerson only
 * bends joints — it never rotates the group — so an officer staged with
 * posePerson alone faces +z whatever his heading says. Round three's
 * combat frame suffered exactly that: the PAPD aimed one way and stood
 * facing another, half-lost behind their own cruiser.
 */
function aimOfficer(off, crouch) {
  off.heading = Math.atan2(G.player.x - off.x, G.player.z - off.z);
  off.mesh.rotation.y = off.heading;
  posePerson(off.mesh, 'aim', 0, { crouch });
}

function stageCombat(rng) {
  G.timeHours = 18.25;
  G.cash = 1980; G.respect = 780; G.rankIndex = 3;
  G.unlockedWeapons = ['fists', 'pistol', 'smg', 'shotgun'];
  G.ammo = { pistol: 26, smg: 64, shotgun: 7 };
  G.currentWeapon = 'shotgun'; // the Muelle: the thickest silhouette in the game
  const at = PLACES.alleyShootout;
  spawnPlayer(at.x - 5.6, at.z - 5.4);
  G.player.heading = 0.62; // facing the cruiser, up the alley
  // Round five: TURN HIM. posePerson bends joints but never rotates the
  // group, and spawnPlayer froze the mesh at its spawn heading (π — back
  // down the alley, toward the camera). The round-four frame therefore
  // had the runner's body, head and shotgun facing 180° away from his own
  // tracer fire — measured 142.7° off the cruiser with the barrel
  // following the mesh, not the heading. aimOfficer exists for exactly
  // this; the runner gets the same explicit turn here.
  // Round eight steps him out and a shade east of his round-seven
  // post (he stood at at.x − 4, at.z − 4, heading 0.785): from the
  // round-seven lens his shotgun projected to a ~16 px stub buried
  // in his torso and the sedan's flank. Two metres toward the lens,
  // clear of the car and turned a touch across the new seat's line
  // of sight, the same gun lays out at ~80 px against the pale
  // street — stock at his shoulder, muzzle a full hand of frame
  // clear of his chest (projection-probed, then verified from the
  // captured frame). His pellet fan in updateShotScene moves with
  // the muzzle.
  G.player.mesh.rotation.y = G.player.heading;
  // Planted, not running: the round-four aim pose sets his feet apart and
  // bends his knees — a shooter standing his ground behind his cover car.
  posePerson(G.player.mesh, 'aim', 0, { crouch: 0.55 });
  showWeapon(G.player.mesh, 'shotgun', 'hand');

  // His cover: a parked sedan, sideways, doors to the fight — and already
  // burning for it (updateShotScene keeps the flames fed).
  const cover = parkedCar('sedan', at.x - 0.6, at.z - 2.4, Math.PI / 2, 0x2f7fd0);
  cover.hp = 26;
  combatCoverCar = cover;
  // Alley dressing fills the frame's edges.
  prop('dumpster', at.x - 10.5, at.z + 1, 0.4);
  prop('crates', at.x + 10, at.z - 4, 0.2);
  prop('crates', at.x - 1, at.z + 10.5, 1.1);

  // A Red Sails gunman fights at the runner's side — the crossfire runs
  // both ways, and his Kobra is up and aimed at the cruiser.
  const ally = spawnPedAt(at.x - 5.6, at.z - 0.6, 'hostile', { hp: 34 });
  ally.heading = Math.atan2((at.x + 1.8) - ally.x, (at.z + 3.6) - ally.z);
  showWeapon(ally.mesh, 'smg', 'hand');
  posePed(ally, 'aim', 0, { crouch: 0.3 });
  // posePed does apply the heading to the mesh (measured dead-on in round
  // five's facing audit) — set it once more explicitly anyway, so this
  // staging never silently depends on that side effect again.
  ally.mesh.rotation.y = ally.heading;

  // The PAPD answers, close — and they must READ as the enemy at
  // thumbnail size: navy uniforms and caps against the pale street,
  // every gun trained on the runner, and — round seven's hard rule,
  // set by the owner after two frames hid men behind cars and smoke —
  // EVERY officer visible from the staged lens: fully in frame,
  // individually pointable, nobody behind the cruiser, the cover sedan,
  // the streetlight pole or a smoke cloud. From the round-seven seat
  // the round-four line stacked two of them behind the Red Sails
  // gunman (their projections landed within 20 px of each other and of
  // him), so the line is re-spread by projection, not by eye: one in
  // the open short of the cruiser, one on the second line deep behind
  // it — placed west of the deep crate stack after the first seat
  // check caught the crates standing exactly on his sightline — and
  // one across the street on the far flank in the open; a fourth is
  // already down in the open on the near side of the cover car, where
  // a downed man cannot be mistaken for scenery. On the 1280 frame
  // their centres land near x 642, 943 and 1032 — a ladder with clear
  // street between each pair of silhouettes.
  const copCar = cruiser(at.x + 1.8, at.z + 3.6, 0.9, 'RAM');
  copCar.anchored = true;
  const offOpen = spawnOfficerAt(at.x - 0.8, at.z + 1.8, { phase: 'fire', homeCar: copCar });
  aimOfficer(offOpen, 0.15);
  const offRoof = spawnOfficerAt(at.x - 3.6, at.z + 13.6, { phase: 'fire', homeCar: copCar });
  aimOfficer(offRoof, 0.2);
  const offFlank = spawnOfficerAt(at.x - 7.2, at.z + 7.8, { phase: 'fire', homeCar: copCar });
  aimOfficer(offFlank, 0.35);
  // Round eight: the owner circled these two — the second-line man
  // and the far flank — as unarmed dark figures. Their P-9s were in
  // their hands all along, but a pistol is a few dark pixels at
  // twenty metres and neither man had a shot in the air at the
  // shutter. So the staging arms them heavier and gives them a
  // target the frame can read: both trade the sidearm for the Kobra
  // (its long magazine and stock draw a real silhouette at range)
  // and turn off the runner onto the Red Sails gunman standing
  // exposed beside him — the closing beats of updateShotScene put
  // their fire on him, flashes and tracers live at the shutter.
  // posePerson never rotates the group, so the turn is applied to
  // the mesh directly, the aimOfficer pattern.
  for (const off of [offRoof, offFlank]) {
    off.heading = Math.atan2(ally.x - off.x, ally.z - off.z);
    off.mesh.rotation.y = off.heading;
    showWeapon(off.mesh, 'smg', 'hand');
  }
  // Round eight walks the downed officer out of his round-seven
  // post (at.x + 1.8, at.z − 2.6): from the new seat the cover
  // sedan's body sits exactly on his sightline and he vanished
  // behind it. Two more posts were tried and measured — south of
  // the car he landed behind the runner; at the corner officer's
  // feet his flat-laid body stretched into the west building's
  // shadow. Projection settled the fourth: he lies in the open
  // street in the near foreground, between the runner and the
  // cruiser — the man the exchange has already cost the PAPD,
  // big and plain in the frame's empty centre.
  const downOff = spawnOfficerAt(at.x - 7.0, at.z - 2.2, { phase: 'crouch', homeCar: copCar });
  downOff.state = 'down';
  downOff.heading = Math.atan2(G.player.x - downOff.x, G.player.z - downOff.z);
  downOff.mesh.rotation.y = downOff.heading;
  posePerson(downOff.mesh, 'down');
  downOff.mesh.rotation.x = -Math.PI / 2;
  downOff.mesh.position.y = 0.25;

  // Round eight's sixth enemy, on the owner's annotation: at frame-
  // left the surrendering civilian stood alone in the round-seven
  // frame — a bystander with his hands up and no law anywhere near
  // him. A PAPD officer now covers that corner from the open street
  // beside him, navy and cap against the pale slabs, P-9 raised and
  // trained on the runner. His post was chosen by projection from
  // the staged lens (≈ x 220 on the 1280 frame) and then moved once
  // on the evidence of a capture: the first post stood in the west
  // building's shadow line at the frame's edge and read as a smudge,
  // so he steps a pace south-east into the open — clear of the
  // civilian's silhouette, clear of the crate stack behind them,
  // inside the frame with margin — a sixth man who can be pointed
  // at like the other five.
  const offCiv = spawnOfficerAt(at.x + 4.4, at.z - 5.0, { phase: 'fire', homeCar: copCar });
  aimOfficer(offCiv, 0.15);

  // A Red Sails hostile already down, a civilian running for her life
  // across the frame's right side. Round seven moved the hostile's
  // fall: at his old post (+7.5, +8.5) the mirrored seat projects him
  // onto the cruiser's own silhouette (frame x 605 against the car's
  // 618) — a corpse behind a car is scenery, not a casualty. He now
  // lies in the open on the street's west side, frame-right foreground
  // below the second-line officer (projected centre near x 934,
  // y 419), clear of the ally, the crates and the flank officer.
  const downHostile = spawnPedAt(at.x - 6.5, at.z + 3.5, 'hostile', { hp: 34 });
  downHostile.state = 'down';
  posePed(downHostile, 'down');
  downHostile.mesh.rotation.x = -Math.PI / 2;
  downHostile.mesh.position.y = 0.25;
  const civ = spawnPedAt(at.x + 8, at.z - 7, 'flee', {});
  civ.heading = Math.PI / 2 + 0.3;
  posePed(civ, 'flee', 3.2, { armsUp: true });
  crowd(at.x - 14, at.z - 12, 3, 41, ['flee', 'walk']);

  // A smoking wreck behind the cruiser sells the fight's history.
  const wreck = parkedCar('sedan', at.x + 12, at.z + 11, 2.2, 0x30363e);
  wreck.hp = 10;

  const m = fakeMission(3, 2); // Palma Showdown, the escape stage
  m.hostilesLeft = 0;
  G.wanted = 2.6; // under the FALCON-1 threshold: the frame stays on the fight
  G.sightState = 'searching';
  G.timeSinceSeen = 3;
  // Round seven: the owner's seat — the round-five composition seen
  // from the RIGHT. Round five sat dead astern of the runner (and hid
  // his gun behind him); round six sat due south, which put the
  // runner at frame-right firing frame-left — "dari kiri", from the
  // left, in the owner's words. This lens stands west-south-west of
  // the fight and looks east-north-east across it, so the picture
  // mirrors: the runner holds the left foreground with the whole
  // fight in front of him, his gunman stands beside him at centre,
  // and the exchange plays toward frame-right — the runner's Muelle
  // laid across his body toward the cruiser, its sparks walking the
  // cruiser's flank, the PAPD answering down the same line. The
  // eastern seats were scouted and rejected on evidence: a building
  // fills their right half and the downed officer swallows their
  // foreground. From here every staged man projects inside the frame
  // with street between him and the next (see the PAPD note above).
  // Round eight keeps this seat's family — west of the fight,
  // looking east-north-east, the picture playing rightward — and
  // settles it two metres further west and a step north, a touch
  // higher: from here the runner's stepped-out stance (above) lays
  // his Muelle across the pale street at ~80 px instead of a 16 px
  // stub, and the sixth officer by the civilian enters the frame
  // with margin. Same composition, same direction — a wider, surer
  // version of the round-seven seat.
  // Round nine re-witnesses the round-eight build under a fresh
  // recording and answers the owner's last annotation on this frame:
  // the left edge caught a big blank building wall — a flat tan slab
  // filling the foreground's left ~15%. The seat therefore steps
  // east and back along the street — two and a half metres of each —
  // which walks the lens past that wall's south-east corner and out
  // of its slab, while the look target steps a metre east with it so
  // the composition holds: runner whole in the foreground, the fight
  // playing rightward, all six enemies inside (probed across four
  // candidate seats, then verified from the captured frame — the
  // seats that stepped east without stepping back slid past the
  // runner and cropped him out of his own photograph).
  stageCamera(at.x - 9.5, 2.7, at.z - 8.5, at.x + 1.2, 1.0, at.z + 2.8);
}

/**
 * Per-frame life for the frozen scenes (main.js's shot loop calls this):
 * lightbars keep turning, the firefight keeps exchanging, the chase keeps
 * scraping, smoking and taking roadblock fire — so frame 45 catches the
 * action mid-beat, with several tracers and flashes in the air at once.
 */
export function updateShotScene(frame) {
  if (shotKind === 'chase') {
    flashLightbars(frame % 24 < 12, 1);
    if (frame % 15 === 0) {
      // A scrape of sparks off the nearest rammer's bumper.
      burst(BOULEVARD_X + 5.2, 0.6, 24.6, 0xffcf5e, 7, 2.2, { life: 0.5 });
    }
    if (frame % 26 === 8 && G.player.inCar) {
      // The roadblock's standing officer opens up on the player car: a
      // tracer lane crossing the whole frame toward the camera.
      gunshotFx(BOULEVARD_X + 8.9, 1.32, 0.8, G.player.inCar.x - 0.6, 0.85, G.player.inCar.z - 2,
        { heading: Math.PI, hit: 'spark' });
    }
    if (frame % 12 === 0 && G.player.inCar) {
      burstSmoke(G.player.inCar.x, 1.2, G.player.inCar.z, 4, { color: 0x222222, life: 2.3, rise: 1.3, power: 0.8 });
    }
  } else if (shotKind === 'combat') {
    flashLightbars(frame % 24 < 12, 1);
    // A four-way exchange in rotation — round seven fires it at half
    // cadence, one shot every second frame. The gunfire itself is
    // unchanged (a tracer dash lives ~5 frames, a flash ~3, so the air
    // still holds two or three dashes and a live star at the shutter),
    // but each gunshotFx also breathes a wisp of muzzle smoke that
    // outlives the whole 45-frame tableau: at full cadence forty-odd
    // wisps piled up around the PAPD line and blanketed the very men
    // the frame exists to show — the owner's second complaint about
    // the round-five shot. Half the shots, half the smoke, and the
    // rotation is phased so the runner's own fan is the freshest beat
    // when the shutter falls at frame 45 (his turn lands on frame 44).
    // Origins sit on the staged guns: the runner's Muelle, the nose
    // officer's P-9, the second-line officer's P-9 down the alley, the
    // ally's Kobra.
    const at = PLACES.alleyShootout;
    const turn = (Math.floor(frame / 2) + 2) % 4;
    if (frame % 2 === 0 && turn === 0) {
      // The runner's Muelle: a three-pellet fan along his barrel line
      // (heading 0.62 from his muzzle, stepped out from the cover car
      // in round eight) onto the cruiser's near corner. Round four's
      // fan landed short beside his own cover car, ~20° off the line
      // his shotgun points — round five puts the sparks where the gun
      // actually aims, and round eight moves the origin with the man.
      for (const spread of [-0.7, 0, 0.7]) {
        gunshotFx(at.x - 4.86, 1.18, at.z - 4.37, at.x + 2.5 + spread * 0.5, 1.0, at.z + 2.5 - spread * 0.5,
          { heading: 0.62, hit: 'spark', flash: 1.7, color: 0xffc37a, casing: spread === 0 });
      }
    } else if (frame % 2 === 0 && turn === 1) {
      // The open officer answers along his own aim line at the runner —
      // the cover sedan stands in it, so the sparks walk its flank.
      // (Round four's impact sat ~30° off his barrel line.)
      gunshotFx(at.x - 1.2, 1.32, at.z + 1.0, at.x - 2.4, 0.95, at.z - 1.7,
        { heading: -2.64, hit: 'spark' });
    } else if (frame % 2 === 0 && turn === 2) {
      // The second-line officer fires down the alley's west side —
      // round seven moved him deep (at.x − 3.6, at.z + 13.6) so the
      // lens sees him whole in the open instead of losing him behind
      // the cruiser's body or the deep crates. Round eight turns his
      // fire onto the Red Sails gunman (his staging aim turned with
      // it): the long shot crosses the whole fight and strikes at
      // the gunman's position beside the runner.
      gunshotFx(at.x - 3.68, 1.42, at.z + 13.05, at.x - 5.3, 1.0, at.z - 0.3,
        { heading: -3.0, hit: 'spark' });
    } else if (frame % 2 === 0) {
      // The Red Sails gunman pours Kobra fire into the cruiser.
      gunshotFx(at.x - 4.6, 1.26, at.z + 0.0, at.x + 1.6, 1.0, at.z + 3.4,
        { heading: 1.06, hit: 'spark', flash: 1.15, color: 0xffbe5a });
    }
    // Round eight's closing beats, phased at the shutter the way
    // round seven phased the runner's fan: the two officers the
    // owner circled must be CAUGHT firing, not merely posed. A
    // muzzle star lives ~3 frames and a tracer dash ~5, so the
    // second-line officer fires on frame 43 and the far flank on
    // frame 44 — both flashes still lit and both dashes still in
    // the air when the shutter falls at 45, their fire converging
    // on the Red Sails gunman: the deep man's rounds strike at the
    // gunman's chest, the flanker's kick dust at his feet. Same
    // recipe as every other staged shot — nothing restyled, just
    // two more guns in the exchange, timed to be seen.
    if (frame === 43) {
      gunshotFx(at.x - 3.68, 1.42, at.z + 13.05, at.x - 5.4, 1.05, at.z - 0.5,
        { heading: -3.0, hit: 'spark' });
    }
    if (frame === 44) {
      gunshotFx(at.x - 7.1, 1.35, at.z + 7.26, at.x - 6.1, 0.4, at.z + 0.3,
        { heading: 2.95, hit: 'dust' });
    }
    // The cover car burns through the whole exchange: flame tongues fed
    // a little every few frames — the flames (hard sparks, gone in half
    // a second) carry the burning read on their own.
    if (combatCoverCar && frame % 5 < 2) {
      burst(combatCoverCar.x + (Math.random() - 0.5) * 1.6, 1.05, combatCoverCar.z + (Math.random() - 0.5) * 1.2,
        0xff7a2e, 3, 1.5, { life: 0.42, up: 1.5 });
      burst(combatCoverCar.x, 1.3, combatCoverCar.z, 0xffc37a, 2, 1.1, { life: 0.3, up: 1.3 });
    }
    // Its smoke column, though, is thinned hard in round seven: the old
    // feed (two puffs every 9 frames, each living longer than the whole
    // tableau) stacked a black pillar on the sedan that stood between
    // the right-side lens and the PAPD line and swallowed the open
    // officer whole. One wisp every 16 frames, shorter-lived and lower,
    // keeps a burnt smell in the air without walling off the fight.
    if (combatCoverCar && frame % 16 === 4) {
      burstSmoke(combatCoverCar.x, 1.7, combatCoverCar.z, 1, { color: 0x232323, life: 1.5, rise: 1.1, power: 0.6 });
    }
    if (frame % 24 === 8) {
      burstSmoke(at.x + 12, 1.2, at.z + 11, 1, { color: 0x2c2c2c, life: 1.5, rise: 1.0, power: 0.6 });
    }
  } else if (shotKind === 'cover' && frame % 26 === 0) {
    // A gull-startle of dust by the stalls — barely, but the air moves.
    // Round five deepens the puff to a warm dusk grey-brown: the old pale
    // beige read as a steam wisp against the evening stalls.
    burstSmoke(-189.5, 1.4, -12, 1, { color: 0xb3a284, life: 1.4, rise: 0.5, power: 0.4 });
  }
}

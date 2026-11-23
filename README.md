# Bahia Heat — an open-world crime game in Puerto Alba

![make.fun bounty](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/fadiljws016/bahia-heat/rank.svg)
![reward](https://make.fun/badge/gta6-01/fadiljws016/bahia-heat/reward.svg)

**Bahia Heat** is a complete 3D open-world crime game that runs in a desktop
browser from static files — no build step, no network requests. You are a
runner in **Puerto Alba**, a sun-soaked port city of palm boulevards, a
market promenade, marina docks and one very determined police department.
Work eight story jobs for Marisol “La Jefa” Quintana, Bruno “El Faro” Cádiz,
Dario the mechanic and Tito the street racer; build cash and respect from
Runner to Kingpin of Puerto Alba; and stay out of FALCON-1's searchlight.

Entered in the make.fun bounty **[Make GTA 6 (gta6-01)](https://make.fun/bounty/gta6-01)**.

## What's in the city

- **A full, dense open world**: six districts (El Faro, Playa Brava, Marina
  Alta, Las Palmas, Centro Alba, Viejo Puerto) built from hundreds of
  small-lot buildings with painted facades — lit windows, shutters, AC
  boxes, balconies, awnings and named shop signs — plus the Mercado del
  Puerto market stalls, a colonnade, rooftop water towers, billboards,
  festival banners, wall posters, pennant strings over the old-port streets,
  and string lights over the market after dark. Landmarks: the El Faro
  lighthouse, a Ferris wheel turning over Playa Brava, marina piers with
  bobbing boats and dock cranes, the Plaza del Reloj fountain.
- **People with joints**: articulated low-poly citizens — varied skin tones,
  outfits, hair and hats — who stroll, chat in pairs, browse the stalls, sit
  on the sea benches, and run screaming when the shooting starts. Police
  officers are distinct: navy uniforms, caps, drawn pistols.
- **Driving**: five vehicle types with an arcade model — carjacking, brake
  lights, headlight cones at dusk, damage that smokes, burns and explodes,
  spike strips, garage repairs, resprays, engine tunes and armor plating.
- **The PAPD**: a 1–5 star wanted system. Cruisers pursue with readable
  tactics — RAM, FLANK, INTERCEPT — listed live on the dispatch panel; at
  three stars officers get out and fight from behind cover, and FALCON-1
  joins with a spotlight that keeps you in sight; at four stars they set
  physical roadblocks with barriers and spike strips.
- **Combat you can see**: fists, pistol, SMG and shotgun with tracer
  streaks, muzzle flashes, ejecting casings, impact sparks and dust, and
  enemies who take cover behind cars between bursts.
- **Eight story jobs**: thefts, timed deliveries, a smuggler's run, a
  shootout, a checkpoint street race, taxi fares, a car chase takedown, and
  a five-star finale — plus endless taxi fares after the story ends.
- **A city map, twice**: press **M** for the full-screen chart of Puerto
  Alba — pastel districts with names, landmark glyphs, and a glowing gold
  route with a live distance readout to your objective — and a matching
  round minimap in the corner with the same cartography and route.
- **A dense HUD**: mission panel with staged objectives and timers,
  dispatch board including FOOT units, wanted stars with IN SIGHT /
  SEARCHING state, weapon slots, vitals, a bust meter, vehicle condition,
  and a synthesized radio with three stations. All sound is synthesized
  WebAudio — there are no audio files.

## Play it

```sh
node serve.ts
```

then open <http://localhost:8080> in a desktop browser. (Any static file
server pointed at `game/` works just as well.)

| Keys | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Mouse (click game to lock) | Orbit camera |
| Click / J | Punch or fire |
| E | Enter or exit a car, continue dialogue |
| 1 – 4 / wheel | Weapon slots (also garage services at Dario's) |
| Shift | Sprint |
| Space | Handbrake |
| M | City map |
| R | Change radio station |
| N | Mute |
| Esc / P | Pause |

Progress (cash, respect, unlocks, story position, garage upgrades)
autosaves to the browser's local storage after every job and purchase.

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the kit's builder.
- `game/` — the game itself: `index.html` (HUD, menus and the map screen),
  `src/` modules one job each (city, world, vehicles, traffic, pedestrians,
  people, police, officers, helicopter, combat, missions, story, hud,
  minimap, audio, camera, player, effects, input, save, shots), and
  `vendor/three.min.js` — the three.js library, vendored as a minified
  build; everything else is hand-written.
- `screenshots/` — four real renders of the game, staged deterministically
  through `?shot=cover|drive|chase|combat` (see `shots.json`).

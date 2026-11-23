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

The screenshots show the current build as it is: FALCON-1 hangs in full over
the boulevard chase — rotor, fuselage, tail and skids in frame, not just its
spotlight cone — and the Palma Showdown gunfight sets six PAPD-side enemies
in the open against the runner and his Red Sails gunman, the runner stepped
out from behind his cover car with the Muelle laid across the frame, his
shotgun traceable from stock to muzzle.

## What's in the city

- **A full, dense open world**: six districts (El Faro, Playa Brava, Marina
  Alta, Las Palmas, Centro Alba, Viejo Puerto) built from hundreds of
  small-lot buildings with painted facades — lit windows, shutters, AC
  boxes, balconies, awnings and named shop signs — a lettered MARINA ALTA
  fascia over the market colonnade, hung with headroom in its lettering so
  the roof trim above it never crosses the name, a gateway sign naming each
  district at the way into it, the Mercado del Puerto market stalls,
  rooftop water towers, billboards, festival banners, wall posters, pennant
  strings over the old-port streets, and string lights over the market
  after dark. Landmarks: the El Faro lighthouse, a Ferris wheel turning
  over Playa Brava, marina piers with bobbing boats and dock cranes, the
  Plaza del Reloj fountain.
- **Ground that is painted, not flat**: every street and square wears a
  canvas-generated surface — asphalt with aggregate speckle, patched cracks
  and oil stains; plaza and promenade paving slabs with grout and weather
  stains; rippled beach sand — plus a clutter layer of fallen flyers and
  leaves, painted kerbs, tactile paving at the crossings, drain grates, and
  puddles that mirror the sky at dusk. No large bare plane anywhere.
- **People with joints and wardrobes**: articulated low-poly citizens —
  varied skin tones, outfits (some in striped, floral or checked shirts),
  hair from buns to ponytails, hats and sunglasses — who stroll, chat in
  facing pairs, browse the stalls, sit on the sea benches, and run
  screaming when the shooting starts. Police officers are distinct: navy
  uniforms, badged caps, drawn pistols. Cars are solid: nobody walks or
  drives through one, and the street furniture keeps to the kerbs.
- **Weapons you can read**: each firearm is a modelled low-poly gun with
  its own silhouette — the P-9 pistol (slide, sights, wooden grip), the
  Kobra SMG (long magazine, stock, foregrip), the Muelle 12ga (thick pump
  barrel, tan pump and stock) — carried in a hip holster between fights and
  raised two-handed to aim. The HUD weapon slots draw the same silhouettes.
- **Gunfights you can see**: sustained multi-shooter crossfire — officers
  and rival crews fire longer bursts from behind cover while the runner
  answers, planted in a real shooting stance — with short warm tracer
  dashes in the air, compact muzzle stars pinned to the barrel tips (never
  a white glare hiding the fight), ricochet fans off asphalt and bodywork,
  dust blooms off walls, ejecting brass, warm-grey powder smoke hanging in
  the air (grey at dusk, never white steam), and cars that smoke, catch
  fire and go up mid-fight.
- **Driving**: five vehicle types with an arcade model — carjacking, brake
  lights, headlight cones at dusk, damage that smokes, burns and explodes,
  spike strips, garage repairs, resprays, engine tunes and armor plating.
- **The PAPD**: a 1–5 star wanted system. Cruisers pursue with readable
  tactics — RAM, FLANK, INTERCEPT — listed live on the dispatch panel; at
  three stars officers get out and fight from behind cover, and FALCON-1
  joins with a spotlight that keeps you in sight; at four stars they set
  physical roadblocks with barriers and spike strips.
- **Eight story jobs**: thefts, timed deliveries, a smuggler's run, a
  shootout, a checkpoint street race, taxi fares, a car chase takedown, and
  a five-star finale — plus endless taxi fares after the story ends.
- **A city map, twice**: press **M** for the full-screen chart of Puerto
  Alba — six pastel district washes with names, landmark glyphs for the
  garage, the PAPD station, the hospital, Marisol's corner, Tito's race
  lights, the marina and the lighthouse, a compass rose, and a glowing gold
  route with a live distance readout to your objective — and a matching
  round minimap in the corner with the same cartography and route.
- **A graded golden-hour look**: filmic tone mapping, a sky that runs
  azure into gold into rose, warm sun against cool shadow fill, and a dense
  HUD — mission panel with staged objectives and timers, dispatch board
  including FOOT units, wanted stars with IN SIGHT / SEARCHING state,
  weapon slots with drawn silhouettes, vitals, a bust meter, vehicle
  condition, and a synthesized radio with three stations. All sound is
  synthesized WebAudio — there are no audio files.

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

Progress (cash, respect, unlocks, story position, garage upgrades, and the
weapon in hand) autosaves to the browser's local storage after every job
and purchase.

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
  through `?shot=cover|drive|chase|combat` (see `shots.json`). The combat
  render is composed from the right: the runner foreground-left with his
  gunman beside him, the PAPD line spread across the cruiser's length so
  every officer stands visible in the open, and a staged volley thinned so
  its smoke never covers them.

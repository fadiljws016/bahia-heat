# Bahia Heat

[![gta6-01 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fadiljws016/bahia-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fadiljws016/bahia-heat/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game set in **Puerto Alba**, a golden-hour port
city of painted facades, marina arcades and six districts — Marina Alta,
Las Palmas, Centro Alba, Viejo Puerto, El Faro and Playa Brava.

You are the new driver for **Marisol "La Jefa" Quintana**, the fixer who runs
the marina. Eight story jobs carry you from stealing your first sedan outside
Bar La Ola to holding the docks in the Kingpin's Gambit: deliveries against
the clock, a boulevard run under the FALCON-1 spotlight, the Palma alley
showdown with the Red Sails, Tito's Street Crown street race, taxi fares, a
takedown in Viejo Puerto — while the **PAPD** dispatch board tracks every
unit on your tail, roadblocks close the boulevard, and a five-star wanted
level decides how the city answers.

## Play

Open `game/index.html` in a desktop browser (or serve the repo with
`node serve.ts` and visit http://localhost:8080). Everything is static and
offline; three.js is vendored under `game/vendor/`.

| Input | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse | Orbit camera, aim |
| Click | Shoot |
| E | Enter or exit a car, talk, advance dialogue |
| M | Full city map (Esc closes) |
| 1–4 | Select weapon |
| Shift | Run |
| C | Change radio station |
| N | Mute |

## The city

- A surveyed road grid with a palm-lined boulevard, corner-kerb streetlights
  and traffic that holds its lane; cars are solid — nothing ghosts through.
- Painted canvas textures throughout: slab paving with wear and stains,
  tar-seamed asphalt, grime-washed facades with shopfronts, and the teal
  **MARINA ALTA** board on the marina colonnade.
- A full day cycle graded ACES-filmic, with the sun, fog and sky repainted
  from a nine-stop table; dusk brings out the lamps and FALCON-1's beam.
- Five car types (Alba Sedan, Fuego GT, Taxi Alba, Mulo Truck, PAPD
  Interceptor), four weapons (Fists, P-9 Pistol, Kobra SMG, Muelle 12ga),
  cash/respect ranks from Nobody to Kingpin, and a local save.

## Structure

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored library.
- `game/src/` — ES modules: world and sky (`world.js`), the city (`city.js`),
  people and poses (`people.js`), cars (`vehicles.js`), police and the air
  unit (`police.js`, `officers.js`, `helicopter.js`), gunplay and effects
  (`combat.js`, `effects.js`), story and missions (`story.js`, `missions.js`),
  HUD and maps (`hud.js`, `minimap.js`), and the staged screenshot scenes
  (`shots.js`).

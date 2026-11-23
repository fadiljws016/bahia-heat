// story.js — the people of Puerto Alba and the eight jobs that make the
// runner's name. Pure data: missions.js interprets the stage kinds, and
// the HUD prints titles, objectives and briefing lines from these
// records verbatim — which is why this file's words are content, not
// commentary, and change only when the story itself does. Every name,
// crew and grudge here is Bahia Heat's own.
import { PLACES } from './city.js';

export const CHARACTERS = {
  marisol: { name: 'Marisol “La Jefa” Quintana', short: 'Marisol', initials: 'MQ', color: '#ffb340' },
  dario: { name: 'Dario Fuentes', short: 'Dario', initials: 'DF', color: '#57d7e8' },
  bruno: { name: 'Bruno “El Faro” Cádiz', short: 'Bruno', initials: 'BC', color: '#7be382' },
  tito: { name: 'Tito Salazar', short: 'Tito', initials: 'TS', color: '#ff7ab0' },
  vera: { name: 'Capitán Vera Ojeda', short: 'Cap. Ojeda', initials: 'VO', color: '#7ab0ff' },
  runner: { name: 'You — the Runner', short: 'Runner', initials: 'YO', color: '#f4ede1' },
};

const L = (who, text) => ({ who, text });

// Stage kinds missions.js understands:
//   goto     — reach a point (any way)          drive  — reach a point in a car (timer optional)
//   steal    — a marked car waits; get in it    deliver— bring the target car to a point
//   pickup   — reach a point on foot            chase  — run down and disable a fleeing car
//   shootout — clear hostile crew at a point    escape — lose the wanted level entirely
//   race     — pass every checkpoint in order   fare   — taxi work: pickup/dropoff pairs
export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', giver: 'marisol', startAt: PLACES.marisolCorner,
    pay: 400, respect: 120,
    intro: [
      L('marisol', 'So you are the new legs in Puerto Alba. I run the Marina Alta corner, and my legs earn.'),
      L('marisol', 'A blue-top sedan sits outside Bar La Ola. Its owner owes me. Bring it to Dario’s garage — quietly, if you can.'),
      L('runner', 'And if quiet is not on the menu?'),
      L('marisol', 'Then drive fast, cariño. The PAPD bill by the star.'),
    ],
    outro: [
      L('marisol', 'Clean work. Dario will strip it by morning. You have a future, runner.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.beachBar, radius: 7, objective: 'Head to Bar La Ola on Playa Brava', next: 'The owed sedan is parked by the bar' },
      { kind: 'steal', at: { x: -224, z: -128 }, carType: 'sedan', objective: 'Take the marked sedan', next: 'Get in the car — E beside it' },
      { kind: 'deliver', at: PLACES.garagePad, radius: 8, objective: 'Deliver the sedan to Dario’s garage pad', next: 'Park on the glowing pad' },
      { kind: 'goto', at: PLACES.marisolCorner, radius: 6, objective: 'Report back to Marisol', next: 'She waits on the Marina Alta corner' },
    ],
  },
  {
    id: 'hot-delivery', title: 'Hot Delivery', giver: 'dario', startAt: PLACES.garagePad,
    pay: 550, respect: 130,
    intro: [
      L('dario', 'Runner! My cousin’s fish truck died with a load of casino chips in the back. Don’t ask.'),
      L('dario', 'Take the Mulo at the warehouse, get it to the marina gate before the ice — and the story — melts.'),
    ],
    outro: [
      L('dario', 'Still cold! You drive like the tide owes you money. I like it.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.warehouse, radius: 9, objective: 'Pick up the loaded truck at Almacén 9', next: 'The Mulo is waiting by the warehouse doors' },
      { kind: 'steal', at: { x: 228, z: 224 }, carType: 'truck', objective: 'Take the Mulo truck', next: 'Get in the truck' },
      { kind: 'drive', at: PLACES.marinaGate, radius: 9, timer: 150, objective: 'Race the load to the marina gate', next: 'Beat the clock — the boulevard is fastest' },
      { kind: 'goto', at: PLACES.garagePad, radius: 8, objective: 'Return to Dario’s garage', next: 'He owes you a cold drink and warm cash' },
    ],
  },
  {
    id: 'bay-runner', title: 'Bay Runner', giver: 'bruno', startAt: PLACES.marinaGate,
    pay: 800, respect: 170,
    intro: [
      L('bruno', 'Forty years I keep the lighthouse, and the sea keeps bringing me… opportunities.'),
      L('bruno', 'Crates on the dock, friend. Take them to El Faro. The PAPD will object — object louder.'),
    ],
    outro: [
      L('bruno', 'The light saw you come home safe. That is all an old smuggler asks.'),
    ],
    stages: [
      { kind: 'pickup', at: PLACES.marinaDock, radius: 6, objective: 'Load the crates at the marina docks', next: 'On foot, between the piers', heat: 3 },
      { kind: 'drive', at: PLACES.lighthouse, radius: 10, anyCar: true, objective: 'Run the crates up to El Faro', next: 'Any wheels will do — lose the tail if you can' },
      { kind: 'escape', objective: 'Lose the PAPD completely', next: 'Break line of sight and keep moving' },
      { kind: 'goto', at: PLACES.marinaGate, radius: 8, objective: 'Meet Bruno at the marina gate', next: 'He pays in old bills and older stories' },
    ],
  },
  {
    id: 'palma-showdown', title: 'Palma Showdown', giver: 'marisol', startAt: PLACES.marisolCorner,
    pay: 950, respect: 200,
    intro: [
      L('marisol', 'The Red Sails crew thinks my corner is theirs now. They gather in the Callejón de las Redes.'),
      L('marisol', 'Teach them geography, runner. Bring a real gun — the Kobra if your name has earned it, the Muelle if it has earned more.'),
      L('runner', 'And when the PAPD answers the noise?'),
      L('marisol', 'Then the alley has two lessons to teach. Be quick with both.'),
    ],
    outro: [
      L('marisol', 'The alley is quiet and the corner is mine. Puerto Alba is learning your name.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.alleyShootout, radius: 10, objective: 'Go to the Callejón de las Redes', next: 'Viejo Puerto — past the district sign, behind the net lofts' },
      { kind: 'shootout', at: PLACES.alleyShootout, count: 5, objective: 'Clear out the Red Sails crew', next: 'All of them down — watch the crossfire' },
      { kind: 'escape', objective: 'Shake any heat from the gunfight', next: 'Gone and forgotten, like the Red Sails' },
      { kind: 'goto', at: PLACES.marisolCorner, radius: 6, objective: 'Report back to Marisol', next: 'Marina Alta corner' },
    ],
  },
  {
    id: 'street-crown', title: 'Street Crown', giver: 'tito', startAt: PLACES.raceStart,
    pay: 700, respect: 180,
    intro: [
      L('tito', 'Everybody talks about the runner. I talk with my right foot. Boulevard, eight gates, my crown on the line.'),
      L('tito', 'Any car. Any trick. Just be first through the last gate before the clock dies.'),
    ],
    outro: [
      L('tito', 'The crown is yours. Wear it loud — the boulevard respects loud.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.raceStart, radius: 7, objective: 'Meet Tito at the south boulevard lights', next: 'Bring something quick' },
      {
        kind: 'race', timer: 165, objective: 'Win the boulevard crown race', next: 'Every gold gate, in order',
        checkpoints: [
          { x: -212, z: 40 }, { x: -212, z: -60 }, { x: -212, z: -180 }, { x: -160, z: -220 },
          { x: -40, z: -220 }, { x: 80, z: -160 }, { x: 80, z: -40 }, { x: -40, z: 20 },
        ],
      },
      { kind: 'goto', at: PLACES.raceStart, radius: 8, objective: 'Collect from Tito', next: 'South boulevard lights' },
    ],
  },
  {
    id: 'cab-confessions', title: 'Cab Confessions', giver: 'dario', startAt: PLACES.garagePad,
    pay: 650, respect: 150,
    intro: [
      L('dario', 'My taxi driver quit — something about “bullets in the upholstery”. Three fares are waiting, runner.'),
      L('dario', 'The cab is out front. Drive gentle; passengers tip, corpses don’t.'),
    ],
    outro: [
      L('dario', 'Five stars, they said! I may frame the reviews. Or the dents. Both.'),
    ],
    stages: [
      { kind: 'steal', at: { x: -196, z: -52 }, carType: 'taxi', objective: 'Take the Taxi Alba cab', next: 'It is parked by the garage' },
      {
        kind: 'fare', objective: 'Work the three waiting fares', next: 'Gold marker: pickup. Blue marker: dropoff',
        pairs: [
          { from: PLACES.plaza, to: PLACES.hospital, fareName: 'a nurse off shift' },
          { from: PLACES.policeStation, to: PLACES.beachBar, fareName: 'an off-duty officer (awkward)' },
          { from: PLACES.marinaGate, to: PLACES.garagePad, fareName: 'a sailor with one bag and no past' },
        ],
      },
      { kind: 'goto', at: PLACES.garagePad, radius: 8, objective: 'Bring the cab home', next: 'Park it by the garage' },
    ],
  },
  {
    id: 'condors-prey', title: 'Condor’s Prey', giver: 'bruno', startAt: PLACES.marinaGate,
    pay: 1200, respect: 230,
    intro: [
      L('bruno', 'A courier carries my sea-charts to sell to the Red Sails. A Fuego GT, fast as gossip.'),
      L('bruno', 'Stop the car, take the case, bring it to Dario. If FALCON-1 wakes, you are on your own — as ever.'),
    ],
    outro: [
      L('bruno', 'My charts come home. The sea keeps its secrets, and so do we.'),
    ],
    stages: [
      { kind: 'goto', at: { x: 140, z: 200 }, radius: 12, objective: 'Find the courier’s Fuego GT in Viejo Puerto', next: 'It cruises the south avenues' },
      { kind: 'chase', carType: 'sport', objective: 'Run down the Fuego GT and disable it', next: 'Ram it, shoot the tires — stop it any way' },
      { kind: 'pickup', at: null, radius: 4, objective: 'Take the chart case from the wreck', next: 'On foot, beside the stopped car', heat: 2 },
      { kind: 'deliver', at: PLACES.garagePad, radius: 8, anyCar: true, objective: 'Deliver the case to Dario’s garage', next: 'Any car — just get it there' },
    ],
  },
  {
    id: 'bahia-heat', title: 'Bahia Heat', giver: 'marisol', startAt: PLACES.marisolCorner,
    pay: 2500, respect: 400,
    intro: [
      L('marisol', 'One last run, and Puerto Alba is ours. The port authority’s payroll boat lands tonight — cash, runner, a whole season of it.'),
      L('marisol', 'Take the case from El Faro, hold the marina against the Red Sails, then vanish. Capitán Ojeda will throw the whole sky at you.'),
      L('runner', 'Then I will drive under a different sky. Let’s finish this.'),
    ],
    outro: [
      L('marisol', 'Look at that sunset, Kingpin. Puerto Alba is yours — every dock, every corner, every tide.'),
      L('bruno', 'The light will tell this story for forty years. I will make sure it tells it right.'),
    ],
    stages: [
      { kind: 'pickup', at: PLACES.lighthouse, radius: 7, objective: 'Take the payroll case at El Faro', next: 'On foot, at the lighthouse door', heat: 4 },
      { kind: 'drive', at: PLACES.marinaGate, radius: 9, anyCar: true, timer: 170, objective: 'Get the case to the marina', next: 'The whole PAPD is awake — move!' },
      { kind: 'shootout', at: PLACES.marinaDock, count: 4, objective: 'Hold the docks against the Red Sails', next: 'Keep the case, clear the pier' },
      { kind: 'escape', objective: 'Lose the PAPD for good', next: 'Out of the light, out of the story' },
    ],
  },
];

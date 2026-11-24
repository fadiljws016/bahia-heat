// story.js — the people and the work: Marisol "La Jefa" Quintana, who
// runs Puerto Alba's quiet economy from her corner by the market;
// Tito Ferrer, who times the Street Crown and counts the fares; and
// Dario Quintana, whose garage door is the city's confessional. Eight
// jobs chain their favours into a reputation. Dialogue lines are
// { who, text } — hud.js dresses them from CHARACTERS.
import { PLACES } from './city.js';

export const CHARACTERS = {
  marisol: { name: 'Marisol "La Jefa" Quintana', initials: 'MQ', color: '#b03024' },
  tito: { name: 'Tito Ferrer', initials: 'TF', color: '#2f7f8f' },
  dario: { name: 'Dario Quintana', initials: 'DQ', color: '#7a4a8f' },
  runner: { name: 'You', initials: 'YOU', color: '#0f766e' },
};

const L = (who, text) => ({ who, text });

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', giver: 'marisol', startAt: PLACES.marisolCorner,
    cash: 350, respect: 40,
    intro: [
      L('marisol', 'You walk like someone who owes the city a favour. I collect those.'),
      L('marisol', 'A blue-top sedan sits outside Bar La Ola on Playa Brava. Its owner owes me. Bring it to Dario\'s garage — quietly, if you can.'),
      L('runner', 'And if I can\'t be quiet?'),
      L('marisol', 'Then be fast. The PAPD charge by the siren.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.beachBar, text: 'Head to Bar La Ola on Playa Brava', next: 'The owed sedan is parked by the bar' },
      { kind: 'steal', at: PLACES.beachBar, text: 'Take the blue-top sedan', next: 'Wheels up — Dario is waiting' },
      { kind: 'deliverCar', at: PLACES.garagePad, text: 'Deliver the sedan to Dario\'s garage', next: 'Dario signs for it, no questions' },
      { kind: 'goto', at: PLACES.marisolCorner, text: 'Report back to Marisol', next: 'First wheels, first respect' },
    ],
    outro: [L('marisol', 'Clean work. Puerto Alba notices clean work.')],
  },
  {
    id: 'hot-delivery', title: 'Hot Delivery', giver: 'marisol', startAt: PLACES.marisolCorner,
    cash: 600, respect: 70,
    intro: [
      L('marisol', 'ALMACÉN 9 holds a load that cannot sit still. Neither can you, I hope.'),
      L('marisol', 'Collect it, stage the car at Dario\'s, then race it to the marina gate before the ice melts — metaphorically. Mostly.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.warehouse, text: 'Pick up the load at ALMACÉN 9', next: 'It is already sweating' },
      { kind: 'goto', at: PLACES.garagePad, text: 'Stage the car at Dario\'s garage', next: 'Ninety seconds of fame, starting soon' },
      { kind: 'timed', at: PLACES.marinaGate, time: 150, text: 'Race the load to the marina gate', next: 'Then Tito counts the crates' },
      { kind: 'goto', at: PLACES.marinaDock, text: 'Hand the crates to Tito on the dock', next: 'Cold cargo, warm money' },
    ],
    outro: [L('tito', 'Every crate. She said you were slow. She lied, or you did.')],
  },
  {
    id: 'bay-runner', title: 'Bay Runner', giver: 'dario', startAt: PLACES.garagePad,
    cash: 800, respect: 90,
    intro: [
      L('dario', 'Crates again, cousin. The bay road is watched tonight — run them up to El Faro anyway.'),
      L('dario', 'If the FALCON-1 finds you, do not stop to admire it.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.warehouse, text: 'Load the crates at ALMACÉN 9', next: 'The bay road is waiting' },
      { kind: 'deliverCar', at: PLACES.lighthouse, text: 'Run the crates up to El Faro', next: 'The bay goes quiet again' },
      { kind: 'escape', at: PLACES.beachBar, text: 'Lose the heat and reach Bar La Ola', next: 'Salt air hides everything' },
      { kind: 'goto', at: PLACES.garagePad, text: 'Bring the car home to Dario', next: 'He counts dents like rosary beads' },
    ],
    outro: [L('dario', 'The bay keeps its secrets. So do we.')],
  },
  {
    id: 'palma-showdown', title: 'Palma Showdown', giver: 'dario', startAt: PLACES.garagePad,
    cash: 1000, respect: 120,
    intro: [
      L('dario', 'The Red Sails pushed into the Palma alley again. The PAPD will come running at the noise — that is the point.'),
      L('marisol', 'Stand with our people, runner. Then be anywhere else.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.alleyShootout, text: 'Reach the Palma alley', next: 'It starts loud' },
      { kind: 'fight', at: PLACES.alleyShootout, count: 4, text: 'Hold the alley against the Red Sails', next: 'Sirens on the wind' },
      { kind: 'escape', at: PLACES.marisolCorner, text: 'Shake any heat from the gunfight', next: 'Gone and forgotten, like the Red Sails' },
      { kind: 'goto', at: PLACES.marisolCorner, text: 'Lay low at Marisol\'s corner', next: 'The quarter breathes again' },
    ],
    outro: [L('marisol', 'The alley remembers who stood in it.')],
  },
  {
    id: 'street-crown', title: 'Street Crown', giver: 'tito', startAt: PLACES.raceStart,
    cash: 900, respect: 110,
    intro: [
      L('tito', 'Eight gates, one loop, no brakes worth naming. My Street Crown does not care about your feelings.'),
      L('tito', 'Win it and the whole grid knows your engine note.'),
    ],
    stages: [
      { kind: 'race', at: PLACES.raceStart, text: 'Win Tito\'s Street Crown', next: 'The grid is watching' },
      { kind: 'goto', at: PLACES.plaza, text: 'Take the crown lap past the plaza', next: 'Let them see it' },
    ],
    outro: [L('tito', 'A crown is just a target that shines. Wear it well.')],
  },
  {
    id: 'fares', title: 'Fares of Puerto Alba', giver: 'tito', startAt: PLACES.plaza,
    cash: 700, respect: 80,
    intro: [
      L('tito', 'Everyone in this city is late for something. Three fares, runner — pick them up, drop them off, no sightseeing.'),
    ],
    stages: [
      { kind: 'fare', count: 3, text: 'Run Tito\'s fares across the city', next: 'Five stars or nothing' },
      { kind: 'goto', at: PLACES.plaza, text: 'Return to Tito at the plaza', next: 'He tips in respect' },
    ],
    outro: [L('tito', 'Three fares, zero complaints. You are wasted on crime.')],
  },
  {
    id: 'takedown', title: 'Takedown', giver: 'dario', startAt: PLACES.garagePad,
    cash: 1100, respect: 130,
    intro: [
      L('dario', 'A Red Sails wheelman is moving product through my streets in a grey sport. Stop the car. However you like.'),
    ],
    stages: [
      { kind: 'takedown', at: PLACES.warehouse, text: 'Stop the Red Sails wheelman', next: 'Metal on metal' },
      { kind: 'goto', at: PLACES.garagePad, text: 'Report to Dario', next: 'The streets cool down' },
    ],
    outro: [L('dario', 'Stopped. The city exhales.')],
  },
  {
    id: 'kingpin', title: 'Kingpin\'s Gambit', giver: 'marisol', startAt: PLACES.marisolCorner,
    cash: 2000, respect: 250,
    intro: [
      L('marisol', 'One last load, runner — the whole bay in a single run. The marina gate, on the clock, and the Red Sails will not wave you through.'),
      L('marisol', 'Do this and Puerto Alba is yours as much as mine.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.warehouse, text: 'Take the final load at ALMACÉN 9', next: 'Everything rides on one car' },
      { kind: 'fight', at: PLACES.warehouse, count: 3, text: 'Clear the warehouse yard', next: 'Now drive' },
      { kind: 'timed', at: PLACES.marinaGate, time: 170, text: 'Race the gambit to the marina gate', next: 'The bay decides' },
      { kind: 'goto', at: PLACES.marisolCorner, text: 'Stand before La Jefa', next: 'Kingpin of Puerto Alba' },
    ],
    outro: [L('marisol', 'Puerto Alba has a new name whispered in it. Yours.')],
  },
];

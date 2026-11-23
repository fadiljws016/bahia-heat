// story.js — the words of Bahia Heat: who gives the work, what the work
// is, and what gets said on the corner before it starts. This file is
// pure data — the engine that runs it lives in missions.js, the faces
// and voices on the HUD come from CHARACTERS, and the shape of a job is
// a list of stages, each with the line the mission panel shows and the
// line it promises next. Eight jobs: a theft, a timed delivery, a
// smuggler's run, a shootout, a checkpoint race, a season of taxi fares,
// a takedown and a five-star finale. Marisol "La Jefa" Quintana runs
// the market corner and most of the city's favours; Bruno "El Faro"
// Cádiz moves crates through the marina and trusts nobody after dark;
// Dario Ferrer keeps the garage and the grudges; Tito Vidal owns the
// boulevard's street-racing crown and rents it out one night at a time.

/** The people the dialogue box can speak for: name, initials, colour. */
export const CHARACTERS = {
  marisol: { name: 'Marisol "La Jefa" Quintana', initials: 'MQ', color: '#e8a33c' },
  bruno: { name: 'Bruno "El Faro" Cádiz', initials: 'BC', color: '#7ab0ff' },
  dario: { name: 'Dario Ferrer', initials: 'DF', color: '#e86a1e' },
  tito: { name: 'Tito Vidal', initials: 'TV', color: '#35b06f' },
  runner: { name: 'The Runner', initials: 'RN', color: '#0f766e' },
};

/**
 * A stage: `kind` is the engine verb (missions.js), `objective` is the
 * line the panel shows while it runs, `next` is the promise under it,
 * `at` names a place in city.js's PLACES table, and the extra fields
 * are the verb's own numbers (a clock for timed stages, a headcount
 * for a fight, a fare count for a shift).
 */
export const MISSIONS = [
  {
    title: 'First Wheels',
    giver: 'marisol',
    reward: { cash: 350, respect: 60 },
    intro: [
      { who: 'marisol', text: 'You are the new legs on my corner. Good — mine are tired of walking.' },
      { who: 'marisol', text: 'A blue-top sedan sits outside Bar La Ola. Its owner owes me. Bring it to Dario\'s garage — quietly, if you can.' },
      { who: 'runner', text: 'And if quiet is not on the menu?' },
      { who: 'marisol', text: 'Then bring it loud, runner. Just bring it.' },
    ],
    stages: [
      { kind: 'goto', objective: 'Head to Bar La Ola on Playa Brava', next: 'The owed sedan is parked by the bar', at: 'barLaOla' },
      { kind: 'steal', objective: 'Take the blue-top sedan', next: 'Bring it to Dario\'s garage — quietly, if you can', at: 'barLaOla' },
      { kind: 'deliverCar', objective: 'Deliver the sedan to Dario\'s garage', next: 'Lose any tail before you roll in', at: 'garagePad' },
      { kind: 'goto', objective: 'Collect your cut from Marisol', next: 'Back to the corner — she pays in person', at: 'marisolCorner' },
    ],
  },
  {
    title: 'Hot Delivery',
    giver: 'tito',
    reward: { cash: 520, respect: 90 },
    unlock: 'smg',
    intro: [
      { who: 'tito', text: 'You drive like you have somewhere to be. I like that. I have crates that have somewhere to be.' },
      { who: 'tito', text: 'Marina docks, my Fuego, one gate, no sightseeing. The clock is the whole conversation.' },
    ],
    stages: [
      { kind: 'goto', objective: 'Pick up the load at the marina docks', next: 'Tito is waiting by the crates', at: 'marinaDock' },
      { kind: 'goto', objective: 'Take the wheel of the loaded Fuego', next: 'Keep it clean on the boulevard', at: 'marinaDock' },
      { kind: 'timed', objective: 'Race the load to the marina gate', next: 'Beat the clock — the boulevard is fastest', at: 'marinaGate', time: 95 },
      { kind: 'goto', objective: 'Return to Tito for the bonus', next: 'He pays extra if the paint is clean', at: 'raceStart' },
    ],
  },
  {
    title: 'Bay Runner',
    giver: 'bruno',
    reward: { cash: 640, respect: 120 },
    intro: [
      { who: 'bruno', text: 'Marisol says your hands are steady. The bay at night eats unsteady hands.' },
      { who: 'bruno', text: 'Crates go up to El Faro. Any wheels will do — lose the tail if you can.' },
    ],
    stages: [
      { kind: 'goto', objective: 'Take Bruno\'s brief at the marina', next: 'A quiet job, he says', at: 'marinaDock' },
      { kind: 'timed', objective: 'Run the crates up to El Faro', next: 'Any wheels will do — lose the tail if you can', at: 'lighthouse', time: 150 },
      { kind: 'escape', objective: 'Lose the PAPD tail', next: 'Break their sight line — alleys are your friend', at: 'lighthouse' },
      { kind: 'goto', objective: 'Drop word at the El Faro cache', next: 'Bruno counts every box', at: 'lighthouse' },
    ],
  },
  {
    title: 'Palma Showdown',
    giver: 'marisol',
    reward: { cash: 800, respect: 160 },
    unlock: 'shotgun',
    intro: [
      { who: 'marisol', text: 'The Red Sails want my alley and call it a parley. You know what a parley is, in the old port?' },
      { who: 'runner', text: 'An ambush with better manners.' },
      { who: 'marisol', text: 'Then you are dressed correctly. Go and be polite.' },
    ],
    stages: [
      { kind: 'goto', objective: 'Meet the Red Sails at the old-port alley', next: 'They say it is a parley', at: 'alleyShootout' },
      { kind: 'fight', objective: 'Survive the ambush', next: 'Hold the alley — nobody runs', at: 'alleyShootout', hostiles: 5 },
      { kind: 'escape', objective: 'Shake any heat from the gunfight', next: 'Gone and forgotten, like the Red Sails', at: 'alleyShootout' },
      { kind: 'goto', objective: 'Report back to Marisol', next: 'Tell her the alley is quiet again', at: 'marisolCorner' },
    ],
  },
  {
    title: 'Street Crown',
    giver: 'tito',
    reward: { cash: 700, respect: 150 },
    intro: [
      { who: 'tito', text: 'Three legs, one crown, every light on the boulevard watching. You wear it or I keep it.' },
      { who: 'tito', text: 'Hit every checkpoint. The city is the track; the PAPD are just scenery with sirens.' },
    ],
    stages: [
      { kind: 'goto', objective: 'Head to Tito\'s start line on the boulevard', next: 'The flag drops when you roll in', at: 'raceStart' },
      { kind: 'race', objective: 'Run the checkpoint crown — leg one', next: 'North lights, then the lighthouse climb', leg: 0 },
      { kind: 'race', objective: 'Leg two — the old port climb', next: 'Across the south roads, no shortcuts through shops', leg: 1 },
      { kind: 'race', objective: 'Final leg — bring it home', next: 'The crown is heavy. Drive like it is yours', leg: 2 },
    ],
  },
  {
    title: 'Fares of Puerto Alba',
    giver: 'dario',
    reward: { cash: 90, respect: 25 },
    intro: [
      { who: 'dario', text: 'Half this city owes me a ride and the other half owes me money. You can fix one of those.' },
      { who: 'dario', text: 'Pick them up, drop them off, keep the paint on. The meter is honest even if I am not.' },
    ],
    stages: [
      { kind: 'fare', objective: 'Work the taxi fares', next: 'Every fare is cash in the door', fares: 2 },
      { kind: 'fare', objective: 'Keep the fares coming', next: 'The night shift pays better', fares: 2 },
      { kind: 'fare', objective: 'The last fares of the shift', next: 'Dario splits the take at the garage', fares: 2 },
      { kind: 'goto', objective: 'Settle up at Dario\'s garage', next: 'He counts twice and pays once', at: 'garagePad' },
    ],
  },
  {
    title: 'Takedown',
    giver: 'dario',
    reward: { cash: 900, respect: 180 },
    intro: [
      { who: 'dario', text: 'A courier is moving my parts in my own truck and charging me rent for the privilege.' },
      { who: 'dario', text: 'Find him, lean on him, and bring my Carguero home. The parts are fragile. He is not.' },
    ],
    stages: [
      { kind: 'goto', objective: 'Find the courier\'s trail at the hospital', next: 'He makes the pharmacy run at dusk', at: 'hospital' },
      { kind: 'takedown', objective: 'Run the courier down', next: 'Ram him out — the truck must survive', at: 'hospital' },
      { kind: 'deliverCar', objective: 'Bring the Carguero back to the garage', next: 'Dario is watching the gate', at: 'garagePad' },
      { kind: 'goto', objective: 'Face Dario\'s gratitude', next: 'It sounds like complaining. It is not', at: 'garagePad' },
    ],
  },
  {
    title: 'Kingpin\'s Gambit',
    giver: 'marisol',
    reward: { cash: 1600, respect: 320 },
    intro: [
      { who: 'marisol', text: 'One last favour, and then the corner is yours whenever you want it. The whole city will watch.' },
      { who: 'marisol', text: 'Take the harbourmaster\'s car from under FALCON-1\'s nose and park it at my door. Five stars, runner. Earn them.' },
    ],
    stages: [
      { kind: 'steal', objective: 'Take the harbourmaster\'s sport at the station', next: 'Every camera in the PAPD is awake', at: 'policeStation', wanted: 5 },
      { kind: 'escape', objective: 'Carry the heat across the city', next: 'They cannot bust what they cannot box', at: 'policeStation' },
      { kind: 'deliverCar', objective: 'Park it at Marisol\'s door', next: 'The corner is watching', at: 'marisolCorner' },
      { kind: 'goto', objective: 'Take your bow on the corner', next: 'Kingpin of Puerto Alba has a nice ring', at: 'marisolCorner' },
    ],
  },
];

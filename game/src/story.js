// story.js — the people and jobs of Puerto Alba. Pure data: characters,
// and eight missions whose stages the engine in missions.js interprets.
// Stage types: goto, steal, deliverCar, timed, escape, fight, race, fare,
// takedown. Targets name PLACES keys from city.js.

export const CHARACTERS = {
  marisol: {
    name: 'Marisol "La Jefa" Quintana',
    short: 'Marisol',
    color: 0xd8402e,
    role: 'Fixer of Marina Alta',
    bio: 'Runs the marina, the money and half the police payroll. Cross her once and the bay keeps you.',
  },
  dario: {
    name: 'Dario Quintana',
    short: 'Dario',
    color: 0x2f7fd0,
    role: 'Mechanic, Marina Alta garage',
    bio: "Marisol's brother. Can make any car disappear in twenty minutes, paperwork included.",
  },
  tito: {
    name: 'Tito Ferreira',
    short: 'Tito',
    color: 0xf2b13c,
    role: 'Street Crown promoter',
    bio: 'Owns the night races and every stopwatch in Las Palmas. Respects only lap times.',
  },
  vera: {
    name: 'Vera Salas',
    short: 'Vera',
    color: 0x8a5fc0,
    role: 'Red Sails captain',
    bio: 'Smuggler with a red shirt and a short memory for debts. The Palma alley is her office.',
  },
};

const L = (who, text) => ({ who, text });

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'marisol',
    intro: [
      L('Marisol "La Jefa" Quintana', 'You came. Good — Puerto Alba eats the slow, so listen fast.'),
      L('Marisol "La Jefa" Quintana', 'A blue-top sedan sits outside Bar La Ola on Playa Brava. Its owner owes me. Bring it to Dario\'s garage — quietly, if you can.'),
      L('Marisol "La Jefa" Quintana', 'Do this clean and there will be more. There is always more.'),
    ],
    outro: [
      L('Dario Quintana', 'She runs, she shines, she has no history. You do good work, friend.'),
      L('Marisol "La Jefa" Quintana', 'First wheels. Now you are on my board. Rest — tomorrow the bay gets busy.'),
    ],
    stages: [
      { type: 'goto', place: 'barLaOla', objective: 'Head to Bar La Ola on Playa Brava', next: 'Wheels up — Dario is waiting', radius: 7 },
      { type: 'steal', place: 'barLaOla', objective: 'Take the blue-top sedan', next: 'Wheels up — Dario is waiting', radius: 5 },
      { type: 'deliverCar', place: 'garage', objective: "Deliver the sedan to Dario's garage", next: 'Wheels up — Dario is waiting', radius: 8 },
      { type: 'goto', place: 'dario', objective: 'Collect your cut from Dario', next: 'Wheels up — Dario is waiting', radius: 4 },
    ],
    reward: { cash: 350, respect: 30 },
    unlock: 'pistol',
  },
  {
    id: 'hot-delivery',
    title: 'Hot Delivery',
    giver: 'marisol',
    intro: [
      L('Marisol "La Jefa" Quintana', 'A load came in cold and it has to reach the marina gate warm. No stops. The PAPD counts trucks today.'),
      L('Marisol "La Jefa" Quintana', 'You drive it like the bay is watching. Because it is.'),
    ],
    outro: [
      L('Marisol "La Jefa" Quintana', 'Warm, on time, unopened. You are becoming expensive, and I mean that as praise.'),
    ],
    stages: [
      { type: 'goto', place: 'garage', objective: "Pick up the load at Dario's garage", next: 'Cold cargo, warm money', radius: 7 },
      { type: 'steal', place: 'garage', objective: 'Take the loaded Mulo truck', next: 'Cold cargo, warm money', radius: 5 },
      { type: 'timed', place: 'marinaGate', objective: 'Race the load to the marina gate', next: 'Cold cargo, warm money', radius: 9, time: 150 },
      { type: 'escape', objective: 'Lose the PAPD tail', next: 'Cold cargo, warm money', radius: 0 },
    ],
    reward: { cash: 600, respect: 55 },
    unlock: 'smg',
  },
  {
    id: 'bay-runner',
    title: 'Bay Runner',
    giver: 'marisol',
    intro: [
      L('Marisol "La Jefa" Quintana', 'Crates came off a boat that does not exist. They sleep tonight at the marina, and by dawn they must be at El Faro.'),
      L('Marisol "La Jefa" Quintana', 'The boulevard will be watched. Run it anyway.'),
    ],
    outro: [
      L('Marisol "La Jefa" Quintana', 'The lighthouse keeper sends his thanks and asks no questions. Neither do I.'),
    ],
    stages: [
      { type: 'goto', place: 'marina', objective: 'Collect the crates at the marina docks', next: 'Salt air hides everything', radius: 8 },
      { type: 'timed', place: 'lighthouse', objective: 'Run the crates up to El Faro', next: 'Salt air hides everything', radius: 10, time: 170 },
      { type: 'escape', objective: 'Shake the FALCON-1 spotlight', next: 'Salt air hides everything', radius: 0 },
      { type: 'goto', place: 'marisol', objective: 'Report back to Marisol', next: 'Salt air hides everything', radius: 5 },
    ],
    reward: { cash: 750, respect: 70 },
    unlock: null,
  },
  {
    id: 'palma-showdown',
    title: 'Palma Showdown',
    giver: 'vera',
    intro: [
      L('Vera Salas', 'Your fixer and I disagree about a debt, green shirt. Settle it my way and the Red Sails owe YOU.'),
      L('Vera Salas', 'The Palma alley, Centro Alba. Bring the long gun. Bring nerve.'),
    ],
    outro: [
      L('Vera Salas', 'Enough! The debt is ash. Tell La Jefa the bay is big enough — barely.'),
      L('Marisol "La Jefa" Quintana', 'You negotiated with a shotgun. My kind of diplomacy.'),
    ],
    stages: [
      { type: 'goto', place: 'alleyShootout', objective: 'Meet Vera in the Palma alley', next: 'The quarter breathes again', radius: 7 },
      { type: 'fight', place: 'alleyShootout', objective: 'Survive the Red Sails ambush', next: 'The quarter breathes again', radius: 16, enemies: 4 },
      { type: 'escape', objective: 'Shake any heat from the gunfight', next: 'The quarter breathes again', radius: 0 },
      { type: 'goto', place: 'marisol', objective: 'Tell Marisol how it ended', next: 'The quarter breathes again', radius: 5 },
    ],
    reward: { cash: 900, respect: 90 },
    unlock: 'shotgun',
  },
  {
    id: 'street-crown',
    title: 'Street Crown',
    giver: 'tito',
    intro: [
      L('Tito Ferreira', 'Three checkpoints, one crown, no brakes worth trusting. Beat the Palma line and Las Palmas learns your name.'),
    ],
    outro: [
      L('Tito Ferreira', 'The Crown has a new head. Wear it loud, champion.'),
    ],
    stages: [
      { type: 'goto', place: 'raceStart', objective: 'Meet Tito at the Street Crown start', next: 'Three lights, one crown', radius: 7 },
      { type: 'race', objective: 'Hit every checkpoint and take the Crown', next: 'Three lights, one crown', radius: 9, time: 210,
        checkpoints: ['raceStart', 'clockTower', 'marinaGate', 'raceStart'] },
      { type: 'goto', place: 'raceStart', objective: 'Collect the purse from Tito', next: 'Three lights, one crown', radius: 6 },
    ],
    reward: { cash: 1100, respect: 110 },
    unlock: null,
  },
  {
    id: 'fares',
    title: 'Fares of Puerto Alba',
    giver: 'dario',
    intro: [
      L('Dario Quintana', 'My taxi driver is "sick" — the kind of sick that wears a PAPD badge by night. Cover his fares, keep the change.'),
    ],
    outro: [
      L('Dario Quintana', 'Five stars. The cab smells like money and so do you.'),
    ],
    stages: [
      { type: 'steal', place: 'garage', objective: 'Take the Taxi Alba from the garage', next: 'Every fare tells a story', radius: 6 },
      { type: 'fare', objective: 'Work the fares across Puerto Alba', next: 'Every fare tells a story', radius: 6, fares: 3,
        checkpoints: ['hospital', 'clockTower', 'papd', 'marina'] },
      { type: 'deliverCar', place: 'garage', objective: 'Bring the taxi home', next: 'Every fare tells a story', radius: 8 },
    ],
    reward: { cash: 800, respect: 60 },
    unlock: null,
  },
  {
    id: 'takedown',
    title: 'Takedown',
    giver: 'marisol',
    intro: [
      L('Marisol "La Jefa" Quintana', 'A Red Sails lieutenant runs protection in Viejo Puerto and forgot who protects HIM. Remind the quarter.'),
    ],
    outro: [
      L('Marisol "La Jefa" Quintana', 'Protection money flows uphill again. To me. As it should.'),
    ],
    stages: [
      { type: 'goto', place: 'marinaGate', objective: 'Find the lieutenant near the marina gate', next: 'Debts are collected in person', radius: 9 },
      { type: 'takedown', place: 'marinaGate', objective: 'Take the lieutenant down', next: 'Debts are collected in person', radius: 20 },
      { type: 'escape', objective: 'Vanish before the PAPD net closes', next: 'Debts are collected in person', radius: 0 },
    ],
    reward: { cash: 1000, respect: 100 },
    unlock: null,
  },
  {
    id: 'kingpin',
    title: "Kingpin's Gambit",
    giver: 'marisol',
    intro: [
      L('Marisol "La Jefa" Quintana', 'Everything you have done was an interview, green shirt. Tonight we take the port itself.'),
      L('Marisol "La Jefa" Quintana', 'Steal the harbour master\'s cruiser, run the gate, and Puerto Alba wakes up ours.'),
    ],
    outro: [
      L('Marisol "La Jefa" Quintana', 'The bay, the docks, the dawn. Ours. Do not let it make you slow.'),
    ],
    stages: [
      { type: 'steal', place: 'papd', objective: 'Steal the harbour master\'s cruiser at the PAPD yard', next: 'The bay provides', radius: 8 },
      { type: 'timed', place: 'marinaGate', objective: 'Run the marina gate before the net closes', next: 'The bay provides', radius: 9, time: 120 },
      { type: 'fight', place: 'marina', objective: 'Hold the docks against the last loyalists', next: 'The bay provides', radius: 18, enemies: 5 },
      { type: 'escape', objective: 'Disappear into the golden hour', next: 'The bay provides', radius: 0 },
    ],
    reward: { cash: 2500, respect: 220 },
    unlock: null,
  },
];

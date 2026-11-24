// story.js — the people and the jobs: Marisol "La Jefa" Quintana runs
// Puerto Alba's underworld from the Marina Alta promenade; Tito runs the
// street races; Dario runs the garage. Eight jobs climb the ranks from
// Runner to Kingpin. Dialogue lines are [speakerKey, text] pairs.

export const CHARACTERS = {
  marisol: { name: 'Marisol "La Jefa" Quintana', short: 'Marisol', color: 0xd8402e, initials: 'MQ' },
  tito: { name: 'Tito Ferrer', short: 'Tito', color: 0xf2b13c, initials: 'TF' },
  dario: { name: 'Dario Quintana', short: 'Dario', color: 0x2f7fd0, initials: 'DQ' },
  player: { name: 'You', short: 'You', color: 0x35b06f, initials: 'YOU' },
  dispatch: { name: 'PAPD Dispatch', short: 'Dispatch', color: 0x27313a, initials: 'PD' },
};

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', giver: 'marisol',
    brief: 'Steal the blue-top sedan outside Bar La Ola and deliver it to Dario.',
    reward: { cash: 300, respect: 60 },
    intro: [
      ['marisol', 'You came. Good — the bay rewards people who show up.'],
      ['marisol', 'A blue-top sedan sits outside Bar La Ola. Its owner owes me. Bring it to Dario\'s garage — quietly, if you can.'],
      ['player', 'Consider it already his.'],
    ],
    outro: [
      ['dario', 'Clean lift. She\'ll pay for work like this.'],
      ['marisol', 'Good. Puerto Alba is starting to know your name.'],
    ],
    stages: [
      { kind: 'goto', at: 'bar', label: 'Head to Bar La Ola on Playa Brava', next: 'The owed sedan is parked by the bar' },
      { kind: 'steal', at: 'bar', label: 'Take the blue-top sedan', next: 'Lose any heat before the garage' },
      { kind: 'deliverCar', at: 'garage', label: 'Deliver the sedan to Dario\'s garage', next: 'One last thing' },
      { kind: 'goto', at: 'marisol', label: 'Report back to Marisol', next: 'Job done' },
    ],
  },
  {
    id: 'hot-delivery', title: 'Hot Delivery', giver: 'marisol',
    brief: 'Race the load from Centro Alba to the marina gate before the timer dies.',
    reward: { cash: 450, respect: 90 },
    intro: [
      ['marisol', 'Cold cargo, warm money. The marina gate, fast — the ice is melting.'],
      ['player', 'Then I won\'t stop for the view.'],
    ],
    outro: [['marisol', 'Still cold. You drive like the bay is chasing you.']],
    stages: [
      { kind: 'goto', at: 'marisol', label: 'Pick up the load from Marisol', next: 'Wheels are everything' },
      { kind: 'goto', at: 'garage', label: 'Collect the loaded Fuego from Dario', next: 'The clock is running' },
      { kind: 'timed', at: 'marinaGate', label: 'Race the load to the marina gate', time: 95, next: 'Beat the clock — the boulevard is fastest' },
      { kind: 'goto', at: 'marina', label: 'Hand the keys to the marina buyer', next: 'Job done' },
    ],
  },
  {
    id: 'bay-runner', title: 'Bay Runner', giver: 'marisol',
    brief: 'Collect the crates at El Faro, then outrun the PAPD.',
    reward: { cash: 600, respect: 120 },
    intro: [
      ['marisol', 'Crates washed up at El Faro. The PAPD will come sniffing — let them.'],
      ['player', 'And when they come?'],
      ['marisol', 'You run, Runner. That is the whole job.'],
    ],
    outro: [['marisol', 'Salt air hides everything. Even you.']],
    stages: [
      { kind: 'goto', at: 'marisol', label: 'Take the job from Marisol', next: 'The crates are waiting' },
      { kind: 'goto', at: 'crates', label: 'Run the crates up to El Faro', next: 'Salt air hides everything' },
      { kind: 'goto', at: 'marina', label: 'Move the crates to the marina', next: 'Almost home' },
      { kind: 'escape', label: 'Shake the PAPD heat', wanted: 3, next: 'Job done' },
    ],
  },
  {
    id: 'palma-showdown', title: 'Palma Showdown', giver: 'marisol',
    brief: 'The Red Sails are muscling into Palma. Settle it in the alley.',
    reward: { cash: 800, respect: 160 },
    intro: [
      ['marisol', 'Red Sails think Palma alley is theirs now. Correct them.'],
      ['player', 'With words?'],
      ['marisol', 'You are not known for your words.'],
    ],
    outro: [['marisol', 'The quarter breathes again. So do I.']],
    stages: [
      { kind: 'goto', at: 'alleyShootout', label: 'Head to the Palma alley', next: 'They brought friends' },
      { kind: 'fight', at: 'alleyShootout', label: 'Drive off the Red Sails', count: 4, next: 'The PAPD heard everything' },
      { kind: 'escape', label: 'Shake any heat from the gunfight', wanted: 2, next: 'Gone and forgotten, like the Red Sails' },
      { kind: 'goto', at: 'marisol', label: 'Report to Marisol', next: 'Job done' },
    ],
  },
];

MISSIONS.push(
  {
    id: 'street-crown', title: 'Street Crown', giver: 'tito',
    brief: 'Beat Tito\'s circuit of the city checkpoints.',
    reward: { cash: 700, respect: 150 },
    intro: [
      ['tito', 'Everyone talks. The Crown is settled at the wheel, primo.'],
      ['tito', 'Hit every checkpoint. Try to keep up with your own legend.'],
    ],
    outro: [['tito', 'The Crown fits you. Don\'t let it slip.']],
    stages: [
      { kind: 'goto', at: 'raceStart', label: 'Meet Tito at the race start', next: 'On your mark' },
      { kind: 'race', label: 'Win the Street Crown circuit', next: 'Job done' },
    ],
  },
  {
    id: 'fares', title: 'Fares of Puerto Alba', giver: 'dario',
    brief: 'Work the taxi: three fares across the districts, no dents.',
    reward: { cash: 550, respect: 110 },
    intro: [
      ['dario', 'My taxi, your hands. Three fares, and bring her back shining.'],
      ['player', 'A cab. You honour me, Dario.'],
      ['dario', 'Cash honours us both. Move.'],
    ],
    outro: [['dario', 'Not a scratch. The city pays its debts.']],
    stages: [
      { kind: 'goto', at: 'garage', label: 'Collect the taxi from Dario\'s', next: 'First fare is waiting' },
      { kind: 'fare', count: 3, label: 'Work the fares of Puerto Alba', next: 'Job done' },
    ],
  },
  {
    id: 'takedown', title: 'Takedown', giver: 'marisol',
    brief: 'Ram the courier off the road at the depot yard and take the case.',
    reward: { cash: 1000, respect: 200 },
    intro: [
      ['marisol', 'A courier carries what is mine through the depot yard tonight.'],
      ['marisol', 'Stop the car. Take the case. Leave the lesson.'],
    ],
    outro: [['marisol', 'The city is learning the price of crossing me.']],
    stages: [
      { kind: 'goto', at: 'takedownYard', label: 'Head to the depot yard', next: 'There he is' },
      { kind: 'takedown', at: 'takedownYard', label: 'Stop the courier and take the case', next: 'Job done' },
    ],
  },
  {
    id: 'kingpin', title: "Kingpin's Gambit", giver: 'marisol',
    brief: 'The final play: hit the villa, survive the response, own the bay.',
    reward: { cash: 2500, respect: 400 },
    intro: [
      ['marisol', 'Tonight we stop renting Puerto Alba and start owning it.'],
      ['marisol', 'The villa first. Then whatever the city throws at us.'],
      ['player', 'For the bay, La Jefa.'],
    ],
    outro: [
      ['marisol', 'Look at it, Kingpin. All of it. Ours.'],
      ['player', 'Ours.'],
    ],
    stages: [
      { kind: 'goto', at: 'villa', label: 'Go to the kingpin\'s villa', next: 'No turning back' },
      { kind: 'fight', at: 'villa', label: 'Survive the villa response', count: 6, next: 'One last run' },
      { kind: 'escape', label: 'Lose the heat — own the bay', wanted: 4, next: 'Job done' },
    ],
  },
);

// Meridian Heat — world constants and city layout data.
// Port Meridian is an original coastal city: five districts joined by a road grid,
// a beach on the west edge and a harbour on the south edge. Nothing here is copied
// from any commercial game.

export const WORLD = { width: 3400, height: 2600 };
export const VIEW = { width: 1280, height: 800 };

// Seeded random so the city, traffic and screenshots are reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function nextRandom() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DISTRICTS = [
  { name: 'Harbour Row', x: 0, y: 1900, w: 1200, h: 700, ground: '#3d5a4a', accent: '#c9a86a' },
  { name: 'Downtown', x: 1200, y: 800, w: 1200, h: 1100, ground: '#4a4a55', accent: '#e8b64c' },
  { name: 'Old Town', x: 0, y: 800, w: 1200, h: 1100, ground: '#5a4a3d', accent: '#d97b4f' },
  { name: 'Marina Beach', x: 0, y: 0, w: 1400, h: 800, ground: '#c2a878', accent: '#4fc3e8' },
  { name: 'North Industrial', x: 2400, y: 0, w: 1000, h: 2600, ground: '#55504a', accent: '#8fb8a8' },
  { name: 'Palm Heights', x: 1400, y: 0, w: 1000, h: 800, ground: '#6a7a4a', accent: '#e8e8d0' },
];

// Horizontal and vertical roads (centre lines). Blocks between them hold buildings.
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 500, 800, 1100, 1400, 1700, 2000, 2300];
export const ROAD_HALF = 26;

export const CAR_MODELS = [
  { name: 'Sunny Coupe', color: '#e84c3d', top: 260, accel: 320, grip: 3.2 },
  { name: 'Harbor Taxi', color: '#f2c230', top: 230, accel: 280, grip: 3.0 },
  { name: 'Palm Sedan', color: '#3d7ae8', top: 250, accel: 300, grip: 3.1 },
  { name: 'Dune Pickup', color: '#7a9a3d', top: 240, accel: 290, grip: 3.4 },
  { name: 'Coral Van', color: '#e87ab0', top: 210, accel: 250, grip: 2.8 },
  { name: 'Midnight Sport', color: '#2a2a35', top: 310, accel: 380, grip: 3.6 },
  { name: 'Meridian Police', color: '#1a1a22', top: 290, accel: 360, grip: 3.5 },
];

export const PED_NAMES = [
  'Mara', 'Tomas', 'Iris', 'Dario', 'Lena', 'Kofi', 'Sana', 'Ruth',
  'Pavel', 'Nia', 'Omar', 'Greta', 'Felix', 'Ana', 'Bruno', 'Cleo',
];

export const MISSIONS = [
  {
    id: 'm1', title: 'The Harbour Pickup',
    giver: 'Vera Kline', brief: 'Vera needs a package collected from the harbour warehouse and driven to the Marina diner. No questions, no stops.',
    steps: ['Drive to the harbour warehouse', 'Pick up the package', 'Deliver it to the Marina diner'],
    reward: 450,
  },
  {
    id: 'm2', title: 'Taxi Trouble',
    giver: 'Eddie Rook', brief: 'Eddie\'s rival cab crew is muscling in on Palm Heights. Drive three fares across town, then run the rivals off the boulevard.',
    steps: ['Pick up 3 fares in Palm Heights', 'Drop each fare at its marker', 'Chase the rival cabs out of Downtown'],
    reward: 700,
  },
  {
    id: 'm3', title: 'The Midnight Run',
    giver: 'Vera Kline', brief: 'One last job: a midnight run through the Industrial yards while the harbour police are watching. Lose the heat, make the drop, walk away clean.',
    steps: ['Reach the Industrial yard gate', 'Shake the police pursuit', 'Make the drop at the old crane'],
    reward: 1200,
  },
];

export const SAVE_KEY = 'meridian-heat-save-v1';
export const START_CASH = 120;
export const PLAYER_SPEED = 210;
export const PLAYER_HEALTH = 100;

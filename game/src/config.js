// SIMMER & SERVE — every tuning number and colour in one place.
// The kitchen is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 20,
  speed: 380,
  speedUpgrade: 1.25,
  interactRange: 78,
};

export const SERVICE = {
  count: 3,
  /** Seconds of play per service (day). */
  length: [75, 95, 115],
  /** Coins needed to clear each service. */
  goal: [45, 60, 90],
  /** Max orders alive at once. */
  maxOrders: [2, 3, 3],
  /** Seconds between new orders (shrinks as the service goes on). */
  spawnEvery: [12, 11, 11],
  /** Order patience in seconds (before the patience upgrade). */
  patience: [55, 50, 48],
  /** Which recipe ids may appear in each service. */
  menu: [
    ['salad', 'burger'],
    ['salad', 'burger', 'soup'],
    ['salad', 'burger', 'soup', 'stack'],
  ],
};

export const CHOP_SECONDS = 2.0;
export const COOK_SECONDS = 4.5;
export const BURN_SECONDS = 7.0; // grace after cooked before it burns
export const WASH_SECONDS = 2.0;
export const WALKOUTS_TO_LOSE = 3;
export const PLATES_START = 3;
export const TIP_PER_SECOND_LEFT = 0.25; // bonus coins per second left on the ticket

export const UPGRADES = [
  { id: 'shoes', name: 'Swift Shoes', desc: '+25% chef speed, all services' },
  { id: 'burner', name: 'Extra Burner', desc: '+2 stove slots (4 total)' },
  { id: 'patience', name: 'Calm Dining Room', desc: 'Guests wait +30% longer' },
];

export const PALETTE = {
  floor: '#e8cfa8',
  floorDark: '#dfc193',
  wall: '#f7ead7',
  wallTrim: '#b87333',
  counter: '#8a5a2e',
  counterTop: '#a9713d',
  steel: '#c9ced6',
  steelDark: '#9aa1ad',
  cream: '#f7ead7',
  ink: '#3a2a1a',
  muted: '#8a6f52',
  tomato: '#d94f3d',
  tomatoDark: '#b23a2c',
  basil: '#4f9d5d',
  basilDark: '#357a42',
  cheese: '#f2c94c',
  bun: '#e0a458',
  patty: '#6b4226',
  plate: '#fdfbf6',
  gold: '#e8a91c',
  danger: '#c0392b',
  panel: '#fff6e6',
  panelEdge: '#d9b98a',
  ticket: '#fffdf5',
  ok: '#2e7d46',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** localStorage key for the best result on this browser. */
export const BEST_KEY = 'simmer-and-serve.best';

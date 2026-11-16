// Staged scenes for screenshots: each one plays the real rules forward from
// a fresh world with a simple autopilot, so the frame is what a short game
// really looks like — and the same seed always gives the same frame.
//   ?shot=start  title screen over a live kitchen
//   ?shot=play   mid-rush: tickets, chopping, cooking, plating at once
//   ?shot=win    the win screen after clearing all three services
//   ?shot=loss   the loss screen after three walk-outs
import { FIELD, STEP, SERVICE } from './config.js';
import { SCREEN, createWorld, startGame, stepWorld, interact, inFlightComponents, applyUpgrade } from './world.js';
import { buildKitchen, nearestStation, pantryBin, finishedSlot, burntSlot, freeSlot } from './kitchen.js';
import { COMPONENTS, RECIPES, wantedByOrders } from './recipes.js';
import { PLAYER } from './config.js';

const SAMPLE = STEP;

/** Where the chef should stand to use a station. */
function stationSpot(world, kind, ingredient = null) {
  const s = ingredient
    ? world.stations.find((st) => st.kind === 'pantry' && st.ingredient === ingredient)
    : world.stations.find((st) => st.kind === kind);
  return s ? { x: s.ix, y: s.iy, station: s } : null;
}

function nearestOrderNeed(world) {
  // What component is still missing? If a dish is already on the plate,
  // finish THAT dish first — never fetch a part for another recipe while
  // the plate is half-built. Otherwise take the oldest ticket's next
  // missing piece, skipping one whose preparation station is busy.
  const plate = world.stations.find((s) => s.kind === 'plate');
  const board = world.stations.find((s) => s.kind === 'board');
  const stove = world.stations.find((s) => s.kind === 'stove');
  const inFlight = inFlightComponents(world);
  const boardFree = board.slots.some((s) => !s.item);
  const stoveFree = stove.slots.some((s) => !s.item);
  const stationFree = (need) => {
    const src = sourceOf(need);
    if (src.station === 'board') return boardFree;
    if (src.station === 'stove') return stoveFree;
    return true;
  };
  if (plate.components.length > 0) {
    for (const order of world.orders) {
      const recipe = RECIPES[order.recipeId];
      const needs = [...recipe.needs];
      let fits = true;
      for (const onPlate of plate.components) {
        const i = needs.indexOf(onPlate);
        if (i === -1) {
          fits = false;
          break;
        }
        needs.splice(i, 1);
      }
      if (!fits) continue;
      for (const need of needs) {
        if (!inFlight.includes(need) && stationFree(need)) return need;
      }
    }
    return null;
  }
  for (const order of world.orders) {
    const recipe = RECIPES[order.recipeId];
    for (const need of recipe.needs) {
      if (!inFlight.includes(need) && stationFree(need)) return need;
    }
  }
  return null;
}

/** True when the plate's components can still become some open order's dish. */
function plateStillUseful(world, plate) {
  if (plate.components.length === 0) return true;
  return world.orders.some((order) => {
    const needs = [...RECIPES[order.recipeId].needs];
    return plate.components.every((c) => {
      const i = needs.indexOf(c);
      if (i === -1) return false;
      needs.splice(i, 1);
      return true;
    });
  });
}


function sourceOf(need) {
  for (const [raw, yields] of Object.entries({ lettuce: 'lettuceChopped', tomato: 'tomatoChopped' })) {
    if (yields === need) return { raw, station: 'board' };
  }
  for (const [raw, yields] of Object.entries({ patty: 'pattyCooked', tomato: 'tomatoSoup' })) {
    if (yields === need) return { raw, station: 'stove' };
  }
  return { raw: need, station: null }; // bun, cheese: straight from the pantry
}

/**
 * One autopilot decision: { tx, ty, act } — walk toward (tx, ty), and press
 * use when close. Priorities: serve, clear burnt food, collect finished
 * work, plate, start the next missing component, wash plates.
 */
export function autopilot(world) {
  const p = world.player;
  const hands = p.hands;
  const plate = world.stations.find((s) => s.kind === 'plate');
  const board = world.stations.find((s) => s.kind === 'board');
  const stove = world.stations.find((s) => s.kind === 'stove');
  const sink = world.stations.find((s) => s.kind === 'sink');
  const win = world.stations.find((s) => s.kind === 'window');
  const bin = world.stations.find((s) => s.kind === 'bin');

  const go = (spot) => ({ tx: spot.x, ty: spot.y, act: Math.hypot(spot.x - p.x, spot.y - p.y) < PLAYER.interactRange * 0.85 });

  // 1. A finished dish goes straight to the window.
  if (hands && hands.kind === 'dish') return go({ x: win.ix, y: win.iy });
  // 2. Burnt food goes to the bin.
  if (hands && hands.kind === 'burnt') return go({ x: bin.ix, y: bin.iy });
  // 3. A component nobody wants any more goes to the bin.
  if (hands && hands.kind === 'component') {
    const inFlight = inFlightComponents(world).filter((c) => c !== hands.id);
    if (!wantedByOrders(hands.id, [...plate.components], world.orders, inFlight)) {
      return go({ x: bin.ix, y: bin.iy });
    }
    // 4. Otherwise plate it.
    return go({ x: plate.ix, y: plate.iy });
  }
  // 5. Hands empty: collect finished work first.
  if (!hands) {
    if (plate.dish) return go({ x: plate.ix, y: plate.iy });
    // A plate holding parts of a dish nobody ordered any more gets scraped
    // before it blocks the next dish.
    if (plate.components.length > 0 && !plateStillUseful(world, plate)) {
      return go({ x: plate.ix, y: plate.iy });
    }
    const burnt = burntSlot(stove) ?? burntSlot(board);
    if (burnt) {
      const st = burntSlot(stove) ? stove : board;
      return go({ x: st.ix, y: st.iy });
    }
    const done = finishedSlot(board) ?? finishedSlot(stove);
    if (done) {
      const st = finishedSlot(board) ? board : stove;
      return go({ x: st.ix, y: st.iy });
    }
    // 6. Collect a washed plate.
    if (sink.slots[0].done) return go({ x: sink.ix, y: sink.iy });
    // 7. No clean plates and the plating counter is empty: wash one.
    if (world.platesClean === 0 && world.platesDirty > 0 && plate.components.length === 0) {
      return go({ x: sink.ix, y: sink.iy });
    }
    // 8. Fetch the raw ingredient for the oldest ticket's next missing piece.
    const need = nearestOrderNeed(world);
    if (need) {
      const src = sourceOf(need);
      const spot = stationSpot(world, 'pantry', src.raw);
      if (spot) return go(spot);
    }
    // 9. Nothing to do: wait by the plating counter.
    return { tx: plate.ix, ty: plate.iy + 60, act: false };
  }
  // 10. Holding a raw ingredient: take it to its station.
  if (hands && hands.kind === 'raw') {
    const prep = { lettuce: 'board', tomato: null, patty: 'stove', bun: 'plate', cheese: 'plate' };
    // Tomato is ambiguous: chop it unless a soup is wanted and no soup is in flight.
    let target = prep[hands.id];
    if (hands.id === 'tomato') {
      const inFlight = inFlightComponents(world);
      const soupWanted = world.orders.some((o) => RECIPES[o.recipeId].needs.includes('tomatoSoup'));
      target = soupWanted && !inFlight.includes('tomatoSoup') ? 'stove' : 'board';
    }
    if (target === 'plate') {
      const inFlight = inFlightComponents(world).filter((c) => c !== hands.id);
      if (!wantedByOrders(hands.id, [...plate.components], world.orders, inFlight)) {
        return go({ x: bin.ix, y: bin.iy });
      }
      return go({ x: plate.ix, y: plate.iy });
    }
    const st = target === 'board' ? board : stove;
    if (target && freeSlot(st)) return go({ x: st.ix, y: st.iy });
    // Its station is blocked by a finished item nobody can collect while
    // these hands are full: bin the raw ingredient rather than wait forever.
    if (target && (finishedSlot(st) || burntSlot(st))) return go({ x: bin.ix, y: bin.iy });
    // Its station is busy: wait nearby until a slot frees.
    const st2 = target === 'board' ? board : stove;
    return { tx: st2.ix, ty: st2.iy + 70, act: false };
  }
  return { tx: FIELD.width / 2, ty: 400, act: false };
}

/** Run the world forward `seconds` with the autopilot steering. */
export function simulate(world, seconds, pilot = autopilot) {
  const steps = Math.floor(seconds / SAMPLE);
  let lastTarget = '';
  let lastActAt = -10;
  let simTime = 0;
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== SCREEN.PLAY) break;
    const { tx, ty, act } = pilot(world);
    const dx = tx - world.player.x;
    const dy = ty - world.player.y;
    const len = Math.hypot(dx, dy) || 1;
    const move = len > 24 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
    // Press "use" once on arrival, then retry every half second while the
    // chef waits at the target: a single press per step would spam errors,
    // and a single press ever would never retry a not-yet-ready station.
    const targetKey = `${Math.round(tx)},${Math.round(ty)}`;
    if (targetKey !== lastTarget) {
      lastTarget = targetKey;
      lastActAt = -10;
    }
    const arrived = act && len <= 30 && (simTime - lastActAt >= 0.5 || lastActAt < 0);
    if (arrived) lastActAt = simTime;
    const events = stepWorld(world, SAMPLE, move, arrived);
    simTime += SAMPLE;
    void events;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * The win scene plays all three services with the autopilot (upgrades: the
 * burner, then patience, then shoes) and the loss scene idles until the
 * guests walk out.
 */
export function stageShot(name, world) {
  if (name === 'win') {
    startGame(world);
    const upgrades = ['burner', 'patience', 'shoes'];
    let guard = 0;
    while (world.screen !== SCREEN.WIN && guard < 40) {
      guard += 1;
      simulate(world, 30);
      if (world.screen === SCREEN.UPGRADE) {
        const pick = upgrades.find((u) => !world.upgrades.has(u));
        if (pick) applyUpgrade(world, pick);
        else break;
      }
      if (world.screen === SCREEN.LOSS) break;
    }
    return { screen: world.screen, best: world.totalCoins };
  }
  if (name === 'loss') {
    startGame(world);
    // Idle chef: never serve, never cook — tickets expire one by one.
    simulate(world, 200, () => ({ tx: FIELD.width / 2, ty: 400, act: false }));
    return { screen: world.screen, best: 0 };
  }
  if (name === 'play') {
    startGame(world);
    simulate(world, 26);
    return { screen: SCREEN.PLAY, best: world.totalCoins };
  }
  // start: title over a kitchen that has just opened.
  startGame(world);
  world.screen = SCREEN.TITLE;
  simulate(world, 0);
  return { screen: SCREEN.TITLE, best: 0 };
}

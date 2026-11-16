// The game itself: services, orders, coins, walk-outs, upgrades, win and
// loss. Pure logic — no DOM, no audio here — so the same code runs in the
// browser, in the screenshot stager and in a headless test.
import {
  FIELD, PLAYER, SERVICE, WALKOUTS_TO_LOSE, PLATES_START, TIP_PER_SECOND_LEFT, UPGRADES,
} from './config.js';
import { COMPONENTS, INGREDIENTS, RECIPES, recipeFor, wantedByOrders } from './recipes.js';
import { buildKitchen, nearestStation, pantryBin, updateStations, freeSlot, finishedSlot, burntSlot } from './kitchen.js';
import { makeOrder, updateOrders, matchingOrder, serveValue, resetOrderIds } from './orders.js';
import { createPlayer, movePlayer, solidsOf } from './player.js';
import { makeRng } from './random.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  UPGRADE: 'upgrade',
  PAUSED: 'paused',
  WIN: 'win',
  LOSS: 'loss',
};

/** What the board turns a raw ingredient into. */
const BOARD_PREP = { lettuce: 'lettuceChopped', tomato: 'tomatoChopped' };
/** What the stove turns a raw ingredient into. */
const STOVE_PREP = { patty: 'pattyCooked', tomato: 'tomatoSoup' };

export function createWorld(seed = 1) {
  const world = {
    seed,
    rng: makeRng(seed),
    screen: SCREEN.TITLE,
    screenBeforePause: SCREEN.PLAY,
    service: 1,
    serviceTimeLeft: SERVICE.length[0],
    serviceCoins: 0,
    totalCoins: 0,
    served: 0,
    walkouts: 0,
    orders: [],
    spawnTimer: 3,
    platesClean: PLATES_START,
    platesDirty: 0,
    upgrades: new Set(),
    stations: buildKitchen(2),
    player: createPlayer(),
    /** Floating "+18" style feedbacks: { text, x, y, ttl, color }. */
    feedbacks: [],
    /** Last short message for the HUD ("No clean plates — wash one!"). */
    notice: '',
    noticeTtl: 0,
    lossReason: '',
    elapsed: 0,
    /** Click-to-move target: { x, y, station } or null. */
    clickTarget: null,
    stats: { bestService: 0 },
  };
  return world;
}

/** Fresh world for a new game, same seed. */
export function resetWorld(world, seed = 1) {
  const fresh = createWorld(seed);
  Object.keys(world).forEach((k) => delete world[k]);
  Object.assign(world, fresh);
  resetOrderIds();
}

function stationById(world, id) {
  return world.stations.find((s) => s.id === id);
}

function stationByKind(world, kind) {
  return world.stations.find((s) => s.kind === kind);
}

function speedOf(world) {
  return PLAYER.speed * (world.upgrades.has('shoes') ? PLAYER.speedUpgrade : 1);
}

function patienceOf(world) {
  const base = SERVICE.patience[world.service - 1];
  return world.upgrades.has('patience') ? base * 1.3 : base;
}

function burnerSlots(world) {
  return world.upgrades.has('burner') ? 4 : 2;
}

/** Start (or restart) a service: fresh tickets, fresh timer, same plates. */
export function startService(world, service) {
  world.service = service;
  world.serviceTimeLeft = SERVICE.length[service - 1];
  world.serviceCoins = 0;
  world.orders = [];
  world.spawnTimer = 2.5;
  world.walkouts = 0;
  world.player.x = FIELD.width / 2;
  world.player.y = 400;
  world.player.hands = null;
  world.clickTarget = null;
  world.stations = buildKitchen(burnerSlots(world));
  world.screen = SCREEN.PLAY;
}

export function startGame(world) {
  world.totalCoins = 0;
  world.served = 0;
  world.upgrades = new Set();
  world.platesClean = PLATES_START;
  world.platesDirty = 0;
  world.lossReason = '';
  startService(world, 1);
}

function addFeedback(world, text, x, y, color) {
  world.feedbacks.push({ text, x, y, ttl: 1.4, color });
}

function notice(world, text) {
  world.notice = text;
  world.noticeTtl = 2.2;
}

/** Components currently committed somewhere: plate, stations, hands. */
export function inFlightComponents(world) {
  const list = [];
  const plate = stationByKind(world, 'plate');
  list.push(...plate.components);
  for (const station of world.stations) {
    if (!station.slots) continue;
    for (const slot of station.slots) {
      if (slot.item) list.push(slot.item.yields);
    }
  }
  if (world.player.hands && (world.player.hands.kind === 'component'
    || (world.player.hands.kind === 'raw' && (world.player.hands.id === 'bun' || world.player.hands.id === 'cheese')))) {
    list.push(world.player.hands.id);
  }
  return list;
}

/**
 * Use the nearest station. Returns event names for sound (and the UI).
 * The chef's hands hold at most one thing: a raw ingredient, a prepared
 * component, a finished dish, or a burnt item.
 */
export function interact(world) {
  const player = world.player;
  const station = nearestStation(world.stations, player.x, player.y, PLAYER.interactRange);
  if (!station) return [];
  const hands = player.hands;
  const events = [];

  if (station.kind === 'pantry') {
    if (hands) { events.push('error'); notice(world, 'Hands full — put this down first'); return events; }
    const ing = INGREDIENTS[station.ingredient];
    player.hands = { kind: 'raw', id: ing.id, name: ing.name, color: ing.color };
    events.push('pickup');
    return events;
  }

  if (station.kind === 'board' || station.kind === 'stove') {
    const prep = station.kind === 'board' ? BOARD_PREP : STOVE_PREP;
    const burnt = burntSlot(station);
    if (burnt && !hands) {
      player.hands = { kind: 'burnt', id: burnt.item.yields, name: `Burnt ${burnt.item.name}`, color: '#2b2b2b' };
      burnt.item = null; burnt.progress = 0; burnt.done = false; burnt.burnt = false;
      events.push('pickup');
      return events;
    }
    const finished = finishedSlot(station);
    if (finished && !hands) {
      const comp = COMPONENTS[finished.item.yields];
      player.hands = { kind: 'component', id: comp.id, name: comp.name, color: comp.color };
      finished.item = null; finished.progress = 0; finished.done = false;
      events.push('pickup');
      return events;
    }
    if (hands && hands.kind === 'raw' && prep[hands.id]) {
      const free = freeSlot(station);
      if (!free) { events.push('error'); notice(world, station.kind === 'board' ? 'Board is busy' : 'Stove is full'); return events; }
      free.item = { rawId: hands.id, yields: prep[hands.id], name: INGREDIENTS[hands.id].name };
      free.progress = 0; free.done = false; free.burnt = false;
      player.hands = null;
      events.push('place');
      return events;
    }
    events.push('error');
    if (hands && hands.kind === 'raw') notice(world, station.kind === 'board' ? 'This needs the stove' : 'This needs the board');
    else if (hands) notice(world, 'Nothing to do here with that');
    else notice(world, 'Nothing ready here yet');
    return events;
  }

  if (station.kind === 'plate') {
    // Bun and cheese go on the plate straight from the pantry; everything
    // else must be chopped or cooked first.
    const isPlatable = hands && (hands.kind === 'component'
      || (hands.kind === 'raw' && (hands.id === 'bun' || hands.id === 'cheese')));
    if (isPlatable) {
      if (station.components.length === 0 && world.platesClean <= 0) {
        events.push('error'); notice(world, 'No clean plates — wash one at the sink!');
        return events;
      }
      const inFlight = inFlightComponents(world);
      const plateOnly = [...station.components];
      if (!wantedByOrders(hands.id, plateOnly, world.orders, inFlight.filter((c) => c !== hands.id))) {
        events.push('error'); notice(world, 'No order needs that right now');
        return events;
      }
      if (station.components.length === 0) world.platesClean -= 1;
      station.components.push(hands.id);
      player.hands = null;
      events.push('place');
      const dish = recipeFor(station.components);
      if (dish) {
        station.dish = dish.id;
        events.push('cooked');
        addFeedback(world, `${dish.name} ready!`, station.ix, station.y - 14, '#2e7d46');
      }
      return events;
    }
    if (!hands && station.dish) {
      const dish = RECIPES[station.dish];
      player.hands = { kind: 'dish', id: dish.id, name: dish.name, color: dish.color };
      station.components = [];
      station.dish = null;
      events.push('pickup');
      return events;
    }
    if (!hands && station.components.length > 0) {
      // Scrape a half-built plate into the bin: the plate comes back clean.
      station.components = [];
      world.platesClean += 1;
      events.push('place');
      notice(world, 'Plate scraped — start the dish again');
      return events;
    }
    events.push('error');
    if (hands) notice(world, 'Only prepared food goes on the plate');
    else if (station.components.length > 0) notice(world, 'Finish the dish first');
    else notice(world, 'Bring prepared food here to plate it');
    return events;
  }

  if (station.kind === 'window') {
    if (hands && hands.kind === 'dish') {
      const order = matchingOrder(world.orders, hands.id);
      if (!order) {
        events.push('error'); notice(world, 'No guest ordered that dish');
        return events;
      }
      const value = serveValue(order, TIP_PER_SECOND_LEFT);
      world.orders.splice(world.orders.indexOf(order), 1);
      world.serviceCoins += value;
      world.totalCoins += value;
      world.served += 1;
      world.platesDirty += 1;
      player.hands = null;
      events.push('serve', 'coin');
      addFeedback(world, `+${value}`, station.ix - 40, station.iy - 10, '#e8a91c');
      return events;
    }
    events.push('error');
    notice(world, hands ? 'That is not a finished dish' : 'Bring a finished dish to serve');
    return events;
  }

  if (station.kind === 'sink') {
    const slot = station.slots[0];
    if (slot.done && !hands) {
      world.platesClean += 1;
      world.platesDirty -= 1;
      slot.item = null; slot.progress = 0; slot.done = false;
      events.push('washed');
      return events;
    }
    if (!slot.item && world.platesDirty > 0 && !hands) {
      slot.item = { rawId: 'plate', yields: 'plate', name: 'Dirty plate' };
      slot.progress = 0; slot.done = false;
      events.push('wash');
      return events;
    }
    events.push('error');
    if (hands) notice(world, 'Put that down first');
    else if (slot.item) notice(world, 'Still washing…');
    else notice(world, 'No dirty plates to wash');
    return events;
  }

  if (station.kind === 'bin') {
    if (hands) {
      player.hands = null;
      events.push('place');
      return events;
    }
    events.push('error');
    notice(world, 'Nothing to throw away');
    return events;
  }

  return events;
}

/** Choose one of the three upgrades after clearing a service. */
export function applyUpgrade(world, upgradeId) {
  if (world.screen !== SCREEN.UPGRADE) return false;
  const found = UPGRADES.find((u) => u.id === upgradeId);
  if (!found || world.upgrades.has(upgradeId)) return false;
  world.upgrades.add(upgradeId);
  if (world.service >= SERVICE.count) {
    world.screen = SCREEN.WIN;
  } else {
    startService(world, world.service + 1);
  }
  return true;
}

function endService(world) {
  if (world.serviceCoins >= SERVICE.goal[world.service - 1]) {
    if (world.service >= SERVICE.count) {
      world.screen = SCREEN.WIN;
    } else {
      world.screen = SCREEN.UPGRADE;
    }
  } else {
    world.lossReason = 'time';
    world.screen = SCREEN.LOSS;
  }
}

/**
 * One fixed step. `move` is { x, y } axes (-1..1) and `act` asks to use the
 * nearest station. Returns sound event names.
 */
export function stepWorld(world, dt, move, act) {
  const events = [];
  if (world.screen !== SCREEN.PLAY) return events;
  world.elapsed += dt;

  // Click-to-move: walk to the target, then use the station.
  if (world.clickTarget) {
    const t = world.clickTarget;
    const dx = t.x - world.player.x;
    const dy = t.y - world.player.y;
    if (Math.hypot(dx, dy) < 30) {
      world.clickTarget = null;
      if (t.station) events.push(...interact(world));
    } else {
      move = { x: dx, y: dy };
    }
  }

  movePlayer(world.player, move.x, move.y, dt, speedOf(world), solidsOf(world.stations));
  if (act) events.push(...interact(world));

  events.push(...updateStations(world.stations, dt));

  // New tickets.
  world.spawnTimer -= dt;
  const menu = SERVICE.menu[world.service - 1];
  if (world.spawnTimer <= 0 && world.orders.length < SERVICE.maxOrders[world.service - 1]) {
    world.orders.push(makeOrder(world.rng, menu, patienceOf(world)));
    world.spawnTimer = SERVICE.spawnEvery[world.service - 1] * (0.85 + world.rng() * 0.3);
    events.push('click');
  }

  const expired = updateOrders(world.orders, dt);
  for (const order of expired) {
    world.walkouts += 1;
    events.push('walkout');
    addFeedback(world, `${order.name} walked out!`, FIELD.width / 2, 320, '#c0392b');
    if (world.walkouts >= WALKOUTS_TO_LOSE) {
      world.lossReason = 'walkouts';
      world.screen = SCREEN.LOSS;
      return events;
    }
  }

  // Service clock.
  world.serviceTimeLeft -= dt;
  if (world.serviceTimeLeft <= 0) {
    endService(world);
    return events;
  }

  // Feedback lifetimes.
  for (let i = world.feedbacks.length - 1; i >= 0; i -= 1) {
    world.feedbacks[i].ttl -= dt;
    world.feedbacks[i].y -= dt * 24;
    if (world.feedbacks[i].ttl <= 0) world.feedbacks.splice(i, 1);
  }
  if (world.noticeTtl > 0) {
    world.noticeTtl -= dt;
    if (world.noticeTtl <= 0) world.notice = '';
  }
  return events;
}

/** Where a click in the field should walk the chef, if anywhere. */
export function clickTargetFor(world, x, y) {
  for (const station of world.stations) {
    const d = Math.hypot(station.ix - x, station.iy - y);
    if (d < 110) return { x: station.ix, y: station.iy, station: true };
    if (x >= station.x - 10 && x <= station.x + station.w + 10
      && y >= station.y - 10 && y <= station.y + station.h + 10) {
      return { x: station.ix, y: station.iy, station: true };
    }
  }
  return { x, y, station: false };
}

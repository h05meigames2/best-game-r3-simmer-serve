// The kitchen itself: where every station sits, what each one holds, and how
// its timers run. The world owns the rules; this file owns the room.
import { CHOP_SECONDS, COOK_SECONDS, BURN_SECONDS, WASH_SECONDS } from './config.js';
import { INGREDIENTS } from './recipes.js';

/** Pantry bin order, left to right along the top counter. */
export const PANTRY_BINS = ['lettuce', 'tomato', 'patty', 'bun', 'cheese'];

/**
 * Build the station list. Counters hug the walls; the middle is open floor.
 * Each station carries its rectangle, the spot the chef stands to use it,
 * and (for board / stove / sink) its work slots.
 */
export function buildKitchen(burnerSlots) {
  const stations = [];
  // Pantry: five ingredient bins along the top-left counter.
  PANTRY_BINS.forEach((id, i) => {
    const x = 84 + i * 96;
    stations.push({
      id: `pantry-${id}`, kind: 'pantry', ingredient: id,
      x, y: 108, w: 88, h: 62, ix: x + 44, iy: 196,
      label: INGREDIENTS[id].name,
    });
  });
  // Chopping board, top centre: two slots, so two vegetables chop at once.
  stations.push({
    id: 'board', kind: 'board', x: 600, y: 108, w: 150, h: 62, ix: 675, iy: 196,
    label: 'Chopping Board',
    slots: [
      { item: null, progress: 0, done: false },
      { item: null, progress: 0, done: false },
    ],
  });
  // Stove, top right: two burners, four with the Extra Burner upgrade.
  const stoveSlots = [];
  for (let i = 0; i < burnerSlots; i += 1) {
    stoveSlots.push({ item: null, progress: 0, done: false, burnt: false });
  }
  stations.push({
    id: 'stove', kind: 'stove', x: 800, y: 108, w: 120 + burnerSlots * 62, h: 62,
    ix: 800 + (120 + burnerSlots * 62) / 2, iy: 196, label: 'Stove',
    slots: stoveSlots,
  });
  // Serving window, right wall.
  stations.push({
    id: 'window', kind: 'window', x: 1180, y: 260, w: 72, h: 190, ix: 1152, iy: 355,
    label: 'Serving Window',
  });
  // Plating counter, bottom centre.
  stations.push({
    id: 'plate', kind: 'plate', x: 420, y: 556, w: 440, h: 62, ix: 640, iy: 530,
    label: 'Plating Counter', components: [],
  });
  // Sink, bottom left.
  stations.push({
    id: 'sink', kind: 'sink', x: 84, y: 556, w: 150, h: 62, ix: 159, iy: 530,
    label: 'Sink',
    slots: [{ item: null, progress: 0, done: false }],
  });
  // Bin, bottom right.
  stations.push({
    id: 'bin', kind: 'bin', x: 980, y: 556, w: 150, h: 62, ix: 1055, iy: 530,
    label: 'Bin',
  });
  return stations;
}

/** The station whose use-spot is nearest the chef, within reach. */
export function nearestStation(stations, x, y, range) {
  let best = null;
  let bestD = range;
  for (const station of stations) {
    const d = Math.hypot(station.ix - x, station.iy - y);
    if (d < bestD) {
      bestD = d;
      best = station;
    }
  }
  return best;
}

/** A pantry bin by ingredient id. */
export function pantryBin(stations, ingredientId) {
  return stations.find((s) => s.kind === 'pantry' && s.ingredient === ingredientId);
}

/** Advance every work slot one step. Returns event strings for sounds. */
export function updateStations(stations, dt) {
  const events = [];
  for (const station of stations) {
    if (!station.slots) continue;
    for (const slot of station.slots) {
      if (!slot.item || slot.done) {
        // A cooked item left on the stove keeps burning.
        if (slot.item && station.kind === 'stove' && slot.done && !slot.burnt) {
          slot.burnTime = (slot.burnTime ?? 0) + dt;
          if (slot.burnTime >= BURN_SECONDS) {
            slot.burnt = true;
            events.push('burnt');
          }
        }
        continue;
      }
      const total = station.kind === 'board' ? CHOP_SECONDS
        : station.kind === 'sink' ? WASH_SECONDS : COOK_SECONDS;
      slot.progress += dt / total;
      if (slot.progress >= 1) {
        slot.progress = 1;
        slot.done = true;
        slot.burnTime = 0;
        events.push(station.kind === 'board' ? 'chopped' : station.kind === 'sink' ? 'washed' : 'cooked');
      }
    }
  }
  return events;
}

/** First free slot of a station, or null. */
export function freeSlot(station) {
  if (!station.slots) return null;
  return station.slots.find((s) => s.item === null) ?? null;
}

/** First finished, unburnt slot of a station, or null. */
export function finishedSlot(station) {
  if (!station.slots) return null;
  return station.slots.find((s) => s.item !== null && s.done && !s.burnt) ?? null;
}

/** First burnt slot of a station, or null. */
export function burntSlot(station) {
  if (!station.slots) return null;
  return station.slots.find((s) => s.item !== null && s.burnt) ?? null;
}

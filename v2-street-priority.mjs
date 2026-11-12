import { walkingDestinations } from './v2-destinations.mjs';

// Planning inputs for the mapped streets around Jalan Elmina Ilham 3.
// These values are relative priorities, not measured street temperatures.
export const ilhamAreaBounds = [[101.5135, 3.1844], [101.5221, 3.1890]];

const hourWeight = {
  7: .35, 8: .4, 9: .46, 10: .54, 11: .65, 12: .76, 13: 1,
  14: .76, 15: .7, 16: .62, 17: .53, 18: .42, 19: .3,
};

// Relative walking patterns for the three featured routes. These are planning
// inputs so the hourly comparison can reflect different route use patterns.
const routeHourWeight = {
  'Jalan Elmina Ilham 3': { 8: .32, 9: .42, 10: .55, 11: .68, 12: .82, 13: 1, 14: .8, 15: .7, 16: .56, 17: .4, 18: .28 },
  'Jalan Frekuensi U16/113': { 8: .85, 9: .72, 10: .58, 11: .5, 12: .48, 13: .5, 14: .52, 15: .6, 16: .72, 17: .88, 18: .9 },
  'Jalan Frekuensi U16/120': { 8: .95, 9: .78, 10: .65, 11: .58, 12: .55, 13: .55, 14: .58, 15: .66, 16: .74, 17: .86, 18: .8 },
};

// Preset relative walker baselines. Report cards and support add to these values.
const streetWeight = {
  'Jalan Elmina Ilham 3': .96,
  'Jalan Elmina Ilham 2': .72,
  'Jalan Elmina Ilham 4': .64,
  'Jalan Elmina Ilham 5': .57,
  'Jalan Frekuensi U16/110': .67,
  'Jalan Frekuensi U16/113': .56,
  'Jalan Frekuensi U16/113F': .5,
  'Jalan Frekuensi U16/113E': .48,
  'Jalan Frekuensi U16/113G': .52,
  'Jalan Frekuensi U16/118': .47,
  'Jalan Frekuensi U16/119': .52,
  'Jalan Frekuensi U16/120': .59,
  'Jalan Frekuensi U16/121': .61,
  'Jalan Frekuensi U16/140A': .49,
  'Jalan Frekuensi U16/140': .46,
};

export function inIlhamArea(road) {
  if (!['residential', 'tertiary', 'footway', 'path'].includes(road.kind)) return false;
  return streetGeometry(road).coordinates.length > 0;
}

export function streetGeometry(road) {
  const [[west, south], [east, north]] = ilhamAreaBounds;
  const lines = [];
  let current = [];
  for (let index = 1; index < road.coordinates.length; index++) {
    const [x, y] = road.coordinates[index - 1];
    const [nextX, nextY] = road.coordinates[index];
    const dx = nextX - x, dy = nextY - y;
    let start = 0, end = 1;
    for (const [p, q] of [[-dx, x - west], [dx, east - x], [-dy, y - south], [dy, north - y]]) {
      if (p === 0 && q < 0) { start = 1; end = 0; break; }
      if (p < 0) start = Math.max(start, q / p);
      if (p > 0) end = Math.min(end, q / p);
    }
    if (start > end) { current = []; continue; }
    const from = [x + start * dx, y + start * dy];
    const to = [x + end * dx, y + end * dy];
    if (current.length && current.at(-1).every((value, axis) => Math.abs(value - from[axis]) < 1e-9)) {
      current.push(to);
    } else {
      current = [from, to];
      lines.push(current);
    }
  }
  return { type: 'MultiLineString', coordinates: lines };
}

export function streetMidpoint(roads) {
  const segments = roads.flatMap(road => streetGeometry(road).coordinates.flatMap(line =>
    line.slice(1).map((point, index) => [line[index], point])));
  const lengths = segments.map(([from, to]) =>
    Math.hypot((to[0] - from[0]) * Math.cos(from[1] * Math.PI / 180), to[1] - from[1]));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
  for (let index = 0; index < segments.length; index++) {
    if (remaining <= lengths[index] || index === segments.length - 1) {
      const [from, to] = segments[index];
      const fraction = lengths[index] ? remaining / lengths[index] : 0;
      return from.map((value, axis) => value + (to[axis] - value) * fraction);
    }
    remaining -= lengths[index];
  }
  return null;
}

function distanceToRoadMetres(road, [longitude, latitude]) {
  const lines = streetGeometry(road).coordinates;
  const longitudeScale = 111320 * Math.cos(latitude * Math.PI / 180);
  const latitudeScale = 110574;
  let nearest = Infinity;
  for (const line of lines) for (let index = 1; index < line.length; index++) {
    const [startX, startY] = line[index - 1];
    const [endX, endY] = line[index];
    const dx = (endX - startX) * longitudeScale;
    const dy = (endY - startY) * latitudeScale;
    const x = (longitude - startX) * longitudeScale;
    const y = (latitude - startY) * latitudeScale;
    const fraction = Math.max(0, Math.min(1, (x * dx + y * dy) / (dx * dx + dy * dy || 1)));
    nearest = Math.min(nearest, Math.hypot(x - fraction * dx, y - fraction * dy));
  }
  return nearest;
}

const destinationCache = new WeakMap();
function pointDistanceMetres([fromLng, fromLat], [toLng, toLat]) {
  return Math.hypot((fromLng - toLng) * 111320 * Math.cos(fromLat * Math.PI / 180),
    (fromLat - toLat) * 110574);
}

export function destinationSignal(road, reportLocations = []) {
  const points = reportLocations.filter(point => Array.isArray(point) && point.length === 2
    && point.every(Number.isFinite));
  if (!points.length && destinationCache.has(road)) return destinationCache.get(road);
  const distancesByLocation = (points.length ? points : [null]).map(point =>
    walkingDestinations.map(place => point
      ? pointDistanceMetres(point, place.coordinates)
      : distanceToRoadMetres(road, place.coordinates)));
  const nearestDistances = walkingDestinations.map((_, index) =>
    Math.min(...distancesByLocation.map(distances => distances[index])));
  const nearestIndex = nearestDistances.indexOf(Math.min(...nearestDistances));
  const signal = {
    nearbyCount: nearestDistances.filter(distance => distance <= 1000).length,
    proximity: Math.min(1, distancesByLocation.reduce((sum, distances) =>
      sum + distances.reduce((total, distance) => total + Math.max(0, 1 - distance / 1500), 0)
      / (walkingDestinations.length * .625), 0) / distancesByLocation.length),
    nearestName: walkingDestinations[nearestIndex]?.name ?? null,
    nearestDistance: nearestDistances[nearestIndex] ?? null,
  };
  if (!points.length) destinationCache.set(road, signal);
  return signal;
}

export function priorityFactors(road, hour, { reportCount = 0, supportCount = 0,
  concernKind = null, reportLocations = [] } = {}) {
  const destinations = destinationSignal(road, reportLocations);
  const base = streetWeight[road.name]
    ?? (road.kind === 'residential' ? .54 : road.kind === 'tertiary' ? .6 : .43);
  const baseWalkers = road.name === 'Jalan Elmina Ilham 3' ? 120 : Math.round(120 * Math.pow(base, .25));
  const hourPattern = routeHourWeight[road.name]?.[hour] ?? hourWeight[hour] ?? hourWeight[13];
  const walkerCount = Math.round(baseWalkers * hourPattern
    + Math.max(0, reportCount) * 8 + Math.max(0, supportCount) * 4);
  const daylight = hour <= 7 || hour >= 19 ? 0 : Math.sin(Math.PI * (hour - 7) / 12);
  const condition = concernKind === 'hot' ? daylight
    : concernKind === 'dark' ? 1 - daylight
    : concernKind === 'cross' ? .88
    : concernKind === 'broken_path' || concernKind === 'broken' ? .85 : .55;
  const conditionLabel = concernKind === 'hot' ? 'In sun'
    : concernKind === 'dark' ? 'Too dark'
    : concernKind === 'cross' ? 'Crossing risk'
    : concernKind === 'broken_path' || concernKind === 'broken' ? 'Path condition' : 'Street condition';
  return {
    walkers: Math.min(1, walkerCount / 160),
    walkerCount,
    reportCount,
    supportCount,
    destinations: destinations.proximity,
    nearbyDestinations: destinations.nearbyCount,
    nearestDestination: destinations.nearestName,
    nearestDestinationMetres: destinations.nearestDistance,
    condition,
    conditionLabel,
  };
}

export function priorityAt(road, hour, inputs = {}) {
  const factors = priorityFactors(road, hour, inputs);
  return factors.walkers * factors.condition * factors.destinations;
}

export function priorityColor(score) {
  return score >= .75 ? '#b52f27' : score >= .55 ? '#dc6940'
    : score >= .35 ? '#e0a019' : '#2e9d6c';
}

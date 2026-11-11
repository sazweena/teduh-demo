// Planning inputs for the mapped streets around Jalan Elmina Ilham 3.
// These values are relative priorities, not measured street temperatures.
export const ilhamAreaBounds = [[101.5135, 3.1844], [101.5221, 3.1890]];

const hourWeight = {
  7: .35, 8: .4, 9: .46, 10: .54, 11: .65, 12: .76, 13: 1,
  14: .76, 15: .7, 16: .62, 17: .53, 18: .42, 19: .3,
};

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

export function priorityFactors(road, hour) {
  const base = streetWeight[road.name]
    ?? (road.kind === 'residential' ? .54 : road.kind === 'tertiary' ? .6 : .43);
  const isIlham3 = road.name === 'Jalan Elmina Ilham 3';
  const commonFactor = Math.pow(base, .25);
  const peakWalkers = isIlham3 ? 120 : Math.round(120 * commonFactor);
  const walkerCount = Math.round(peakWalkers * (hourWeight[hour] ?? hourWeight[13]));
  const daylightFactor = hour <= 7 || hour >= 19 ? 0 : Math.sin(Math.PI * (hour - 7) / 12);
  return {
    walkers: walkerCount / 120,
    walkerCount,
    exposure: (isIlham3 ? .95 : commonFactor) * daylightFactor,
    vulnerable: isIlham3 ? .95 : commonFactor,
    crossing: isIlham3 ? .90 : commonFactor,
    crossingDistance: isIlham3 ? 150 : null,
  };
}

export function priorityAt(road, hour) {
  const factors = priorityFactors(road, hour);
  return factors.walkers * factors.exposure * factors.vulnerable * factors.crossing;
}

export function priorityColor(score) {
  return score >= .75 ? '#b52f27' : score >= .55 ? '#dc6940'
    : score >= .35 ? '#e0a019' : '#2e9d6c';
}

// Repeatable GPS-like route lines around mapped footpath centre lines.
// These are generated patterns, not observations of individual walkers.
const routeWayIds = new Set([
  'way/1392730872', 'way/1392730873',
  'way/1548732776', 'way/1548732777',
  'way/1392730874', 'way/875071787', 'way/875071788',
  'way/875071792', 'way/875071794',
]);

function hash(value) {
  let result = 2166136261;
  for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
  return result >>> 0;
}

function addPlayAreaScramble(features, roads, geometryForRoad) {
  const loop = roads.find(road => road.id === 'way/1392730874');
  const line = loop && geometryForRoad(loop).coordinates.find(part => part.length > 40);
  if (!line) return;
  const origin = line[0];
  const metresPerLon = 111320 * Math.cos(origin[1] * Math.PI / 180);
  const toMetres = ([lon, lat]) => [
    (lon - origin[0]) * metresPerLon, (lat - origin[1]) * 111320,
  ];
  const toCoordinates = ([x, y]) => [
    origin[0] + x / metresPerLon, origin[1] + y / 111320,
  ];
  // A small open-space cluster next to the mapped loop, near the playground symbol.
  const playArea = [5, 3];
  const pairs = [[2, 18], [4, 27], [7, 35], [10, 40],
    [14, 31], [19, 38], [23, 42], [29, 41]];
  for (const [index, [startIndex, endIndex]] of pairs.entries()) {
    const from = toMetres(line[startIndex]);
    const to = toMetres(line[endIndex]);
    const phase = (hash(`${loop.id}:scramble:${index}`) % 6283) / 1000;
    const via = [playArea[0] + 2.5 * Math.sin(phase),
      playArea[1] + 2.5 * Math.cos(phase * 1.7)];
    const coordinates = [];
    for (let step = 0; step <= 40; step++) {
      const fraction = step / 40;
      const firstHalf = fraction <= .5;
      const start = firstHalf ? from : via;
      const end = firstHalf ? via : to;
      const localFraction = firstHalf ? fraction * 2 : (fraction - .5) * 2;
      const dx = end[0] - start[0], dy = end[1] - start[1];
      const length = Math.hypot(dx, dy) || 1;
      const noise = Math.sin(Math.PI * localFraction) * (
        1.1 * Math.sin(localFraction * Math.PI * 3 + phase)
        + .45 * Math.sin(localFraction * Math.PI * 7 + phase * 1.7));
      coordinates.push(toCoordinates([
        start[0] + dx * localFraction - dy / length * noise,
        start[1] + dy * localFraction + dx / length * noise,
      ]));
    }
    features.push({ type: 'Feature',
      properties: { sourceWay: loop.id, routeType: 'scramble' },
      geometry: { type: 'LineString', coordinates } });
  }
}

export function generateResidentRoutes(roads, geometryForRoad) {
  const features = [];
  for (const road of roads) {
    if (!routeWayIds.has(road.id)) continue;
    for (const [partIndex, line] of geometryForRoad(road).coordinates.entries()) {
      if (line.length < 2) continue;
      const metresPerLon = 111320 * Math.cos(line[0][1] * Math.PI / 180);
      const origin = line[0];
      const points = line.map(([lon, lat]) => [
        (lon - origin[0]) * metresPerLon, (lat - origin[1]) * 111320,
      ]);
      const distances = [0];
      for (let index = 1; index < points.length; index++) {
        distances.push(distances.at(-1) + Math.hypot(
          points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
      }
      const total = distances.at(-1);
      if (total < 20) continue;
      const at = distance => {
        const position = Math.max(0, Math.min(total, distance));
        let index = 1;
        while (index < distances.length - 1 && distances[index] < position) index++;
        const length = distances[index] - distances[index - 1];
        const fraction = length ? (position - distances[index - 1]) / length : 0;
        return [0, 1].map(axis => points[index - 1][axis]
          + (points[index][axis] - points[index - 1][axis]) * fraction);
      };
      for (let pass = 0; pass < 4; pass++) {
        const phase = (hash(`${road.id}:${partIndex}:${pass}`) % 6283) / 1000;
        const coordinates = [];
        const steps = Math.ceil(total / 3);
        for (let step = 0; step <= steps; step++) {
          const distance = total * step / steps;
          const centre = at(distance);
          const before = at(distance - 2);
          const after = at(distance + 2);
          const dx = after[0] - before[0], dy = after[1] - before[1];
          const tangentLength = Math.hypot(dx, dy) || 1;
          const taper = Math.min(1, distance / 5, (total - distance) / 5);
          const offset = taper * ((pass - 1.5) * .55
            + .7 * Math.sin(distance / 7 + phase)
            + .3 * Math.sin(distance / 2.2 + phase * 2.3));
          const x = centre[0] - dy / tangentLength * offset;
          const y = centre[1] + dx / tangentLength * offset;
          coordinates.push([origin[0] + x / metresPerLon, origin[1] + y / 111320]);
        }
        features.push({ type: 'Feature', properties: { sourceWay: road.id },
          geometry: { type: 'LineString', coordinates } });
      }
    }
  }
  addPlayAreaScramble(features, roads, geometryForRoad);
  return { type: 'FeatureCollection', features };
}

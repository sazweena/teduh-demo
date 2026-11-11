// House rows fill gaps in the OSM building extract. Their positions are visual
// planning geometry inferred from mapped residential road centre lines.
const origin = [101.518, 3.187];
const metres = [111170, 110574];
const bounds = [[101.5135, 3.1844], [101.5221, 3.1905]];
const toLocal = ([lng, lat]) => [(lng - origin[0]) * metres[0], (lat - origin[1]) * metres[1]];
const toMap = ([x, y]) => [origin[0] + x / metres[0], origin[1] + y / metres[1]];
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const insideBounds = ([lng, lat]) => lng >= bounds[0][0] && lng <= bounds[1][0]
  && lat >= bounds[0][1] && lat <= bounds[1][1];

function clipPolygon(polygon, axis, limit, keepGreater) {
  const inside = point => keepGreater ? point[axis] >= limit : point[axis] <= limit;
  const output = [];
  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index], end = polygon[(index + 1) % polygon.length];
    if (inside(start) !== inside(end)) {
      const t = (limit - start[axis]) / (end[axis] - start[axis]);
      output.push([start[0] + t * (end[0] - start[0]), start[1] + t * (end[1] - start[1])]);
    }
    if (inside(end)) output.push(end);
  }
  return output;
}

function splitMappedRoof(building) {
  const polygon = building.coordinates.slice(0, -1).map(toLocal);
  if (polygon.length < 4) return [{ ...building, kind: 'mapped' }];
  let longest = [1, 0], maxLength = 0;
  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index], end = polygon[(index + 1) % polygon.length];
    const length = distance(start, end);
    if (length > maxLength) {
      maxLength = length;
      longest = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
    }
  }
  const normal = [-longest[1], longest[0]];
  const projected = polygon.map(point => [point[0] * longest[0] + point[1] * longest[1],
    point[0] * normal[0] + point[1] * normal[1]]);
  const uMin = Math.min(...projected.map(point => point[0]));
  const uMax = Math.max(...projected.map(point => point[0]));
  const vMin = Math.min(...projected.map(point => point[1]));
  const vMax = Math.max(...projected.map(point => point[1]));
  const length = uMax - uMin, depth = vMax - vMin;
  if (length < 19 || depth < 5 || depth > 45)
    return [{ ...building, kind: 'mapped' }];
  const unitCount = Math.min(12, Math.max(2, Math.round(length / 7.5)));
  const vCenter = (vMin + vMax) / 2;
  const roofNear = Math.max(vMin + .3, vCenter - 9);
  const roofFar = Math.min(vMax - .3, vCenter + 9);
  const units = [];
  for (let index = 0; index < unitCount; index++) {
    const left = uMin + index * length / unitCount + .12;
    const right = uMin + (index + 1) * length / unitCount - .12;
    let part = clipPolygon(projected, 0, left, true);
    part = clipPolygon(part, 0, right, false);
    part = clipPolygon(part, 1, roofNear, true);
    part = clipPolygon(part, 1, roofFar, false);
    if (part.length < 3) continue;
    const coordinates = part.map(([u, v]) => toMap([
      u * longest[0] + v * normal[0], u * longest[1] + v * normal[1],
    ]));
    units.push({ id: `${building.id}/home-${index}`, coordinates: [...coordinates, coordinates[0]], kind: 'mapped' });
  }
  return units.length ? units : [{ ...building, kind: 'mapped' }];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let a = 0, b = polygon.length - 1; a < polygon.length; b = a++) {
    const first = polygon[a], second = polygon[b];
    if ((first[1] > point[1]) !== (second[1] > point[1])
      && point[0] < (second[0] - first[0]) * (point[1] - first[1]) / (second[1] - first[1]) + first[0])
      inside = !inside;
  }
  return inside;
}

function pointSegmentDistance(point, start, end) {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy)
    / (dx * dx + dy * dy || 1)));
  return distance(point, [start[0] + dx * ratio, start[1] + dy * ratio]);
}

function convexOverlap(first, second) {
  for (const polygon of [first, second]) {
    for (let index = 0; index < polygon.length; index++) {
      const start = polygon[index], end = polygon[(index + 1) % polygon.length];
      const axis = [start[1] - end[1], end[0] - start[0]];
      const firstValues = first.map(point => point[0] * axis[0] + point[1] * axis[1]);
      const secondValues = second.map(point => point[0] * axis[0] + point[1] * axis[1]);
      if (Math.max(...firstValues) < Math.min(...secondValues) + .1
        || Math.max(...secondValues) < Math.min(...firstValues) + .1) return false;
    }
  }
  return true;
}

function pointOnRoad(points, lengths, position) {
  let travelled = 0;
  for (let index = 0; index < lengths.length; index++) {
    if (position <= travelled + lengths[index] || index === lengths.length - 1) {
      const ratio = Math.max(0, Math.min(1, (position - travelled) / (lengths[index] || 1)));
      return [points[index][0] + (points[index + 1][0] - points[index][0]) * ratio,
        points[index][1] + (points[index + 1][1] - points[index][1]) * ratio];
    }
    travelled += lengths[index];
  }
  return points[0];
}

function residentialRoad(road) {
  return road.kind === 'residential' && (
    /^Jalan Elmina Ilham [2-5]$/.test(road.name)
    || /^Jalan Frekuensi U16\/(113[A-G]?|118|120|121|140A?)$/.test(road.name)
  );
}

// The aerial reference shows outer streets bounding the neighbourhood.
// Place a row on their developed side; inner streets can carry two rows.
function sidesForRoad(road, centerline, normal) {
  // U16/118 loops around a green strip. The right-hand side of its path is open space.
  if (road.name === 'Jalan Frekuensi U16/118') return [1];
  if (!/^Jalan Elmina Ilham [24]$/.test(road.name)
    && !/^Jalan Frekuensi U16\/(113|120|121)$/.test(road.name)) return [-1, 1];
  const neighbourhood = toLocal([101.5178, 3.1867]);
  const plus = [centerline[0] + normal[0] * 14, centerline[1] + normal[1] * 14];
  const minus = [centerline[0] - normal[0] * 14, centerline[1] - normal[1] * 14];
  return [distance(plus, neighbourhood) < distance(minus, neighbourhood) ? 1 : -1];
}

export function createAreaHouses(roads, mappedRoofs) {
  const mapped = mappedRoofs.filter(building => {
    const points = building.coordinates.slice(0, -1);
    return insideBounds(points[Math.floor(points.length / 2)]);
  });
  const houses = mapped.flatMap(splitMappedRoof);
  const mappedPolygons = mapped.map(building => building.coordinates.slice(0, -1).map(toLocal));
  const roadLines = roads.filter(road => ['residential', 'tertiary'].includes(road.kind))
    .map(road => ({ id: road.id, points: road.coordinates.map(toLocal) }));
  const generatedCenters = [];
  const generatedPolygons = [];
  for (const road of roads.filter(residentialRoad)) {
    const points = road.coordinates.map(toLocal);
    if (points.length < 2) continue;
    const lengths = points.slice(1).map((point, index) => distance(point, points[index]));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    for (let along = 10; along < total - 9; along += 7.8) {
      const before = pointOnRoad(points, lengths, along - 2);
      const after = pointOnRoad(points, lengths, along + 2);
      const tangentLength = distance(before, after);
      if (tangentLength < 1) continue;
      const tangent = [(after[0] - before[0]) / tangentLength, (after[1] - before[1]) / tangentLength];
      const normal = [-tangent[1], tangent[0]];
      const centerline = pointOnRoad(points, lengths, along);
      for (const side of sidesForRoad(road, centerline, normal)) {
        const center = [centerline[0] + normal[0] * side * 14,
          centerline[1] + normal[1] * side * 14];
        if (!insideBounds(toMap(center))) continue;
        // The northern U16/113 row crosses open space and existing roofs in the aerial view.
        if (road.id === 'way/499335111' && toMap(center)[1] >= 3.1888) continue;
        if (generatedCenters.some(previous => distance(previous, center) < 7.1)) continue;
        if (mappedPolygons.some(polygon => pointInPolygon(center, polygon)
          || polygon.some((point, index) => pointSegmentDistance(center, point,
            polygon[(index + 1) % polygon.length]) < 7))) continue;
        if (roadLines.some(line => line.id !== road.id && line.points.slice(1).some((point, index) =>
          pointSegmentDistance(center, line.points[index], point) < 8.5))) continue;
        const localCorners = [[-3.35, -5.5], [3.35, -5.5], [3.35, 5.5], [-3.35, 5.5]]
          .map(([alongAxis, depthAxis]) => [
            center[0] + tangent[0] * alongAxis + normal[0] * depthAxis,
            center[1] + tangent[1] * alongAxis + normal[1] * depthAxis,
          ]);
        if (generatedPolygons.some((polygon, index) =>
          distance(generatedCenters[index], center) < 20 && convexOverlap(localCorners, polygon))) continue;
        const corners = localCorners.map(toMap);
        if (!corners.every(insideBounds)) continue;
        const id = `generated/${road.id}/${Math.round(along)}/${side}`;
        houses.push({ id, coordinates: [...corners, corners[0]], kind: 'generated' });
        generatedCenters.push(center);
        generatedPolygons.push(localCorners);
      }
    }
  }
  return houses;
}

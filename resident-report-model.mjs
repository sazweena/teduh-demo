const normalKind = kind => kind === 'broken_path' ? 'broken' : kind;

export function reportsOnStreet(reports, roadName, kind) {
  if (!roadName) return [];
  return reports.filter(report => report.road_name === roadName
    && normalKind(report.kind) === normalKind(kind) && report.status !== 'Built');
}

export function nearestNamedRoad(roads, [longitude, latitude]) {
  const scaleX = 111320 * Math.cos(latitude * Math.PI / 180);
  const scaleY = 110574;
  let best = null;
  for (const road of roads) {
    if (!road.name || road.name === 'Unnamed mapped way' || !Array.isArray(road.coordinates)) continue;
    for (let index = 1; index < road.coordinates.length; index++) {
      const [fromX, fromY] = road.coordinates[index - 1];
      const [toX, toY] = road.coordinates[index];
      const dx = (toX - fromX) * scaleX, dy = (toY - fromY) * scaleY;
      const x = (longitude - fromX) * scaleX, y = (latitude - fromY) * scaleY;
      const fraction = Math.max(0, Math.min(1, (x * dx + y * dy) / (dx * dx + dy * dy || 1)));
      const distance = Math.hypot(x - fraction * dx, y - fraction * dy);
      if (!best || distance < best.distance) best = { name: road.name, distance };
    }
  }
  return best;
}

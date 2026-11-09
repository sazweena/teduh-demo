// shortcut: fixed margins fit this Frekuensi block; use traced roof outlines
// before applying the same shadow method to other streets.
export function frekuensiRoofs(blocks) {
  const origin = [101.515, 3.1894];
  const metres = [111170, 110574];
  const angle = 7.5 * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const toLocal = ([lng, lat]) => {
    const x = (lng - origin[0]) * metres[0];
    const y = (lat - origin[1]) * metres[1];
    return [x * cosine + y * sine, -x * sine + y * cosine];
  };
  const toMap = ([u, v]) => [
    origin[0] + (u * cosine - v * sine) / metres[0],
    origin[1] + (u * sine + v * cosine) / metres[1],
  ];
  const clip = (ring, axis, limit, above) => {
    const inside = point => above ? point[axis] >= limit : point[axis] <= limit;
    const result = [];
    for (let index = 0; index < ring.length; index++) {
      const start = ring[index];
      const end = ring[(index + 1) % ring.length];
      if (inside(start) !== inside(end)) {
        const fraction = (limit - start[axis]) / (end[axis] - start[axis]);
        result.push(start.map((value, coordinate) => value + fraction * (end[coordinate] - value)));
      }
      if (inside(end)) result.push(end);
    }
    return result;
  };
  const roofs = [];
  const latitudes = blocks.map(block => block.coordinates.reduce((sum, point) => sum + point[1], 0) / block.coordinates.length);
  const rowDivider = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  for (const [index, block] of blocks.entries()) {
    const outline = block.coordinates.slice(0, -1).map(toLocal);
    const uMin = Math.min(...outline.map(point => point[0]));
    const uMax = Math.max(...outline.map(point => point[0]));
    const vMin = Math.min(...outline.map(point => point[1]));
    const vMax = Math.max(...outline.map(point => point[1]));
    let ring = outline;
    const northRow = latitudes[index] > rowDivider;
    for (const [axis, limit, above] of [[0, uMin + 1.5, true], [0, uMax - 1.5, false],
      [1, vMin + (northRow ? 3 : 2.5), true], [1, vMax - (northRow ? 8 : 3), false]]) {
      ring = clip(ring, axis, limit, above);
      if (ring.length < 3) break;
    }
    if (ring.length >= 3) roofs.push({
      id: `${block.id}/roof`,
      coordinates: [...ring.map(toMap), toMap(ring[0])],
    });
  }
  return roofs;
}

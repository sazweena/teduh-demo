// Solar position follows NOAA's General Solar Position Calculations.
// Azimuth is degrees clockwise from north; altitude is degrees above the horizon.
export function sunPosition(date, hour, latitude, longitude) {
  const [year, month, day] = date.split('-').map(Number);
  const dayOfYear = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const radians = Math.PI / 180;
  const gamma = 2 * Math.PI / 365 * (dayOfYear - 1 + (hour - 12) / 24);
  const equationOfTime = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma)
    - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
  const declination = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma)
    - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma)
    - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  const latitudeRadians = latitude * radians;
  const hourAngle = (hour * 60 + equationOfTime + 4 * longitude - 480) / 4 * radians - Math.PI;
  const altitude = Math.asin(Math.sin(latitudeRadians) * Math.sin(declination)
    + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle));
  const azimuth = Math.atan2(Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitudeRadians) - Math.tan(declination) * Math.cos(latitudeRadians)) + Math.PI;
  return { altitude: altitude / radians, azimuth: (azimuth / radians + 360) % 360 };
}

function convexHull(points) {
  const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (const point of sorted.reverse()) {
    while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// A vertical prism casts the swept area between its footprint and shifted roof.
// These Jalan Frekuensi footprints are convex, so their convex hull gives that area.
export function buildingShadow(coordinates, height, sun, origin = [101.515, 3.1894]) {
  if (sun.altitude <= 0) return [];
  const latitudeRadians = origin[1] * Math.PI / 180;
  const metresPerDegreeLongitude = 111320 * Math.cos(latitudeRadians);
  const metresPerDegreeLatitude = 110574;
  const length = height / Math.tan(sun.altitude * Math.PI / 180);
  const direction = sun.azimuth * Math.PI / 180;
  const dx = -Math.sin(direction) * length;
  const dy = -Math.cos(direction) * length;
  const ground = coordinates.map(([longitude, latitude]) => [
    (longitude - origin[0]) * metresPerDegreeLongitude,
    (latitude - origin[1]) * metresPerDegreeLatitude,
  ]);
  return convexHull(ground.concat(ground.map(([x, y]) => [x + dx, y + dy])))
    .map(([x, y]) => [origin[1] + y / metresPerDegreeLatitude, origin[0] + x / metresPerDegreeLongitude]);
}

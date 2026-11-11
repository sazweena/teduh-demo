import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAreaHouses } from './v2-houses.mjs';
import { frekuensiRoofs } from './v2-roofs.mjs';
import { buildingShadow, sunPosition } from './v2-sun.mjs';

const map = JSON.parse(readFileSync(new URL('./elmina-map.json', import.meta.url)));
const area = JSON.parse(readFileSync(new URL('./v2-ilham-roads.json', import.meta.url)));
const insetIds = new Set(Array.from({ length: 16 }, (_, index) => `way/${912252060 + index}`));
const originalBlocks = map.buildings.filter(building => insetIds.has(building.id));
assert.equal(originalBlocks.length, 16);
const roofs = [
  ...map.buildings.filter(building => !insetIds.has(building.id)),
  ...frekuensiRoofs(originalBlocks),
];
const houses = createAreaHouses(area.roads, roofs);
const frekuensi118 = houses.filter(house => house.id.startsWith('generated/way/604829786/'));
assert.ok(frekuensi118.length > 0);
assert.ok(frekuensi118.every(house => house.id.endsWith('/1')),
  'Jalan Frekuensi U16/118 must leave the inner green strip clear');
assert.ok(houses.filter(house => house.kind === 'generated').length > 400);
assert.ok(houses.filter(house => house.kind === 'mapped').length > 100);
assert.equal(new Set(houses.map(house => house.id)).size, houses.length);
for (const house of houses) {
  assert.ok(house.coordinates.length >= 4, house.id);
  assert.deepEqual(house.coordinates[0], house.coordinates.at(-1), house.id);
  assert.ok(house.coordinates.every(point => point.every(Number.isFinite)), house.id);
}
const sun = sunPosition('2026-11-09', 13, 3.187, 101.518);
for (const house of houses.filter((_, index) => index % 50 === 0)) {
  const shadow = buildingShadow(house.coordinates, 6, sun);
  assert.ok(shadow.length >= 3 && shadow.every(point => point.every(Number.isFinite)), house.id);
}
console.log(`${houses.length} house roofs and sampled shadows passed geometry checks`);

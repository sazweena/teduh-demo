import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { activityNames, nextActivity } from './v2-activity.mjs';
import { destinationSignal, priorityAt, priorityFactors } from './v2-street-priority.mjs';
import { walkingDestinations } from './v2-destinations.mjs';
import { legacyReports, mapConcerns } from './v2-report-references.mjs';

const road = { name: 'Jalan Elmina Ilham 3', kind: 'residential',
  coordinates: [[101.518, 3.1855], [101.519, 3.1855]] };

test('reports and supporters increase walkers without changing destination proximity', () => {
  const baseline = priorityFactors(road, 13);
  const reported = priorityFactors(road, 13, { reportCount: 1 });
  const supported = priorityFactors(road, 13, { reportCount: 1, supportCount: 1 });
  assert.equal(reported.walkerCount - baseline.walkerCount, 8);
  assert.equal(supported.walkerCount - reported.walkerCount, 4);
  assert.equal(supported.destinations, baseline.destinations);
  assert.ok(priorityAt(road, 13, { reportCount: 1, supportCount: 1, concernKind: 'hot' })
    > priorityAt(road, 13, { reportCount: 1, concernKind: 'hot' }));
  assert.ok(destinationSignal(road).proximity > 0);
  const westernRoad = { name: 'Western street', kind: 'residential',
    coordinates: [[101.5136, 3.1845], [101.5137, 3.1846]] };
  assert.notEqual(destinationSignal(westernRoad).proximity, destinationSignal(road).proximity);
});

test('report coordinates match the nearby walking hotspot automatically', () => {
  assert.equal(walkingDestinations.length, 8);
  assert.ok(!walkingDestinations.some(place => place.id === 'bulatan-elmina'));
  const parkPoint = walkingDestinations.find(place => place.id === 'frekuensi-119-park').coordinates;
  const shopPoint = walkingDestinations.find(place => place.id === 'laman-nadi').coordinates;
  const park = destinationSignal(road, [parkPoint]);
  const shops = destinationSignal(road, [shopPoint]);
  assert.equal(park.nearestName, 'Park by Jalan Frekuensi U16/119');
  assert.equal(shops.nearestName, 'Laman Nadi shops');
  assert.equal(park.nearestDistance, 0);
  assert.notEqual(priorityFactors(road, 13, { reportLocations: [parkPoint] }).destinations,
    priorityFactors(road, 13).destinations);
});

test('heat and darkness use opposite time conditions', () => {
  assert.equal(priorityFactors(road, 13, { concernKind: 'hot' }).condition, 1);
  assert.equal(priorityFactors(road, 13, { concernKind: 'dark' }).condition, 0);
  assert.equal(priorityFactors(road, 19, { concernKind: 'hot' }).condition, 0);
  assert.equal(priorityFactors(road, 19, { concernKind: 'dark' }).condition, 1);
});

test('activity selects a mapped concern and fictional first name', () => {
  const concerns = [{ kind: 'hot', roadName: road.name }];
  assert.deepEqual(nextActivity(concerns, () => 0), { name: activityNames[0], concern: concerns[0] });
  assert.equal(nextActivity([], () => 0), null);
});

test('reports panel receives the same session support count', () => {
  const count = new Map([[road.name, 3]]);
  const report = legacyReports({}, [], count).find(item => item.road_name === road.name);
  assert.equal(report.me_too_count, 3);
  assert.equal(report.illustrativeSupport, true);
});

test('sample support places six reported streets between 0.60 and 0.86 at 1 PM', () => {
  const roads = JSON.parse(readFileSync(new URL('./v2-ilham-roads.json', import.meta.url))).roads;
  const named = new Map();
  for (const item of roads) {
    if (item.name !== 'Unnamed mapped way' && !named.has(item.name)) named.set(item.name, item);
  }
  const concernByRoad = new Map(mapConcerns.map(item => [item.roadName, item]));
  const ranked = [...named.values()].map(item => {
    const concern = concernByRoad.get(item.name);
    return { name: item.name, score: priorityAt(item, 13, {
      reportCount: concern ? 1 : 0,
      supportCount: concern?.startingSupportCount || 0,
      concernKind: concern?.kind || null,
    }) };
  }).sort((a, b) => b.score - a.score).slice(0, 6);
  assert.ok(ranked.every(item => concernByRoad.has(item.name)));
  assert.ok(ranked.every(item => item.score >= .6 && item.score <= .86));
});

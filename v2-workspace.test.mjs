import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSavedPlan, pointAlongRoad } from './v2-workspace.mjs';
import { planForBudget } from './v2-street-plan.mjs';

const road = { id: 'way/example', name: 'Jalan Elmina Ilham 3',
  coordinates: [[101.5178, 3.1857], [101.5182, 3.1855], [101.5188, 3.1853]] };
const first = pointAlongRoad(road, .25);
const last = pointAlongRoad(road, .75);
assert.ok(first[0] < last[0]);
assert.ok(first[0] >= road.coordinates[0][0] && last[0] <= road.coordinates.at(-1)[0]);

const saved = buildSavedPlan(road, 15000, planForBudget(15000));
assert.equal(saved.cost, 13000);
assert.deepEqual(saved.items.map(item => item.id), ['trees', 'sail', 'site']);
assert.equal(saved.items.filter(item => item.coordinates).length, 2);
assert.equal(saved.items.find(item => item.id === 'site').coordinates, null);
const trees = saved.items.find(item => item.id === 'trees');
trees.coordinates = [101.5181, 3.1856];
trees.locationReviewed = true;
trees.status = 'Planned';
const updated = buildSavedPlan(road, 8000, planForBudget(8000), saved);
assert.equal(updated.id, saved.id);
assert.equal(updated.items.find(item => item.id === 'trees'), undefined);
assert.equal(updated.items.find(item => item.id === 'sail').status, 'Proposed');
const restored = buildSavedPlan(road, 15000, planForBudget(15000), saved);
assert.deepEqual(restored.items.find(item => item.id === 'trees').coordinates, trees.coordinates);
assert.equal(restored.items.find(item => item.id === 'trees').status, 'Planned');
const mappedRoads = JSON.parse(readFileSync(new URL('./v2-ilham-roads.json', import.meta.url))).roads;
const frekuensi = mappedRoads.find(item => item.id === 'way/499335112');
const frekuensiPlan = buildSavedPlan(frekuensi, 15000, planForBudget(15000));
assert.equal(frekuensiPlan.roadName, 'Jalan Frekuensi U16/120');
assert.equal(frekuensiPlan.cost, 13000);
assert.equal(frekuensiPlan.budget - frekuensiPlan.cost, 2000);
assert.equal(frekuensiPlan.items.filter(item => item.coordinates).length, 2);
assert.ok(frekuensiPlan.items.every(item => item.status === 'Proposed' && !item.locationReviewed));
console.log('Saved plan positions, package changes, and reviewed locations passed');

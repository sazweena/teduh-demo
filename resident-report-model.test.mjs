import assert from 'node:assert/strict';
import { nearestNamedRoad, reportsOnStreet } from './resident-report-model.mjs';

const roads = [
  { name: 'Jalan Elmina Ilham 3', coordinates: [[101.518, 3.185], [101.519, 3.185]] },
  { name: 'Jalan Elmina Ilham 4', coordinates: [[101.518, 3.186], [101.519, 3.186]] },
];
assert.equal(nearestNamedRoad(roads, [101.5185, 3.18508]).name, 'Jalan Elmina Ilham 3');
assert.equal(nearestNamedRoad(roads, [101.5185, 3.18508]).distance < 10, true);

const reports = [
  { id: 'a', road_name: 'Jalan Elmina Ilham 3', kind: 'broken_path', status: 'Received' },
  { id: 'b', road_name: 'Jalan Elmina Ilham 3', kind: 'broken', status: 'Built' },
  { id: 'c', road_name: 'Jalan Elmina Ilham 4', kind: 'broken', status: 'Received' },
];
assert.deepEqual(reportsOnStreet(reports, 'Jalan Elmina Ilham 3', 'broken').map(item => item.id), ['a']);
console.log('Resident report matching passes.');

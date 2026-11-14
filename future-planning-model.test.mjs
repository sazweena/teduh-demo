import test from 'node:test';
import assert from 'node:assert/strict';
import { homes, destinations, shortestRoute } from './future-planning-model.mjs';

const home = homes.find(item => item.id === 'a');
const shops = destinations.find(item => item.id === 'shops');
const bus = destinations.find(item => item.id === 'bus');
const park = destinations.find(item => item.id === 'park');

test('crossing and path connections shorten applicable walks', () => {
  const baseToBus = shortestRoute(home.node, bus.node, 'crossing', 'before');
  const crossedToBus = shortestRoute(home.node, bus.node, 'crossing', 'planned');
  const baseToShops = shortestRoute(home.node, shops.node, 'connection', 'before');
  const linkedToShops = shortestRoute(home.node, shops.node, 'connection', 'planned');
  assert.ok(crossedToBus.metres < baseToBus.metres);
  assert.ok(linkedToShops.metres < baseToShops.metres);
  assert.equal(crossedToBus.minutes, Math.ceil(crossedToBus.metres / 80));
});

test('shade changes route treatment without claiming a time saving', () => {
  assert.deepEqual(shortestRoute(home.node, park.node, 'shade', 'before'),
    shortestRoute(home.node, park.node, 'shade', 'planned'));
});

test('every displayed home can reach each displayed destination', () => {
  for (const start of homes) for (const end of destinations) {
    for (const stage of ['before', 'planned']) {
      assert.ok(shortestRoute(start.node, end.node, 'connection', stage));
    }
  }
});

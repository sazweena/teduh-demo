import assert from 'node:assert/strict';
import { fixedPlanOptions, fixedPlanForBudget } from './v2-street-plan.mjs';
import { buildSavedPlan } from './v2-workspace.mjs';

assert.deepEqual(fixedPlanOptions.map(plan => [plan.id, plan.cost]), [
  ['a', 34000], ['b', 55000], ['c', 125000],
]);
assert.equal(fixedPlanForBudget('c', 70000), null);
assert.equal(fixedPlanForBudget('b', 70000)?.remaining, 15000);
assert.equal(fixedPlanForBudget('missing', 300000), null);

const road = {
  id: 'way/example', name: 'Jalan Elmina Ilham 3',
  coordinates: [[101.5178, 3.1857], [101.5182, 3.1855], [101.5188, 3.1853]],
};
const trees = buildSavedPlan(road, 34000, fixedPlanForBudget('a', 34000));
const sails = buildSavedPlan(road, 70000, fixedPlanForBudget('b', 70000));
const combined = buildSavedPlan(road, 125000, fixedPlanForBudget('c', 125000));
assert.equal(trees.planId, 'a');
assert.equal(trees.items.find(item => item.id === 'trees').quantity, 12);
assert.equal(sails.items.find(item => item.id === 'sail').quantity, 3);
assert.equal(combined.items.find(item => item.id === 'trees').maturity, 'larger');
assert.ok(combined.items.some(item => item.id === 'crossing'));
console.log('Fixed plan costs, budget eligibility, and saved quantities passed');

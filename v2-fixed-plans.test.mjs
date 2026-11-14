import assert from 'node:assert/strict';
import { budgetMin, budgetMax, fixedPlanOptions, fixedPlanForBudget } from './v2-street-plan.mjs';
import { buildSavedPlan } from './v2-workspace.mjs';

assert.deepEqual(fixedPlanOptions.map(plan => [plan.id, plan.cost]), [
  ['a', 1000], ['b', 8000], ['c', 13000],
]);
assert.equal(budgetMin, 1000);
assert.equal(budgetMax, 25000);
assert.equal(fixedPlanForBudget('c', 8000), null);
assert.equal(fixedPlanForBudget('b', 10000)?.remaining, 2000);
assert.equal(fixedPlanForBudget('missing', 25000), null);
assert.ok(fixedPlanOptions.every(plan => plan.cost === plan.items.reduce((sum, item) => sum + item.cost, 0)));

const road = {
  id: 'way/example', name: 'Jalan Elmina Ilham 3',
  coordinates: [[101.5178, 3.1857], [101.5182, 3.1855], [101.5188, 3.1853]],
};
const trees = buildSavedPlan(road, 1000, fixedPlanForBudget('a', 1000));
const sails = buildSavedPlan(road, 8000, fixedPlanForBudget('b', 8000));
const combined = buildSavedPlan(road, 13000, fixedPlanForBudget('c', 13000));
assert.equal(trees.planId, 'a');
assert.equal(trees.items.find(item => item.id === 'trees').quantity, 2);
assert.equal(sails.items.find(item => item.id === 'sail').quantity, 1);
assert.equal(combined.items.find(item => item.id === 'trees').quantity, 8);
assert.ok(!combined.items.some(item => item.id === 'crossing'));
console.log('Fixed plan costs, budget eligibility, and saved quantities passed');

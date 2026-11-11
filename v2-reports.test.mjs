import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { legacyReports } from './v2-report-references.mjs';

const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, value),
};
const window = { fetch: () => { throw Error('API request escaped the local adapter'); } };
runInNewContext(readFileSync('static-api.js', 'utf8'), {
  window, localStorage, location: new URL('http://127.0.0.1:8765/v2-map.html'),
  URL, Response, Promise, Date, crypto: webcrypto, console,
});
const request = async (path, method = 'GET', body) => {
  const response = await window.fetch(path, { method, body: body && JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
};
const coordinates = [101.5194, 3.1854];
const created = await request('/api/reports', 'POST', { kind: 'hot', coordinates, road_name: 'Jalan Elmina Ilham 3' });
assert.equal(created.status, 201);
assert.deepEqual(created.body.report.coordinates, coordinates);
const id = created.body.report.id;
const updated = await request(`/api/reports/${id}`, 'PATCH', { status: 'Planned', reply: 'Site visit arranged.' });
assert.equal(updated.body.report.status, 'Planned');
assert.equal(updated.body.report.reply, 'Site visit arranged.');
const read = await request('/api/reports');
assert.equal(read.body.reports.find(item => item.id === id).status, 'Planned');
const archived = legacyReports({ 'R-1041': { status: 'Seen', reply: 'Check shade on site.' } });
assert.equal(archived.length, 2);
assert.equal(archived[0].status, 'Seen');
assert.equal(archived[0].reply, 'Check shade on site.');
assert.equal(archived[0].me_too_count, 0);
assert.equal(archived[1].coordinates, null);
assert.ok(archived.every(item => item.legacy && item.illustration));
console.log('Ilham-area report creation and developer update passed');

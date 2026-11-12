import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { legacyReports, mapConcerns, plannedReportUpdates } from './v2-report-references.mjs';

const roads = JSON.parse(readFileSync(new URL('./v2-ilham-roads.json', import.meta.url))).roads;
const mappedNames = new Set(roads
  .map(road => road.name));
assert.equal(mapConcerns.length, 6);
assert.equal(mapConcerns[0].reporterName, 'Ms. Arifah Hasidin');
assert.ok(mapConcerns.slice(1).every(report => !report.reporterName));
assert.equal(new Set(mapConcerns.map(report => report.roadName)).size, mapConcerns.length);
assert.deepEqual(new Set(mapConcerns.map(report => report.kind)), new Set(['hot', 'cross', 'broken_path']));
for (const report of mapConcerns) {
  assert.ok(mappedNames.has(report.roadName), `${report.roadName} must be a mapped street`);
  assert.ok(report.sourceLabel.startsWith('Resident report'), `${report.roadName} must be labeled as a resident report`);
  assert.ok(report.title, `${report.roadName} needs a specific issue title`);
  assert.ok(report.note, `${report.roadName} needs report text`);
  assert.ok(report.referenceImage && existsSync(new URL(report.referenceImage, import.meta.url)), `${report.roadName} needs a reference image`);
  assert.ok(report.referenceAlt && !/example visual/i.test(report.referenceAlt), `${report.roadName} needs descriptive image alt text`);
  assert.ok(!('photo' in report), `${report.roadName} must not present a generated image as a resident photo`);
  assert.ok(!('supportCount' in report) && !('createdAt' in report), 'Do not invent support or submission dates');
}
const workspaceReports = legacyReports({}, roads);
assert.equal(workspaceReports.length, 7);
assert.equal(workspaceReports.filter(report => report.source === 'Resident report').length, 6);
assert.ok(workspaceReports.filter(report => report.source === 'Resident report')
  .every(report => Array.isArray(report.coordinates)), 'Map reports need a mapped street location');
assert.ok(workspaceReports.every(report => report.me_too_count === 0 && report.created_at === null));
const updates = plannedReportUpdates({ 'R-1041': { status: 'Seen', reply: 'Check shade.' },
  'map-frekuensi-120-crossing': { status: 'Built' } }, 'Jalan Elmina Ilham 3');
assert.equal(updates['R-1041'].status, 'Planned');
assert.equal(updates['R-1041'].reply, 'Check shade.');
assert.equal(updates['map-frekuensi-120-crossing'].status, 'Built');
assert.equal(legacyReports(updates, roads)[0].status, 'Planned');
assert.equal(plannedReportUpdates(updates, 'Jalan Frekuensi U16/120')['map-frekuensi-120-crossing'].status, 'Built');
console.log(`${mapConcerns.length} mapped reports have images and street plan status updates`);

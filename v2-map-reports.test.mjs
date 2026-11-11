import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mapConcerns } from './v2-report-references.mjs';

const mappedNames = new Set(JSON.parse(readFileSync(new URL('./v2-ilham-roads.json', import.meta.url))).roads
  .map(road => road.name));
assert.equal(mapConcerns.length, 6);
assert.equal(new Set(mapConcerns.map(report => report.roadName)).size, mapConcerns.length);
assert.deepEqual(new Set(mapConcerns.map(report => report.kind)), new Set(['hot', 'cross', 'broken_path']));
for (const report of mapConcerns) {
  assert.ok(mappedNames.has(report.roadName), `${report.roadName} must be a mapped street`);
  assert.ok(report.sourceLabel.startsWith('Resident report'), `${report.roadName} must be labeled as a resident report`);
  assert.ok(report.note, `${report.roadName} needs report text`);
  assert.ok(report.image && existsSync(new URL(report.image, import.meta.url)), `${report.roadName} needs its image`);
  assert.ok(report.imageAlt, `${report.roadName} needs image alt text`);
}
console.log(`${mapConcerns.length} mapped resident report cards have images and distinct streets`);

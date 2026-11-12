import { streetMidpoint } from './v2-street-priority.mjs';

export const reportReferences = [
  {
    id: 'R-1041', kind: 'hot', roadName: 'Jalan Elmina Ilham 3',
    title: 'Little shade on footpath',
    note: 'Young trees leave the footpath exposed to midday sun.',
    referenceImage: './assets/midday-unshaded-walk.webp',
    referenceAlt: 'Reference image showing a parent and child walking on a sunny residential footpath',
    streetCenter: [101.5185, 3.1854],
  },
  {
    id: 'R-1027', kind: 'cross', roadName: 'Persiaran Elmina',
    title: 'No crossing to bus stop',
    note: 'There is no marked crossing near the bus stop. This location has not been mapped into the workspace.',
    referenceImage: './assets/unsafe-crossing-bus-stop.webp',
    referenceAlt: 'Reference image showing a parent and child facing a road with a bus stop opposite',
    streetCenter: null,
  },
];

// Starting support counts are sample planning activity, not verified users.
export const mapConcerns = [
  { ...reportReferences[0], sourceLabel: 'Resident report (1), by Ms. Arifah Hasidin', startingSupportCount: 7 },
  {
    id: 'map-frekuensi-113-heat',
    kind: 'hot', roadName: 'Jalan Frekuensi U16/113',
    title: 'Little shade on footpath',
    note: 'A long stretch of footpath has little shade during midday.',
    referenceImage: './assets/report-frekuensi-113-heat-photo.webp',
    referenceAlt: 'Reference image showing a sun-exposed footpath beside homes',
    sourceLabel: 'Resident report',
    startingSupportCount: 18,
  },
  {
    id: 'map-frekuensi-120-crossing',
    kind: 'cross', roadName: 'Jalan Frekuensi U16/120',
    title: 'No marked crossing',
    note: 'The walking route needs a marked place to cross the road.',
    referenceImage: './assets/report-frekuensi-120-crossing-photo.webp',
    referenceAlt: 'Reference image showing a wide road without a nearby marked crossing',
    sourceLabel: 'Resident report',
    startingSupportCount: 15,
  },
  {
    id: 'map-ilham-2-crossing',
    kind: 'cross', roadName: 'Jalan Elmina Ilham 2',
    title: 'No crossing at junction',
    note: 'There is no marked pedestrian crossing at the junction.',
    referenceImage: './assets/report-ilham-2-crossing-photo.webp',
    referenceAlt: 'Reference image showing a pedestrian waiting to cross an unmarked junction',
    sourceLabel: 'Resident report',
    startingSupportCount: 10,
  },
  {
    id: 'map-ilham-4-path',
    kind: 'broken_path', roadName: 'Jalan Elmina Ilham 4',
    title: 'Broken footpath slabs',
    note: 'Cracked and raised footpath slabs interrupt the walking route.',
    referenceImage: './assets/report-ilham-4-path-photo.webp',
    referenceAlt: 'Reference image showing a raised, broken concrete footpath',
    sourceLabel: 'Resident report',
    startingSupportCount: 7,
  },
  {
    id: 'map-ilham-5-heat',
    kind: 'hot', roadName: 'Jalan Elmina Ilham 5',
    title: 'Young trees provide little shade',
    note: 'Young roadside trees leave a long stretch of footpath exposed to midday sun.',
    referenceImage: './assets/report-ilham-5-heat-photo.webp',
    referenceAlt: 'Reference image showing young trees and an unshaded footpath',
    sourceLabel: 'Resident report',
    startingSupportCount: 8,
  },
];

export function legacyReports(updates = {}, roads = [], activitySupport = new Map()) {
  return [...mapConcerns, reportReferences[1]].map(item => ({
    id: `archive-${item.id}`, kind: item.kind, road_name: item.roadName,
    title: item.title, note: item.note,
    referenceImage: item.referenceImage, referenceAlt: item.referenceAlt,
    coordinates: item.streetCenter || streetMidpoint(roads.filter(road => road.name === item.roadName)),
    source: item.sourceLabel ? 'Resident report' : 'Earlier planner',
    sourceLabel: item.sourceLabel || 'Earlier planner entry', legacy: true,
    status: updates[item.id]?.status || 'Received', reply: updates[item.id]?.reply || '',
    me_too_count: activitySupport.get(item.roadName) || 0,
    illustrativeSupport: true, created_at: null,
  }));
}

// Image-backed entries retained from the former planner. These were scripted
// planning content, not submitted resident reports or verified site photos.
export const reportReferences = [
  {
    id: 'R-1041', kind: 'hot', roadName: 'Jalan Elmina Ilham 3',
    note: 'Review shade along the midday walking route.',
    streetCenter: [101.5185, 3.1854],
    image: './assets/midday-unshaded-walk.webp',
    imageAlt: 'Illustration of a parent and child walking along a sunny residential street',
  },
  {
    id: 'R-1027', kind: 'cross', roadName: 'Persiaran Elmina',
    note: 'Review how people cross to the bus stop. The location has not been mapped into this workspace.',
    streetCenter: null,
    image: './assets/unsafe-crossing-bus-stop.webp',
    imageAlt: 'Illustration of a parent and child facing a road with a bus stop opposite',
  },
];

// Report illustrations show the concern type; they are not resident photos.
export const mapConcerns = [
  { ...reportReferences[0], sourceLabel: 'Resident report (1), by Ms. Arifah Hasidin' },
  {
    kind: 'hot', roadName: 'Jalan Frekuensi U16/113',
    note: 'The walking route needs more shade during the hottest hours.',
    image: './assets/report-frekuensi-113-heat.webp',
    imageAlt: 'Illustration of an exposed pavement beside terrace homes',
    sourceLabel: 'Resident report',
  },
  {
    kind: 'cross', roadName: 'Jalan Frekuensi U16/120',
    note: 'The route to the other side of the street needs a safer crossing.',
    image: './assets/report-frekuensi-120-crossing.webp',
    imageAlt: 'Illustration of a road without a nearby marked crossing',
    sourceLabel: 'Resident report',
  },
  {
    kind: 'cross', roadName: 'Jalan Elmina Ilham 2',
    note: 'Crossing at the junction is difficult without a marked pedestrian crossing.',
    image: './assets/report-ilham-2-crossing.webp',
    imageAlt: 'Illustration of a pedestrian waiting to cross at a residential junction',
    sourceLabel: 'Resident report',
  },
  {
    kind: 'broken_path', roadName: 'Jalan Elmina Ilham 4',
    note: 'An uneven and damaged section interrupts the walking path.',
    image: './assets/report-ilham-4-path.webp',
    imageAlt: 'Illustration of a cracked and broken residential footpath',
    sourceLabel: 'Resident report',
  },
  {
    kind: 'hot', roadName: 'Jalan Elmina Ilham 5',
    note: 'Young roadside trees leave a long stretch of the footpath exposed to midday sun.',
    image: './assets/report-ilham-5-heat.webp',
    imageAlt: 'Illustration of a sunny pavement with sparse young trees',
    sourceLabel: 'Resident report',
  },
];

export function legacyReports(updates = {}) {
  return reportReferences.map(item => ({
    id: `archive-${item.id}`, kind: item.kind, road_name: item.roadName,
    note: item.note, coordinates: item.streetCenter, illustration: item.image,
    illustrationAlt: item.imageAlt, source: 'Earlier planner', legacy: true,
    status: updates[item.id]?.status || 'Received', reply: updates[item.id]?.reply || '',
    me_too_count: 0, created_at: null,
  }));
}

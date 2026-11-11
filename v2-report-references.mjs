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

export function legacyReports(updates = {}) {
  return reportReferences.map(item => ({
    id: `archive-${item.id}`, kind: item.kind, road_name: item.roadName,
    note: item.note, coordinates: item.streetCenter, illustration: item.image,
    illustrationAlt: item.imageAlt, source: 'Earlier planner', legacy: true,
    status: updates[item.id]?.status || 'Received', reply: updates[item.id]?.reply || '',
    me_too_count: 0, created_at: null,
  }));
}

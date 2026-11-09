// Public unit references are material prices, not quotations for this street.
export const treeMix = [
  { name: 'Bunga Tanjung', scientific: 'Mimusops elengi', count: 4, unit: 320, role: 'Dense evergreen shade along the walking edge' },
  { name: 'Kayu Manis hutan', scientific: 'Cinnamomum iners', count: 2, unit: 380, role: 'Compact canopy near narrower planting spaces' },
  { name: 'Bungor Raya', scientific: 'Lagerstroemia speciosa', count: 2, unit: 350, role: 'Flowering canopy at wider verge sections' },
];

export const planItems = [
  { id: 'trees', title: 'Eight street trees', cost: 10000, detail: 'Standard trees, planting pits, soil, supports and establishment' },
  { id: 'sail', title: 'One shade sail', cost: 15000, detail: '5 m × 3 m commercial fabric, posts, footings and installation' },
  { id: 'crossing', title: 'Raised crossing', cost: 60000, detail: 'Road works, signs and markings; subject to road authority design' },
  { id: 'site', title: 'Site checks and contingency', cost: 10000, detail: 'Utilities, design checks and unforeseen works' },
];

export const fullPlanCost = planItems.reduce((sum, item) => sum + item.cost, 0);

export function planForBudget(budget) {
  // Keep the crossing's site allowance intact. A partially funded crossing is not shown as buildable.
  const includedIds = budget >= fullPlanCost ? ['trees', 'sail', 'crossing', 'site']
    : budget >= 70000 ? ['crossing', 'site']
    : budget >= 35000 ? ['trees', 'sail', 'site']
    : budget >= 20000 ? ['trees', 'site'] : [];
  const included = planItems.filter(item => includedIds.includes(item.id));
  const cost = included.reduce((sum, item) => sum + item.cost, 0);
  return { included, cost, remaining: budget - cost, gap: Math.max(0, fullPlanCost - budget) };
}

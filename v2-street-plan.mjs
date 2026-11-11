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

// Fixed planning allowances for comparing approaches. These are not supplier quotes.
export const fixedPlanOptions = [
  {
    id: 'a', label: 'Plan A', title: 'Grow the canopy', timing: 'Shade grows over time',
    summary: 'More trees at the lowest upfront cost.',
    pros: 'More planting along the route; lower upfront cost.',
    cons: 'Little immediate shade; trees need years of care and growth.',
    items: [
      { id: 'trees', title: '12 young street trees', cost: 24000, count: 12, maturity: 'young', detail: 'Planting pits, soil, supports and establishment' },
      { id: 'site', title: 'Site checks and contingency', cost: 10000, detail: 'Utilities, design checks and unforeseen works' },
    ],
  },
  {
    id: 'b', label: 'Plan B', title: 'Shade now', timing: 'Fast visible shade',
    summary: 'More shade sails where people walk today.',
    pros: 'Cover is available as soon as sails are installed.',
    cons: 'More manufactured materials and upkeep; adds less greenery.',
    items: [
      { id: 'sail', title: '3 shade sails', cost: 45000, count: 3, detail: 'Fabric, posts, footings and installation' },
      { id: 'site', title: 'Site checks and contingency', cost: 10000, detail: 'Utilities, design checks and unforeseen works' },
    ],
  },
  {
    id: 'c', label: 'Plan C', title: 'Shade and safer crossing', timing: 'Fast and lasting changes',
    summary: 'Larger nursery trees, a shade sail and a raised crossing.',
    pros: 'Addresses shade and crossing access together; larger trees provide earlier canopy.',
    cons: 'Highest upfront cost; crossing approval and tree siting need more work.',
    items: [
      { id: 'trees', title: '8 larger nursery trees', cost: 40000, count: 8, maturity: 'larger', detail: 'Larger stock, planting pits, soil, supports and establishment' },
      { id: 'sail', title: '1 shade sail', cost: 15000, count: 1, detail: 'Fabric, posts, footings and installation' },
      { id: 'crossing', title: 'Raised crossing', cost: 60000, count: 1, detail: 'Road works, signs and markings; subject to road authority design' },
      { id: 'site', title: 'Site checks and contingency', cost: 10000, detail: 'Utilities, design checks and unforeseen works' },
    ],
  },
].map(option => ({ ...option, cost: option.items.reduce((sum, item) => sum + item.cost, 0) }));

export function fixedPlanForBudget(id, budget) {
  const option = fixedPlanOptions.find(item => item.id === id);
  if (!option || budget < option.cost) return null;
  return { ...option, included: option.items, remaining: budget - option.cost };
}

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

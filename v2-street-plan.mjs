// Planning allowances based on the public references documented in README.md.
// Actual street work still needs a verge and utility check and a supplier quotation.
export const budgetMin = 1000;
export const budgetMax = 25000;
export const defaultBudget = 15000;

export const treeMix = [
  { name: 'Bunga Tanjung', scientific: 'Mimusops elengi', count: 4, unit: 320, role: 'Dense evergreen shade along the walking edge' },
  { name: 'Kayu Manis hutan', scientific: 'Cinnamomum iners', count: 2, unit: 380, role: 'Compact canopy near narrower planting spaces' },
  { name: 'Bungor Raya', scientific: 'Lagerstroemia speciosa', count: 2, unit: 350, role: 'Flowering canopy at wider verge sections' },
];

export const fixedPlanOptions = [
  {
    id: 'a', label: 'Plan A', title: 'Start with trees', timing: 'Shade grows over time',
    summary: 'Plant two young shade trees at suitable points.',
    pros: 'Lowest cost and adds greenery to the route.',
    cons: 'Small coverage at first; trees need time and ongoing care.',
    items: [
      { id: 'trees', title: '2 young street trees', cost: 1000, count: 2, maturity: 'young',
        mix: [{ ...treeMix[0], count: 1 }, { ...treeMix[1], count: 1 }],
        detail: 'RM500 each for supply, planting, soil and supports; siting needs review' },
    ],
  },
  {
    id: 'b', label: 'Plan B', title: 'Shade now', timing: 'Cover after installation',
    summary: 'Add one 5 m × 3 m shade sail at a suitable walking point.',
    pros: 'Provides cover as soon as the structure is installed.',
    cons: 'Covers one spot; needs a suitable foundation and maintenance.',
    items: [
      { id: 'sail', title: '1 shade sail', cost: 7000, count: 1,
        detail: 'Commercial fabric, four posts and footings, hardware, installation and delivery' },
      { id: 'site', title: 'Siting and contingency', cost: 1000,
        detail: 'Utility and foundation review; allowance for minor site changes' },
    ],
  },
  {
    id: 'c', label: 'Plan C', title: 'Trees and shade sail', timing: 'Cover now, canopy later',
    summary: 'Plant eight young trees and add one shade sail.',
    pros: 'Immediate cover at one point and a growing canopy along the route.',
    cons: 'Needs suitable planting space, a sail foundation and ongoing care.',
    items: [
      { id: 'trees', title: '8 young street trees', cost: 4000, count: 8, maturity: 'young', mix: treeMix,
        detail: 'RM500 each for supply, planting, soil and supports' },
      { id: 'sail', title: '1 shade sail', cost: 7000, count: 1,
        detail: 'Commercial fabric, four posts and footings, hardware, installation and delivery' },
      { id: 'site', title: 'Siting and contingency', cost: 2000,
        detail: 'Utility, verge and foundation review; allowance for minor site changes' },
    ],
  },
].map(option => ({ ...option, cost: option.items.reduce((sum, item) => sum + item.cost, 0) }));

export function fixedPlanForBudget(id, budget) {
  const option = fixedPlanOptions.find(item => item.id === id);
  if (!option || budget < option.cost) return null;
  return { ...option, included: option.items, remaining: budget - option.cost };
}

export function planForBudget(budget) {
  const option = fixedPlanOptions.filter(item => item.cost <= budget).at(-1);
  return option ? fixedPlanForBudget(option.id, budget) : null;
}

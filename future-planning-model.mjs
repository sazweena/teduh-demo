export const homes = [
  { id: 'a', label: 'Home A', node: '1,5' },
  { id: 'b', label: 'Home B', node: '2,2' },
  { id: 'c', label: 'Home C', node: '5,4' },
];

export const destinations = [
  { id: 'park', label: 'Park', node: '2,1' },
  { id: 'shops', label: 'Shops', node: '5,1' },
  { id: 'bus', label: 'Bus stop', node: '5,5' },
];

export const insights = [
  { id: 'shade', label: 'Heat along daily routes', action: 'Add shade along everyday walking routes.' },
  { id: 'crossing', label: 'Difficult crossings', action: 'Add a direct crossing over the main street.' },
  { id: 'connection', label: 'Interrupted footpaths', action: 'Connect paths on both sides of the neighbourhood.' },
];

export const gridSize = 7;
export const blockMetres = 125;
export const walkingMetresPerMinute = 80; // 4.8 km/h, used only for planned route times.
const key = (a, b) => [a, b].sort().join('|');
const crossingEdge = key('3,5', '4,5');
const connectionEdge = key('3,3', '4,3');

export function gridPoint(node) {
  return node.split(',').map(Number);
}

export function edgeKey(a, b) {
  return key(a, b);
}

export function availableEdges(insight = 'shade', stage = 'planned') {
  const edges = [];
  for (let y = 0; y < gridSize; y++) for (let x = 0; x < gridSize; x++) {
    const from = `${x},${y}`;
    if (x < gridSize - 1) {
      const to = `${x + 1},${y}`;
      const divider = x === 3 && y > 0 && y < 6;
      const opened = stage === 'planned' && (
        (insight === 'crossing' && key(from, to) === crossingEdge) ||
        (insight === 'connection' && key(from, to) === connectionEdge));
      if (!divider || opened) edges.push({ from, to, metres: blockMetres, added: opened });
    }
    if (y < gridSize - 1) edges.push({ from, to: `${x},${y + 1}`, metres: blockMetres, added: false });
  }
  return edges;
}

export function shortestRoute(from, to, insight = 'shade', stage = 'planned') {
  const adjacency = new Map();
  for (const edge of availableEdges(insight, stage)) {
    for (const [a, b] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push({ node: b, metres: edge.metres });
    }
  }
  const distance = new Map([[from, 0]]);
  const previous = new Map();
  const remaining = new Set(adjacency.keys());
  while (remaining.size) {
    let current;
    for (const node of remaining) {
      if (current === undefined || (distance.get(node) ?? Infinity) < (distance.get(current) ?? Infinity)) current = node;
    }
    if (current === to || (distance.get(current) ?? Infinity) === Infinity) break;
    remaining.delete(current);
    for (const next of adjacency.get(current) || []) {
      const candidate = distance.get(current) + next.metres;
      if (candidate < (distance.get(next.node) ?? Infinity)) {
        distance.set(next.node, candidate);
        previous.set(next.node, current);
      }
    }
  }
  if (!distance.has(to)) return null;
  const nodes = [to];
  while (nodes[0] !== from) nodes.unshift(previous.get(nodes[0]));
  const metres = distance.get(to);
  return { nodes, metres, minutes: Math.ceil(metres / walkingMetresPerMinute) };
}

import { homes, destinations, insights, gridSize, gridPoint, availableEdges, shortestRoute } from './future-planning-model.mjs';
import { mapConcerns } from './v2-report-references.mjs';

const svg = document.getElementById('future-map');
const insightButtons = document.getElementById('insight-buttons');
const homeButtons = document.getElementById('home-buttons');
const destinationButtons = document.getElementById('destination-buttons');
const state = { insight: 'shade', home: 'a', destination: 'park', stage: 'planned' };

const point = (x, y) => [500 + (x - y) * 72, 50 + (x + y) * 43];
const nodePoint = node => point(...gridPoint(node));
const pathFor = nodes => nodes.map((node, index) => `${index ? 'L' : 'M'}${nodePoint(node).join(' ')}`).join(' ');
const polygon = points => points.map(([x, y]) => `${x},${y}`).join(' ');
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function building(x, y, height = 16) {
  const corners = [[x + .14, y + .16], [x + .76, y + .16], [x + .76, y + .71], [x + .14, y + .71]].map(([a, b]) => point(a, b));
  const roof = corners.map(([a, b]) => [a, b - height]);
  return `<g class="building"><polygon class="wall wall-left" points="${polygon([corners[3], corners[0], roof[0], roof[3]])}"/><polygon class="wall wall-right" points="${polygon([corners[0], corners[1], roof[1], roof[0]])}"/><polygon class="roof" points="${polygon(roof)}"/><path class="roof-line" d="M${roof[0].join(' ')}L${roof[2].join(' ')}"/></g>`;
}

function tree(x, y, highlighted = false) {
  const [px, py] = point(x, y);
  return `<g class="tree${highlighted ? ' tree-highlight' : ''}" transform="translate(${px} ${py})"><ellipse class="tree-shadow" cx="3" cy="3" rx="12" ry="5"/><path class="trunk" d="M0 1v-9"/><circle class="canopy" cy="-13" r="10"/><circle class="canopy-light" cx="-4" cy="-16" r="4"/></g>`;
}

function label(x, y, title, type = '') {
  const [px, py] = point(x, y);
  const width = title.length * 8.1 + 37;
  return `<g class="map-label ${type}" transform="translate(${px} ${py})"><rect x="${-width / 2}" y="-45" width="${width}" height="31" rx="10"/><text y="-24" text-anchor="middle">${escape(title)}</text><path d="M-5-14L0-8 5-14"/></g>`;
}

function renderMap() {
  const home = homes.find(item => item.id === state.home);
  const destination = destinations.find(item => item.id === state.destination);
  const route = shortestRoute(home.node, destination.node, state.insight, state.stage);
  const planned = state.stage === 'planned';
  const roads = [];
  for (let y = 0; y < gridSize; y++) {
    roads.push(`<path d="M${point(0, y).join(' ')}L${point(6, y).join(' ')}"/>`);
  }
  for (let x = 0; x < gridSize; x++) {
    roads.push(`<path d="M${point(x, 0).join(' ')}L${point(x, 6).join(' ')}"/>`);
  }
  const buildings = [];
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    if ((x === 1 && y <= 1) || (x === 4 && y === 0) || (x === 4 && y === 4) || x === 3) continue;
    buildings.push(building(x, y, 13 + (x * 7 + y * 5) % 9));
  }
  const shadeTrees = planned && state.insight === 'shade' && route
    ? route.nodes.slice(1).filter((_, index) => index % 2 === 0).map((node, index) => {
        const [x, y] = gridPoint(node);
        const [beforeX, beforeY] = gridPoint(route.nodes[index * 2]);
        return tree((x + beforeX) / 2 + .16, (y + beforeY) / 2 - .12, true);
      }).join('') : '';
  const planEdge = availableEdges(state.insight, state.stage).find(edge => edge.added);
  const addedPath = planEdge ? `<path class="new-connection" d="${pathFor([planEdge.from, planEdge.to])}"/>${state.insight === 'crossing' ? `<path class="crossing-mark" d="${pathFor([planEdge.from, planEdge.to])}"/>` : ''}` : '';
  const mainRoute = route ? `<path class="route-back" d="${pathFor(route.nodes)}"/><path class="route-line" d="${pathFor(route.nodes)}"/>` : '';
  const homeMarkers = homes.map(item => {
    const [x, y] = nodePoint(item.node);
    return `<g class="home-pin ${item.id === home.id ? 'selected' : ''}" data-home="${item.id}" transform="translate(${x} ${y})" role="button" tabindex="0" aria-label="Start from ${item.label}"><circle class="pin-halo" r="21"/><circle class="pin-core" r="10"/><circle class="pin-centre" r="3"/></g>`;
  }).join('');
  const destinationMarkers = destinations.map(item => {
    const [x, y] = nodePoint(item.node);
    return `<g class="destination-pin ${item.id === destination.id ? 'selected' : ''}" transform="translate(${x} ${y})"><circle r="12"/><circle r="4"/></g>`;
  }).join('');
  svg.innerHTML = `<defs><linearGradient id="ground" x2="1" y2="1"><stop stop-color="#f5fbff"/><stop offset="1" stop-color="#e8f2fc"/></linearGradient><filter id="soft-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#42729a" flood-opacity=".15"/></filter></defs>
    <rect width="1000" height="650" fill="url(#ground)"/>
    <g class="blueprint-grid">${Array.from({ length: 17 }, (_, i) => `<path d="M0 ${i * 40}H1000M${i * 65} 0V650"/>`).join('')}</g>
    <g class="district-base"><polygon points="${polygon([point(-.45, -.4), point(6.45, -.4), point(6.45, 6.4), point(-.45, 6.4)])}"/></g>
    <g class="roads">${roads.join('')}</g><g class="road-centres">${roads.join('')}</g>
    <g class="park"><polygon points="${polygon([point(1.07, .11), point(2.86, .11), point(2.86, 1.92), point(1.07, 1.92)])}"/></g>
    <g class="boulevard"><path d="M${point(3.5, .15).join(' ')}L${point(3.5, 5.85).join(' ')}"/></g>
    <g class="buildings">${buildings.join('')}${building(4.02, .05, 25)}${building(4.04, .45, 21)}</g>
    <g class="trees">${[[1.3,.3],[2.1,.4],[1.4,1],[2.2,1.3],[.2,2.2],[.3,4.1],[2.2,4.2],[4.3,2.1],[5.3,3.2],[5.6,5.2]].map(([x,y]) => tree(x,y)).join('')}${shadeTrees}</g>
    <g class="design-path">${addedPath}</g><g class="route">${mainRoute}</g>
    <g class="pins">${homeMarkers}${destinationMarkers}</g>
    ${label(2, 1, 'Park')}${label(5, 1, 'Shops')}${label(5, 5, 'Bus stop')}${label(...gridPoint(home.node), home.label, 'home-label')}`;
  svg.querySelectorAll('[data-home]').forEach(marker => {
    const select = () => { state.home = marker.dataset.home; render(); };
    marker.addEventListener('click', select);
    marker.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } });
  });
  svg.setAttribute('aria-label', `${state.stage === 'before' ? 'Base' : 'Revised'} layout: ${home.label} to ${destination.label}, ${route?.minutes ?? 'no'} minute walk`);
}

function renderControls() {
  insightButtons.innerHTML = insights.map(item => `<button type="button" data-insight="${item.id}" aria-pressed="${item.id === state.insight}"><span class="insight-symbol ${item.id}" aria-hidden="true"></span><span>${escape(item.label)}</span><span class="chevron" aria-hidden="true"></span></button>`).join('');
  homeButtons.innerHTML = homes.map(item => `<button type="button" data-home="${item.id}" aria-pressed="${item.id === state.home}">${item.label}</button>`).join('');
  destinationButtons.innerHTML = destinations.map(item => {
    const route = shortestRoute(homes.find(home => home.id === state.home).node, item.node, state.insight, state.stage);
    return `<button type="button" data-destination="${item.id}" aria-pressed="${item.id === state.destination}"><span>${escape(item.label)}</span><strong>${route ? `${route.minutes} min` : 'No route'}</strong></button>`;
  }).join('');
  document.querySelectorAll('[data-stage]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.stage === state.stage)));
  insightButtons.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    state.insight = button.dataset.insight;
    state.destination = state.insight === 'crossing' ? 'bus' : state.insight === 'connection' ? 'shops' : 'park';
    state.stage = 'planned';
    render();
  }));
  homeButtons.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { state.home = button.dataset.home; render(); }));
  destinationButtons.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { state.destination = button.dataset.destination; render(); }));
}

function renderDetails() {
  const home = homes.find(item => item.id === state.home);
  const destination = destinations.find(item => item.id === state.destination);
  const insight = insights.find(item => item.id === state.insight);
  const before = shortestRoute(home.node, destination.node, state.insight, 'before');
  const planned = shortestRoute(home.node, destination.node, state.insight, 'planned');
  document.getElementById('home-name').textContent = home.label;
  const covered = destinations.filter(item => {
    const route = shortestRoute(home.node, item.node, state.insight, state.stage);
    return route && route.minutes <= 15;
  }).length;
  document.getElementById('access-summary').textContent = `${covered === destinations.length ? 'All' : `${covered} of`} ${destinations.length} destinations within a 15-minute walk in the ${state.stage === 'before' ? 'base' : 'revised'} layout`;
  document.getElementById('comparison-label').textContent = `${home.label} to ${destination.label}`;
  document.getElementById('before-time').textContent = before ? `${before.minutes} min` : 'No route';
  document.getElementById('after-time').textContent = planned ? `${planned.minutes} min` : 'No route';
  const saved = before && planned ? before.minutes - planned.minutes : 0;
  document.getElementById('comparison-detail').textContent = state.insight === 'shade'
    ? 'Walking time stays the same. Shade is added along this route.'
    : saved > 0 ? `${saved} ${saved === 1 ? 'minute' : 'minutes'} shorter with this design change.`
      : 'Walking time is unchanged for this route.';
  document.getElementById('design-action').textContent = insight.action;
  const kind = { shade: 'hot', crossing: 'cross', connection: 'broken_path' }[state.insight];
  const concern = mapConcerns.find(item => item.kind === kind);
  document.getElementById('concern-street').textContent = concern?.roadName || 'Elmina';
  document.getElementById('concern-description').textContent = concern?.title || insight.label;
}

function render() { renderControls(); renderDetails(); renderMap(); }
document.querySelectorAll('[data-stage]').forEach(button => button.addEventListener('click', () => { state.stage = button.dataset.stage; render(); }));
render();

const $ = id => document.getElementById(id);
const COST = { tree: 5000, sail: 15000, crossing: 90000, light: 6000 };
const ICON = { tree: '♣', sail: '◭', crossing: '⇄', light: '✦' };
const LABEL = { tree: 'Tree', sail: 'Shade sail', crossing: 'Raised crossing', light: 'Street light' };
const STORAGE_KEY = 'teduh-elmina-plan-v1';
const BOUNDS = [[3.175, 101.495], [3.190, 101.518]];
let data, map, roadLayer, buildingLayer, destinationLayer, proposalLayer, reportLayer, routeLayer, endpointLayer;
let graph = new Map();
let mode = null, routePoints = [], proposals = [], selected = null, nextId = 1;
let shared = false;
let noticeTimer;
const PILOT_WAY_ID = 'way/1148541502';
const SCHOOL_FLOW = { 7: 1, 8: .9, 9: .2, 10: .15, 11: .2, 12: .5, 13: 1, 14: .8, 15: .4, 16: .3, 17: .3, 18: .25, 19: .15 };
let priorityLine, pilotRoad;

function priorityAt(hour) {
  const walkers = Math.round(120 * SCHOOL_FLOW[hour]);
  const shade = Math.min(.95, .05 + .15 * Math.min(1, Math.abs(hour - 13) / 5));
  const score = Math.round(100 * (walkers / 120) * (1 - shade) * .95 * .9) / 100;
  return { walkers, exposure: Math.round(100 * (1 - shade)), score };
}
function updatePriority() {
  const hour = Number($('priorityHour').value);
  const { walkers, exposure, score } = priorityAt(hour);
  $('priorityTime').textContent = `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`;
  if (window.parent !== window) window.parent.postMessage({ type: 'teduh-hour', hour }, location.origin);
  if (!priorityLine) return;
  priorityLine.setStyle({ color: score >= .75 ? '#b52f27' : score >= .55 ? '#dc6940' : score >= .35 ? '#e0a019' : '#2e9d6c' });
  priorityLine.bringToFront();
  $('featureInfo').innerHTML = `<strong>Jalan Elmina 3 · planning route</strong>
    <div class="priority-readout"><strong>${score.toFixed(2)}</strong><span>estimated priority${hour === 13 ? ' · #1 of 20 scenario streets' : ''}</span></div>
    <dl><dt>Hour</dt><dd>${esc($('priorityTime').textContent)}</dd><dt>Walkers</dt><dd>${walkers} per hour, scenario input</dd>
    <dt>Sun exposure</dt><dd>${exposure}%, estimated</dd><dt>Nearby</dt><dd>Primary school, scenario input</dd>
    <dt>Crossing gap</dt><dd>150 m, scenario input</dd><dt>Mapped line</dt><dd>${esc(pilotRoad.name)} · OSM ${esc(pilotRoad.id)}</dd></dl>
    <span class="muted">The mapped street is a nearby visual reference. Its foot access and the pilot route need site confirmation; the priority values are planning estimates.</span>`;
}
function showFixPreview() {
  if (!pilotRoad) return;
  const points = pilotRoad.coordinates.map(latlng);
  const lengths = points.slice(1).map((point, index) => map.distance(points[index], point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const along = fraction => {
    let remaining = total * fraction;
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i] || i === lengths.length - 1) {
        const ratio = Math.min(1, remaining / lengths[i]);
        return [points[i][0] + (points[i + 1][0] - points[i][0]) * ratio,
          points[i][1] + (points[i + 1][1] - points[i][1]) * ratio];
      }
      remaining -= lengths[i];
    }
    return points.at(-1);
  };
  const beside = (fraction, metres) => {
    const point = along(fraction), before = along(Math.max(0, fraction - .01)), after = along(Math.min(1, fraction + .01));
    const east = (after[1] - before[1]) * Math.cos(point[0] * Math.PI / 180);
    const north = after[0] - before[0];
    const length = Math.hypot(east, north) || 1;
    return [point[0] + east / length * metres / 111320,
      point[1] - north / length * metres / (111320 * Math.cos(point[0] * Math.PI / 180))];
  };
  const layer = L.featureGroup().addTo(map);
  [.12, .22, .32, .42, .58, .68, .78, .88].forEach((fraction, index) => {
    L.circleMarker(beside(fraction, 7), { radius: 7, color: '#fff', weight: 2, fillColor: '#25845c',
      fillOpacity: 1, bubblingMouseEvents: false }).bindTooltip(`Tree ${index + 1} of 8 · proposed`).addTo(layer);
  });
  const pin = (fraction, type, label) => L.marker(along(fraction), {
    icon: L.divIcon({ className: '', html: `<span class="preview-pin ${type}">${type === 'sail' ? 'S' : ''}</span>`,
      iconSize: type === 'sail' ? [25, 25] : [30, 22], iconAnchor: type === 'sail' ? [12, 12] : [15, 11] }),
    bubblingMouseEvents: false,
  }).bindTooltip(label).addTo(layer);
  L.marker(beside(.5, -9), { icon: L.divIcon({ className: '', html: '<span class="preview-pin sail">S</span>', iconSize: [25, 25], iconAnchor: [12, 12] }), bubblingMouseEvents: false })
    .bindTooltip('Shade sail · proposed').addTo(layer);
  pin(.03, 'crossing', 'Raised zebra crossing · proposed');
  map.fitBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 18 });
  document.querySelector('.map-heading strong').textContent = 'Jalan Elmina 3 fix preview';
  document.querySelector('.map-heading span').textContent = 'Proposed locations';
  $('featureInfo').innerHTML = `<strong>Jalan Elmina 3 · proposed bundle</strong>
    <div class="priority-readout"><strong>RM70k</strong><span>scenario bundle estimate</span></div>
    <dl><dt>Trees</dt><dd>8 proposed shade spots</dd><dt>Shade sail</dt><dd>1 proposed location</dd>
    <dt>Crossing</dt><dd>Raised zebra, proposed location</dd><dt>Mapped line</dt><dd>${esc(pilotRoad.name)} · OSM ${esc(pilotRoad.id)}</dd></dl>
    <span class="muted">Markers are illustrative positions along a nearby mapped way. Confirm the pilot route, foot access, utilities, and exact fix locations on site.</span>`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function fmtCost(value) { return 'RM ' + value.toLocaleString('en-MY'); }
function latlng(coordinates) { return [coordinates[1], coordinates[0]]; }
function inArea(coordinates) {
  return Array.isArray(coordinates) && coordinates.length === 2 &&
    Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]) &&
    coordinates[0] >= BOUNDS[0][1] && coordinates[0] <= BOUNDS[1][1] &&
    coordinates[1] >= BOUNDS[0][0] && coordinates[1] <= BOUNDS[1][0];
}
function notice(message, persist = false) {
  clearTimeout(noticeTimer);
  $('mapNotice').textContent = message;
  $('mapNotice').hidden = false;
  if (!persist) noticeTimer = setTimeout(() => { $('mapNotice').hidden = true; }, 4400);
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
    $('saveStatus').textContent = 'Plan stored in this browser';
  } catch (_) { $('saveStatus').textContent = 'Local save unavailable. Export your plan.'; }
}
function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(parsed)) {
      proposals = parsed.filter(item => item && Object.hasOwn(COST, item.kind) && inArea(item.coordinates))
        .map(item => ({ id: String(item.id), kind: item.kind, coordinates: item.coordinates }));
      nextId = Math.max(0, ...proposals.map(item => Number(String(item.id).replace('fix-', '')) || 0)) + 1;
    }
  } catch (_) { proposals = []; }
}
function setMode(next) {
  mode = mode === next ? null : next;
  $('routeTool').setAttribute('aria-pressed', String(mode === 'route'));
  document.querySelectorAll('[data-tool]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.tool === mode)));
  map.getContainer().style.cursor = mode ? 'crosshair' : '';
  if (mode === 'route') notice('Click a start point, then a destination on the map.');
  else if (mode) notice('Click the map to place a proposed ' + LABEL[mode].toLowerCase() + '.');
}
function inspectRoad(road) {
  selected = null;
  $('selectedFix').hidden = true;
  $('featureInfo').innerHTML = `<strong>${esc(road.name)}</strong><dl>
    <dt>Source</dt><dd>OpenStreetMap ${esc(road.id)}</dd>
    <dt>Mapped type</dt><dd>${esc(road.kind)}</dd>
    <dt>Walking access</dt><dd>${road.walkable ? 'Graph candidate, field check needed' : 'Excluded from walking graph'}</dd>
    <dt>Sidewalk</dt><dd>${esc(road.sidewalk)}</dd>
    <dt>Lighting</dt><dd>${esc(road.lit)}</dd>
    <dt>Surface</dt><dd>${esc(road.surface)}</dd></dl>
    <span class="muted">OSM tags do not prove this route is safe or accessible.</span>`;
}
function inspectFix(fix) {
  selected = fix.id;
  $('featureInfo').innerHTML = `<strong>Proposed ${esc(LABEL[fix.kind].toLowerCase())}</strong><dl>
    <dt>Location</dt><dd>${fix.coordinates[1].toFixed(6)}, ${fix.coordinates[0].toFixed(6)}</dd>
    <dt>Rough cost</dt><dd>${fmtCost(COST[fix.kind])}</dd>
    <dt>Status</dt><dd>${esc(fix.status || 'proposed')}, site audit required</dd></dl>`;
  $('selectedFix').hidden = false;
  $('selectedFix').innerHTML = `Selected: ${esc(LABEL[fix.kind])}<button id="deleteFix" type="button">Remove this proposal</button>`;
  $('deleteFix').onclick = async () => {
    if (shared) {
      try { await request(`/api/proposals/${fix.id}`, { method: 'DELETE' }); }
      catch (error) { notice('Could not remove proposal: ' + error.message); return; }
    }
    proposals = proposals.filter(item => item.id !== fix.id);
    selected = null;
    $('selectedFix').hidden = true;
    $('featureInfo').textContent = 'Select a mapped street or proposed fix.';
    renderProposals(); save();
  };
  renderProposals();
}
function renderProposals() {
  proposalLayer.clearLayers();
  for (const fix of proposals) {
    const icon = L.divIcon({ className: '', html: `<span class="proposal-pin ${selected === fix.id ? 'selected' : ''} ${esc(fix.status || 'proposed')}">${ICON[fix.kind]}</span>`, iconSize: [29, 29], iconAnchor: [14, 14] });
    const marker = L.marker(latlng(fix.coordinates), { icon, draggable: true, autoPan: true }).addTo(proposalLayer);
    marker.on('click', event => { L.DomEvent.stopPropagation(event.originalEvent); inspectFix(fix); });
    marker.on('dragend', async () => {
      const p = marker.getLatLng();
      const next = [Number(p.lng.toFixed(7)), Number(p.lat.toFixed(7))];
      if (!inArea(next)) { notice('Keep proposed fixes inside the Elmina pilot area.'); renderProposals(); return; }
      if (shared) {
        try { await request(`/api/proposals/${fix.id}`, { method: 'PATCH', body: JSON.stringify({ coordinates: next }) }); }
        catch (error) { notice('Could not move proposal: ' + error.message); renderProposals(); return; }
      }
      fix.coordinates = next;
      save(); inspectFix(fix);
    });
  }
  $('fixCount').textContent = proposals.length;
  $('planTotal').textContent = fmtCost(proposals.reduce((sum, fix) => sum + COST[fix.kind], 0));
  $('planList').innerHTML = proposals.length ? proposals.map(fix =>
    `<div class="plan-item"><span>${esc(LABEL[fix.kind])}<small>${fix.coordinates[1].toFixed(5)}, ${fix.coordinates[0].toFixed(5)}</small></span><strong>${fmtCost(COST[fix.kind])}</strong></div>`
  ).join('') : '<p class="muted">No fixes placed yet.</p>';
}
async function addFix(point) {
  const coordinates = [Number(point.lng.toFixed(7)), Number(point.lat.toFixed(7))];
  if (!inArea(coordinates)) { notice('Choose a location inside the Elmina pilot area.'); return; }
  let fix = { id: `fix-${nextId++}`, kind: mode, coordinates };
  if (shared) {
    try { fix = (await request('/api/proposals', { method: 'POST', body: JSON.stringify({ kind: fix.kind, coordinates }) })).proposal; }
    catch (error) { notice('Could not save proposal for the team: ' + error.message); return; }
  }
  proposals.push(fix);
  save(); inspectFix(fix);
  notice('Proposed ' + LABEL[fix.kind].toLowerCase() + ' added. Drag it to adjust.');
}
function nearestNode(point) {
  let best = null, distance = Infinity;
  for (const [id, coords] of Object.entries(data.nodes)) {
    const current = map.distance(point, latlng(coords));
    if (current < distance) { best = id; distance = current; }
  }
  return distance <= 100 ? best : null;
}
function heapPush(heap, entry) {
  heap.push(entry);
  for (let i = heap.length - 1; i > 0;) {
    const parent = (i - 1) >> 1;
    if (heap[parent][0] <= heap[i][0]) break;
    [heap[parent], heap[i]] = [heap[i], heap[parent]];
    i = parent;
  }
}
function heapPop(heap) {
  const first = heap[0], last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    for (let i = 0;;) {
      let child = i * 2 + 1;
      if (child >= heap.length) break;
      if (child + 1 < heap.length && heap[child + 1][0] < heap[child][0]) child++;
      if (heap[i][0] <= heap[child][0]) break;
      [heap[i], heap[child]] = [heap[child], heap[i]];
      i = child;
    }
  }
  return first;
}
function findRoute(start, end) {
  const distances = new Map([[start, 0]]), previous = new Map(), heap = [[0, start]];
  while (heap.length) {
    const [score, node] = heapPop(heap);
    if (score !== distances.get(node)) continue;
    if (node === end) break;
    for (const [next, metres, penalty] of graph.get(node) || []) {
      const candidate = score + metres * penalty;
      if (candidate >= (distances.get(next) ?? Infinity)) continue;
      distances.set(next, candidate); previous.set(next, [node, metres]); heapPush(heap, [candidate, next]);
    }
  }
  if (!distances.has(end)) return null;
  const path = [end]; let metres = 0;
  while (path[0] !== start) {
    const item = previous.get(path[0]);
    if (!item) return null;
    metres += item[1]; path.unshift(item[0]);
  }
  return { path, metres };
}
function routeMarker(node, end) {
  const icon = L.divIcon({ className: '', html: `<span class="route-endpoint ${end ? 'end' : ''}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
  L.marker(latlng(data.nodes[node]), { icon, interactive: false }).addTo(endpointLayer);
}
function renderRoute() {
  routeLayer.clearLayers(); endpointLayer.clearLayers();
  routePoints.forEach((id, index) => routeMarker(id, index === 1));
  if (routePoints.length < 2) {
    $('routeResult').textContent = routePoints.length ? 'Start set. Choose a destination.' : 'Choose route points to inspect a real mapped walk.';
    return;
  }
  const result = findRoute(routePoints[0], routePoints[1]);
  if (!result) {
    $('routeResult').textContent = 'These points are not connected in this OSM extract. Try two nearby walking links.';
    notice('No connected mapped route between those points.');
    return;
  }
  L.polyline(result.path.map(id => latlng(data.nodes[id])), { color: '#dd8e25', weight: 7, opacity: .92, lineCap: 'round' }).addTo(routeLayer);
  const km = (result.metres / 1000).toFixed(2);
  const minutes = Math.max(1, Math.round(result.metres / 72));
  $('routeResult').innerHTML = `<strong>${km} km · about ${minutes} min</strong><br>Mapped walking connection. Pavement, crossings and shade are not field verified.`;
  map.fitBounds(routeLayer.getBounds().pad(.2), { maxZoom: 17 });
}
function mapClick(point) {
  if (mode === 'route') {
    const node = nearestNode(point);
    if (!node) { notice('No mapped walking link within 100 m. Click closer to a green line.'); return; }
    routePoints = routePoints.length >= 2 ? [node] : [...routePoints, node];
    renderRoute();
  } else if (mode && Object.hasOwn(COST, mode)) addFix(point);
}
function exportPlan() {
  const features = proposals.map(fix => ({ type: 'Feature', id: fix.id,
    geometry: { type: 'Point', coordinates: fix.coordinates },
    properties: { kind: fix.kind, status: 'proposed', cost_rm_estimate: COST[fix.kind], source: 'Teduh planner', area: 'Elmina pilot' },
  }));
  const blob = new Blob([JSON.stringify({ type: 'FeatureCollection', features }, null, 2)], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'teduh-elmina-proposals.geojson'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importPlan(file) {
  if (!file || file.size > 1_000_000) { notice('Choose a GeoJSON plan under 1 MB.'); return; }
  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.type !== 'FeatureCollection' || !Array.isArray(parsed.features) || parsed.features.length > 500) throw Error('Invalid FeatureCollection');
    let imported = parsed.features.map((feature, index) => {
      if (feature.geometry?.type !== 'Point' || !inArea(feature.geometry.coordinates) || !Object.hasOwn(COST, feature.properties?.kind)) throw Error(`Invalid feature ${index + 1}`);
      return { id: `fix-${nextId++}`, kind: feature.properties.kind, coordinates: feature.geometry.coordinates };
    });
    if (shared) {
      const result = await request('/api/proposals/import', { method: 'POST', body: JSON.stringify({ proposals: imported }) });
      imported = result.proposals;
    }
    proposals = [...proposals, ...imported]; save(); renderProposals();
    notice(`Imported ${imported.length} proposed fixes.`);
  } catch (error) { notice('Could not import this plan: ' + error.message); }
}
async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Request failed');
  return result;
}
async function loadShared() {
  try {
    const remote = (await request('/api/proposals')).proposals;
    shared = true;
    if (remote.length === 0 && proposals.length) {
      const migrated = await request('/api/proposals/import', { method: 'POST', body: JSON.stringify({ proposals }) });
      proposals = migrated.proposals;
    } else proposals = remote;
    save(); renderProposals();
  } catch (error) {
    shared = false;
    $('saveStatus').textContent = 'Plan stored in this browser';
    console.warn('Shared proposal service unavailable:', error.message);
  }
}
async function loadReports() {
  try {
    const reports = (await request('/api/reports')).reports;
    reportLayer.clearLayers();
    for (const item of reports) {
      const marker = L.circleMarker(latlng(item.coordinates), { radius: 8, color: '#fff', weight: 2, fillColor: '#cb573a', fillOpacity: 1 }).addTo(reportLayer);
      marker.on('click', event => {
        L.DomEvent.stopPropagation(event.originalEvent);
        $('featureInfo').innerHTML = `<strong>Resident report: ${esc(item.kind)}</strong><dl><dt>Location</dt><dd>${esc(item.road_name || 'Elmina City Centre')}</dd><dt>Status</dt><dd>${esc(item.status)}</dd><dt>Me too</dt><dd>${item.me_too_count}</dd><dt>Note</dt><dd>${esc(item.note || 'No note')}</dd><dt>Team reply</dt><dd>${esc(item.reply || 'Pending')}</dd></dl><span class="muted">Resident observation, awaiting field verification.</span>`;
      });
    }
    $('reportCount').textContent = String(reports.length);
  } catch (error) { console.warn('Shared reports unavailable:', error.message); }
}
async function init() {
  try {
    const response = await fetch('./elmina-map.json');
    if (!response.ok) throw Error('Map data request failed');
    data = await response.json();
    map = L.map('map', { zoomControl: false, preferCanvas: true }).fitBounds(BOUNDS);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
    }).addTo(map);
    roadLayer = L.layerGroup().addTo(map); buildingLayer = L.layerGroup();
    destinationLayer = L.layerGroup().addTo(map); proposalLayer = L.layerGroup().addTo(map); reportLayer = L.layerGroup().addTo(map);
    routeLayer = L.featureGroup().addTo(map); endpointLayer = L.layerGroup().addTo(map);
    for (const road of data.roads) {
      const line = L.polyline(road.coordinates.map(latlng), {
        color: road.walkable ? '#2e8063' : '#8b9991', weight: road.walkable ? 3.3 : 1.3,
        opacity: road.walkable ? .82 : .35, bubblingMouseEvents: false,
      }).addTo(roadLayer);
      line.on('click', event => { if (mode) mapClick(event.latlng); else inspectRoad(road); });
    }
    pilotRoad = data.roads.find(road => road.id === PILOT_WAY_ID);
    if (pilotRoad && !document.documentElement.classList.contains('compact')) {
      const requestedHour = Number(new URLSearchParams(location.search).get('hour'));
      if (Number.isInteger(requestedHour) && requestedHour >= 7 && requestedHour <= 19) $('priorityHour').value = String(requestedHour);
      priorityLine = L.polyline(pilotRoad.coordinates.map(latlng), {
        color: '#e0a019', weight: 10, opacity: .95, lineCap: 'round', bubblingMouseEvents: false,
      }).addTo(map);
      priorityLine.on('click', event => { if (mode) mapClick(event.latlng); else updatePriority(); });
      map.fitBounds(priorityLine.getBounds(), { padding: [65, 65], maxZoom: 17 });
      $('priorityHour').addEventListener('input', updatePriority);
      updatePriority();
    }
    for (const building of data.buildings) {
      L.polygon(building.coordinates.map(latlng), { color: '#6e8180', weight: .5, fillColor: '#a6b9b0', fillOpacity: .25, interactive: false }).addTo(buildingLayer);
    }
    for (const place of data.destinations) {
      L.marker(latlng(place.coordinates), { icon: L.divIcon({ className: '', html: '<span class="poi-pin"></span>', iconSize: [9, 9], iconAnchor: [4, 4] }) })
        .bindTooltip(`${esc(place.name)} · ${esc(place.kind)}`).addTo(destinationLayer);
    }
    if (document.documentElement.classList.contains('preview') && pilotRoad) {
      $('priorityHour').value = '13';
      updatePriority();
      showFixPreview();
    }
    for (const [a, b, metres, penalty] of data.edges) {
      if (!graph.has(a)) graph.set(a, []);
      if (!graph.has(b)) graph.set(b, []);
      graph.get(a).push([b, metres, penalty]); graph.get(b).push([a, metres, penalty]);
    }
    loadSaved(); renderProposals(); await loadShared(); await loadReports();
    $('wayCount').textContent = data.roads.length.toLocaleString('en-MY');
    map.on('click', event => mapClick(event.latlng));
    $('routeTool').onclick = () => setMode('route');
    $('clearRoute').onclick = () => { routePoints = []; renderRoute(); };
    document.querySelectorAll('[data-tool]').forEach(button => { button.onclick = () => setMode(button.dataset.tool); });
    $('fitBtn').onclick = () => map.fitBounds(BOUNDS);
    $('exportBtn').onclick = exportPlan;
    $('importInput').onchange = event => { importPlan(event.target.files[0]); event.target.value = ''; };
    const layers = [
      ['roadsToggle', roadLayer], ['buildingsToggle', buildingLayer],
      ['destinationsToggle', destinationLayer], ['proposalsToggle', proposalLayer], ['reportsToggle', reportLayer],
    ];
    layers.forEach(([id, layer]) => { $(id).onchange = event => { if (event.target.checked) layer.addTo(map); else map.removeLayer(layer); }; });
    $('mapNotice').hidden = true;
    if (!document.documentElement.classList.contains('embedded')) notice('Real Elmina OSM geometry loaded. Choose route points or place a proposed fix.');
    setInterval(() => { if (shared) loadShared(); loadReports(); }, 20_000);
  } catch (error) {
    console.error(error);
    notice('The map could not load. Check the local server and retry this page.', true);
  }
}
init();

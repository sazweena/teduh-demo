const bounds = [[3.175, 101.495], [3.190, 101.518]];
const labels = { hot: 'Too hot / no shade', cross: 'Unsafe crossing', dark: 'Too dark', broken: 'Broken path' };
const map = L.map('map').fitBounds(bounds);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' }).addTo(map);
const selection = L.layerGroup().addTo(map), reportLayer = L.layerGroup().addTo(map);
let picked = null, kind = null, roads = [], reports = [];
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inArea = coordinates => coordinates[0] >= 101.495 && coordinates[0] <= 101.518 && coordinates[1] >= 3.175 && coordinates[1] <= 3.190;
function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); $('message').hidden = false; }
function mineIds() { try { return JSON.parse(localStorage.getItem('teduh-report-ids') || '[]'); } catch { return []; } }
function saveMine(id) { const ids = mineIds(); ids.unshift(id); localStorage.setItem('teduh-report-ids', JSON.stringify([...new Set(ids)].slice(0, 100))); }
function nearRoad(point) {
  let nearest = null, metres = Infinity;
  for (const road of roads) for (const [lon, lat] of road.coordinates) {
    const distance = map.distance(point, [lat, lon]);
    if (distance < metres) { metres = distance; nearest = road; }
  }
  return metres <= 120 ? nearest?.name || 'Unnamed mapped way' : 'Location in Elmina City Centre';
}
function pick(point) {
  const coordinates = [Number(point.lng.toFixed(7)), Number(point.lat.toFixed(7))];
  if (!inArea(coordinates)) { message('Choose a location inside the Elmina pilot area.', true); return; }
  picked = coordinates; selection.clearLayers();
  L.circleMarker([coordinates[1], coordinates[0]], { radius: 9, color: '#fff', weight: 3, fillColor: '#d2412a', fillOpacity: 1 }).addTo(selection);
  $('chosen').textContent = `${nearRoad(point)} · ${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}`;
  $('submit').disabled = !kind;
}
map.on('click', event => pick(event.latlng));
document.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
  kind = button.dataset.kind;
  document.querySelectorAll('[data-kind]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  $('submit').disabled = !picked;
}));

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw Error(body.error || 'Request failed');
  return body;
}
function render() {
  reportLayer.clearLayers();
  for (const item of reports) {
    const pin = L.circleMarker([item.coordinates[1], item.coordinates[0]], { radius: 7, color: '#fff', weight: 2, fillColor: '#d18c22', fillOpacity: 1 }).addTo(reportLayer);
    pin.bindPopup(`${escapeHtml(labels[item.kind])}<br>${escapeHtml(item.road_name)}<br>${escapeHtml(item.status)}`);
  }
  const owned = new Set(mineIds());
  $('reports').innerHTML = reports.length ? reports.slice(0, 15).map(item => `<div class="item"><strong>${escapeHtml(labels[item.kind])}</strong><small>${escapeHtml(item.road_name || 'Elmina City Centre')} · ${escapeHtml(item.status)}</small><div class="actions"><span class="pill">${item.me_too_count} Me too</span><button class="secondary" data-agree="${item.id}">Me too</button></div></div>`).join('') : '<p>No reports yet. You can start with a place you know.</p>';
  const own = reports.filter(item => owned.has(item.id));
  $('mine').innerHTML = own.length ? own.map(item => `<div class="item"><strong>${escapeHtml(labels[item.kind])}</strong><small>${escapeHtml(item.road_name || 'Elmina City Centre')} · ${escapeHtml(item.status)}</small><p>${escapeHtml(item.reply || 'No team reply yet. Check back for status updates.')}</p></div>`).join('') : '<p>Reports submitted in this browser will appear here.</p>';
  document.querySelectorAll('[data-agree]').forEach(button => button.addEventListener('click', async () => {
    try { await api(`/api/reports/${button.dataset.agree}/me-too`, { method: 'POST' }); message('Your support was added.'); await refresh(); }
    catch (error) { message(error.message, true); }
  }));
}
async function refresh() {
  try { reports = (await api('/api/reports')).reports; render(); }
  catch (error) { $('reports').innerHTML = `<p>Reports unavailable: ${escapeHtml(error.message)}</p>`; }
}
$('submit').addEventListener('click', async () => {
  if (!picked || !kind) return;
  $('submit').disabled = true;
  try {
    const point = L.latLng(picked[1], picked[0]);
    const source = new URLSearchParams(location.search).get('source') === 'owner' ? 'Owner app concept' : 'QR web form';
    const body = await api('/api/reports', { method: 'POST', body: JSON.stringify({ kind, coordinates: picked, road_name: nearRoad(point), note: $('note').value, source }) });
    saveMine(body.report.id); $('note').value = ''; message('Report saved in this browser. Its status will appear under Your reports.'); await refresh();
  } catch (error) { message(error.message, true); }
  finally { $('submit').disabled = false; }
});

fetch('./elmina-map.json').then(response => response.json()).then(data => { roads = data.roads; }).catch(() => {});
refresh(); setInterval(refresh, 20_000);
window.addEventListener('storage', event => { if (event.key === 'teduh-team-local-v1') refresh(); });

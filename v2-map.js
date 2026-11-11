import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';
import { sunPosition, buildingShadow } from './v2-sun.mjs';
import { frekuensiRoofs } from './v2-roofs.mjs';
import { createAreaHouses } from './v2-houses.mjs';
import { generateResidentRoutes } from './v2-resident-routes.mjs';
import { startBudgetAnimation } from './v2-budget-animation.mjs';
import { treeMix, planItems, fullPlanCost, planForBudget } from './v2-street-plan.mjs';
import { ilhamAreaBounds, inIlhamArea, streetGeometry, streetMidpoint, priorityFactors, priorityAt, priorityColor } from './v2-street-priority.mjs';
import { createWorkspace } from './v2-workspace.mjs';

const timeSlider = document.getElementById('time-slider');
const timeOutput = document.getElementById('time-output');
const timeClock = document.getElementById('time-clock');
const clockHourHand = document.getElementById('clock-hour-hand');
const streetDetail = document.getElementById('street-detail');
const budgetDialog = document.getElementById('budget-dialog');
const budgetForm = document.getElementById('budget-form');
const budgetAmount = document.getElementById('budget-amount');
const budgetSlider = document.getElementById('budget-slider');
const budgetError = document.getElementById('budget-error');
const budgetProcess = document.getElementById('budget-process');
const budgetProcessCanvas = document.getElementById('budget-process-canvas');
const budgetProcessTitle = document.getElementById('budget-process-title');
const budgetProcessDescription = document.getElementById('budget-process-description');
const budgetProcessProgress = document.getElementById('budget-process-progress');
const budgetProcessPercent = document.getElementById('budget-process-percent');
const budgetProcessAction = document.getElementById('budget-process-action');
const budgetResult = document.getElementById('budget-result');
const mapPanel = document.querySelector('.map-panel');
const edgeIndicators = document.getElementById('priority-edge-indicators');
const mapStatus = document.getElementById('map-status');
const sunToggle = document.getElementById('sun-toggle');
const buildingHeight = 6;
const ilhamCheckpoint = document.getElementById('ilham-checkpoint');
const frekuensiCheckpoint = document.getElementById('frekuensi-checkpoint');
const satelliteToggle = document.getElementById('satellite-toggle');
const satelliteMapElement = document.getElementById('satellite-map');
const centreCoordinates = document.getElementById('map-centre-coordinates');
const centreValue = document.getElementById('map-centre-value');
const tiltToggle = document.getElementById('tilt-toggle');
const frekuensiBounds = [[101.5137, 3.18885], [101.51635, 3.18985]];
const defaultCenter = [101.5184, 3.18886];
const defaultZoom = 18.8;
const ilhamStreetName = 'Jalan Elmina Ilham 3';
const shadowBuildingIds = new Set(Array.from({ length: 16 }, (_, index) => `way/${912252060 + index}`));
const emptyCollection = () => ({ type: 'FeatureCollection', features: [] });
const collection = features => ({ type: 'FeatureCollection', features });
const feature = (item, geometry, properties = {}) => ({ type: 'Feature', id: item.id, properties, geometry });
const skyTones = {
  7: { color: '#2b4664', opacity: .25, brightness: .76, saturation: -.18 },
  8: { color: '#edbd86', opacity: .14, brightness: .92 },
  9: { color: '#f6dfa9', opacity: .06, brightness: 1 },
  16: { color: '#f6dda1', opacity: .06, brightness: 1 },
  17: { color: '#edbd74', opacity: .14, brightness: .94 },
  18: { color: '#e5a164', opacity: .21, brightness: .84 },
  19: { color: '#2f405e', opacity: .3, brightness: .7, saturation: -.2 },
};
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>',
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  },
  center: defaultCenter,
  zoom: defaultZoom,
  pitch: 0,
  bearing: 0,
  maxPitch: 80,
  canvasContextAttributes: { antialias: true },
});
const mapReady = map.once('load');
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

const dateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
}).formatToParts(new Date());
const datePart = type => dateParts.find(part => part.type === type).value;
const sunDate = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;

let shadowBuildings = [];
let ilhamRoad;
let googleMap;
let googleShadows = [];
let googleSelection;
let googlePriorityLayer;
let googleResidentRoutesLayer;
let satelliteActive = false;
let priorityRoads = [];
let mappedPedestrianRoads = [];
let residentRoutes = emptyCollection();
let priorityRoadById = new Map();
let streetLabelElements = [];
let priorityPins = [];
let selectedRoad;
let selectedPosition;
let selectedBudget = 70000;
let stopBudgetAnimation;
let budgetAnimationComplete = false;
let workspace;
const money = amount => `RM${amount.toLocaleString('en-MY')}`;
const budgetStorageKey = road => `teduh-v2-budget:${road.name === 'Unnamed mapped way' ? road.id : road.name}`;
function loadStreetBudget(road) {
  selectedBudget = 70000;
  try {
    const storedBudget = Number(localStorage.getItem(budgetStorageKey(road)));
    if (Number.isInteger(storedBudget) && storedBudget >= 10000 && storedBudget <= 300000) {
      selectedBudget = storedBudget;
    }
  } catch { /* Browser storage may be unavailable. */ }
}

function createPriorityPin(name) {
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'priority-pin-marker';
  pin.setAttribute('aria-label', `Open details for highest-priority street: ${name}`);
  const shape = document.createElement('span');
  shape.className = 'priority-pin-shape';
  const icon = document.createElement('span');
  icon.textContent = '!';
  icon.setAttribute('aria-hidden', 'true');
  shape.append(icon);
  pin.append(shape);
  return pin;
}

function formatHour(hour) {
  return `${hour % 12 || 12}:00 ${hour < 12 ? 'AM' : 'PM'}`;
}

function updateTime() {
  const hour = Number(timeSlider.value);
  timeOutput.value = formatHour(hour);
  timeSlider.setAttribute('aria-valuetext', timeOutput.value);
  const tone = skyTones[hour];
  timeClock.style.setProperty('--clock-face', tone?.color ?? '#e7eee8');
  timeClock.style.setProperty('--clock-ink', hour === 7 || hour === 19 ? '#fff' : '#173029');
  clockHourHand.setAttribute('transform', `rotate(${hour * 30} 20 20)`);
  renderShadows();
  renderPriority();
  renderSkyTone();
}

function renderSkyTone() {
  if (!map.getLayer('sky-tone-wash')) return;
  const tone = skyTones[Number(timeSlider.value)];
  map.setPaintProperty('osm', 'raster-brightness-max', tone?.brightness ?? 1);
  map.setPaintProperty('osm', 'raster-saturation', tone?.saturation ?? 0);
  map.setPaintProperty('sky-tone-wash', 'background-color', tone?.color ?? '#ffffff');
  map.setPaintProperty('sky-tone-wash', 'background-opacity', tone?.opacity ?? 0);
}

function renderPriority() {
  const source = map.getSource('street-priority');
  if (!source) return;
  const hour = Number(timeSlider.value);
  source.setData(collection(priorityRoads.map(road => feature(road,
    streetGeometry(road),
    { id: road.id, name: road.name === 'Unnamed mapped way' ? '' : road.name,
      color: priorityColor(priorityAt(road, hour)) }))));
  if (googlePriorityLayer) googlePriorityLayer.setStyle(feature => ({
    strokeColor: priorityColor(priorityAt(priorityRoadById.get(feature.getProperty('id')), hour)),
    strokeWeight: 6, strokeOpacity: .9, clickable: true, zIndex: 12,
  }));
  for (const pin of priorityPins) {
    const visible = priorityColor(priorityAt(pin.road, hour)) === '#b52f27';
    pin.mapElement.hidden = !visible;
    if (pin.googleElement) pin.googleElement.hidden = !visible;
  }
  updateEdgeIndicators();
  if (selectedRoad && inIlhamArea(selectedRoad)) updateStreetPriority();
}

function updateStreetPriority() {
  const hour = Number(timeSlider.value);
  const factors = priorityFactors(selectedRoad, hour);
  const score = priorityAt(selectedRoad, hour);
  streetDetail.querySelector('[data-priority-score]').textContent = score.toFixed(2);
  streetDetail.querySelector('[data-priority-hour]').textContent = formatHour(hour);
  const rankedRoads = [...priorityRoads].sort((a, b) => priorityAt(b, hour) - priorityAt(a, hour));
  streetDetail.querySelector('[data-priority-rank]').textContent = `#${rankedRoads.indexOf(selectedRoad) + 1} of ${rankedRoads.length} streets`;
  streetDetail.querySelector('[data-walkers-factor]').textContent = factors.walkers.toFixed(2);
  streetDetail.querySelector('[data-walkers-detail]').textContent = `${factors.walkerCount}/h`;
  streetDetail.querySelector('[data-exposure-factor]').textContent = factors.exposure.toFixed(2);
  streetDetail.querySelector('[data-exposure-detail]').textContent = `${Math.round(factors.exposure * 100)}% at ${formatHour(hour)}`;
  streetDetail.querySelector('[data-vulnerable-factor]').textContent = factors.vulnerable.toFixed(2);
  streetDetail.querySelector('[data-vulnerable-detail]').textContent = selectedRoad.name === 'Jalan Elmina Ilham 3' ? 'school route' : 'resident routes';
  streetDetail.querySelector('[data-crossing-factor]').textContent = factors.crossing.toFixed(2);
  streetDetail.querySelector('[data-crossing-detail]').textContent = factors.crossingDistance ? `${factors.crossingDistance} m to crossing` : 'crossing gap';
}

function updateEdgeIndicators() {
  const width = mapPanel.clientWidth;
  const height = mapPanel.clientHeight;
  const inset = 24;
  if (width <= 2 * inset || height <= 2 * inset) return;
  for (const pin of priorityPins) {
    const red = priorityColor(priorityAt(pin.road, Number(timeSlider.value))) === '#b52f27';
    const point = satelliteActive ? pin.googlePoint : map.project(pin.position);
    const badge = pin.edgeElement;
    if (!red || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      badge.hidden = true;
      continue;
    }
    const offscreen = point.x < inset || point.x > width - inset
      || point.y < inset || point.y > height - inset;
    badge.hidden = !offscreen;
    if (!offscreen) continue;
    const dx = point.x - width / 2;
    const dy = point.y - height / 2;
    const scale = Math.min((width / 2 - inset) / Math.abs(dx || 1),
      (height / 2 - inset) / Math.abs(dy || 1));
    badge.style.left = `${width / 2 + dx * scale}px`;
    badge.style.top = `${height / 2 + dy * scale}px`;
  }
}

map.on('move', updateEdgeIndicators);
map.on('resize', updateEdgeIndicators);

function renderShadows() {
  const source = map.getSource('sun-shadows');
  if (!source) return;
  const shadows = [];
  const hour = Number(timeSlider.value);
  const shadowOpacity = hour === 7 || hour === 19 ? .5 : .76;
  if (sunToggle.checked && shadowBuildings.length) {
    const sun = sunPosition(sunDate, hour, 3.1894, 101.515);
    const endpoint = hour === 7 || hour === 19;
    if (sun.altitude > 0 || endpoint) {
      const projectedSun = endpoint ? { ...sun, altitude: Math.max(sun.altitude, 5) } : sun;
      for (const building of shadowBuildings) {
        const ring = buildingShadow(building.coordinates, buildingHeight, projectedSun)
          .map(([latitude, longitude]) => [longitude, latitude]);
        if (ring.length) shadows.push(feature(building, { type: 'Polygon', coordinates: [[...ring, ring[0]]] }));
      }
    }
  }
  source.setData(collection(shadows));
  map.setPaintProperty('sun-shadow-fill', 'fill-opacity', shadowOpacity);
  map.setLayoutProperty('sun-shadow-fill', 'visibility', sunToggle.checked ? 'visible' : 'none');
  for (const polygon of googleShadows) polygon.setMap(null);
  googleShadows = googleMap ? shadows.map(shadow => new google.maps.Polygon({
    map: googleMap,
    paths: shadow.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng })),
    strokeOpacity: 0,
    fillColor: '#344a54',
    fillOpacity: shadowOpacity,
    clickable: false,
    zIndex: 1,
  })) : [];
}

function streetCameraOffset() {
  if (streetDetail.hidden) return [0, 0];
  const compact = window.matchMedia('(max-width:700px)').matches;
  return compact ? [0, -streetDetail.offsetHeight / 2] : [-streetDetail.offsetWidth / 2, 0];
}

function focusStreet(position, minimumZoom = 16) {
  const offset = streetCameraOffset();
  if (satelliteActive && googleMap) {
    const zoom = Math.max(googleMap.getZoom(), minimumZoom);
    googleMap.setZoom(zoom);
    const target = new google.maps.LatLng(position[1], position[0]);
    const projection = googleMap.getProjection();
    if (!projection) return googleMap.panTo(target);
    const worldPoint = projection.fromLatLngToPoint(target);
    const scale = 2 ** zoom;
    googleMap.panTo(projection.fromPointToLatLng(new google.maps.Point(
      worldPoint.x - offset[0] / scale, worldPoint.y - offset[1] / scale)));
  } else map.easeTo({ center: position, offset,
    zoom: Math.max(map.getZoom(), minimumZoom), duration: 600 });
}

function hideStreetDetail(recenter = true) {
  streetDetail.hidden = true;
  selectedRoad = undefined;
  map.getSource('selected-road')?.setData(emptyCollection());
  if (googleSelection) googleSelection.setMap(null);
  googleSelection = undefined;
  if (recenter && selectedPosition) focusStreet(selectedPosition, 0);
  selectedPosition = undefined;
}

function showStreet(road, position = streetMidpoint([road]) || road.coordinates[Math.floor(road.coordinates.length / 2)]) {
  workspace?.close();
  loadStreetBudget(road);
  selectedRoad = road;
  selectedPosition = position;
  const priorityRoad = inIlhamArea(road);
  map.getSource('selected-road').setData(priorityRoad ? emptyCollection() : collection([feature(road,
    { type: 'LineString', coordinates: road.coordinates })]));
  if (googleSelection) googleSelection.setMap(null);
  if (googleMap && !priorityRoad) googleSelection = new google.maps.Polyline({
    map: googleMap, path: road.coordinates.map(([lng, lat]) => ({ lat, lng })),
    strokeColor: '#b55332', strokeWeight: 6, strokeOpacity: 1, zIndex: 20,
  });
  streetDetail.hidden = false;
  streetDetail.replaceChildren();
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'street-detail-close';
  close.setAttribute('aria-label', 'Close street details');
  close.textContent = '\u00d7';
  close.addEventListener('click', () => hideStreetDetail());
  const name = document.createElement('h2');
  name.textContent = road.name === 'Unnamed mapped way' ? 'Unnamed mapped street' : road.name;
  const type = document.createElement('p');
  type.className = 'street-type';
  type.textContent = road.kind.replaceAll('_', ' ');
  streetDetail.append(close, name, type);
  if (priorityRoad) {
    const formulaHour = document.createElement('p');
    formulaHour.className = 'street-formula-hour';
    formulaHour.innerHTML = 'Priority at <strong data-priority-hour></strong>';
    const formula = document.createElement('div');
    formula.className = 'street-formula';
    formula.setAttribute('role', 'group');
    formula.setAttribute('aria-label', 'Priority score calculation');
    formula.innerHTML = '<div class="formula-factors"><div class="formula-box formula-walkers"><span>Walkers</span><strong data-walkers-factor></strong><small data-walkers-detail></small></div><div class="formula-box formula-exposure"><span>In sun</span><strong data-exposure-factor></strong><small data-exposure-detail></small></div><div class="formula-box formula-vulnerable"><span>Kids / elderly</span><strong data-vulnerable-factor></strong><small data-vulnerable-detail></small></div><div class="formula-box formula-crossing"><span>No crossing</span><strong data-crossing-factor></strong><small data-crossing-detail></small></div></div><div class="formula-equation" aria-hidden="true">Multiply all four factors</div><div class="formula-box formula-score"><span>Priority score</span><strong data-priority-score></strong><small data-priority-rank></small></div><p class="formula-note">Each factor runs from 0 to 1. A street with no walkers scores 0.</p>';
    const budgetButton = document.createElement('button');
    budgetButton.type = 'button';
    budgetButton.className = 'street-budget-button';
    budgetButton.textContent = 'Set budget for changes';
    budgetButton.addEventListener('click', () => {
      budgetAmount.value = String(selectedBudget);
      budgetSlider.value = String(selectedBudget);
      budgetError.hidden = true;
      budgetDialog.showModal();
      budgetAmount.focus();
    });
    streetDetail.append(formulaHour, formula, budgetButton);
    updateStreetPriority();
  } else {
    const details = document.createElement('small');
    details.textContent = road.id;
    streetDetail.append(details);
  }
  focusStreet(position);
}

function setTilted(tilted) {
  if (satelliteActive) return;
  tiltToggle.setAttribute('aria-pressed', String(tilted));
  tiltToggle.textContent = tilted ? '2D view' : '2.5D view';
  map.easeTo({ pitch: tilted ? 55 : 0, bearing: tilted ? -15 : 0,
    ...(selectedPosition && !streetDetail.hidden
      ? { center: selectedPosition, offset: streetCameraOffset() } : {}), duration: 600 });
}

function setSatellite(active) {
  if (active && workspace?.isPlacing()) workspace.cancelPlacement();
  if (!googleMap) return;
  satelliteActive = active;
  satelliteToggle.checked = active;
  tiltToggle.disabled = active;
  tiltToggle.title = active ? 'Switch to Street map for the 2.5D view' : '';
  if (active) {
    satelliteMapElement.hidden = false;
    const center = map.getCenter();
    googleMap.setCenter({ lat: center.lat, lng: center.lng });
    googleMap.setZoom(Math.round(map.getZoom()));
    updateCentreCoordinates();
  } else {
    const center = googleMap.getCenter();
    map.jumpTo({ center: [center.lng(), center.lat()], zoom: googleMap.getZoom() });
    satelliteMapElement.hidden = true;
  }
  centreCoordinates.hidden = !active;
  if (selectedPosition && !streetDetail.hidden) focusStreet(selectedPosition, 0);
  updateEdgeIndicators();
}

function updateCentreCoordinates() {
  if (!googleMap) return;
  const center = googleMap.getCenter();
  if (center) centreValue.value = `${center.lat().toFixed(7)}, ${center.lng().toFixed(7)}`;
}

async function initSatellite(walkableRoads) {
  try {
    const response = await fetch('./v2-local-config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Local Google Maps key is unavailable');
    const { googleMapsKey } = await response.json();
    if (!googleMapsKey) throw new Error('Local Google Maps key is unavailable');
    satelliteToggle.disabled = false;
    satelliteToggle.addEventListener('change', async () => {
      if (!satelliteToggle.checked) return setSatellite(false);
      if (googleMap) return setSatellite(true);
      satelliteToggle.disabled = true;
      mapStatus.textContent = 'Loading satellite map…';
      mapStatus.hidden = false;
      try {
        await loadSatellite(googleMapsKey, walkableRoads);
        setSatellite(true);
        mapStatus.hidden = true;
      } catch (error) {
        console.error('Satellite view unavailable:', error);
        satelliteMapElement.hidden = true;
        satelliteToggle.checked = false;
        mapStatus.textContent = 'Satellite map could not load. Try the toggle again.';
      } finally {
        satelliteToggle.disabled = false;
      }
    });
  } catch (error) {
    console.warn('Satellite view unavailable:', error);
    satelliteToggle.title = 'Satellite view requires the local Google Maps key';
  }
}

async function loadSatellite(googleMapsKey, walkableRoads) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsKey)}&v=weekly`;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Google Maps could not load'));
      document.head.append(script);
    });
    satelliteMapElement.hidden = false;
    const center = map.getCenter();
    googleMap = new google.maps.Map(satelliteMapElement, {
      center: { lat: center.lat, lng: center.lng }, zoom: Math.round(map.getZoom()),
      mapTypeId: 'satellite', tilt: 0, disableDefaultUI: true,
      clickableIcons: false, gestureHandling: 'greedy',
    });
    googleMap.addListener('center_changed', updateCentreCoordinates);
    const roadFeatures = collection(walkableRoads.map(road => feature(road,
      { type: 'LineString', coordinates: road.coordinates }, { id: road.id })));
    googleMap.data.addGeoJson(roadFeatures);
    googleMap.data.setStyle({ strokeColor: '#17775f', strokeWeight: 2,
      strokeOpacity: .5, zIndex: 10 });
    const roadHits = new google.maps.Data({ map: googleMap });
    roadHits.addGeoJson(roadFeatures);
    roadHits.setStyle({ strokeColor: '#17775f', strokeWeight: 14,
      strokeOpacity: .01, zIndex: 11 });
    roadHits.addListener('click', event => {
      const road = walkableRoads.find(item => item.id === event.feature.getProperty('id'));
      if (road) showStreet(road);
    });
    googlePriorityLayer = new google.maps.Data({ map: googleMap });
    googlePriorityLayer.addGeoJson(collection(priorityRoads.map(road => feature(road,
      streetGeometry(road), { id: road.id }))));
    googlePriorityLayer.addListener('click', event => {
      const road = priorityRoadById.get(event.feature.getProperty('id'));
      if (road) showStreet(road);
    });
    const pedestrianLayer = new google.maps.Data({ map: googleMap });
    pedestrianLayer.addGeoJson(collection(mappedPedestrianRoads.map(road => feature(road,
      streetGeometry(road), { id: road.id }))));
    pedestrianLayer.setStyle({ strokeColor: '#146c8b', strokeWeight: 3,
      strokeOpacity: 1, zIndex: 13 });
    pedestrianLayer.addListener('click', event => {
      const road = priorityRoadById.get(event.feature.getProperty('id'));
      if (road) showStreet(road);
    });
    googleResidentRoutesLayer = new google.maps.Data({ map: googleMap });
    googleResidentRoutesLayer.addGeoJson(residentRoutes);
    googleResidentRoutesLayer.setStyle(feature => ({ strokeColor: '#8a35ae',
      strokeWeight: 2, strokeOpacity: feature.getProperty('routeType') === 'scramble' ? .48 : .72,
      clickable: false, zIndex: 15 }));
    const namedRoads = new Map();
    for (const road of priorityRoads) {
      if (road.name === 'Unnamed mapped way') continue;
      const previous = namedRoads.get(road.name);
      if (!previous || road.coordinates.length > previous.coordinates.length) namedRoads.set(road.name, road);
    }
    class StreetLabel extends google.maps.OverlayView {
      constructor(name, latitude, longitude) {
        super();
        this.name = name;
        this.position = new google.maps.LatLng(latitude, longitude);
        this.setMap(googleMap);
      }
      onAdd() {
        this.element = document.createElement('span');
        this.element.className = 'street-label google-street-label';
        this.element.textContent = this.name;
        this.getPanes().floatPane.appendChild(this.element);
      }
      draw() {
        const point = this.getProjection().fromLatLngToDivPixel(this.position);
        this.element.style.left = `${point.x}px`;
        this.element.style.top = `${point.y}px`;
        this.element.hidden = googleMap.getZoom() < 15;
      }
      onRemove() { this.element.remove(); }
    }
    for (const road of namedRoads.values()) {
      const line = streetGeometry(road).coordinates[0];
      const [lng, lat] = line[Math.floor(line.length / 2)];
      new StreetLabel(road.name, lat, lng);
    }
    class PriorityPin extends google.maps.OverlayView {
      constructor(entry) {
        super();
        this.entry = entry;
        this.position = new google.maps.LatLng(entry.position[1], entry.position[0]);
        this.setMap(googleMap);
      }
      onAdd() {
        this.element = createPriorityPin(this.entry.road.name);
        this.element.classList.add('google-priority-pin');
        this.element.addEventListener('click', event => {
          event.stopPropagation();
          showStreet(this.entry.road, this.entry.position);
        });
        this.element.hidden = priorityColor(priorityAt(this.entry.road, Number(timeSlider.value))) !== '#b52f27';
        this.entry.googleElement = this.element;
        this.getPanes().overlayMouseTarget.appendChild(this.element);
      }
      draw() {
        const point = this.getProjection().fromLatLngToDivPixel(this.position);
        this.element.style.left = `${point.x}px`;
        this.element.style.top = `${point.y}px`;
        this.entry.googlePoint = point;
        updateEdgeIndicators();
      }
      onRemove() {
        this.entry.googleElement = null;
        this.element.remove();
      }
    }
    for (const entry of priorityPins) new PriorityPin(entry);
    googleMap.addListener('bounds_changed', updateEdgeIndicators);
    for (const building of shadowBuildings) new google.maps.Polygon({
      map: googleMap,
      paths: building.coordinates.map(([lng, lat]) => ({ lat, lng })),
      strokeColor: '#284a36', strokeOpacity: .6, strokeWeight: .7,
      fillColor: '#8da992', fillOpacity: .14, clickable: false, zIndex: 2,
    });
    renderShadows();
    renderPriority();
    workspace?.syncGoogle(googleMap);
}

async function loadMap() {
  mapStatus.hidden = false;
  mapStatus.textContent = 'Loading Elmina map…';
  try {
    const [response, priorityResponse] = await Promise.all([
      fetch('./elmina-map.json'), fetch('./v2-ilham-roads.json'),
    ]);
    if (!response.ok || !priorityResponse.ok)
      throw new Error(`Map data request failed (${response.status}, ${priorityResponse.status})`);
    const [data, areaData] = await Promise.all([response.json(), priorityResponse.json()]);
    const frekuensiBlocks = data.buildings.filter(building => shadowBuildingIds.has(building.id));
    if (frekuensiBlocks.length !== shadowBuildingIds.size) throw new Error('Jalan Frekuensi building footprints are incomplete');
    const insetFrekuensiRoofs = frekuensiRoofs(frekuensiBlocks);
    if (insetFrekuensiRoofs.length !== frekuensiBlocks.length)
      throw new Error('Jalan Frekuensi roof outlines are incomplete');
    const areaMappedRoofs = [
      ...data.buildings.filter(building => !shadowBuildingIds.has(building.id)),
      ...insetFrekuensiRoofs,
    ];
    shadowBuildings = createAreaHouses(areaData.roads, areaMappedRoofs);
    const extractedRoadIds = new Set(areaData.roads.map(road => road.id));
    const olderMappedFootpaths = data.roads.filter(road =>
      ['footway', 'path'].includes(road.kind) && !extractedRoadIds.has(road.id));
    priorityRoads = [...areaData.roads, ...olderMappedFootpaths].filter(inIlhamArea);
    mappedPedestrianRoads = priorityRoads.filter(road =>
      ['footway', 'path'].includes(road.kind));
    residentRoutes = generateResidentRoutes(mappedPedestrianRoads, streetGeometry);
    ilhamRoad = priorityRoads.find(road => road.name === ilhamStreetName);
    priorityRoadById = new Map(priorityRoads.map(road => [road.id, road]));
    await mapReady;
    map.addLayer({ id: 'sky-tone-wash', type: 'background',
      paint: { 'background-color': '#ffffff', 'background-opacity': 0 } });

    map.addSource('sun-shadows', { type: 'geojson', data: emptyCollection() });
    map.addLayer({ id: 'sun-shadow-fill', type: 'fill', source: 'sun-shadows',
      paint: { 'fill-color': '#344a54', 'fill-opacity': .76 } });

    const areaMappedIds = new Set(shadowBuildings.filter(building => building.kind === 'mapped')
      .map(building => building.id.split('/home-')[0].replace(/\/roof$/, '')));
    const otherBuildings = data.buildings.filter(building => !areaMappedIds.has(building.id));
    map.addSource('other-buildings', { type: 'geojson', data: collection(otherBuildings.map(building =>
      feature(building, { type: 'Polygon', coordinates: [building.coordinates] }))) });
    map.addLayer({ id: 'other-building-fill', type: 'fill', source: 'other-buildings',
      paint: { 'fill-color': '#526c60', 'fill-opacity': .16 } });
    map.addSource('area-houses', { type: 'geojson', data: collection(shadowBuildings.map((building, index) =>
      feature(building, { type: 'Polygon', coordinates: [building.coordinates] }, { tone: index % 3 }))) });
    map.addLayer({ id: 'area-house-volumes', type: 'fill-extrusion', source: 'area-houses',
      paint: {
        'fill-extrusion-color': ['match', ['get', 'tone'], 0, '#a8b9aa', 1, '#b4c4b3', '#9eafa2'],
        'fill-extrusion-height': buildingHeight,
        'fill-extrusion-opacity': .94,
      } });
    map.addLayer({ id: 'area-house-outlines', type: 'line', source: 'area-houses',
      paint: { 'line-color': '#52725d', 'line-width': 1, 'line-opacity': .7 } });

    const walkableRoads = data.roads.filter(road => road.walkable);
    map.addSource('walkable-roads', { type: 'geojson', data: collection(walkableRoads.map(road =>
      feature(road, { type: 'LineString', coordinates: road.coordinates },
        { id: road.id, name: road.name, kind: road.kind }))) });
    map.addLayer({ id: 'walkable-road-lines', type: 'line', source: 'walkable-roads',
      paint: { 'line-color': '#17775f', 'line-width': 2, 'line-opacity': .55 } });
    map.addLayer({ id: 'walkable-road-hit', type: 'line', source: 'walkable-roads',
      paint: { 'line-color': '#17775f', 'line-width': 14, 'line-opacity': .01 } });
    map.addSource('street-priority', { type: 'geojson', data: emptyCollection() });
    map.addLayer({ id: 'street-priority-casing', type: 'line', source: 'street-priority',
      paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': .9 } });
    map.addLayer({ id: 'street-priority-lines', type: 'line', source: 'street-priority',
      paint: { 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': .9 } });
    map.addLayer({ id: 'street-priority-hit', type: 'line', source: 'street-priority',
      paint: { 'line-color': '#000', 'line-width': 16, 'line-opacity': .01 } });
    map.addSource('mapped-pedestrian-paths', { type: 'geojson',
      data: collection(mappedPedestrianRoads.map(road => feature(road,
        streetGeometry(road), { id: road.id }))) });
    map.addLayer({ id: 'mapped-pedestrian-path-lines', type: 'line',
      source: 'mapped-pedestrian-paths',
      paint: { 'line-color': '#146c8b', 'line-width': 2.5,
        'line-opacity': 1, 'line-dasharray': [1.5, 2] } });
    map.addSource('resident-routes', { type: 'geojson', data: residentRoutes });
    map.addLayer({ id: 'resident-routes-lines', type: 'line', source: 'resident-routes',
      paint: { 'line-color': '#8a35ae', 'line-width': 2,
        'line-opacity': ['case', ['==', ['get', 'routeType'], 'scramble'], .48, .72] } });
    const namedPriorityRoads = new Map();
    for (const road of priorityRoads) {
      if (road.name === 'Unnamed mapped way') continue;
      const previous = namedPriorityRoads.get(road.name);
      if (!previous || road.coordinates.length > previous.coordinates.length)
        namedPriorityRoads.set(road.name, road);
    }
    for (const road of namedPriorityRoads.values()) {
      const line = streetGeometry(road).coordinates[0];
      const label = document.createElement('span');
      label.className = 'street-label';
      label.textContent = road.name;
      streetLabelElements.push(label);
      new maplibregl.Marker({ element: label, anchor: 'center' })
        .setLngLat(line[Math.floor(line.length / 2)]).addTo(map);
    }
    const namedStreetGroups = new Map();
    for (const road of priorityRoads) {
      if (road.name === 'Unnamed mapped way') continue;
      if (!namedStreetGroups.has(road.name)) namedStreetGroups.set(road.name, []);
      namedStreetGroups.get(road.name).push(road);
    }
    for (const roads of namedStreetGroups.values()) {
      const position = streetMidpoint(roads);
      if (!position) continue;
      const mapElement = createPriorityPin(roads[0].name);
      mapElement.hidden = true;
      const edgeElement = document.createElement('button');
      edgeElement.type = 'button';
      edgeElement.className = 'priority-edge-indicator';
      edgeElement.textContent = '!';
      edgeElement.hidden = true;
      edgeElement.setAttribute('aria-label', `Show highest-priority street: ${roads[0].name}`);
      edgeElement.title = roads[0].name;
      edgeElement.addEventListener('click', () => {
        showStreet(roads[0], position);
      });
      edgeIndicators.append(edgeElement);
      priorityPins.push({ road: roads[0], position, mapElement, edgeElement, googleElement: null });
      mapElement.addEventListener('click', event => {
        event.stopPropagation();
        showStreet(roads[0], position);
      });
      new maplibregl.Marker({ element: mapElement, anchor: 'bottom' })
        .setLngLat(position).addTo(map);
    }
    map.on('zoomend', () => {
      for (const label of streetLabelElements) label.hidden = map.getZoom() < 15;
    });
    map.addSource('selected-road', { type: 'geojson', data: emptyCollection() });
    map.addLayer({ id: 'selected-road-line', type: 'line', source: 'selected-road',
      paint: { 'line-color': '#b55332', 'line-width': 6, 'line-opacity': 1 } });
    workspace = createWorkspace({ map, roads: priorityRoads, onOpen: () => {
      if (!streetDetail.hidden) hideStreetDetail(false);
    }, onEditPlan: roadId => {
      const road = priorityRoadById.get(roadId);
      if (!road) return;
      showStreet(road);
      streetDetail.querySelector('.street-budget-button')?.click();
    } });
    map.on('click', 'walkable-road-hit', event => {
      if (workspace.isPlacing()) return;
      if (map.queryRenderedFeatures(event.point, { layers: ['saved-change-points', 'saved-report-points'] }).length) return;
      const properties = event.features?.[0]?.properties;
      const road = walkableRoads.find(item => item.id === properties?.id);
      if (road) showStreet(road);
    });
    map.on('mouseenter', 'walkable-road-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'walkable-road-hit', () => { map.getCanvas().style.cursor = ''; });
    map.on('click', 'street-priority-hit', event => {
      if (workspace.isPlacing()) return;
      if (map.queryRenderedFeatures(event.point, { layers: ['saved-change-points', 'saved-report-points'] }).length) return;
      const road = priorityRoads.find(item => item.id === event.features?.[0]?.properties?.id);
      if (road) showStreet(road);
    });
    map.on('mouseenter', 'street-priority-hit', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'street-priority-hit', () => { map.getCanvas().style.cursor = ''; });
    ilhamCheckpoint.disabled = !ilhamRoad;
    map.jumpTo({ center: defaultCenter, zoom: defaultZoom, pitch: 0, bearing: 0 });
    for (const label of streetLabelElements) label.hidden = map.getZoom() < 15;
    renderShadows();
    renderPriority();
    renderSkyTone();
    mapStatus.hidden = true;
    await initSatellite(walkableRoads);
  } catch (error) {
    console.error(error);
    mapStatus.replaceChildren();
    const message = document.createElement('span');
    message.textContent = 'Mapped streets could not load. Check your connection and try again.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry';
    retry.onclick = loadMap;
    mapStatus.append(message, retry);
  }
}

frekuensiCheckpoint.addEventListener('click', () => {
  if (!streetDetail.hidden) hideStreetDetail(false);
  if (satelliteActive) googleMap.fitBounds({ west: frekuensiBounds[0][0], south: frekuensiBounds[0][1],
    east: frekuensiBounds[1][0], north: frekuensiBounds[1][1] }, 48);
  else map.fitBounds(frekuensiBounds, { padding: 48, maxZoom: 18 });
});
ilhamCheckpoint.addEventListener('click', () => {
  if (!ilhamRoad) return;
  if (!streetDetail.hidden) hideStreetDetail(false);
  if (satelliteActive) googleMap.fitBounds({ west: ilhamAreaBounds[0][0], south: ilhamAreaBounds[0][1],
    east: ilhamAreaBounds[1][0], north: ilhamAreaBounds[1][1] }, 36);
  else map.fitBounds(ilhamAreaBounds, { padding: 36, pitch: 0, bearing: 0 });
});
tiltToggle.addEventListener('click', () => setTilted(tiltToggle.getAttribute('aria-pressed') !== 'true'));
window.addEventListener('resize', () => {
  if (!streetDetail.hidden && selectedPosition) focusStreet(selectedPosition, 0);
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !streetDetail.hidden) hideStreetDetail();
});
timeSlider.addEventListener('input', updateTime);
budgetSlider.addEventListener('input', () => {
  budgetAmount.value = budgetSlider.value;
  budgetError.hidden = true;
});
budgetAmount.addEventListener('input', () => {
  const amount = Number(budgetAmount.value);
  if (amount >= 10000 && amount <= 300000) {
    budgetSlider.value = String(amount);
    budgetError.hidden = true;
  }
});
budgetForm.addEventListener('submit', event => {
  event.preventDefault();
  const amount = Number(budgetAmount.value);
  if (!Number.isInteger(amount) || amount < 10000 || amount > 300000) {
    budgetError.hidden = false;
    budgetAmount.focus();
    return;
  }
  selectedBudget = amount;
  try { localStorage.setItem(budgetStorageKey(selectedRoad), String(amount)); } catch { /* Keep this page's budget. */ }
  budgetDialog.close();
  openBudgetProcess();
});
function openBudgetProcess() {
  stopBudgetAnimation?.();
  budgetAnimationComplete = false;
  budgetProcessTitle.textContent = 'Preparing your budget';
  budgetProcessDescription.textContent = `${money(selectedBudget)} available for ${selectedRoad.name}`;
  budgetProcessProgress.hidden = false;
  budgetProcessPercent.hidden = false;
  budgetProcessAction.textContent = 'Skip animation';
  budgetProcess.hidden = false;
  budgetProcessAction.focus();
  stopBudgetAnimation = startBudgetAnimation(budgetProcessCanvas, percent => {
    budgetProcessProgress.setAttribute('aria-valuenow', String(percent));
    budgetProcessProgress.querySelector('span').style.transform = `scaleX(${percent / 100})`;
    budgetProcessPercent.textContent = `${percent}%`;
  }, finishBudgetProcess);
}
function finishBudgetProcess() {
  if (budgetAnimationComplete) return;
  budgetAnimationComplete = true;
  stopBudgetAnimation?.();
  budgetProcess.hidden = true;
  renderBudgetResult();
  budgetResult.hidden = false;
  document.getElementById('budget-result-close').focus();
}
budgetProcessAction.addEventListener('click', () => {
  if (!budgetAnimationComplete) {
    finishBudgetProcess();
  }
});
function renderBudgetResult() {
  const plan = planForBudget(selectedBudget);
  document.getElementById('budget-result-save').disabled = plan.included.length === 0;
  const previewButton = document.getElementById('budget-result-preview');
  previewButton.hidden = selectedRoad.name !== ilhamStreetName || plan.included.length === 0;
  const previewError = document.getElementById('budget-result-preview-error');
  previewError.textContent = '';
  previewError.hidden = true;
  const included = new Set(plan.included.map(item => item.id));
  document.getElementById('budget-result-street').textContent = selectedRoad.name;
  document.getElementById('budget-result-budget').textContent = money(selectedBudget);
  document.getElementById('budget-result-cost').textContent = money(plan.cost);
  document.getElementById('budget-result-remaining').textContent = money(plan.remaining);
  const message = document.getElementById('budget-result-message');
  message.textContent = !plan.cost
    ? `The first complete package starts at RM20,000. Increase the budget to include trees and site checks.`
    : plan.gap
      ? `${money(plan.gap)} more would cover the full ${money(fullPlanCost)} package. Items below show what this budget can fund together.`
      : `The full package fits. ${money(plan.remaining)} remains available for this street.`;
  document.getElementById('budget-result-tree-details').open = false;
  document.getElementById('budget-result-tree-heading').firstChild.textContent = included.has('trees')
    ? 'Tree planting mix ' : 'Tree planting mix for the next step ';
  const itemList = document.getElementById('budget-result-items');
  itemList.replaceChildren();
  for (const item of planItems) {
    const row = document.createElement('div');
    row.className = `budget-result-item${included.has(item.id) ? '' : ' is-pending'}`;
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const detail = document.createElement('p');
    detail.textContent = item.detail;
    copy.append(title, detail);
    const price = document.createElement('div');
    price.className = 'budget-result-item-price';
    const status = document.createElement('span');
    status.textContent = included.has(item.id) ? 'Included' : 'Next step';
    const amount = document.createElement('strong');
    amount.textContent = money(item.cost);
    price.append(status, amount);
    row.append(copy, price);
    itemList.append(row);
  }
  const treeList = document.getElementById('budget-result-trees');
  treeList.replaceChildren();
  for (const tree of treeMix) {
    const row = document.createElement('div');
    row.className = 'budget-result-tree';
    const identity = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = `${tree.count} × ${tree.name}`;
    const scientific = document.createElement('em');
    scientific.textContent = tree.scientific;
    const role = document.createElement('p');
    role.textContent = tree.role;
    identity.append(name, scientific, role);
    const reference = document.createElement('div');
    reference.className = 'budget-result-tree-price';
    const label = document.createElement('span');
    label.textContent = 'Published tree unit';
    const amount = document.createElement('strong');
    amount.textContent = `${money(tree.unit)} each`;
    reference.append(label, amount);
    row.append(identity, reference);
    treeList.append(row);
  }
  const treeNote = document.createElement('p');
  treeNote.className = 'budget-result-tree-note';
  treeNote.textContent = `Tree units total ${money(treeMix.reduce((sum, tree) => sum + tree.count * tree.unit, 0))}. The ${money(planItems[0].cost)} tree package also covers planting work and establishment.`;
  treeList.append(treeNote);
}
function closeBudgetResult() {
  budgetResult.hidden = true;
  streetDetail.querySelector('.street-budget-button')?.focus();
}
function enter3dPreview() {
  if (selectedRoad?.name !== ilhamStreetName) return;
  const url = new URL('./map-3d.html', location.href);
  url.searchParams.set('preview', 'ilham3');
  url.searchParams.set('budget', String(selectedBudget));
  budgetResult.hidden = true;
  location.assign(url.href);
}
document.getElementById('budget-result-close').addEventListener('click', closeBudgetResult);
document.getElementById('budget-result-map').addEventListener('click', closeBudgetResult);
document.getElementById('budget-result-preview').addEventListener('click', enter3dPreview);
document.getElementById('budget-result-save').addEventListener('click', () => {
  const error = document.getElementById('budget-result-preview-error');
  try {
    workspace.savePlan(selectedRoad, selectedBudget, planForBudget(selectedBudget));
    budgetResult.hidden = true;
  } catch (issue) {
    error.textContent = issue.message;
    error.hidden = false;
  }
});
document.getElementById('budget-result-adjust').addEventListener('click', () => {
  closeBudgetResult();
  streetDetail.querySelector('.street-budget-button')?.click();
});
budgetResult.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeBudgetResult();
  if (event.key !== 'Tab') return;
  const controls = [...budgetResult.querySelectorAll('button:not([hidden]),summary,a[href]')];
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});
budgetDialog.querySelectorAll('[data-close-budget]').forEach(button =>
  button.addEventListener('click', () => budgetDialog.close()));
sunToggle.addEventListener('change', renderShadows);
updateTime();
loadMap();

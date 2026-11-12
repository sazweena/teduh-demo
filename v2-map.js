import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';
import { sunPosition, buildingShadow } from './v2-sun.mjs';
import { frekuensiRoofs } from './v2-roofs.mjs';
import { createAreaHouses } from './v2-houses.mjs';
import { generateResidentRoutes } from './v2-resident-routes.mjs';
import { startBudgetAnimation } from './v2-budget-animation.mjs';
import { treeMix, fixedPlanOptions, fixedPlanForBudget } from './v2-street-plan.mjs';
import { inIlhamArea, streetGeometry, streetMidpoint, priorityFactors, priorityAt, priorityColor } from './v2-street-priority.mjs';
import { createWorkspace } from './v2-workspace.mjs';
import { mapConcerns } from './v2-report-references.mjs';
import { activityIssues, nextActivity } from './v2-activity.mjs';
import { walkingDestinations } from './v2-destinations.mjs';

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
const budgetPlanCount = document.getElementById('budget-plan-count');
const budgetPlanCountNumber = document.getElementById('budget-plan-count-number');
const budgetResult = document.getElementById('budget-result');
const mapPanel = document.querySelector('.map-panel');
const rankingList = document.getElementById('priority-ranking-list');
const rankingTime = document.getElementById('priority-ranking-time');
const edgeIndicators = document.getElementById('priority-edge-indicators');
const mapStatus = document.getElementById('map-status');
const activityToast = document.getElementById('activity-toast');
const activityToastMessage = document.getElementById('activity-toast-message');
const sunToggle = document.getElementById('sun-toggle');
const buildingHeight = 6;
const satelliteToggle = document.getElementById('satellite-toggle');
const destinationToggle = document.getElementById('destination-toggle');
const satelliteMapElement = document.getElementById('satellite-map');
const centreCoordinates = document.getElementById('map-centre-coordinates');
const centreValue = document.getElementById('map-centre-value');
const tiltToggle = document.getElementById('tilt-toggle');
const defaultCenter = [101.5183154, 3.1854984];
const defaultZoom = 17;
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
let googleMap;
let googleShadows = [];
let googleSelection;
let googlePriorityLayer;
let googleResidentRoutesLayer;
let googleDestinationInfo;
let streetDestinationInfo;
const destinationElements = [];
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
let selectedPlanId = null;
let stopBudgetAnimation;
let budgetAnimationComplete = false;
let budgetCounterFrame;
let budgetCounterTimeout;
let budgetRevealFrame;
let budgetResultRevealTimeout;
let workspace;
const activitySupport = new Map(mapConcerns.map(concern => [concern.roadName, concern.startingSupportCount || 0]));
const concernByRoad = new Map(mapConcerns.map(concern => [concern.roadName, concern]));
const reportCountByRoad = new Map();
const browserReportCountByRoad = new Map();
const browserSupportByRoad = new Map();
const browserConcernByRoad = new Map();
const seededReportLocationsByRoad = new Map();
const browserReportLocationsByRoad = new Map();
for (const concern of mapConcerns) {
  reportCountByRoad.set(concern.roadName, (reportCountByRoad.get(concern.roadName) || 0) + 1);
}
const supportLabel = count => `Support: ${count}`;
let activityToastTimeout;
let activityToastHideTimeout;
let activityToastEnterFrame;
let activitySoundContext;
const streetInputs = road => ({
  reportCount: (reportCountByRoad.get(road.name) || 0) + (browserReportCountByRoad.get(road.name) || 0),
  supportCount: (activitySupport.get(road.name) || 0) + (browserSupportByRoad.get(road.name) || 0),
  concernKind: browserConcernByRoad.get(road.name) || concernByRoad.get(road.name)?.kind || null,
  reportLocations: [
    ...(seededReportLocationsByRoad.get(road.name) || []),
    ...(browserReportLocationsByRoad.get(road.name) || []),
  ],
});
const streetPriority = (road, hour) => priorityAt(road, hour, streetInputs(road));
function updateBrowserReportSignals(reports) {
  browserReportCountByRoad.clear();
  browserSupportByRoad.clear();
  browserConcernByRoad.clear();
  browserReportLocationsByRoad.clear();
  for (const report of reports) {
    const name = report.road_name;
    if (!name) continue;
    browserReportCountByRoad.set(name, (browserReportCountByRoad.get(name) || 0) + 1);
    browserSupportByRoad.set(name, (browserSupportByRoad.get(name) || 0) + Math.max(0, Number(report.me_too_count) || 0));
    if (!browserConcernByRoad.has(name)) browserConcernByRoad.set(name, report.kind);
    if (Array.isArray(report.coordinates) && report.coordinates.length === 2
      && report.coordinates.every(Number.isFinite)) {
      if (!browserReportLocationsByRoad.has(name)) browserReportLocationsByRoad.set(name, []);
      browserReportLocationsByRoad.get(name).push(report.coordinates);
    }
  }
  renderPriority();
}
function playActivitySound() {
  if (!activitySoundContext || activitySoundContext.state !== 'running') return;
  const oscillator = activitySoundContext.createOscillator();
  const gain = activitySoundContext.createGain();
  const start = activitySoundContext.currentTime;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(660, start);
  oscillator.frequency.setValueAtTime(880, start + .08);
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(.07, start + .012);
  gain.gain.exponentialRampToValueAtTime(.0001, start + .18);
  oscillator.connect(gain).connect(activitySoundContext.destination);
  oscillator.start(start);
  oscillator.stop(start + .2);
}
function dismissActivityToast() {
  clearTimeout(activityToastTimeout);
  cancelAnimationFrame(activityToastEnterFrame);
  if (activityToast.hidden) return;
  activityToast.classList.remove('is-visible');
  activityToast.classList.add('is-leaving');
  clearTimeout(activityToastHideTimeout);
  activityToastHideTimeout = setTimeout(() => {
    activityToast.hidden = true;
    activityToast.classList.remove('is-leaving');
  }, 220);
}
document.getElementById('activity-toast-close').addEventListener('click', dismissActivityToast);
function armActivitySound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (AudioContext) {
    activitySoundContext ||= new AudioContext();
    activitySoundContext.resume().catch(() => {});
  }
}
document.addEventListener('pointerdown', armActivitySound, { once: true });
document.addEventListener('keydown', armActivitySound, { once: true });
function showActivityToast(name, concern) {
  clearTimeout(activityToastTimeout);
  clearTimeout(activityToastHideTimeout);
  cancelAnimationFrame(activityToastEnterFrame);
  activityToast.classList.remove('is-visible', 'is-leaving');
  const street = document.createElement('strong');
  street.className = 'activity-toast-street';
  street.textContent = concern.roadName;
  activityToastMessage.replaceChildren(
    document.createTextNode(`${name} raised the same concern about ${activityIssues[concern.kind] || 'the walking route'} on `),
    street,
    document.createTextNode('.'),
  );
  activityToast.hidden = false;
  activityToastEnterFrame = requestAnimationFrame(() => {
    activityToastEnterFrame = requestAnimationFrame(() => activityToast.classList.add('is-visible'));
  });
  playActivitySound();
  activityToastTimeout = setTimeout(dismissActivityToast, 5000);
}
function addIllustrativeActivity() {
  if (document.hidden || !priorityPins.length) return false;
  const available = mapConcerns.filter(concern => priorityPins.some(pin => pin.road.name === concern.roadName));
  const activity = nextActivity(available);
  if (!activity) return false;
  const roadName = activity.concern.roadName;
  activitySupport.set(roadName, (activitySupport.get(roadName) || 0) + 1);
  renderPriority();
  workspace?.refreshIllustrativeSupport();
  if (selectedRoad?.name === roadName) {
    const support = streetDetail.querySelector('[data-report-support]');
    if (support) support.textContent = supportLabel(activitySupport.get(roadName));
  }
  showActivityToast(activity.name, activity.concern);
  return true;
}
let activityCycleCount = 0;
function scheduleActivity(delay = 8000) {
  setTimeout(() => {
    if (addIllustrativeActivity()) {
      activityCycleCount++;
      if (activityCycleCount === 3) {
        activityCycleCount = 0;
        scheduleActivity(15000);
        return;
      }
    }
    scheduleActivity(8000);
  }, delay);
}
scheduleActivity();
const money = amount => `RM${amount.toLocaleString('en-MY')}`;
const budgetStorageKey = road => `teduh-v2-budget:${road.name === 'Unnamed mapped way' ? road.id : road.name}`;
function loadStreetBudget(road) {
  selectedBudget = 70000;
  selectedPlanId = null;
  try {
    const storedBudget = Number(localStorage.getItem(budgetStorageKey(road)));
    if (Number.isInteger(storedBudget) && storedBudget >= 10000 && storedBudget <= 300000) {
      selectedBudget = storedBudget;
    }
    selectedPlanId = localStorage.getItem(`teduh-v2-plan-option:${road.name}`);
  } catch { /* Browser storage may be unavailable. */ }
}

function createPriorityPin(name) {
  const report = mapConcerns.find(item => item.roadName === name);
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = `priority-pin-marker${report ? ' priority-pin-report' : ''}`;
  pin.setAttribute('aria-label', report ? `Open resident report on ${name}` : `Open details for highest-priority street: ${name}`);
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
      color: priorityColor(streetPriority(road, hour)) }))));
  if (googlePriorityLayer) googlePriorityLayer.setStyle(feature => ({
    strokeColor: priorityColor(streetPriority(priorityRoadById.get(feature.getProperty('id')), hour)),
    strokeWeight: 6, strokeOpacity: .9, clickable: true, zIndex: 12,
  }));
  for (const pin of priorityPins) {
    const visible = Boolean(pin.report);
    pin.mapElement.hidden = !visible;
    if (pin.googleElement) pin.googleElement.hidden = !visible;
  }
  renderRanking(hour);
  updateEdgeIndicators();
  if (selectedRoad && inIlhamArea(selectedRoad)) updateStreetPriority();
}

function updateStreetPriority() {
  const hour = Number(timeSlider.value);
  const inputs = streetInputs(selectedRoad);
  const factors = priorityFactors(selectedRoad, hour, inputs);
  const score = streetPriority(selectedRoad, hour);
  streetDetail.querySelector('[data-priority-score]').textContent = score.toFixed(2);
  streetDetail.querySelector('[data-priority-hour]').textContent = formatHour(hour);
  const rankedRoads = [...priorityRoads].sort((a, b) => streetPriority(b, hour) - streetPriority(a, hour));
  streetDetail.querySelector('[data-priority-rank]').textContent = `#${rankedRoads.indexOf(selectedRoad) + 1} of ${rankedRoads.length} streets`;
  streetDetail.querySelector('[data-walkers-factor]').textContent = factors.walkers.toFixed(2);
  streetDetail.querySelector('[data-walkers-detail]').textContent = `~${factors.walkerCount}/h · ${factors.reportCount} report${factors.reportCount === 1 ? '' : 's'} · ${factors.supportCount} support`;
  streetDetail.querySelector('[data-condition-label]').textContent = factors.conditionLabel;
  streetDetail.querySelector('[data-condition-factor]').textContent = factors.condition.toFixed(2);
  streetDetail.querySelector('[data-condition-detail]').textContent = inputs.concernKind === 'hot' || inputs.concernKind === 'dark'
    ? `at ${formatHour(hour)}` : 'street issue weight';
  streetDetail.querySelector('[data-destinations-factor]').textContent = factors.destinations.toFixed(2);
  streetDetail.querySelector('[data-destinations-detail]').textContent =
    `${factors.nearbyDestinations} within 1 km · nearest: ${factors.nearestDestination} (${Math.round(factors.nearestDestinationMetres)} m)`;
}

function destinationDetails(place) {
  const detail = document.createElement('div');
  detail.className = 'destination-detail';
  const category = document.createElement('small');
  category.textContent = place.category;
  const name = document.createElement('strong');
  name.textContent = place.name;
  const source = document.createElement('a');
  source.href = place.source;
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.textContent = 'View location on map';
  detail.append(category, name, source);
  return detail;
}

const destinationIconPaths = {
  'laman-nadi': '<path d="M3 10 5 4h14l2 6M3 10h18M4 10v10h16V10M8 20v-6h8v6M7 10v3m5-3v3m5-3v3"/>',
  'surau-elmina-gardens': '<path d="M4 20v-8c0-4 8-7 8-7s8 3 8 7v8M2 20h20M10 20v-5h4v5M12 2v3M4 12H2V7h2"/>',
  'my-health-clinic': '<path d="M4 20V5h16v15M2 20h20M9 20v-4h6v4M12 8v6M9 11h6"/>',
  'frekuensi-119-park': '<path d="M12 21v-6M8 21h8M12 3 5 13h4l-4 4h14l-4-4h4L12 3Z"/>',
  'frekuensi-118-park': '<path d="M12 21v-6M8 21h8M12 3 5 13h4l-4 4h14l-4-4h4L12 3Z"/>',
  'elmina-urban-park': '<path d="M12 21v-6M8 21h8M12 3 5 13h4l-4 4h14l-4-4h4L12 3Z"/>',
  'elmina-lakeside-mall': '<path d="M3 21h18M5 21V6l7-3 7 3v15M5 10h14M9 10v11m6-11v11M9 15h6"/>',
  'jaya-grocer': '<path d="M2 4h3l2 11h12l2-8H6M8 15l-1 3h13M10 21h.01M18 21h.01"/>',
};

function createDestinationMarker(place) {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = `destination-marker destination-${place.category.toLowerCase()}`;
  marker.title = place.name;
  marker.setAttribute('aria-label', `${place.name}, ${place.category}. Open place details`);
  marker.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${destinationIconPaths[place.id]}</svg>`;
  destinationElements.push(marker);
  return marker;
}

function openStreetDestination(place) {
  streetDestinationInfo?.remove();
  streetDestinationInfo = new maplibregl.Popup({ offset: 22, closeButton: true, maxWidth: '260px' })
    .setLngLat(place.coordinates).setDOMContent(destinationDetails(place)).addTo(map);
}

function updateDestinations() {
  for (const marker of destinationElements) marker.hidden = !destinationToggle.checked;
  if (!destinationToggle.checked) {
    streetDestinationInfo?.remove();
    googleDestinationInfo?.close();
  }
}
destinationToggle.addEventListener('change', updateDestinations);

function renderRanking(hour) {
  rankingTime.value = formatHour(hour);
  if (!priorityPins.length) return;
  const ranked = [...priorityPins].sort((a, b) =>
    streetPriority(b.road, hour) - streetPriority(a.road, hour) || a.road.name.localeCompare(b.road.name));
  const rows = document.createDocumentFragment();
  for (const [index, entry] of ranked.entries()) {
    const score = streetPriority(entry.road, hour);
    const row = document.createElement('li');
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'priority-ranking-row';
    open.setAttribute('aria-label', `Rank ${index + 1}: ${entry.road.name}, priority ${score.toFixed(2)}.${entry.report ? ' Resident report available.' : ''} View street`);
    const number = document.createElement('span');
    number.className = 'priority-ranking-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const details = document.createElement('span');
    details.className = 'priority-ranking-details';
    const name = document.createElement('span');
    name.className = 'priority-ranking-name';
    const nameText = document.createElement('span');
    nameText.textContent = entry.road.name;
    name.append(nameText);
    if (entry.report) {
      const reportAlert = document.createElement('span');
      reportAlert.className = 'priority-ranking-report-alert';
      reportAlert.textContent = '!';
      reportAlert.title = 'Resident report';
      reportAlert.setAttribute('aria-hidden', 'true');
      name.append(reportAlert);
    }
    const track = document.createElement('span');
    track.className = 'priority-ranking-track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'priority-ranking-fill';
    fill.style.width = `${Math.min(100, Math.max(0, score * 100))}%`;
    fill.style.backgroundColor = priorityColor(score);
    track.append(fill);
    details.append(name, track);
    const value = document.createElement('strong');
    value.className = 'priority-ranking-value';
    value.textContent = score.toFixed(2);
    open.append(number, details, value);
    open.addEventListener('click', () => showStreet(entry.road, entry.position));
    row.append(open);
    rows.append(row);
  }
  rankingList.replaceChildren(rows);
}

function updateEdgeIndicators() {
  const width = mapPanel.clientWidth;
  const height = mapPanel.clientHeight;
  const inset = 24;
  if (width <= 2 * inset || height <= 2 * inset) return;
  for (const pin of priorityPins) {
    const red = Boolean(pin.report);
    const point = satelliteActive ? pin.googlePoint : map.project(pin.position);
    const badge = pin.edgeElement;
    if (!red || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      badge.hidden = true;
      continue;
    }
    const offscreen = point.x < -18 || point.x > width + 18
      || point.y < 0 || point.y > height + 37;
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
    formula.innerHTML = '<div class="formula-factors"><div class="formula-box formula-walkers"><span>Walkers</span><strong data-walkers-factor></strong><small data-walkers-detail></small></div><div class="formula-box formula-condition"><span data-condition-label></span><strong data-condition-factor></strong><small data-condition-detail></small></div><div class="formula-box formula-destinations"><span>Walking hotspots</span><strong data-destinations-factor></strong><small data-destinations-detail></small></div></div><div class="formula-equation" aria-hidden="true">Multiply all three factors</div><div class="formula-box formula-score"><span>Priority score</span><strong data-priority-score></strong><small data-priority-rank></small></div><p class="formula-note">Each factor runs from 0 to 1.</p>';
    const report = mapConcerns.find(item => item.roadName === road.name);
    const reportCard = document.createElement('section');
    if (report) {
      reportCard.className = 'street-report-card';
      const heading = document.createElement('h3');
      heading.textContent = 'Resident report';
      const source = document.createElement('p');
      source.className = 'street-report-source';
      source.textContent = report.reporterName ? `Reported by ${report.reporterName}` : 'Reporter not recorded';
      const support = document.createElement('p');
      support.className = 'street-report-support';
      support.dataset.reportSupport = '';
      support.textContent = supportLabel(activitySupport.get(road.name) || 0);
      const note = document.createElement('p');
      note.textContent = report.note;
      reportCard.append(heading, source, support);
      if (report.referenceImage) {
        const figure = document.createElement('figure');
        figure.className = 'street-report-image';
        const image = document.createElement('img');
        image.src = report.referenceImage;
        image.alt = report.referenceAlt;
        image.loading = 'lazy';
        figure.append(image);
        reportCard.append(figure);
      }
      reportCard.append(note);
    }
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
    streetDetail.append(formulaHour, formula);
    if (report) streetDetail.append(reportCard);
    streetDetail.append(budgetButton);
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
        this.element.hidden = !this.entry.report;
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
    googleDestinationInfo = new google.maps.InfoWindow();
    class DestinationPin extends google.maps.OverlayView {
      constructor(place) {
        super();
        this.place = place;
        this.position = new google.maps.LatLng(place.coordinates[1], place.coordinates[0]);
        this.setMap(googleMap);
      }
      onAdd() {
        this.element = createDestinationMarker(this.place);
        this.element.classList.add('google-destination-marker');
        this.element.hidden = !destinationToggle.checked;
        this.element.addEventListener('click', event => {
          event.stopPropagation();
          googleDestinationInfo.setContent(destinationDetails(this.place));
          googleDestinationInfo.setPosition(this.position);
          googleDestinationInfo.open({ map: googleMap });
        });
        this.getPanes().overlayMouseTarget.appendChild(this.element);
      }
      draw() {
        const point = this.getProjection().fromLatLngToDivPixel(this.position);
        this.element.style.left = `${point.x}px`;
        this.element.style.top = `${point.y}px`;
      }
      onRemove() {
        this.element.remove();
        const index = destinationElements.indexOf(this.element);
        if (index !== -1) destinationElements.splice(index, 1);
      }
    }
    for (const place of walkingDestinations) new DestinationPin(place);
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
    priorityRoadById = new Map(priorityRoads.map(road => [road.id, road]));
    seededReportLocationsByRoad.clear();
    for (const concern of mapConcerns) {
      const point = concern.streetCenter || streetMidpoint(priorityRoads.filter(road => road.name === concern.roadName));
      if (point) seededReportLocationsByRoad.set(concern.roadName, [point]);
    }
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
      const report = mapConcerns.find(item => item.roadName === roads[0].name);
      const position = report?.streetCenter || streetMidpoint(roads);
      if (!position) continue;
      const mapElement = createPriorityPin(roads[0].name);
      mapElement.hidden = true;
      const edgeElement = document.createElement('button');
      edgeElement.type = 'button';
      edgeElement.className = 'priority-edge-indicator';
      if (report) {
        edgeElement.classList.add('priority-edge-report');
      }
      const edgeIcon = document.createElement('span');
      edgeIcon.textContent = '!';
      edgeIcon.setAttribute('aria-hidden', 'true');
      edgeElement.append(edgeIcon);
      edgeElement.hidden = true;
      edgeElement.setAttribute('aria-label', report ? `Show resident report on ${roads[0].name}` : `Show highest-priority street: ${roads[0].name}`);
      edgeElement.title = roads[0].name;
      edgeElement.addEventListener('click', () => {
        showStreet(roads[0], position);
      });
      edgeIndicators.append(edgeElement);
      priorityPins.push({ road: roads[0], report, position, mapElement, edgeElement, googleElement: null });
      mapElement.addEventListener('click', event => {
        event.stopPropagation();
        showStreet(roads[0], position);
      });
      new maplibregl.Marker({ element: mapElement, anchor: 'bottom' })
        .setLngLat(position).addTo(map);
    }
    for (const place of walkingDestinations) {
      const marker = createDestinationMarker(place);
      marker.addEventListener('click', event => {
        event.stopPropagation();
        openStreetDestination(place);
      });
      new maplibregl.Marker({ element: marker, anchor: 'bottom' })
        .setLngLat(place.coordinates).addTo(map);
    }
    map.on('zoomend', () => {
      for (const label of streetLabelElements) label.hidden = map.getZoom() < 15;
    });
    map.addSource('selected-road', { type: 'geojson', data: emptyCollection() });
    map.addLayer({ id: 'selected-road-line', type: 'line', source: 'selected-road',
      paint: { 'line-color': '#b55332', 'line-width': 6, 'line-opacity': 1 } });
    workspace = createWorkspace({ map, roads: priorityRoads, activitySupport,
      onReportsChange: updateBrowserReportSignals, onOpen: () => {
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

tiltToggle.addEventListener('click', () => setTilted(tiltToggle.getAttribute('aria-pressed') !== 'true'));
window.addEventListener('resize', () => {
  if (!streetDetail.hidden && selectedPosition) focusStreet(selectedPosition, 0);
});
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !streetDetail.hidden) hideStreetDetail();
});
timeSlider.addEventListener('input', updateTime);
const budgetSnapValue = 150000;
const budgetSnapDistance = 6000;
let budgetPointerSliding = false;
budgetSlider.addEventListener('pointerdown', () => { budgetPointerSliding = true; });
window.addEventListener('pointerup', () => { budgetPointerSliding = false; });
window.addEventListener('pointercancel', () => { budgetPointerSliding = false; });
budgetSlider.addEventListener('input', () => {
  if (budgetPointerSliding && Math.abs(Number(budgetSlider.value) - budgetSnapValue) <= budgetSnapDistance) {
    budgetSlider.value = String(budgetSnapValue);
  }
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
  cancelAnimationFrame(budgetCounterFrame);
  cancelAnimationFrame(budgetRevealFrame);
  clearTimeout(budgetCounterTimeout);
  clearTimeout(budgetResultRevealTimeout);
  budgetAnimationComplete = false;
  budgetProcessCanvas.style.visibility = '';
  budgetPlanCount.hidden = true;
  budgetPlanCount.style.transform = '';
  budgetPlanCount.style.opacity = '';
  budgetPlanCountNumber.textContent = '0';
  budgetResult.classList.remove('is-revealing');
  budgetResult.style.transform = '';
  budgetResult.style.pointerEvents = '';
  budgetResult.removeAttribute('aria-hidden');
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
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    showBudgetResult();
    return;
  }
  budgetProcessCanvas.style.visibility = 'hidden';
  budgetPlanCount.hidden = false;
  const planCount = fixedPlanOptions.length;
  const countDuration = 1050;
  let started;
  const count = now => {
    started ??= now;
    const progress = Math.min(1, (now - started) / countDuration);
    budgetPlanCountNumber.textContent = String(Math.min(planCount, Math.floor(progress * (planCount + 1))));
    if (progress < 1) budgetCounterFrame = requestAnimationFrame(count);
    else budgetCounterTimeout = setTimeout(startBudgetAutoReveal, 250);
  };
  budgetCounterFrame = requestAnimationFrame(count);
}
function startBudgetAutoReveal() {
  renderBudgetResult();
  budgetResult.scrollTop = 0;
  budgetResult.style.transform = 'translate3d(0, 100%, 0)';
  budgetResult.style.pointerEvents = 'none';
  budgetResult.setAttribute('aria-hidden', 'true');
  budgetResult.hidden = false;
  const duration = 2200;
  let started;
  const advance = now => {
    started ??= now;
    const t = Math.min(1, (now - started) / duration);
    const progress = t * t * (3 - 2 * t);
    const offset = progress * Math.max(0, window.innerHeight / 2 - (window.innerWidth < 600 ? 42 : 60));
    budgetPlanCount.style.transform = `translate(-50%, -50%) translateY(-${offset}px) scale(${1 - progress * .6})`;
    budgetPlanCount.style.opacity = String(Math.max(0, 1 - progress / .85));
    budgetResult.style.transform = `translate3d(0, ${(1 - progress) * 100}%, 0)`;
    if (t < 1) budgetRevealFrame = requestAnimationFrame(advance);
    else {
      budgetProcess.hidden = true;
      budgetResult.style.transform = '';
      budgetResult.style.pointerEvents = '';
      budgetResult.removeAttribute('aria-hidden');
      budgetResult.classList.add('is-revealing');
      budgetResultRevealTimeout = setTimeout(() => budgetResult.classList.remove('is-revealing'), 1100);
      document.getElementById('budget-result-close').focus();
    }
  };
  budgetRevealFrame = requestAnimationFrame(advance);
}
function showBudgetResult() {
  cancelAnimationFrame(budgetCounterFrame);
  cancelAnimationFrame(budgetRevealFrame);
  clearTimeout(budgetCounterTimeout);
  clearTimeout(budgetResultRevealTimeout);
  budgetAnimationComplete = true;
  stopBudgetAnimation?.();
  budgetProcess.hidden = true;
  renderBudgetResult();
  budgetResult.classList.remove('is-revealing');
  budgetResult.style.transform = '';
  budgetResult.style.pointerEvents = '';
  budgetResult.removeAttribute('aria-hidden');
  budgetResult.hidden = false;
  document.getElementById('budget-result-close').focus();
}
budgetProcessAction.addEventListener('click', () => {
  if (!budgetProcess.hidden) showBudgetResult();
});
function renderPlanOptions() {
  const options = document.getElementById('budget-plan-options');
  options.replaceChildren();
  const planImages = {
    a: './assets/plan-a-young-trees.webp',
    b: './assets/plan-b-shade-sails.webp',
    c: './assets/plan-c-shade-crossing.webp',
  };
  for (const [index, option] of fixedPlanOptions.entries()) {
    const available = option.cost <= selectedBudget;
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = `budget-plan-card${option.id === selectedPlanId ? ' is-selected' : ''}`;
    choice.disabled = !available;
    choice.setAttribute('aria-pressed', String(option.id === selectedPlanId));
    choice.dataset.planId = option.id;
    choice.style.setProperty('--plan-order', index);
    const visual = document.createElement('span');
    visual.className = `budget-plan-visual budget-plan-visual-${option.id}`;
    visual.setAttribute('aria-hidden', 'true');
    const photo = document.createElement('img');
    photo.src = planImages[option.id];
    photo.alt = '';
    photo.loading = 'lazy';
    visual.append(photo);
    choice.append(visual);
    for (const [className, value] of [
      ['budget-plan-label', `${option.label} · ${option.timing}`],
      ['budget-plan-title', option.title],
      ['budget-plan-cost', money(option.cost)],
      ['budget-plan-summary', option.summary],
      ['budget-plan-tradeoff', `Pro: ${option.pros}`],
      ['budget-plan-tradeoff', `Con: ${option.cons}`],
      ['budget-plan-state', available ? option.id === selectedPlanId ? 'Selected plan' : 'Choose this plan'
        : `${money(option.cost - selectedBudget)} above budget`],
    ]) {
      const line = document.createElement('span');
      line.className = className;
      line.textContent = value;
      choice.append(line);
    }
    choice.addEventListener('click', () => {
      selectedPlanId = option.id;
      try { localStorage.setItem(`teduh-v2-plan-option:${selectedRoad.name}`, option.id); } catch { /* Keep this page's choice. */ }
      renderBudgetResult();
      options.querySelector(`[data-plan-id="${option.id}"]`)?.focus();
    });
    options.append(choice);
  }
}
function renderBudgetResult() {
  document.getElementById('budget-result-title').textContent = `${fixedPlanOptions.length} proposed plans`;
  const affordable = fixedPlanOptions.filter(option => option.cost <= selectedBudget);
  if (!fixedPlanForBudget(selectedPlanId, selectedBudget)) selectedPlanId = affordable.at(-1)?.id || null;
  const plan = fixedPlanForBudget(selectedPlanId, selectedBudget);
  document.getElementById('budget-result-save').disabled = !plan;
  const previewButton = document.getElementById('budget-result-preview');
  previewButton.hidden = selectedRoad.name !== ilhamStreetName || !plan;
  const previewError = document.getElementById('budget-result-preview-error');
  previewError.textContent = '';
  previewError.hidden = true;
  document.getElementById('budget-result-street').textContent = selectedRoad.name;
  document.getElementById('budget-result-budget').textContent = money(selectedBudget);
  document.getElementById('budget-result-cost').textContent = money(plan?.cost || 0);
  document.getElementById('budget-result-remaining').textContent = money(plan?.remaining ?? selectedBudget);
  renderPlanOptions();
  const message = document.getElementById('budget-result-message');
  message.textContent = plan
    ? `${plan.label} uses ${money(plan.cost)}. ${money(plan.remaining)} remains available for this street.`
    : `The first plan needs ${money(fixedPlanOptions[0].cost)}. Increase the budget by ${money(fixedPlanOptions[0].cost - selectedBudget)} to choose it.`;
  const itemList = document.getElementById('budget-result-items');
  itemList.replaceChildren();
  for (const item of plan?.included || []) {
    const row = document.createElement('div');
    row.className = 'budget-result-item';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.title;
    const detail = document.createElement('p');
    detail.textContent = item.detail;
    copy.append(title, detail);
    const price = document.createElement('div');
    price.className = 'budget-result-item-price';
    const status = document.createElement('span');
    status.textContent = 'Included';
    const amount = document.createElement('strong');
    amount.textContent = money(item.cost);
    price.append(status, amount);
    row.append(copy, price);
    itemList.append(row);
  }
  const treeItem = plan?.included.find(item => item.id === 'trees');
  const treeDetails = document.getElementById('budget-result-tree-details');
  treeDetails.hidden = !treeItem;
  treeDetails.open = false;
  const treeList = document.getElementById('budget-result-trees');
  treeList.replaceChildren();
  if (!treeItem) return;
  document.getElementById('budget-result-tree-count').textContent = `${treeItem.count} trees`;
  document.getElementById('budget-result-tree-intro').textContent = treeItem.maturity === 'young'
    ? 'Young nursery trees establish before they provide broad canopy. The mix and positions need a verge and utility check.'
    : 'Larger nursery trees can provide earlier canopy, but still need establishment and a verge and utility check.';
  for (const tree of treeMix) {
    const row = document.createElement('div');
    row.className = 'budget-result-tree';
    const identity = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = `${tree.count * treeItem.count / 8} × ${tree.name}`;
    const scientific = document.createElement('em');
    scientific.textContent = tree.scientific;
    const role = document.createElement('p');
    role.textContent = tree.role;
    identity.append(name, scientific, role);
    row.append(identity);
    treeList.append(row);
  }
  const treeNote = document.createElement('p');
  treeNote.className = 'budget-result-tree-note';
  treeNote.textContent = `${money(treeItem.cost)} is the planning allowance for this tree package, including planting work and establishment.`;
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
  url.searchParams.set('plan', selectedPlanId);
  budgetResult.hidden = true;
  location.assign(url.href);
}
document.getElementById('budget-result-close').addEventListener('click', closeBudgetResult);
document.getElementById('budget-result-map').addEventListener('click', closeBudgetResult);
document.getElementById('budget-result-preview').addEventListener('click', enter3dPreview);
const proposalSavedDialog = document.getElementById('proposal-saved-dialog');
proposalSavedDialog.addEventListener('cancel', () => {
  requestAnimationFrame(() => streetDetail.querySelector('.street-budget-button')?.focus());
});
document.getElementById('proposal-saved-view').addEventListener('click', () => {
  proposalSavedDialog.close();
  document.getElementById('changes-tab').click();
});
document.getElementById('proposal-saved-close').addEventListener('click', () => {
  proposalSavedDialog.close();
  streetDetail.querySelector('.street-budget-button')?.focus();
});
document.getElementById('budget-result-save').addEventListener('click', () => {
  const error = document.getElementById('budget-result-preview-error');
  try {
    const plan = fixedPlanForBudget(selectedPlanId, selectedBudget);
    if (!plan) throw Error('Choose a plan that fits this budget.');
    const saved = workspace.savePlan(selectedRoad, selectedBudget, plan);
    budgetResult.hidden = true;
    document.getElementById('proposal-saved-title').textContent = `Proposal #${saved.number} saved`;
    document.getElementById('proposal-saved-description').textContent =
      `${saved.label} for ${saved.roadName} is saved in Proposed changes on this browser.`;
    proposalSavedDialog.showModal();
    document.getElementById('proposal-saved-view').focus();
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

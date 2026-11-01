import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';
import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';

const $ = id => document.getElementById(id);
const center = [101.50761, 3.18264];
const cameraCenter = [101.5124245, 3.176809];
const bounds = [[101.495, 3.175], [101.518, 3.190]];
const names = { tree: 'Tree', sail: 'Shade sail', crossing: 'Raised crossing', light: 'Street light' };
const colors = { tree: '#287a51', sail: '#cc813d', crossing: '#b65745', light: '#416d9a' };
const status = message => { $('status').textContent = message; $('status').hidden = false; };
function showDetail(title, description) {
  const heading = document.createElement('strong');
  const text = document.createElement('span');
  heading.textContent = title;
  text.textContent = description;
  $('detail').replaceChildren(heading, text);
}
const collection = features => ({ type: 'FeatureCollection', features });
const feature = (id, geometry, properties = {}) => ({ type: 'Feature', id, geometry, properties });
let proposals = [];
let reports = [];
let buildings = [];
let map;
let objects;

function objectFor(item) {
  const group = new THREE.Group();
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .9, side: THREE.DoubleSide });
  const mesh = (geometry, color, x = 0, y = 0, z = 0) => {
    const part = new THREE.Mesh(geometry, material(color));
    part.position.set(x, y, z);
    group.add(part);
    return part;
  };
  if (item.kind === 'tree') {
    const trunk = mesh(new THREE.CylinderGeometry(.19, .27, 3.1, 8), '#795f42', 0, 0, 1.55);
    trunk.rotation.x = Math.PI / 2;
    for (const [x, y, z, radius] of [[0, 0, 4.0, 1.7], [-.8, .3, 3.5, 1.25], [.8, -.2, 3.6, 1.25]]) {
      mesh(new THREE.IcosahedronGeometry(radius, 1), '#378b58', x, y, z);
    }
  } else if (item.kind === 'sail') {
    for (const [x, y] of [[-3, -2], [3, -2], [0, 3]]) {
      const pole = mesh(new THREE.CylinderGeometry(.08, .08, 3.7, 6), '#606b68', x, y, 1.85);
      pole.rotation.x = Math.PI / 2;
    }
    const canopy = new THREE.BufferGeometry();
    canopy.setAttribute('position', new THREE.Float32BufferAttribute([-3,-2,3.7, 3,-2,3.7, 0,3,3.7], 3));
    canopy.computeVertexNormals();
    mesh(canopy, '#dfaa65');
  } else if (item.kind === 'crossing') {
    mesh(new THREE.BoxGeometry(7, 5, .25), '#8a9690', 0, 0, .13);
    for (let x = -2.6; x <= 2.6; x += 1.3) mesh(new THREE.BoxGeometry(.6, 4.2, .03), '#fff9e7', x, 0, .27);
  } else if (item.kind === 'light') {
    const pole = mesh(new THREE.CylinderGeometry(.08, .13, 6, 8), '#4a5d63', 0, 0, 3);
    pole.rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(1.5, .42, .2), '#f8e6a4', .7, 0, 5.95);
  }
  return group;
}

function inBuilding(point) {
  return buildings.some(building => {
    let inside = false;
    const ring = building.coordinates;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > point[1]) !== (b[1] > point[1]) &&
          point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  });
}

function makeObjectsLayer() {
  const origin = maplibregl.MercatorCoordinate.fromLngLat(center, 0);
  const scale = origin.meterInMercatorCoordinateUnits();
  return {
    id: 'teduh-objects', type: 'custom', renderingMode: '3d',
    onAdd(currentMap, gl) {
      this.scene = new THREE.Scene();
      this.camera = new THREE.Camera();
      this.renderer = new THREE.WebGLRenderer({ canvas: currentMap.getCanvas(), context: gl, antialias: true });
      this.renderer.autoClear = false;
      this.scene.add(new THREE.AmbientLight('#ffffff', 2));
      const sun = new THREE.DirectionalLight('#fff3d3', 2.5);
      sun.position.set(-80, 30, 120);
      this.scene.add(sun);
      this.setItems = items => {
        for (const child of [...this.scene.children]) if (child.userData.fix) {
          this.scene.remove(child);
          child.traverse(part => {
            part.geometry?.dispose();
            part.material?.dispose();
          });
        }
        for (const item of items) {
          if (!names[item.kind] || !Array.isArray(item.coordinates)) continue;
          const point = maplibregl.MercatorCoordinate.fromLngLat(item.coordinates, 0);
          const model = objectFor(item);
          model.userData.fix = true;
          model.position.set((point.x - origin.x) / scale, (origin.y - point.y) / scale, 0);
          this.scene.add(model);
        }
        currentMap.triggerRepaint();
      };
      this.setItems(proposals);
    },
    render(gl, options) {
      const transform = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z)
        .scale(new THREE.Vector3(scale, -scale, scale));
      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(options.defaultProjectionData.mainMatrix).multiply(transform);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    },
    onRemove() { this.setItems([]); this.renderer?.dispose(); },
  };
}

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) throw Error(`${path} unavailable`);
  return response.json();
}

function renderRecords() {
  const points = proposals.filter(item => names[item.kind] && Array.isArray(item.coordinates));
  map.getSource('fixes').setData(collection(points.map(item => feature(item.id,
    { type: 'Point', coordinates: item.coordinates }, { kind: item.kind, status: item.status || 'proposed' }))));
  map.getSource('reports').setData(collection(reports.filter(item => Array.isArray(item.coordinates)).map(item => feature(item.id,
    { type: 'Point', coordinates: item.coordinates }, { kind: item.kind, status: item.status, road: item.road_name || 'Elmina City Centre' }))));
  objects?.setItems($('fixesToggle').checked ? proposals : []);
  $('fitFixes').disabled = points.length === 0;
  const selected = $('fixSelect').value;
  $('fixSelect').replaceChildren(new Option('Choose a fix', ''), ...points.map((item, index) =>
    new Option(`${index + 1}. ${names[item.kind]}${inBuilding(item.coordinates) ? ' · check location' : ''}`, item.id)));
  if (points.some(item => item.id === selected)) $('fixSelect').value = selected;
  const conflicts = points.filter(item => inBuilding(item.coordinates)).length;
  $('detail').textContent = points.length === 0
    ? 'No fixes saved here yet. Use the 2D map to place a proposed fix.'
    : conflicts ? `${conflicts} saved fix locations overlap mapped building footprints. Check them on the 2D map.`
      : 'Choose a fix or report to inspect its location.';
}

async function refreshRecords() {
  try {
    const [fixData, reportData] = await Promise.all([api('/api/proposals'), api('/api/reports')]);
    proposals = fixData.proposals;
    reports = reportData.reports;
    renderRecords();
    $('status').hidden = true;
  } catch (error) {
    console.error(error);
    status('Planning records could not load. Refresh the page to retry.');
  }
}

async function init() {
  const response = await fetch('./elmina-map.json');
  if (!response.ok) throw Error('Elmina map data unavailable');
  const data = await response.json();
  buildings = data.buildings;
  map = new maplibregl.Map({
    container: 'map', style: 'https://tiles.openfreemap.org/styles/bright',
    center: cameraCenter, zoom: 19.2, pitch: 62, bearing: -22, maxPitch: 80,
    canvasContextAttributes: { antialias: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  map.on('error', error => { console.warn('Map tile error:', error.error); status('The map could not load. Check your connection or use the 2D map.'); });
  await map.once('load');

  const roads = collection(data.roads.filter(road => road.walkable).map(road => feature(road.id,
    { type: 'LineString', coordinates: road.coordinates }, { name: road.name })));
  map.addSource('walks', { type: 'geojson', data: roads });
  map.addLayer({ id: 'walks', type: 'line', source: 'walks', paint: {
    'line-color': '#287a51', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 6], 'line-opacity': .85,
  } });

  map.addSource('openfreemap-buildings', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
  const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
  map.addLayer({ id: 'mapped-buildings', type: 'fill-extrusion', source: 'openfreemap-buildings',
    'source-layer': 'building', minzoom: 15, filter: ['>', ['get', 'render_height'], 0],
    paint: { 'fill-extrusion-color': '#c5c9ba', 'fill-extrusion-height': ['get', 'render_height'],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': .87 },
  }, firstLabel);

  map.addSource('fixes', { type: 'geojson', data: collection([]) });
  map.addSource('reports', { type: 'geojson', data: collection([]) });
  objects = makeObjectsLayer();
  map.addLayer(objects, firstLabel);
  map.addLayer({ id: 'fix-hit', type: 'circle', source: 'fixes', paint: {
    'circle-radius': 15, 'circle-color': '#ffffff', 'circle-opacity': .01,
  } });
  map.addLayer({ id: 'report-points', type: 'circle', source: 'reports', paint: {
    'circle-radius': 7, 'circle-color': '#b65745', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff',
  } });
  map.on('click', 'fix-hit', event => {
    const item = proposals.find(fix => fix.id === event.features?.[0]?.id);
    if (!item) return;
    showDetail(names[item.kind], inBuilding(item.coordinates) ? 'Location overlaps a mapped building footprint. Check placement on the 2D map.'
      : `${item.status || 'Proposed'} · ${Number(item.coordinates[1]).toFixed(5)}, ${Number(item.coordinates[0]).toFixed(5)}`);
  });
  map.on('click', 'report-points', event => {
    const item = reports.find(report => report.id === event.features?.[0]?.id);
    if (!item) return;
    showDetail('Resident report', `${item.status || 'Received'} · ${item.coordinates[1].toFixed(5)}, ${item.coordinates[0].toFixed(5)}`);
  });
  for (const id of ['fix-hit', 'report-points']) {
    map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
  }
  $('fitArea').onclick = () => map.fitBounds(bounds, { padding: 60, maxZoom: 16.5 });
  $('fitFixes').onclick = () => {
    const positions = proposals.filter(item => names[item.kind]).map(item => item.coordinates);
    if (positions.length) map.fitBounds(positions.reduce((box, point) => box.extend(point),
      new maplibregl.LngLatBounds(positions[0], positions[0])), { padding: 90, maxZoom: 17.5 });
  };
  $('fixSelect').onchange = event => {
    const item = proposals.find(fix => fix.id === event.target.value);
    if (!item) return;
    map.easeTo({ center: item.coordinates, zoom: 20, pitch: 65,
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650 });
    showDetail(names[item.kind], inBuilding(item.coordinates) ? 'Location overlaps a mapped building footprint. Check placement on the 2D map.'
      : `${item.status || 'Proposed'} · ${Number(item.coordinates[1]).toFixed(5)}, ${Number(item.coordinates[0]).toFixed(5)}`);
  };
  $('resetCamera').onclick = () => map.easeTo({ center: cameraCenter, zoom: 19.2, pitch: 62, bearing: -22 });
  $('fixesToggle').onchange = event => {
    map.setLayoutProperty('fix-hit', 'visibility', event.target.checked ? 'visible' : 'none');
    objects.setItems(event.target.checked ? proposals : []);
  };
  $('walksToggle').onchange = event => map.setLayoutProperty('walks', 'visibility', event.target.checked ? 'visible' : 'none');
  $('reportsToggle').onchange = event => map.setLayoutProperty('report-points', 'visibility', event.target.checked ? 'visible' : 'none');
  await refreshRecords();
  window.addEventListener('storage', event => { if (event.key === 'teduh-team-local-v1') refreshRecords(); });
  window.addEventListener('focus', refreshRecords);
  setInterval(refreshRecords, 20_000);
}

init().catch(error => { console.error(error); status('3D view unavailable. Check your connection or use the 2D map.'); });

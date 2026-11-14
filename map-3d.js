import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';
import * as THREE from 'three';
import { GLTFLoader } from 'https://unpkg.com/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { budgetMin, budgetMax, defaultBudget, planForBudget, fixedPlanForBudget } from './v2-street-plan.mjs';
import { frekuensiRoofs } from './v2-roofs.mjs';
import { createAreaHouses } from './v2-houses.mjs';

const $ = id => document.getElementById(id);
const center = [101.50761, 3.18264];
const previewMode = new URLSearchParams(location.search).get('preview') === 'ilham3';
const requestedBudget = Number(new URLSearchParams(location.search).get('budget'));
const previewBudget = Number.isFinite(requestedBudget) && requestedBudget >= budgetMin && requestedBudget <= budgetMax ? requestedBudget : defaultBudget;
const requestedPlan = new URLSearchParams(location.search).get('plan');
const previewHousePosition = [101.51837, 3.18566];
const cameraCenter = previewMode ? previewHousePosition : [101.5124245, 3.176809];
const names = { tree: 'Tree', sail: 'Shade sail', crossing: 'Raised crossing', light: 'Street light' };
const colors = { tree: '#287a51', sail: '#cc813d', crossing: '#b65745', light: '#416d9a' };
const modeledHouseIds = ['way/1287603109', 'way/1287603110', 'way/1287603111', 'way/1287603113', 'way/1287603112'];
const frekuensiBuildingIds = new Set(Array.from({ length: 16 }, (_, index) => `way/${912252060 + index}`));
const status = message => { $('status').textContent = message; $('status').hidden = false; };
function showDetail(title, description) { status(`${title}: ${description}`); }
const collection = features => ({ type: 'FeatureCollection', features });
const feature = (id, geometry, properties = {}) => ({ type: 'Feature', id, geometry, properties });
let proposals = [];
let reports = [];
let buildings = [];
let previewRoad;
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
  if (item.kind === 'tree' && item.maturity === 'young') group.scale.setScalar(.65);
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

function makeObjectsLayer(houses) {
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
      const loader = new GLTFLoader();
      const placementAt = coordinates => {
        const point = maplibregl.MercatorCoordinate.fromLngLat(coordinates, 0);
        const placement = new THREE.Group();
        placement.rotation.z = Math.PI; // The selected terrace row faces south.
        placement.position.set((point.x - origin.x) / scale, (origin.y - point.y) / scale, 0);
        this.scene.add(placement);
        return placement;
      };
      const addModel = (asset, placement, widthScale, depthScale = 1, x = 0, y = 0, z = 0) => {
        const model = asset.scene.clone(true);
        model.rotation.x = Math.PI / 2; // GLB Y-up to the map layer's Z-up coordinates.
        model.scale.set(widthScale, 1, depthScale);
        model.position.set(x, y, z);
        placement.add(model);
        return model;
      };
      Promise.all(['end', 'intermediate'].map(type => loader.loadAsync(`./assets/models/elmina-house/elmina-${type}.glb`)))
        .then(([end, intermediate]) => {
          if (!this.renderer) return;
          for (const house of houses) {
            addModel(house.end ? end : intermediate, placementAt(house.coordinates),
              house.width / 6.149, house.depth / 16.175);
          }
          currentMap.triggerRepaint();
        }).catch(error => { console.error('Elmina house models could not load:', error); });
      Promise.all(['plain', 'tree-ready', 'sideyard-3m'].map(type =>
        loader.loadAsync(`./assets/models/elmina-streets/elmina-sidewalk-${type}.glb`)))
        .then(([plain, treeReady, sideyard]) => {
          if (!this.renderer) return;
          houses.forEach((house, index) => {
            const placement = placementAt(house.coordinates);
            const widthScale = house.width / 6.1;
            addModel(index % 2 === 0 ? treeReady : plain, placement,
              widthScale, 1, 0, 8 * house.depth / 16.175);
            if (house.end) addModel(sideyard, placement, house.width / 6.149, 1,
              house.width / 2 + 1.5 * house.width / 6.149, 8 * house.depth / 16.175);
          });
          currentMap.triggerRepaint();
        }).catch(error => { console.error('Elmina sidewalks could not load:', error); });
      loader.loadAsync('./assets/models/elmina-streets/elmina-road-straight.glb')
        .then(road => {
          if (!this.renderer) return;
          const vergeMaterial = new THREE.MeshStandardMaterial({ color: '#a7b494', roughness: 1 });
          const drivewayMaterial = new THREE.MeshStandardMaterial({ color: '#b4b4aa', roughness: 1 });
          const addRoad = (placement, house, x = 0) => {
            const model = addModel(road, placement, house.width / 6.1, 1, x, 0, .02);
            model.traverse(part => {
              if (!part.isMesh) return;
              part.material = part.material.clone();
              part.material.color.multiplyScalar(3);
            });
          };
          for (const house of houses) {
            const roadPlacement = placementAt(house.roadCoordinates);
            addRoad(roadPlacement, house);
            if (house.end) addRoad(roadPlacement, house, house.width);
            const housePoint = maplibregl.MercatorCoordinate.fromLngLat(house.coordinates, 0);
            const roadPoint = maplibregl.MercatorCoordinate.fromLngLat(house.roadCoordinates, 0);
            const sidewalkFront = 8 * house.depth / 16.175 + 3;
            const gap = (roadPoint.y - housePoint.y) / scale - 3 - sidewalkFront;
            if (gap <= 0) continue;
            const vergePlacement = placementAt(house.coordinates);
            const verge = new THREE.Mesh(new THREE.PlaneGeometry(house.width, gap), vergeMaterial);
            verge.position.set(0, sidewalkFront + gap / 2, .012);
            vergePlacement.add(verge);
            const driveway = new THREE.Mesh(new THREE.PlaneGeometry(3.2 * house.width / 6.149, gap), drivewayMaterial);
            driveway.position.set(-.05 * house.width / 6.149, sidewalkFront + gap / 2, .018);
            vergePlacement.add(driveway);
            if (house.end) {
              const yardWidth = 3 * house.width / 6.149;
              const yardVerge = new THREE.Mesh(new THREE.PlaneGeometry(yardWidth, gap), vergeMaterial);
              yardVerge.position.set(house.width / 2 + yardWidth / 2, sidewalkFront + gap / 2, .012);
              vergePlacement.add(yardVerge);
            }
          }
          currentMap.triggerRepaint();
        }).catch(error => { console.error('Elmina road could not load:', error); });
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
    onRemove() { this.setItems([]); this.renderer?.dispose(); this.renderer = null; },
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
  objects?.setItems(proposals);
}

async function refreshRecords() {
  if (previewMode) {
    const plan = requestedPlan ? fixedPlanForBudget(requestedPlan, previewBudget) : planForBudget(previewBudget);
    if (!plan) { status('This plan does not fit the selected budget. Return to the map and choose another plan.'); return; }
    const treeItem = plan.included.find(item => item.id === 'trees');
    const sailItem = plan.included.find(item => item.id === 'sail');
    const hasCrossing = plan.included.some(item => item.id === 'crossing');
    const start = previewRoad.coordinates[0], end = previewRoad.coordinates.at(-1);
    const along = (fraction, north = 0) => [
      start[0] + (end[0] - start[0]) * fraction,
      start[1] + (end[1] - start[1]) * fraction + north,
    ];
    proposals = [
      ...Array.from({ length: treeItem?.count || 0 }, (_, index) => ({
        id: `preview-tree-${index}`, kind: 'tree', status: 'proposed',
        maturity: treeItem.maturity,
        coordinates: along((index + 1) / (treeItem.count + 1), .00007),
      })),
      ...Array.from({ length: sailItem?.count || 0 }, (_, index) => ({
        id: `preview-sail-${index}`, kind: 'sail', status: 'proposed',
        coordinates: along((index + 1) / ((sailItem?.count || 0) + 1), .00007),
      })),
      ...(hasCrossing ? [{ id: 'preview-crossing', kind: 'crossing', status: 'proposed', coordinates: along(.65) }] : []),
    ];
    reports = [];
    renderRecords();
    $('status').hidden = true;
    return;
  }
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
  const [response, areaResponse] = await Promise.all([
    fetch('./elmina-map.json'), fetch('./v2-ilham-roads.json'),
  ]);
  if (!response.ok || !areaResponse.ok) throw Error('Elmina map data unavailable');
  const [data, areaData] = await Promise.all([response.json(), areaResponse.json()]);
  buildings = data.buildings;
  const frekuensiBlocks = buildings.filter(building => frekuensiBuildingIds.has(building.id));
  const mappedRoofs = [
    ...buildings.filter(building => !frekuensiBuildingIds.has(building.id)),
    ...frekuensiRoofs(frekuensiBlocks),
  ];
  const areaHouses = createAreaHouses(areaData.roads, mappedRoofs).filter(house => {
    if (modeledHouseIds.some(id => house.id === id || house.id.startsWith(`${id}/`))) return false;
    if (!previewMode) return true;
    const corners = house.coordinates.slice(0, -1);
    const midpoint = [corners.reduce((sum, point) => sum + point[0], 0) / corners.length,
      corners.reduce((sum, point) => sum + point[1], 0) / corners.length];
    // Keep the modeled preview house clear of the approximate terrace units.
    return Math.hypot((midpoint[0] - previewHousePosition[0]) * 111170,
      (midpoint[1] - previewHousePosition[1]) * 110574) >= 9;
  });
  if (previewMode) {
    previewRoad = data.roads.find(road => road.name === 'Jalan Elmina Ilham 3');
    if (!previewRoad) throw Error('Jalan Elmina Ilham 3 is unavailable');
    $('returnToV2').hidden = false;
    document.querySelectorAll('.legacy-action').forEach(link => { link.hidden = true; });
    $('returnToV2').addEventListener('click', event => {
      if (document.referrer && new URL(document.referrer).origin === location.origin &&
          new URL(document.referrer).pathname.endsWith('/v2-map.html')) {
        event.preventDefault();
        history.back();
      }
    });
  }
  const featuredRoad = data.roads.find(road => road.id === 'way/910003507');
  if (!featuredRoad) throw Error('Mapped Jalan Metafasa U16/163 unavailable');
  const roadLatitude = longitude => {
    const points = featuredRoad.coordinates;
    for (let index = 1; index < points.length; index++) {
      const [a, b] = [points[index - 1], points[index]];
      if (longitude >= Math.min(a[0], b[0]) && longitude <= Math.max(a[0], b[0]))
        return a[1] + (longitude - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
    }
    return points[0][1];
  };
  const houses = previewMode ? [{ end: false, coordinates: previewHousePosition,
    width: 6.149, depth: 16.175, roadCoordinates: [previewHousePosition[0], 3.18550] }] : modeledHouseIds.map((id, index) => {
    const building = buildings.find(item => item.id === id);
    if (!building) throw Error(`Mapped house ${id} unavailable`);
    const ring = building.coordinates.slice(0, -1);
    const west = Math.min(...ring.map(point => point[0]));
    const east = Math.max(...ring.map(point => point[0]));
    const south = Math.min(...ring.map(point => point[1]));
    const north = Math.max(...ring.map(point => point[1]));
    const midpoint = (north + south) / 2;
    const longitude = (east + west) / 2;
    return { end: index === 0, coordinates: [longitude, midpoint],
      width: (east - west) * 111320 * Math.cos(midpoint * Math.PI / 180), depth: (north - south) * 111320 };
  });
  const rowLongitude = houses.reduce((sum, house) => sum + house.coordinates[0], 0) / houses.length;
  // Anchor the short straight strip to the mapped centerline without gaps between modules.
  if (!previewMode) {
    for (const house of houses) house.roadCoordinates = [house.coordinates[0], roadLatitude(rowLongitude)];
  }
  map = new maplibregl.Map({
    container: 'map', style: 'https://tiles.openfreemap.org/styles/bright',
    center: cameraCenter, zoom: previewMode ? 19.7 : 19.2,
    pitch: previewMode ? 0 : 62, bearing: previewMode ? 0 : -22, maxPitch: 80,
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

  const firstLabel = map.getStyle().layers.find(layer => layer.type === 'symbol')?.id;
  const areaMappedIds = new Set(areaHouses.filter(house => house.kind === 'mapped')
    .map(house => house.id.split('/home-')[0].replace(/\/roof$/, '')));
  const plainBuildings = data.buildings.filter(building =>
    !modeledHouseIds.includes(building.id) && !areaMappedIds.has(building.id))
    .map(building => feature(building.id, { type: 'Polygon', coordinates: [building.coordinates] }));
  map.addSource('mapped-buildings', { type: 'geojson', data: collection(plainBuildings) });
  map.addLayer({ id: 'mapped-buildings', type: 'fill-extrusion', source: 'mapped-buildings', minzoom: 15,
    paint: { 'fill-extrusion-color': '#c5c9ba', 'fill-extrusion-height': 5, 'fill-extrusion-opacity': .87 },
  }, firstLabel);
  map.addSource('ilham-houses', { type: 'geojson', data: collection(areaHouses.map(house =>
    feature(house.id, { type: 'Polygon', coordinates: [house.coordinates] }))) });
  map.addLayer({ id: 'ilham-houses', type: 'fill-extrusion', source: 'ilham-houses', minzoom: 15,
    paint: { 'fill-extrusion-color': '#c5c9ba', 'fill-extrusion-height': 6, 'fill-extrusion-opacity': .93 },
  }, firstLabel);

  map.addSource('fixes', { type: 'geojson', data: collection([]) });
  map.addSource('reports', { type: 'geojson', data: collection([]) });
  objects = makeObjectsLayer(houses);
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
  await refreshRecords();
  if (previewMode) {
    map.easeTo({ pitch: 62, bearing: -24,
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 850 });
  } else {
    window.addEventListener('storage', event => { if (event.key === 'teduh-team-local-v1') refreshRecords(); });
    window.addEventListener('focus', refreshRecords);
    setInterval(refreshRecords, 20_000);
  }
}

init().catch(error => { console.error(error); status('3D view unavailable. Check your connection or use the 2D map.'); });

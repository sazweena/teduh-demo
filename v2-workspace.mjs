import { ilhamAreaBounds, streetGeometry } from './v2-street-priority.mjs';
import { legacyReports } from './v2-report-references.mjs';
import { planForBudget } from './v2-street-plan.mjs';

const planKey = 'teduh-v2-plans-v1';
const legacyReportKey = 'teduh-v2-legacy-report-updates-v1';
const frekuensiPlanSeedKey = 'teduh-v2-frekuensi-plan-seeded-v1';
const statuses = ['Received', 'Seen', 'Planned', 'Built'];
const kinds = { hot: 'Too hot / no shade', cross: 'Unsafe crossing', dark: 'Too dark', broken: 'Broken path' };
const money = value => `RM${Number(value).toLocaleString('en-MY')}`;
const collection = features => ({ type: 'FeatureCollection', features });
const pointFeature = (item, properties = {}) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: item.coordinates }, properties });
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
const button = (label, action, className = '') => {
  const element = node('button', className, label);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
};

export function pointAlongRoad(road, fraction) {
  const segments = streetGeometry(road).coordinates.flatMap(line => line.slice(1).map((end, index) => [line[index], end]));
  const lengths = segments.map(([a, b]) => Math.hypot((b[0] - a[0]) * 111170, (b[1] - a[1]) * 110574));
  let remaining = lengths.reduce((sum, length) => sum + length, 0) * fraction;
  for (let index = 0; index < segments.length; index++) {
    if (remaining <= lengths[index] || index === segments.length - 1) {
      const [a, b] = segments[index];
      const t = lengths[index] ? Math.min(1, remaining / lengths[index]) : 0;
      return a.map((value, axis) => Number((value + (b[axis] - value) * t).toFixed(7)));
    }
    remaining -= lengths[index];
  }
  return road.coordinates[Math.floor(road.coordinates.length / 2)];
}

export function buildSavedPlan(road, budget, plan, previous) {
  const placed = new Map((previous?.items || []).map(item => [item.id, item]));
  const works = plan.included.filter(item => item.id !== 'site');
  return {
    id: previous?.id || crypto.randomUUID(), roadId: road.id, roadName: road.name,
    budget, cost: plan.cost, updatedAt: new Date().toISOString(),
    items: plan.included.map(item => {
      const old = placed.get(item.id);
      const fraction = (works.findIndex(work => work.id === item.id) + 1) / (works.length + 1);
      return { id: item.id, title: item.title, cost: item.cost,
        status: old?.status || 'Proposed',
        coordinates: item.id === 'site' ? null : old?.coordinates || pointAlongRoad(road, fraction),
        locationReviewed: item.id === 'site' ? false : Boolean(old?.locationReviewed) };
    }),
  };
}

export function createWorkspace({ map, roads = [], onOpen, onEditPlan }) {
  const panel = document.getElementById('workspace-panel');
  const content = document.getElementById('workspace-panel-content');
  const title = document.getElementById('workspace-panel-title');
  const changesTab = document.getElementById('changes-tab');
  const reportsTab = document.getElementById('reports-tab');
  const changesCount = document.getElementById('changes-count');
  const reportsCount = document.getElementById('reports-count');
  let plans = [];
  let reports = [];
  let reportsState = 'loading';
  let reportsError = '';
  let active = null;
  let selectedReport = null;
  let selectedChange = null;
  let filter = 'All';
  let placing = null;
  let googleMap = null;
  let googleChanges = null;
  let googleReports = null;

  function loadPlans() {
    try {
      const value = JSON.parse(localStorage.getItem(planKey) || '[]');
      plans = Array.isArray(value) ? value.filter(plan => plan && Array.isArray(plan.items)) : [];
    } catch { plans = []; }
    renderChangesMap();
    changesCount.textContent = String(plans.reduce((sum, plan) => sum + plan.items.filter(item => item.coordinates).length, 0));
    if (active === 'changes') render();
  }
  function seedFrekuensiPlan() {
    if (localStorage.getItem(frekuensiPlanSeedKey)) return;
    const road = roads.find(item => item.id === 'way/499335112' && item.name === 'Jalan Frekuensi U16/120');
    if (!road) return;
    const existing = JSON.parse(localStorage.getItem(planKey) || '[]');
    if (!Array.isArray(existing)) return;
    if (!existing.some(item => item.roadName === road.name)) {
      existing.push(buildSavedPlan(road, 110000, planForBudget(110000)));
      localStorage.setItem(planKey, JSON.stringify(existing));
      const budgetKey = `teduh-v2-budget:${road.name}`;
      if (localStorage.getItem(budgetKey) === null) localStorage.setItem(budgetKey, '110000');
    }
    localStorage.setItem(frekuensiPlanSeedKey, '1');
  }
  function loadLegacyReports() {
    let updates = {};
    try { updates = JSON.parse(localStorage.getItem(legacyReportKey) || '{}') || {}; } catch { /* Use original entries. */ }
    return legacyReports(updates);
  }
  function writePlans() {
    localStorage.setItem(planKey, JSON.stringify(plans));
    loadPlans();
  }
  function setPanel(view) {
    if (placing) cancelPlacement();
    const previousView = active;
    active = view;
    panel.hidden = !view;
    changesTab.setAttribute('aria-pressed', String(view === 'changes'));
    reportsTab.setAttribute('aria-pressed', String(view === 'reports'));
    if (view) {
      onOpen();
      render();
      panel.querySelector('#workspace-panel-close').focus();
    } else if (previousView) (previousView === 'changes' ? changesTab : reportsTab).focus();
  }
  function message(text, error = false) {
    const line = node('p', error ? 'workspace-error' : 'workspace-note', text);
    line.setAttribute('role', error ? 'alert' : 'status');
    content.prepend(line);
  }
  function focus(coordinates) {
    if (!coordinates) return;
    if (googleMap && !document.getElementById('satellite-map').hidden) {
      googleMap.panTo({ lng: coordinates[0], lat: coordinates[1] });
      googleMap.setZoom(Math.max(googleMap.getZoom() || 16, 18));
    } else map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 18) });
  }
  function renderChangesMap() {
    const features = plans.flatMap(plan => plan.items.filter(item => item.coordinates).map(item =>
      pointFeature(item, { planId: plan.id, itemId: item.id, kind: item.id, reviewed: item.locationReviewed })));
    map.getSource('saved-changes')?.setData(collection(features));
    if (googleChanges) {
      googleChanges.forEach(feature => googleChanges.remove(feature));
      googleChanges.addGeoJson(collection(features));
    }
  }
  function renderReportsMap() {
    const features = reports.filter(item => !item.legacy && Array.isArray(item.coordinates)).map(item =>
      pointFeature(item, { id: item.id, kind: item.kind }));
    map.getSource('saved-reports')?.setData(collection(features));
    if (googleReports) {
      googleReports.forEach(feature => googleReports.remove(feature));
      googleReports.addGeoJson(collection(features));
    }
    reportsCount.textContent = String(reports.filter(item => item.status !== 'Built').length);
  }
  async function refreshReports() {
    if (reportsState !== 'ready') reportsState = 'loading';
    if (active === 'reports' && (!selectedReport || !panel.contains(document.activeElement))) render();
    try {
      const response = await fetch('/api/reports');
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.reports)) throw Error(body.error || 'Reports could not load');
      reports = [...body.reports, ...loadLegacyReports()];
      reportsState = 'ready';
      reportsError = '';
      renderReportsMap();
    } catch (error) {
      reportsState = 'error';
      reportsError = error.message;
    }
    if (active === 'reports' && (!selectedReport || !panel.contains(document.activeElement))) render();
  }
  async function saveReport(report, status, reply, saveButton) {
    saveButton.disabled = true;
    try {
      if (report.legacy) {
        const updates = JSON.parse(localStorage.getItem(legacyReportKey) || '{}');
        updates[report.id.slice(8)] = { status, reply };
        localStorage.setItem(legacyReportKey, JSON.stringify(updates));
        reports = reports.map(item => item.id === report.id ? { ...item, status, reply } : item);
        renderReportsMap();
        render();
        message('Report update saved in this browser.');
        return;
      }
      const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reply }),
      });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Could not save this report');
      await refreshReports();
      render();
      message('Report updated in this browser.');
    } catch (error) {
      saveButton.disabled = false;
      message(error.message, true);
    }
  }
  function renderReportDetail(report) {
    content.append(button('Back to reports', () => {
      selectedReport = null; render(); content.querySelector('button')?.focus();
    }, 'workspace-back'));
    content.append(node('h3', '', kinds[report.kind] || 'Resident report'));
    content.append(node('p', 'workspace-muted', report.legacy
      ? `${report.road_name} · Earlier planner entry`
      : `${report.road_name || 'Elmina City Centre'} · ${new Date(report.created_at).toLocaleString('en-MY')}`));
    if (report.illustration) {
      const image = node('img', 'workspace-photo');
      image.src = report.illustration;
      image.alt = report.illustrationAlt;
      content.append(image, node('p', 'workspace-muted', 'Generated illustration, not a resident photo.'));
    }
    if (report.photo && /^data:image\/(jpeg|png|webp);base64,/.test(report.photo)) {
      const photo = node('img', 'workspace-photo');
      photo.alt = 'Photo attached to resident report';
      photo.src = report.photo;
      content.append(photo);
    }
    content.append(node('p', 'workspace-report-note', report.note || 'No details added.'));
    content.append(node('p', 'workspace-muted', report.legacy
      ? 'Issue carried over from the earlier planner. Its location and details need confirmation.'
      : `${report.me_too_count || 0} neighbours added support · ${report.source || 'Web form'}`));
    if (report.coordinates) content.append(button(report.legacy ? 'View street on map' : 'View on map',
      () => focus(report.coordinates), 'workspace-secondary'));
    const statusLabel = node('label', 'workspace-label', 'Status');
    const select = node('select', 'workspace-field');
    for (const value of statuses) {
      const option = node('option', '', value);
      option.value = value;
      select.append(option);
    }
    select.value = report.status;
    statusLabel.append(select);
    const replyLabel = node('label', 'workspace-label', report.legacy ? 'Team note' : 'Reply to resident');
    const reply = node('textarea', 'workspace-field');
    reply.maxLength = 800;
    reply.rows = 4;
    reply.value = report.reply || '';
    replyLabel.append(reply);
    const save = button('Save report update', () => saveReport(report, select.value, reply.value.trim(), save), 'workspace-primary');
    content.append(statusLabel, replyLabel, save);
    content.append(node('p', 'workspace-muted', report.legacy
      ? 'Status and team note are stored in this browser.'
      : 'Status and reply are stored in this browser. Residents using another device cannot see them.'));
  }
  function renderReports() {
    const report = reports.find(item => item.id === selectedReport);
    if (report) return renderReportDetail(report);
    if (reportsState === 'loading') return content.append(node('p', 'workspace-muted', 'Loading reports…'));
    if (reportsState === 'error') {
      content.append(node('p', 'workspace-error', reportsError));
      content.append(button('Retry', refreshReports, 'workspace-secondary'));
      return;
    }
    const tabs = node('div', 'workspace-filters');
    for (const value of ['All', ...statuses]) {
      const tab = button(value, () => {
        filter = value; render();
        [...content.querySelectorAll('.workspace-filters button')].find(item => item.textContent === value)?.focus();
      });
      tab.setAttribute('aria-pressed', String(filter === value));
      tabs.append(tab);
    }
    content.append(tabs);
    const visible = reports.filter(item => filter === 'All' || item.status === filter);
    if (!visible.length) {
      content.append(node('p', 'workspace-muted', reports.length ? 'No reports with this status.' : 'No resident reports in this browser yet.'));
      return;
    }
    const list = node('div', 'workspace-list');
    for (const item of visible) {
      const card = button('', () => { selectedReport = item.id; render(); if (!item.legacy) focus(item.coordinates); },
        item.illustration ? 'workspace-list-button workspace-report-with-image' : 'workspace-list-button');
      if (item.illustration) {
        const image = node('img', 'workspace-reference-image');
        image.src = item.illustration;
        image.alt = '';
        card.append(image);
      }
      card.append(node('strong', '', kinds[item.kind] || 'Resident report'));
      card.append(node('span', '', item.road_name || 'Elmina City Centre'));
      card.append(node('small', '', item.legacy
        ? `${item.status} · Earlier planner · Generated illustration`
        : `${item.status} · ${item.me_too_count || 0} Me too`));
      list.append(card);
    }
    content.append(list);
  }
  function cancelPlacement() {
    placing = null;
    map.getCanvas().style.cursor = '';
    render();
  }
  function renderChangeDetail(plan, item) {
    content.append(button('Back to proposed changes', () => {
      selectedChange = null; render(); content.querySelector('button')?.focus();
    }, 'workspace-back'));
    content.append(node('h3', '', item.title));
    content.append(node('p', 'workspace-muted', `${plan.roadName} · ${money(item.cost)} planning allowance`));
    if (item.coordinates) {
      content.append(node('p', 'workspace-muted', item.locationReviewed
        ? 'Location reviewed in this browser.' : 'Suggested position on the mapped street. Review the exact site before use.'));
      content.append(button('View on map', () => focus(item.coordinates), 'workspace-secondary'));
      const place = button('Set location on map', () => {
        placing = { planId: plan.id, itemId: item.id };
        map.getCanvas().style.cursor = 'crosshair';
        message('Click the street map to set this location.');
      }, 'workspace-secondary');
      if (googleMap && !document.getElementById('satellite-map').hidden) {
        place.disabled = true;
        content.append(node('p', 'workspace-muted', 'Switch to Street map to set a location.'));
      }
      content.append(place);
      if (placing) content.append(button('Cancel location change', cancelPlacement, 'workspace-secondary'));
    } else content.append(node('p', 'workspace-muted', 'Site checks cover the street and do not need a map pin.'));
    const statusLabel = node('label', 'workspace-label', 'Status');
    const select = node('select', 'workspace-field');
    for (const value of ['Proposed', 'Planned', 'Built']) {
      const option = node('option', '', value);
      option.value = value;
      select.append(option);
    }
    select.value = item.status;
    statusLabel.append(select);
    content.append(statusLabel, button('Save status', () => {
      item.status = select.value;
      try { writePlans(); message('Change updated in this browser.'); }
      catch (error) { message(`Could not save change: ${error.message}`, true); }
    }, 'workspace-primary'));
  }
  function renderChanges() {
    const selected = plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
      .find(entry => `${entry.plan.id}:${entry.item.id}` === selectedChange);
    if (selected) return renderChangeDetail(selected.plan, selected.item);
    if (!plans.length) {
      content.append(node('p', 'workspace-empty', 'No proposed changes saved yet. Select a mapped street, set a budget, then save its plan.'));
      return;
    }
    for (const plan of plans) {
      const section = node('section', 'workspace-plan');
      section.append(node('h3', '', plan.roadName));
      section.append(node('p', 'workspace-muted', `${money(plan.cost)} included · ${money(plan.budget)} budget`));
      section.append(button('View on map', () => focus(plan.items.find(item => item.coordinates)?.coordinates), 'workspace-secondary'));
      section.append(button('Adjust budget', () => onEditPlan(plan.roadId), 'workspace-secondary'));
      section.append(button('Remove plan', () => {
        const confirmation = node('div', 'workspace-confirm');
        confirmation.append(node('p', 'workspace-muted', `Remove the saved changes for ${plan.roadName}?`));
        confirmation.append(button('Cancel', () => confirmation.remove(), 'workspace-secondary'));
        confirmation.append(button('Remove saved plan', () => {
          const remaining = plans.filter(item => item.id !== plan.id);
          try { plans = remaining; selectedChange = null; writePlans(); }
          catch (error) { message(`Could not remove plan: ${error.message}`, true); }
        }, 'workspace-danger'));
        section.append(confirmation);
      }, 'workspace-secondary'));
      const list = node('div', 'workspace-list');
      for (const item of plan.items) {
        const card = button('', () => { selectedChange = `${plan.id}:${item.id}`; render(); focus(item.coordinates); }, 'workspace-list-button');
        card.append(node('strong', '', item.title));
        card.append(node('small', '', `${money(item.cost)} · ${item.status}${item.coordinates && !item.locationReviewed ? ' · Review location' : ''}`));
        list.append(card);
      }
      section.append(list);
      content.append(section);
    }
  }
  function render() {
    if (!active) return;
    title.textContent = active === 'changes' ? 'Proposed changes' : 'Reports';
    content.replaceChildren();
    if (active === 'changes') renderChanges();
    else renderReports();
  }
  function savePlan(road, budget, plan) {
    if (!plan.included.length) throw Error('Increase the budget to include a complete package.');
    const previous = plans.find(item => item.roadName === road.name);
    const saved = buildSavedPlan(road, budget, plan, previous);
    plans = [...plans.filter(item => item.id !== previous?.id), saved];
    writePlans();
    selectedChange = null;
    setPanel('changes');
  }
  function syncGoogle(nextMap) {
    googleMap = nextMap;
    googleChanges = new google.maps.Data({ map: googleMap });
    googleReports = new google.maps.Data({ map: googleMap });
    googleChanges.setStyle(feature => ({ icon: { path: google.maps.SymbolPath.CIRCLE,
      scale: 8, fillColor: feature.getProperty('reviewed') ? '#0b715c' : '#bb701f',
      fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }, zIndex: 24 }));
    googleReports.setStyle({ icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7,
      fillColor: '#b55332', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }, zIndex: 25 });
    googleChanges.addListener('click', event => {
      selectedChange = `${event.feature.getProperty('planId')}:${event.feature.getProperty('itemId')}`;
      setPanel('changes');
    });
    googleReports.addListener('click', event => {
      selectedReport = event.feature.getProperty('id');
      setPanel('reports');
    });
    renderChangesMap();
    renderReportsMap();
  }

  map.addSource('saved-changes', { type: 'geojson', data: collection([]) });
  map.addLayer({ id: 'saved-change-points', type: 'circle', source: 'saved-changes', paint: {
    'circle-radius': 9, 'circle-color': ['case', ['get', 'reviewed'], '#0b715c', '#bb701f'],
    'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
  map.addSource('saved-reports', { type: 'geojson', data: collection([]) });
  map.addLayer({ id: 'saved-report-points', type: 'circle', source: 'saved-reports', paint: {
    'circle-radius': 8, 'circle-color': '#b55332', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
  map.on('click', 'saved-change-points', event => {
    if (placing) return;
    const properties = event.features?.[0]?.properties;
    if (!properties) return;
    selectedChange = `${properties.planId}:${properties.itemId}`;
    setPanel('changes');
  });
  map.on('click', 'saved-report-points', event => {
    if (placing) return;
    selectedReport = event.features?.[0]?.properties?.id;
    setPanel('reports');
  });
  map.on('click', event => {
    if (!placing) return;
    const { lng, lat } = event.lngLat;
    if (lng < ilhamAreaBounds[0][0] || lng > ilhamAreaBounds[1][0] ||
        lat < ilhamAreaBounds[0][1] || lat > ilhamAreaBounds[1][1]) {
      message('Choose a location inside the mapped Ilham and Frekuensi area.', true);
      return;
    }
    const plan = plans.find(item => item.id === placing.planId);
    const item = plan?.items.find(entry => entry.id === placing.itemId);
    if (!item) return cancelPlacement();
    item.coordinates = [Number(event.lngLat.lng.toFixed(7)), Number(event.lngLat.lat.toFixed(7))];
    item.locationReviewed = true;
    try { writePlans(); cancelPlacement(); message('Location saved in this browser.'); }
    catch (error) { message(`Could not save location: ${error.message}`, true); }
  });
  changesTab.addEventListener('click', () => setPanel(active === 'changes' ? null : 'changes'));
  reportsTab.addEventListener('click', () => setPanel(active === 'reports' ? null : 'reports'));
  document.getElementById('workspace-panel-close').addEventListener('click', () => setPanel(null));
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && active) setPanel(null); });
  window.addEventListener('storage', event => {
    if (event.key === planKey) loadPlans();
    if (event.key === 'teduh-team-local-v1' || event.key === legacyReportKey) refreshReports();
  });
  window.addEventListener('focus', refreshReports);
  setInterval(refreshReports, 20_000);
  try { seedFrekuensiPlan(); } catch (error) { console.warn('Could not add Frekuensi plan:', error); }
  loadPlans();
  refreshReports();
  return { savePlan, syncGoogle, cancelPlacement, close: () => setPanel(null),
    isPlacing: () => Boolean(placing) };
}

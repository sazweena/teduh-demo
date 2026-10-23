// GitHub Pages has no server. Keep map proposals and resident reports in this
// browser so the public planning workflow remains usable across its pages.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const key = 'teduh-team-local-v1';
  const costs = { tree: 5000, sail: 15000, crossing: 90000, light: 6000 };
  // First visit: start from the team's demo plan (16 proposed fixes placed on real
  // Elmina coordinates, 2 scenario reports) so the map matches the pitch deck.
  const SEED = {"reports":[{"id":"demo-r1","kind":"hot","coordinates":[101.5062,3.1818],"road_name":"Jalan Elmina Ilham 3","note":"Demo scenario: no shade on the school walk at 1pm.","source":"Owner app","status":"Received","me_too_count":23,"reply":"","created_at":"2026-10-21T05:10:00.000Z","updated_at":"2026-10-21T05:10:00.000Z"},{"id":"demo-r2","kind":"cross","coordinates":[101.5078,3.1846],"road_name":"Jalan Elmina Ilham 2","note":"Demo scenario: no safe crossing near the bus stop.","source":"QR web form","status":"Seen","me_too_count":6,"reply":"Seen by the township team. Site check this week.","created_at":"2026-10-21T07:42:00.000Z","updated_at":"2026-10-21T09:00:00.000Z"}],"proposals":[{"id":"d07ea278-86d4-4971-b3c1-1b8cc31b630d","kind":"tree","coordinates":[101.5107814,3.1758233],"status":"proposed","cost_rm_estimate":5000,"created_at":"2026-10-21T15:49:03.854Z","updated_at":"2026-10-23T07:34:11.628Z"},{"id":"7b9767e8-beed-4def-be9d-451253e5ff26","kind":"tree","coordinates":[101.51201,3.1758435],"status":"proposed","cost_rm_estimate":5000,"created_at":"2026-10-21T15:49:05.273Z","updated_at":"2026-10-22T06:30:53.903Z"},{"id":"16caac26-f150-4ed6-9fc7-036b47afb20a","kind":"tree","coordinates":[101.5127676,3.1765841],"status":"proposed","cost_rm_estimate":5000,"created_at":"2026-10-21T15:49:14.440Z","updated_at":"2026-10-21T15:49:14.440Z"},{"id":"31417cb7-dd51-4477-91a3-45dc6364bba9","kind":"tree","coordinates":[101.5094436,3.1758986],"status":"proposed","cost_rm_estimate":5000,"created_at":"2026-10-21T15:49:16.633Z","updated_at":"2026-10-21T15:49:16.633Z"},{"id":"347d57d1-8aca-4d65-ae65-df0a1b36408b","kind":"tree","coordinates":[101.5078888,3.1751596],"status":"proposed","cost_rm_estimate":5000,"created_at":"2026-10-21T15:49:18.344Z","updated_at":"2026-10-21T15:49:18.344Z"},{"id":"cda0de86-b427-419d-ab20-cac6fbba483e","kind":"sail","coordinates":[101.5132073,3.1765198],"status":"proposed","cost_rm_estimate":15000,"created_at":"2026-10-21T15:49:27.537Z","updated_at":"2026-10-21T15:49:27.537Z"},{"id":"076679d7-fea2-4bc8-b72e-e801fd539ac7","kind":"sail","coordinates":[101.5140543,3.1753096],"status":"proposed","cost_rm_estimate":15000,"created_at":"2026-10-21T15:49:31.598Z","updated_at":"2026-10-21T15:49:31.598Z"},{"id":"0674b8b8-595f-4934-ab6b-2a877c2e4774","kind":"sail","coordinates":[101.5136147,3.1750846],"status":"proposed","cost_rm_estimate":15000,"created_at":"2026-10-21T15:49:33.944Z","updated_at":"2026-10-21T15:49:33.944Z"},{"id":"008aa5cc-9e51-4bae-acfe-3c5270e1e8dd","kind":"crossing","coordinates":[101.5124245,3.176809],"status":"proposed","cost_rm_estimate":90000,"created_at":"2026-10-21T15:49:41.090Z","updated_at":"2026-10-21T15:49:41.090Z"},{"id":"74db4996-be10-48bd-8a35-19b854ad56e3","kind":"crossing","coordinates":[101.5121457,3.177066],"status":"proposed","cost_rm_estimate":90000,"created_at":"2026-10-21T15:49:42.170Z","updated_at":"2026-10-21T15:49:42.170Z"},{"id":"2f776300-612f-42d6-a078-edb65268fd73","kind":"light","coordinates":[101.5142902,3.1777408],"status":"proposed","cost_rm_estimate":6000,"created_at":"2026-10-21T15:49:44.829Z","updated_at":"2026-10-21T15:49:44.829Z"},{"id":"7c23c842-ea47-4683-aeda-23f6b7f9ce63","kind":"light","coordinates":[101.5146441,3.177473],"status":"proposed","cost_rm_estimate":6000,"created_at":"2026-10-21T15:49:45.793Z","updated_at":"2026-10-21T15:49:45.793Z"},{"id":"45071899-bce5-4dea-8e98-35d04550a6ad","kind":"light","coordinates":[101.5175279,3.1813075],"status":"proposed","cost_rm_estimate":6000,"created_at":"2026-10-21T15:49:50.410Z","updated_at":"2026-10-21T15:49:50.410Z"},{"id":"98e5b907-cbfc-485a-83e8-42c7f5595e1c","kind":"light","coordinates":[101.5168202,3.1816717],"status":"proposed","cost_rm_estimate":6000,"created_at":"2026-10-21T15:49:51.474Z","updated_at":"2026-10-21T15:49:51.474Z"},{"id":"fea51472-29a9-4880-b2b1-6ed1d1c73adf","kind":"light","coordinates":[101.5166486,3.1821001],"status":"proposed","cost_rm_estimate":6000,"created_at":"2026-10-21T15:49:52.605Z","updated_at":"2026-10-21T15:49:52.605Z"},{"id":"ffc765fc-1460-4c2a-92c5-0f43be272a42","kind":"light","coordinates":[101.5153405,3.1826784],"status":"proposed","cost_rm_estimate":6000,"created_at":"2026-10-21T15:49:53.800Z","updated_at":"2026-10-21T15:49:53.800Z"}]};
  const read = () => {
    try {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(SEED));
      const state = JSON.parse(localStorage.getItem(key) || '{}');
      return { reports: Array.isArray(state.reports) ? state.reports : [], proposals: Array.isArray(state.proposals) ? state.proposals : [] };
    } catch { return { reports: [], proposals: [] }; }
  };
  const write = state => localStorage.setItem(key, JSON.stringify(state));
  const reply = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  }));
  const validPoint = point => Array.isArray(point) && point.length === 2 &&
    point.every(Number.isFinite) && point[0] >= 101.495 && point[0] <= 101.518 &&
    point[1] >= 3.175 && point[1] <= 3.190;

  window.fetch = (resource, options = {}) => {
    const url = new URL(typeof resource === 'string' ? resource : resource.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(resource, options);
    const path = url.pathname;
    const method = (options.method || 'GET').toUpperCase();
    const state = read();
    let body = {};
    try { body = options.body ? JSON.parse(options.body) : {}; }
    catch { return reply({ error: 'Invalid request' }, 400); }
    const now = new Date().toISOString();
    const id = () => crypto.randomUUID();

    if (path === '/api/reports') {
      if (method === 'GET') return reply({ reports: state.reports });
      if (method === 'POST') {
        if (!['hot', 'cross', 'dark', 'broken'].includes(body.kind) || !validPoint(body.coordinates))
          return reply({ error: 'Choose a valid problem and location inside Elmina' }, 400);
        const report = { id: id(), kind: body.kind, coordinates: body.coordinates,
          road_name: String(body.road_name || '').slice(0, 160), note: String(body.note || '').slice(0, 800),
          source: body.source || 'QR web form', status: 'Received', me_too_count: 0,
          photo: typeof body.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(body.photo) && body.photo.length < 400000 ? body.photo : null,
          reply: '', created_at: now, updated_at: now };
        state.reports.unshift(report); write(state); return reply({ report }, 201);
      }
    }
    const reportMatch = /^\/api\/reports\/([^/]+)(\/me-too)?$/.exec(path);
    if (reportMatch) {
      const report = state.reports.find(item => item.id === reportMatch[1]);
      if (!report) return reply({ error: 'Report not found' }, 404);
      if (method === 'POST' && reportMatch[2]) report.me_too_count++;
      else if (method === 'PATCH' && !reportMatch[2]) {
        if (body.status !== undefined) {
          if (!['Received', 'Seen', 'Planned', 'Built'].includes(body.status)) return reply({ error: 'Invalid status' }, 400);
          report.status = body.status;
        }
        if (body.reply !== undefined) report.reply = String(body.reply).slice(0, 800);
      } else if (method !== 'GET' || reportMatch[2]) return reply({ error: 'Endpoint not found' }, 404);
      report.updated_at = now; if (method !== 'GET') write(state);
      return reply({ report });
    }
    if (path === '/api/proposals/import' && method === 'POST') {
      if (!Array.isArray(body.proposals) || body.proposals.some(item => !Object.hasOwn(costs, item.kind) || !validPoint(item.coordinates)))
        return reply({ error: 'Import contains an invalid fix or location' }, 400);
      const proposals = body.proposals.map(item => ({ id: id(), kind: item.kind, coordinates: item.coordinates,
        status: 'proposed', cost_rm_estimate: costs[item.kind], created_at: now, updated_at: now }));
      state.proposals.push(...proposals); write(state); return reply({ proposals }, 201);
    }
    if (path === '/api/proposals') {
      if (method === 'GET') return reply({ proposals: state.proposals });
      if (method === 'POST') {
        if (!Object.hasOwn(costs, body.kind) || !validPoint(body.coordinates))
          return reply({ error: 'Choose a valid fix and location inside Elmina' }, 400);
        const proposal = { id: id(), kind: body.kind, coordinates: body.coordinates,
          status: 'proposed', cost_rm_estimate: costs[body.kind], created_at: now, updated_at: now };
        state.proposals.push(proposal); write(state); return reply({ proposal }, 201);
      }
    }
    const proposalMatch = /^\/api\/proposals\/([^/]+)$/.exec(path);
    if (proposalMatch) {
      const index = state.proposals.findIndex(item => item.id === proposalMatch[1]);
      if (index < 0) return reply({ error: 'Proposal not found' }, 404);
      if (method === 'DELETE') { state.proposals.splice(index, 1); write(state); return reply({ deleted: true }); }
      if (method === 'PATCH') {
        const proposal = state.proposals[index];
        if (body.coordinates !== undefined) {
          if (!validPoint(body.coordinates)) return reply({ error: 'Location must be inside Elmina' }, 400);
          proposal.coordinates = body.coordinates;
        }
        if (body.status !== undefined) {
          if (!['proposed', 'planned', 'built'].includes(body.status)) return reply({ error: 'Invalid status' }, 400);
          proposal.status = body.status;
        }
        proposal.updated_at = now; write(state); return reply({ proposal });
      }
    }
    return reply({ error: 'Endpoint not found' }, 404);
  };
})();

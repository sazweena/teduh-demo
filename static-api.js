// GitHub Pages has no server. Keep map proposals and resident reports in this
// browser so the public planning workflow remains usable across its pages.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const key = 'teduh-team-local-v1';
  const costs = { tree: 5000, sail: 15000, crossing: 90000, light: 6000 };
  const read = () => {
    try {
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

# Teduh (Cool Routes)

Team Simelarps, Township of Tomorrow (Planet), Sime Darby Property University Hackathon 2026.

Teduh helps township planners inspect walking heat, compare fixes within a budget, and hear from residents. The [pitch script](source-ref/simelarps-teduh-pitch-script-2026-10-22.md) is the spoken reference for the presentation.

## Open the planning workspace

- Live prototype (main link for judges), planner and resident views: https://sazweena.github.io/teduh-demo/
- Full Elmina street map: https://sazweena.github.io/teduh-demo/map.html
- Resident report form: https://sazweena.github.io/teduh-demo/report.html
- Proposed owner-app integration: https://sazweena.github.io/teduh-demo/sdp-app.html

Use *Reset demo* to open the planner map and resident view side by side at noon. Move the FIND slider to 1:00 PM to see the highlighted planning route change to dark red. Its scenario priority becomes 0.81, with 120 walkers per hour, 95% sun exposure, and a 150 m crossing gap. Click *Next: Plan fixes*, set RM300,000, and confirm. The recommendation shows 5 fixes, RM263,000 allocated, and 2,960 estimated daily trips. Click *Preview on map* to inspect the illustrative Jalan Elmina 3 tree, sail, and crossing locations. The resident phone flow can submit a scenario report and show the planner response.

## Data and limits

The map uses an OpenStreetMap snapshot for actual Elmina street geometry. The colored planning route uses nearby mapped *Jalan Elmina Ilham 3* as a visual reference for the script's *Jalan Elmina 3*. Confirm the exact pilot route and walking access on site. Priority, shade, walkers, fix costs, and impact are scenario estimates, not field measurements.

This GitHub Pages site has no backend. Reports and proposed map fixes entered in the separate map and report form are stored in the current browser so those pages can work together. They are not shared across devices and are not submitted to Sime Darby Property or a council. The resident phone flow inside `index.html` is also a local planning scenario. The separate private pilot can use a shared server and database.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Planner, budget engine, resident phone, and pitch reset |
| `map.html`, `app.js`, `styles.css` | OSM street map, hourly FIND overlay, and proposed fixes |
| `elmina-map.json` | OSM-derived Elmina geometry snapshot |
| `report.html`, `report.js` | Coordinate-based resident report form |
| `static-api.js` | Browser storage adapter for this static site |
| `sdp-app.html` | Proposed owner-app integration view |
| `assets/` | Teduh vector logo, source PNG, and visual comparison |
| `vendor/` | Local Leaflet files and license |
| `source-ref/` | Spoken pitch script reference |

Serve the repository through a local HTTP server when testing. Opening the HTML files through `file://` prevents map data requests from loading. No build step is required.

## Team workflow

Pull the latest `main` before editing, test the changed screen and connected flow, then commit and push. Keep the page, script, and presentation values aligned. The site is published from this repository through GitHub Pages.

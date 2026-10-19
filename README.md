# Teduh

**Teduh shows Sime Darby which streets people walk in the heat or the dark without shade or a safe crossing, picks the best-value fix within a budget, and lets residents report what the map misses.**

Concept prototype for the Sime Darby Property University Hackathon 2026 (Township of Tomorrow, Planet theme). All streets, numbers, reports and costs in this demo are synthetic.

## Live demo

- Teduh demo (planner website + resident phone): https://sazweena.github.io/teduh-demo/
- Concept of Teduh inside the Sime Darby Property App: https://sazweena.github.io/teduh-demo/sdp-app.html (concept only, not an official Sime Darby app)

Use the bar at the bottom-left of the demo to switch between **Sime Darby**, **Resident**, **Side by side**, **QR** and **Reset**.

## 60-second demo path

1. **Sime Darby** view: Overview, then Map. Drag the hour to 1pm; Jalan Elmina 3 turns red. Click it to see why.
2. **Fix plan**: move the budget slider. The best-value fixes are ticked; compare with RM1–2m for one footbridge.
3. **Side by side**: on the phone, My street → Report → pick a problem → tap a street → add a photo → Send. The bell on the Sime Darby side shows 1.
4. Open the report from the bell, set it to **Planned** and reply. The phone gets the update.
5. Set it to **Built**; the phone shows the before and after.
6. Press **Reset** before the next run.

## Files

| File | What it is |
|---|---|
| `index.html` | The full clickable demo: planner website and resident phone, connected |
| `sdp-app.html` | Concept: the "My Street" tile and flow inside the Sime Darby Property App look |

Everything is plain HTML, CSS and JavaScript in one file each. No build step.

## How to edit (team)

**In the browser (easiest):** open this repo on github.com and press the `.` key. A VS Code editor opens. Edit the file, then use the Source Control panel to commit to `main`. The live site updates in about a minute.

**On your laptop:**

```bash
git clone https://github.com/sazweena/teduh-demo.git
cd teduh-demo
# open index.html in your browser to test
git pull          # always pull before you start
git add .
git commit -m "Describe your change"
git push
```

Tip: tell the group before editing the same file at the same time, to avoid merge conflicts.

## Team

- ________________
- ________________
- ________________

## Data and assumptions

The real tool would use public data only: OpenStreetMap, Google Open Buildings, Meta tree canopy, sun position, WorldPop and the data.gov.my MET Malaysia weather API, calibrated with field counts. Costs are rough public ranges. Under the hackathon terms, Sime Darby Property owns the IP.

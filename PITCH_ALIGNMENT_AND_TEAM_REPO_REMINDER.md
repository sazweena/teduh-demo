# Teduh pitch alignment and team repo handoff

Date: 22 October 2026. The spoken script is `source-ref/simelarps-teduh-pitch-script-2026-10-22.md`. The current visual deck is `Teduh_Deck_Visual.pdf`. Keep the script unchanged for this pass.

## Align the 10 main slides before recording

| Main slide (PDF page) | Change needed to support the script |
| --- | --- |
| 1, summary (p. 2) | Replace team and university placeholders with Simelarps and the actual presenters. Keep the 5 fixes, RM263,000, and 2,960 daily trips labelled as scenario estimates. |
| 2, problem (p. 3) | Remove the field-temperature prompt until a measurement exists. Keep the heat-illness and LRT3 claims tied to their cited sources. |
| 4, Find/Fix/Feedback (p. 5) | Show that the ranking inputs and fix values are estimates pending field calibration. |
| 5, live walkthrough (p. 6) | Add the spoken Jalan Elmina 3 values: priority 0.81, 120 walkers/hour, 95% in sun, and a 150 m crossing gap in the planning scenario. Show RM300,000 changing to 5 fixes, RM263,000, and 2,960 estimated daily trips. Use screenshots from the final team site. |
| 7, how it works (p. 8) | Show the three spoken calculations: hourly shade, four-factor priority, and daily trips divided by cost per RM10,000. Distinguish current scenario inputs from building heights, canopy, weather, and field counts still to be integrated. |
| 8, impact (p. 9) | Replace “We measured the start” and all blank field-day figures unless actual field results are available. Present 60%+ shade, +10% foot traffic, and 80% of reports answered within 7 days as Month 3 targets, not achieved results. |
| 9, feasibility (p. 10) | Keep the proposed three-month pilot and ownership split. Do not present the planning scenario as a field-validated shade model or an official owner-app integration. |
| 10, implementation and ask (p. 11) | Match the closing ask: one Elmina street, three months, and one pilot budget. Keep the footbridge comparison conditional; no bridge has been proven unnecessary. |

Remove the storyboard page and yellow team notes from the submitted deck. Replace or remove appendix placeholders for team names, measurements, interviews, supplier quotes, and field photos.

## Team repo release checks

The script names `https://sazweena.github.io/teduh-demo/`, and the shared source repo is `https://github.com/sazweena/teduh-demo`. The private `dev-aqil/sime-darby-teduh` checkout remains the separate backend pilot. This team checkout contains the pitch-facing planner, resident views, OSM map, and static-site storage adapter. Its reports and proposed fixes are browser-local, not shared across devices.

- [x] Fetch the latest clean team `main` and port Reset pitch, the hourly OSM priority overlay, Jalan Elmina 3 breakdown, and live budget recalculation.
- [x] Keep the team site static: store separate map proposals and report-form entries in this browser, and describe that limit in the UI and README.
- [ ] Verify the public URL in a browser after publishing: Reset pitch opens side by side at noon and RM100,000; set 1:00 PM and confirm Jalan Elmina 3 is #1 with 0.81 priority, 120 walkers/hour, and 95% in sun; set RM300,000 and confirm 5 fixes, RM263,000, and 2,960 estimated daily trips; submit a scenario report and confirm the planner badge and resident update.
- [ ] Capture the final site for slide 5 and the video. Ensure the prototype/code link in the submission points to the same version shown in the video.

The public URL must be verified after the team commit is pushed and GitHub Pages updates.

# Teduh project context

This working directory is the team repository, `sazweena/teduh-demo`. Make product and UI changes here.

## Reference archive

The former private checkout is archived locally at `C:\Users\User\AppData\Local\Temp\teduh-private-local-20261022` (commit `1c9ac44`). Read it for the original brief, PDFs, architecture notes, product decisions, and earlier pilot implementation. Treat this Temp location as an archive, not as the working repository; it may be removed by system cleanup. The same snapshot is backed up in the private `dev-aqil/sime-darby-teduh` repository at commit `1c9ac44`.

Key archived references:

- `C:\Users\User\AppData\Local\Temp\teduh-private-local-20261022\Teduh_Idea_Document.pdf`
- `C:\Users\User\AppData\Local\Temp\teduh-private-local-20261022\Teduh_Deck_Visual.pdf`
- `C:\Users\User\AppData\Local\Temp\teduh-private-local-20261022\source-ref\simelarps-teduh-pitch-script-2026-10-22.md` (older script wording)
- `HACKATHON_BRIEF.md`
- `TEDUH_MAP_ARCHITECTURE.md`
- `TEDUH_PRODUCT_DECISIONS.md`

## Current pitch source

Use this team's `source-ref/simelarps-teduh-pitch-script-2026-10-22.md` for the current spoken walkthrough. Its Step 2 follows the live budget modal and map preview. The archive's copy has older Step 2 wording.

When the archive and current team files disagree about the UI or spoken flow, follow the current team files. Keep the data provenance accurate in project documentation, and check the actual site before claiming that a flow works.

## Product quality and honest copy

Treat Teduh as a working application, not a throwaway demo or prototype. Every visible control should perform the action its label promises, with usable loading, empty, and error states. Remove or complete decorative, dead-end, and misleading features instead of presenting them as working functionality. Keep the planner, map, and resident journeys usable on mobile as well as desktop.

Write interface copy in a confident product voice. Remove visible demo, prototype, scenario, estimated, and field-validation labels from maps, reports, budget flows, and resident screens. This does not authorize claiming capabilities the site lacks: distinguish browser-local records from shared submissions, and do not imply live weather, push delivery, authentication, or production integrations until those features exist. Put essential behavior beside the relevant action and keep detailed evidence in Data and methods. Identify generated report images accurately.

The archive's `live/` app is a separate Node/PostgreSQL pilot with shared proposal and resident-report APIs. Review its server, README, and product decisions before changing data flows here. The current team GitHub Pages app uses browser-local storage; do not confuse its limits with the archived pilot's capabilities. Reuse verified pilot behavior when moving a flow to shared storage.

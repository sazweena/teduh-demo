# Elmina modular sidewalks

Three editable sidewalk modules, fitted to the current house GLBs without editing any house files. Dimensions are visual design assumptions, not surveyed Elmina dimensions. The geometry checks establish asset fit, not civil-engineering or accessibility certification.

## Assets

| Module | GLB and editable source basename | X frontage | Z depth | Triangles | GLB size |
| --- | --- | ---: | ---: | ---: | ---: |
| Plain | `elmina-sidewalk-plain` | 6.10 m | 3.00 m | 168 | 736,908 bytes |
| Tree-ready | `elmina-sidewalk-tree-ready` | 6.10 m | 3.00 m | 204 | 947,032 bytes |
| End side-yard extension | `elmina-sidewalk-sideyard-3m` | 3.00 m | 3.00 m | 36 | 720,788 bytes |

Each basename has a `.blend` and `.glb`. Individual Blender sources contain only the editable module meshes, with packed textures. `five-house-sidewalk-fit.blend` contains the imported GLBs, the five houses, the extension, render-only ground and road, lights, and four named cameras. The houses are one current end unit and four current intermediate units, with no geometry changes.

## Coordinates and placement

GLBs use metres, Y up, house behind toward +Z, road toward -Z. The module origin is the middle of its back edge at ground level, not the surface top. Standard bounds are X [-3.05, 3.05], Y [0, 0.20], Z [-3, 0]. Extension bounds are X [-1.50, 1.50] with the same Y and Z. Blender uses its native Z-up axes: (X, streetward Y, up Z); the exporter converts them to glTF Y-up. This follows the existing house workflow. Do not apply another axis rotation when loading the GLBs.

- Place a standard module at house position plus (0, 0, -8.00), before applying the house's world rotation. The back edge meets the current porch front at house-local Z=-8.00 and Y=0.20.
- Repeat standard modules by 6.10 m along X. Both X ends use exactly the same surface/curb profile, with no overhanging trim, gaps, or end caps across the walking surface.
- Place the extension at end-house position plus (4.55, 0, -8.00). It covers end-house X [3.05, 6.05], continuing the main frontage across the existing 3 m side-yard width. It is a straight frontage extension, not a corner turn or a path running down the side of the house.
- The review row uses house X positions 0, -6.1, -12.2, -18.3, -24.4. The end house is at X=0, with its side yard toward +X.

## Surface and gate dimensions

| Feature | Local X | Local Z | Height / behavior |
| --- | --- | --- | --- |
| Clear walking zone | Entire module | 0 to -1.80 | Y=0.20 at back, Y=0.164 at street-side boundary; continuous 2% crossfall |
| Planting/service zone | Entire module except crossing | -1.80 to -3.00 | Paved surface descends to Y=0.12 at curb |
| Vehicle crossing | -1.65 to +1.55 | 0 to -3.00 | Exactly matches 3.20 m gate; walking zone stays on the common plane |
| Vehicle apron | -1.65 to +1.55 | -1.80 to -3.00 | Y=0.164 to 0.02, 12% slope, 20 mm road lip |
| Pedestrian approach | +1.69 to +2.59 | 0 to -1.80 | Exactly matches 0.90 m gate, same continuous walking plane |
| Pedestrian service paving | +1.69 to +2.59 | -1.80 to -2.90 | Continues toward the curb, not a separate road-access ramp |
| Curb | Outside vehicle crossing | -2.90 to -3.00 | 0.10 m wide, 0.12 m high at street edge |

The vehicle apron slope is outside the clear walking zone. No gutter, drainage design, tactile paving, or street-crossing accessibility claim is included. The gates remain closed as supplied in the house assets. The model does not change or test their animation sweep.

## Tree opening

The tree-ready module has a true 1.00 x 1.00 m opening, with no paving beneath its recessed soil insert:

- Opening X: [-2.85, -1.85]; Z: [-2.90, -1.90].
- Centre in local GLB coordinates: (X=-2.35, Y=0.025, Z=-2.40), at the soil surface. Plan centre is (-2.35, -2.40).
- 0.20 m clear from the opening edge to the vehicle-crossing X boundary; 0.20 m to the module's left X boundary.
- 0.10 m paved separation from the clear walking zone and 0.10 m curb strip between the opening and the road edge.
- The opening is wholly outside both gate approaches. It fits the supplied geometry, so a separate tree bay is unnecessary.
- No tree, trunk, grate, or root geometry is included. `TreeWellSoil` is a separate editable recessed soil surface, removable if terrain supplies soil.
- In the review scene, tree-ready modules are at houses 1, 3, and 5. Their well centres are (-2.35, 0.025, -10.40), (-14.55, 0.025, -10.40), and (-26.75, 0.025, -10.40).

These clearances concern the opening only. Tree species, mature root volume, utilities, and root barriers need site design; a 1 m opening is not a claim that the subsurface rooting space is sufficient.

## Editable objects and materials

Object names use `plain__`, `tree_ready__`, or `sideyard_3m__` prefixes. Standard modules contain `ClearWalkWest`, `VehicleCrossingWalk`, `ClearWalkLink`, `PedestrianApproach`, `ClearWalkEast`, `VehicleApron`, service paving, and named `Curb_...` strips. The tree module replaces `ServiceWest` with `TreeWellSurround` (36 triangles) and `TreeWellSoil` (12 triangles). All other individual pieces are 12 triangles each. The extension has `ClearWalk`, `Service`, and `Curb_Service` (12 triangles each).

Exact object names and per-object triangle counts appear in `dimensions-and-validation.json` and independently in `glb-checks.json`. Geometry stays split into meaningful editable pieces; use shared geometry/material instances when repeating modules in Teduh.

Four original PBR materials provide subtle concrete grain, a darker service band, a pale visible curb, and recessed soil. All maps are 256 x 256 PNGs, packed in Blender, embedded in each GLB, and supplied separately in `textures/`. Base color, normal, and roughness are supplied; metallic is zero. The exporter packs roughness into its glTF metallic-roughness texture. UVs are planar, one repeat per metre on horizontal surfaces and metre-scaled on side faces. No baked lighting or external image dependencies are required. The same top-surface plane continues across the crossing even where object boundaries differ.

## Renders and verification

- `five-house-row-pedestrian.png`: all five houses and the sidewalks, camera at 1.65 m above ground.
- `five-house-row-elevated.png`: elevated oblique view of the whole row.
- `sidewalk-pedestrian-detail.png`: close view of the end frontage and adjoining sidewalk, camera at 1.65 m.
- `five-house-row-plan.png`: orthographic plan for gate, apron, tree-opening and extension alignment.

These are Blender renders of the actual imported GLBs, not generated reference imagery. Render-only road and ground are excluded from each module GLB. No signs, people, vehicles, road markings or trees are included.

The build checks the imported current gate widths/positions and hashes all house-directory files before and after. The independent GLB checker reads actual binary buffers and verifies Y-up bounds, triangle budgets, metre-origin transforms, UV/normal presence, embedded PNG sizes, equal X seam profiles, the continuous walking plane and an unobstructed tree opening. Checks are recorded in the two JSON reports. The Teduh 3D map now places these modules at the five selected terrace frontages. This verifies model placement, not the actual sidewalk layout or dimensions on site.

Rebuild from the repository root in Git Bash:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python-exit-code 1 --python assets/models/elmina-streets/build-sidewalks.py
py assets/models/elmina-streets/check-sidewalks.py
```

# Elmina terrace house assets

Two original exterior assets for Teduh. Both use metres, Y up, street front -Z,
and the same house-centered ground origin. No marketing imagery is embedded.

## Deliverables

| Asset | Model | Editable source | Pedestrian view | Map view |
| --- | --- | --- | --- | --- |
| Intermediate | `elmina-intermediate.glb` | `elmina-intermediate.blend` | `intermediate-pedestrian.png` | `intermediate-map-angle.png` |
| End unit with yard | `elmina-end.glb` | `elmina-end.blend` | `end-pedestrian.png` | `end-map-angle.png` |

`model-stats.json` and `end-model-stats.json` contain the measured mesh bounds,
triangle counts and file sizes. `front-three-quarter.png` aliases the current
intermediate map-angle render for existing links.

## Geometry and materials

The intermediate retains the original 6.149 x 16.175 x 8.717 m overall bounds
(within 2 mm rounding tolerance), including its roof edges and porch. Its body
is 6.10 x 12 m with a 4 m porch. The 6.10 x 21.34 m reference lot is not its
building footprint. Both intermediate party walls remain plain.

Window openings are cut through the front cladding, with separate jambs,
rails, mullions and glazing set back about 0.25 m from the face. Small single
segment bevels give frames and canopy edges controlled highlights. The brick
strip uses staggered joints and physical mortar gaps. Roof seam geometry and
thin fascia geometry remain inexpensive. Glass uses opaque tinted PBR glazing
with low roughness and a clear coat, avoiding transparent sorting problems and
unmodeled interiors. Reflections depend on the host renderer's environment.

Original seamless 256 x 256 albedo, normal and roughness maps give plaster,
brick, roof, concrete and grass surface variation. They are embedded in each
GLB and use metre-scaled UVs. No external textures or Blender-only procedural
nodes are required by the exported asset. Geometry is merged by material.

The end variant reuses the same front module, body dimensions and origin. Its
+X wall has four recessed windows. A 3 m side yard includes lawn, a narrow
path, a low boundary plinth and railings. The opposite party wall is plain.
The yard expands the asset bounds; it does not rescale the house. Yard width,
window placement and rear construction are design assumptions.

## Direct official-reference comparison

The two official images were downloaded and visually inspected on 2026-11-02:

- [Ilham Residence 3 official front](https://www.simedarbyproperty.com/sites/default/files/inline-images/PIC1_7.jpg)
- [Ilham Residence 2 official end unit](https://simedarbyproperty.com/city-of-elmina/ilham-residence-2/images/type-b.jpg)

| Observed reference feature | Model response |
| --- | --- |
| Dark front planes with a slender pale outline and asymmetric roof/frame rhythm | Preserved the first model silhouette and dimensions; brought the white perimeter and central fin forward of the deeper cladding. |
| Pale rectangular panels above tall glazed bays, with small horizontal hoods | Retained the panels, deepened their relief and added recessed framed glazing below. |
| Fine dark Juliet railings | Retained simple thin rails and balusters. |
| Off-white perforated blocks beside a narrow red brick strip | Kept real screen holes, added staggered brick joints and embedded material detail. |
| Thin dark continuous porch edge with narrow supports | Refined fascia and posts with small bevels, preserving the canopy footprint. |
| End-unit reference has exposed side openings, lawn and boundary railings | Added a separate end variant with these elements while retaining the Residence 3 inspired front. |

The front source is a marketing visualization of a connected row, not a
measured isolated elevation. The model retains the user's existing two-bay
front composition and does not claim that its module boundaries exactly match
the sales image. The end reference is a different development phase with a
different facade. Its details are used only as guidance for exposed-wall and
yard treatment, not evidence of a Residence 3 end-unit plan. The official
images remain outside the public app and are not used as textures.

## Cameras and verification

Pedestrian renders use a perspective camera at 1.65 m above model ground,
looking slightly upward. Map views use a perspective camera at 28 degrees
above horizontal, matching the current `map-3d.js` default pitch of 62 degrees
from vertical, and a 22 degree front oblique azimuth. The sign and world bearing
will depend on the building's eventual street orientation. These are studio
renders with sky and lighting, not captures of the live map.

The build checks both triangle budgets and the intermediate bounds, and checks
that cutting end-unit side windows preserves all front-screen vertices. The
independent checker reads actual GLB buffers, checks ground level and Y-up
bounds, triangle counts, embedded PNG dimensions and normal-map presence.

From the repository root in Git Bash:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python-exit-code 1 --python scripts/build-elmina-house.py
py scripts/check-elmina-models.py
```

The Blender sources include render-only studio objects. The end-unit Blender
source also retains a hidden intermediate collection of meshes for reference;
only the end asset is selected for its GLB export.

## Map integration boundary

Both assets are placed on five selected OSM terrace footprints near Jalan
Metafasa U16/163 in `map-3d.js`; their generic extrusions are hidden. The
end-unit side yard extends beyond its house body and remains a visual
approximation. The site does not verify the selected homes' elevations,
parcel boundaries, or terrain heights. Do not repeat this design over
unrelated building types or claim verified resident-home geometry.

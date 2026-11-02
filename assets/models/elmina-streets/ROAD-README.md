# Elmina road surface kit

A separate asphalt surface for the existing Elmina houses and sidewalk modules. The 6.10 m repeat and 6.00 m road width are adjustable scene assumptions, not measured widths for Jalan Metafasa U16/163.

## Deliverables

| File | Contents |
| --- | --- |
| `elmina-road-straight.glb` | Asphalt only, one object, one material, embedded PBR textures |
| `elmina-road-straight.blend` | Editable asphalt quad and packed maps; optional marking object hidden by default |
| `textures/Elmina_asphalt_albedo.png` | Repeatable 512 x 512 base color, sRGB |
| `textures/Elmina_asphalt_normal.png` | Repeatable 512 x 512 tangent-space normal, non-color |
| `textures/Elmina_asphalt_roughness.png` | Repeatable 512 x 512 grayscale roughness, non-color |
| `elmina-road-optional-centre-dash.glb` | Independent optional paint overlay, not included in the road GLB or fit renders |
| `road-five-house-elevated.png` | Five current houses, their sidewalks, and repeated asphalt modules |
| `road-sidewalk-junction-detail.png` | Pedestrian-height close view of curb/apron meeting the asphalt |
| `five-house-road-fit.blend` | Editable inspection arrangement with separate road objects, houses and sidewalks |
| `road-dimensions-and-validation.json` | Dimensions, placement, texture checks, fit measurements and protected-file hashes |
| `road-glb-checks.json` | Independent checks of the actual exported geometry, UVs, PBR images and pixel seams |

## Dimensions and origin

- Object: `Road_Asphalt_6p10x6p00`.
- Material: `Elmina_Asphalt`.
- Metres, glTF Y up. Origin (0, 0, 0) lies on the road centre line at the asphalt surface.
- Exact design bounds: minimum (-3.05, 0.00, -3.00), maximum (+3.05, 0.00, +3.00).
- Width along X: 6.10 m; across Z: 6.00 m. Two conceptual 3.00 m lanes occupy Z [-3, 0] and [0, 3].
- +Z edge faces the houses; -Z edge faces the opposite side.
- Four vertices, one editable quad, two exported triangles. Up-facing normal (0, 1, 0).
- Zero thickness, no underside, road crown, curbs, gutters, kerbs, drainage, collision volume, or attached sidewalk. It is a render surface for application-generated terrain/road placement.
- GLB size: 908,816 bytes. Exported float32 X bounds are approximately +/-3.0499999523 m; the JSON checker records these actual values.

The Blender source follows Blender's native Z-up convention, matching the existing house and sidewalk sources. Blender +Y exports as glTF -Z. All object transforms are identity; the export conversion is baked into coordinates. The road GLB needs no additional up-axis conversion.

## Fit beside the current five-house row

For an unrotated house at (houseX, 0, 0), place the standard sidewalk at (houseX, 0, -8) and road at (houseX, 0, -14). The sidewalk reaches Z=-11; the road's +Z edge also reaches Z=-11. Rotate these offsets with the house frontage when using other bearings.

The road occupies Z [-17, -11] while the sidewalk occupies Z [-11, -8]. Their interiors do not overlap. Asphalt is at Y=0 and meets the vertical base of the sidewalk edge, with no horizontal gap or coplanar overlapping face. The existing sidewalk owns the 0.12 m curb rise and the 0.02 m vehicle-apron lip; those are intentional height changes, not missing road geometry.

The inspection arrangement reuses the five-house sidewalk scene after checking its recorded house hashes against the current files. Six unmodified road instances cover the five 6.10 m frontages and the end side-yard extension, with the last instance extending 3.10 m beyond that extension. Road instance X positions are +6.1, 0, -6.1, -12.2, -18.3, -24.4. Their Y-up origins are (X, 0, -14).

The live Teduh map positions the same straight modules along the nearby mapped road centerline instead. That line is farther from the selected house fronts than the Blender arrangement; a visual verge and separate driveway strips connect the modeled sidewalk to the road strip. Their layout is not surveyed.

The previous render-only road has been removed from this new inspection scene. Each visible asphalt surface comes from the new exported GLB. The original sidewalk inspection scene, sidewalk asset files and all house files remain unchanged. No combined street GLB is supplied: the road remains a reusable module, and the inspection arrangement is only for checking the fit.

## Reusing the appearance on map-generated roads

The three supplied PNGs are the original texture sources used by the asphalt material. Opposite pixel edges match exactly in both directions; the exported embedded maps are checked separately for the same property. The albedo has restrained aggregate grain, slight wear near the centres of the two lanes, and a subtle darker edge band. No paint or curb appearance is baked into these textures.

One texture tile covers 6.10 m longitudinally and the full 6.00 m road width. UVs are dimension-calibrated rather than one repeat per metre. For the exported GLB, U=(local X+3.05)/6.10 and V=(local Z+3.00)/6.00. Thus the house-facing edge has V=1 and the opposite edge V=0. Both X ends have identical edge samples and meet at an integer U repeat.

For a curved mesh, use accumulated centre-line distance for U so the grain does not restart at each generated vertex, and normalized signed lateral offset for V:

```text
U = distanceAlongCentreLineMetres / 6.10 + longitudinalPhase
V = (signedLateralOffsetMetres + roadWidthMetres / 2) / roadWidthMetres
```

Use a consistent lateral sign and UV orientation along each road strip. Match the GLB texture orientation when reusing its material. When applying the external files, use sRGB for albedo, linear/non-color for normal and roughness, and repeat wrapping. The roughness file is grayscale with equal R/G/B channels; metallic is zero. The GLB packs roughness into the green channel of its metallic-roughness map. The embedded material includes no Blender-only procedural nodes and no baked lighting.

Changing road width by stretching V changes the apparent transverse aggregate scale. For major width changes, the application may separate the fine grain from the road-width wear pattern. Intersections still need an application-selected UV/blending strategy so the edge tint does not create false boundaries through their interior. No bends, junction meshes, or fixed street layout are authored into the road asset.

## Optional markings

`Optional_CentreDash_3m` is an independent 3.00 x 0.10 m overlay with two triangles, at Y=0.001 m to avoid coplanar overlap with asphalt. Its bounds are (-1.50, 0.001, -0.05) to (+1.50, 0.001, +0.05). It is hidden in the road source by default, lives in a separate collection, and has its own small GLB. There are no markings in either fit render.

The application should opt into marking placement independently of the 6.10 m road repeat. The dash dimensions are optional visual choices, not a road-marking specification. Leaving it disabled produces the intended unmarked residential asphalt surface.

## Checks and rebuilding

Checks cover exported bounds, two-triangle topology, surface height, upward normals, UV corners/orientation, one asphalt material, embedded albedo/normal/roughness, external and embedded PNG dimensions and opposite pixel boundaries, instance seam positions, zero horizontal gap/overlap, and unchanged protected asset hashes. The two fit renders are visually inspected. The live map uses the straight road modules for the selected terrace row; generated bends and intersections remain outside this asset delivery.

From the repository root in Git Bash:

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python-exit-code 1 --python assets/models/elmina-streets/build-road.py
py assets/models/elmina-streets/check-road.py
```

The checker uses Pillow to inspect actual PNG pixels. The builder uses Blender's bundled NumPy. It writes only road deliverables and does not rebuild the houses or sidewalks.

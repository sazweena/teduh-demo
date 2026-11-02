# Elmina house: Astra first-model handoff

## References

- [Official Ilham Residence 3 exterior image](https://www.simedarbyproperty.com/sites/default/files/inline-images/PIC1_7.jpg): primary reference for the front facade and roofline of the two-storey Lifestyle Homes.
- [Official Ilham Residence 3 Type 1A floor plan](https://simedarbyproperty.com/city-of-elmina/ilham-residence-3/documents/Type1A.pdf): 20 x 70 ft lot, approximately 6.10 x 21.34 m, and 1,964.74 sq ft built-up area. This is a sales floor plan, not a measured building blueprint.
- [Official Ilham Residence 2 exterior image](https://simedarbyproperty.com/city-of-elmina/ilham-residence-2/images/type-b.jpg): secondary reference showing a terrace end with an exposed side wall and yard. It is a different phase and facade design.
- [Two-house concept image](elmina-house-exterior-concept.png): generated from the official images to communicate the intermediate and exposed-end massing. Its side wall and some facade details are inferred, not verified elevations. Both panels include short pieces of neighboring units to convey the terrace row.
- [Top, left, and right concept sheet](elmina-house-top-left-right-concept.png): generated views of a connected intermediate and end unit pair. The upper panel is an angled overhead view.
- [Straight-down roof concept](elmina-house-top-view-concept.png): generated roof and lot layout for the same pair. The roof details, lot boundaries, and side yard are conceptual and are not measured plans.

Ilham Residence 3 is a development phase; Jalan Elmina Ilham 3 is a different street. Do not present this house as the verified design of every resident's home. Do not put the sales images into the public app or use them as textures. Credit the source images in project documentation, and seek developer permission before claiming an exact branded architectural reproduction.

## Prompt to give Astra

> Build a simple first-pass 3D exterior model for our Teduh MapLibre street view. Create **one intermediate two-storey terrace unit** inspired by the attached Elmina house concept image and Sime Darby Property's official Ilham Residence 3 exterior image. Match the recognizable front massing: a narrow asymmetric pitched roof/front frame, charcoal upper facade with two tall windows, neighboring off-white perforated-block section, slim red brick accent, and a full-width dark porch canopy with thin columns. Keep it a plausible approximation rather than claiming an exact house.
>
> Use a 20 x 70 ft lot as the scale reference (about 6.10 x 21.34 m), but distinguish the lot from the actual building footprint. Model only what is visible from the street: roof, exterior walls, porch, windows, doors, basic side and rear walls. No interior, furniture, cars, people, logos, or house numbers. Keep the geometry and materials simple enough to repeat across many map buildings. Use original materials rather than copying the marketing image as a texture.
>
> Deliver one `.glb` in metres with Y up, the front facing negative Z, and the origin at ground level near the center of the house footprint. Include a front three-quarter screenshot, the model's actual width/depth/height, triangle count, and texture sizes. Target fewer than 20,000 triangles and textures no larger than 1024 px for this first version. Do not build the corner variant yet. Once the intermediate unit looks right in the map, derive a corner/end variant with an exposed side wall and yard from the same front module.

## Map integration note

The intermediate and end-unit models are now placed on five selected OSM footprints near Jalan Metafasa U16/163, with their generic extrusions hidden. These are visual approximations of the mapped homes, not verified elevations. Use multiple model variants for other building types and lot sizes.

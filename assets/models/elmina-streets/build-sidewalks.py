"""Run using Blender --background --python-exit-code 1 --python this-file.py.
All construction coordinates use Blender X, streetward Y, up Z.
GLB conversion gives X, up Y, streetward -Z, in metres.
"""
import bpy
import hashlib
import json
import math
import struct
from pathlib import Path
import numpy as np
from mathutils import Vector

OUT = Path(__file__).resolve().parent
HOUSES = OUT.parent / 'elmina-house'
HASHES = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in HOUSES.iterdir() if p.is_file()}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
(OUT / 'textures').mkdir(exist_ok=True)

def material(name, color, roughness=.82, textured=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    p = nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    if textured:
        rng = np.random.default_rng(73)
        grain = rng.random((256, 256)).astype(np.float32)
        grain = (grain + np.roll(grain, 1, 0) + np.roll(grain, 1, 1)) / 3
        normal = np.dstack(((np.roll(grain, 1, 1)-np.roll(grain, -1, 1))*.16,
                            (np.roll(grain, 1, 0)-np.roll(grain, -1, 0))*.16, np.ones_like(grain)))
        normal /= np.linalg.norm(normal, axis=2)[:, :, None]
        maps = {'basecolor': np.array(color)[None,None,:]*(.96+.08*grain[:,:,None]),
                'roughness': np.repeat((roughness+(grain-.5)*.08)[:,:,None],3,2),
                'normal': normal*.5+.5}
        for suffix, rgb in maps.items():
            im = bpy.data.images.new(name+'_'+suffix, width=256, height=256)
            if suffix != 'basecolor': im.colorspace_settings.name = 'Non-Color'
            rgba = np.ones((256,256,4), dtype=np.float32)
            rgba[:,:,:3] = rgb
            im.pixels.foreach_set(rgba.ravel())
            im.filepath_raw = str(OUT/'textures'/f'{name}_{suffix}.png')
            im.file_format = 'PNG'
            im.save()
            im.pack()
            tex = nodes.new('ShaderNodeTexImage')
            tex.image = im
            if suffix == 'normal':
                n = nodes.new('ShaderNodeNormalMap')
                links.new(tex.outputs['Color'], n.inputs['Color'])
                links.new(n.outputs['Normal'], p.inputs['Normal'])
            else:
                links.new(tex.outputs['Color'], p.inputs['Base Color' if suffix=='basecolor' else 'Roughness'])
    return m

concrete = material('Warm_concrete', (.53,.51,.46), textured=True)
service = material('Service_concrete', (.39,.39,.35), textured=True)
curb = material('Pale_curb', (.66,.65,.60), textured=True)
soil = material('Recessed_soil', (.105,.075,.043), textured=True)

def slab(name, x0, x1, y0, y1, h0, h1, mat, bottom=0):
    verts = [(x0,y0,bottom),(x1,y0,bottom),(x1,y1,bottom),(x0,y1,bottom),
             (x0,y0,h0),(x1,y0,h0),(x1,y1,h1),(x0,y1,h1)]
    faces = [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name='UV_1m')
    for p in mesh.polygons:
        axis = max(range(3), key=lambda i: abs(p.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for li in p.loop_indices:
            v = mesh.vertices[mesh.loops[li].vertex_index].co
            uv.data[li].uv = (v[axes[0]], v[axes[1]])
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    mesh.materials.append(mat)
    return ob

def join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts: ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    return ob

def make_segment(variant):
    extension = variant == 'sideyard-3m'
    left, right = (-1.5,1.5) if extension else (-3.05,3.05)
    parts = []
    # Shared 2% crossfall across ALL gate and crossing bands, no walking-zone dip.
    cuts = [left,right] if extension else [left,-1.65,1.55,1.69,2.59,right]
    for i,(a,b) in enumerate(zip(cuts,cuts[1:])):
        name = ('ClearWalk' if extension else ['ClearWalkWest','VehicleCrossingWalk','ClearWalkLink','PedestrianApproach','ClearWalkEast'][i])
        parts.append(slab(name,a,b,0,1.8,.20,.164,concrete))
    bands = [(left,right,'Service')] if extension else [(left,-1.65,'ServiceWest'),(-1.65,1.55,'VehicleApron'),(1.55,1.69,'ServiceLink'),(1.69,2.59,'PedestrianService'),(2.59,right,'ServiceEast')]
    for a,b,name in bands:
        if name == 'VehicleApron':
            parts.append(slab(name,a,b,1.8,3,.164,.02,concrete))
            continue
        if variant == 'tree-ready' and name == 'ServiceWest':
            # True 1 x 1 m hole; rim is part of the surrounding service slab.
            h = lambda y: .164+(y-1.8)*(.12-.164)/1.1
            ring = [slab('WellRimWest',a,-2.85,1.8,2.9,h(1.8),h(2.9),service),
                    slab('WellRimEast',-1.85,b,1.8,2.9,h(1.8),h(2.9),service),
                    slab('WellRimBack',-2.85,-1.85,1.8,1.9,h(1.8),h(1.9),service)]
            parts.append(join(ring,'TreeWellSurround'))
            parts.append(slab('TreeWellSoil',-2.85,-1.85,1.9,2.9,.025,.025,soil))
        else:
            parts.append(slab(name,a,b,1.8,2.9,.164,.12,service))
        parts.append(slab('Curb_'+name,a,b,2.9,3,.12,.12,curb))
    return parts

def bounds(obs):
    pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    return [[min(v[i] for v in pts) for i in range(3)], [max(v[i] for v in pts) for i in range(3)]]

stats = {}
for variant in ('plain','tree-ready','sideyard-3m'):
    parts = make_segment(variant)
    for ob in parts:
        ob.name = variant.replace('-','_')+'__'+ob.name
        ob['units'] = 'metres'
    bpy.context.view_layer.update()
    b = bounds(parts)
    width = 3 if variant=='sideyard-3m' else 6.1
    assert abs(b[1][0]-b[0][0]-width)<1e-5 and abs(b[1][1]-3)<1e-5
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts: ob.select_set(True)
    path = OUT/f'elmina-sidewalk-{variant}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_extras=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'elmina-sidewalk-{variant}.blend'))
    counts = {}
    for ob in parts:
        ob.data.calc_loop_triangles()
        counts[ob.name] = len(ob.data.loop_triangles)
    stats[variant] = {'dimensions_X_Y_Z_m':[width,.2,3], 'bounds_Y_up':[[-width/2,0,-3],[width/2,.2,0]],
                      'triangles':sum(counts.values()), 'objects_triangles':counts, 'glb_bytes':path.stat().st_size,
                      'tree_well_center_Y_up_m':[-2.35,.025,-2.4] if variant=='tree-ready' else None}
    assert sum(counts.values()) < 500
    for ob in parts: bpy.data.objects.remove(ob,do_unlink=True)

# Build the review scene strictly from exported GLBs, including the sidewalks.
def imported(path, name, location):
    old = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    obs = list(set(bpy.data.objects)-old)
    root = bpy.data.objects.new(name,None)
    scene.collection.objects.link(root)
    for ob in obs:
        if ob.parent is None: ob.parent=root
        ob.name = name+'/'+ob.name
    root.location = location
    return [o for o in obs if o.type=='MESH']

row = []
gate_checks = []
for i in range(5):
    x = -6.1*i
    house = imported(HOUSES/f'elmina-{"end" if i==0 else "intermediate"}.glb',f'House_{i+1}',(x,0,0))
    variant = 'tree-ready' if i%2==0 else 'plain'
    walk = imported(OUT/f'elmina-sidewalk-{variant}.glb',f'Frontage_{i+1}_{variant}',(x,8,0))
    row += house+walk
    bpy.context.view_layer.update()
    for token,expected in [('VehicleGate',(-1.65,1.55)),('PedestrianGate',(1.69,2.59))]:
        ob = next(o for o in house if token in o.name)
        b = bounds([ob])
        assert abs(b[0][0]-x-expected[0])<.001 and abs(b[1][0]-x-expected[1])<.001
        gate_checks.append({'unit':i+1,'object':token,'local_X_m':[round(b[0][0]-x,4),round(b[1][0]-x,4)]})
row += imported(OUT/'elmina-sidewalk-sideyard-3m.glb','Sideyard_extension',(4.55,8,0))
bpy.context.view_layer.update()

groundmat = material('Review_ground',(.24,.28,.23))
roadmat = material('Review_road',(.095,.105,.11))
slab('Render_only_ground',-200,200,-200,200,-.012,-.012,groundmat,bottom=-.1)
slab('Render_only_road',-50,25,11,27,-.004,-.004,roadmat,bottom=-.01)
world=bpy.data.worlds.new('Daylight')
scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.73,.85,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.6
def aim(ob, target): ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
for loc,power,size in [((-10,14,20),6500,18),((12,0,14),3000,10),((-24,8,12),3000,12)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object
    light.data.energy=power
    light.data.size=size
    aim(light,(-10,5,2))
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1800
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
for name,loc,target,lens,ortho in [
    ('five-house-row-pedestrian',(8,40,1.65),(-10,7,2.7),35,None),
    ('five-house-row-elevated',(15,44,26),(-10,4,1.6),44,None),
    ('sidewalk-pedestrian-detail',(6,14,1.65),(-1,9.1,.25),33,None),
    ('five-house-row-plan',(-10.7,3,50),(-10.7,3,0),50,39),
]:
    bpy.ops.object.camera_add(location=loc)
    camera=bpy.context.object
    camera.name=name
    camera.data.lens=lens
    if ortho:
        camera.data.type='ORTHO'
        camera.data.ortho_scale=ortho
    aim(camera,target)
    scene.camera=camera
    scene.render.filepath=str(OUT/f'{name}.png')
    bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['five-house-row-elevated']
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'five-house-sidewalk-fit.blend'))
assert all(hashlib.sha256((HOUSES/name).read_bytes()).hexdigest()==digest for name,digest in HASHES.items())
report = {'assets':stats,'house_files_unchanged':True,'house_sha256':HASHES,'gate_checks':gate_checks,
          'row_house_origins_Y_up_m':[[-6.1*i,0,0] for i in range(5)],
          'row_sidewalk_origins_Y_up_m':[[-6.1*i,0,-8] for i in range(5)],
          'extension_origin_Y_up_m':[4.55,0,-8],
          'well_centres_row_Y_up_m':[[-6.1*i-2.35,.025,-10.4] for i in (0,2,4)],
          'clear_walking_width_m':1.8,'service_width_m':1.2,'walking_crossfall_percent':2,
          'vehicle_apron_slope_percent':12,'vehicle_apron_road_lip_m':.02,
          'well_clearance_to_vehicle_crossing_m':.2,'well_clearance_to_walking_zone_m':.1}
(OUT/'dimensions-and-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('SIDEWALK_BUILD_COMPLETE '+json.dumps(stats),flush=True)

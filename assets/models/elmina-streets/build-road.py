"""Build a separate asphalt surface and a fit render, without changing prior assets.
Run with Blender --background --python-exit-code 1 --python this-file.py.
"""
import bpy
import hashlib
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parent
HOUSE = OUT.parent/'elmina-house'
PROTECTED = list(HOUSE.glob('*')) + list(OUT.glob('elmina-sidewalk-*')) + [OUT/'five-house-sidewalk-fit.blend']
hashes = {str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in PROTECTED if p.is_file()}
previous = json.loads((OUT/'dimensions-and-validation.json').read_text())
assert all(hashlib.sha256((HOUSE/n).read_bytes()).hexdigest()==h for n,h in previous['house_sha256'].items())
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
scene.unit_settings.system='METRIC'
scene.unit_settings.scale_length=1
(OUT/'textures').mkdir(exist_ok=True)

# A periodic texture tile spans 6.1 longitudinal metres and the whole 6 m width.
# Pixel boundary samples match exactly, including the normal map.
n=512
rng=np.random.default_rng(82)
grain=rng.random((n-1,n-1)).astype(np.float32)
grain=(grain+np.roll(grain,1,0)+np.roll(grain,1,1))/3-.5
v,u=np.meshgrid(np.arange(n-1)/(n-1),np.arange(n-1)/(n-1),indexing='ij')
macro=(np.sin(2*math.pi*(u+v))+.5*np.sin(2*math.pi*(3*u-2*v))+.3*np.cos(2*math.pi*(5*u+v)))/1.8
edge=np.exp(-(np.sin(math.pi*v)/.14)**2)
wear=np.exp(-((v-.25)/.11)**2)+np.exp(-((v-.75)/.11)**2)
tone=1+.10*grain+.028*macro-.075*edge+.025*wear
normal=np.dstack(((np.roll(grain,1,1)-np.roll(grain,-1,1))*.20,
                  (np.roll(grain,1,0)-np.roll(grain,-1,0))*.20,np.ones_like(grain)))
normal/=np.linalg.norm(normal,axis=2)[:,:,None]
maps={'albedo':np.array([.085,.091,.096])[None,None,:]*tone[:,:,None],
      'normal':normal*.5+.5,
      'roughness':np.repeat(np.clip(.87+.09*grain+.015*macro-.025*wear,0,1)[:,:,None],3,2)}
mat=bpy.data.materials.new('Elmina_Asphalt')
mat.diffuse_color=(.085,.091,.096,1)
mat.use_nodes=True
nodes,links=mat.node_tree.nodes,mat.node_tree.links
bsdf=nodes.get('Principled BSDF')
bsdf.inputs['Metallic'].default_value=0
seams={}
for suffix,rgb in maps.items():
    rgb=np.pad(rgb,((0,1),(0,1),(0,0)),mode='wrap')
    assert np.array_equal(rgb[0],rgb[-1]) and np.array_equal(rgb[:,0],rgb[:,-1])
    seams[suffix]={'opposite_pixel_edges_identical':True,'dimensions_px':[n,n]}
    im=bpy.data.images.new('Elmina_asphalt_'+suffix,width=n,height=n)
    if suffix!='albedo': im.colorspace_settings.name='Non-Color'
    rgba=np.ones((n,n,4),dtype=np.float32)
    rgba[:,:,:3]=rgb
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw=str(OUT/'textures'/f'Elmina_asphalt_{suffix}.png')
    im.file_format='PNG'
    im.save()
    im.pack()
    tex=nodes.new('ShaderNodeTexImage')
    tex.image=im
    tex.extension='REPEAT'
    if suffix=='normal':
        norm=nodes.new('ShaderNodeNormalMap')
        links.new(tex.outputs['Color'],norm.inputs['Color'])
        links.new(norm.outputs['Normal'],bsdf.inputs['Normal'])
    else:
        links.new(tex.outputs['Color'],bsdf.inputs['Base Color' if suffix=='albedo' else 'Roughness'])

def plane(name,width,depth,height,material):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(-width/2,-depth/2,height),(width/2,-depth/2,height),
                     (width/2,depth/2,height),(-width/2,depth/2,height)],[],[(0,1,2,3)])
    mesh.update()
    uv=mesh.uv_layers.new(name='Road_distance_width_UV')
    for loop in mesh.loops:
        x,y,z=mesh.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=((x+width/2)/width,(y+depth/2)/depth)
    ob=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(ob)
    mesh.materials.append(material)
    return ob

road=plane('Road_Asphalt_6p10x6p00',6.1,6,0,mat)
road['units']='metres'
road['lane_width_m']=3.0
road['surface_origin']='road centre line, asphalt Y=0 in glTF'
road['curb_owner']='separate sidewalk asset'
road['texture_tile_m']=[6.1,6.0]

def export(ob,path):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active=ob
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
                              export_yup=True,export_extras=True)

export(road,OUT/'elmina-road-straight.glb')

# Optional paint is an independent overlay, absent from the asphalt GLB and renders.
paint=bpy.data.materials.new('Optional_worn_white_paint')
paint.use_nodes=True
paint.diffuse_color=(.65,.64,.58,1)
paint.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.65,.64,.58,1)
paint.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.88
dash=plane('Optional_CentreDash_3m',3,.1,.001,paint)
export(dash,OUT/'elmina-road-optional-centre-dash.glb')
collection=bpy.data.collections.new('Optional markings, disabled by default')
scene.collection.children.link(collection)
for c in list(dash.users_collection): c.objects.unlink(dash)
collection.objects.link(dash)
dash.hide_render=True
dash.hide_set(True)
dash['placement']='Place independently along the centre line; do not attach to every road segment.'
bpy.ops.object.select_all(action='DESELECT')
road.select_set(True)
bpy.context.view_layer.objects.active=road
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'elmina-road-straight.blend'))

# Reuse the prior fit scene only after checking its source house hashes above.
# This remains an inspection arrangement, not a combined street export.
bpy.ops.wm.open_mainfile(filepath=str(OUT/'five-house-sidewalk-fit.blend'))
bpy.context.preferences.filepaths.save_version=0
scene=bpy.context.scene
old_road=bpy.data.objects.get('Render_only_road')
assert old_road is not None
bpy.data.objects.remove(old_road,do_unlink=True)
road_objects=[]
for i in range(-1,5):
    old=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/'elmina-road-straight.glb'))
    imported=list(set(bpy.data.objects)-old)
    assert len(imported)==1 and imported[0].type=='MESH'
    ob=imported[0]
    ob.name=f'Road_instance_{i+2:02d}'
    ob.location=(-6.1*i,14,0)
    road_objects.append(ob)
bpy.context.view_layer.update()
def bounds(obs):
    pts=[o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    return [[min(v[i] for v in pts) for i in range(3)], [max(v[i] for v in pts) for i in range(3)]]
walk=[o for o in scene.objects if o.type=='MESH' and (o.name.startswith('Frontage_') or o.name.startswith('Sideyard_extension/'))]
assert walk
wb=bounds(walk)
rb=bounds(road_objects)
assert abs(wb[1][1]-rb[0][1])<1e-5 # Both at Blender Y=11, glTF Z=-11.
assert abs(rb[0][2])<1e-5 and abs(rb[1][2])<1e-5
assert rb[0][0]<=wb[0][0]+1e-5 and rb[1][0]>=wb[1][0]-1e-5
assert all(bounds([o])[1][1]<=11.00001 for o in walk)
for a,b in zip(sorted(road_objects,key=lambda o:o.location.x),sorted(road_objects,key=lambda o:o.location.x)[1:]):
    assert abs(bounds([a])[1][0]-bounds([b])[0][0])<1e-5
assert len([o for o in scene.objects if o.type=='MESH' and 'VehicleGate' in o.name])==5
assert not any('Optional_CentreDash' in o.name for o in scene.objects)

def aim(ob,target): ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1800
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.cycles.samples=24
for name,loc,target,lens in [
    ('road-five-house-elevated',(17,48,30),(-9,6,1),43),
    ('road-sidewalk-junction-detail',(5,16,1.65),(-1,10.5,.15),35),
]:
    bpy.ops.object.camera_add(location=loc)
    cam=bpy.context.object
    cam.name=name
    cam.data.lens=lens
    aim(cam,target)
    scene.camera=cam
    scene.render.filepath=str(OUT/f'{name}.png')
    bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['road-five-house-elevated']
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'five-house-road-fit.blend'))
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in hashes.items())
report={'asset':'elmina-road-straight.glb','object':'Road_Asphalt_6p10x6p00',
        'units':'metres','up_axis':'Y','bounds_Y_up_m':[[-3.05,0,-3],[3.05,0,3]],
        'dimensions_X_Y_Z_m':[6.1,0,6],'triangles':2,'lanes':2,'lane_width_m':3,
        'surface_Y_m':0,'texture_tile_longitudinal_transverse_m':[6.1,6],
        'textures':seams,'optional_dash':{'file':'elmina-road-optional-centre-dash.glb',
        'object':'Optional_CentreDash_3m','bounds_Y_up_m':[[-1.5,.001,-.05],[1.5,.001,.05]],'triangles':2},
        'fit':{'road_origins_Y_up_m':[[-6.1*i,0,-14] for i in range(-1,5)],
               'road_house_facing_edge_Z_m':-11,'sidewalk_street_edge_Z_m':-11,
               'horizontal_gap_m':0,'horizontal_overlap_m':0,'road_to_curb_rise_m':.12,
               'road_to_vehicle_apron_lip_m':.02,'six_unmodified_road_instances':True},
        'protected_assets_unchanged':True,'protected_sha256':hashes}
(OUT/'road-dimensions-and-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('ROAD_BUILD_COMPLETE',flush=True)

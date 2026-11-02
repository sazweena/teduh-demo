"""Run with Blender --background --python scripts/build-elmina-house.py."""
import bpy
import json
import math
import numpy as np
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parents[1] / 'assets/models/elmina-house'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

def surface_maps(mat, color, roughness, strength):
    """Original seamless microtexture, embedded in glTF rather than Blender-only noise."""
    rng = np.random.default_rng(41)
    n = 256
    grain = rng.random((n,n)).astype(np.float32)
    grain = (grain + np.roll(grain,1,0) + np.roll(grain,1,1))/3
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    p = nodes.get('Principled BSDF')
    def image_node(suffix, rgb, noncolor=False):
        im=bpy.data.images.new(mat.name+' '+suffix,width=n,height=n)
        if noncolor: im.colorspace_settings.name='Non-Color'
        rgba=np.ones((n,n,4),dtype=np.float32)
        rgba[:,:,:3]=rgb
        im.pixels.foreach_set(rgba.ravel())
        im.pack()
        node=nodes.new('ShaderNodeTexImage')
        node.image=im
        return node
    # Blender's image pixel API takes linear values; packing handles sRGB encoding.
    linear=np.clip(np.array(color)[None,None,:]*(.93+.14*grain[:,:,None]),0,1)
    albedo=image_node('albedo',linear)
    links.new(albedo.outputs['Color'],p.inputs['Base Color'])
    normal=np.dstack(((np.roll(grain,1,1)-np.roll(grain,-1,1))*strength,
                      (np.roll(grain,1,0)-np.roll(grain,-1,0))*strength,np.ones_like(grain)))
    normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    tex=image_node('normal',normal*.5+.5,True)
    norm=nodes.new('ShaderNodeNormalMap')
    links.new(tex.outputs['Color'],norm.inputs['Color'])
    links.new(norm.outputs['Normal'],p.inputs['Normal'])
    rough=image_node('roughness',np.repeat(np.clip(roughness+(grain-.5)*.12,0,1)[:,:,None],3,2),True)
    links.new(rough.outputs['Color'],p.inputs['Roughness'])

def material(name, color, roughness=.75, metal=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metal
    if name in ('Warm ivory render','Charcoal facade','Graphite roof','Terracotta brick','Porch concrete','Yard grass'):
        surface_maps(m,color,roughness,.22 if name!='Graphite roof' else .07)
    return m

ivory = material('Warm ivory render', (.77,.75,.67))
charcoal = material('Charcoal facade', (.19,.20,.19))
roof = material('Graphite roof', (.085,.10,.115), .65)
metal = material('Powder coated frames', (.045,.052,.052), .4, .35)
glass = material('Smoked blue glazing', (.095,.14,.16), .11, .12)
glass.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=.8
glass.node_tree.nodes.get('Principled BSDF').inputs['Coat Roughness'].default_value=.08
brick = material('Terracotta brick', (.48,.18,.095))
mortar = material('Brick mortar', (.36,.29,.23))
concrete = material('Porch concrete', (.59,.58,.53))
door = material('Dark timber door', (.18,.15,.12))
parts = []

def box(name, loc, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if any(s in name.lower() for s in ('frame','hood','canopy','post','doorstep')):
        bevel=o.modifiers.new('Crisp edge highlight','BEVEL')
        bevel.width=.008
        bevel.segments=1
        bpy.ops.object.modifier_apply(modifier=bevel.name)
    o.data.materials.append(mat)
    parts.append(o)
    return o

def beam(name, a, b, width, depth, mat):
    v = Vector(b)-Vector(a)
    o = box(name, (Vector(a)+Vector(b))/2, (width,depth,v.length),mat)
    o.rotation_euler = v.to_track_quat('Z','Y').to_euler()
    return o

def prism(name, points, y0, y1, mat):
    n=len(points)
    verts=[(x,y,z) for y in (y0,y1) for x,z in points]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    o=bpy.data.objects.new(name,mesh)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    parts.append(o)
    return o

# Blender +Y is the street front, exported as glTF -Z. Z becomes glTF Y.
# The 6.10 x 21.34 m lot is a scale reference, not exported geometry.
body=box('House body', (0,-2,3.45),(6.10,12,6.9),ivory)
box('Porch slab', (0,6,.10),(6.10,4,.20),concrete)
box('Front doorstep', (0,4.2,.24),(5.6,.6,.18),ivory)
prism('Asymmetric roof volume',[(-3.05,6.85),(-3.05,7.45),(.45,8.60),(3.05,7.65),(3.05,6.85)],-8,4.06,charcoal)
for a,b in [((-3.05,7.45),(.45,8.60)),((.45,8.60),(3.05,7.65))]:
    # Thin roof planes with enough depth to show the eaves.
    prism('Roof sheet',[(a[0],a[1]),(b[0],b[1]),(b[0],b[1]+.10),(a[0],a[1]+.10)],-8.12,4.12,roof)
    beam('Front roof fascia',(a[0],4.18,a[1]),(b[0],4.18,b[1]),.105,.15,ivory)
    for i in range(26):
        y=-8.05+i*.48
        beam('Roof standing seam',(a[0],y,a[1]+.105),(b[0],y,b[1]+.105),.025,.025,roof)

# Front charcoal module and asymmetric white outline.
facade=box('Charcoal upper front',(.75,4.18,5.25),(4.45,.38,3.70),charcoal)
for x,top in [(-1.475,7.97),(3.0,7.67)]:
    box('Facade edge',(x,4.43,(3.35+top)/2),(.10,.17,top-3.35),ivory)
box('Facade sill',(.75,4.43,3.4),(4.55,.22,.12),ivory)
box('Center fin',(.45,4.43,6.0),(.10,.26,5.2),ivory)

def window(name,x,y,z,w,h):
    for dx in (-w/2+.035,w/2-.035):
        box(name+' frame jamb',(x+dx,y+.08,z),(.07,.28,h),metal)
    for dz in (-h/2+.035,h/2-.035):
        box(name+' frame rail',(x,y+.08,z+dz),(w,.28,.07),metal)
    box(name+' glazing',(x,y-.045,z),(w-.12,.035,h-.12),glass)
    box(name+' mullion',(x,y+.04,z),(.045,.16,h),metal)

def opening(obj,loc,size):
    cutter=box('Opening cutter',loc,size,ivory)
    bpy.context.view_layer.objects.active=obj
    mod=obj.modifiers.new('Window recess','BOOLEAN')
    mod.operation='DIFFERENCE'
    mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.remove(cutter)
    bpy.data.objects.remove(cutter,do_unlink=True)

for x in (-.52,1.77):
    opening(facade,(x,4.2,4.63),(1.28,.8,2.21))
    window('Tall upper window',x,4.15,4.63,1.27,2.20)
    box('Upper pale panel',(x,4.43,6.65),(1.31,.10,1.49),ivory)
    box('Window hood',(x,4.43,5.80),(1.52,.60,.10),ivory)
    box('Juliet rail top',(x,4.57,4.28),(1.4,.045,.045),metal)
    box('Juliet rail bottom',(x,4.57,3.55),(1.4,.045,.045),metal)
    for i in range(12):
        box('Juliet baluster',(x-.65+i*1.3/11,4.57,3.92),(.022,.026,.73),metal)

# A recessed side module with genuinely open screen holes.
box('Screen dark recess',(-2.40,4.10,5.15),(1.12,.12,3.35),charcoal)
for x in (-3.0,-1.79):
    box('Screen surround',(x,4.34,5.18),(.12,.35,3.55),ivory)
window('Recess window',-2.40,4.22,5.22,.80,.45)
for zbase,rows in [(3.43,4),(6.05,5)]:
    for row in range(rows+1):
        box('Screen horizontal',(-2.40,4.39,zbase+row*.19),(1.13,.24,.055),ivory)
    for col in range(7):
        box('Screen vertical',(-2.96+col*.187,4.39,zbase+rows*.095),(.05,.24,rows*.19),ivory)
box('Brick backing',(-1.63,4.17,5.22),(.23,.20,3.63),mortar)
for row in range(40):
    if row%2:
        for dx in (-.057,.057):
            box('Brick half',(-1.63+dx,4.29,3.45+row*.09),(.10,.055,.072),brick)
    else:
        box('Brick course',(-1.63,4.29,3.45+row*.09),(.215,.055,.072),brick)

# Porch canopy, slender posts, entry and living-room glazing.
box('Porch canopy',(0,6,3.11),(6.10,4,.16),ivory)
box('Canopy front fascia',(0,7.94,3.18),(6.10,.12,.29),roof)
for x in (-2.88,2.88):
    box('Porch post',(x,7.70,1.60),(.12,.12,2.90),metal)
    box('Canopy side fascia',(x,6,3.18),(.13,4,.29),roof)
box('Entry frame',(-2.03,4.10,1.50),(1.05,.15,2.50),metal)
box('Entry door',(-2.03,4.20,1.48),(.90,.07,2.33),door)
box('Door handle',(-1.72,4.26,1.40),(.025,.045,.25),metal)
window('Living room',.68,4.12,1.52,3.60,2.48)
for x in (-.51,.68,1.87):
    box('Living room mullion',(x,4.24,1.52),(.055,.06,2.48),metal)
box('Living room transom',(.68,4.24,2.44),(3.6,.06,.05),metal)
# Intermediate terrace party walls are plain. Rear details are inferred.
for x in (-1.65,1.65):
    window('Rear window',x,-8.08,4.85,1.15,1.35)
    # Rear pane must face outwards.
    box('Rear outer glazing',(x,-8.16,4.85),(1.03,.03,1.23),glass)
box('Rear door',(1.65,-8.10,1.28),(.95,.13,2.36),door)

def prepare(objects):
    # Planar UVs in metre units keep plaster grain consistent across different pieces.
    for obj in objects:
        mesh=obj.data
        uv=mesh.uv_layers.active or mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            axis=max(range(3),key=lambda i:abs(poly.normal[i]))
            axes=[i for i in range(3) if i!=axis]
            for loop in poly.loop_indices:
                co=obj.matrix_world @ mesh.vertices[mesh.loops[loop].vertex_index].co
                uv.data[loop].uv=(co[axes[0]],co[axes[1]])
    groups={}
    for obj in objects:
        groups.setdefault(obj.data.materials[0],[]).append(obj)
    result=[]
    bpy.ops.object.select_all(action='DESELECT')
    for mat,group in groups.items():
        for obj in group: obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1: bpy.ops.object.join()
        obj=bpy.context.object
        obj.name=mat.name
        bpy.context.scene.cursor.location=(0,0,0)
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        result.append(obj)
        bpy.ops.object.select_all(action='DESELECT')
    return result

def export(objects,variant):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    path=OUT/('elmina-'+variant+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True)
    coords=[o.matrix_world @ Vector(v) for o in objects for v in o.bound_box]
    lo=[min(v[i] for v in coords) for i in range(3)]
    hi=[max(v[i] for v in coords) for i in range(3)]
    triangles=0
    for o in objects:
        o.data.calc_loop_triangles()
        triangles+=len(o.data.loop_triangles)
    assert triangles<12000,triangles
    assert abs(lo[2])<.001,lo
    dims=[round(hi[i]-lo[i],3) for i in range(3)]
    if variant=='intermediate':
        assert all(abs(a-b)<.002 for a,b in zip(dims,[6.149,16.175,8.717])),dims
    stats={'file':path.name,'dimensions_m':dict(zip(['width','depth','height'],dims)),
           'triangles':triangles,'materials':len(objects),'texture_sizes':'256 x 256 pixels, embedded original albedo, normal and roughness maps',
           'units':'metres','up':'+Y','front':'-Z','origin':'Same house ground origin for both variants',
           'house_body_m':[6.10,12.0],'porch_depth_m':4.0,'lot_reference_m':[6.10,21.34],
           'yard_width_m':3.0 if variant=='end' else 0,'file_bytes':path.stat().st_size}
    (OUT/('model-stats.json' if variant=='intermediate' else 'end-model-stats.json')).write_text(json.dumps(stats,indent=2)+'\n')
    print('MODEL_STATS '+json.dumps(stats),flush=True)
    return stats

def aim(o,point):
    o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()

def studio():
    floor=material('Studio floor',(.24,.28,.27))
    box('Studio floor',(0,0,-.11),(2000,2000,.2),floor)
    world=bpy.context.scene.world
    world.use_nodes=True
    nodes=world.node_tree.nodes
    sky=nodes.new('ShaderNodeTexSky')
    sky.sky_type='HOSEK_WILKIE'
    sky.sun_direction=Vector((-.5,.5,.65)).normalized()
    sky.turbidity=2.5
    world.node_tree.links.new(sky.outputs['Color'],nodes['Background'].inputs[0])
    nodes['Background'].inputs[1].default_value=.65
    bpy.ops.object.light_add(type='AREA',location=(-8,12,13))
    lamp=bpy.context.object
    lamp.data.energy=1500
    lamp.data.shape='DISK'
    lamp.data.size=7
    aim(lamp,(0,1,3))
    bpy.ops.object.light_add(type='AREA',location=(2,15,7))
    fill=bpy.context.object
    fill.data.energy=1000
    fill.data.shape='DISK'
    fill.data.size=9
    aim(fill,(0,3,3.5))
    bpy.ops.object.light_add(type='AREA',location=(12,0,12))
    side=bpy.context.object
    side.data.energy=1600
    side.data.size=8
    aim(side,(3,0,3))
    bpy.ops.object.camera_add()
    scene=bpy.context.scene
    scene.camera=bpy.context.object
    scene.render.engine='CYCLES'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.view_settings.exposure=.3
    scene.render.resolution_x=1400
    scene.render.resolution_y=1200
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    return scene

def render_views(scene,variant):
    cam=scene.camera
    cam.data.type='PERSP'
    cam.data.lens=40
    cam.location=(10 if variant=='end' else 2,26,1.65)
    aim(cam,(1 if variant=='end' else 0,3,4.1))
    scene.render.filepath=str(OUT/(variant+'-pedestrian.png'))
    bpy.ops.render.render(write_still=True)
    # MapLibre pitch is measured from vertical; default pitch 62 => elevation 28 degrees.
    distance=33
    bearing=math.radians(22)
    target=Vector((1 if variant=='end' else 0,0,3.2))
    cam.location=target+Vector((distance*math.sin(bearing),distance*math.cos(bearing),distance*math.tan(math.radians(28))))
    aim(cam,target)
    cam.data.lens=45
    scene.render.filepath=str(OUT/(variant+'-map-angle.png'))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/('elmina-'+variant+'.blend')))
    bpy.ops.render.render(write_still=True)

# Preserve individual closed objects for side-window booleans. Boolean operations
# on the merged ivory mesh would also damage intersecting screen and trim pieces.
end_parts=[]
for obj in parts:
    clone=obj.copy()
    clone.data=obj.data.copy()
    end_parts.append(clone)
intermediate=prepare(parts)
export(intermediate,'intermediate')
# Keep the reference filename current for existing links.
scene=studio()
render_views(scene,'intermediate')
import shutil
shutil.copyfile(OUT/'intermediate-map-angle.png',OUT/'front-three-quarter.png')

# Preserve the intermediate asset and plain party walls, then derive a separate end unit.
parts=end_parts
for obj in intermediate:
    obj.hide_render=True
    obj.hide_set(True)
for obj in parts:
    bpy.context.collection.objects.link(obj)
end_body=next(o for o in parts if o.name.startswith('House body'))
screen_vertices=sum(len(o.data.vertices) for o in parts if o.name.startswith('Screen '))

def side_window(y,z,w,h):
    opening(end_body,(3.02,y,z),(.65,w,h))
    for offset in (-w/2+.04,w/2-.04):
        box('Side frame jamb',(3.04,y+offset,z),(.22,.08,h),metal)
    for offset in (-h/2+.04,h/2-.04):
        box('Side frame rail',(3.04,y,z+offset),(.22,w,.08),metal)
    box('Side glazing',(2.95,y,z),(.035,w-.12,h-.12),glass)
    box('Side mullion',(3.04,y,z),(.15,.045,h),metal)
    box('Side window hood',(3.17,y,z+h/2+.08),(.35,w+.20,.09),ivory)

for y,z,w,h in [(1.5,4.65,.85,2.1),(-3.2,4.65,.85,2.1),(-6.0,5.1,.9,.55),(-2.9,1.55,1.6,1.25)]:
    side_window(y,z,w,h)
assert screen_vertices==sum(len(o.data.vertices) for o in parts if o.name.startswith('Screen '))
grass=material('Yard grass',(.17,.25,.085),.95)
box('Side lawn',(4.55,0,.04),(3,16,.08),grass)
box('Side path',(3.50,0,.085),(.85,16,.09),concrete)
box('Yard boundary plinth',(6.0,0,.20),(.10,16,.4),ivory)
for y in (-7.85,-4,0,4,7.85):
    box('Fence pier',(6.0,y,.75),(.10,.16,1.1),ivory)
for z in (.48,1.25):
    box('Fence horizontal',(6.0,0,z),(.045,15.8,.045),metal)
for i in range(100):
    box('Fence upright',(6.0,-7.8+i*15.6/99,.86),(.025,.025,.78),metal)
# Yard meets the porch; leave an open access at the front.
box('Rear yard wall',(4.55,-7.94,.55),(3,.12,1.1),ivory)
end=prepare(parts)
export(end,'end')
render_views(scene,'end')

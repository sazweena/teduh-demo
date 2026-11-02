"""Update existing editable sources, export GLBs, and render a row from those GLBs.

Run with Blender --background --python-exit-code 1 --python scripts/add-elmina-gates.py.
Blender scene axes are Z up, +Y front; glTF export converts to Y up, -Z front.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector

OUT=Path(__file__).resolve().parents[1]/'assets/models/elmina-house'
GATE_Y=7.93

def bounds(objects):
    points=[o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    return [[min(p[i] for p in points) for i in range(3)],
            [max(p[i] for p in points) for i in range(3)]]

def fingerprint(obj):
    values=(tuple(tuple(v.co) for v in obj.data.vertices),
            tuple(tuple(p.vertices) for p in obj.data.polygons),
            tuple(tuple(row) for row in obj.matrix_world),
            tuple(m.name for m in obj.data.materials))
    return hashlib.sha256(repr(values).encode()).hexdigest()

def box(name,loc,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object
    o.name=name
    o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    return o

def join(parts,name,pivot):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    o=bpy.context.object
    o.name=name
    bpy.context.scene.cursor.location=pivot
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    o['teduh_front_gate']=True
    return o

def panel(name,left,right,bottom,top,mat):
    width=right-left
    parts=[]
    for z in (bottom+.018,top-.018):
        parts.append(box(name,((left+right)/2,GATE_Y,z),(width,.045,.036),mat))
    for x in (left+.018,right-.018):
        parts.append(box(name,(x,GATE_Y,(bottom+top)/2),(.036,.045,top-bottom-.072),mat))
    count=math.ceil((width-.072)/.13)
    for i in range(1,count):
        x=left+.036+(width-.072)*i/count
        parts.append(box(name,(x,GATE_Y,(bottom+top)/2),(.018,.025,top-bottom-.072),mat))
    return parts

report={}
for variant in ('intermediate','end'):
    bpy.ops.wm.open_mainfile(filepath=str(OUT/f'elmina-{variant}.blend'))
    bpy.context.preferences.filepaths.save_version=0
    # The end source retains hidden intermediate meshes; never export those.
    for o in list(bpy.data.objects):
        if o.get('teduh_front_gate'):
            bpy.data.objects.remove(o,do_unlink=True)
    house=[o for o in bpy.context.scene.objects if o.type=='MESH'
           and not o.hide_render and not o.name.startswith('Studio floor')]
    before=bounds(house)
    hashes={o.name:fingerprint(o) for o in house}
    mat=next(m for m in bpy.data.materials if m.name=='Powder coated frames')
    vehicle=join(panel('Vehicle gate',-1.65,1.55,.24,1.54,mat),
                 'VehicleGate',(-1.65,GATE_Y,.24))
    pedestrian=join(panel('Pedestrian gate',1.69,2.59,.24,1.54,mat),
                    'PedestrianGate',(2.59,GATE_Y,.24))
    vehicle['clear_width_m']=3.2
    pedestrian['clear_width_m']=.9
    for gate in (vehicle,pedestrian):
        gate['height_m']=1.3
        gate['state']='closed'
    fixed=[]
    for x in (-2.99,-1.72,1.62,2.66,2.99):
        fixed.append(box('Boundary post',(x,GATE_Y,.88),(.08,.10,1.36),mat))
    fixed+=panel('Left boundary',-2.93,-1.79,.24,1.54,mat)
    fixed+=panel('Right boundary',2.73,2.93,.24,1.54,mat)
    boundary=join(fixed,'FrontBoundary',(0,0,0))
    added=[vehicle,pedestrian,boundary]
    if variant=='end':
        # Meet the existing side pier at x=5.95, y=7.93 without crossing it.
        connector=join(panel('Yard return',3.03,5.95,.12,1.2725,mat),
                       'YardFrontBoundary',(0,0,0))
        added.append(connector)
    for o in house:
        assert hashes[o.name]==fingerprint(o),f'Existing geometry changed: {o.name}'
    all_objects=house+added
    after=bounds(all_objects)
    assert all(abs(a-b)<1e-6 for aa,bb in zip(before,after) for a,b in zip(aa,bb))
    main_bounds=bounds([vehicle,pedestrian,boundary])
    assert main_bounds[0][0]>-3.05 and main_bounds[1][0]<3.05
    assert main_bounds[1][1]<8.0
    assert main_bounds[0][1]>7.76 # Porch column front face.
    assert bounds([vehicle,pedestrian])[0][2]>.20 # Porch slab top.
    bpy.ops.object.select_all(action='DESELECT')
    for o in all_objects: o.select_set(True)
    bpy.context.view_layer.objects.active=vehicle
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'elmina-{variant}.glb'),
        export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'elmina-{variant}.blend'))
    triangles=0
    for o in all_objects:
        o.data.calc_loop_triangles()
        triangles+=len(o.data.loop_triangles)
    assert triangles<12000
    statfile=OUT/('model-stats.json' if variant=='intermediate' else 'end-model-stats.json')
    stats=json.loads(statfile.read_text())
    stats.update(triangles=triangles,materials=len({m.name for o in all_objects for m in o.data.materials}),
        mesh_objects=len(all_objects),file_bytes=(OUT/f'elmina-{variant}.glb').stat().st_size,
        gates={'vehicle_width_m':3.2,'pedestrian_width_m':.9,'height_m':1.3,
               'objects':['VehicleGate','PedestrianGate'],'position':'closed'})
    statfile.write_text(json.dumps(stats,indent=2)+'\n')
    report[variant]={'original_geometry_unchanged':True,'bounds_unchanged':True,
        'bounds_blender_Z_up':after,'triangles':triangles,'gate_bottom_clearance_m':.04,
        'porch_column_clearance_m':round(main_bounds[0][1]-7.76,3),
        'front_edge_clearance_m':round(8-main_bounds[1][1],3),
        'neighbor_post_clearance_at_6_1m_spacing':round(6.1-(main_bounds[1][0]-main_bounds[0][0]),3)}

# Compose the inspection row from the exported assets, not the modeling meshes.
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
row_gates=[]
for i in range(5):
    variant='end' if i==0 else 'intermediate'
    old=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(OUT/f'elmina-{variant}.glb'))
    imported=list(set(bpy.data.objects)-old)
    root=bpy.data.objects.new(f'Unit_{i+1:02d}_{variant}',None)
    scene.collection.objects.link(root)
    for o in imported:
        if o.parent is None: o.parent=root
        if o.type=='MESH':
            o.name=f'Unit_{i+1:02d}/{o.name}'
            if 'VehicleGate' in o.name or 'PedestrianGate' in o.name:
                row_gates.append(o)
    root.location.x=-6.1*i
bpy.context.view_layer.update()
assert len(row_gates)==10
for i in range(5):
    gates=[o for o in row_gates if o.name.startswith(f'Unit_{i+1:02d}/')]
    assert len(gates)==2
    assert sorted(round(o.dimensions.x,2) for o in gates)==[.9,3.2]
    for gate in gates:
        b=bounds([gate])
        assert b[0][2]>.20 and b[1][1]<8.0
        assert b[0][0]>-6.1*i-3.05 and b[1][0]<-6.1*i+3.05
report['row']={'units':5,'end_units':1,'intermediate_units':4,'gate_objects':10,
               'spacing_m':6.1,'source':'Reimported exported GLBs',
               'verified':'Each unit has separate vehicle and pedestrian gates inside its frontage'}
(OUT/'gate-validation.json').write_text(json.dumps(report,indent=2)+'\n')

ground=bpy.data.materials.new('Row studio ground')
ground.diffuse_color=(.28,.31,.29,1)
box('Render-only ground',(-10,0,-.11),(2000,2000,.2),ground)
world=bpy.data.worlds.new('Row daylight')
scene.world=world
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.73,.85,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.65
def aim(o,target):
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
for loc,power,size in [((-10,14,20),6500,18),((12,0,14),3000,10),((-24,8,12),3000,12)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object
    light.data.energy=power
    light.data.size=size
    aim(light,(-10,0,3))
bpy.ops.object.camera_add(location=(9,57,1.65))
scene.camera=bpy.context.object
scene.camera.data.lens=48
aim(scene.camera,(-10,3,3.8))
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=2000
scene.render.resolution_y=1100
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUT/'five-house-row-pedestrian.png')
bpy.ops.render.render(write_still=True)
target=Vector((-10,0,3))
horizontal=Vector((26,49,0))
scene.camera.location=target+horizontal+Vector((0,0,horizontal.length*math.tan(math.radians(28))))
scene.camera.data.lens=45
aim(scene.camera,target)
scene.render.filepath=str(OUT/'five-house-row-map-angle.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'five-house-row.blend'))
bpy.ops.render.render(write_still=True)
print('GATE_VALIDATION '+json.dumps(report),flush=True)

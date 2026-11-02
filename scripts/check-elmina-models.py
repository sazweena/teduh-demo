"""Validate the actual GLB payloads without Blender or third-party packages."""
import json
import struct
import itertools
from pathlib import Path

root=Path(__file__).resolve().parents[1]/'assets/models/elmina-house'
for variant in ('intermediate','end'):
    path=root/f'elmina-{variant}.glb'
    data=path.read_bytes()
    assert struct.unpack_from('<4sII',data)==(b'glTF',2,len(data))
    size,kind=struct.unpack_from('<II',data,12)
    assert kind==0x4e4f534a
    gltf=json.loads(data[20:20+size])
    binary=data[28+size:]
    assert not gltf.get('cameras')
    assert all('uri' not in b for b in gltf['buffers'])
    primitives=[p for m in gltf['meshes'] for p in m['primitives']]
    triangles=sum(gltf['accessors'][p['indices']]['count']//3 for p in primitives)
    stats=json.loads((root/('model-stats.json' if variant=='intermediate' else 'end-model-stats.json')).read_text())
    assert triangles==stats['triangles']<12000
    # Gate meshes have hinge pivots, so accessor bounds need their node transforms.
    identity=[[1 if i==j else 0 for j in range(4)] for i in range(4)]
    def multiply(a,b):
        return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
    def local_matrix(node):
        if 'matrix' in node:
            return [[node['matrix'][j*4+i] for j in range(4)] for i in range(4)]
        x,y,z,w=node.get('rotation',[0,0,0,1])
        r=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
           [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
           [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
        scale=node.get('scale',[1,1,1]); t=node.get('translation',[0,0,0])
        return [[r[i][j]*scale[j] for j in range(3)]+[t[i]] for i in range(3)]+[[0,0,0,1]]
    points=[]
    gates={}
    def visit(index,parent):
        node=gltf['nodes'][index]
        world=multiply(parent,local_matrix(node))
        if 'mesh' in node:
            corners=[]
            for p in gltf['meshes'][node['mesh']]['primitives']:
                a=gltf['accessors'][p['attributes']['POSITION']]
                for xyz in itertools.product(*zip(a['min'],a['max'])):
                    corners.append([sum(world[i][j]*(*xyz,1)[j] for j in range(4)) for i in range(3)])
            points.extend(corners)
            if node.get('name') in ('VehicleGate','PedestrianGate'):
                gates[node['name']]=corners
        for child in node.get('children',[]): visit(child,world)
    for index in gltf['scenes'][gltf.get('scene',0)]['nodes']: visit(index,identity)
    lo=[min(p[i] for p in points) for i in range(3)]
    hi=[max(p[i] for p in points) for i in range(3)]
    assert set(gates)=={'VehicleGate','PedestrianGate'}
    for name,width in [('VehicleGate',3.2),('PedestrianGate',.9)]:
        corners=gates[name]
        assert abs(max(p[0] for p in corners)-min(p[0] for p in corners)-width)<.001
        assert min(p[1] for p in corners)>.20
        assert min(p[2] for p in corners)>-8.0
    assert abs(lo[1])<.001
    assert abs(hi[1]-8.717)<.002
    if variant=='intermediate':
        assert abs(hi[0]-lo[0]-6.149)<.002
        assert abs(hi[2]-lo[2]-16.175)<.002
    dimensions=[]
    for image in gltf['images']:
        assert 'uri' not in image and image['mimeType']=='image/png'
        view=gltf['bufferViews'][image['bufferView']]
        start=view.get('byteOffset',0)
        png=binary[start:start+view['byteLength']]
        assert png[:8]==b'\x89PNG\r\n\x1a\n'
        width,height=struct.unpack_from('>II',png,16)
        assert width<=1024 and height<=1024
        dimensions.append([width,height])
    assert dimensions and all(d==[256,256] for d in dimensions)
    assert sum('normalTexture' in m for m in gltf['materials'])>=5
    print(json.dumps({'variant':variant,'triangles':triangles,'bytes':len(data),
                      'embedded_images':len(dimensions),'texture_dimensions':[256,256],
                      'bounds_Y_up':[lo,hi],'validated':True}))

"""Validate the actual GLB payloads without Blender or third-party packages."""
import json
import struct
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
    bounds=[gltf['accessors'][p['attributes']['POSITION']] for p in primitives]
    lo=[min(a['min'][i] for a in bounds) for i in range(3)]
    hi=[max(a['max'][i] for a in bounds) for i in range(3)]
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

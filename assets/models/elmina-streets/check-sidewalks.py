"""Independent checks of exported GLB buffers, using only Python's standard library."""
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent
results = {}
for variant in ('plain','tree-ready','sideyard-3m'):
    data = (ROOT/f'elmina-sidewalk-{variant}.glb').read_bytes()
    assert struct.unpack_from('<4sII',data) == (b'glTF',2,len(data))
    size,kind = struct.unpack_from('<II',data,12)
    assert kind == 0x4e4f534a
    doc = json.loads(data[20:20+size])
    binary = data[28+size:]
    def accessor(i):
        a = doc['accessors'][i]
        v = doc['bufferViews'][a['bufferView']]
        fmt = {5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
        n = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        stride = v.get('byteStride',struct.calcsize('<'+fmt*n))
        start = v.get('byteOffset',0)+a.get('byteOffset',0)
        return [struct.unpack_from('<'+fmt*n,binary,start+j*stride) for j in range(a['count'])]
    objects = {}
    for node in doc['nodes']:
        if 'mesh' not in node: continue
        # Our meshes are baked at the common ground origin, without node transforms.
        assert 'matrix' not in node and 'rotation' not in node
        assert node.get('translation',[0,0,0]) == [0,0,0]
        assert node.get('scale',[1,1,1]) == [1,1,1]
        verts,triangles = [],[]
        for p in doc['meshes'][node['mesh']]['primitives']:
            vv = accessor(p['attributes']['POSITION'])
            assert 'TEXCOORD_0' in p['attributes'] and 'NORMAL' in p['attributes']
            assert all(all(abs(c)<100 for c in uv) for uv in accessor(p['attributes']['TEXCOORD_0']))
            idx = [x[0] for x in accessor(p['indices'])]
            triangles += [[vv[idx[j+k]] for k in range(3)] for j in range(0,len(idx),3)]
            verts += vv
        objects[node['name']] = {'vertices':verts,'triangles':triangles}
    vertices = [v for o in objects.values() for v in o['vertices']]
    lo = [min(v[i] for v in vertices) for i in range(3)]
    hi = [max(v[i] for v in vertices) for i in range(3)]
    width = 3 if variant=='sideyard-3m' else 6.1
    assert all(abs(a-b)<1e-5 for a,b in zip(lo,[-width/2,0,-3]))
    assert all(abs(a-b)<1e-5 for a,b in zip(hi,[width/2,.2,0]))
    walk = [o for n,o in objects.items() if any(t in n for t in ('ClearWalk','CrossingWalk','PedestrianApproach'))]
    for o in walk:
        for x,y,z in o['vertices']:
            assert -1.80001<=z<=.00001
            assert abs(y)<1e-6 or abs(y-(.2+.02*z))<1e-6
    # A vertical ray inside every sampled point of the well must miss ALL paving.
    def contains_xz(tri,x,z):
        (a,_,b),(c,_,d),(e,_,f) = tri
        den=(d-f)*(a-e)+(e-c)*(b-f)
        if abs(den)<1e-9: return False
        u=((d-f)*(x-e)+(e-c)*(z-f))/den
        v=((f-b)*(x-e)+(a-e)*(z-f))/den
        return u>=-1e-6 and v>=-1e-6 and u+v<=1.000001
    if variant=='tree-ready':
        paving=[t for n,o in objects.items() if 'Soil' not in n for t in o['triangles']]
        for x in (-2.84,-2.6,-2.35,-2.1,-1.86):
            for z in (-2.89,-2.65,-2.4,-2.15,-1.91):
                assert not any(contains_xz(t,x,z) for t in paving), 'Paving covers tree well'
        assert -1.85 < -1.65 and -1.9 < -1.8
    images=[]
    for im in doc['images']:
        assert 'uri' not in im and im['mimeType']=='image/png'
        v=doc['bufferViews'][im['bufferView']]
        pos=v.get('byteOffset',0)
        assert binary[pos:pos+8]==b'\x89PNG\r\n\x1a\n'
        dims=struct.unpack_from('>II',binary,pos+16)
        assert max(dims)<=1024
        images.append(dims)
    assert all('normalTexture' in m for m in doc['materials'])
    count=sum(len(o['triangles']) for o in objects.values())
    assert count<500 and not doc.get('cameras')
    results[variant]={'validated':True,'bounds_Y_up':[lo,hi],'triangles':count,
                     'objects':{n:len(o['triangles']) for n,o in objects.items()},
                     'embedded_PNG_dimensions':images,'file_bytes':len(data)}
    # Both end planes have the same walk/service/curb profile, allowing exact repetition.
    ends=[]
    for xend in (-width/2,width/2):
        ends.append(sorted({(round(y,5),round(z,5)) for x,y,z in vertices if abs(x-xend)<1e-5}))
    assert ends[0]==ends[1], 'Unequal seam profiles'
(ROOT/'glb-checks.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps({k:{p:v[p] for p in ('validated','triangles','file_bytes')} for k,v in results.items()},indent=2))

"""Check actual road GLB buffers and PNG seams independently of the builder."""
import hashlib
import io
import json
import struct
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent
def read_glb(path):
    raw=path.read_bytes()
    assert struct.unpack_from('<4sII',raw)==(b'glTF',2,len(raw))
    size,kind=struct.unpack_from('<II',raw,12)
    assert kind==0x4e4f534a
    doc=json.loads(raw[20:20+size])
    return doc,raw[28+size:]

def read_accessor(doc,binary,index):
    a=doc['accessors'][index]
    v=doc['bufferViews'][a['bufferView']]
    fmt={5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
    n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    step=v.get('byteStride',struct.calcsize('<'+fmt*n))
    offset=v.get('byteOffset',0)+a.get('byteOffset',0)
    return [struct.unpack_from('<'+fmt*n,binary,offset+i*step) for i in range(a['count'])]

checks={}
for filename,expected_name,lo,hi in [
    ('elmina-road-straight.glb','Road_Asphalt_6p10x6p00',[-3.05,0,-3],[3.05,0,3]),
    ('elmina-road-optional-centre-dash.glb','Optional_CentreDash_3m',[-1.5,.001,-.05],[1.5,.001,.05]),
]:
    doc,binary=read_glb(ROOT/filename)
    assert len(doc['meshes'])==1 and len(doc['nodes'])==1
    node=doc['nodes'][0]
    assert node['name']==expected_name
    assert not any(k in node for k in ('translation','rotation','scale','matrix'))
    assert not doc.get('cameras')
    prim=doc['meshes'][0]['primitives'][0]
    verts=read_accessor(doc,binary,prim['attributes']['POSITION'])
    uv=read_accessor(doc,binary,prim['attributes']['TEXCOORD_0'])
    normals=read_accessor(doc,binary,prim['attributes']['NORMAL'])
    indices=read_accessor(doc,binary,prim['indices'])
    assert len(indices)==6 and len(verts)==4
    actual_lo=[min(v[i] for v in verts) for i in range(3)]
    actual_hi=[max(v[i] for v in verts) for i in range(3)]
    assert all(abs(a-b)<1e-6 for a,b in zip(actual_lo,lo))
    assert all(abs(a-b)<1e-6 for a,b in zip(actual_hi,hi))
    assert all(abs(n[1]-1)<1e-6 for n in normals)
    assert all(abs(v[1]-lo[1])<1e-6 for v in verts)
    assert sorted(tuple(round(c,6) for c in pair) for pair in uv)==[(0,0),(0,1),(1,0),(1,1)]
    for vertex,tex in zip(verts,uv):
        assert abs(tex[0]-(vertex[0]-lo[0])/(hi[0]-lo[0]))<1e-6
        assert abs(tex[1]-(vertex[2]-lo[2])/(hi[2]-lo[2]))<1e-6
    checks[filename]={'bounds_Y_up_m':[actual_lo,actual_hi],'triangles':2,'vertices':4,
                      'object':expected_name,'file_bytes':(ROOT/filename).stat().st_size,'validated':True}
    if filename=='elmina-road-straight.glb':
        m=doc['materials'][0]
        assert 'normalTexture' in m and 'baseColorTexture' in m['pbrMetallicRoughness']
        assert 'metallicRoughnessTexture' in m['pbrMetallicRoughness']
        assert len(doc['materials'])==1
        embedded=[]
        for im in doc['images']:
            assert im['mimeType']=='image/png' and 'uri' not in im
            view=doc['bufferViews'][im['bufferView']]
            start=view.get('byteOffset',0)
            png=Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB')
            assert png.size==(512,512)
            assert png.crop((0,0,512,1)).tobytes()==png.crop((0,511,512,512)).tobytes()
            assert png.crop((0,0,1,512)).tobytes()==png.crop((511,0,512,512)).tobytes()
            embedded.append({'size':[512,512],'opposite_edges_identical':True})
        checks[filename]['embedded_textures']=embedded

for kind in ('albedo','normal','roughness'):
    png=Image.open(ROOT/'textures'/f'Elmina_asphalt_{kind}.png').convert('RGB')
    assert png.size==(512,512)
    assert png.crop((0,0,512,1)).tobytes()==png.crop((0,511,512,512)).tobytes()
    assert png.crop((0,0,1,512)).tobytes()==png.crop((511,0,512,512)).tobytes()
checks['external_textures_seamless']=True
report_path=ROOT/'road-dimensions-and-validation.json'
if report_path.exists():
    report=json.loads(report_path.read_text())
    assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in report['protected_sha256'].items())
    assert report['fit']['horizontal_gap_m']==report['fit']['horizontal_overlap_m']==0
    checks['protected_assets_unchanged']=True
(ROOT/'road-glb-checks.json').write_text(json.dumps(checks,indent=2)+'\n')
print(json.dumps(checks,indent=2))

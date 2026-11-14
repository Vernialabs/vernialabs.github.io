"""Convert the pinned upstream viewer URDF + binary STLs into an indexed GLB.

Usage: python tools/build-gripper-model.py .qa/cad-source
Source meshes are unmodified Pollen Robotics Grabette viewer assets, Apache-2.0.
This conversion keeps all visuals, origins, colors, and articulated joint axes.
"""
from pathlib import Path
import gzip, hashlib, json, math, struct, sys, xml.etree.ElementTree as ET

SOURCE_COMMIT = '1707d4e2ec542a3038b858fae7e919f95ea27305'
source = Path(sys.argv[1] if len(sys.argv) > 1 else '.qa/cad-source')
destination = Path('assets/models/grip-one')
root = ET.parse(source / 'robot.urdf').getroot()
binary = bytearray()
gltf = {'asset': {'version': '2.0', 'generator': 'Vernia Labs URDF to GLB converter', 'copyright': 'Copyright 2026 Pollen Robotics. Apache-2.0.'}, 'scene': 0, 'scenes': [], 'nodes': [], 'meshes': [], 'materials': [], 'buffers': [], 'bufferViews': [], 'accessors': []}
mesh_cache, material_cache, geometry_cache = {}, {}, {}
source_files = []

def numbers(value, default):
    return [float(x) for x in value.split()] if value else default

def quaternion(rpy):
    r,p,y = [v / 2 for v in rpy]
    cr,sr,cp,sp,cy,sy = math.cos(r),math.sin(r),math.cos(p),math.sin(p),math.cos(y),math.sin(y)
    return [sr*cp*cy-cr*sp*sy, cr*sp*cy+sr*cp*sy, cr*cp*sy-sr*sp*cy, cr*cp*cy+sr*sp*sy]

def transform(element):
    if element is None: return {}
    return {'translation':numbers(element.get('xyz'),[0,0,0]), 'rotation':quaternion(numbers(element.get('rpy'),[0,0,0]))}

def node(value):
    gltf['nodes'].append(value)
    return len(gltf['nodes'])-1

def accessor(data, component, count, kind, target, bounds=None):
    while len(binary)%4: binary.append(0)
    view = len(gltf['bufferViews'])
    gltf['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data),'target':target})
    binary.extend(data)
    result={'bufferView':view,'componentType':component,'count':count,'type':kind}
    if bounds: result.update({'min':bounds[0],'max':bounds[1]})
    gltf['accessors'].append(result)
    return len(gltf['accessors'])-1

def geometry(filename):
    if filename in geometry_cache: return geometry_cache[filename]
    data=(source/filename).read_bytes()
    triangles=struct.unpack_from('<I',data,80)[0]
    assert len(data)==84+50*triangles, f'Invalid binary STL: {filename}'
    source_files.append({'file':filename,'sha256':hashlib.sha256(data).hexdigest(),'triangles':triangles})
    positions,normals,indices=[],[],[]
    unique={}
    for i in range(triangles):
        values=struct.unpack_from('<12f',data,84+50*i)
        normal=values[:3]
        for j in range(3):
            point=values[3+3*j:6+3*j]
            key=point+normal
            if key not in unique:
                unique[key]=len(positions)//3
                positions.extend(point);normals.extend(normal)
            indices.append(unique[key])
    assert all(math.isfinite(x) for x in positions+normals)
    count=len(positions)//3
    lower=[min(positions[i::3]) for i in range(3)]
    upper=[max(positions[i::3]) for i in range(3)]
    pa=accessor(struct.pack(f'<{len(positions)}f',*positions),5126,count,'VEC3',34962,(lower,upper))
    na=accessor(struct.pack(f'<{len(normals)}f',*normals),5126,count,'VEC3',34962)
    small=count<65536
    ia=accessor(struct.pack(f'<{len(indices)}'+('H' if small else 'I'),*indices),5123 if small else 5125,len(indices),'SCALAR',34963)
    geometry_cache[filename]={'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia}
    return geometry_cache[filename]

links={el.get('name'):node({'name':el.get('name'),'children':[]}) for el in root.findall('link')}
for link in root.findall('link'):
    for visual in link.findall('visual'):
        mesh=visual.find('geometry/mesh')
        filename=mesh.get('filename').split('/')[-1]
        color=visual.find('material/color')
        rgba=numbers(color.get('rgba') if color is not None else None,[.7,.7,.7,1])
        key=tuple(rgba)
        if key not in material_cache:
            mat={'name':visual.find('material').get('name'),'pbrMetallicRoughness':{'baseColorFactor':rgba,'metallicFactor':.12,'roughnessFactor':.45},'doubleSided':False}
            if rgba[3]<1: mat['alphaMode']='BLEND'
            material_cache[key]=len(gltf['materials']);gltf['materials'].append(mat)
        mesh_key=(filename,key)
        if mesh_key not in mesh_cache:
            primitive=dict(geometry(filename));primitive['material']=material_cache[key]
            mesh_cache[mesh_key]=len(gltf['meshes'])
            gltf['meshes'].append({'name':filename,'primitives':[primitive]})
        vi=node({'name':filename[:-4],'mesh':mesh_cache[mesh_key],**transform(visual.find('origin')),'scale':numbers(mesh.get('scale'),[1,1,1])})
        gltf['nodes'][links[link.get('name')]]['children'].append(vi)

children=set()
for joint in root.findall('joint'):
    parent=joint.find('parent').get('link');child=joint.find('child').get('link');children.add(child)
    origin=node({'name':joint.get('name')+'_origin',**transform(joint.find('origin')),'children':[]})
    extras={'type':joint.get('type'),'axis':numbers(joint.find('axis').get('xyz'),[0,0,1])}
    limit=joint.find('limit')
    if limit is not None: extras['limits']=[float(limit.get('lower')),float(limit.get('upper'))]
    pivot=node({'name':'joint_'+joint.get('name'),'extras':extras,'children':[links[child]]})
    gltf['nodes'][origin]['children'].append(pivot)
    gltf['nodes'][links[parent]]['children'].append(origin)

roots=[index for name,index in links.items() if name not in children]
assert len(roots)==1
up=node({'name':'CAD_orientation','rotation':quaternion([-math.pi/2,0,0]),'children':roots})
gltf['scenes']=[{'nodes':[up]}]
gltf['buffers']=[{'byteLength':len(binary)}]
encoded=json.dumps(gltf,separators=(',',':')).encode()
encoded+=b' '*((-len(encoded))%4)
binary+=b'\0'*((-len(binary))%4)
glb=struct.pack('<4sII',b'glTF',2,12+8+len(encoded)+8+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary
destination.mkdir(parents=True,exist_ok=True)
(destination/'grip-one.glb').write_bytes(glb)
(destination/'grip-one.glb.gz').write_bytes(gzip.compress(glb, compresslevel=9, mtime=0))
provenance={'repository':'https://github.com/pollen-robotics/grabette','commit':SOURCE_COMMIT,'source_path':'packages/grabette/urdf/grabette_right_viewer','license':'Apache-2.0','changes':['Indexed binary STL geometry and assembled original URDF transforms into glTF 2.0.','Retained all visual components, colors, joint axes and limits.','Added a coordinate-system root for browser presentation.'],'mesh_sha256':source_files,'glb_sha256':hashlib.sha256(glb).hexdigest()}
(destination/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
print(json.dumps({'glb_bytes':len(glb),'unique_meshes':len(geometry_cache),'visuals':sum(len(x.findall('visual')) for x in root.findall('link')),'triangles':sum(x['triangles'] for x in source_files)}))

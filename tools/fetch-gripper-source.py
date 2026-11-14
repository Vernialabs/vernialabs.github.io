"""Download the pinned upstream CAD source; uses Python's standard library."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

SHA = '1707d4e2ec542a3038b858fae7e919f95ea27305'
BASE = 'packages/grabette/urdf/grabette_right_viewer'
root = Path('.qa/cad-source')
root.mkdir(parents=True, exist_ok=True)
raw = f'https://raw.githubusercontent.com/pollen-robotics/grabette/{SHA}'
(root/'robot.urdf').write_bytes(urllib.request.urlopen(f'{raw}/{BASE}/robot.urdf', timeout=30).read())
files = sorted({e.attrib['filename'].split('/')[-1] for e in ET.parse(root/'robot.urdf').iter('mesh')})

def fetch(name):
    url = f'https://media.githubusercontent.com/media/pollen-robotics/grabette/{SHA}/{BASE}/assets/{name}'
    data = urllib.request.urlopen(url, timeout=60).read()
    if data.startswith(b'version https://git-lfs'): raise ValueError('Received LFS pointer instead of mesh')
    (root/name).write_bytes(data)
    return len(data)

with ThreadPoolExecutor(max_workers=6) as pool:
    sizes = list(pool.map(fetch, files))
print(f'Downloaded {len(files)} pinned meshes ({sum(sizes):,} bytes) into {root}')

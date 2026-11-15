// Build a compact display copy; retain the source CAD and all articulated nodes.
// Setup: npm install --prefix .qa/cad-tools @gltf-transform/core@4.2.1 @gltf-transform/extensions@4.2.1 @gltf-transform/functions@4.2.1
// Run from the repository root: node tools/optimize-gripper.mjs
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const require = createRequire(resolve('.qa/cad-tools/package.json'));
const load = name => import(pathToFileURL(require.resolve(name)));
const { NodeIO } = await load('@gltf-transform/core');
const { ALL_EXTENSIONS } = await load('@gltf-transform/extensions');
const { quantize, weld } = await load('@gltf-transform/functions');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const dir = 'assets/models/grip-one';
const doc = await io.read(`${dir}/grip-one.glb`);
const countTriangles = () => doc.getRoot().listMeshes().reduce((sum, mesh) => sum + mesh.listPrimitives().reduce((n, p) => n + p.getIndices().getCount() / 3, 0), 0);
const triangles = countTriangles();
const joints = doc.getRoot().listNodes().filter(n => n.getName().startsWith('joint_')).map(n => [n.getName(), n.getExtras()]);
await doc.transform(quantize({ quantizePosition: 16, quantizeNormal: 8 }), weld());
if (triangles !== countTriangles()) throw new Error('Triangle count changed');
for (const [name, extras] of joints) {
  const node = doc.getRoot().listNodes().find(n => n.getName() === name);
  if (!node || JSON.stringify(node.getExtras()) !== JSON.stringify(extras)) throw new Error(`Joint changed: ${name}`);
}
const bytes = await io.writeBinary(doc);
const gz = gzipSync(bytes, { level: 9 });
await writeFile(`${dir}/grip-one-web.glb`, bytes);
await writeFile(`${dir}/grip-one-web.glb.gz`, gz);
console.log(JSON.stringify({ sourceBytes: (await readFile(`${dir}/grip-one.glb.gz`)).length, optimizedBytes: gz.length, decodedBytes: bytes.length, triangles, joints: joints.length }));

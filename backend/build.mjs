import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
await build({entryPoints:['entry.mjs'],bundle:true,format:'esm',platform:'neutral',target:'es2022',conditions:['import','node'],outfile:'dist/worker.mjs',external:['node:*','cloudflare:*'],minify:true,loader:{'.jpg':'dataurl','.svg':'text'},
  plugins:[{name:'text-assets',setup(build){build.onLoad({filter:/ui[\\/](?:index\.html|admin\.css|admin\.js)$/},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));}}]});
console.log('Built backend/dist/worker.mjs');

// Run after npm ci && npm test && npm run build. Token is read only from the environment.
import {readFile} from 'node:fs/promises';
const token=process.env.CLOUDFLARE_API_TOKEN;
if(!token)throw Error('Set CLOUDFLARE_API_TOKEN in the process environment. Never commit it.');
const account='1f1e85e492e86e0b3b98894e8bf014b5';
const metadata=JSON.parse(await readFile(new URL('./deployment.json',import.meta.url),'utf8'));
const form=new FormData();form.append('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));form.append('worker.mjs',new Blob([await readFile(new URL('./dist/worker.mjs',import.meta.url))],{type:'application/javascript+module'}),'worker.mjs');
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/vernia-waitlist`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:form});
const result=await response.json();if(!response.ok||!result.success)throw Error('Deployment failed; review the Cloudflare API response in your secure operator environment.');console.log('Deployed Worker:',result.result.deployment_id);

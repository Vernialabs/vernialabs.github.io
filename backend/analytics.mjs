import {hash} from './admin.mjs';
const origins=new Set(['https://vernia.in','https://www.vernia.in']);
const paths=new Set(['/','/index.html','/hardware.html','/waitlist.html','/privacy.html','/404.html']);
export function forwardPosthog(env,event,session,properties={}) {
  if(!env.POSTHOG_PROJECT_KEY || !['https://us.i.posthog.com','https://eu.i.posthog.com'].includes(env.POSTHOG_HOST)) return Promise.resolve();
  return fetch(env.POSTHOG_HOST+'/i/v0/e/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:env.POSTHOG_PROJECT_KEY,event,properties:{distinct_id:session,$geoip_disable:true,$process_person_profile:false,...properties},timestamp:new Date().toISOString()}),signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)throw Error('Capture unavailable');});
}
export async function collect(request,env,ctx) {
  const origin=request.headers.get('origin');
  const headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://vernia.in','Vary':'Origin','Cache-Control':'no-store'};
  if(!origins.has(origin)) return new Response(null,{status:403});
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  if(request.method!=='POST') return new Response(null,{status:405,headers});
  const ip=request.headers.get('CF-Connecting-IP');
  if(!env.ANALYTICS_LIMITER||!ip || !(await env.ANALYTICS_LIMITER.limit({key:ip})).success) return new Response(null,{status:429,headers});
  const ua=request.headers.get('user-agent')||'';
  if(/bot|crawler|spider|headless|lighthouse|prerender|curl|wget|python|monitor/i.test(ua)||request.cf?.botManagement?.verifiedBot||request.cf?.botManagement?.score<30) return new Response(null,{status:204,headers});
  let raw=''; const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400,headers});
  let size=0; const decoder=new TextDecoder();
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return new Response(null,{status:413,headers});}raw+=decoder.decode(value,{stream:true});}
  let data;try{data=JSON.parse(raw+decoder.decode());}catch{return new Response(null,{status:400,headers});}
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  if(!uuid.test(data.session||'')||!uuid.test(data.id||'')||!['pageview','engaged','waitlist_view','cta'].includes(data.event)||!paths.has(data.path)) return new Response(null,{status:400,headers});
  const label=v=>typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,80}$/.test(v)?v:'';
  let referrer='';try{referrer=new URL(data.referrer).hostname.slice(0,100);}catch{}
  const source=label(data.source)||referrer||'direct';
  const campaign=label(data.campaign);
  const device=/iPad|Tablet/i.test(ua)?'Tablet':/Mobile|Android|iPhone/i.test(ua)?'Mobile':'Desktop';
  const session=await hash(data.session);
  const country=/^[A-Z]{2}$/.test(request.cf?.country||'')?request.cf.country:'Unknown';
  const inserted=await env.DB.prepare('INSERT OR IGNORE INTO analytics_events(id,session_id,event,path,referrer,source,campaign,country,device) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id').bind(data.id,session,data.event,data.path,referrer,source,campaign,country,device).first();
  if(inserted && env.POSTHOG_PROJECT_KEY && ['https://us.i.posthog.com','https://eu.i.posthog.com'].includes(env.POSTHOG_HOST)) {
    const promise=forwardPosthog(env,data.event==='pageview'?'$pageview':`vernia_${data.event}`,session,{$insert_id:data.id,$session_id:data.session,$pathname:data.path,$current_url:'https://vernia.in'+data.path,$referring_domain:referrer,$geoip_country_code:country,$device_type:device,utm_source:source,utm_campaign:campaign}).catch(()=>{});
    if(ctx)ctx.waitUntil(promise);else await promise;
  }
  return new Response(null,{status:204,headers});
}

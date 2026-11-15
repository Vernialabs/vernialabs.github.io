import { createMailer, mailReady } from './mail.mjs';

export const json = (body,status=200,headers={}) => Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');
export const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
export function admins(env) { return new Set((env.ADMIN_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean)); }
const cookie = token => `__Host-vernia_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
export async function identity(request,env) {
  const token = request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-vernia_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!token) return null;
  const session = await env.DB.prepare('SELECT email FROM admin_sessions WHERE token_hash=? AND expires>unixepoch()').bind(await hash(token)).first();
  return session && admins(env).has(session.email) ? session.email : null;
}
async function body(request) {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw Error('Invalid request');
  const reader=request.body?.getReader(); if(!reader) throw Error('Invalid request');
  let text='',size=0; const decoder=new TextDecoder();
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();throw Error('Too large');}text+=decoder.decode(value,{stream:true});}
  return JSON.parse(text+decoder.decode());
}
export async function authRoute(request,env,send=createMailer(env)) {
  const url=new URL(request.url);
  if(request.method!=='POST' || request.headers.get('origin')!==url.origin) return json({error:'Forbidden'},403);
  if(!env.AUTH_LIMITER || !request.headers.get('CF-Connecting-IP')) return json({error:'Sign-in unavailable'},503);
  if(!(await env.AUTH_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')})).success) return json({error:'Please wait a minute before trying again.'},429);
  let input; try{input=await body(request);}catch{return json({error:'Invalid request'},400);}
  if(url.pathname==='/admin/api/logout') {
    const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-vernia_admin=([a-f0-9]{64})(?:;|$)/)?.[1];
    if(token) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await hash(token)).run();
    return json({ok:true},200,{'Set-Cookie':'__Host-vernia_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
  }
  if(url.pathname==='/admin/api/login') {
    if(!mailReady(env) || !admins(env).size) return json({error:'Email sign-in is not configured yet. Ask your Cloudflare administrator to finish SMTP setup.'},503);
    const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
    const challenge=randomToken();
    // Same response for unknown addresses; only allowlisted admins receive a code.
    if(admins(env).has(email)) {
      const window=Math.floor(Date.now()/3600000);
      const rate=await env.DB.prepare(`INSERT INTO auth_rate(key,count,expires) VALUES(?,1,unixepoch()+3600)
        ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<3 RETURNING count`).bind(`${email}:${window}`).first();
      if(rate) {
        const bytes=crypto.getRandomValues(new Uint8Array(8));
        const code=Array.from(bytes,v=>(v%10).toString()).join('');
        await env.DB.prepare('INSERT INTO admin_challenges(id,email,code_hash,expires) VALUES(?,?,?,unixepoch()+600)').bind(challenge,email,await hash(challenge+':'+code)).run();
        try { await send({to:email,subject:'Your Vernia admin sign-in code',text:`Your sign-in code is ${code}.\n\nIt expires in 10 minutes and works once. If you didn't request this, ignore this email.\n\nVernia Labs`}); }
        catch { await env.DB.prepare('DELETE FROM admin_challenges WHERE id=?').bind(challenge).run(); await env.DB.prepare('UPDATE auth_rate SET count=max(0,count-1) WHERE key=?').bind(`${email}:${window}`).run(); return json({error:'We could not send a sign-in code. Please try again later.'},503); }
      }
    }
    return json({challenge,message:'If this address has admin access, a code is on its way. Check your inbox and spam folder.'});
  }
  if(url.pathname==='/admin/api/verify') {
    if(!/^[a-f0-9]{64}$/.test(input.challenge||'') || !/^\d{8}$/.test(input.code||'')) return json({error:'Enter the eight-digit code.'},400);
    const row=await env.DB.prepare(`UPDATE admin_challenges SET attempts=attempts+1 WHERE id=? AND consumed=0 AND expires>unixepoch() AND attempts<5 RETURNING email,code_hash`).bind(input.challenge).first();
    if(!row || !admins(env).has(row.email) || row.code_hash!==await hash(input.challenge+':'+input.code)) return json({error:'The code is invalid or expired.'},401);
    const consumed=await env.DB.prepare('UPDATE admin_challenges SET consumed=1 WHERE id=? AND consumed=0 RETURNING id').bind(input.challenge).first();
    if(!consumed) return json({error:'This code has already been used.'},401);
    const token=randomToken();
    await env.DB.prepare('INSERT INTO admin_sessions(token_hash,email,expires) VALUES(?,?,unixepoch()+28800)').bind(await hash(token),row.email).run();
    return json({ok:true},200,{'Set-Cookie':cookie(token)});
  }
  return json({error:'Not found'},404);
}

export async function dashboardData(request,env) {
  const email=await identity(request,env); if(!email) return json({error:'Sign in to view this dashboard.'},401);
  if(request.method!=='GET') return json({error:'Method not allowed'},405);
  const days=[1,7,30,90].includes(Number(new URL(request.url).searchParams.get('days')))?Number(new URL(request.url).searchParams.get('days')):7;
  const since=Math.floor(Date.now()/1000)-days*86400;
  const all=async(sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results;
  const [summary,daily,pages,sources,countries,devices,recent,leads,outbox,interests,signups,allTime]=await Promise.all([
    env.DB.prepare(`SELECT count(DISTINCT session_id) sessions, count(CASE WHEN event='pageview' THEN 1 END) pageviews,
      count(DISTINCT CASE WHEN event='engaged' THEN session_id END) engaged,
      count(DISTINCT CASE WHEN event='waitlist_view' THEN session_id END) waitlist_views,
      count(DISTINCT CASE WHEN event='signup' THEN session_id END) converted FROM analytics_events WHERE created_at>=?`).bind(since).first(),
    all("SELECT date(created_at,'unixepoch') day,count(DISTINCT session_id) sessions,sum(event='pageview') pageviews FROM analytics_events WHERE created_at>=? GROUP BY day ORDER BY day",since),
    all("SELECT path label,count(*) value FROM analytics_events WHERE event='pageview' AND created_at>=? GROUP BY path ORDER BY value DESC LIMIT 10",since),
    all("SELECT source label,count(DISTINCT session_id) value FROM analytics_events WHERE event='pageview' AND created_at>=? GROUP BY source ORDER BY value DESC LIMIT 10",since),
    all("SELECT country label,count(DISTINCT session_id) value FROM analytics_events WHERE event='pageview' AND created_at>=? GROUP BY country ORDER BY value DESC LIMIT 10",since),
    all("SELECT device label,count(DISTINCT session_id) value FROM analytics_events WHERE event='pageview' AND created_at>=? GROUP BY device ORDER BY value DESC",since),
    all("SELECT path,source,country,device,datetime(created_at,'unixepoch') time FROM analytics_events WHERE event='pageview' AND created_at>=? ORDER BY created_at DESC LIMIT 30",since),
    all("SELECT w.id,w.email,w.name,w.organisation,w.interests,w.created_at,w.status,coalesce(e.status,'not queued') email_status FROM waitlist w LEFT JOIN email_outbox e ON e.waitlist_id=w.id WHERE unixepoch(w.created_at)>=? ORDER BY w.id DESC LIMIT 100",since),
    all("SELECT status,count(*) value FROM email_outbox GROUP BY status"),
    all("SELECT j.value label,count(*) value FROM waitlist w,json_each(w.interests) j WHERE unixepoch(w.created_at)>=? GROUP BY j.value",since),
    env.DB.prepare('SELECT count(*) count FROM waitlist WHERE unixepoch(created_at)>=?').bind(since).first(),
    env.DB.prepare('SELECT count(*) count FROM waitlist').first()
  ]);
  return json({email,days,updatedAt:new Date().toISOString(),summary:{...summary,signups:signups.count,totalLeads:allTime.count},daily,pages,sources,countries,devices,recent,leads,outbox,interests,
    integrations:{mail:mailReady(env),posthog:Boolean(env.POSTHOG_PROJECT_KEY),posthogDashboard:env.POSTHOG_DASHBOARD_URL||'',rb2b:false},
    measurement:'Opt-in browser sessions. Known bots and admin-excluded browsers are filtered; this is an estimate, not a count of identified people. A session ends after 30 minutes of inactivity. Submitted leads are not verified email owners.'});
}

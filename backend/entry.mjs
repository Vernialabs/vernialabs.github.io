import {createHandler} from './worker.mjs';
import {createMailer,drainOutbox} from './mail.mjs';
import {authRoute,dashboardData,json,hash} from './admin.mjs';
import {collect,forwardPosthog} from './analytics.mjs';
import adminHtml from './ui/index.html';
import adminCss from './ui/admin.css';
import adminJs from './ui/admin.js';
import brandMark from '../assets/brand/vernia-mark.jpg';
import favicon from '../favicon.svg';
const brandBytes=Uint8Array.from(atob(brandMark.split(',')[1]),character=>character.charCodeAt(0));

const signupHandler=createHandler(fetch,async(signup,row,env)=>{
  if(signup.analyticsSession) {
    const session=await hash(signup.analyticsSession);
    await env.DB.prepare("INSERT OR IGNORE INTO analytics_events(id,session_id,event,path,referrer,source,campaign,country,device) VALUES(?,?,'signup','/waitlist.html','',?,?,'Unknown','Unknown')").bind(`signup-${row.id}`,session,signup.source,signup.campaign).run();
    await forwardPosthog(env,'vernia_signup',session,{$session_id:signup.analyticsSession,$pathname:'/waitlist.html',source:signup.source,interests:signup.interests});
  }
});
const secure={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",'X-Robots-Tag':'noindex, nofollow'};
export default {
  async fetch(request,env,ctx) {
    const path=new URL(request.url).pathname;
    try {
      if(path==='/'&&new URL(request.url).hostname==='admin.vernia.in') return Response.redirect(new URL('/admin',request.url).href,302);
      if(path==='/collect') return await collect(request,env,ctx);
      if(['/admin/api/login','/admin/api/verify','/admin/api/logout'].includes(path)) return await authRoute(request,env);
      if(path==='/admin/api/data') return await dashboardData(request,env);
      if(path.startsWith('/admin/api/')) return json({error:'Not found'},404);
      const asset={'/admin/vernia-mark.jpg':[brandBytes,'image/jpeg'],'/admin/favicon.svg':[favicon,'image/svg+xml'],'/admin':[adminHtml,'text/html'],'/admin/':[adminHtml,'text/html'],'/admin/admin.css':[adminCss,'text/css'],'/admin/admin.js':[adminJs,'text/javascript']}[path];
      if(asset) return new Response(asset[0],{headers:{...secure,'Content-Type':asset[1]+'; charset=utf-8'}});
      const response=await signupHandler(request,env);
      if(path==='/waitlist' && response.status===201) ctx.waitUntil(drainOutbox(env).catch(()=>{}));
      return response;
    } catch { return json({error:'This service is temporarily unavailable. Please try again.'},503); }
  },
  async scheduled(event,env,ctx) {
    ctx.waitUntil((async()=>{
      await drainOutbox(env);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM admin_challenges WHERE expires<unixepoch()'),
        env.DB.prepare('DELETE FROM admin_sessions WHERE expires<unixepoch()'),
        env.DB.prepare('DELETE FROM auth_rate WHERE expires<unixepoch()'),
        env.DB.prepare('DELETE FROM analytics_events WHERE created_at<unixepoch()-7776000')
      ]);
    })());
  }
};

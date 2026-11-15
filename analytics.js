// Optional first-party measurement. No names, email addresses, form values, or full URLs.
import {siteConfig} from './site-config.js';
import {sessionTracker} from './analytics-session.mjs';
const preferenceKey='vernia-analytics-choice';
const sessionKey='vernia-analytics-session';
let enabled=false,session='',engagementTimer;
const storage={get(key){try{return localStorage.getItem(key);}catch{return null;}},set(key,value){try{localStorage.setItem(key,value);}catch{}}};
const sessionStorageSafe={getItem(key){return sessionStorage.getItem(key);},setItem(key,value){sessionStorage.setItem(key,value);}};
let sessionId=sessionTracker(sessionStorageSafe);
const params=new URLSearchParams(location.search);const label=v=>/^[a-zA-Z0-9_.-]{1,80}$/.test(v||'')?v:'';
function send(event){if(!enabled||document.visibilityState!=='visible')return;session=sessionId();let referrer='';try{referrer=new URL(document.referrer).origin;}catch{}fetch(siteConfig.waitlistEndpoint.replace(/\/waitlist$/,'/collect'),{method:'POST',credentials:'omit',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),session,event,path:location.pathname,referrer,source:label(params.get('utm_source')),campaign:label(params.get('utm_campaign'))})}).catch(()=>{});}
function begin(){if(enabled)return;enabled=true;send('pageview');if(location.pathname==='/waitlist.html')send('waitlist_view');engagementTimer=setTimeout(()=>send('engaged'),10000);}
function stop(){enabled=false;clearTimeout(engagementTimer);try{sessionStorage.removeItem(sessionKey);}catch{}session='';sessionId=sessionTracker(sessionStorageSafe);}
window.verniaAnalyticsSession=()=>enabled?sessionId():'';
const dnt=navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true;
function choose(value){storage.set(preferenceKey,value);if(value==='allow'&&!dnt)begin();else stop();document.getElementById('analytics-choice')?.remove();updatePreferences();}
function updatePreferences(){const preferences=document.getElementById('analytics-preferences');if(!preferences)return;preferences.replaceChildren();const heading=document.createElement('h2');heading.textContent='Analytics preferences';const message=document.createElement('p');message.textContent=dnt?'Your browser’s privacy preference disables optional analytics.':storage.get(preferenceKey)==='allow'?'Optional website analytics are enabled in this browser.':'Optional website analytics are off in this browser.';const button=document.createElement('button');button.className='analytics-preference-button';button.textContent=storage.get(preferenceKey)==='allow'?'Turn off analytics / exclude this browser':'Allow optional analytics';button.disabled=dnt;button.addEventListener('click',()=>choose(storage.get(preferenceKey)==='allow'?'deny':'allow'));preferences.append(heading,message,button);}
if(!dnt&&storage.get(preferenceKey)==='allow')begin();
if(!dnt&&!storage.get(preferenceKey)){const banner=document.createElement('aside');banner.id='analytics-choice';banner.className='analytics-choice';banner.setAttribute('aria-label','Optional analytics');const p=document.createElement('p');p.textContent='Help us understand what’s useful. Allow optional analytics for page visits and waitlist conversions? We don’t record form content.';const more=document.createElement('a');more.href='privacy.html#analytics-preferences';more.textContent='Privacy & choices';const actions=document.createElement('div');for(const[text,value]of[['No thanks','deny'],['Allow analytics','allow']]){const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>choose(value));actions.append(b);}banner.append(p,more,actions);document.body.append(banner);}
document.addEventListener('visibilitychange',()=>{clearTimeout(engagementTimer);if(document.visibilityState==='visible'&&enabled)engagementTimer=setTimeout(()=>send('engaged'),10000);});
document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&(link.getAttribute('href')?.includes('waitlist.html')||link.hasAttribute('data-cta')||link.hasAttribute('data-interest')))send('cta');});
updatePreferences();

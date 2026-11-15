import test from 'node:test';
import assert from 'node:assert/strict';
import {createSessionId,sessionTracker} from '../analytics-session.mjs';
test('PostHog session identifiers encode time as UUIDv7 and stay unique',()=>{
  const time=1794735000000;const ids=Array.from({length:100},()=>createSessionId(time));
  assert.equal(new Set(ids).size,100);
  for(const id of ids){assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);assert.equal(parseInt(id.replaceAll('-','').slice(0,12),16),time);}
});
test('sessions survive navigation, expire after inactivity or 24h, and work without storage',()=>{
  let time=1794735000000,value=null;
  const storage={getItem:()=>value,setItem:(key,next)=>{value=next;}};
  let session=sessionTracker(storage,()=>time);const first=session();time+=60000;assert.equal(session(),first);
  session=sessionTracker(storage,()=>time);assert.equal(session(),first);
  time+=1800000;const next=session();assert.notEqual(next,first);
  for(let i=0;i<24*60;i++){time+=60000;session();}assert.notEqual(session(),next);
  session=sessionTracker({getItem(){throw Error();},setItem(){throw Error();}},()=>time);
  const fallback=session();time+=1000;assert.equal(session(),fallback);time+=1800000;assert.notEqual(session(),fallback);
});

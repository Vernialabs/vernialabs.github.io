// UUIDv7 allows PostHog to aggregate sessions without a persistent visitor profile.
export function createSessionId(now=Date.now()) {
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  let timestamp=BigInt(now);
  for(let i=5;i>=0;i--){bytes[i]=Number(timestamp&255n);timestamp>>=8n;}
  bytes[6]=(bytes[6]&15)|112;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function sessionTracker(storage,now=Date.now) {
  let current;
  return () => {
    const time=now();
    try{current=JSON.parse(storage.getItem('vernia-analytics-session')||'null')||current;}catch{}
    if(!current||!/^.{14}7/.test(current.id||'')||time<current.time||time-current.time>=1800000||time-current.created>=86400000||!current.created)current={id:createSessionId(time),created:time};
    current.time=time;
    try{storage.setItem('vernia-analytics-session',JSON.stringify(current));}catch{}
    return current.id;
  };
}

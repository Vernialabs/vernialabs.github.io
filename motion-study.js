// A generative motion study. All three views share the same action function.
export function initMotionStudy({ isPaused, setPaused }) {
  const svg = document.querySelector('#action-study');
  const range = document.querySelector('#action-progress');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const ns = 'http://www.w3.org/2000/svg';
  const element = (tag, attrs, parent) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    parent.appendChild(node); return node;
  };
  const group = id => { const node = svg.querySelector('#'+id); node.replaceChildren(); return node; };
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { const t = clamp(x); return t*t*(3-2*t); };
  const mix = (a,b,t) => a+(b-a)*t;
  function action(p) {
    const reach=smooth(p/.28), travel=smooth((p-.36)/.46);
    return {x:-65+65*reach+65*travel, y:30-30*reach-80*Math.sin(travel*Math.PI*.75),
      objectX:60+65*travel, objectY:-20-80*Math.sin(travel*Math.PI*.75),
      grip:smooth((p-.18)/.15)*(1-smooth((p-.85)/.15)), contact:p>=.32&&p<.88};
  }
  const open=[[-40,100],[-30,58],[-5,34],[23,16],[50,6],[-10,25],[10,-25],[25,-60],[35,-85],[-35,15],[-25,-45],[-20,-90],[-15,-112],[-57,22],[-58,-30],[-60,-70],[-62,-91],[-77,40],[-88,2],[-92,-25],[-98,-42]];
  const closed=[[-40,100],[-30,58],[-5,34],[30,25],[60,12],[-10,25],[16,-24],[44,-53],[62,-43],[-35,15],[-22,-35],[8,-35],[9,-4],[-57,22],[-52,-20],[-24,-24],[-22,10],[-77,40],[-79,3],[-57,-2],[-49,26]];
  const chains=[[0,1,2,3,4],[0,5,6,7,8],[0,9,10,11,12],[0,13,14,15,16],[0,17,18,19,20]];
  const bones=group('hand-bones'), joints=group('hand-joints');
  const bonePaths=chains.map(()=>element('path',{},bones));
  const jointNodes=open.map((_,i)=>element('circle',{r:i===0?4.5:3.3},joints));
  const hand=svg.querySelector('#human-hand'), surface=svg.querySelector('#hand-surface');
  const object=svg.querySelector('#moving-object'), ring=svg.querySelector('#contact-ring');
  const full=svg.querySelector('#trajectory-full'), active=svg.querySelector('#trajectory-active'), tip=svg.querySelector('#trajectory-tip');
  const tracePoint=p=>{const a=action(p);return [(a.x+65)*1.65-125,a.y*1.65+10];};
  const pathAt=p=>Array.from({length:81},(_,i)=>tracePoint(p*i/80)).map((point,i)=>(i?'L':'M')+point.map(n=>n.toFixed(2)).join(' ')).join(' ');
  full.setAttribute('d',pathAt(1));
  const samples=group('trajectory-samples');
  const dots=Array.from({length:16},(_,i)=>{const [cx,cy]=tracePoint(i/15);return element('circle',{cx,cy,r:2.5},samples);});
  const echoes=group('object-echoes');
  const echoNodes=Array.from({length:5},(_,i)=>{
    const a=action(.36+i*.115);
    return element('path',{d:'M-20-20 7-30 28-12 0 0ZM-20-20V10L0 30 28 16V-12M0 0V30',transform:`translate(${a.objectX} ${a.objectY})`},echoes);
  });
  const records=group('data-records');
  element('path',{d:'M-145-101H145M-145 123H145',stroke:'#bca5ff','stroke-opacity':'.25'},records);
  const heading=element('text',{x:-133,y:-113,class:'record-heading'},records);heading.textContent='t       x       y     contact';
  const rows=Array.from({length:8},(_,i)=>{
    const p=i/7,a=action(p),y=-79+i*27;
    const row=element('g',{},records);
    element('path',{d:`M-145 ${y+10}H145`,stroke:'#bca5ff','stroke-opacity':'.1'},row);
    const text=element('text',{x:-133,y,class:'record-value','xml:space':'preserve'},row);
    const number=n=>(n>=0?' ':'')+n.toFixed(2);
    text.textContent=`${p.toFixed(2)}   ${number(a.x/150)}   ${number(a.y/150)}`;
    element('rect',{x:109,y:y-8,width:17,height:4,rx:2,fill:a.contact?'#dbc2ff':'#776681'},row);
    return row;
  });
  const connections=group('study-connections');
  let compact=false;
  const layout=()=>{
    compact=svg.clientWidth<700;
    svg.setAttribute('viewBox',compact?'0 0 600 670':'0 0 1200 430');
    svg.querySelector('#human-scene').setAttribute('transform',compact?'translate(160 175) scale(.82)':'translate(205 200)');
    svg.querySelector('#trace-scene').setAttribute('transform',compact?'translate(440 175) scale(.75)':'translate(610 200)');
    svg.querySelector('#data-scene').setAttribute('transform',compact?'translate(300 485)':'translate(1015 200)');
    connections.replaceChildren();
    element('path',{d:compact?'M280 175H325M440 315V330Q440 350 420 350H320Q300 350 300 370':'M370 200H440M770 200H835'},connections);
  };
  new ResizeObserver(layout).observe(svg);layout();
  let phase = reduce.matches ? .68 : .06, elapsed=phase*14, visible=true, last=0;
  function render(p) {
    const a=action(p), points=open.map((v,i)=>v.map((n,j)=>mix(n,closed[i][j],a.grip)));
    hand.setAttribute('transform',`translate(${a.x.toFixed(2)} ${a.y.toFixed(2)})`);
    bonePaths.forEach((node,i)=>node.setAttribute('d',chains[i].map((n,j)=>(j?'L':'M')+points[n].join(' ')).join(' ')));
    jointNodes.forEach((node,i)=>{node.setAttribute('cx',points[i][0]);node.setAttribute('cy',points[i][1]);});
    surface.setAttribute('d',[0,1,2,5,9,13,17,0].map((n,i)=>(i?'L':'M')+points[n].join(' ')).join(' ')+'Z');
    object.setAttribute('transform',`translate(${a.objectX} ${a.objectY})`);
    ring.setAttribute('cx',a.objectX+4);ring.setAttribute('cy',a.objectY);ring.setAttribute('opacity',a.contact ? .5 : 0);
    echoNodes.forEach((node,i)=>node.setAttribute('opacity',p>.36+i*.115 ? .13 : 0));
    active.setAttribute('d',pathAt(p));
    const [x,y]=tracePoint(p);tip.setAttribute('cx',x);tip.setAttribute('cy',y);
    dots.forEach((node,i)=>node.setAttribute('opacity',p>=i/15 ? .85 : .1));
    rows.forEach((node,i)=>node.setAttribute('opacity',p>=i/7?1:.17));
    const verb=p<.25?'Reach.':p<.38?'Make contact.':p<.85?'Move.':'Release.';
    svg.querySelector('#action-verb').textContent=verb;
    range.value=String(Math.round(p*100));
    range.setAttribute('aria-valuetext',`${verb.replace('.','')}, ${Math.round(p*100)} percent`);
  }
  range.addEventListener('input',()=>{setPaused(true);phase=Number(range.value)/100;elapsed=phase*14;render(phase);});
  reduce.addEventListener('change',()=>{if(reduce.matches){phase=.68;elapsed=phase*14;render(phase);}});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;}).observe(svg);
  document.addEventListener('visibilitychange',()=>{last=0;});
  function frame(now) {
    requestAnimationFrame(frame);
    if(!visible||document.hidden||isPaused()){last=0;return;}
    if(last&&now-last<33)return;
    const dt=last?Math.min((now-last)/1000,.1):0;last=now;elapsed=(elapsed+dt)%16;
    phase=clamp(elapsed/14);render(phase);
  }
  render(phase);svg.closest('.motion-study').classList.add('study-ready');requestAnimationFrame(frame);
}

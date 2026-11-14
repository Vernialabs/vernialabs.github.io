import * as THREE from './assets/vendor/three.module.min.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
import { buildGestureRig } from './gesture-rig.js';

const smooth=(a,b,x)=>THREE.MathUtils.smoothstep(x,a,b);
export function gestureTimeline(seconds) {
  const t=((seconds%16)+16)%16;
  return {time:t,reach:smooth(.3,3.1,t),pinch:smooth(2.1,4.7,t),dissolve:THREE.MathUtils.clamp((t-5.8)/4.8,0,1.15),presence:smooth(0,.8,t),phase:t<3.1?'reach':t<4.7?'pinch':t<5.8?'hold':t<10.6?'dissolve':'flow'};
}

export async function initCinematicMotion({ isPaused }) {
  const stage=document.querySelector('#cinematic-stage');
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.setClearColor(0x131119,0);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);
  scene.add(new THREE.HemisphereLight('#efdef6','#241828',.95));
  for(const [p,c,i] of [[[-4,5,5],'#ffe5d0',3],[[3,2,-4],'#ad89ed',3.5],[[1,-3,4],'#d7bddf',.4]]){const l=new THREE.DirectionalLight(c,i);l.position.set(...p);scene.add(l);}
  const model=await new GLTFLoader().loadAsync('./assets/models/gesture-hand/hand.glb');
  const rig=buildGestureRig(THREE,model);scene.add(rig.root);
  let seed=71;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const poreData=new Uint8Array(256*256*4);for(let i=0;i<poreData.length;i+=4){const v=110+Math.floor(random()*35);poreData[i]=poreData[i+1]=poreData[i+2]=v;poreData[i+3]=255;}
  const pores=new THREE.DataTexture(poreData,256,256);pores.wrapS=pores.wrapT=THREE.RepeatWrapping;pores.repeat.set(7,7);pores.needsUpdate=true;
  const dissolve={value:0};
  const skin=new THREE.MeshPhysicalMaterial({color:'#a17b65',roughness:.57,metalness:0,sheen:.18,sheenColor:new THREE.Color('#bf8f7c'),sheenRoughness:.85,bumpMap:pores,bumpScale:.00016,transparent:true});
  skin.onBeforeCompile=shader=>{
    shader.uniforms.uDissolve=dissolve;
    shader.vertexShader='attribute float aDissolve;varying float vDissolve;varying vec3 vSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvDissolve=aDissolve;vSurface=position;');
    shader.fragmentShader='uniform float uDissolve;varying float vDissolve;varying vec3 vSurface;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float grain=fract(sin(dot(floor(vSurface*1700.),vec3(12.9898,78.233,37.719)))*43758.5453);
      float edge=clamp(vDissolve+(grain-.5)*.055,.005,.995);
      if(uDissolve>edge)discard;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=vec3(.22,.09,.36)*(1.-smoothstep(0.,.035,edge-uDissolve))*step(.01,uDissolve);
      #include <opaque_fragment>`);
  };
  rig.mesh.material=skin;
  // Clip the wrist on a common plane and extend its exact contour into the forearm.
  const original=rig.mesh.geometry,cut=.03,unique=new Map(),v=new THREE.Vector3();
  const output={position:[],normal:[],uv:[],skinIndex:[],skinWeight:[]};
  function vertex(i){
    const attrs={};for(const key of ['position','normal','uv']){const a=original.attributes[key];attrs[key]=Array.from({length:a.itemSize},(_,j)=>a.getComponent(i,j));}
    const weights=new Map();for(let j=0;j<4;j++){const id=original.attributes.skinIndex.getComponent(i,j),weight=original.attributes.skinWeight.getComponent(i,j);weights.set(id,(weights.get(id)||0)+weight);}
    rig.mesh.getVertexPosition(i,v);rig.mesh.localToWorld(v);rig.root.worldToLocal(v);const world=v.clone(),n=new THREE.Vector3(...attrs.position).addScaledVector(new THREE.Vector3(...attrs.normal),.001);rig.mesh.applyBoneTransform(i,n);rig.mesh.localToWorld(n);rig.root.worldToLocal(n);n.sub(world).normalize();return {attrs,weights,world,normal:n};
  }
  function crossing(a,b){
    const t=(cut-a.world.y)/(b.world.y-a.world.y),attrs={},weights=new Map();
    for(const key of ['position','normal','uv'])attrs[key]=a.attrs[key].map((n,j)=>THREE.MathUtils.lerp(n,b.attrs[key][j],t));
    for(const [id,w]of a.weights)weights.set(id,w*(1-t));for(const[id,w]of b.weights)weights.set(id,(weights.get(id)||0)+w*t);
    const world=a.world.clone().lerp(b.world,t),normal=a.normal.clone().lerp(b.normal,t).normalize();world.userData={normal};unique.set(world.toArray().map(n=>n.toFixed(6)).join(','),world);return {attrs,weights,world,normal};
  }
  function emit(p){for(const key of ['position','normal','uv'])output[key].push(...p.attrs[key]);const weights=[...p.weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=weights.reduce((n,p)=>n+p[1],0);while(weights.length<4)weights.push([0,0]);output.skinIndex.push(...weights.map(w=>w[0]));output.skinWeight.push(...weights.map(w=>w[1]/sum));}
  const indices=original.index.array;
  for(let i=0;i<indices.length;i+=3){
    const face=[vertex(indices[i]),vertex(indices[i+1]),vertex(indices[i+2])],clipped=[];
    for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],inside=a.world.y>=cut;if(inside)clipped.push(a);if(inside!==(b.world.y>=cut))clipped.push(crossing(a,b));}
    for(let j=1;j<clipped.length-1;j++){emit(clipped[0]);emit(clipped[j]);emit(clipped[j+1]);}
  }
  const clippedGeometry=new THREE.BufferGeometry();for(const key of ['position','normal','uv','skinWeight'])clippedGeometry.setAttribute(key,new THREE.Float32BufferAttribute(output[key],key==='uv'?2:key==='skinWeight'?4:3));clippedGeometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(output.skinIndex,4));rig.mesh.geometry=clippedGeometry;original.dispose();
  const ring=[...unique.values()],wristCenter=new THREE.Vector3();ring.forEach(p=>wristCenter.add(p));wristCenter.divideScalar(ring.length);
  ring.sort((a,b)=>Math.atan2(a.z-wristCenter.z,a.x-wristCenter.x)-Math.atan2(b.z-wristCenter.z,b.x-wristCenter.x));
  const armPositions=[],armUV=[],armIndices=[],segments=ring.length;
  for(let j=0;j<=20;j++)for(let i=0;i<=segments;i++){
    const t=j/20,p=ring[i%segments],widen=1+t*.25;
    armPositions.push(wristCenter.x+(p.x-wristCenter.x)*widen-t*.008,p.y-t*.19,wristCenter.z+(p.z-wristCenter.z)*widen);
    armUV.push(i/segments,t);
    if(j<20&&i<segments){const k=j*(segments+1)+i;armIndices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);}
  }
  const armGeometry=new THREE.BufferGeometry();armGeometry.setAttribute('position',new THREE.Float32BufferAttribute(armPositions,3));armGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(armUV,2));armGeometry.setIndex(armIndices);armGeometry.computeVertexNormals();const armNormals=armGeometry.attributes.normal;
  const rx=Math.max(...ring.map(p=>Math.abs(p.x-wristCenter.x))),rz=Math.max(...ring.map(p=>Math.abs(p.z-wristCenter.z)));
  for(let j=0;j<=20;j++)for(let i=0;i<=segments;i++){const k=j*(segments+1)+i,p=ring[i%segments],radial=new THREE.Vector3((p.x-wristCenter.x)/(rx*rx),.03,(p.z-wristCenter.z)/(rz*rz)).normalize(),n=p.userData.normal.clone().lerp(radial,Math.min(1,j/4)).normalize();armNormals.setXYZ(k,n.x,n.y,n.z);}

  const arm=new THREE.Mesh(armGeometry,skin);rig.root.add(arm);rig.pose(0);
  const point=new THREE.Vector3(),sources=[rig.mesh,arm];
  for(const source of sources){const score=new Float32Array(source.geometry.attributes.position.count);for(let i=0;i<score.length;i++){source.getVertexPosition(i,point);source.localToWorld(point);rig.root.worldToLocal(point);score[i]=THREE.MathUtils.clamp(1-(point.y+.176)/.36,.01,.99);}source.geometry.setAttribute('aDissolve',new THREE.BufferAttribute(score,1));}
  const count=5200,positions=new Float32Array(count*3),opacities=new Float32Array(count),sizes=new Float32Array(count),colors=new Float32Array(count*3),seeds=[];
  for(let i=0;i<count;i++){
    const source=random()<.8?rig.mesh:arm,index=Math.floor(random()*source.geometry.attributes.position.count),threshold=source.geometry.attributes.aDissolve.getX(index);
    seeds.push({source,index,threshold,lane:random(),noise:random()*6.28,speed:.7+random()*.7});
    sizes[i]=1+Math.pow(random(),3)*4;const c=new THREE.Color().setHSL(.72+random()*.06,.3,.6+random()*.3);colors.set([c.r,c.g,c.b],i*3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aOpacity',new THREE.BufferAttribute(opacities,1));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const particles=new THREE.Points(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},vertexShader:'attribute float aSize;attribute float aOpacity;varying float vOpacity;varying vec3 vColor;uniform float pixelRatio;void main(){vOpacity=aOpacity;vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*pixelRatio*(11./-mv.z);}',fragmentShader:'varying float vOpacity;varying vec3 vColor;void main(){float a=pow(max(0.,1.-length(gl_PointCoord-.5)*2.),1.7);gl_FragColor=vec4(vColor,a*vOpacity);}'}));particles.frustumCulled=false;scene.add(particles);
  const tip=new THREE.Vector3(),thumb=new THREE.Vector3(),center=new THREE.Vector3();
  let compact=false,visible=true,last=0;
  let time=matchMedia('(prefers-reduced-motion: reduce)').matches?6.4:0;
  function draw(){
    const state=gestureTimeline(time);dissolve.value=state.dissolve;skin.opacity=state.presence;
    rig.root.scale.setScalar(compact?20:24);
    rig.root.position.set(THREE.MathUtils.lerp(compact?-2.7:-4.3,compact?-1.3:-2.5,state.reach),THREE.MathUtils.lerp(-2,-1.65,state.reach),0);
    rig.root.rotation.set(.12,THREE.MathUtils.lerp(-.95,-.65,state.reach),THREE.MathUtils.lerp(-.85,-.61,state.reach));
    rig.pose(state.pinch);scene.updateMatrixWorld(true);rig.mesh.skeleton.update();
    rig.indexTip.getWorldPosition(tip);rig.thumbTip.getWorldPosition(thumb);center.copy(tip).lerp(thumb,.5);
    for(let i=0;i<count;i++){
      const s=seeds[i],age=state.time-(5.8+s.threshold*4.8);
      if(age<0){opacities[i]=0;continue;}
      s.source.getVertexPosition(s.index,point);s.source.localToWorld(point);
      const blend=smooth(0,1.6,age),travel=age*s.speed;
      const angle=travel*1.5+s.lane*6.28,width=.15+Math.min(travel,3)*.18;
      const x=center.x+travel*(compact?.8:1.1),y=center.y+Math.sin(travel*.9)*.48-travel*.18+Math.cos(angle)*width,z=center.z+Math.sin(angle)*width-travel*.15;
      positions[i*3]=THREE.MathUtils.lerp(point.x,x,blend);positions[i*3+1]=THREE.MathUtils.lerp(point.y,y,blend);positions[i*3+2]=THREE.MathUtils.lerp(point.z,z,blend);
      opacities[i]=smooth(0,.16,age)*(1-smooth(3,5.3,age))*.9;
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.aOpacity.needsUpdate=true;renderer.render(scene,camera);
  }
  function resize(){const {width,height}=stage.getBoundingClientRect();compact=width<700;renderer.setSize(width,height);camera.aspect=width/height;camera.position.set(compact?.05:.1,0,compact?12.3:10.7);camera.updateProjectionMatrix();draw();}
  stage.appendChild(renderer.domElement);resize();stage.classList.add('cinematic-ready');stage.closest('figure').classList.add('motion-ready');
  new ResizeObserver(resize).observe(stage);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;}).observe(stage);document.addEventListener('visibilitychange',()=>{last=0;});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();visible=false;stage.classList.remove('cinematic-ready');stage.closest('figure').classList.add('still-only');});
  function animate(now){requestAnimationFrame(animate);if(!visible||document.hidden||isPaused()){last=0;return;}if(last&&now-last<33)return;const dt=last?Math.min((now-last)/1000,.1):0;last=now;time=(time+dt)%16;draw();}
  requestAnimationFrame(animate);
}

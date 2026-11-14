import * as THREE from './assets/vendor/three.module.min.js';

export async function initCinematicMotion({ isPaused }) {
  const stage=document.querySelector('#cinematic-stage');
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x131119,0);renderer.domElement.setAttribute('aria-hidden','true');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);
  const texture=await new THREE.TextureLoader().loadAsync('./assets/brand/cinematic-hand.png');texture.colorSpace=THREE.SRGBColorSpace;
  const imageCanvas=document.createElement('canvas');imageCanvas.width=texture.image.width;imageCanvas.height=texture.image.height;
  const imageContext=imageCanvas.getContext('2d',{willReadFrequently:true});imageContext.drawImage(texture.image,0,0);const pixels=imageContext.getImageData(0,0,imageCanvas.width,imageCanvas.height).data;
  const handWidth=14,handHeight=handWidth*2/3;
  const handGeometry=new THREE.PlaneGeometry(handWidth,handHeight,80,52);
  const clock={value:4};
  const handMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false});
  handMaterial.onBeforeCompile=shader=>{
    shader.uniforms.motionTime=clock;
    shader.vertexShader='uniform float motionTime;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed=vec3(position);
      float flex=sin(motionTime*.42);
      float indexWeight=exp(-dot((uv-vec2(.66,.82))*vec2(7.,12.),(uv-vec2(.66,.82))*vec2(7.,12.)));
      float thumbWeight=exp(-dot((uv-vec2(.65,.59))*vec2(8.,14.),(uv-vec2(.65,.59))*vec2(8.,14.)));
      transformed.y+=flex*(-.24*indexWeight+.15*thumbWeight);
      transformed.z+=sin(uv.x*3.14)*sin(motionTime*.25)*.15;`);
    shader.fragmentShader='uniform float motionTime;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float edge=smoothstep(.58,.71,vMapUv.x);
      diffuseColor.a*=1.-edge*(.12+.08*sin(motionTime*.42));`);
  };
  const hand=new THREE.Mesh(handGeometry,handMaterial);hand.renderOrder=1;scene.add(hand);
  let seed=29;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  // Sample the artwork's alpha silhouette so particles originate on the hand itself.
  const surface=[];
  for(let i=0;i<12000&&surface.length<1600;i++){
    const u=.34+random()*.36,v=.26+random()*.64,x=Math.floor(u*imageCanvas.width),y=Math.floor((1-v)*imageCanvas.height);
    if(pixels[(y*imageCanvas.width+x)*4+3]>180)surface.push([u,v]);
  }
  const count=3400,positions=new Float32Array(count*3),sizes=new Float32Array(count),opacities=new Float32Array(count),colors=new Float32Array(count*3),seeds=[];
  for(let i=0;i<count;i++){
    seeds.push({surface:surface[Math.floor(random()*surface.length)]||[.66,.8],phase:random(),lane:random(),noise:random()*Math.PI*2,speed:.7+random()*.7,length:5+random()*3});
    sizes[i]=.8+Math.pow(random(),4)*5.5;
    const c=new THREE.Color().setHSL(.72+random()*.07,.2+random()*.3,.58+random()*.4);colors.set([c.r,c.g,c.b],i*3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('aOpacity',new THREE.BufferAttribute(opacities,1));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,vertexColors:true,
    uniforms:{pixelRatio:{value:renderer.getPixelRatio()}},
    vertexShader:'attribute float aSize;attribute float aOpacity;varying float vOpacity;varying vec3 vColor;uniform float pixelRatio;void main(){vColor=color;vOpacity=aOpacity;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*pixelRatio*(11.0/-mv.z);}',
    fragmentShader:'varying float vOpacity;varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5)*2.0;float a=pow(max(0.0,1.0-d),1.7);gl_FragColor=vec4(vColor,a*vOpacity);}' });
  const particles=new THREE.Points(geometry,material);particles.frustumCulled=false;particles.renderOrder=2;scene.add(particles);
  const ribbons=[];
  for(let i=0;i<7;i++){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(100*3),3));
    const m=new THREE.LineBasicMaterial({color:i%3===0?'#d8bbff':'#9173b7',transparent:true,opacity:i%3===0?.12:.055,blending:THREE.AdditiveBlending,depthWrite:false});const line=new THREE.Line(g,m);line.renderOrder=2;line.frustumCulled=false;scene.add(line);ribbons.push(line);
  }
  const point=new THREE.Vector3(),emitter=new THREE.Vector3();
  let compact=false,visible=true,last=0,time=4;
  function handPoint(u,v,target){
    const a=((u-.66)*7)**2+((v-.82)*12)**2,b=((u-.65)*8)**2+((v-.59)*14)**2;
    target.set((u-.5)*handWidth,(v-.5)*handHeight+Math.sin(time*.42)*(-.24*Math.exp(-a)+.15*Math.exp(-b)),.1);
    hand.localToWorld(target);return target;
  }
  function flow(u,lane,length,start){
    const angle=u*5.2+lane*6.28+time*.14,width=(.08+Math.sin(u*2.7))*(.3+lane*.8);
    return [start.x+u*length,start.y+Math.sin(u*5.5-time*.16)*.5-u*.75+Math.cos(angle)*width,start.z+Math.sin(angle)*width-u*.9];
  }
  function draw(){
    clock.value=time;
    hand.scale.setScalar(compact?.64:1);
    hand.position.set((compact?-.9:-2.4)+Math.sin(time*.28)*.13,-.65+Math.sin(time*.32)*.09,0);
    hand.rotation.set(Math.sin(time*.22)*.025,Math.sin(time*.25)*.035,Math.sin(time*.29)*.018);
    hand.updateMatrixWorld(true);handPoint(.675,.73,emitter);
    for(let i=0;i<count;i++){
      const s=seeds[i],u=(s.phase+time*.045*s.speed)%1;
      const destination=flow(u,s.lane,compact?s.length*.65:s.length,emitter);
      handPoint(...s.surface,point);
      const blend=THREE.MathUtils.smoothstep(u,0,.31);
      positions[i*3]=THREE.MathUtils.lerp(point.x,destination[0],blend);
      positions[i*3+1]=THREE.MathUtils.lerp(point.y,destination[1],blend)+Math.sin(s.noise+time*.4)*.035;
      positions[i*3+2]=THREE.MathUtils.lerp(point.z,destination[2],blend);
      opacities[i]=Math.pow(Math.sin(Math.PI*u),.65)*.9;
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.aOpacity.needsUpdate=true;
    ribbons.forEach((line,lane)=>{const a=line.geometry.attributes.position;for(let i=0;i<100;i++){const u=.03+i/99*.94,p=flow(u,lane/7,compact?4.5:7.2,emitter);a.setXYZ(i,...p);}a.needsUpdate=true;});
    renderer.render(scene,camera);
  }
  function resize(){const {width,height}=stage.getBoundingClientRect();compact=width<700;renderer.setSize(width,height);camera.aspect=width/height;camera.position.set(compact?.25:.1,0,compact?10.6:10.7);camera.updateProjectionMatrix();draw();}
  stage.appendChild(renderer.domElement);resize();stage.classList.add('cinematic-ready');stage.closest('figure').classList.add('motion-ready');
  new ResizeObserver(resize).observe(stage);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;}).observe(stage);
  document.addEventListener('visibilitychange',()=>{last=0;});
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();visible=false;stage.classList.remove('cinematic-ready');stage.closest('figure').classList.add('still-only');});
  function animate(now){requestAnimationFrame(animate);if(!visible||document.hidden||isPaused()){last=0;return;}if(last&&now-last<33)return;const dt=last?Math.min((now-last)/1000,.08):0;last=now;time+=dt;draw();}
  requestAnimationFrame(animate);
}

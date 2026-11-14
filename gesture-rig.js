// Anatomical finger chains are posed in 3D; skin and particle sources share the rig.
export function buildGestureRig(T, model) {
  const asset=model.scene;asset.updateMatrixWorld(true);
  const vector=()=>new T.Vector3(),wrist=asset.getObjectByName('hand_r');
  const w=wrist.getWorldPosition(vector()),up=asset.getObjectByName('middle_01_r').getWorldPosition(vector()).sub(w).normalize();
  const right=asset.getObjectByName('index_01_r').getWorldPosition(vector()).sub(asset.getObjectByName('pinky_01_r').getWorldPosition(vector()));right.addScaledVector(up,-right.dot(up)).normalize();
  const normal=new T.Vector3().crossVectors(right,up).normalize();
  const canonical=new T.Group();canonical.matrixAutoUpdate=false;canonical.matrix.makeBasis(right,up,normal).setPosition(w).invert();canonical.add(asset);
  const root=new T.Group();root.add(canonical);root.updateMatrixWorld(true);
  let mesh;asset.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});
  mesh.skeleton.update();
  const rest=new Map();mesh.skeleton.bones.forEach(b=>rest.set(b,b.quaternion.clone()));
  function endpoint(name){
    const bone=asset.getObjectByName(name),index=mesh.skeleton.bones.indexOf(bone),p=mesh.geometry.attributes.position,ids=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
    const point=vector(),candidates=[];
    for(let i=0;i<p.count;i++){
      let weight=0;for(let j=0;j<4;j++)if(ids.getComponent(i,j)===index)weight+=weights.getComponent(i,j);
      if(weight>.5){mesh.getVertexPosition(i,point);mesh.localToWorld(point);bone.worldToLocal(point);candidates.push(point.clone());}
    }
    const max=Math.max(...candidates.map(v=>v.y)),end=vector();let count=0;
    for(const p of candidates)if(p.y>max-.004){end.add(p);count++;}end.divideScalar(count||1);
    const tip=new T.Object3D();tip.position.copy(end);bone.add(tip);return tip;
  }
  const indexTip=endpoint('index_03_r'),thumbTip=endpoint('thumb_03_r');root.updateMatrixWorld(true);
  const indexStart=indexTip.getWorldPosition(vector()),thumbStart=thumbTip.getWorldPosition(vector());
  const target=indexStart.clone().lerp(thumbStart,.5);target.z-=.012;
  const parameters=[];
  for(const finger of ['index','thumb'])for(let joint=1;joint<=3;joint++){
    const bone=asset.getObjectByName(`${finger}_0${joint}_r`);
    parameters.push({bone,axis:'z',value:0,min:finger==='index'&&joint===3?-.8:-1.4,max:.6});
    if(joint===1){parameters.push({bone,axis:'x',value:0,min:-.7,max:.7});parameters.push({bone,axis:'y',value:0,min: finger==='thumb'?-1:-.5,max:finger==='thumb'?1:.5});}
  }
  const paramsByBone=new Map();parameters.forEach(p=>{if(!paramsByBone.has(p.bone))paramsByBone.set(p.bone,[]);paramsByBone.get(p.bone).push(p);});
  const euler=new T.Euler(),quaternion=new T.Quaternion();
  function poseParameters(){for(const [bone,params]of paramsByBone){euler.set(0,0,0);params.forEach(p=>euler[p.axis]=p.value);bone.quaternion.copy(rest.get(bone)).multiply(quaternion.setFromEuler(euler));}root.updateMatrixWorld(true);}
  function error(){const i=indexTip.getWorldPosition(vector()),t=thumbTip.getWorldPosition(vector());return i.distanceToSquared(t)+.06*(i.distanceToSquared(target)+t.distanceToSquared(target))+parameters.reduce((a,p)=>a+p.value*p.value,0)*.0000001;}
  // Solve a pad-to-pad pinch once, then interpolate the resulting joint rotations.
  for(const step of [.3,.15,.07,.03,.012,.005,.002])for(let pass=0;pass<35;pass++)for(const p of parameters){
    const original=p.value;let best=error(),chosen=original;
    for(const direction of [-1,1]){p.value=T.MathUtils.clamp(original+step*direction,p.min,p.max);poseParameters();const score=error();if(score<best){best=score;chosen=p.value;}}
    p.value=chosen;poseParameters();
  }
  const pinched=new Map();paramsByBone.forEach((_,b)=>pinched.set(b,b.quaternion.clone()));
  const gap=indexTip.getWorldPosition(vector()).distanceTo(thumbTip.getWorldPosition(vector()));
  const resting=[];
  for(const f of ['middle','ring','pinky'])for(let j=1;j<=3;j++)resting.push({bone:asset.getObjectByName(`${f}_0${j}_r`),amount:(j===1?.25:.4)*(f==='middle'?.7:1)});
  function pose(pinch){
    for(const [b,q]of rest)b.quaternion.copy(q);
    for(const [b,q]of pinched)b.quaternion.slerp(q,pinch);
    for(const {bone,amount}of resting)bone.quaternion.multiply(quaternion.setFromAxisAngle(new T.Vector3(0,0,1),-amount*(.2+.8*pinch)));
    root.updateMatrixWorld(true);mesh.skeleton.update();
  }
  pose(0);
  return {root,mesh,wrist,indexTip,thumbTip,pose,pinchGap:gap,target,parameters:parameters.map(p=>({name:p.bone.name,axis:p.axis,value:p.value}))};
}

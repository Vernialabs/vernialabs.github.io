const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Preserve previously shared product links after moving the hardware collection.
if (!document.querySelector('#grip-one') && location.hash === '#grip-one') {
  location.replace('hardware.html#grip-one');
}
let paused = reducedMotion.matches;
const motionButton = document.querySelector('.motion-toggle');
function syncMotion() {
  document.documentElement.classList.toggle('motion-paused', paused);
  if (!motionButton) return;
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.innerHTML = paused ? 'Resume motion <span aria-hidden="true">▷</span>' : 'Pause motion <span aria-hidden="true">Ⅱ</span>';
}
syncMotion();
motionButton?.addEventListener('click', () => { paused = !paused; syncMotion(); });
reducedMotion.addEventListener('change', event => { paused = event.matches; syncMotion(); });
document.querySelector('#year').textContent = new Date().getFullYear();

const hero = document.querySelector('.instrument-hero');
let heroProgress = 0;
function updateHeroProgress() {
  if (!hero) return;
  const travel = Math.max(1, hero.offsetHeight - innerHeight);
  heroProgress = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / travel));
}
window.addEventListener('scroll', updateHeroProgress, { passive: true });
window.addEventListener('resize', updateHeroProgress, { passive: true });
updateHeroProgress();

const menu = document.querySelector('#navigation');
const menuButton = document.querySelector('.menu-toggle');
function closeMenu() { menu.classList.remove('open'); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', 'Open navigation'); }
menuButton.addEventListener('click', () => {
  const open = menu.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
});
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.classList.contains('open')) { closeMenu(); menuButton.focus(); } });

if ('IntersectionObserver' in window && !reducedMotion.matches) {
  document.documentElement.classList.add('js-motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), { threshold: .08 });
  document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
}

if (document.querySelector('#cinematic-stage')) {
  import('./cinematic-motion.js?v=gesture2').then(({ initCinematicMotion }) => {
    return initCinematicMotion({ isPaused: () => paused });
  }).catch(() => { document.querySelector('.cinematic-study').classList.add('still-only'); });
}

// Download in parallel with the renderer modules, not after their import chain.
async function downloadModel() {
  const compressed = 'DecompressionStream' in window;
  const response = await fetch(`./assets/models/grip-one/grip-one-web.glb${compressed ? '.gz' : ''}`);
  if (!response.ok) throw new Error('CAD download failed');
  return compressed
    ? new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : response.arrayBuffer();
}
// UI remains usable when WebGL is disabled or the local renderer cannot load.
if (document.querySelector('.model-stage')) Promise.all([
  import('./assets/vendor/three.module.min.js'),
  import('./assets/vendor/GLTFLoader.js'),
  downloadModel(),
]).then(async ([THREE, { GLTFLoader }, modelBytes]) => {
  const loader = new GLTFLoader();
  const model = await loader.parseAsync(modelBytes, './assets/models/grip-one/');
  // Showcase-only metal finishes; source geometry and joint definitions stay intact.
  const materials = new Map();
  model.scene.traverse(object => {
    if (!object.isMesh) return;
    const name = object.name;
    const finish = { color: '#b9c0cb', metalness: .94, roughness: .27, clearcoat: .25, clearcoatRoughness: .25, envMapIntensity: 1.15 };
    if (/cameras_holder|raspi_box|sr_front_cover|sr_back_cover/.test(name)) Object.assign(finish, { color: '#424550', metalness: .9, roughness: .3 });
    if (/screw|washer|spacer|bushing/.test(name)) Object.assign(finish, { color: '#d1d5df', metalness: 1, roughness: .19 });
    if (/soft_tip/.test(name)) Object.assign(finish, { color: '#19171f', metalness: 0, roughness: .85, clearcoat: 0 });
    if (/arducam|lens|611_00020/.test(name)) Object.assign(finish, { color: '#12151f', metalness: .55, roughness: .09, clearcoat: 1, clearcoatRoughness: .08 });
    if (/lens/.test(name) && object.material.opacity < 1) Object.assign(finish, { color: '#3a3d47', metalness: 0, opacity: .24, transparent: true, depthWrite: false });
    if (/button|hmi/.test(name)) Object.assign(finish, { color: '#73618f', metalness: .85, roughness: .3 });
    const key = JSON.stringify(finish);
    if (!materials.has(key)) materials.set(key, new THREE.MeshPhysicalMaterial(finish));
    object.material = materials.get(key);
  });

  function studioEnvironment(renderer) {
    const studio = new THREE.Scene();
    studio.background = new THREE.Color('#36343d');
    const panel = (w, h, position, color, intensity) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide}));
      mesh.position.set(...position); mesh.lookAt(0, 0, 0); studio.add(mesh);
    };
    panel(4, 7, [-4, 2, 4], '#ffffff', 5);
    panel(2, 6, [5, 1, 1], '#e4e5ff', 3.5);
    panel(5, 3, [0, 6, -2], '#ffffff', 4);
    panel(3, 5, [-2, 0, -5], '#bba8ec', 1.5);
    panel(3, 7, [3, 0, 5], '#09090d', 1);
    const generator = new THREE.PMREMGenerator(renderer);
    const environment = generator.fromScene(studio, .08);
    generator.dispose();
    studio.traverse(object => { if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); } });
    return environment;
  }
  function createGripper() {
    const cad = model.scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(cad);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    cad.position.sub(center);
    const normalized = new THREE.Group(); normalized.add(cad);
    normalized.scale.setScalar(4 / Math.max(size.x, size.y, size.z));
    const group = new THREE.Group(); group.add(normalized);
    const proximal = cad.getObjectByName('joint_proximal');
    const distal = cad.getObjectByName('joint_distal');
    if (!proximal || !distal) throw new Error('CAD articulation is missing');
    // Axes and limits come from the source URDF. This is an illustrative
    // closure pose within those limits, not a simulation or measured stroke.
    function setGrip(amount) {
      for (const [pivot, angle] of [[proximal, -.65 * amount], [distal, .65 * amount]]) {
        const [lower, upper] = pivot.userData.limits;
        pivot.quaternion.setFromAxisAngle(new THREE.Vector3(...pivot.userData.axis).normalize(), THREE.MathUtils.clamp(angle, lower, upper));
      }
    }
    return { group, setGrip };
  }

  const views = [];
  function makeView(id, interactive) {
    const scrollDriven = id === 'hero-model' && !!hero;
    const stage = document.getElementById(id);
    if (!stage) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { if (interactive) document.querySelector('#viewer-hint').textContent = 'Static CAD view · 3D is unavailable in this browser'; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = interactive ? .95 : 1.05;
    stage.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const scene = new THREE.Scene();
    const environment = studioEnvironment(renderer);
    scene.environment = environment.texture;
    scene.add(new THREE.HemisphereLight('#f2eef9', '#625a70', .65));
    const key = new THREE.DirectionalLight('#ffffff', 1.5); key.position.set(-3, 5, 6); scene.add(key);
    const fill = new THREE.DirectionalLight('#dfd2ff', .8); fill.position.set(4, 2, -3); scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 1.5); rim.position.set(-4, -1, -2); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 40); camera.position.set(0, 0, 8.3);
    const { group, setGrip } = createGripper(); scene.add(group);
    const initial = { x: .28, y: 2.65, z: -.18 };
    group.rotation.set(initial.x, initial.y, initial.z);
    const view = { stage, renderer, scene, camera, group, setGrip, closure: 0, initial, interactive, scrollDriven, scrollProgress: 0, visible: true, closed: false, dragged: interactive, angle: initial.y, tilt: initial.x, tick: 0, dirty: true, zoom: 1, baseDistance: 8.1 };
    const fittedBounds = new THREE.Box3(), fittedSize = new THREE.Vector3(), fittedCenter = new THREE.Vector3();
    // Fit the complete posed assembly, including depth, in the limiting axis.
    // Even maximum zoom retains a margin; rotation and articulation refit it.
    view.fitCamera = () => {
      fittedBounds.setFromObject(group);
      fittedBounds.getSize(fittedSize); fittedBounds.getCenter(fittedCenter);
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fit = Math.max(fittedSize.y / (2 * tanV), fittedSize.x / (2 * tanV * camera.aspect));
      view.baseDistance = fittedSize.z / 2 + fit * 1.32;
      camera.position.set(fittedCenter.x, fittedCenter.y, fittedCenter.z + fittedSize.z / 2 + fit * 1.32 / view.zoom);
      camera.lookAt(fittedCenter);
    };
    function resize() {
      const { width, height } = stage.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height;
      view.fitCamera();
      camera.updateProjectionMatrix(); view.dirty = true;
    }
    new ResizeObserver(resize).observe(stage); resize();
    new IntersectionObserver(entries => { view.visible = entries[0].isIntersecting; view.dirty = true; }).observe(stage);
    renderer.render(scene, camera); stage.classList.add('loaded');
    if (scrollDriven) { hero.classList.add('scroll-ready'); updateHeroProgress(); }
    if (motionButton) motionButton.disabled = false;
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); stage.classList.remove('loaded'); view.visible = false;
      if (scrollDriven) hero.classList.remove('scroll-ready');
      if (motionButton) motionButton.disabled = true;
      if (interactive) { document.querySelector('#viewer-hint').textContent = 'Static CAD view · reload to retry 3D'; document.querySelectorAll('.explorer-controls button,#grip-toggle,#view-reset').forEach(button=>button.disabled=true); }
    });
    if (interactive) {
      document.querySelector('#viewer-hint').textContent = 'Drag to rotate · arrow keys also work';
      const presets = document.querySelectorAll('[data-cad-view]');
      const viewLabel = document.querySelector('#cad-view-label');
      const nameFreeView = () => { presets.forEach(button=>button.setAttribute('aria-pressed','false')); if(viewLabel)viewLabel.textContent='Free view'; };
      let pointer = null, x = 0, y = 0;
      stage.addEventListener('pointerdown', event => { if (event.button !== 0) return; pointer = event.pointerId; x = event.clientX; y = event.clientY; stage.setPointerCapture(pointer); view.dragged = true; });
      stage.addEventListener('pointermove', event => { if (event.pointerId !== pointer) return; view.angle += (event.clientX - x) * .012; if(event.pointerType!=='touch') view.tilt = THREE.MathUtils.clamp(view.tilt + (event.clientY - y) * .006, -.9, .9); x = event.clientX; y = event.clientY; view.dirty = true; nameFreeView(); });
      const end = () => { pointer = null; }; stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end); stage.addEventListener('lostpointercapture', end);
      stage.addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return; event.preventDefault(); if(event.key==='ArrowLeft'||event.key==='ArrowRight') view.angle += event.key === 'ArrowLeft' ? -.15 : .15; else view.tilt=THREE.MathUtils.clamp(view.tilt+(event.key==='ArrowUp'?-.12:.12),-.9,.9); view.dragged = true; view.dirty = true; nameFreeView(); });
      const grip = document.querySelector('#grip-toggle'), reset = document.querySelector('#view-reset');
      grip.disabled = false; reset.disabled = false;
      grip.addEventListener('click', () => { view.closed = !view.closed; grip.textContent = view.closed ? 'Open grip' : 'Close grip'; grip.setAttribute('aria-pressed', String(view.closed)); view.dirty = true; });
      const zoomIn=document.querySelector('#zoom-in'),zoomOut=document.querySelector('#zoom-out');
      const updateZoom=()=>{view.fitCamera();view.dirty=true;if(zoomIn)zoomIn.disabled=view.zoom>=1.25;if(zoomOut)zoomOut.disabled=view.zoom<=.8;};
      if(zoomIn){zoomIn.disabled=false;zoomIn.addEventListener('click',()=>{view.zoom=Math.min(1.25,view.zoom+.125);updateZoom();});}
      if(zoomOut){zoomOut.disabled=false;zoomOut.addEventListener('click',()=>{view.zoom=Math.max(.8,view.zoom-.15);updateZoom();});}
      const angles={perspective:[.28,2.65,-.18,'Three-quarter view'],front:[.08,Math.PI,0,'Camera view'],side:[.12,Math.PI/2,0,'Side view'],rear:[.12,0,0,'Rear assembly']};
      for(const button of presets){button.disabled=false;button.addEventListener('click',()=>{const [tilt,angle,roll,label]=angles[button.dataset.cadView];view.tilt=tilt;view.angle=angle;view.initial.z=roll;view.dirty=true;view.dragged=true;presets.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));if(viewLabel)viewLabel.textContent=label;});}
      reset.addEventListener('click', () => { view.angle = 2.65; view.tilt = .28; view.initial.z=-.18; view.zoom=1; updateZoom();view.dragged = true; view.closed = false; view.tick = 0; view.dirty = true; grip.textContent = 'Close grip'; grip.setAttribute('aria-pressed', String(view.closed));presets.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.cadView==='perspective')));if(viewLabel)viewLabel.textContent='Three-quarter view'; });
    }
    views.push(view);
  }
  makeView('hero-model', false);
  makeView('product-model', true);
  let last = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    if (document.hidden || now - last < 32) return;
    const frameDt = Math.min((now - last) / 1000, .25);
    const dt = Math.min(frameDt, .05); last = now;
    for (const v of views) {
      if (!v.visible) continue;
      if (v.scrollDriven) {
        const targetProgress = reducedMotion.matches ? 0 : heroProgress;
        const delta = targetProgress - v.scrollProgress;
        if (delta === 0 && !v.dirty) continue;
        v.scrollProgress = Math.abs(delta) < .0001 ? targetProgress : v.scrollProgress + delta * (1 - Math.exp(-frameDt * 10));
        const turn = v.scrollProgress * v.scrollProgress * (3 - 2 * v.scrollProgress);
        v.group.rotation.set(v.initial.x - turn * .22, v.initial.y + turn * 2.1, v.initial.z + turn * .28);
        v.fitCamera();
        v.renderer.render(v.scene, v.camera); v.dirty = false;
        continue;
      }
      const moving = !paused && (!v.interactive || !v.dragged);
      const target = v.closed ? 1 : 0;
      const gripping = Math.abs(v.closure - target) > .001;
      if (!moving && !gripping && !v.dirty) continue;
      if (moving) v.tick += dt;
      const scrollTurn = v.interactive ? 0 : heroProgress;
      v.group.rotation.y = v.angle + (v.dragged ? 0 : Math.sin(v.tick * .35) * .18) + scrollTurn * .8;
      v.group.rotation.z = v.initial.z + scrollTurn * .22;
      v.group.rotation.x = v.tilt;
      v.group.position.y = v.interactive ? 0 : Math.sin(v.tick * .7) * .07;
      v.closure = THREE.MathUtils.lerp(v.closure, target, reducedMotion.matches || paused ? 1 : .15);
      v.setGrip(v.closure);
      v.fitCamera();
      v.renderer.render(v.scene, v.camera); v.dirty = false;
    }
  }
  requestAnimationFrame(animate);
}).catch(() => { const hint = document.querySelector('#viewer-hint'); if (hint) hint.textContent = 'Static CAD view · interactive model could not load'; });

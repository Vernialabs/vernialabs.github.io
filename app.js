const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// Preserve previously shared product links after moving the hardware collection.
if (!document.querySelector('.model-stage') && location.hash === '#grip-one') {
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

const hero = document.querySelector('.hero');
let heroProgress = 0;
function updateHeroProgress() {
  if (!hero || paused || reducedMotion.matches) return;
  heroProgress = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / hero.offsetHeight));
  hero.style.setProperty('--headline-shift', `${heroProgress * -45}px`);
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

// UI remains usable when WebGL is disabled or the local renderer cannot load.
if (document.querySelector('.model-stage')) Promise.all([
  import('./assets/vendor/three.module.min.js'),
  import('./assets/vendor/GLTFLoader.js'),
]).then(async ([THREE, { GLTFLoader }]) => {
  const loader = new GLTFLoader();
  // Static hosting cannot set Content-Encoding for a .gz asset; decode it here.
  // Older browsers retain the normal GLB path, and failures retain the poster.
  let model;
  if ('DecompressionStream' in window) {
    const response = await fetch('./assets/models/grip-one/grip-one.glb.gz');
    if (!response.ok) throw new Error('CAD download failed');
    const decoded = new Response(response.body.pipeThrough(new DecompressionStream('gzip')));
    model = await loader.parseAsync(await decoded.arrayBuffer(), './assets/models/grip-one/');
  } else {
    model = await loader.loadAsync('./assets/models/grip-one/grip-one.glb');
  }
  // Showcase-only metal finishes; source geometry and joint definitions stay intact.
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
    object.material = new THREE.MeshPhysicalMaterial(finish);
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
    const stage = document.getElementById(id);
    if (!stage) return;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { if (interactive) document.querySelector('#viewer-hint').textContent = 'GRIP ONE'; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
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
    const initial = { x: interactive ? .28 : .2, y: interactive ? 2.65 : 2.35, z: interactive ? -.18 : -.12 };
    group.rotation.set(initial.x, initial.y, initial.z);
    const view = { stage, renderer, scene, camera, group, setGrip, closure: 0, initial, interactive, visible: true, closed: false, dragged: false, angle: initial.y, tilt: initial.x, tick: 0, dirty: true };
    function resize() {
      const { width, height } = stage.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height;
      // Fit the diagonal silhouette on both portrait phones and wide desktop stages.
      camera.position.z = Math.max(interactive ? 8.1 : 7.6, 7.8 / camera.aspect);
      camera.updateProjectionMatrix(); view.dirty = true;
    }
    new ResizeObserver(resize).observe(stage); resize();
    new IntersectionObserver(entries => { view.visible = entries[0].isIntersecting; view.dirty = true; }).observe(stage);
    renderer.render(scene, camera); stage.classList.add('loaded');
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); stage.classList.remove('loaded'); view.visible = false;
      if (interactive) { document.querySelector('#viewer-hint').textContent = 'GRIP ONE'; document.querySelector('#grip-toggle').disabled = true; document.querySelector('#view-reset').disabled = true; }
    });
    if (interactive) {
      let pointer = null, x = 0, y = 0;
      stage.addEventListener('pointerdown', event => { if (event.button !== 0) return; pointer = event.pointerId; x = event.clientX; y = event.clientY; stage.setPointerCapture(pointer); view.dragged = true; });
      stage.addEventListener('pointermove', event => { if (event.pointerId !== pointer) return; view.angle += (event.clientX - x) * .012; view.tilt = THREE.MathUtils.clamp(view.tilt + (event.clientY - y) * .006, -.7, .7); x = event.clientX; y = event.clientY; view.dirty = true; });
      const end = () => { pointer = null; }; stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end); stage.addEventListener('lostpointercapture', end);
      stage.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); view.angle += event.key === 'ArrowLeft' ? -.15 : .15; view.dragged = true; view.dirty = true; } });
      const grip = document.querySelector('#grip-toggle'), reset = document.querySelector('#view-reset');
      grip.disabled = false; reset.disabled = false;
      grip.addEventListener('click', () => { view.closed = !view.closed; grip.textContent = view.closed ? 'Open grip' : 'Close grip'; grip.setAttribute('aria-pressed', String(view.closed)); view.dirty = true; });
      reset.addEventListener('click', () => { view.angle = initial.y; view.tilt = initial.x; view.dragged = false; view.closed = false; view.tick = 0; view.dirty = true; grip.textContent = 'Close grip'; grip.setAttribute('aria-pressed', 'false'); });
    }
    views.push(view);
  }
  makeView('hero-model', false);
  makeView('product-model', true);
  let last = 0;
  function animate(now) {
    requestAnimationFrame(animate);
    if (document.hidden || now - last < 32) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    for (const v of views) {
      if (!v.visible) continue;
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
      v.renderer.render(v.scene, v.camera); v.dirty = false;
    }
  }
  requestAnimationFrame(animate);
}).catch(() => { const hint = document.querySelector('#viewer-hint'); if (hint) hint.textContent = 'GRIP ONE'; });

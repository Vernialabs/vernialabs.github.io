const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = reducedMotion.matches;
const motionButton = document.querySelector('.motion-toggle');
function syncMotion() {
  motionButton.setAttribute('aria-pressed', String(paused));
  motionButton.innerHTML = paused ? 'Resume motion <span aria-hidden="true">▷</span>' : 'Pause motion <span aria-hidden="true">Ⅱ</span>';
}
syncMotion();
motionButton.addEventListener('click', () => { paused = !paused; syncMotion(); });
reducedMotion.addEventListener('change', event => { paused = event.matches; syncMotion(); });
document.querySelector('#year').textContent = new Date().getFullYear();

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

// UI remains usable when WebGL is disabled or the local renderer cannot load.
import('./assets/vendor/three.module.min.js').then(THREE => {
  const material = (color, metalness = 0, roughness = .45) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const shell = material('#dddbe4', .35, .32);
  const edge = material('#a3a0b0', .65, .25);
  const dark = material('#282530', .25, .44);
  const rubber = material('#15131b', 0, .92);
  const violet = material('#9a6bff', .15, .35);
  const screw = material('#716b7d', .85, .2);
  const lens = new THREE.MeshPhysicalMaterial({ color: '#173d48', metalness: .8, roughness: .12, clearcoat: 1 });

  function box(w, h, d, mat, x = 0, y = 0, z = 0, radius = .05) {
    const r = Math.min(radius, w / 3, h / 3, d / 3);
    const s = new THREE.Shape();
    const a = -w / 2 + r, b = -h / 2 + r, c = w / 2 - r, e = h / 2 - r;
    s.moveTo(a, b); s.lineTo(c, b); s.lineTo(c, e); s.lineTo(a, e); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: d - r * 2, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: r, bevelThickness: r });
    geo.translate(0, 0, -d / 2 + r);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); return mesh;
  }
  function cylinder(radius, depth, mat, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 40), mat);
    mesh.rotation.x = Math.PI / 2; mesh.position.set(x, y, z); return mesh;
  }
  function label(text, width, height, x, y, z, color = '#30283b') {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.font = '500 52px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 64);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    mesh.position.set(x, y, z); return mesh;
  }
  function createGripper() {
    const group = new THREE.Group();
    group.add(box(.73, 1.8, .65, shell, 0, -.98, 0, .13));
    group.add(box(.53, 1.32, .08, rubber, 0, -1.03, .345));
    for (let i = 0; i < 12; i++) group.add(box(.46, .025, .025, dark, 0, -1.57 + i * .095, .398, .005));
    group.add(box(.77, .17, .69, dark, 0, -1.84, 0));
    group.add(box(.72, .065, .67, violet, 0, -.2, 0));
    group.add(box(1.47, .88, .89, shell, 0, .27, 0, .12));
    group.add(box(1.29, .07, .79, dark, 0, .04, 0));
    group.add(box(1.25, .56, .55, dark, 0, .74, .27, .1));
    group.add(box(1.15, .45, .05, rubber, 0, .74, .56, .04));
    for (const x of [-.32, .32]) {
      group.add(cylinder(.195, .08, screw, x, .75, .62));
      group.add(cylinder(.156, .09, rubber, x, .75, .67));
      group.add(cylinder(.12, .025, lens, x, .75, .72));
      group.add(cylinder(.055, .027, material('#061112', .7, .2), x, .75, .735));
      group.add(cylinder(.027, .029, material('#7cabb1', .6, .1), x - .034, .79, .75));
    }
    group.add(cylinder(.025, .02, violet, 0, .75, .61));
    group.add(box(1.46, .16, .64, edge, 0, .76, -.2));
    group.add(box(1.4, .12, .32, dark, 0, .88, -.25));
    group.add(label('V E R N I A', .72, .18, 0, .35, .451));
    group.add(label('GRIP ONE', .54, .135, 0, .15, .451));
    for (const x of [-.59, .59]) for (const y of [.07, .48]) {
      group.add(cylinder(.04, .02, screw, x, y, .448));
      group.add(box(.045, .009, .009, rubber, x, y, .465, .002));
    }
    // An original procedural concept, not production CAD or a specification.
    const jaws = [];
    for (const side of [-1, 1]) {
      const jaw = new THREE.Group(); jaw.position.x = side * .59;
      jaw.add(box(.24, 1.24, .43, shell, 0, 1.36, -.24, .04));
      jaw.add(box(.26, .27, .68, edge, -side * .035, 1.88, -.09, .045));
      jaw.add(box(.13, .65, .53, rubber, -side * .14, 1.68, -.08, .025));
      for (let i = 0; i < 6; i++) jaw.add(box(.025, .025, .45, dark, -side * .214, 1.46 + i * .085, -.08, .004));
      jaw.add(cylinder(.07, .035, screw, 0, 1.02, -.005));
      jaws.push(jaw); group.add(jaw);
    }
    const trigger = box(.17, .75, .21, dark, .53, -.65, .08, .055); trigger.rotation.z = -.22; group.add(trigger);
    const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(-.52, .38, -.3),new THREE.Vector3(-.85, .1, -.4),new THREE.Vector3(-.65, -.5, -.3),new THREE.Vector3(-.35, -.8, -.3)]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(cable, 24, .035, 8, false), rubber));
    return { group, jaws };
  }

  const views = [];
  function makeView(id, interactive) {
    const stage = document.getElementById(id);
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { if (interactive) document.querySelector('#viewer-hint').textContent = 'STATIC CONCEPT VIEW'; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = interactive ? 1.3 : 1.55;
    stage.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#f2eef9', '#625a70', 2.7));
    const key = new THREE.DirectionalLight('#ffffff', 4); key.position.set(-3, 5, 6); scene.add(key);
    const fill = new THREE.DirectionalLight('#dfd2ff', 2.2); fill.position.set(4, 2, -3); scene.add(fill);
    const rim = new THREE.DirectionalLight('#ffffff', 2.5); rim.position.set(-4, -1, -2); scene.add(rim);
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 40); camera.position.set(0, 0, 8.3);
    const { group, jaws } = createGripper(); scene.add(group);
    const initial = { x: .18, y: -.5, z: interactive ? -.3 : -.48 };
    group.rotation.set(initial.x, initial.y, initial.z);
    const view = { stage, renderer, scene, camera, group, jaws, initial, interactive, visible: true, closed: false, dragged: false, angle: initial.y, tilt: initial.x, tick: 0, dirty: true };
    function resize() {
      const { width, height } = stage.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height); camera.aspect = width / height;
      // Fit the diagonal silhouette on both portrait phones and wide desktop stages.
      camera.position.z = Math.max(interactive ? 8.1 : 7.6, 6.1 / camera.aspect);
      camera.updateProjectionMatrix(); view.dirty = true;
    }
    new ResizeObserver(resize).observe(stage); resize();
    new IntersectionObserver(entries => { view.visible = entries[0].isIntersecting; view.dirty = true; }).observe(stage);
    renderer.render(scene, camera); stage.classList.add('loaded');
    renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault(); stage.classList.remove('loaded'); view.visible = false;
      if (interactive) { document.querySelector('#viewer-hint').textContent = 'STATIC CONCEPT VIEW'; document.querySelector('#grip-toggle').disabled = true; document.querySelector('#view-reset').disabled = true; }
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
      const target = v.closed ? .25 : .59;
      const gripping = Math.abs(v.jaws[1].position.x - target) > .001;
      if (!moving && !gripping && !v.dirty) continue;
      if (moving) v.tick += dt;
      v.group.rotation.y = v.angle + (v.dragged ? 0 : Math.sin(v.tick * .35) * .3);
      v.group.rotation.x = v.tilt;
      v.group.position.y = v.interactive ? 0 : Math.sin(v.tick * .7) * .07;
      for (let i = 0; i < 2; i++) v.jaws[i].position.x = THREE.MathUtils.lerp(v.jaws[i].position.x, (i === 0 ? -1 : 1) * target, reducedMotion.matches || paused ? 1 : .15);
      v.renderer.render(v.scene, v.camera); v.dirty = false;
    }
  }
  requestAnimationFrame(animate);
}).catch(() => { document.querySelector('#viewer-hint').textContent = 'STATIC CONCEPT VIEW'; });

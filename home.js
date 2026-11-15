// Vernia homepage: two floating devices with live callouts, the fruit-bowl game on a hover table,
// the episode report, and the pilot form. Three.js 0.170 is vendored; nothing loads from a CDN.
import * as THREE from './assets/vendor/three.module.min.js';
import { GLTFLoader } from './assets/vendor/GLTFLoader.js';
import { RoomEnvironment } from './assets/vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from './assets/vendor/RoundedBoxGeometry.js';
import { siteConfig } from './site-config.js';

// Preview builds (outside vernia.in) may set window.VERNIA_PREVIEW before this module runs.
const PREVIEW = window.VERNIA_PREVIEW || null;

// Sensor rates used for the episode report. Update these when the Grip One firmware is final.
const RATES = { video: 30, depth: 30, imu: 200, encoder: 100, force: 100, pose: 30 };
const VIDEO = { width: 1280, height: 800, mbps: 6 };
const DEPTH = { width: 640, height: 400, ratio: .35 };

const $ = s => document.querySelector(s);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = getComputedStyle(document.documentElement);
const tok = n => css.getPropertyValue(n).trim();
const clamp = THREE.MathUtils.clamp;

// ---------- shared: the Grip One CAD ----------
// Electronics inside the handle (Raspberry Pi, battery board and their fasteners) stay hidden.
const HIDDEN = /raspberry_pi|pisugar|spacer_h8_5|hexalobular_socket_pan_head_screw_m2_5|pz_pan_head_screw_m2_5/;
function finish(root) {
  const mats = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const n = o.name;
    if (HIDDEN.test(n)) { o.visible = false; return; }
    const f = { color: '#b9c0cb', metalness: .94, roughness: .27, clearcoat: .25, clearcoatRoughness: .25, envMapIntensity: 1.15 };
    if (/cameras_holder|raspi_box|sr_front_cover|sr_back_cover/.test(n)) Object.assign(f, { color: '#424550', metalness: .9, roughness: .3 });
    if (/screw|washer|spacer|bushing/.test(n)) Object.assign(f, { color: '#d1d5df', metalness: 1, roughness: .19 });
    if (/soft_tip/.test(n)) Object.assign(f, { color: '#19171f', metalness: 0, roughness: .85, clearcoat: 0 });
    if (/arducam|lens|611_00020/.test(n)) Object.assign(f, { color: '#12151f', metalness: .55, roughness: .09, clearcoat: 1, clearcoatRoughness: .08 });
    if (/lens/.test(n) && o.material && o.material.opacity < 1) Object.assign(f, { color: '#3a3d47', metalness: 0, opacity: .24, transparent: true, depthWrite: false });
    if (/button|hmi/.test(n)) Object.assign(f, { color: '#3d3f8f', metalness: .85, roughness: .3 });
    const k = JSON.stringify(f);
    if (!mats.has(k)) mats.set(k, new THREE.MeshPhysicalMaterial(f));
    o.material = mats.get(k); o.castShadow = true;
  });
}
function articulation(root) {
  const prox = root.getObjectByName('joint_proximal'), dist = root.getObjectByName('joint_distal');
  if (!prox || !dist) throw new Error('Grip One joints missing');
  const ax = o => V3(...(o.userData.axis || [0, 0, 1])).normalize();
  const lim = o => o.userData.limits || [-Math.PI, Math.PI];
  const a1 = ax(prox), a2 = ax(dist), l1 = lim(prox), l2 = lim(dist);
  return a => {
    prox.quaternion.setFromAxisAngle(a1, clamp(-.65 * a, l1[0], l1[1]));
    dist.quaternion.setFromAxisAngle(a2, clamp(.65 * a, l2[0], l2[1]));
  };
}
function studioEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color('#3a3b40');
  const panel = (w, h, p, c, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); s.add(m); };
  panel(4, 7, [-4, 2, 4], '#fff4dc', 5); panel(2, 6, [5, 1, 1], '#dfe6fa', 3.5); panel(5, 3, [0, 6, -2], '#ffffff', 4);
  panel(3, 5, [-2, 0, -5], '#b9c4ef', 1.8); panel(3, 7, [3, 0, 5], '#2a2f55', 1); panel(8, 3, [0, -5, 0], '#c7cfe8', 1.6);
  const g = new THREE.PMREMGenerator(renderer); const t = g.fromScene(s, .08).texture; g.dispose(); return t;
}
function makeRenderer(opts) {
  const r = new THREE.WebGLRenderer({ antialias: true, ...opts });
  r.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  return r;
}
function watch(el, view) {
  new IntersectionObserver(e => { view.visible = e[0].isIntersecting; }, { rootMargin: '160px' }).observe(el);
}
// An anchor is a point fixed to a part, kept in that part's own space so it follows rotation and joints.
function anchorAt(obj, root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.isEmpty() ? obj.getWorldPosition(V3()) : box.getCenter(V3());
  return { obj, local: obj.worldToLocal(c) };
}
function normalize(object, size = 4) {
  const box = new THREE.Box3().setFromObject(object);
  const dim = box.getSize(V3()), centre = box.getCenter(V3());
  object.position.sub(centre);
  const holder = new THREE.Group(); holder.add(object);
  const scale = size / Math.max(dim.x, dim.y, dim.z);
  holder.scale.setScalar(scale);
  const outer = new THREE.Group(); outer.add(holder);
  return { object: outer, radius: dim.clone().multiplyScalar(scale).length() / 2 };
}

function buildGripper(gltf) {
  const cad = gltf.scene.clone(true); finish(cad);
  const setGrip = articulation(cad);
  const { object, radius } = normalize(cad);
  const byName = n => cad.getObjectByName(n);
  const parts = { fisheye: 'arducam_fisheye', depth: '612_00001_tim_thermal_oak_d_poe', imu: 'oak_r', encoder: 'joint_proximal', force: 'distal_soft_tip', button: 'button' };
  const anchors = {};
  for (const [key, name] of Object.entries(parts)) { const o = byName(name); if (o) anchors[key] = anchorAt(o, object); }
  let closure = 0, target = 0;
  return {
    object, radius, anchors,
    tap() { target = target ? 0 : 1; },
    update(dt) { closure += (target - closure) * Math.min(1, dt * 6); setGrip(closure); }
  };
}

// View One: a head-worn camera rig. Proportions follow a forehead camera module on an adjustable band.
function buildHeadset() {
  const g = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: '#b9c0cb', metalness: .94, roughness: .27, clearcoat: .25, clearcoatRoughness: .25, envMapIntensity: 1.15 });
  const graphite = new THREE.MeshPhysicalMaterial({ color: '#424550', metalness: .9, roughness: .3 });
  const fabric = new THREE.MeshStandardMaterial({ color: '#2b2f45', roughness: .95, side: THREE.DoubleSide });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#12151f', metalness: .55, roughness: .09, clearcoat: 1, clearcoatRoughness: .08 });
  const accent = new THREE.MeshPhysicalMaterial({ color: '#3d3f8f', metalness: .85, roughness: .3 });
  const add = (geo, mat, f) => { const m = new THREE.Mesh(geo, mat); if (f) f(m); g.add(m); return m; };
  add(new THREE.CylinderGeometry(.098, .098, .034, 96, 1, true), fabric, m => m.scale.set(1, 1, 1.2));
  add(new THREE.CylinderGeometry(.093, .093, .03, 96, 1, true), fabric, m => m.scale.set(1, 1, 1.2));
  const strap = add(new THREE.TorusGeometry(.104, .009, 10, 72, Math.PI), fabric, m => { m.rotation.y = Math.PI / 2; m.scale.set(1.18, .82, 2.2); m.position.y = .012; });
  add(new RoundedBoxGeometry(.132, .05, .04, 4, .012), metal, m => m.position.set(0, .012, .126));
  add(new RoundedBoxGeometry(.122, .04, .006, 3, .003), glass, m => m.position.set(0, .012, .146));
  const lensAt = x => {
    add(new THREE.TorusGeometry(.0105, .0022, 10, 32), metal, m => m.position.set(x, .014, .149));
    return add(new THREE.CylinderGeometry(.0092, .0092, .008, 32), glass, m => { m.rotation.x = Math.PI / 2; m.position.set(x, .014, .149); });
  };
  const lensL = lensAt(-.036); lensAt(.036);
  add(new THREE.TorusGeometry(.0125, .0024, 10, 32), metal, m => m.position.set(0, .014, .15));
  const dome = add(new THREE.SphereGeometry(.0115, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, m => { m.rotation.x = Math.PI / 2; m.position.set(0, .014, .149); });
  for (const s of [-1, 1]) add(new RoundedBoxGeometry(.02, .036, .03, 3, .006), graphite, m => m.position.set(s * .072, .006, .108));
  const pod = add(new RoundedBoxGeometry(.088, .056, .032, 4, .012), graphite, m => m.position.set(0, .004, -.128));
  const btn = add(new THREE.CylinderGeometry(.008, .008, .006, 24), accent, m => m.position.set(.02, .034, -.128));
  const curve = new THREE.CatmullRomCurve3([V3(-.03, -.012, -.142), V3(-.09, -.014, -.07), V3(-.1, -.014, .02), V3(-.065, -.008, .1)]);
  add(new THREE.TubeGeometry(curve, 40, .0028, 8, false), graphite);
  const imu = new THREE.Object3D(); imu.position.set(.03, .032, .126); g.add(imu);
  const top = new THREE.Object3D(); top.position.set(0, .012 + .104 * .82, -.02); g.add(top);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const { object, radius } = normalize(g);
  const anchors = { stereo: anchorAt(lensL, object), fisheye: anchorAt(dome, object), imu: anchorAt(imu, object), compute: anchorAt(pod, object), button: anchorAt(btn, object), strap: anchorAt(top, object) };
  void strap;
  return { object, radius, anchors };
}

// ---------- a product stage: drag to turn, callout lines follow the parts ----------
function productStage(stage, built, { yaw, pitch, roll = 0, phase = 0, side }) {
  const holder = stage.querySelector('.stage-canvas');
  const renderer = makeRenderer({ alpha: true });
  holder.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environment = studioEnv(renderer);
  scene.add(new THREE.HemisphereLight('#f4f5fb', '#5d6070', .6));
  const key = new THREE.DirectionalLight('#fff6e8', 1.4); key.position.set(-3, 5, 6); scene.add(key);
  const fill = new THREE.DirectionalLight('#dfe6fa', .7); fill.position.set(4, 2, -3); scene.add(fill);
  const rim = new THREE.DirectionalLight('#ffffff', 1.3); rim.position.set(-4, -1, -2); scene.add(rim);
  const pivot = new THREE.Group(); pivot.add(built.object); scene.add(pivot);
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 60);

  const svg = stage.querySelector('.lines');
  const NS = 'http://www.w3.org/2000/svg';
  const labels = [...stage.querySelectorAll('.callout')].map(el => {
    const line = document.createElementNS(NS, 'polyline'), dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '3.5'); svg.append(line, dot);
    return { el, line, dot, anchor: built.anchors[el.dataset.anchor], y: 0 };
  });
  const list = stage.querySelector('.callouts');
  let geo = null;
  function measure() {
    const { width, height } = holder.getBoundingClientRect();
    if (width && height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const v = THREE.MathUtils.degToRad(camera.fov / 2), h = Math.atan(Math.tan(v) * camera.aspect);
      const d = Math.max(built.radius / Math.sin(v), built.radius / Math.sin(h)) * .86;
      camera.position.set(0, .15, d); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    }
    const sr = stage.getBoundingClientRect(), cr = renderer.domElement.getBoundingClientRect(), lr = list.getBoundingClientRect();
    const on = getComputedStyle(svg).display !== 'none';
    geo = { on, cx: cr.left - sr.left, cy: cr.top - sr.top, cw: cr.width, ch: cr.height, edge: side === 'left' ? lr.right - sr.left + 10 : lr.left - sr.left - 10 };
    for (const l of labels) { const r = l.el.getBoundingClientRect(); l.y = r.top - sr.top + 10; l.el.hidden = !l.anchor; }
  }
  new ResizeObserver(measure).observe(stage); measure();

  const st = { yaw, pitch, vyaw: 0, drag: null, last: -10, t: 0, visible: true, dirty: true };
  watch(stage, st);
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { st.drag = { x: e.clientX, y: e.clientY, moved: 0 }; el.setPointerCapture(e.pointerId); st.vyaw = 0; });
  el.addEventListener('pointermove', e => {
    if (!st.drag) return;
    const dx = e.clientX - st.drag.x, dy = e.clientY - st.drag.y;
    st.drag.x = e.clientX; st.drag.y = e.clientY; st.drag.moved += Math.abs(dx) + Math.abs(dy);
    st.yaw += dx * .01; st.pitch = clamp(st.pitch + dy * .006, -.8, 1); st.vyaw = dx * .01; st.last = st.t;
  });
  const end = () => { if (st.drag && st.drag.moved < 6 && built.tap) built.tap(); st.drag = null; st.last = st.t; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', () => { st.drag = null; });
  stage.addEventListener('keydown', e => {
    const k = { ArrowLeft: [-.18, 0], ArrowRight: [.18, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] }[e.key];
    if (k) { e.preventDefault(); st.yaw += k[0]; st.pitch = clamp(st.pitch + k[1], -.8, 1); st.last = st.t; }
    if ((e.key === 'Enter' || e.key === ' ') && built.tap) { e.preventDefault(); built.tap(); }
  });

  stage.classList.add('is-live');
  const p = V3();
  st.tick = dt => {
    if (!st.visible) return;
    st.t += dt;
    if (!st.drag) { st.yaw += st.vyaw; st.vyaw *= .9; }
    const idle = reduceMotion ? 0 : clamp((st.t - st.last - 2.5) / 2, 0, 1);
    pivot.rotation.set(st.pitch, st.yaw + Math.sin(st.t * .35 + phase) * .2 * idle, roll);
    pivot.position.y = reduceMotion ? 0 : Math.sin(st.t * .8 + phase) * .1;
    if (built.update) built.update(dt);
    renderer.render(scene, camera);
    if (!geo.on) return;
    pivot.updateMatrixWorld(true);
    for (const l of labels) {
      if (!l.anchor) continue;
      p.copy(l.anchor.local); l.anchor.obj.localToWorld(p); p.project(camera);
      const x = geo.cx + (p.x + 1) / 2 * geo.cw, y = geo.cy + (1 - p.y) / 2 * geo.ch;
      const knee = side === 'left' ? geo.edge + 22 : geo.edge - 22;
      l.line.setAttribute('points', `${geo.edge},${l.y} ${knee},${l.y} ${x.toFixed(1)},${y.toFixed(1)}`);
      l.dot.setAttribute('cx', x.toFixed(1)); l.dot.setAttribute('cy', y.toFixed(1));
    }
  };
  return st;
}

// ---------- the game: a hover table in the sky ----------
function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 4;
  return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(200,210,255,.55)'); r.addColorStop(1, 'rgba(200,210,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function startGame(gltf) {
  const stage = $('#game-stage');
  const renderer = makeRenderer({ alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .8;
  scene.add(new THREE.HemisphereLight('#e6ecff', '#b9b2a6', .65));
  const sun = new THREE.DirectionalLight('#fff4e6', 2.3);
  sun.position.set(-.35, 1.15, .55); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -.7, right: .7, top: .7, bottom: -.7, near: .1, far: 3 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .01; sun.shadow.radius = 3;
  sun.shadow.camera.layers.enableAll();
  scene.add(sun);

  // the table: a birch top on a navy frame, held up by four ducted fans
  const birch = canvasTexture(1024, 512, (g, w, h) => {
    for (let y = 0; y < h; y += 64) {
      const l = 78 + Math.random() * 6;
      g.fillStyle = `hsl(36,38%,${l}%)`; g.fillRect(0, y, w, 64);
      for (let k = 0; k < 12; k++) {
        g.strokeStyle = `hsla(32,35%,${l - 12 - Math.random() * 8}%,${.12 + Math.random() * .18})`; g.lineWidth = .6 + Math.random();
        g.beginPath(); const yy = y + Math.random() * 64, a = 1 + Math.random() * 3, f = .004 + Math.random() * .01, ph = Math.random() * 9;
        for (let x = 0; x <= w; x += 16) g.lineTo(x, yy + Math.sin(x * f + ph) * a);
        g.stroke();
      }
      g.fillStyle = 'rgba(90,70,50,.18)'; g.fillRect(0, y, w, 1.2);
    }
  }, [1, 1]);
  const table = new THREE.Mesh(new RoundedBoxGeometry(.92, .03, .52, 4, .012), new THREE.MeshStandardMaterial({ map: birch, roughness: .55 }));
  table.position.y = -.015; table.receiveShadow = table.castShadow = true; scene.add(table);
  const navy = new THREE.MeshStandardMaterial({ color: '#2a2f55', roughness: .4, metalness: .35 });
  const frame = new THREE.Mesh(new RoundedBoxGeometry(.84, .014, .44, 3, .006), navy);
  frame.position.y = -.037; frame.castShadow = true; scene.add(frame);
  const fanMetal = new THREE.MeshPhysicalMaterial({ color: '#c9ced8', metalness: .9, roughness: .3, clearcoat: .3 });
  const fanDark = new THREE.MeshStandardMaterial({ color: '#2b2f45', roughness: .6, metalness: .4, side: THREE.DoubleSide });
  const glowTex = glowTexture();
  const rotors = [], glows = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pod = new THREE.Group(); pod.position.set(sx * .43, -.07, sz * .24); scene.add(pod);
    const duct = new THREE.Mesh(new THREE.TorusGeometry(.052, .009, 12, 40), fanMetal); duct.rotation.x = Math.PI / 2; pod.add(duct);
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(.046, .046, .022, 36, 1, true), fanDark); pod.add(shroud);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .024, 16), navy); pod.add(hub);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .045, 10), navy); strut.position.y = .03; pod.add(strut);
    const rotor = new THREE.Group(); pod.add(rotor); rotors.push(rotor);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.04, .002, .011), fanDark); b.position.x = .022; const arm = new THREE.Group(); arm.rotation.y = k * Math.PI * 2 / 3; b.rotation.x = .3; arm.add(b); rotor.add(arm); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#c8d2ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .7 }));
    glow.scale.set(.16, .16, 1); glow.position.y = -.045; pod.add(glow); glows.push(glow);
    pod.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }

  // the gripper, jaws down, grasp point at the rig origin
  const cad = gltf.scene.clone(true); finish(cad);
  const setGrip = articulation(cad);
  const holder = new THREE.Group(); holder.add(cad);
  const rig = new THREE.Group(); rig.add(holder); scene.add(rig);
  const node = n => cad.getObjectByName(n);
  const thumbN = node('thumb_tip'), fingerN = node('finger_tip'), camN = node('camera');
  const wp = (o, v = V3()) => o.getWorldPosition(v);
  rig.updateMatrixWorld(true);
  const dir = wp(node('gripper_center')).sub(wp(node('gripper_base'))).normalize();
  const jaw = wp(fingerN).sub(wp(thumbN)); jaw.sub(dir.clone().multiplyScalar(jaw.dot(dir))).normalize();
  const L = new THREE.Matrix4().makeBasis(jaw, dir, V3().crossVectors(jaw, dir));
  holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(1, 0, 0), V3(0, -1, 0), V3(0, 0, -1)).multiply(L.clone().transpose()));
  rig.updateMatrixWorld(true);
  const mid = () => wp(thumbN).add(wp(fingerN)).multiplyScalar(.5);
  holder.position.sub(mid()); rig.updateMatrixWorld(true);
  cad.traverse(o => { if (o.isMesh && o.visible && !/soft_tip|distal|proximal|^grip_r(_\d+)?$|pivot/.test(o.name)) o.layers.set(1); });

  const widths = []; for (let i = 0; i <= 40; i++) { setGrip(i / 40); rig.updateMatrixWorld(true); widths.push(wp(thumbN).distanceTo(wp(fingerN))); }
  const w0 = widths[0];
  const rB = clamp(w0 * .36, .022, .034);
  const contactFor = r => { const d = 2 * r * .95; for (let i = 0; i <= 40; i++) if (widths[i] <= d) return i / 40; return 1; };
  const holdFor = c => { setGrip(c); rig.updateMatrixWorld(true); const m = mid(); setGrip(0); rig.updateMatrixWorld(true); return m; };

  const phys = (color, roughness, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, ...extra });
  function fruit(kind, r) {
    const g = new THREE.Group();
    const add = (geo, mat, f) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; if (f) f(m); g.add(m); };
    if (kind === 'apple') {
      add(new THREE.SphereGeometry(r, 48, 32), phys('#d3202c', .3, { clearcoat: .6, clearcoatRoughness: .25 }), m => m.scale.set(1, .92, 1));
      add(new THREE.CylinderGeometry(r * .05, r * .07, r * .45, 8), phys('#5b3a1f', .8), m => { m.position.y = r * 1.02; m.rotation.z = .25; });
      add(new THREE.SphereGeometry(r * .3, 16, 8), phys('#3c9a37', .5), m => { m.scale.set(1, .18, .5); m.position.set(r * .22, r * 1.02, 0); m.rotation.z = -.5; });
    } else if (kind === 'orange') {
      add(new THREE.SphereGeometry(r, 48, 32), phys('#f5841f', .62, { clearcoat: .15 }));
      add(new THREE.CylinderGeometry(r * .1, r * .1, r * .06, 10), phys('#4f7f2a', .7), m => { m.position.y = r * .99; });
    } else {
      add(new THREE.SphereGeometry(r, 48, 32), phys('#7cbf31', .42, { clearcoat: .4 }), m => m.scale.set(1, 1, 1.18));
      add(new THREE.SphereGeometry(r * .14, 10, 8), phys('#5f9426', .5), m => { m.scale.set(1, 1, .8); m.position.z = r * 1.16; });
    }
    scene.add(g);
    const c = contactFor(r);
    return { kind, g, r, h: kind === 'apple' ? r * .92 : r, contact: c, hold: holdFor(c), inBowl: false, slot: -1, settle: null };
  }
  const items = [fruit('apple', Math.min(rB * 1.08, w0 * .44)), fruit('orange', rB), fruit('lime', rB * .86)];
  const maxR = Math.max(...items.map(i => i.r));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([
    [0, 0], [.05, 0], [.056, .004], [.088, .028], [.108, .058], [.112, .062], [.106, .062], [.084, .034], [.05, .013], [0, .013]
  ].map(([x, y]) => new THREE.Vector2(x, y)), 80), phys('#2a55c9', .22, { clearcoat: 1, clearcoatRoughness: .1 }));
  bowl.castShadow = bowl.receiveShadow = true; scene.add(bowl);
  const bowlFloor = .013, bowlIn = .082, bowlOut = .112, bowlRim = .062;
  const slots = [[.034, 0], [-.017, .03], [-.017, -.03]];
  const aim = new THREE.Mesh(new THREE.RingGeometry(.011, .014, 40), new THREE.MeshBasicMaterial({ color: tok('--signal'), transparent: true, opacity: .85 }));
  aim.rotation.x = -Math.PI / 2; scene.add(aim);

  const camera = new THREE.PerspectiveCamera(32, 1, .02, 10);
  camera.layers.enable(1);
  const eye = new THREE.PerspectiveCamera(112, 1, .004, 5);
  const fe = $('#fisheye');
  const view = { visible: false, fe: 160, t: 0 };
  let xLim = .38, zLim = .19, camBase = V3();
  function fit() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const aspect = width / height; camera.aspect = aspect;
    const v = THREE.MathUtils.degToRad(camera.fov / 2), h = Math.atan(Math.tan(v) * aspect);
    xLim = aspect < 1 ? .3 : .38;
    const d = Math.max((xLim + .2) / Math.tan(h), .44 / Math.tan(v)) * 1.12;
    const el = THREE.MathUtils.degToRad(aspect < 1 ? 44 : 32);
    camBase.set(0, -.02 + Math.sin(el) * d, Math.cos(el) * d);
    camera.position.copy(camBase); camera.lookAt(0, -.02, 0); camera.updateProjectionMatrix();
    const size = Math.round(Math.min(190, width * .27));
    fe.style.width = fe.style.height = size + 'px';
    view.fe = size;
  }

  const hoverY = 2 * maxR + .07;
  const st = { x: 0, z: 0, tx: 0, tz: 0, y: hoverY, ty: hoverY, closure: 0, squeeze: 0, held: null, target: null, mode: 'free', grip: false, keys: new Set() };
  const rec = { on: false, done: false, t0: 0, last: 0, samples: [], grasps: 0, path: 0, prev: null };
  function place() {
    const lim = xLim - .05;
    const side = Math.random() < .5 ? 1 : -1;
    bowl.position.set(side * Math.min(lim - .06, .2 + Math.random() * .06), 0, (Math.random() - .5) * .08);
    const spots = [];
    for (const it of items) {
      let x = 0, z = 0, n = 0;
      do { x = (Math.random() * 2 - 1) * lim; z = (Math.random() - .5) * .26; n++; }
      while (n < 300 && (Math.hypot(x - bowl.position.x, z - bowl.position.z) < .2 || spots.some(([a, b]) => Math.hypot(x - a, z - b) < .1)));
      spots.push([x, z]);
      it.g.position.set(x, it.h, z);
      it.g.rotation.y = Math.random() * Math.PI * 2;
      Object.assign(it, { inBowl: false, slot: -1, settle: null });
    }
  }
  new ResizeObserver(fit).observe(stage); fit(); place();
  watch(stage, view);

  // input
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(V3(0, 1, 0), -rB), hit = V3(), ndc = new THREE.Vector2();
  function aimAt(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) { st.tx = hit.x; st.tz = hit.z; start(); }
  }
  stage.addEventListener('pointermove', aimAt);
  stage.addEventListener('pointerdown', e => { aimAt(e); if (e.pointerType === 'mouse' && e.button === 0) { e.preventDefault(); grip(true); } });
  addEventListener('pointerup', e => { if (e.pointerType === 'mouse') grip(false); });
  const gb = $('#grip-btn');
  gb.addEventListener('pointerdown', e => { e.preventDefault(); gb.setPointerCapture(e.pointerId); grip(true); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => gb.addEventListener(t, () => grip(false)));
  gb.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); grip(true); } });
  gb.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') grip(false); });
  stage.addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); if (!e.repeat) grip(true); }
    if (e.key.startsWith('Arrow')) { e.preventDefault(); st.keys.add(e.key); start(); }
  });
  stage.addEventListener('keyup', e => { if (e.key === ' ') grip(false); st.keys.delete(e.key); });
  stage.addEventListener('blur', () => { st.keys.clear(); grip(false); });

  const reach = it => Math.hypot(st.x + it.hold.x - it.g.position.x, st.z + it.hold.z - it.g.position.z);
  const tol = it => (w0 - 2 * it.r) / 2 + .016;
  function nearest() {
    let best = null;
    for (const it of items) if (!it.settle && reach(it) < tol(it) && (!best || reach(it) < reach(best))) best = it;
    return best;
  }
  function grip(on) {
    if (st.grip === on) return;
    st.grip = on; gb.setAttribute('aria-pressed', String(on)); start();
    if (rec.done) return;
    if (on && st.mode === 'free' && !st.held) { st.mode = 'down'; st.target = nearest(); rec.grasps++; }
    if (!on) st.mode = st.held ? 'place' : 'free';
  }
  function start() {
    if (rec.on || rec.done) return;
    rec.on = true; rec.t0 = performance.now(); stage.classList.add('is-playing');
    $('#rec-status').textContent = 'Recording';
  }

  // live traces
  const sig = tok('--signal'), ink = tok('--ink'), line = tok('--line');
  function spark(cv, key, max, fillIt) {
    const dpr = Math.min(devicePixelRatio, 2), w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(0, h - .5); g.lineTo(w, h - .5); g.stroke();
    const S = rec.samples, n = Math.min(S.length, 300); if (n < 2) return;
    const from = S.length - n, step = w / 299;
    g.beginPath();
    for (let i = 0; i < n; i++) { const x = i * step, y = h - 3 - (S[from + i][key] / max) * (h - 8); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    if (fillIt) { g.strokeStyle = sig; g.lineWidth = 2; g.stroke(); g.lineTo((n - 1) * step, h); g.lineTo(0, h); g.closePath(); g.globalAlpha = .18; g.fillStyle = sig; g.fill(); g.globalAlpha = 1; }
    else { g.strokeStyle = ink; g.lineWidth = 1.6; g.stroke(); }
  }

  function finishEpisode() {
    rec.done = true; rec.on = false;
    const S = rec.samples, dur = S.length ? S[S.length - 1].t : 0;
    $('#rec-status').textContent = 'Episode saved. All three in the bowl.';
    $('#r-time').textContent = dur.toFixed(1) + ' s';
    $('#r-frames').textContent = S.length;
    $('#r-path').textContent = Math.round(rec.path * 100) + ' cm';
    $('#r-grasps').textContent = rec.grasps;
    $('#summary').hidden = false; $('#again').hidden = false; gb.hidden = true;
    buildReport(S, rec);
  }
  $('#again').addEventListener('click', () => {
    Object.assign(rec, { on: false, done: false, samples: [], grasps: 0, path: 0, prev: null });
    Object.assign(st, { held: null, target: null, mode: 'free', closure: 0, squeeze: 0, grip: false });
    place(); $('#summary').hidden = true; $('#again').hidden = true; gb.hidden = false; $('#report').hidden = true;
    stage.classList.remove('is-playing');
    $('#rec-status').textContent = 'Move over the table to start recording.';
    stage.focus({ preventScroll: true });
  });

  $('#game-msg').textContent = matchMedia('(pointer: coarse)').matches ? 'Drag to aim. Hold the grip button.' : 'Move to aim. Hold the mouse button or Space to grip.';
  fe.hidden = false;

  const tmp = V3(), camP = V3(), look = V3();
  view.tick = (now, dt) => {
    if (!view.visible) return;
    view.t += dt;
    for (const r of rotors) r.rotation.y += dt * 38;
    glows.forEach((g, i) => { g.material.opacity = .55 + Math.sin(view.t * 9 + i * 1.7) * .12; });
    const k = .35 * dt;
    if (st.keys.has('ArrowLeft')) st.tx -= k;
    if (st.keys.has('ArrowRight')) st.tx += k;
    if (st.keys.has('ArrowUp')) st.tz -= k;
    if (st.keys.has('ArrowDown')) st.tz += k;
    st.tx = clamp(st.tx, -xLim, xLim); st.tz = clamp(st.tz, -zLim, zLim);
    st.x += (st.tx - st.x) * Math.min(1, dt * 10); st.z += (st.tz - st.z) * Math.min(1, dt * 10);

    const held = st.held;
    const hx = st.x + (held ? held.hold.x : 0), hz = st.z + (held ? held.hold.z : 0);
    const dB = Math.hypot(hx - bowl.position.x, hz - bowl.position.z);
    // released over the bowl or its rim, the fruit rolls in; only a clear drop lands on the table
    const intoBowl = held && dB < bowlOut + held.r * .5;
    const overFloor = dB < bowlIn - .02;
    const t = st.target;
    let cmd = 0;
    if (st.mode === 'down') {
      st.ty = t ? t.g.position.y : rB;
      if (Math.abs(st.y - st.ty) < .004) st.mode = 'close';
    } else if (st.mode === 'close') {
      st.ty = t ? t.g.position.y : rB; cmd = 1;
      if (!held && t && !t.settle && st.closure >= t.contact - .02 && reach(t) < tol(t)) { st.held = t; t.inBowl = false; t.slot = -1; }
      if (st.held || st.closure > .97) st.mode = 'free';
    } else if (st.mode === 'place' && held) {
      cmd = 1;
      st.ty = (intoBowl ? (overFloor ? bowlFloor + .004 : bowlRim + .006) : 0) + held.h;
      if (Math.abs(st.y - st.ty) < .003) {
        st.held = null; st.mode = 'free';
        if (intoBowl) {
          const used = new Set(items.filter(i => i.inBowl).map(i => i.slot));
          const slot = [0, 1, 2].find(s => !used.has(s));
          const [ox, oz] = slots[slot];
          Object.assign(held, { inBowl: true, slot, settle: V3(bowl.position.x + ox, bowlFloor + held.h, bowl.position.z + oz) });
          if (items.every(i => i.inBowl)) setTimeout(finishEpisode, 500);
        } else {
          // land on the table, then slide clear of any fruit it was dropped onto
          const at = held.g.position; at.y = held.h;
          const goal = at.clone();
          for (let pass = 0; pass < 4; pass++) for (const o of items) {
            if (o === held || o.inBowl) continue;
            const dx = goal.x - o.g.position.x, dz = goal.z - o.g.position.z, d = Math.hypot(dx, dz), m = held.r + o.r + .004;
            if (d < m) { const a = d > 1e-4 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2; goal.x = o.g.position.x + Math.cos(a) * m; goal.z = o.g.position.z + Math.sin(a) * m; }
          }
          goal.x = clamp(goal.x, -xLim, xLim); goal.z = clamp(goal.z, -zLim - .04, zLim + .04);
          if (goal.distanceTo(at) > .001) held.settle = goal;
        }
      }
    } else {
      st.mode = 'free'; st.ty = hoverY; cmd = st.grip ? 1 : 0;
    }
    st.y += (st.ty - st.y) * Math.min(1, dt * (st.mode === 'free' ? 7 : 12));
    const cap = st.held ? st.held.contact : 1;
    st.closure += clamp(Math.min(cmd, cap) - st.closure, -dt * 4, dt * 4);
    st.squeeze += ((st.held && st.grip ? 1 : 0) - st.squeeze) * Math.min(1, dt * 8);
    setGrip(st.closure);
    rig.position.set(st.x, st.y, st.z);
    if (st.held) st.held.g.position.set(st.x + st.held.hold.x, st.y, st.z + st.held.hold.z);
    for (const it of items) if (it.settle) {
      it.g.position.lerp(it.settle, Math.min(1, dt * 9));
      if (it.g.position.distanceTo(it.settle) < .0008) { it.g.position.copy(it.settle); it.settle = null; }
    }
    aim.position.set(st.x, .0015, st.z);
    aim.visible = !st.held;

    // record at the camera rate
    if (rec.on && now - rec.last >= 1000 / RATES.video - 1) {
      rec.last = now;
      rig.updateMatrixWorld(true);
      const w = wp(thumbN).distanceTo(wp(fingerN)) * 1000;
      const f = st.squeeze * (8.5 + Math.sin(now / 90) * .35 + Math.random() * .25);
      const p = rec.prev; if (p) rec.path += Math.hypot(st.x - p[0], st.y - p[1], st.z - p[2]);
      rec.prev = [st.x, st.y, st.z];
      rec.samples.push({ t: (now - rec.t0) / 1000, x: st.x, y: st.y, z: st.z, w, f });
      $('#v-jaw').textContent = Math.round(w) + ' mm';
      $('#v-force').textContent = f.toFixed(1) + ' N';
      $('#rec-status').textContent = `Recording, ${((now - rec.t0) / 1000).toFixed(1)} s. ${items.filter(i => i.inBowl).length} of 3 in the bowl.`;
      spark($('#c-jaw'), 'w', w0 * 1000 * 1.05, false);
      spark($('#c-force'), 'f', 10, true);
    }

    camera.position.set(camBase.x, camBase.y + (reduceMotion ? 0 : Math.sin(view.t * .9) * .004), camBase.z);
    const { width, height } = renderer.domElement.getBoundingClientRect();
    renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height);
    renderer.render(scene, camera);
    // the wrist camera
    rig.updateMatrixWorld(true);
    wp(camN, camP);
    tmp.set(st.x - camP.x, 0, st.z - camP.z);
    if (tmp.lengthSq() < 1e-8) tmp.set(0, 0, -1);
    tmp.normalize();
    eye.position.copy(camP); eye.up.copy(tmp).negate();
    look.set(camP.x + tmp.x * .35, camP.y - 1, camP.z + tmp.z * .35);
    eye.lookAt(look);
    const fs = view.fe, fx = width - 10 - fs, fy = height - 10 - fs;
    renderer.setScissorTest(true); renderer.setViewport(fx, fy, fs, fs); renderer.setScissor(fx, fy, fs, fs);
    aim.visible = false; renderer.render(scene, eye); aim.visible = !st.held;
    renderer.setScissorTest(false);
  };
  return view;
}

// ---------- the episode report ----------
function bytes(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : n >= 1e3 ? Math.round(n / 1e3) + ' KB' : Math.round(n) + ' B'; }
function cell(tr, text, cls) { const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.append(td); }
function buildReport(S, rec) {
  const N = S.length, D = N ? S[N - 1].t : 0;
  // acceleration from the recorded trajectory (what the IMU would see, gravity added on the up axis)
  const acc = S.map((s, i) => {
    if (i === 0 || i === N - 1) return [0, 9.81, 0];
    const a = S[i - 1], b = S[i + 1], h1 = s.t - a.t || 1 / 30, h2 = b.t - s.t || 1 / 30;
    const d2 = k => 2 * ((b[k] - s[k]) / h2 - (s[k] - a[k]) / h1) / (h1 + h2);
    return [d2('x'), d2('y') + 9.81, d2('z')];
  });
  const jaws = S.map(s => s.w), speeds = S.map((s, i) => i ? Math.hypot(s.x - S[i - 1].x, s.y - S[i - 1].y, s.z - S[i - 1].z) / ((s.t - S[i - 1].t) || 1 / 30) : 0);
  const idle = speeds.filter(v => v < .01).length;
  const vidB = VIDEO.mbps * 1e6 / 8 * D;
  const depB = N * DEPTH.width * DEPTH.height * 2 * DEPTH.ratio;
  const streams = [
    ['Wrist fisheye video', `${RATES.video} fps`, N, `H.264, ${VIDEO.width} × ${VIDEO.height}`, vidB],
    ['Stereo depth', `${RATES.depth} fps`, N, `16-bit, lossless, ${DEPTH.width} × ${DEPTH.height}`, depB],
    ['IMU', `${RATES.imu} Hz`, Math.round(D * RATES.imu), '6 × float32', D * RATES.imu * 24],
    ['Jaw encoder', `${RATES.encoder} Hz`, Math.round(D * RATES.encoder), 'uint16', D * RATES.encoder * 2],
    ['Grip force', `${RATES.force} Hz`, Math.round(D * RATES.force), 'float32', D * RATES.force * 4],
    ['Gripper pose', `${RATES.pose} Hz`, N, '7 × float32', N * 28]
  ];
  const total = streams.reduce((a, s) => a + s[4], 0);
  const tb = $('#streams'); tb.textContent = '';
  for (const s of streams) { const tr = document.createElement('tr'); cell(tr, s[0]); cell(tr, s[1]); cell(tr, s[2].toLocaleString('en-US'), 'num'); cell(tr, s[3]); cell(tr, bytes(s[4]), 'num'); tb.append(tr); }

  const steps = [
    ['Capture', 'Six streams on one device clock.', `${D.toFixed(1)} s, 6 streams`],
    ['Sync', `Faster sensors aligned to the ${RATES.video} Hz camera clock.`, `${N} aligned frames`],
    ['Encode', 'Video to H.264, depth lossless, sensors to Parquet.', `${bytes(total)} in total`],
    ['Check', 'Tracking, jaw range and idle time.', `Jaw ${Math.round(Math.min(...jaws))}–${Math.round(Math.max(...jaws))} mm, ${idle} idle frames`],
    ['Package', 'LeRobot v3, ready for a training loop.', `1 episode, ${N} rows`]
  ];
  const ol = $('#steps'); ol.textContent = '';
  steps.forEach(([b, s, e], i) => {
    const li = document.createElement('li');
    const n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1).padStart(2, '0');
    const bb = document.createElement('b'); bb.textContent = b;
    const ss = document.createElement('span'); ss.textContent = s;
    const ee = document.createElement('em'); ee.textContent = e;
    li.append(n, bb, ss, ee); ol.append(li);
  });

  let k = S.reduce((best, s, i) => (s.f > S[best].f ? i : best), 0);
  if (!S[k] || S[k].f === 0) k = Math.floor(N / 2);
  k = Math.min(k, N - 2);
  const r4 = v => Math.round(v * 1e4) / 1e4;
  const state = s => [r4(s.x), r4(s.y), r4(s.z), 0, 0, 0, 1, r4(s.w / 1000)];
  const row = {
    index: k, episode_index: 0, frame_index: k, timestamp: r4(S[k].t),
    task: 'Put the fruit in the bowl',
    'observation.state': state(S[k]),
    action: state(S[k + 1]),
    'observation.force': [r4(S[k].f)],
    'observation.imu': [...acc[k].map(r4), 0, 0, 0],
    'observation.images.wrist': { path: 'videos/observation.images.wrist/chunk-000/file-000.mp4', timestamp: r4(S[k].t) }
  };
  $('#sample-row').textContent = JSON.stringify(row, null, 2).replace(/\[\n\s+([^\]]+?)\n\s+\]/g, (m, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ') + ']');
  const info = { codebase_version: 'v3.0', robot_type: 'vernia_grip_one', fps: RATES.video, total_episodes: 1, total_frames: N, features: { 'observation.state': { dtype: 'float32', shape: [8], names: ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw', 'jaw'] }, action: { dtype: 'float32', shape: [8] }, 'observation.images.wrist': { dtype: 'video', shape: [VIDEO.height, VIDEO.width, 3] }, 'observation.force': { dtype: 'float32', shape: [1] }, 'observation.imu': { dtype: 'float32', shape: [6] } } };
  $('#layout').textContent = [
    'vernia_fruit_bowl/',
    '  meta/info.json',
    '  meta/stats.json',
    '  meta/tasks.parquet',
    '  meta/episodes/chunk-000/file-000.parquet',
    `  data/chunk-000/file-000.parquet        ${N} rows`,
    '  videos/observation.images.wrist/chunk-000/file-000.mp4',
    '  videos/observation.images.depth/chunk-000/file-000.mkv',
    '',
    'meta/info.json',
    JSON.stringify(info, null, 2).replace(/\[\n\s+([^\]]+?)\n\s+\]/g, (m, inner) => '[' + inner.replace(/\s*\n\s*/g, ' ') + ']')
  ].join('\n');

  const body = $('#frames-body'); body.textContent = '';
  const frag = document.createDocumentFragment();
  S.slice(0, 1500).forEach((s, i) => {
    const tr = document.createElement('tr');
    [i, s.t.toFixed(3), (s.x * 1000).toFixed(1), (s.y * 1000).toFixed(1), (s.z * 1000).toFixed(1), s.w.toFixed(1), s.f.toFixed(2), acc[i][1].toFixed(2)]
      .forEach((v, j) => cell(tr, v, j ? 'num' : ''));
    frag.append(tr);
  });
  body.append(frag);
  void rec;
  $('#report').hidden = false;
}

// ---------- the pilot form ----------
function startForm() {
  const form = $('#lead-form'), status = $('#form-status'), submit = $('#lead-submit');
  const say = (t, err) => { status.textContent = t; status.classList.toggle('is-error', !!err); };
  document.querySelectorAll('[data-interest]').forEach(a => a.addEventListener('click', () => {
    const box = form.querySelector(`input[name="interest"][value="${a.dataset.interest}"]`);
    if (box) box.checked = true;
  }));
  const params = new URLSearchParams(location.search);
  const campaignValue = params.get('utm_campaign') || '';
  const campaign = /^[a-zA-Z0-9_-]{1,80}$/.test(campaignValue) ? campaignValue : '';
  const live = !PREVIEW && siteConfig.turnstileSiteKey && siteConfig.waitlistEndpoint;
  let token = '', widget, sending = false;
  if (live) {
    submit.disabled = true; say('Loading the security check.');
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true;
    s.onload = () => {
      widget = window.turnstile.render('#security-check', {
        sitekey: siteConfig.turnstileSiteKey, action: 'waitlist', theme: 'light', size: form.clientWidth < 300 ? 'compact' : 'flexible',
        callback(v) { token = v; submit.disabled = sending; say(''); },
        'expired-callback'() { token = ''; submit.disabled = true; say('Please complete the security check again.'); },
        'error-callback'() { token = ''; submit.disabled = true; say('The security check could not load. Email team@vernia.in instead.', true); }
      });
    };
    s.onerror = () => say('The security check could not load. Email team@vernia.in instead.', true);
    document.head.append(s);
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(form);
    const chosen = data.getAll('interest');
    if (!form.reportValidity()) return;
    if (!chosen.length) { say('Choose at least one thing you are interested in.', true); return; }
    if (!live) { say('This preview does not send anything. On vernia.in your details go straight to the team.'); return; }
    if (!token) { say('Please complete the security check.', true); return; }
    sending = true; submit.disabled = true; submit.textContent = 'Sending'; say('');
    try {
      const res = await fetch(siteConfig.waitlistEndpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ email: data.get('email'), name: data.get('name'), organisation: data.get('organisation'), interests: chosen, consent: data.get('consent') === 'yes', website: data.get('website'), source: 'home', campaign, turnstileToken: token, analyticsSession: window.verniaAnalyticsSession?.() || '' })
      });
      const result = await res.json();
      if (!res.ok || result.accepted !== true) throw new Error(result.error || 'We could not save your details. Please try again.');
      if (result.message) $('#lead-done-msg').textContent = result.message;
      form.hidden = true; const done = $('#lead-done'); done.hidden = false; done.focus();
    } catch (err) {
      say(err.name === 'TimeoutError' || err.name === 'AbortError' ? 'The request timed out. You can safely try again.' : err instanceof TypeError ? 'We could not reach our server. Check your connection and try again.' : err.message, true);
      token = ''; if (widget !== undefined && window.turnstile) window.turnstile.reset(widget);
    } finally { sending = false; submit.textContent = 'Send'; if (token) submit.disabled = false; }
  });
}

// ---------- boot ----------
async function loadModel() {
  if (PREVIEW && PREVIEW.modelBase64) {
    const text = await (await fetch(PREVIEW.modelBase64)).text();
    const bin = atob(text.replace(/\s+/g, '')), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new GLTFLoader().parseAsync(u8.buffer, '');
  }
  const gz = 'DecompressionStream' in window;
  const res = await fetch(`assets/models/grip-one/grip-one-web.glb${gz ? '.gz' : ''}`);
  if (!res.ok) throw new Error('Grip One model ' + res.status);
  const buf = gz ? await new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : await res.arrayBuffer();
  return new GLTFLoader().parseAsync(buf, '');
}

startForm();
const views = [];
const fail = () => { $('#game-msg').textContent = 'This demo needs WebGL, which this browser has turned off.'; };
try {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('WebGL unavailable');
  const gltf = await loadModel();
  try { views.push(productStage($('#stage-grip'), buildGripper(gltf), { yaw: 2.65, pitch: .28, roll: -.18, side: 'left' })); } catch (e) { console.error(e); }
  try { views.push(productStage($('#stage-view'), buildHeadset(), { yaw: -.6, pitch: .22, phase: 1.7, side: 'right' })); } catch (e) { console.error(e); }
  try { views.push(startGame(gltf)); } catch (e) { console.error(e); fail(); }
} catch (e) { console.error(e); fail(); }

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  for (const v of views) if (v.tick) v.tick.length > 1 ? v.tick(now, dt) : v.tick(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

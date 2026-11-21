// ЗЕРНО — scroll-driven coffee story.
// One master GSAP timeline (5 units = 5 chapters) is scrubbed by scroll;
// its smoothed time `p` drives both the text overlays and the 3D scene.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { M, beanGeometry, createGrinder, createKettle, createPourOver, createCup, createDrop, createBeanPile, createSteam } from './models.js?v=9'; // keep ?v= in step with index.html
import { initShop } from './shop.js?v=9';
import { initBrew } from './brew.js?v=9';
import { createSound } from './sound.js?v=9';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const ss = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const lerp = THREE.MathUtils.lerp;
const rand = (a, b) => a + Math.random() * (b - a);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = () => innerWidth <= 760;

/* ------------------------------------------------------------------ */
/* Loader                                                              */
/* ------------------------------------------------------------------ */
const loader = { v: 0 };
const loaderNum = $('#loaderNum');
const loadTo = (v) => gsap.to(loader, { v, duration: 0.5, ease: 'power1.out', onUpdate: () => { loaderNum.textContent = Math.round(loader.v); } });
loadTo(30);

/* ------------------------------------------------------------------ */
/* Renderer, scene, lights                                             */
/* ------------------------------------------------------------------ */
// The canvas is transparent so the hero title can sit behind the grinder.
// Real transmission would sample a blank buffer there and glow white, so the
// site uses classic alpha glass: reflections plus a faint tint.
Object.assign(M.glass, {
  transmission: 0, transparent: true, opacity: 0.11, depthWrite: false,
  roughness: 0.02, envMapIntensity: 1.6, specularIntensity: 1,
});
M.glass.color.set(0xf4f6f7);
M.glass.needsUpdate = true;

const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2ca, 0.35));
const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
key.position.set(4, 7, 5);
key.castShadow = true;
key.shadow.mapSize.setScalar(isMobile() ? 1024 : 2048); // phones: a quarter of the shadow work
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 7, bottom: -3, near: 0.5, far: 30 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 1.2);
rim.position.set(-5, 4, -4);
scene.add(rim);

// small round catcher: a big plane reaches the horizon, where the shadow map
// runs out and paints a visible band across the screen
const floor = new THREE.Mesh(new THREE.CircleGeometry(4.5, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.14 }));
floor.receiveShadow = true;
scene.add(floor);

/* ------------------------------------------------------------------ */
/* Sets                                                                */
/* ------------------------------------------------------------------ */
// 0–1: grinder fills with beans · 1–2: grinder comes apart
const grinder = createGrinder();
grinder.userData.setFill(0);
scene.add(grinder);

// beans pouring into the hopper
const FALL_N = 70;
const falling = new THREE.InstancedMesh(beanGeometry(12, 9), M.bean, FALL_N);
const fallState = Array.from({ length: FALL_N }, () => ({
  a: rand(0, Math.PI * 2), r: Math.sqrt(Math.random()), ph: Math.random(),
  rx: rand(0, 6), ry: rand(0, 6), spin: rand(2, 6), s: rand(0.9, 1.15),
}));
{
  const c = new THREE.Color();
  for (let i = 0; i < FALL_N; i++) falling.setColorAt(i, c.setHex([0x3a1f10, 0x31190c, 0x4a2a17][i % 3]));
}
falling.castShadow = true;
falling.frustumCulled = false;
grinder.add(falling);

// 2–3: kettle pours into the V60
const pourSet = new THREE.Group();
const pourover = createPourOver();
const kettle = createKettle();
kettle.userData.station.visible = false;
kettle.position.set(-2.39, 1.9, 0);
const water = new THREE.Mesh(
  new THREE.CylinderGeometry(0.016, 0.02, 1, 12, 1, true),
  new THREE.MeshPhysicalMaterial({ color: 0xe6f1f6, roughness: 0.05, transparent: true, opacity: 0.55 }),
);
pourSet.add(pourover, kettle, water);
scene.add(pourSet);

// 3–4: a drop falls into coffee
const dropSet = createDrop();
scene.add(dropSet);

// 4–5: the cup
const cup = createCup();
const steam = createSteam();
steam.position.y = 0.78;
cup.add(steam);
scene.add(cup);

/* ------------------------------------------------------------------ */
/* Pointer: parallax, steam wind, grinder hover                        */
/* ------------------------------------------------------------------ */
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion;
const pointer = { x: 0, y: 0, sx: 0, sy: 0, ndc: new THREE.Vector2(), inside: false };
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || reduceMotion) return;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
  pointer.ndc.set(pointer.x, -pointer.y);
  pointer.inside = true;
}, { passive: true });
document.documentElement.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; pointer.inside = false; });

const raycaster = new THREE.Raycaster();
const grinderBox = new THREE.Box3(new THREE.Vector3(-1.8, 0, -0.8), new THREE.Vector3(1.8, 5.5, 0.8));
const localRay = new THREE.Ray();
const invMat = new THREE.Matrix4();
function pointerOverGrinder() {
  if (!pointer.inside || !grinder.visible) return false;
  raycaster.setFromCamera(pointer.ndc, camera);
  invMat.copy(grinder.matrixWorld).invert();
  localRay.copy(raycaster.ray).applyMatrix4(invMat);
  return localRay.intersectsBox(grinderBox);
}

loadTo(70);

/* ------------------------------------------------------------------ */
/* Camera path                                                         */
/* ------------------------------------------------------------------ */
// sx/sy shift the picture (fraction of the viewport) to leave room for text
const KEYS = [
  { p: 0.0, pos: [0, 2.7, 11.6], tgt: [0, 2.25, 0], sx: 0, sy: 0 },
  { p: 0.9, pos: [0, 3.1, 9.8], tgt: [0, 2.6, 0], sx: 0, sy: 0 },
  { p: 1.25, pos: [2.6, 3.6, 11.8], tgt: [0, 2.8, 0], sx: 0.2, sy: 0 },
  { p: 1.8, pos: [3.2, 3.4, 11.4], tgt: [0, 2.8, 0], sx: 0.2, sy: 0 },
  { p: 2.15, pos: [0.2, 2.6, 11.2], tgt: [-1.15, 1.9, 0], sx: 0.25, sy: -0.02 },
  { p: 2.8, pos: [-0.4, 2.4, 10.4], tgt: [-1.15, 1.9, 0], sx: 0.25, sy: -0.02 },
  { p: 3.15, pos: [0, 1.71, 4.21], tgt: [0, 0.45, 0], sx: 0, sy: 0 },
  { p: 3.8, pos: [0, 1.5, 3.9], tgt: [0, 0.4, 0], sx: 0, sy: 0 },
  { p: 4.15, pos: [0, 4.9, 4.3], tgt: [0, 0.35, 0], sx: 0, sy: 0.06 },
  { p: 5.0, pos: [0, 4.4, 3.8], tgt: [0, 0.35, 0], sx: 0, sy: 0.06 },
];
const _pos = new THREE.Vector3(), _tgt = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

// Portrait screens. [p, value] pairs, eased between neighbours.
// Width each scene needs, relative to the screen height:
const PORTRAIT_WIDTH = [[0, 0.72], [1.0, 0.72], [1.3, 1.12], [1.85, 1.12], [2.15, 1.05], [2.85, 1.05], [3.1, 0.5], [3.9, 0.5], [4.15, 0.95], [5, 0.95]];
// Vertical shift of the picture (negative = lower, under the heading):
const PORTRAIT_SHIFT = [[0, -0.06], [1.0, -0.06], [1.3, -0.15], [1.85, -0.15], [2.15, -0.15], [2.85, -0.15], [3.1, -0.02], [3.9, -0.02], [4.15, 0.08], [5, 0.08]];
function portraitCurve(keys, p) {
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
  const [p0, v0] = keys[i], [p1, v1] = keys[i + 1];
  return lerp(v0, v1, ss(p0, p1, p));
}

function placeCamera(p) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const t = ss(A.p, B.p, p);
  _pos.copy(_a.fromArray(A.pos)).lerp(_b.fromArray(B.pos), t);
  _tgt.copy(_a.fromArray(A.tgt)).lerp(_b.fromArray(B.tgt), t);
  let sx = lerp(A.sx, B.sx, t);
  let sy = lerp(A.sy, B.sy, t);

  const aspect = innerWidth / innerHeight;
  if (aspect < 1) {
    // Portrait: each scene needs a different width on screen, so back the
    // camera off just enough for that scene, centre it, and drop it under the text.
    const need = portraitCurve(PORTRAIT_WIDTH, p);
    const zoom = THREE.MathUtils.clamp(need / aspect, 1, 2.7);
    _tgt.x += 0.25 * ss(1.95, 2.2, p) * (1 - ss(2.85, 3.1, p)); // kettle + dripper as one group
    _pos.x = lerp(_pos.x, _tgt.x, 0.6);
    _pos.sub(_tgt).multiplyScalar(zoom).add(_tgt);
    sx = 0;
    sy = portraitCurve(PORTRAIT_SHIFT, p);
  }
  // gentle parallax: the camera drifts a little after the mouse
  const d = _pos.distanceTo(_tgt);
  _pos.x += pointer.sx * d * 0.035;
  _pos.y -= pointer.sy * d * 0.025;
  camera.position.copy(_pos);
  camera.lookAt(_tgt);
  const w = innerWidth, h = innerHeight;
  camera.setViewOffset(w, h, -sx * w, sy * h, w, h);
}

/* ------------------------------------------------------------------ */
/* Background colour per chapter                                      */
/* ------------------------------------------------------------------ */
const BG_KEYS = [
  [0, '#e9e8e6'], [1.85, '#e9e8e6'], [2.15, '#eadfce'], [2.85, '#eadfce'],
  [3.1, '#1a0f09'], [3.85, '#1a0f09'], [4.15, '#d9c3a5'], [5, '#d9c3a5'],
].map(([p, c]) => [p, new THREE.Color(c)]);
const bg = new THREE.Color();
function bgAt(p) {
  let i = 0;
  while (i < BG_KEYS.length - 2 && p > BG_KEYS[i + 1][0]) i++;
  const [p0, c0] = BG_KEYS[i], [p1, c1] = BG_KEYS[i + 1];
  return bg.copy(c0).lerp(c1, ss(p0, p1, p));
}
const warm = new THREE.Color(0xffe2bf), neutral = new THREE.Color(0xfff4e8);

/* Light follows the visitor's clock: evenings get a low, amber key light with
   long shadows and deeper backgrounds. ?time=evening|morning|day overrides it. */
const forced = new URLSearchParams(location.search).get('time');
const hour = forced === 'evening' ? 20 : forced === 'morning' ? 7 : forced === 'day' ? 13 : new Date().getHours();
const dusk = hour >= 18 || hour < 5 ? 1 : hour < 9 ? 0.5 : 0; // 1 evening, 0.5 morning, 0 day
const duskColor = new THREE.Color(0xffb36b);
document.body.classList.toggle('dusk', dusk === 1);
{
  const note = $('#lightNote');
  if (note) note.textContent = dusk === 1 ? 'свет на сайте сейчас вечерний' : dusk ? 'свет на сайте сейчас утренний' : 'свет на сайте сейчас дневной';
}
key.position.set(lerp(4, 6.5, dusk), lerp(7, 3.4, dusk), lerp(5, 3.5, dusk));
key.intensity = lerp(2.4, 2.1, dusk);
renderer.toneMappingExposure = lerp(1.05, 0.97, dusk);

// coffee flooding the screen between the pour and the drop
const flood = $('#flood');

// film grain: a small noise tile, jittered by CSS
{
  const c = document.createElement('canvas');
  c.width = c.height = 140;
  const g = c.getContext('2d');
  const img = g.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  $('#grain').style.backgroundImage = `url(${c.toDataURL()})`;
}

/* ------------------------------------------------------------------ */
/* Per-frame scene state                                               */
/* ------------------------------------------------------------------ */
const sun = $('#sun');
const dots = $$('#dots button');
const statTemp = $('#statTemp'), statDose = $('#statDose'), statTime = $('#statTime');
const tipLocal = kettle.userData.spoutTip;
const tip = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const intro = { v: reduceMotion ? 1 : 0 };
let clock = 0;
let lastStats = '';
let lastChapter = -1;
let lastDark = null;

let hoverSpin = 0;

// Sets leave by flying up or sinking down. They are hidden only once they are
// fully off screen, so nothing pops out mid-frame — on a phone the camera sits
// far back and sees a lot more height than on a desktop.
const _sp = new THREE.Vector3();
function onScreen(obj, yBottom, yTop) {
  _sp.set(obj.position.x, obj.position.y + yBottom, obj.position.z).project(camera);
  const bottom = _sp.y;
  _sp.set(obj.position.x, obj.position.y + yTop, obj.position.z).project(camera);
  return !(bottom > 1.02 || _sp.y < -1.02);
}
const cardsEl = $('#cards');
let cardsLive = false;

function update(p, dt) {
  clock += dt;
  const follow = 1 - Math.exp(-dt * 4);
  pointer.sx += (pointer.x - pointer.sx) * follow;
  pointer.sy += (pointer.y - pointer.sy) * follow;

  /* grinder: hovering it spins the turntable / the burrs */
  const over = finePointer && pointerOverGrinder();
  const ud = grinder.userData;
  ud.boost += ((over ? 1 : 0) - ud.boost) * (1 - Math.exp(-dt * 5));
  hoverSpin += dt * 1.6 * ud.boost * (1 - ss(1.1, 1.3, p));
  const fill = ss(0.04, 0.72, p);
  grinder.userData.setFill(fill);
  grinder.userData.setExplode(ss(1.15, 1.75, p));
  // the exploded grinder lifts away with a slow start, so the eye can follow it out
  grinder.position.y = 20 * Math.pow(ss(1.82, 2.4, p), 1.6) - 0.5 * (1 - intro.v);
  grinder.rotation.y = lerp(-0.3, 0.35, ss(0, 1.9, p)) - 0.6 * (1 - intro.v) + hoverSpin;
  grinder.visible = p < 2.5 && onScreen(grinder, 0, 5.6);
  if (grinder.visible) grinder.userData.update(dt);

  // falling beans while the hopper fills
  const pouring = fill > 0.005 && fill < 0.97;
  falling.visible = pouring;
  if (pouring) {
    const top = 8.5;
    const surface = grinder.userData.surfaceY(fill);
    const rad = grinder.userData.hopperRadius(fill) * 0.55;
    fallState.forEach((s, i) => {
      const u = (clock * 0.55 + s.ph) % 1;
      const y = top - u * (top - surface);
      m4.makeRotationFromEuler(new THREE.Euler(s.rx + clock * s.spin, s.ry + clock * s.spin * 0.7, 0));
      m4.scale(_a.setScalar(s.s));
      m4.setPosition(Math.cos(s.a) * s.r * rad, y, Math.sin(s.a) * s.r * rad);
      falling.setMatrixAt(i, m4);
    });
    falling.instanceMatrix.needsUpdate = true;
  }

  /* pour-over + kettle */
  pourSet.position.y = -14 * (1 - ss(1.88, 2.22, p)) + 18 * Math.pow(ss(2.84, 3.3, p), 1.6);
  pourSet.visible = p > 1.85 && p < 3.4 && onScreen(pourSet, 0, 4.3);
  const tilt = -0.42 * ss(2.22, 2.42, p) * (1 - ss(2.68, 2.84, p));
  kettle.rotation.z = tilt;
  kettle.position.x = -2.39 - 0.7 * (1 - ss(2.08, 2.3, p));
  water.visible = false;
  if (pourSet.visible) {
    pourover.userData.update(dt);
    if (tilt < -0.33) {
      pourSet.updateMatrixWorld(true);
      tip.copy(tipLocal);
      kettle.userData.body.localToWorld(tip);
      pourSet.worldToLocal(tip);
      const bottom = 2.18; // top of the coffee bed inside the filter
      const len = tip.y - bottom;
      if (len > 0.05) {
        water.visible = true;
        water.position.set(tip.x + 0.02, bottom + len / 2, tip.z);
        water.scale.set(1 + Math.sin(clock * 30) * 0.1, len, 1);
      }
    }
  }
  // brew numbers count up with the pour
  const k = ss(2.25, 2.78, p);
  const secs = Math.round(210 * k);
  const stats = `${Math.round(20 + 72 * k)}°C|${Math.round(18 * k)} г|${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  if (stats !== lastStats) {
    lastStats = stats;
    const [a, b, c] = stats.split('|');
    statTemp.textContent = a; statDose.textContent = b; statTime.textContent = c;
  }

  /* drop */
  dropSet.position.y = -10 * (1 - ss(2.92, 3.16, p)) - 14 * Math.pow(ss(3.84, 4.3, p), 1.6);
  dropSet.visible = p > 2.9 && p < 4.4 && onScreen(dropSet, -0.3, 2.7);
  if (dropSet.visible) dropSet.userData.update(reduceMotion ? 0 : dt);

  /* cup */
  cup.position.y = -8 * (1 - ss(3.92, 4.2, p));
  cup.rotation.y = lerp(-0.9, -0.2, ss(3.95, 5, p));
  cup.visible = p > 3.9;
  if (cup.visible) {
    const su = steam.userData.uniforms;
    su.uOpacity.value = 1.1 * ss(4.05, 4.35, p);
    su.uWind.value = pointer.sx * 0.9; // the steam drifts towards the mouse
    steam.userData.update(reduceMotion ? 0 : dt);
  }

  floor.visible = !(p > 2.95 && p < 4.05);

  /* colour + light */
  const col = bgAt(p);
  if (dusk) col.offsetHSL(0, 0.03 * dusk, -0.05 * dusk); // a touch deeper in the evening
  document.body.style.backgroundColor = '#' + col.getHexString();
  const warmth = ss(2.0, 2.2, p) * (1 - ss(2.85, 3.0, p)) + ss(4.0, 4.2, p);
  key.color.copy(neutral).lerp(warm, warmth).lerp(duskColor, dusk * 0.55);
  sun.style.opacity = (Math.max(warmth, dusk * 0.35) * 0.9).toFixed(3);

  // the flood: rises 2.80–3.02, then thins out as the drop scene shows
  const rise = ss(2.8, 3.02, p);
  if (rise > 0 && p < 3.2) {
    flood.style.visibility = 'visible';
    flood.style.transform = `translate3d(0, ${(1 - rise) * 115}%, 0)`;
    flood.style.opacity = String(1 - ss(3.03, 3.16, p));
  } else {
    flood.style.visibility = 'hidden';
  }

  // sound follows the scene
  sound.update({
    rattle: pouring && p < 0.8 ? 1 : 0,
    grind: ss(1.2, 1.4, p) * (1 - ss(1.75, 1.9, p)) * (0.45 + 0.55 * ud.boost),
    pour: water.visible ? 1 : 0,
  }, dt);

  const live = p > 4.25;
  if (live !== cardsLive) { cardsLive = live; cardsEl.classList.toggle('live', live); }

  const dark = p > 2.98 && p < 3.95;
  if (dark !== lastDark) { lastDark = dark; document.body.classList.toggle('dark-ui', dark); }

  const chapter = Math.min(4, Math.max(0, Math.floor(p + 0.12)));
  if (chapter !== lastChapter) {
    lastChapter = chapter;
    dots.forEach((d, i) => d.classList.toggle('on', i === chapter));
  }

  placeCamera(p);
}

/* ------------------------------------------------------------------ */
/* Text overlays on a scrubbed master timeline                         */
/* ------------------------------------------------------------------ */
function chapterIn(tl, sel, at) {
  tl.to(`${sel} .label i`, { scaleX: 1, duration: 0.15, ease: 'power2.out' }, at)
    .to(`${sel} .label span`, { opacity: 1, x: 0, duration: 0.12, stagger: 0.03 }, at + 0.04)
    .to(`${sel} .title .ln > span`, { yPercent: 0, duration: 0.22, stagger: 0.05, ease: 'power3.out' }, at + 0.05);
}

gsap.set('.ch1 .label i, .ch2 .label i, .ch3 .label i, .ch4 .label i', { scaleX: 0 });
gsap.set('.ch1 .label span, .ch2 .label span, .ch3 .label span, .ch4 .label span', { opacity: 0, x: -10 });
gsap.set('.ch1 .title .ln > span, .ch2 .title .ln > span, .ch3 .title .ln > span, .ch4 .title .ln > span', { yPercent: 150 });
gsap.set('.ch1 .body, .ch2 .stats, .ch2 .title em, .ch3 .drop-script', { opacity: 0, y: 24 });
// autoAlpha (visibility: hidden) — a card with backdrop-filter at opacity 0 still paints a blur strip
gsap.set('.cards .card', { yPercent: 140, autoAlpha: 0 });

/* smooth, inertial scroll for wheel, trackpad and touch */
// How far the smoothed scroll may run ahead of what is on screen, in viewport
// heights. This is the speed limit: a long trackpad fling or a hard swipe
// keeps feeding deltas, but the page never races more than this far ahead,
// so one gesture can't fly through the whole story.
const MAX_AHEAD = 0.55;
let lenis = null;
if (!reduceMotion && window.Lenis) {
  lenis = new window.Lenis({
    lerp: 0.075,               // softer easing than the default 0.1
    wheelMultiplier: 0.75,
    syncTouch: true,           // smooth on phones too, not just with a mouse
    syncTouchLerp: 0.06,
    touchMultiplier: 1,
    touchInertiaMultiplier: 22, // a flick coasts, but not across half the site
    virtualScroll(e) {
      if (e.event.type === 'touchend') {
        // Lenis turns finger speed into the coast distance (velocity × inertia),
        // ignoring deltaY, so cap the speed itself: a flick coasts ≤ ~1.2 screens
        const vMax = (innerHeight * 1.2) / lenis.options.touchInertiaMultiplier;
        lenis.velocity = Math.max(-vMax, Math.min(vMax, lenis.velocity));
        return true;
      }
      const cap = innerHeight * MAX_AHEAD;
      const ahead = lenis.targetScroll - lenis.animatedScroll;
      const room = e.deltaY > 0 ? cap - ahead : -cap - ahead;
      e.deltaY = e.deltaY > 0 ? Math.max(0, Math.min(e.deltaY, room)) : Math.min(0, Math.max(e.deltaY, room));
      return true;
    },
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

const master = gsap.timeline({
  defaults: { ease: 'none' },
  // Lenis already smooths the input; a little scrub on top keeps the 3D soft
  scrollTrigger: { trigger: '#story', start: 'top top', end: 'bottom bottom', scrub: reduceMotion ? true : lenis ? 0.7 : 0.9 },
});

// 0 · hero out
master
  .to('.hero-title .w-l', { xPercent: -30, autoAlpha: 0, duration: 0.3 }, 0.55)
  .to('.hero-title .w-r', { xPercent: 30, autoAlpha: 0, duration: 0.3 }, 0.55)
  .to('.ch0 .hero-copy, .ch0 .hero-script, .ch0 .scroll-cue', { y: -40, autoAlpha: 0, duration: 0.25, stagger: 0.03 }, 0.5);

// 1 · grind
chapterIn(master, '.ch1', 1.1);
master.to('.ch1 .body', { opacity: 1, y: 0, duration: 0.15 }, 1.3)
  .to('.ch1', { autoAlpha: 0, y: -40, duration: 0.15 }, 1.78);

// 2 · bloom
chapterIn(master, '.ch2', 2.2);
master.to('.ch2 .title em', { opacity: 1, y: 0, duration: 0.12 }, 2.36)
  .to('.ch2 .stats', { opacity: 1, y: 0, duration: 0.12 }, 2.3)
  .to('.ch2', { autoAlpha: 0, y: -40, duration: 0.15 }, 2.8);

// 3 · drop — title rests on the surface, then sinks
chapterIn(master, '.ch3', 3.22);
master.to('.ch3 .drop-script', { opacity: 1, y: 0, duration: 0.12 }, 3.4)
  .to('.ch3', { autoAlpha: 0, y: 80, duration: 0.15 }, 3.78);

// 4 · ritual + menu cards
chapterIn(master, '.ch4', 4.12);
master.to('.cards .card', { yPercent: 0, autoAlpha: 1, duration: 0.22, stagger: 0.05, ease: 'power3.out' }, 4.3)
  .set({}, {}, 5); // pad to exactly 5 units

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
const story = $('#story');
function scrollToChapter(c) {
  const range = story.offsetHeight - innerHeight;
  const p = c === 0 ? 0 : c === 4 ? 4.75 : c + 0.55;
  scrollToY(story.offsetTop + (p / 5) * range);
}
function scrollToY(top) {
  if (lenis) lenis.scrollTo(top, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
}
// phone menu
const burger = $('#burger'), mnav = $('#mnav');
function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  mnav.hidden = !open;
}
burger.addEventListener('click', () => setMenu(mnav.hidden));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

document.addEventListener('click', (e) => {
  if (!mnav.hidden && !e.target.closest('#mnav, #burger')) setMenu(false);
  if (e.target.closest('#mnav a')) setMenu(false);
  const a = e.target.closest('[data-chapter]');
  if (a) { e.preventDefault(); scrollToChapter(+a.dataset.chapter); return; }
  const v = e.target.closest('a[href="#visit"]');
  if (v) { e.preventDefault(); scrollToY($('#visit').offsetTop); }
});

// cart drawer and product cards (js/shop.js); the 3D scene pauses under them
let overlayOpen = false;
initShop({ lenis, onOverlay: (open) => { overlayOpen = open; } });
initBrew();

// optional sound
const sound = createSound();
// header button on desktop, a row in the burger menu on phones
const soundBtn = $('#sound'), soundRow = $('#soundM');
for (const btn of [soundBtn, soundRow]) {
  btn.addEventListener('click', async () => {
    const on = await sound.toggle();
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Выключить звук' : 'Включить звук');
    soundRow.setAttribute('aria-pressed', String(on));
    soundRow.querySelector('span').textContent = on ? 'вкл' : 'выкл';
  });
}
dropSet.userData.onImpact = () => { if (dropSet.visible) sound.plip(); };

/* ------------------------------------------------------------------ */
/* Cursor and magnetic buttons (mouse only)                            */
/* ------------------------------------------------------------------ */
if (finePointer) {
  document.documentElement.classList.add('has-cursor');
  const cur = $('#cursor');
  const dot = cur.querySelector('.cursor-dot');
  const ring = cur.querySelector('.cursor-ring');
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' });
  gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
  cur.classList.add('is-hidden');

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    cur.classList.remove('is-hidden');
    dotX(e.clientX); dotY(e.clientY);
    ringX(e.clientX); ringY(e.clientY);
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    cur.classList.toggle('is-link', !!e.target.closest('a, button, .card'));
  });
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.documentElement.addEventListener('pointerleave', () => cur.classList.add('is-hidden'));

  // buttons lean towards the cursor and spring back when it leaves
  for (const el of $$('.cta, .btn, .pill a, .card .row button')) {
    const strength = el.matches('.card .row button') ? 0.45 : 0.3;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * strength,
        y: (e.clientY - (r.top + r.height / 2)) * strength,
        duration: 0.4, ease: 'power3.out',
      });
    });
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.35)' });
    });
  }
}

/* ------------------------------------------------------------------ */
/* Visit section                                                       */
/* ------------------------------------------------------------------ */
for (const sec of ['.brew', '.visit']) {
  gsap.from(`${sec} .reveal`, {
    y: 36, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out',
    scrollTrigger: { trigger: sec, start: 'top 70%' },
  });
}
gsap.from('#pin', {
  y: -80, opacity: 0, duration: 1.1, ease: 'bounce.out', delay: 0.4,
  scrollTrigger: { trigger: '.map', start: 'top 75%' },
});

let running = true;
ScrollTrigger.create({
  trigger: '#story', start: 'top bottom', end: 'bottom top',
  onToggle: (self) => { running = self.isActive; },
});
ScrollTrigger.create({
  trigger: '.brew', start: 'top 60%', endTrigger: 'body', end: 'bottom bottom',
  onToggle: (self) => $('#dots').classList.toggle('hide', self.isActive),
});

/* ------------------------------------------------------------------ */
/* Loop                                                                */
/* ------------------------------------------------------------------ */
addEventListener('resize', () => {
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const timer = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(timer.getDelta(), 0.05);
  if (!running || overlayOpen) return;
  update(master.time(), dt);
  renderer.render(scene, camera);
});

window.__site = { master, scene, camera, update, pointer, steam, grinder, lenis, sound };

/* ------------------------------------------------------------------ */
/* Start: fonts, first frame, intro                                    */
/* ------------------------------------------------------------------ */
await document.fonts.ready;
update(master.time(), 0);
renderer.compile(scene, camera);
renderer.render(scene, camera);
await loadTo(100);
$('#loader').classList.add('done');

if (!reduceMotion) {
  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .to(intro, { v: 1, duration: 1.6, ease: 'power3.out' }, 0)
    .from('.hero-title .w > span', { yPercent: 110, duration: 1.1, stagger: 0.1 }, 0.15)
    .from('.hero-script span', { opacity: 0, scale: 0.6, rotate: -20, duration: 0.8, ease: 'back.out(2)' }, 0.7)
    .from('.lead span', { yPercent: 100, duration: 0.9 }, 0.55)
    .from('.ch0 .btn', { y: 20, opacity: 0, duration: 0.8 }, 0.65)
    .from('.nav > *', { y: -16, opacity: 0, duration: 0.8, stagger: 0.06 }, 0.4)
    .from('.scroll-cue', { opacity: 0, duration: 0.8 }, 0.9);
}

/* ------------------------------------------------------------------ */
/* Menu card renders, made from the same 3D models                     */
/* ------------------------------------------------------------------ */
// one card per idle slot, so the page never freezes while they render
const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 600 }) : setTimeout(r, 60)));

async function renderThumbs() {
  const size = 320;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(size, size, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  const s = new THREE.Scene();
  s.background = new THREE.Color(0xefe7dc);
  const pm = new THREE.PMREMGenerator(r);
  s.environment = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
  const l = new THREE.DirectionalLight(0xfff1dd, 2.4);
  l.position.set(3, 6, 4);
  l.castShadow = true;
  l.shadow.mapSize.set(1024, 1024);
  Object.assign(l.shadow.camera, { left: -4, right: 4, top: 6, bottom: -3 });
  s.add(l, new THREE.HemisphereLight(0xffffff, 0xd8d2ca, 0.4));
  const f = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.18 }));
  f.receiveShadow = true;
  s.add(f);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  const makers = {
    espresso: () => createCup(),
    latte: () => createCup({ latte: true }),
    pourover: () => createPourOver(),
    beans: () => { const g = createBeanPile(140); g.children[1].visible = false; return g; },
    kettle: () => { const g = createKettle(); g.rotation.y = 0.5; return g; },
    grinder: () => { const g = createGrinder(); g.userData.setFill(1); return g; },
  };
  const elev = { espresso: 0.75, latte: 0.75, beans: 0.85 };

  for (const card of $$('.card')) {
    await idle();
    const name = card.dataset.thumb;
    const obj = makers[name]();
    s.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const rad = sz.length() * 0.5;
    const dist = rad / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 0.95;
    const e = elev[name] ?? 0.32;
    cam.position.set(c.x + dist * 0.45, c.y + dist * e, c.z + dist);
    cam.lookAt(c);
    r.render(s, cam);
    card.querySelector('.ph').style.backgroundImage = `url(${r.domElement.toDataURL('image/png')})`;
    s.remove(obj);
  }
  r.dispose();
  r.forceContextLoss();
}
setTimeout(renderThumbs, 1200);

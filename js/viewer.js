import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGrinder, createKettle, createPourOver, createCup, createBeanPile, createDrop } from './models.js';

/* ---------- renderer & scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9e8e6); // keep in sync with BG below
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.8;
controls.maxPolarAngle = Math.PI * 0.52;
controls.addEventListener('start', () => { controls.autoRotate = false; });

/* ---------- studio lights ---------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2ca, 0.35));
const key = new THREE.DirectionalLight(0xfff4e8, 2.4);
key.position.set(4, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
Object.assign(key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -3, near: 0.5, far: 30 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.shadow.radius = 6;
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 1.2);
rim.position.set(-5, 4, -4);
scene.add(rim);

// studio floor that fades into the backdrop through fog
const BG = 0xe9e8e6;
scene.fog = new THREE.Fog(BG, 10, 30);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xdedcd8, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// soft contact shadow under the model (fills in what the shadow map misses)
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.4)');
  g.addColorStop(0.4, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const blob = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, fog: false }),
);
blob.position.y = 0.003;
blob.renderOrder = -1;
scene.add(blob);

/* ---------- models ---------- */
const factories = {
  grinder: createGrinder, kettle: createKettle, pourover: createPourOver,
  cup: createCup, beans: createBeanPile, drop: createDrop,
};
const cache = {};
let current = null;

/** Where the camera should look and from how far to fit `obj`. */
function measure(obj) {
  const v = obj.userData.view;
  if (v) {
    return { center: new THREE.Vector3(...v.center), dist: v.dist, foot: 0, dir: new THREE.Vector3(...v.dir).normalize() };
  }
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const fit = Math.max(size.y, size.x / camera.aspect, size.z) * 0.5;
  const dist = (fit / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.75;
  center.y -= size.y * 0.1; // lift the model above the bottom panel
  return { center, dist, foot: obj.userData.footprint ?? Math.min(size.x, size.z) };
}

const DEFAULT_DIR = new THREE.Vector3(0.45, 0.28, 1).normalize();
function applyFrame({ center, dist, foot, dir: preferred }, keepDirection = false) {
  const dir = keepDirection
    ? camera.position.clone().sub(controls.target).normalize()
    : (preferred ?? DEFAULT_DIR).clone();
  blob.visible = foot > 0;
  controls.target.copy(center);
  camera.position.copy(center).add(dir.multiplyScalar(dist));
  camera.near = dist / 50;
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  scene.fog.near = dist * 1.6;
  scene.fog.far = dist * 4;
  blob.scale.setScalar(foot * 1.25);
}

let grinderFrames = null;
function frameGrinder(explode, keep) {
  const a = grinderFrames[0], b = grinderFrames[1];
  const e = THREE.MathUtils.smootherstep(explode, 0, 1);
  applyFrame({
    center: a.center.clone().lerp(b.center, e),
    dist: THREE.MathUtils.lerp(a.dist, b.dist, e),
    foot: a.foot,
  }, keep);
}

const grinderControls = document.getElementById('grinderControls');
const fillInput = document.getElementById('fill');
const explodeInput = document.getElementById('explode');

function show(name) {
  if (current) scene.remove(current);
  current = cache[name] ||= factories[name]();
  scene.add(current);
  if (name === 'grinder') {
    if (!grinderFrames) {
      current.userData.setExplode(0);
      const a = measure(current);
      current.userData.setExplode(1);
      grinderFrames = [a, measure(current)];
    }
    current.userData.setExplode(+explodeInput.value);
    current.userData.setFill(+fillInput.value);
    frameGrinder(+explodeInput.value, false);
  } else {
    applyFrame(measure(current));
  }
  grinderControls.hidden = name !== 'grinder';
  controls.autoRotate = true;
  for (const b of document.querySelectorAll('#tabs button')) {
    b.setAttribute('aria-pressed', String(b.dataset.model === name));
  }
  history.replaceState(null, '', '#' + name);
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) show(b.dataset.model);
});
fillInput.addEventListener('input', () => cache.grinder?.userData.setFill(+fillInput.value));
explodeInput.addEventListener('input', () => {
  cache.grinder?.userData.setExplode(+explodeInput.value);
  if (grinderFrames) frameGrinder(+explodeInput.value, true);
});

show(factories[location.hash.slice(1)] ? location.hash.slice(1) : 'grinder');

/* ---------- loop ---------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  current?.userData.update?.(dt);
  controls.update();
  renderer.render(scene, camera);
});

window.__viewer = { show, scene, camera, controls, cache, frameGrinder: (e) => frameGrinder(e, true) };

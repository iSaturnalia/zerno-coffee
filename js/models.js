// Procedural coffee-scene models for ЗЕРНО.
// Units: 1 unit ≈ 10 cm. Every model stands on y = 0.
import * as THREE from 'three';

const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */

export const M = {
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.03,
    transmission: 1, thickness: 0.06, ior: 1.5,
    specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02,
    side: THREE.DoubleSide,
  }),
  black: new THREE.MeshPhysicalMaterial({
    color: 0x121214, metalness: 0.35, roughness: 0.42,
    clearcoat: 0.35, clearcoatRoughness: 0.35, side: THREE.DoubleSide,
  }),
  blackSatin: new THREE.MeshPhysicalMaterial({
    color: 0x18181a, metalness: 0.5, roughness: 0.55, clearcoat: 0.15,
  }),
  steel: new THREE.MeshPhysicalMaterial({
    color: 0xc9c9cd, metalness: 1, roughness: 0.22,
  }),
  steelDark: new THREE.MeshPhysicalMaterial({
    color: 0x8d8d93, metalness: 1, roughness: 0.32,
  }),
  ceramic: new THREE.MeshPhysicalMaterial({
    color: 0xf5f2ed, metalness: 0, roughness: 0.32,
    clearcoat: 0.8, clearcoatRoughness: 0.12, side: THREE.DoubleSide,
  }),
  paper: new THREE.MeshPhysicalMaterial({
    color: 0xf1ece2, roughness: 0.95, side: THREE.DoubleSide, sheen: 0.4,
  }),
  wood: new THREE.MeshPhysicalMaterial({
    color: 0x8a5a36, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4,
  }),
  bean: new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35,
  }),
  beanCore: new THREE.MeshStandardMaterial({ color: 0x1e1009, roughness: 1 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9 }),
  accent: new THREE.MeshStandardMaterial({ color: 0xbf511b, roughness: 0.5 }),
  grounds: new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 1 }),
  coffee: new THREE.MeshPhysicalMaterial({
    // opaque on purpose: three.js glass can't show other transmissive objects through it
    color: 0x140803, roughness: 0.06, metalness: 0,
    clearcoat: 0.6, clearcoatRoughness: 0.03, envMapIntensity: 0.35,
    specularColor: new THREE.Color(0xffd7b0),
  }),
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const v2 = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));

function lathe(points, mat, { segs = 128, phiStart = 0, phiLength = TAU } = {}) {
  const geo = new THREE.LatheGeometry(v2(points), segs, phiStart, phiLength);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Radius of a [r, y] profile at height y (linear interpolation). */
function radiusAt(profile, y) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, y0] = profile[i];
    const [r1, y1] = profile[i + 1];
    if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0 || 1)) * (r1 - r0);
  }
  return y < profile[0][1] ? profile[0][0] : profile[profile.length - 1][0];
}

/**
 * Closed wall profile from an outer silhouette.
 * bottom = null → open bottom (ring), otherwise floor thickness.
 */
function shell(outer, t, bottom = null) {
  const y0 = outer[0][1];
  const top = outer[outer.length - 1];
  const inner = outer.map(([r, y]) => [Math.max(r - t, 0.002), y]);
  const pts = [];
  if (bottom !== null) pts.push([0, y0]);
  pts.push(...outer);
  pts.push([top[0] - t * 0.5, top[1] + t * 0.3]); // rounded rim
  const floor = bottom !== null ? y0 + bottom : y0;
  for (let i = inner.length - 1; i >= 0; i--) {
    if (inner[i][1] > floor + 1e-4) pts.push(inner[i]);
  }
  pts.push([radiusAt(outer, floor) - t, floor]);
  if (bottom !== null) pts.push([0, floor]);
  else pts.push(outer[0]);
  return pts;
}

/** Solid of revolution filling the inside of `outer` from y0 to level. */
function fillProfile(outer, y0, level, inset, steps = 14) {
  const pts = [[0, y0]];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + (i / steps) * (level - y0);
    pts.push([Math.max(radiusAt(outer, y) - inset, 0.002), y]);
  }
  pts.push([0, level]);
  return pts;
}

/** Push a lathe surface in/out radially to cut ridges or pleats. */
function ridges(geo, n, twist, amp, sharp = 0.5) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.01) continue;
    const s = Math.sin(n * Math.atan2(x, z) + twist * y);
    const k = 1 + amp * Math.sign(s) * Math.pow(Math.abs(s), sharp);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  geo.computeVertexNormals();
}

/** Tube along a curve whose radius goes from r0 to r1. */
function taperedTube(points, r0, r1, mat, segs = 120, radial = 28) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    curve.getPointAt(u, c);
    const r = r0 + (r1 - r0) * u;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      pos.setXYZ(k,
        c.x + (pos.getX(k) - c.x) * r,
        c.y + (pos.getY(k) - c.y) * r,
        c.z + (pos.getZ(k) - c.z) * r);
    }
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Half of a solid of revolution with flat caps on the cut. */
function halfSolid(profile, mat, phiStart) {
  const g = new THREE.Group();
  g.add(lathe(profile, mat, { segs: 72, phiStart, phiLength: Math.PI }));
  const shape = new THREE.Shape(v2(profile));
  const capGeo = new THREE.ShapeGeometry(shape, 8);
  for (const phi of [phiStart, phiStart + Math.PI]) {
    const cap = new THREE.Mesh(capGeo, mat);
    cap.rotation.y = phi - Math.PI / 2;
    cap.castShadow = cap.receiveShadow = true;
    g.add(cap);
  }
  return g;
}

function rand(a, b) { return a + Math.random() * (b - a); }

/* ------------------------------------------------------------------ */
/* Coffee bean                                                         */
/* ------------------------------------------------------------------ */

export function beanGeometry(w = 24, h = 18) {
  const g = new THREE.SphereGeometry(1, w, h);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
    // slight lumpiness so no two beans catch light the same way
    const n = 1 + 0.035 * Math.sin(ux * 9.1 + uy * 4.3) * Math.sin(uz * 7.7 + uy * 3.1);
    let x = ux * 0.38 * n;
    let y = uy * 0.5 * n;
    let z = uz * 0.3 * n;
    if (z > 0) {
      z *= 0.55; // flat face
      const gx = x - 0.045 * Math.sin(y * 7); // S-shaped crease
      const along = 1 - Math.pow(y / 0.5, 2);
      z -= Math.exp(-(gx * gx) / 0.0025) * 0.1 * Math.max(along, 0);
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  g.scale(0.1, 0.1, 0.1); // ~1 cm
  return g;
}

const BEAN_TONES = [0x3a1f10, 0x31190c, 0x422513, 0x2b160a, 0x4a2a17];

function beanColor(c) {
  c.setHex(BEAN_TONES[(Math.random() * BEAN_TONES.length) | 0]);
  c.offsetHSL(0, rand(-0.03, 0.03), rand(-0.03, 0.03));
  return c;
}

/** Loose pile of beans on the floor. */
export function createBeanPile(count = 160) {
  const geo = beanGeometry();
  const mesh = new THREE.InstancedMesh(geo, M.bean, count);
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const r = Math.pow(Math.random(), 0.7) * 0.9;
    const h = Math.max(0, 0.35 * (1 - r / 0.9));
    d.position.set(Math.cos(a) * r, 0.03 + Math.random() * h, Math.sin(a) * r);
    d.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    d.scale.setScalar(rand(0.9, 1.15));
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
    mesh.setColorAt(i, beanColor(c));
  }
  mesh.castShadow = mesh.receiveShadow = true;

  const hero = new THREE.Mesh(geo, M.bean.clone());
  hero.material.color.setHex(0x4a2a17);
  hero.scale.setScalar(4);
  hero.position.set(0, 0.75, 0.2);
  hero.rotation.set(-0.5, 0.3, 0.4);
  hero.castShadow = true;

  const g = new THREE.Group();
  g.name = 'beans';
  g.add(mesh, hero);
  g.userData.update = (dt) => { hero.rotation.y += dt * 0.6; };
  return g;
}

/* ------------------------------------------------------------------ */
/* Grinder                                                             */
/* ------------------------------------------------------------------ */

export function createGrinder() {
  const root = new THREE.Group();
  root.name = 'grinder';

  /* ---- body: two halves that split apart ---- */
  const H = 2.0, R = 0.62, b = 0.07;
  const bodyProfile = [[0, 0], [R - b, 0], [R - b * 0.3, b * 0.3], [R, b], [R, H - b], [R - b * 0.3, H - b * 0.3], [R - b, H], [0, H]];
  const halfPos = halfSolid(bodyProfile, M.black, 0);        // x ≥ 0
  const halfNeg = halfSolid(bodyProfile, M.black, Math.PI);  // x ≤ 0

  // steel foot ring split the same way
  const foot = [[R - 0.01, 0.02], [R + 0.012, 0.02], [R + 0.012, 0.09], [R - 0.01, 0.09]];
  halfPos.add(lathe(foot, M.steel, { segs: 72, phiStart: 0, phiLength: Math.PI }));
  halfNeg.add(lathe(foot, M.steel, { segs: 72, phiStart: Math.PI, phiLength: Math.PI }));
  // rubber sole and a thin accent line two thirds up
  const sole = [[0, 0], [R - 0.05, 0], [R - 0.05, 0.02], [0, 0.02]];
  const line = [[R - 0.004, 1.38], [R + 0.004, 1.38], [R + 0.004, 1.395], [R - 0.004, 1.395]];
  for (const [half, phi] of [[halfPos, 0], [halfNeg, Math.PI]]) {
    half.add(lathe(sole, M.rubber, { segs: 72, phiStart: phi, phiLength: Math.PI }));
    half.add(lathe(line, M.steelDark, { segs: 72, phiStart: phi, phiLength: Math.PI }));
  }
  // power button on the back
  const back = new THREE.Vector3(Math.sin(2.5), 0, Math.cos(2.5));
  const button = lathe([[0, 0], [0.07, 0], [0.075, 0.02], [0.065, 0.04], [0, 0.045]], M.steel, { segs: 48 });
  button.rotation.x = Math.PI / 2;
  const buttonHolder = new THREE.Group();
  buttonHolder.add(button);
  buttonHolder.position.copy(back).multiplyScalar(R - 0.01).setY(1.62);
  buttonHolder.lookAt(back.x * 10, 1.62, back.z * 10);
  halfPos.add(buttonHolder);

  // grind-size dial on the front-left
  const dir = new THREE.Vector3(Math.sin(-0.75), 0, Math.cos(-0.75));
  const dial = new THREE.Group();
  const dialFace = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 64).rotateX(Math.PI / 2), M.steel);
  const dialRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 16, 64), M.steelDark);
  dialRim.position.z = 0.03;
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.012), M.black);
  notch.position.set(0, 0.07, 0.036);
  dial.add(dialFace, dialRim, notch);
  dial.position.copy(dir).multiplyScalar(R + 0.03).setY(1.05);
  dial.lookAt(dir.x * 10, 1.05, dir.z * 10);
  dial.traverse((o) => { o.castShadow = true; });
  halfNeg.add(dial);

  /* ---- burr set (hidden inside until exploded) ---- */
  const burr = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.9, 24), M.steel);
  shaft.position.y = 1.25;
  const outerBurrGeo = new THREE.LatheGeometry(v2([[0.27, 1.5], [0.42, 1.5], [0.42, 1.86], [0.33, 1.86], [0.24, 1.62], [0.27, 1.5]]), 160);
  ridges(outerBurrGeo, 22, 0, 0.035, 0.3);
  const outerBurr = new THREE.Mesh(outerBurrGeo, M.steelDark);
  const innerBurrGeo = new THREE.LatheGeometry(v2([[0, 1.4], [0.12, 1.4], [0.27, 1.5], [0.25, 1.62], [0.17, 1.78], [0.07, 1.9], [0, 1.93]]), 192);
  ridges(innerBurrGeo, 16, 9, 0.07, 0.35);
  const innerBurr = new THREE.Mesh(innerBurrGeo, M.steel);
  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 6), M.steel);
  nut.position.y = 1.97;
  burr.add(shaft, outerBurr, innerBurr, nut);
  burr.traverse((o) => { o.castShadow = o.receiveShadow = true; });

  // falling grounds
  const GROUNDS = 420;
  const groundGeo = new THREE.IcosahedronGeometry(0.011, 0);
  const grounds = new THREE.InstancedMesh(groundGeo, M.grounds, GROUNDS);
  const gState = [];
  for (let i = 0; i < GROUNDS; i++) {
    gState.push({ a: rand(0, TAU), r: Math.sqrt(Math.random()) * 0.22, y: rand(0.25, 1.4), v: rand(0.35, 0.9), s: rand(0.6, 1.5) });
  }
  grounds.castShadow = true;
  grounds.visible = false;
  burr.add(grounds);

  /* ---- collar + lever ---- */
  const collar = new THREE.Group();
  collar.add(lathe([[0.3, 2.0], [0.48, 2.0], [0.5, 2.02], [0.5, 2.12], [0.47, 2.15], [0.3, 2.15]], M.steel));
  collar.add(lathe([[0.26, 2.15], [0.44, 2.15], [0.44, 2.19], [0.26, 2.19]], M.blackSatin));
  const lever = taperedTube([[-0.45, 2.08, 0], [-0.75, 2.09, 0], [-1.05, 2.12, 0]], 0.035, 0.028, M.steel, 24, 16);
  const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 16), M.blackSatin);
  leverKnob.position.set(-1.07, 2.12, 0);
  leverKnob.castShadow = true;
  collar.add(lever, leverKnob);

  /* ---- glass hopper with beans ---- */
  const hopper = new THREE.Group();
  hopper.position.y = 2.19;
  const hopperOuter = [[0.42, 0], [0.5, 0.06], [0.56, 0.18], [0.86, 2.2]];
  const glass = lathe(shell(hopperOuter, 0.03), M.glass, { segs: 160 });
  glass.castShadow = false;
  hopper.add(glass);
  // dark throat at the bottom of the hopper
  hopper.add(lathe([[0, 0.02], [0.4, 0.02], [0.3, 0.16], [0, 0.16]], M.blackSatin));

  const innerWall = hopperOuter.map(([r, y]) => [r - 0.03, y]);
  const FILL_TOP = 1.25;
  const core = lathe(fillProfile(innerWall, 0.12, FILL_TOP - 0.05, 0.1), M.beanCore, { segs: 64 });
  core.castShadow = false;
  hopper.add(core);

  const beanGeo = beanGeometry(12, 9); // small on screen, keep it light
  const placed = [];
  // two layers against the glass
  for (let i = 0; i < 2600; i++) {
    const y = rand(0.14, FILL_TOP);
    const a = Math.random() * TAU;
    const r = radiusAt(innerWall, y) - rand(0.04, 0.13);
    placed.push([Math.sin(a) * r, y, Math.cos(a) * r]);
  }
  // mounded top surface
  const topR = radiusAt(innerWall, FILL_TOP) - 0.04;
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * TAU;
    const rr = Math.sqrt(Math.random()) * topR;
    const y = FILL_TOP + 0.1 * (1 - (rr / topR) ** 2) + rand(-0.03, 0.03);
    placed.push([Math.sin(a) * rr, y, Math.cos(a) * rr]);
  }
  placed.sort((p, q) => p[1] - q[1]);
  const beans = new THREE.InstancedMesh(beanGeo, M.bean, placed.length);
  const d = new THREE.Object3D();
  const col = new THREE.Color();
  placed.forEach((p, i) => {
    d.position.set(...p);
    d.rotation.set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
    d.scale.setScalar(rand(0.9, 1.15));
    d.updateMatrix();
    beans.setMatrixAt(i, d.matrix);
    beans.setColorAt(i, beanColor(col));
  });
  beans.castShadow = true;
  beans.receiveShadow = true;
  hopper.add(beans);

  root.add(halfPos, halfNeg, burr, collar, hopper);

  /* ---- controls ---- */
  let explode = 0;
  const setExplode = (t) => {
    explode = t;
    const e = THREE.MathUtils.smootherstep(t, 0, 1);
    halfPos.position.x = 1.15 * e;
    halfNeg.position.x = -1.15 * e;
    halfNeg.rotation.y = 0.12 * e;
    halfPos.rotation.y = -0.12 * e;
    collar.position.y = 0.55 * e;
    hopper.position.y = 2.19 + 1.05 * e;
    burr.position.y = 0.15 * e;
    innerBurr.rotation.y = e * 3;
    grounds.visible = t > 0.25;
  };
  const setFill = (t) => {
    beans.count = Math.round(placed.length * THREE.MathUtils.clamp(t, 0, 1));
    core.visible = t > 0.02;
    core.scale.y = Math.max(t, 0.001);
  };

  const m4 = new THREE.Matrix4();
  root.userData = {
    setExplode, setFill,
    /** Height of the bean surface in model space for a fill level. */
    surfaceY: (t) => hopper.position.y + 0.14 + (FILL_TOP + 0.08 - 0.14) * t,
    hopperRadius: (t) => radiusAt(innerWall, 0.14 + (FILL_TOP - 0.14) * t) - 0.08,
    boost: 0, // 0..1, set by the site while the cursor is over the grinder
    update(dt) {
      if (!grounds.visible) return;
      const b = root.userData.boost;
      innerBurr.rotation.y += dt * (4 + 14 * b);
      gState.forEach((s, i) => {
        s.y -= s.v * dt * (1 + 1.6 * b);
        if (s.y < 0.15) s.y = 1.4;
        m4.makeScale(s.s, s.s, s.s).setPosition(Math.sin(s.a) * s.r, s.y, Math.cos(s.a) * s.r);
        grounds.setMatrixAt(i, m4);
      });
      grounds.instanceMatrix.needsUpdate = true;
    },
  };
  return root;
}

/* ------------------------------------------------------------------ */
/* Gooseneck kettle                                                    */
/* ------------------------------------------------------------------ */

export function createKettle() {
  const g = new THREE.Group();
  g.name = 'kettle';
  // electric base station
  const station = new THREE.Group();
  station.add(lathe([[0, 0], [0.7, 0], [0.74, 0.02], [0.75, 0.07], [0.72, 0.1], [0, 0.1]], M.blackSatin));
  station.add(lathe([[0.735, 0.035], [0.758, 0.035], [0.758, 0.06], [0.735, 0.06]], M.steel));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  led.position.set(0, 0.055, 0.75);
  station.add(led);
  g.add(station);

  const k = new THREE.Group();
  k.position.y = 0.1;
  // tall straight-walled body, like a Stagg-style pour-over kettle
  const body = [[0, 0], [0.5, 0], [0.57, 0.025], [0.6, 0.1], [0.61, 0.4], [0.61, 1.45], [0.585, 1.64], [0.5, 1.77], [0.38, 1.84], [0.36, 1.86], [0, 1.86]];
  k.add(lathe(body, M.black));
  k.add(lathe([[0.57, 0.03], [0.613, 0.03], [0.615, 0.1], [0.57, 0.1]], M.steel));
  // lid with thermometer and wooden knob
  k.add(lathe([[0, 1.86], [0.37, 1.86], [0.38, 1.88], [0.34, 1.92], [0.2, 1.96], [0, 1.97]], M.blackSatin));
  k.add(lathe([[0, 1.97], [0.06, 1.97], [0.08, 2.02], [0.075, 2.09], [0.04, 2.12], [0, 2.125]], M.wood, { segs: 48 }));
  const thermo = new THREE.Group();
  thermo.add(lathe([[0, 0], [0.075, 0], [0.085, 0.015], [0.08, 0.035], [0, 0.035]], M.steel, { segs: 48 }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.066, 48).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xf2efe8, roughness: 0.2, clearcoat: 1 }));
  face.position.y = 0.036;
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.05), M.accent);
  needle.position.set(0.01, 0.04, -0.015);
  needle.rotation.y = 0.7;
  thermo.add(face, needle);
  thermo.position.set(0.2, 1.935, 0.12);
  thermo.rotation.set(-0.12, 0, 0.3);
  k.add(thermo);
  // gooseneck spout
  k.add(taperedTube([
    [0.56, 0.26, 0], [0.86, 0.38, 0], [1.02, 0.85, 0], [1.07, 1.5, 0],
    [1.16, 1.98, 0], [1.4, 2.16, 0], [1.66, 2.08, 0], [1.82, 1.92, 0],
  ], 0.068, 0.022, M.black, 180, 32));
  // handle with a counterweight bend
  k.add(taperedTube([
    [-0.57, 1.62, 0], [-0.86, 1.72, 0], [-1.08, 1.48, 0], [-1.1, 0.92, 0], [-0.96, 0.44, 0], [-0.6, 0.3, 0],
  ], 0.065, 0.058, M.blackSatin, 110, 24));
  g.add(k);
  g.traverse((o) => { if (o.isMesh && o !== led) o.castShadow = true; });
  // the site lifts the kettle off its base to pour
  g.userData.station = station;
  g.userData.body = k;
  g.userData.spoutTip = new THREE.Vector3(1.82, 1.92, 0); // in body space
  return g;
}

/* ------------------------------------------------------------------ */
/* Pour-over: V60 dripper on a glass carafe                            */
/* ------------------------------------------------------------------ */

export function createPourOver() {
  const g = new THREE.Group();
  g.name = 'pourover';

  /* carafe */
  const carafeOuter = [[0.44, 0], [0.6, 0.06], [0.7, 0.24], [0.72, 0.4], [0.66, 0.68], [0.5, 0.9], [0.38, 1.04], [0.34, 1.18], [0.37, 1.34], [0.43, 1.45]];
  const carafe = lathe(shell(carafeOuter, 0.025, 0.035), M.glass, { segs: 160 });
  carafe.castShadow = false;
  g.add(carafe);
  const liquid = lathe(fillProfile(carafeOuter, 0.036, 0.42, 0.03), M.coffee, { segs: 96 });
  g.add(liquid);
  // wooden collar
  const r1 = radiusAt(carafeOuter, 0.94), r2 = radiusAt(carafeOuter, 1.16);
  g.add(lathe([[r1 + 0.002, 0.94], [r1 + 0.05, 0.94], [r2 + 0.05, 1.16], [r2 + 0.002, 1.16]], M.wood));
  // leather tie
  const tie = new THREE.Mesh(new THREE.TorusGeometry(radiusAt(carafeOuter, 1.05) + 0.05, 0.012, 12, 96), M.blackSatin);
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 1.05;
  g.add(tie);

  /* dripper */
  const dr = new THREE.Group();
  dr.position.y = 1.42;
  dr.add(lathe([[0.3, -0.06], [0.33, -0.06], [0.35, 0.04], [0.3, 0.04]], M.ceramic)); // foot
  dr.add(lathe([[0.15, 0.04], [0.6, 0.04], [0.62, 0.06], [0.6, 0.09], [0.15, 0.09]], M.ceramic)); // flange
  const coneOuter = [[0.17, 0.09], [0.22, 0.14], [0.72, 0.92], [0.76, 0.96]];
  const coneGeo = new THREE.LatheGeometry(v2(shell(coneOuter, 0.045)), 192);
  ridges(coneGeo, 24, 0, 0.006, 0.6);
  const cone = new THREE.Mesh(coneGeo, M.ceramic);
  cone.castShadow = cone.receiveShadow = true;
  dr.add(cone);
  // handle
  dr.add(taperedTube([[0.7, 0.82, 0], [0.98, 0.78, 0], [1.04, 0.52, 0], [0.86, 0.34, 0], [0.5, 0.34, 0]], 0.05, 0.05, M.ceramic, 80, 20));

  // paper filter with pleats
  const filterOuter = [[0.06, 0.14], [0.2, 0.32], [0.66, 0.93], [0.69, 0.99]];
  const filterGeo = new THREE.LatheGeometry(v2(filterOuter), 240);
  ridges(filterGeo, 36, 0, 0.022, 0.8);
  const filter = new THREE.Mesh(filterGeo, M.paper);
  filter.castShadow = filter.receiveShadow = true;
  dr.add(filter);

  // coffee bed (blooming, slightly domed)
  const bed = lathe([[0, 0.17], [0.08, 0.17], [0.46, 0.66], [0.3, 0.7], [0.12, 0.73], [0, 0.735]], M.grounds, { segs: 96 });
  dr.add(bed);
  // wet ring of brew on the bed
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.4, 64).rotateX(-Math.PI / 2), M.coffee);
  brew.position.y = 0.705;
  dr.add(brew);

  g.add(dr);

  // thin stream of brew from the dripper into the carafe
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.015, 1.1, 16, 1, true), M.coffee);
  stream.position.y = 0.97;
  g.add(stream);
  const splash = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 8, 32).rotateX(Math.PI / 2), M.coffee);
  splash.position.y = 0.425;
  g.add(splash);
  let t = 0;
  g.userData.update = (dt) => {
    t += dt;
    stream.scale.x = stream.scale.z = 1 + Math.sin(t * 23) * 0.12;
    const s = 1 + ((t * 1.6) % 1) * 2.2;
    splash.scale.set(s, 1, s);
  };
  return g;
}

/* ------------------------------------------------------------------ */
/* Cup on a saucer                                                     */
/* ------------------------------------------------------------------ */

function cremaTexture(latte = false) {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  const stops = latte
    ? [[0, '#f4ead9'], [0.5, '#ecdcc2'], [0.75, '#c99a68'], [0.9, '#8a5328'], [1, '#6d3d1b']]
    : [[0, '#2a1307'], [0.45, '#3c1d0b'], [0.72, '#6b3a17'], [0.9, '#a36a3a'], [1, '#c08a57']];
  for (const [o, col] of stops) grd.addColorStop(o, col);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, s, s);
  // tiger-striped crema swirls
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const r = s * (0.08 + Math.random() * 0.38);
    const a0 = Math.random() * TAU;
    ctx.strokeStyle = `rgba(${170 + Math.random() * 50}, ${110 + Math.random() * 30}, 60, ${0.12 + Math.random() * 0.18})`;
    ctx.lineWidth = 2 + Math.random() * 7;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, r, a0, a0 + 0.6 + Math.random() * 2.2);
    ctx.stroke();
  }
  // crema speckle
  for (let i = 0; i < 2600; i++) {
    const a = Math.random() * TAU;
    const r = Math.pow(Math.random(), 0.5) * s * 0.5;
    ctx.fillStyle = `rgba(${200 + Math.random() * 40}, ${140 + Math.random() * 40}, 90, ${Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, Math.random() * 2.4, 0, TAU);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createCup({ latte = false } = {}) {
  const g = new THREE.Group();
  g.name = 'cup';
  // saucer
  g.add(lathe([[0, 0], [0.55, 0], [0.62, 0.02], [0.9, 0.07], [1.08, 0.13], [1.1, 0.15], [1.07, 0.155], [0.9, 0.11], [0.62, 0.085], [0.42, 0.09], [0, 0.09]], M.ceramic));
  // cup
  const cupOuter = [[0.3, 0.09], [0.34, 0.11], [0.48, 0.2], [0.58, 0.4], [0.63, 0.68], [0.65, 0.86]];
  g.add(lathe(shell(cupOuter, 0.04, 0.07), M.ceramic, { segs: 160 }));
  // coffee surface with crema
  const level = 0.79;
  const surf = new THREE.Mesh(
    new THREE.CircleGeometry(radiusAt(cupOuter, level) - 0.039, 96).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ map: cremaTexture(latte), roughness: latte ? 0.45 : 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }),
  );
  surf.position.y = level;
  surf.receiveShadow = true;
  g.add(surf);
  // the site paints latte art onto this surface (its texture's canvas)
  g.userData.surface = surf;
  g.userData.resetSurface = () => {
    const fresh = cremaTexture(latte);
    surf.material.map.image.getContext('2d').drawImage(fresh.image, 0, 0);
    surf.material.map.needsUpdate = true;
    fresh.dispose();
  };
  // handle
  g.add(taperedTube([[0.6, 0.7, 0], [0.86, 0.72, 0], [0.97, 0.55, 0], [0.86, 0.34, 0], [0.55, 0.3, 0]], 0.055, 0.045, M.ceramic, 90, 20));

  // teaspoon resting on the saucer
  const spoon = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 48, 24, 0, TAU, Math.PI / 2, Math.PI / 2), M.steel);
  bowl.material = M.steel.clone();
  bowl.material.side = THREE.DoubleSide; // the inside of the bowl faces up
  bowl.scale.set(1.55, 0.32, 1);
  bowl.position.y = 0.035;
  const stem = taperedTube([[0.14, 0.03, 0], [0.32, 0.045, 0], [0.55, 0.07, 0], [0.72, 0.085, 0]], 0.014, 0.024, M.steel, 40, 12);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 12), M.steel);
  tip.scale.set(1.6, 0.35, 1);
  tip.position.set(0.74, 0.086, 0);
  spoon.add(bowl, stem, tip);
  spoon.traverse((o) => { o.castShadow = true; });
  spoon.position.set(-0.1, 0.09, 0.74);
  spoon.rotation.y = -0.32;
  g.add(spoon);
  return g;
}

/* ------------------------------------------------------------------ */
/* Steam                                                               */
/* ------------------------------------------------------------------ */

const steamVertex = /* glsl */`
  uniform float uTime;
  uniform float uSeed;
  uniform float uWind;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float h = uv.y;
    // curl sideways more the higher the wisp rises
    p.x += sin(h * 5.0 + uTime * 1.3 + uSeed) * 0.12 * h
         + sin(h * 11.0 - uTime * 2.1 + uSeed * 2.0) * 0.035 * h
         + uWind * h * h * 0.55;
    p.z += cos(h * 4.0 + uTime * 0.9 + uSeed) * 0.08 * h;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const steamFragment = /* glsl */`
  uniform float uTime;
  uniform float uSeed;
  uniform float uOpacity;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 uv = vUv;
    vec2 q = vec2(uv.x * 2.6 + uSeed, uv.y * 2.2 - uTime * 0.32);
    float n = fbm(q + fbm(q * 1.7 + uTime * 0.05));
    float wisp = smoothstep(0.38, 0.82, n);
    float edge = smoothstep(0.0, 0.35, uv.x) * smoothstep(1.0, 0.65, uv.x);
    // thickest just above the coffee, thinning out as it rises
    float fade = smoothstep(0.0, 0.06, uv.y) * pow(1.0 - uv.y, 1.6);
    gl_FragColor = vec4(vec3(1.0), wisp * edge * fade * uOpacity);
  }
`;

/** Wisps of steam: three crossed shader planes rising from y = 0. */
export function createSteam({ width = 1.0, height = 1.6 } = {}) {
  const g = new THREE.Group();
  g.name = 'steam';
  const geo = new THREE.PlaneGeometry(width, height, 1, 48).translate(0, height / 2, 0);
  const shared = { uTime: { value: 0 }, uWind: { value: 0 }, uOpacity: { value: 0.55 } };
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: steamVertex,
      fragmentShader: steamFragment,
      uniforms: { ...shared, uSeed: { value: i * 3.7 + 1.3 } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.y = (i * Math.PI) / 4;
    plane.renderOrder = 2;
    g.add(plane);
  }
  g.userData.uniforms = shared;
  g.userData.update = (dt) => { shared.uTime.value += dt; };
  return g;
}

/* ------------------------------------------------------------------ */
/* Coffee drop                                                         */
/* ------------------------------------------------------------------ */

export function createDrop() {
  const pts = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI;
    pts.push([0.34 * Math.sin(th) * Math.pow(Math.sin(th / 2), 0.9), 0.4 * Math.cos(th)]);
  }
  pts.reverse();
  const g = new THREE.Group();
  g.name = 'drop';

  const drop = lathe(pts, M.coffee, { segs: 96 });
  drop.scale.setScalar(0.35);
  g.add(drop);

  // wide dark bowl of coffee
  const POOL = 2.4;
  g.add(lathe([[0, -0.3], [POOL + 0.05, -0.3], [POOL + 0.18, -0.05], [POOL + 0.2, 0.06], [POOL + 0.12, 0.08], [POOL + 0.02, 0.02], [POOL, 0], [0, 0]], M.blackSatin, { segs: 160 }));
  const poolGeo = new THREE.RingGeometry(0.0005, POOL + 0.01, 256, 110).rotateX(-Math.PI / 2);
  const base = Float32Array.from(poolGeo.attributes.position.array);
  const pool = new THREE.Mesh(poolGeo, M.coffee);
  pool.position.y = 0.012;
  pool.receiveShadow = true;
  g.add(pool);

  // rebound droplet (Worthington jet)
  const jet = new THREE.Mesh(new THREE.SphereGeometry(0.06, 32, 16), M.coffee);
  jet.castShadow = true;
  g.add(jet);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.11, 1, 24, 1, true), M.coffee);
  g.add(column);

  const PERIOD = 2.6, FALL = 0.55, H0 = 2.4;
  let t = 0.2;
  const pos = poolGeo.attributes.position;

  g.userData.update = (dt) => {
    const prev = t;
    t = (t + dt) % PERIOD;
    // the moment the drop meets the surface (used for the "plip" sound)
    if (dt > 0 && prev < FALL && t >= FALL) g.userData.onImpact?.();

    // falling drop, stretched by speed
    if (t < FALL) {
      const u = t / FALL;
      drop.visible = true;
      drop.position.y = H0 * (1 - u * u) + 0.12;
      drop.scale.set(0.35 - u * 0.05, 0.35 + u * 0.12, 0.35 - u * 0.05);
    } else {
      drop.visible = false;
    }

    // ripples after impact
    const tau = t - FALL;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], z = base[i * 3 + 2];
      let h = 0;
      if (tau > 0) {
        const r = Math.hypot(x, z);
        const front = tau * 1.1;
        if (r < front + 0.1) {
          const behind = front - r;
          h = 0.045 * Math.sin(r * 22 - tau * 24) * Math.exp(-behind * 1.6) * Math.exp(-tau * 0.9) / (1 + r * 1.5);
        }
        h -= 0.12 * Math.exp(-(x * x + z * z) / 0.015) * Math.exp(-tau * 9); // crater
      }
      pos.setY(i, h);
    }
    pos.needsUpdate = true;
    poolGeo.computeVertexNormals();

    // jet rises out of the crater and falls back
    const j = (tau - 0.08) / 0.62;
    if (tau > 0 && j > 0 && j < 1) {
      const hJet = Math.sin(Math.PI * j) * 0.75;
      column.visible = j < 0.55;
      column.scale.set(1, Math.max(hJet, 0.001), 1);
      column.position.y = hJet / 2;
      jet.visible = true;
      jet.position.y = hJet + 0.08 + (j > 0.45 ? Math.sin(Math.PI * (j - 0.45) / 0.55) * 0.25 : 0);
    } else {
      column.visible = jet.visible = false;
    }
  };
  g.userData.update(0);
  // low, close camera so the ripples read as a surface
  g.userData.view = { center: [0, 0.45, 0], dist: 4.4, dir: [0, 0.3, 1] };
  g.userData.footprint = 0;
  return g;
}

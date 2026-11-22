// Cart drawer and the 3D product card (with latte art on the cappuccino).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCup, createPourOver, createKettle, createGrinder, createBeanPile } from './models.js?v=13';
import { T } from './i18n.js?v=13';

const { gsap } = window;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const rub = T.money;
const INFO = T.info;

/** Everything the shop needs to know about a card. */
function readProducts() {
  const map = new Map();
  for (const card of $$('.card')) {
    const id = card.dataset.thumb;
    map.set(id, {
      id,
      card,
      name: $('h3', card).textContent.trim(),
      price: Number(card.dataset.price),
      ...INFO[id],
    });
  }
  return map;
}

export function initShop({ lenis, onOverlay }) {
  const products = readProducts();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let openLayers = 0;
  const lock = (on) => {
    openLayers += on ? 1 : -1;
    const locked = openLayers > 0;
    document.documentElement.classList.toggle('is-locked', locked);
    if (lenis) (locked ? lenis.stop() : lenis.start());
    onOverlay?.(locked);
  };

  /* ------------------------------------------------------------------ */
  /* Cart                                                                */
  /* ------------------------------------------------------------------ */
  const cart = new Map(); // id -> qty
  const cta = $('.cta');
  const drawer = $('#cart');
  const list = $('#cartList');
  const empty = $('#cartEmpty');
  const total = $('#cartTotal');
  const note = $('#cartNote');
  const orderBtn = $('#cartOrder');
  let lastFocus = null;

  const count = () => [...cart.values()].reduce((a, b) => a + b, 0);

  function renderCart() {
    list.innerHTML = '';
    let sum = 0;
    for (const [id, qty] of cart) {
      const p = products.get(id);
      sum += p.price * qty;
      const li = document.createElement('li');
      li.className = 'cart-item';
      li.innerHTML = `
        <span class="cart-thumb" style="background-image:${$('.ph', p.card).style.backgroundImage || 'none'}"></span>
        <span class="cart-name">${p.name}<small>${rub(p.price)}</small></span>
        <span class="qty">
          <button data-dec="${id}" aria-label="${T.cart.removeOne(p.name)}">−</button>
          <output aria-live="polite">${qty}</output>
          <button data-inc="${id}" aria-label="${T.cart.addOne(p.name)}">+</button>
        </span>`;
      list.append(li);
    }
    total.textContent = rub(sum);
    empty.hidden = cart.size > 0;
    orderBtn.disabled = cart.size === 0;
    const n = count();
    cta.textContent = n ? T.cart.withItems(n) : T.cart.order;
    cta.setAttribute('aria-label', n ? T.cart.openAria(n) : T.cart.order);
    // mark the "+" on cards that are in the cart
    for (const p of products.values()) $('.row button', p.card).classList.toggle('added', cart.has(p.id));
  }

  function add(id, from) {
    cart.set(id, (cart.get(id) || 0) + 1);
    note.hidden = true;
    renderCart();
    gsap.fromTo(cta, { scale: 0.9 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    if (from && !reduceMotion) flyToCart(from);
  }

  // a little coffee bean flies from the button into the cart
  function flyToCart(from) {
    const a = from.getBoundingClientRect(), b = cta.getBoundingClientRect();
    const dot = document.createElement('i');
    dot.className = 'fly-bean';
    document.body.append(dot);
    gsap.set(dot, { x: a.left + a.width / 2, y: a.top + a.height / 2 });
    gsap.timeline({ onComplete: () => dot.remove() })
      .to(dot, { x: b.left + b.width / 2, duration: 0.7, ease: 'power2.inOut' }, 0)
      .to(dot, { y: b.top + b.height / 2, duration: 0.7, ease: 'back.in(1.6)' }, 0)
      .to(dot, { scale: 0.4, opacity: 0.3, duration: 0.2 }, 0.5);
  }

  function setQty(id, delta) {
    const q = (cart.get(id) || 0) + delta;
    if (q <= 0) cart.delete(id); else cart.set(id, q);
    renderCart();
  }

  function openCart() {
    if (!drawer.hidden) return;
    lastFocus = document.activeElement;
    renderCart();
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('open'));
    lock(true);
    $('.cart-close', drawer).focus({ preventScroll: true });
  }
  function closeCart() {
    if (drawer.hidden) return;
    drawer.classList.remove('open');
    setTimeout(() => { drawer.hidden = true; }, reduceMotion ? 0 : 380);
    lock(false);
    lastFocus?.focus?.({ preventScroll: true });
  }

  cta.addEventListener('click', (e) => {
    if (count() === 0) return; // no cart yet: the site scrolls to the menu
    e.preventDefault();
    e.stopPropagation();
    openCart();
  });
  drawer.addEventListener('click', (e) => {
    if (e.target.closest('[data-close-cart]')) return closeCart();
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    if (inc) setQty(inc.dataset.inc, 1);
    if (dec) setQty(dec.dataset.dec, -1);
  });
  orderBtn.addEventListener('click', () => {
    cart.clear();
    renderCart();
    note.hidden = false;
    empty.hidden = true;
  });

  /* ------------------------------------------------------------------ */
  /* Product card with a live 3D model                                   */
  /* ------------------------------------------------------------------ */
  const modal = $('#pm');
  const canvas = $('#pmCanvas');
  const hint = $('#pmHint');
  const resetBtn = $('#pmReset');
  let current = null;
  let three = null; // created on first open

  function setupThree() {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xefe7dc);
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
    const light = new THREE.DirectionalLight(0xfff1dd, 2.4);
    light.position.set(3, 6, 4);
    light.castShadow = true;
    light.shadow.mapSize.setScalar(1024);
    Object.assign(light.shadow.camera, { left: -4, right: 4, top: 6, bottom: -3 });
    scene.add(light, new THREE.HemisphereLight(0xffffff, 0xd8d2ca, 0.4));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.16 }));
    floor.receiveShadow = true;
    scene.add(floor);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.addEventListener('start', () => { controls.autoRotate = false; });
    const makers = {
      espresso: () => createCup(),
      latte: () => createCup({ latte: true }),
      pourover: () => createPourOver(),
      beans: () => createBeanPile(160),
      kettle: () => createKettle(),
      grinder: () => { const g = createGrinder(); g.userData.setFill(1); return g; },
    };
    return { renderer, scene, camera, controls, makers, cache: {}, model: null, clock: new THREE.Clock() };
  }

  function frameModel(t, obj, art) {
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() * 0.5;
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(t.camera.fov / 2))) * (art ? 0.62 : 0.95);
    const dir = art ? new THREE.Vector3(0, 1, 0.38) : new THREE.Vector3(0.45, 0.32, 1);
    if (art) c.y = obj.userData.surface.position.y;
    t.controls.target.copy(c);
    t.camera.position.copy(c).add(dir.normalize().multiplyScalar(dist));
    t.controls.minDistance = dist * 0.5;
    t.controls.maxDistance = dist * 1.8;
    t.controls.update();
  }

  function sizeCanvas() {
    const { clientWidth: w, clientHeight: h } = canvas;
    three.renderer.setSize(w, h, false);
    three.camera.aspect = w / h;
    three.camera.updateProjectionMatrix();
  }

  /* latte art: paint foam onto the cup's surface texture */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let painting = false;
  let last = null;
  let diffuseAt = 0;

  function surfaceUV(e) {
    const surf = three.model?.userData.surface;
    if (!surf || !current?.art) return null;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, three.camera);
    const hit = ray.intersectObject(surf)[0];
    return hit ? hit.uv : null;
  }
  function paint(uv) {
    const tex = three.model.userData.surface.material.map;
    const ctx = tex.image.getContext('2d');
    const s = tex.image.width;
    const x = uv.x * s, y = (1 - uv.y) * s;
    ctx.strokeStyle = 'rgba(252, 246, 236, 0.92)';
    ctx.fillStyle = 'rgba(252, 246, 236, 0.92)';
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    if (last) { ctx.moveTo(last.x, last.y); ctx.lineTo(x, y); ctx.stroke(); }
    else { ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
    last = { x, y };
    tex.needsUpdate = true;
  }
  // foam slowly spreads and softens, like real milk on espresso
  function diffuse(now) {
    if (!current?.art || now < diffuseAt) return;
    diffuseAt = now + 90;
    const tex = three.model.userData.surface.material.map;
    const ctx = tex.image.getContext('2d');
    const s = tex.image.width;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.drawImage(tex.image, -1.2, -1.2, s + 2.4, s + 2.4);
    ctx.restore();
    tex.needsUpdate = true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const uv = surfaceUV(e);
    if (!uv) return;
    three.controls.enabled = false; // runs before OrbitControls' own handler (capture)
    painting = true;
    last = null;
    canvas.setPointerCapture(e.pointerId);
    paint(uv);
    hint.classList.add('done');
  }, { capture: true });
  canvas.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const uv = surfaceUV(e);
    if (uv) paint(uv); else last = null;
  });
  const stopPaint = () => { painting = false; last = null; if (three) three.controls.enabled = true; };
  canvas.addEventListener('pointerup', stopPaint);
  canvas.addEventListener('pointercancel', stopPaint);
  resetBtn.addEventListener('click', () => three.model?.userData.resetSurface?.());

  function openProduct(id) {
    const p = products.get(id);
    if (!p) return;
    current = p;
    lastFocus = document.activeElement;
    $('#pmTitle').textContent = p.name;
    $('#pmMeta').textContent = p.meta;
    $('#pmDesc').textContent = p.desc;
    $('#pmPrice').textContent = rub(p.price);
    const touch = matchMedia('(pointer: coarse)').matches;
    hint.textContent = p.art
      ? (touch ? T.hint.artTouch : T.hint.artMouse)
      : (touch ? T.hint.spinTouch : T.hint.spinMouse);
    hint.classList.remove('done');
    resetBtn.hidden = !p.art;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    lock(true);

    three ||= setupThree();
    if (three.model) three.scene.remove(three.model);
    three.model = three.cache[id] ||= three.makers[id]();
    three.scene.add(three.model);
    sizeCanvas();
    frameModel(three, three.model, p.art);
    three.controls.autoRotate = !p.art && !reduceMotion;
    three.controls.autoRotateSpeed = 1.4;
    three.clock.getDelta();
    three.renderer.setAnimationLoop((now) => {
      const dt = Math.min(three.clock.getDelta(), 0.05);
      three.model.userData.update?.(dt);
      diffuse(now);
      three.controls.update();
      three.renderer.render(three.scene, three.camera);
    });
    $('.pm-close', modal).focus({ preventScroll: true });
  }
  function closeProduct() {
    if (modal.hidden) return;
    modal.classList.remove('open');
    stopPaint();
    setTimeout(() => {
      modal.hidden = true;
      three?.renderer.setAnimationLoop(null);
    }, reduceMotion ? 0 : 380);
    lock(false);
    lastFocus?.focus?.({ preventScroll: true });
  }

  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeProduct(); });
  $('#pmAdd').addEventListener('click', (e) => { add(current.id, e.currentTarget); });
  addEventListener('resize', () => { if (!modal.hidden && three) sizeCanvas(); });

  // cards: the "+" adds to the cart, anywhere else opens the product
  for (const p of products.values()) {
    const { card } = p;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', T.cart.cardAria(p.name, rub(p.price)));
    $('.row button', card).setAttribute('aria-label', T.cart.plusAria(p.name));
    card.addEventListener('click', (e) => {
      const plus = e.target.closest('.row button');
      if (plus) { e.stopPropagation(); add(p.id, plus); return; }
      openProduct(p.id);
    });
    card.addEventListener('keydown', (e) => {
      if (e.target === card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProduct(p.id); }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!modal.hidden) closeProduct();
    else if (!drawer.hidden) closeCart();
  });

  renderCart();
  return { openCart, openProduct, add };
}

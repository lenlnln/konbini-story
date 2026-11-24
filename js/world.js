// 3D 場景：店面、設備、商品、人物（AI 繪製的動漫角色立繪）、鏡頭
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { FIXTURES, PRODUCT, STORE_LEVELS, STORE_FRONT_Z, DOOR_X, CATEGORIES, SPRITES } from './data.js';
import { footprint } from './path.js';

// ───────── 材質與幾何快取 ─────────
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...opts }));
  return matCache.get(key);
}
const geoCache = new Map();
function rgeo(w, h, d, r = 0.03) {
  const k = [w, h, d, r].map(v => v.toFixed(3)).join();
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)));
  return geoCache.get(k);
}
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(0.5, 20, 14),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  plane: new THREE.PlaneGeometry(1, 1),
};
function rb(w, h, d, color, x = 0, y = 0, z = 0, r = 0.03, opts) {
  const m = new THREE.Mesh(rgeo(w, h, d, r), typeof color === 'object' ? color : mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function mesh(geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
const hex = c => '#' + c.toString(16).padStart(6, '0');
function shade(c, k) { const col = new THREE.Color(c); col.multiplyScalar(k); return '#' + col.getHexString(); }
function shadeHex(c, k) { const col = new THREE.Color(c); col.multiplyScalar(k); return col.getHex(); }
const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const texLoader = new THREE.TextureLoader();
const imgTex = new Map();
function loadTex(url) {
  if (!imgTex.has(url)) { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; imgTex.set(url, t); }
  return imgTex.get(url);
}

// ───────── 商品外觀 ─────────
const SHAPE = {
  water: 'bottle', greentea: 'bottle', soda: 'can', milktea: 'carton', sports: 'bottle',
  beefnd: 'cup', ramen: 'cup', yakisoba: 'tray',
  chips: 'bag', choco: 'bar', cookie: 'box', gummy: 'bag',
  tissue: 'box', brush: 'tallbox', battery: 'smallbox', umbrella: 'umbrella',
  onigiri: 'onigiri', bento: 'bento', sandw: 'onigiri',
  oden: 'skewer', egg: 'egg', hotdog: 'hotdog',
  americano: 'coffee', latte: 'coffee',
};
const prodGeo = {};
function productGeo(shape) {
  if (prodGeo[shape]) return prodGeo[shape];
  let g;
  switch (shape) {
    case 'bottle': {
      const pts = [[0, 0], [0.42, 0], [0.48, 0.05], [0.48, 0.6], [0.4, 0.72], [0.2, 0.82], [0.18, 0.9], [0.2, 0.9], [0.2, 1], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y));
      g = new THREE.LatheGeometry(pts, 14); break;
    }
    case 'can': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 14); g.translate(0, 0.5, 0); break;
    case 'carton': g = new RoundedBoxGeometry(0.9, 1, 0.9, 1, 0.05); g.translate(0, 0.5, 0); break;
    case 'cup': g = new THREE.CylinderGeometry(0.5, 0.38, 1, 14); g.translate(0, 0.5, 0); break;
    case 'coffee': g = new THREE.CylinderGeometry(0.5, 0.36, 1, 12); g.translate(0, 0.5, 0); break;
    case 'tray': g = new RoundedBoxGeometry(1, 0.55, 1, 2, 0.12); g.translate(0, 0.28, 0); break;
    case 'bag': g = new RoundedBoxGeometry(1, 1, 0.55, 3, 0.25); g.translate(0, 0.5, 0); break;
    case 'bar': g = new RoundedBoxGeometry(1, 0.6, 0.35, 2, 0.08); g.translate(0, 0.3, 0); break;
    case 'box': g = new RoundedBoxGeometry(1, 0.85, 0.85, 1, 0.04); g.translate(0, 0.43, 0); break;
    case 'tallbox': g = new RoundedBoxGeometry(0.7, 1, 0.4, 1, 0.04); g.translate(0, 0.5, 0); break;
    case 'smallbox': g = new RoundedBoxGeometry(0.8, 0.7, 0.4, 1, 0.04); g.translate(0, 0.35, 0); break;
    case 'umbrella': g = new THREE.CylinderGeometry(0.22, 0.32, 1, 8); g.translate(0, 0.5, 0); break;
    case 'onigiri': g = new THREE.CylinderGeometry(0.6, 0.6, 0.5, 3); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI / 2); g.translate(0, 0.32, 0); break;
    case 'bento': g = new RoundedBoxGeometry(1, 0.4, 0.8, 2, 0.06); g.translate(0, 0.2, 0); break;
    case 'skewer': g = new THREE.SphereGeometry(0.45, 10, 8); g.scale(1, 0.8, 1); g.translate(0, 0.4, 0); break;
    case 'egg': g = new THREE.SphereGeometry(0.42, 10, 8); g.scale(1, 1.25, 1); g.translate(0, 0.5, 0); break;
    case 'hotdog': g = new THREE.CapsuleGeometry(0.28, 0.7, 4, 8); g.rotateZ(Math.PI / 2); g.translate(0, 0.3, 0); break;
    default: g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  }
  return (prodGeo[shape] = g);
}
const prodMat = {};
function productMat(pid) {
  if (prodMat[pid]) return prodMat[pid];
  const p = PRODUCT[pid], shape = SHAPE[pid], base = hex(p.color), cat = CATEGORIES[p.cat];
  const tex = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    const accent = hex(cat.color);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (shape === 'bottle') {
      x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff'; x.fillRect(0, 50, w, 40);
      x.fillStyle = base; x.fillRect(0, 56, w, 6);
      x.fillStyle = shade(p.color, 0.55); x.font = `bold 22px ${FONT}`;
      x.fillText(p.name.slice(0, 2), w * 0.25, 76); x.fillText(p.name.slice(0, 2), w * 0.75, 76);
      x.fillStyle = '#e53935'; x.fillRect(0, 0, w, 14);
    } else if (shape === 'cup' || shape === 'coffee') {
      x.fillStyle = shape === 'coffee' ? '#fafafa' : base; x.fillRect(0, 0, w, h);
      x.fillStyle = shape === 'coffee' ? base : '#fff'; x.fillRect(0, h * 0.35, w, h * 0.35);
      x.fillStyle = shape === 'coffee' ? '#fff' : shade(p.color, 0.5); x.font = `bold 26px ${FONT}`;
      x.fillText(p.name.slice(-2), w * 0.25, h * 0.53);
      x.fillStyle = '#ffd54f'; x.fillRect(0, h * 0.86, w, h * 0.14);
    } else if (['bag', 'bar', 'box', 'tallbox', 'smallbox', 'carton', 'bento', 'tray'].includes(shape)) {
      const grd = x.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, shade(p.color, 1.15)); grd.addColorStop(1, shade(p.color, 0.8));
      x.fillStyle = grd; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.arc(w / 2, h * 0.5, 30, 0, Math.PI * 2); x.fill();
      x.fillStyle = accent; x.font = `bold 30px ${FONT}`; x.fillText(p.name[0], w / 2, h * 0.52);
      x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(0, 8, w, 10); x.fillRect(0, h - 18, w, 10);
    } else if (shape === 'onigiri') {
      x.fillStyle = '#fbfbf6'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1b3a1b'; x.fillRect(w * 0.3, h * 0.45, w * 0.4, h * 0.55);
      x.fillStyle = '#e53935'; x.fillRect(0, h * 0.2, w, 8);
    } else {
      x.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 6; i++) x.fillRect(0, i * 22, w, 5);
    }
  });
  return (prodMat[pid] = new THREE.MeshStandardMaterial({ map: tex, roughness: shape === 'bottle' || shape === 'can' ? 0.25 : 0.55, metalness: shape === 'can' ? 0.4 : 0 }));
}

// ═════════════════════════════════════════
export class World {
  constructor(canvas, state) {
    this.state = state;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe3ff);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);
    this.camera.position.set(4, 17, 21);
    this.controls = new OrbitControls(this.camera, canvas);
    const c = this.controls;
    c.target.set(4, 0, 3.5);
    c.enableDamping = true; c.dampingFactor = 0.12;
    c.screenSpacePanning = false;
    c.minDistance = 6; c.maxDistance = 46;
    c.minPolarAngle = 0.3; c.maxPolarAngle = 1.15;
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.zoomToCursor = true;

    this.hemi = new THREE.HemisphereLight(0xfffaf0, 0x9a8a78, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0dc, 2.2);
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.storeLight = new THREE.PointLight(0xfff1dc, 0, 14, 1.0);
    this.scene.add(this.storeLight);

    this.envGroup = new THREE.Group(); this.scene.add(this.envGroup);
    this.storeGroup = new THREE.Group(); this.scene.add(this.storeGroup);
    this.fixGroup = new THREE.Group(); this.scene.add(this.fixGroup);
    this.agentGroup = new THREE.Group(); this.scene.add(this.agentGroup);
    this.fxGroup = new THREE.Group(); this.scene.add(this.fxGroup);
    this.fixtureObjs = new Map();
    this.walls = [];
    this.dirtObjs = [];
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.shadowTex = canvasTex(64, 64, (x, w, h) => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
    this.shadowMat = new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false });
    this.applyQuality();
    this.buildEnvironment();
    this.buildStore();
    this.syncFixtures();
  }

  applyQuality() {
    const s = this.state.settings, high = s.quality === 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25));
    this.renderer.shadowMap.enabled = !!s.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = !!s.shadows;
    const sz = high ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== sz) { this.sun.shadow.mapSize.set(sz, sz); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  }
  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ═════════ 街景 ═════════
  buildEnvironment() {
    const g = this.envGroup; g.clear();
    const D = STORE_FRONT_Z;
    const grassTex = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#8cc56a'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(60,120,40,.18)' : 'rgba(200,240,150,.15)'; x.fillRect(Math.random() * w, Math.random() * h, 3, 6); }
    }, true);
    grassTex.repeat.set(30, 30);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(6, -0.03, 0); ground.receiveShadow = true; g.add(ground);
    const paveTex = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#d8cfc2'; x.fillRect(0, 0, w, h);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) {
        const off = r % 2 ? 32 : 0; x.fillStyle = ['#e3dbcf', '#d4cabb', '#ddd3c6', '#cfc4b4'][(r * 3 + c) % 4];
        x.fillRect(c * 64 - off + 2, r * 32 + 2, 60, 28);
      }
    }, true);
    paveTex.repeat.set(20, 1.5);
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(60, 4.2), new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.9 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(6, 0.004, D + 1.9); plaza.receiveShadow = true; g.add(plaza);
    const roadTex = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#5b5f66'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},.06)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    }, true);
    roadTex.repeat.set(30, 3);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(160, 8), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85 }));
    road.rotation.x = -Math.PI / 2; road.position.set(6, 0.002, D + 8.2); road.receiveShadow = true; g.add(road);
    for (let i = -40; i < 50; i += 3) g.add(mesh(G.box, mat(0xf5f5f5), i, 0.008, D + 8.2, 1.6, 0.01, 0.14));
    for (let i = 0; i < 7; i++) g.add(mesh(G.box, mat(0xf5f5f5), DOOR_X - 2.5 + i * 0.85, 0.01, D + 8.2, 0.5, 0.01, 6.6));
    g.add(rb(80, 0.18, 0.3, 0xbdb7ab, 6, 0.09, D + 4.1, 0.04));
    const bdefs = [[-9, -1, 7, 9, 7, 0xe8d8c4], [-17, 0, 7, 8, 4.5, 0xc9d8e2], [24, 0, 7, 9, 9, 0xf3e0c2], [32, -1, 7, 7, 5.5, 0xd9e8c8],
      [-6, -14, 11, 7, 12, 0xd0d6e0], [8, -14, 13, 7, 7, 0xf0d6d6], [23, -13, 9, 7, 14, 0xe6dccb],
      [-12, D + 15, 9, 7, 6, 0xd8cdbf], [0, D + 15, 10, 7, 10, 0xc8dbe6], [13, D + 15, 9, 7, 5, 0xf2e3c8], [26, D + 15, 11, 7, 8.5, 0xdcd3e6]];
    this.winMats = [];
    for (const [x, z, w, d, h, col] of bdefs) g.add(this.makeBuilding(x, z, w, d, h, col, z > D ? -1 : 1));
    for (const [x, z, s] of [[-3.2, D + 1.2, 1], [-6.5, D + 1.2, 1.1], [13.5, D + 1.2, 1], [17, D + 1.2, 0.9], [21, D + 1.2, 1.1], [-4, -3, 1.2], [-3.5, 2.5, 1], [-14, D + 1.3, 1], [27, D + 1.3, 1]]) g.add(this.makeTree(x, z, s));
    this.lampMats = [];
    for (const x of [-2.2, 10, 19.5]) {
      const lamp = new THREE.Group();
      lamp.add(mesh(G.cyl, mat(0x455a64, { metalness: 0.5, roughness: 0.4 }), 0, 1.9, 0, 0.12, 3.8, 0.12));
      lamp.add(rb(0.9, 0.1, 0.22, 0x455a64, 0.35, 3.8, 0, 0.04));
      const lm = new THREE.MeshStandardMaterial({ color: 0xfff8e1, emissive: 0x000000 }); this.lampMats.push(lm);
      lamp.add(mesh(G.sph, lm, 0.7, 3.7, 0, 0.3, 0.18, 0.3));
      lamp.position.set(x, 0, D + 3.8); g.add(lamp);
    }
    g.add(this.makeVending(-1.9, D + 0.55));
    const bench = new THREE.Group();
    bench.add(rb(1.6, 0.08, 0.45, 0xb07a4a, 0, 0.45, 0, 0.03)); bench.add(rb(1.6, 0.35, 0.06, 0xb07a4a, 0, 0.7, -0.2, 0.03));
    for (const sx of [-0.65, 0.65]) bench.add(rb(0.08, 0.45, 0.4, 0x37474f, sx, 0.22, 0, 0.02));
    bench.position.set(6.5, 0, D + 3.3); bench.rotation.y = Math.PI; g.add(bench);
    for (const [x, c] of [[9, 0x26a69a], [9.7, 0xef5350]]) g.add(this.makeBike(x, D + 3.3, c));
    for (const [x, c] of [[-1.0, 0x1e88e5], [-0.55, 0x43a047]]) { g.add(rb(0.4, 0.75, 0.4, c, x, 0.38, D + 0.35, 0.06)); g.add(rb(0.42, 0.06, 0.42, 0xeceff1, x, 0.78, D + 0.35, 0.02)); }
    g.add(this.makeCar(16, D + 6.4, 0xf4f4f4)); g.add(this.makeCar(-9, D + 10, 0xe57373, Math.PI));
  }
  makeBuilding(x, z, w, d, h, col, front) {
    const b = new THREE.Group();
    b.add(rb(w, h, d, col, 0, h / 2, 0, 0.08));
    b.add(rb(w + 0.2, 0.25, d + 0.2, shadeHex(col, 0.85), 0, h + 0.12, 0, 0.05));
    const glass = mat(0x9ec9e6, { roughness: 0.15, metalness: 0.2, emissive: 0x000000 });
    this.winMats.push(glass);
    for (let yy = 1.3; yy < h - 0.7; yy += 1.7) for (let xx = -w / 2 + 1; xx < w / 2 - 0.6; xx += 1.5) {
      b.add(rb(0.95, 1.05, 0.08, 0xf5f5f5, xx, yy, front * (d / 2 + 0.02), 0.02));
      b.add(mesh(G.box, glass, xx, yy, front * (d / 2 + 0.06), 0.8, 0.9, 0.02));
    }
    b.position.set(x, 0, z);
    return b;
  }
  makeTree(x, z, s = 1) {
    const t = new THREE.Group();
    t.add(mesh(G.cyl, mat(0x7b5236), 0, 0.7, 0, 0.22, 1.4, 0.22));
    for (const [lx, ly, lz, r, c] of [[0, 1.9, 0, 1.0, 0x5aa548], [0.45, 1.6, 0.2, 0.7, 0x4c9a3c], [-0.4, 1.7, -0.2, 0.75, 0x6bb653], [0.1, 2.5, -0.1, 0.7, 0x5aa548]]) t.add(mesh(G.sph, mat(c, { roughness: 0.85 }), lx, ly, lz, r * 1.6, r * 1.45, r * 1.6));
    t.add(rb(0.9, 0.25, 0.9, 0x9e9e9e, 0, 0.12, 0, 0.06));
    t.position.set(x, 0, z); t.scale.setScalar(s);
    return t;
  }
  makeVending(x, z) {
    const v = new THREE.Group();
    v.add(rb(0.95, 1.85, 0.7, 0xd84343, 0, 0.93, 0, 0.06));
    v.add(rb(0.8, 1.0, 0.05, 0xf5f5f5, 0, 1.25, 0.34, 0.02, { emissive: 0x666666 }));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) v.add(mesh(G.cyl, mat([0x1e88e5, 0xffb300, 0x43a047, 0x8e24aa, 0xf4511e][c]), -0.3 + c * 0.15, 0.95 + r * 0.3, 0.37, 0.09, 0.18, 0.09));
    v.add(rb(0.5, 0.15, 0.05, 0x263238, 0, 0.35, 0.34, 0.02));
    v.position.set(x, 0, z);
    return v;
  }
  makeBike(x, z, col) {
    const b = new THREE.Group();
    const tire = new THREE.TorusGeometry(0.28, 0.04, 6, 16);
    for (const sx of [-0.45, 0.45]) b.add(mesh(tire, mat(0x222222), sx, 0.3, 0));
    const frame = mesh(G.cyl, mat(col, { metalness: 0.3, roughness: 0.4 }), 0, 0.5, 0, 0.05, 0.95, 0.05); frame.rotation.z = Math.PI / 2; b.add(frame);
    b.add(mesh(G.cyl, mat(col), 0.35, 0.65, 0, 0.04, 0.5, 0.04)); b.add(rb(0.25, 0.05, 0.12, 0x333333, -0.2, 0.78, 0, 0.02));
    b.position.set(x, 0, z); b.rotation.y = Math.PI / 2 + 0.2;
    return b;
  }
  makeCar(x, z, col, rot = 0) {
    const c = new THREE.Group();
    c.add(rb(3.4, 0.75, 1.6, col, 0, 0.6, 0, 0.25, { roughness: 0.3, metalness: 0.2 }));
    c.add(rb(1.9, 0.6, 1.45, col, -0.2, 1.2, 0, 0.22, { roughness: 0.3, metalness: 0.2 }));
    c.add(rb(1.75, 0.45, 1.5, 0x37474f, -0.2, 1.22, 0, 0.18, { roughness: 0.1, metalness: 0.4 }));
    for (const [wx, wz] of [[-1.1, 0.75], [1.1, 0.75], [-1.1, -0.75], [1.1, -0.75]]) { const w = mesh(G.cyl, mat(0x222222), wx, 0.33, wz, 0.66, 0.25, 0.66); w.rotation.x = Math.PI / 2; c.add(w); }
    c.position.set(x, 0, z); c.rotation.y = rot;
    return c;
  }

  // ═════════ 店面 ═════════
  buildStore() {
    const s = this.state, g = this.storeGroup; g.clear(); this.walls = [];
    const L = STORE_LEVELS[s.level], W = L.W, z0 = L.z0, D = STORE_FRONT_Z, depth = D - z0;
    const styles = [
      { a: '#efe9df', b: '#e4ddd0', grout: '#cfc6b6' },
      { a: '#f7f4ee', b: '#efebe2', grout: '#dcd5c8' },
      { a: '#d9b48a', b: '#cfa77a', grout: '#b48a5e', wood: true },
      { a: '#f4f4f6', b: '#e9e9ee', grout: '#cfd0d8', marble: true },
    ][s.upgrades.floor];
    const ftex = canvasTex(512, 512, (x, w, h) => {
      const n = 4, t = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        x.fillStyle = (i + j) % 2 ? styles.a : styles.b; x.fillRect(i * t, j * t, t, t);
        if (styles.wood) { x.strokeStyle = 'rgba(110,70,30,.18)'; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(i * t, j * t + k * 22 + 6); x.bezierCurveTo(i * t + 40, j * t + k * 22, i * t + 80, j * t + k * 22 + 12, i * t + t, j * t + k * 22 + 4); x.stroke(); } }
        if (styles.marble) { x.strokeStyle = 'rgba(140,140,160,.22)'; x.lineWidth = 2; x.beginPath(); x.moveTo(i * t + 10, j * t); x.bezierCurveTo(i * t + 60, j * t + 50, i * t + 30, j * t + 90, i * t + t, j * t + t); x.stroke(); }
        const grd = x.createLinearGradient(i * t, j * t, i * t + t, j * t + t); grd.addColorStop(0, 'rgba(255,255,255,.18)'); grd.addColorStop(1, 'rgba(0,0,0,.03)');
        x.fillStyle = grd; x.fillRect(i * t, j * t, t, t);
      }
      x.strokeStyle = styles.grout; x.lineWidth = 3;
      for (let i = 0; i <= n; i++) { x.beginPath(); x.moveTo(i * t, 0); x.lineTo(i * t, h); x.stroke(); x.beginPath(); x.moveTo(0, i * t); x.lineTo(w, i * t); x.stroke(); }
    }, true);
    ftex.repeat.set(W / 4, depth / 4);
    this.floorMat = new THREE.MeshStandardMaterial({ map: ftex, roughness: styles.marble ? 0.25 : 0.5, emissive: 0x000000 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, depth), this.floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0.02, z0 + depth / 2); floor.receiveShadow = true;
    g.add(floor);
    g.add(rb(W + 0.5, 0.1, depth + 0.5, 0xa8a49c, W / 2, -0.03, z0 + depth / 2, 0.04));
    const wallH = 2.7;
    const wallTex = canvasTex(256, 256, (x, w, h) => {
      x.fillStyle = '#f7f1e6'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#e8ddcb'; x.fillRect(0, h * 0.62, w, h * 0.38);
      x.fillStyle = '#d7c8b0'; x.fillRect(0, h * 0.6, w, 6);
      x.strokeStyle = 'rgba(160,140,110,.25)'; for (let i = 0; i < w; i += 32) { x.beginPath(); x.moveTo(i, h * 0.62); x.lineTo(i, h); x.stroke(); }
    }, true);
    const addWall = (x1, z1, x2, z2, nx, nz, kind) => {
      const len = Math.hypot(x2 - x1, z2 - z1), horiz = z1 === z2;
      const grp = new THREE.Group();
      let wall;
      if (kind === 'glass') {
        wall = new THREE.Group();
        const gm = new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 });
        const pane = mesh(G.box, gm, 0, 0.5, 0, horiz ? len : 0.06, 1, horiz ? 0.06 : len); pane.castShadow = false; wall.add(pane);
        const n = Math.max(1, Math.round(len / 1.5));
        for (let i = 0; i <= n; i++) {
          const t = -len / 2 + i * (len / n);
          wall.add(mesh(G.box, mat(0x37474f, { metalness: 0.5, roughness: 0.35 }), horiz ? t : 0, 0.5, horiz ? 0 : t, horiz ? 0.08 : 0.1, 1, horiz ? 0.1 : 0.08));
        }
        wall.scale.y = wallH;
      } else {
        const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(len / 2, 1);
        wall = new THREE.Mesh(G.box, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
        wall.scale.set(horiz ? len : 0.2, wallH, horiz ? 0.2 : len); wall.position.y = wallH / 2; wall.castShadow = true; wall.receiveShadow = true;
      }
      grp.add(wall);
      grp.add(rb(horiz ? len + 0.05 : 0.26, 0.3, horiz ? 0.26 : len + 0.05, 0x2e5a87, 0, 0.15, 0, 0.04));
      const top = rb(horiz ? len + 0.1 : 0.3, 0.22, horiz ? 0.3 : len + 0.1, 0xf6c344, 0, wallH - 0.1, 0, 0.05); grp.add(top);
      grp.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
      grp.userData = { nx, nz, wall, top, kind, decor: [] };
      g.add(grp); this.walls.push(grp);
      return grp;
    };
    const back = addWall(0, z0, W, z0, 0, -1);
    const left = addWall(0, z0, 0, D, -1, 0);
    const right = addWall(W, z0, W, D, 1, 0);
    if (DOOR_X > 0) addWall(0, D, DOOR_X, D, 0, 1, 'glass');
    addWall(DOOR_X + 1, D, W, D, 0, 1, 'glass');
    // AI 繪製的海報
    const addPoster = (wallGrp, px, pz, ry, file) => {
      const frame = new THREE.Group();
      frame.add(rb(0.86, 1.18, 0.04, 0xffffff, 0, 0, -0.025, 0.02));
      const p = new THREE.Mesh(G.plane, new THREE.MeshStandardMaterial({ map: loadTex(`art/posters/${file}.webp`), roughness: 0.6 }));
      p.scale.set(0.78, 1.1, 1); frame.add(p);
      frame.position.set(px, 1.75, pz); frame.rotation.y = ry;
      g.add(frame); wallGrp.userData.decor.push(frame);
    };
    addPoster(left, 0.13, z0 + depth * 0.35, Math.PI / 2, 'p1');
    addPoster(left, 0.13, z0 + depth * 0.7, Math.PI / 2, 'p2');
    addPoster(right, W - 0.13, z0 + depth * 0.62, -Math.PI / 2, 'p3');
    if (W > 9) addPoster(back, W * 0.62, z0 + 0.13, 0, 'p4');
    const clock = new THREE.Group();
    clock.add(mesh(G.cyl, mat(0xffffff), 0, 0, 0, 0.5, 0.06, 0.5)); clock.add(mesh(G.cyl, mat(0x1f4e79), 0, -0.01, 0, 0.56, 0.05, 0.56));
    clock.rotation.x = Math.PI / 2; clock.position.set(W * 0.5, 2.25, z0 + 0.14); g.add(clock); back.userData.decor.push(clock);
    for (const dx of [0, 1]) g.add(rb(0.12, 2.4, 0.2, 0x37474f, DOOR_X + dx, 1.2, D, 0.03));
    g.add(rb(1.12, 0.12, 0.22, 0x37474f, DOOR_X + 0.5, 2.4, D, 0.03));
    const doorGlass = mesh(G.box, new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.25, roughness: 0.05 }), DOOR_X + 0.25, 1.15, D + 0.05, 0.42, 2.2, 0.03);
    doorGlass.castShadow = false; g.add(doorGlass);
    g.add(rb(1.1, 0.03, 0.9, 0x455a64, DOOR_X + 0.5, 0.02, D + 0.5, 0.02));
    // 雨遮與招牌
    const awnTex = canvasTex(256, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#2e6da4'; x.fillRect(i * 32, 0, 32, h); } });
    awnTex.wrapS = THREE.RepeatWrapping; awnTex.repeat.set(W / 2, 1);
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.1), new THREE.MeshStandardMaterial({ map: awnTex, side: THREE.DoubleSide, roughness: 0.8 }));
    awn.position.set(W / 2, 2.45, D + 0.55); awn.rotation.x = -Math.PI / 2 + 0.5; awn.castShadow = true;
    const signTex = this.makeSignTexture();
    this.signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.15, roughness: 0.4 });
    const fascia = new THREE.Mesh(G.box, [mat(0x1f4e79), mat(0x1f4e79), mat(0x1f4e79), mat(0x1f4e79), this.signMat, mat(0x1f4e79)]);
    fascia.scale.set(W + 0.3, 0.75, 0.3); fascia.position.set(W / 2, 3.05, D + 0.05);
    const fasciaGrp = new THREE.Group(); fasciaGrp.add(fascia); fasciaGrp.add(awn); fasciaGrp.userData = { nx: 0, nz: 1, fascia: true };
    g.add(fasciaGrp); this.walls.push(fasciaGrp);
    const lvl = s.upgrades.sign;
    const pole = new THREE.Group();
    pole.add(mesh(G.cyl, mat(0x78909c, { metalness: 0.5, roughness: 0.35 }), 0, 1.9, 0, 0.18, 3.8, 0.18));
    const pylonTex = this.makePylonTexture(lvl);
    this.pylonMat = new THREE.MeshStandardMaterial({ map: pylonTex, emissive: 0xffffff, emissiveMap: pylonTex, emissiveIntensity: 0.2, roughness: 0.4 });
    const ph = 1.5 + lvl * 0.35;
    const panel = new THREE.Mesh(rgeo(1.35, ph, 0.3, 0.08), [mat(0xffffff), mat(0xffffff), mat(0xffffff), mat(0xffffff), this.pylonMat, this.pylonMat]);
    panel.position.y = 3.8 + ph / 2 - 0.3; panel.castShadow = true;
    pole.add(panel);
    pole.position.set(-0.9, 0, D + 1.4);
    g.add(pole);
    const ab = new THREE.Group();
    const abTex = canvasTex(128, 160, (x, w, h) => {
      x.fillStyle = '#2b2b2b'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c69c6d'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
      x.fillStyle = '#fff'; x.font = `bold 22px ${FONT}`; x.textAlign = 'center'; x.fillText('今日推薦', w / 2, 40);
      x.fillStyle = '#ffd54f'; x.font = `bold 26px ${FONT}`; x.fillText('熱拿鐵', w / 2, 82); x.fillStyle = '#80deea'; x.font = `bold 20px ${FONT}`; x.fillText('$55', w / 2, 120);
    });
    const board = rb(0.66, 0.86, 0.05, 0xc69c6d, 0, 0.44, 0.11, 0.02); board.rotation.x = -0.25; ab.add(board);
    const abp = new THREE.Mesh(G.plane, new THREE.MeshStandardMaterial({ map: abTex })); abp.scale.set(0.6, 0.8, 1); abp.position.set(0, 0.45, 0.14); abp.rotation.x = -0.25; ab.add(abp);
    ab.position.set(DOOR_X + 2.3, 0, D + 0.9); g.add(ab);
    g.add(this.makePot(DOOR_X - 0.45, D + 0.45, 0.8)); g.add(this.makePot(DOOR_X + 1.45, D + 0.45, 0.8));
    g.add(rb(0.95, 2.15, 0.08, 0x8d6e63, W - 0.5, 1.08, z0 + 0.12, 0.03));
    g.add(rb(0.6, 0.18, 0.05, 0x43a047, W - 0.5, 2.35, z0 + 0.14, 0.02, { emissive: 0x2e7d32, emissiveIntensity: 0.8 }));
    for (const [bx, bz, by] of [[W + 0.8, z0 + 0.6, 0], [W + 1.45, z0 + 0.5, 0], [W + 1.1, z0 + 0.55, 0.5], [W + 1.0, z0 + 1.35, 0]]) {
      g.add(rb(0.6, 0.48, 0.6, 0xc8a06a, bx, 0.25 + by, bz, 0.03));
      g.add(mesh(G.box, mat(0xa98352), bx, 0.5 + by, bz, 0.12, 0.005, 0.61));
    }
    this.storeLight.position.set(W / 2, 3.2, z0 + depth / 2); this.storeLight.distance = Math.max(W, depth) * 1.3;
    this.storeBounds = { W, z0, D };
    const sc = this.sun.shadow.camera, ext = Math.max(W, depth) * 0.9 + 6;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
    this.updateWalls(true);
  }
  makePot(x, z, s = 1) {
    const p = new THREE.Group();
    p.add(mesh(G.cyl, mat(0xe7d9c7), 0, 0.22, 0, 0.42, 0.45, 0.42));
    for (const [lx, ly, lz, r] of [[0, 0.7, 0, 0.42], [0.15, 0.95, 0.05, 0.3], [-0.12, 0.88, -0.08, 0.3]]) p.add(mesh(G.sph, mat(0x5aa548, { roughness: 0.85 }), lx, ly, lz, r * 1.6, r * 1.8, r * 1.6));
    p.position.set(x, 0, z); p.scale.setScalar(s);
    return p;
  }
  makeSignTexture() {
    const name = this.state.storeName;
    return canvasTex(1024, 128, (x, w, h) => {
      const grd = x.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#2e6da4'); grd.addColorStop(1, '#1f4e79');
      x.fillStyle = grd; x.fillRect(0, 0, w, h);
      x.fillStyle = '#f6c344'; x.fillRect(0, h - 16, w, 16);
      x.fillStyle = '#ffd54f'; x.beginPath(); x.arc(70, 56, 36, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#ffd54f'; x.lineWidth = 5; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(70 + Math.cos(a) * 42, 56 + Math.sin(a) * 42); x.lineTo(70 + Math.cos(a) * 52, 56 + Math.sin(a) * 52); x.stroke(); }
      x.fillStyle = '#1f4e79'; x.font = `bold 34px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('日', 70, 58);
      x.fillStyle = '#ffffff'; x.font = `bold 66px ${FONT}`; x.textAlign = 'left'; x.fillText(name, 140, 58);
      x.font = `bold 30px ${FONT}`; x.textAlign = 'right'; x.fillStyle = '#ffe082'; x.fillText('OPEN 24H', w - 30, 58);
    });
  }
  makePylonTexture(lvl) {
    return canvasTex(256, 384, (x, w, h) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
      const grd = x.createLinearGradient(0, 0, 0, h * 0.62); grd.addColorStop(0, '#2e6da4'); grd.addColorStop(1, '#1f4e79');
      x.fillStyle = grd; x.fillRect(0, 0, w, h * 0.62);
      x.fillStyle = '#ffd54f'; x.beginPath(); x.arc(w / 2, 112, 70, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1f4e79'; x.font = `bold 76px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('日', w / 2, 116);
      x.fillStyle = '#fff'; x.font = `bold 34px ${FONT}`; x.fillText(lvl >= 2 ? '24H 營業' : '營業中', w / 2, 212);
      x.fillStyle = '#f6c344'; x.fillRect(0, h * 0.62, w, 22); x.fillStyle = '#ff8a65'; x.fillRect(0, h * 0.62 + 22, w, 10);
      x.fillStyle = '#1f4e79'; x.font = `bold 40px ${FONT}`; x.fillText(this.state.storeName.slice(0, 5), w / 2, h * 0.82);
    });
  }

  // 面向鏡頭的牆自動變矮
  updateWalls(instant) {
    const cam = this.camera.position, tgt = this.controls.target;
    const vx = cam.x - tgt.x, vz = cam.z - tgt.z, len = Math.hypot(vx, vz) || 1;
    for (const w of this.walls) {
      const { nx, nz, wall, top, fascia, decor } = w.userData;
      const facing = (nx * vx + nz * vz) / len > 0.25;
      if (fascia) { w.visible = !facing || (cam.y - tgt.y) < len * 0.75; continue; }
      const target = facing ? 0.3 : 2.7;
      const nv = instant ? target : wall.scale.y + (target - wall.scale.y) * 0.25;
      wall.scale.y = nv; if (wall.isMesh) wall.position.y = nv / 2;
      top.position.y = nv - 0.1;
      if (decor) for (const d of decor) d.visible = nv > 2.2;
    }
  }

  // ═════════ 設備 ═════════
  syncFixtures() {
    const ids = new Set(this.state.fixtures.map(f => f.id));
    for (const [id, o] of this.fixtureObjs) if (!ids.has(id)) { this.fixGroup.remove(o); this.fixtureObjs.delete(id); }
    for (const f of this.state.fixtures) {
      let o = this.fixtureObjs.get(f.id);
      if (!o || o.userData.type !== f.type) {
        if (o) this.fixGroup.remove(o);
        o = this.makeFixture(f.type); o.userData.fid = f.id; o.userData.type = f.type;
        this.fixGroup.add(o); this.fixtureObjs.set(f.id, o);
      }
      this.placeObj(o, f.type, f.x, f.z, f.r);
      this.updateFixtureStock(f);
    }
  }
  placeObj(o, type, x, z, r) {
    const [w, d] = footprint(type, r);
    o.position.set(x + w / 2, 0, z + d / 2);
    o.rotation.y = r * Math.PI / 2;
  }
  makeFixture(type, ghost = false) {
    const def = FIXTURES[type], g = new THREE.Group();
    const W = def.w;
    const slots = [];
    const metal = mat(0xdfe5ea, { metalness: 0.35, roughness: 0.35 });
    if (type === 'shelf') {
      g.add(rb(W - 0.06, 1.55, 0.1, 0xf3f5f7, 0, 0.8, -0.38, 0.02));
      for (const sx of [-1, 1]) g.add(rb(0.08, 1.65, 0.82, 0xc5ced6, sx * (W / 2 - 0.06), 0.83, 0, 0.02));
      g.add(rb(W - 0.04, 0.16, 0.82, 0x2e6da4, 0, 0.08, 0, 0.03));
      for (const y of [0.18, 0.62, 1.06]) {
        g.add(mesh(G.box, metal, 0, y, -0.01, W - 0.14, 0.04, 0.74));
        g.add(rb(W - 0.14, 0.07, 0.03, 0xf6c344, 0, y - 0.02, 0.37, 0.01));
        for (let i = 0; i < 8; i++) slots.push({ pos: [-W / 2 + 0.22 + i * ((W - 0.44) / 7), y + 0.02, 0.06], scale: [0.18, 0.3, 0.3] });
      }
      g.add(rb(W - 0.04, 0.2, 0.06, 0x1f4e79, 0, 1.7, -0.34, 0.03));
    } else if (type === 'fridge') {
      g.add(rb(W - 0.04, 2.15, 0.86, 0xf4f6f8, 0, 1.075, -0.04, 0.05));
      g.add(mesh(G.box, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 0.55, roughness: 0.5 }), 0, 1.1, -0.36, W - 0.26, 1.72, 0.04));
      for (const y of [0.35, 0.92, 1.49]) {
        g.add(mesh(G.box, mat(0xc9d3dc, { metalness: 0.4, roughness: 0.3 }), 0, y - 0.03, 0.02, W - 0.3, 0.03, 0.62));
        for (let i = 0; i < 10; i++) slots.push({ pos: [-W / 2 + 0.26 + i * ((W - 0.52) / 9), y, 0.12], scale: [0.14, 0.34, 0.14] });
      }
      const glass = mesh(G.box, new THREE.MeshStandardMaterial({ color: 0xdff1ff, transparent: true, opacity: 0.16, roughness: 0.02, metalness: 0.1 }), 0, 1.1, 0.39, W - 0.2, 1.82, 0.03);
      glass.castShadow = false; g.add(glass);
      g.add(rb(0.05, 1.82, 0.05, 0xb0bec5, 0, 1.1, 0.41, 0.02));
      for (const sx of [-0.12, 0.12]) g.add(rb(0.03, 0.5, 0.05, 0x90a4ae, sx, 1.1, 0.44, 0.015));
      g.add(rb(W - 0.04, 0.24, 0.08, 0x2e6da4, 0, 2.03, 0.4, 0.03, { emissive: 0x1a4a7a, emissiveIntensity: 0.4 }));
    } else if (type === 'chiller') {
      g.add(rb(W - 0.04, 0.78, 0.86, 0xf4f6f8, 0, 0.39, 0, 0.05));
      g.add(rb(W - 0.04, 1.75, 0.26, 0xf4f6f8, 0, 0.875, -0.3, 0.04));
      g.add(rb(W - 0.04, 0.12, 0.62, 0xf4f6f8, 0, 1.7, -0.12, 0.03));
      g.add(mesh(G.box, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4f4, emissiveIntensity: 0.4 }), 0, 1.63, -0.12, W - 0.2, 0.02, 0.5));
      g.add(mesh(G.box, metal, 0, 1.17, -0.08, W - 0.2, 0.03, 0.5));
      g.add(rb(W - 0.04, 0.14, 0.05, 0xf05a7a, 0, 0.72, 0.42, 0.03));
      g.add(rb(W - 0.04, 0.2, 0.06, 0xf05a7a, 0, 1.84, -0.12, 0.03, { emissive: 0x802030, emissiveIntensity: 0.3 }));
      for (const [y, z] of [[0.8, 0.12], [1.19, -0.1]]) for (let i = 0; i < 8; i++) slots.push({ pos: [-W / 2 + 0.2 + i * ((W - 0.4) / 7), y, z], scale: [0.2, 0.2, 0.22] });
    } else if (type === 'hotcase') {
      g.add(rb(0.95, 0.9, 0.85, 0xa1887f, 0, 0.45, 0, 0.05));
      g.add(rb(0.92, 0.1, 0.82, 0xb0bec5, 0, 0.95, 0, 0.03, { metalness: 0.5 }));
      g.add(mesh(G.box, new THREE.MeshStandardMaterial({ color: 0xffb74d, emissive: 0xff8f00, emissiveIntensity: 0.35 }), 0, 1.0, 0, 0.84, 0.02, 0.74));
      const glass = mesh(G.box, new THREE.MeshStandardMaterial({ color: 0xfff3e0, transparent: true, opacity: 0.22, roughness: 0.02 }), 0, 1.25, 0, 0.9, 0.48, 0.78);
      glass.castShadow = false; g.add(glass);
      g.add(rb(0.92, 0.06, 0.8, 0x6d4c41, 0, 1.5, 0, 0.02));
      g.add(rb(0.6, 0.2, 0.05, 0xff7043, 0, 1.66, 0.25, 0.03, { emissive: 0xbf360c, emissiveIntensity: 0.5 }));
      for (let i = 0; i < 12; i++) slots.push({ pos: [-0.32 + (i % 4) * 0.21, 1.02, -0.24 + Math.floor(i / 4) * 0.24], scale: [0.16, 0.16, 0.16] });
    } else if (type === 'coffee') {
      g.add(rb(0.95, 0.88, 0.85, 0x6d4c41, 0, 0.44, 0, 0.05));
      g.add(rb(0.98, 0.06, 0.88, 0xefebe9, 0, 0.9, 0, 0.02));
      g.add(rb(0.55, 0.78, 0.5, 0x263238, -0.12, 1.32, -0.12, 0.06, { metalness: 0.3, roughness: 0.35 }));
      g.add(rb(0.35, 0.15, 0.04, 0x80deea, -0.12, 1.5, 0.14, 0.02, { emissive: 0x26c6da, emissiveIntensity: 0.6 }));
      g.add(rb(0.22, 0.05, 0.25, 0x9e9e9e, -0.12, 0.96, 0.06, 0.01));
      for (let i = 0; i < 20; i++) slots.push({ pos: [0.3, 0.93 + (i % 10) * 0.045, 0.22 - Math.floor(i / 10) * 0.22], scale: [0.14, 0.05, 0.14] });
    } else if (type === 'counter') {
      g.add(rb(W - 0.04, 0.98, 0.78, 0xb08968, 0, 0.49, 0, 0.05));
      g.add(rb(W + 0.04, 0.07, 0.9, 0xf5f1ea, 0, 1.01, 0, 0.03));
      g.add(rb(W - 0.04, 0.22, 0.05, 0x2e6da4, 0, 0.72, 0.4, 0.03));
      g.add(rb(0.42, 0.22, 0.34, 0x37474f, -0.38, 1.15, -0.06, 0.04));
      const scr = rb(0.42, 0.3, 0.05, 0x263238, -0.38, 1.45, 0.1, 0.03); scr.rotation.x = -0.3; g.add(scr);
      const scrL = mesh(G.box, new THREE.MeshStandardMaterial({ color: 0x4fc3f7, emissive: 0x29b6f6, emissiveIntensity: 0.7 }), -0.38, 1.46, 0.13, 0.34, 0.22, 0.01); scrL.rotation.x = -0.3; g.add(scrL);
      g.add(rb(0.46, 0.5, 0.36, 0xeeeeee, 0.45, 1.29, -0.16, 0.04));
      g.add(mesh(G.box, new THREE.MeshStandardMaterial({ color: 0xfff3e0, emissive: 0xffcc80, emissiveIntensity: 0.4, transparent: true, opacity: 0.7 }), 0.45, 1.3, 0.03, 0.4, 0.4, 0.02));
      for (let i = 0; i < 4; i++) g.add(rb(0.1, 0.12, 0.08, [0xff7043, 0x66bb6a, 0xffca28, 0xab47bc][i], 0.25 + i * 0.12, 1.11, 0.3, 0.02));
    } else if (type === 'plant') {
      g.add(mesh(G.cyl, mat(0xe7d9c7), 0, 0.25, 0, 0.5, 0.5, 0.5));
      g.add(mesh(G.cyl, mat(0x6d4c41), 0, 0.49, 0, 0.44, 0.03, 0.44));
      for (const [lx, ly, lz, r] of [[0, 0.9, 0, 0.45], [0.18, 1.2, 0.05, 0.32], [-0.15, 1.1, -0.1, 0.33], [0.05, 1.42, -0.05, 0.25]]) g.add(mesh(G.sph, mat(0x5aa548, { roughness: 0.85 }), lx, ly, lz, r * 1.6, r * 1.8, r * 1.6));
    } else if (type === 'table') {
      g.add(mesh(G.cyl, mat(0xd7a86e), 0, 0.73, 0, 0.75, 0.05, 0.75));
      g.add(mesh(G.cyl, mat(0x5d4037), 0, 0.36, 0, 0.07, 0.72, 0.07));
      g.add(mesh(G.cyl, mat(0x5d4037), 0, 0.02, 0, 0.4, 0.04, 0.4));
      for (const [cx, cz, ry] of [[-0.34, 0.26, 0], [0.34, -0.26, Math.PI]]) {
        const ch = new THREE.Group();
        ch.add(rb(0.34, 0.05, 0.34, 0xef8354, 0, 0.45, 0, 0.02)); ch.add(rb(0.34, 0.36, 0.05, 0xef8354, 0, 0.65, 0.16, 0.02));
        for (const [lx, lz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) ch.add(mesh(G.cyl, mat(0x5d4037), lx, 0.22, lz, 0.04, 0.44, 0.04));
        ch.position.set(cx, 0, cz); ch.rotation.y = ry; g.add(ch);
      }
      g.add(mesh(G.cyl, mat(0xffffff), 0.1, 0.8, 0.05, 0.12, 0.1, 0.12));
    }
    if (def.cats) {
      const lbl = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ transparent: true }));
      lbl.scale.set(0.6, 0.28, 1);
      lbl.position.set(0, type === 'fridge' ? 2.03 : type === 'shelf' ? 1.7 : type === 'chiller' ? 1.84 : 1.82, type === 'fridge' ? 0.45 : type === 'shelf' ? -0.3 : type === 'chiller' ? -0.08 : 0.3);
      g.add(lbl); g.userData.label = lbl;
    }
    g.userData.slots = slots;
    g.userData.inst = new Map();
    if (ghost) g.traverse(o => { if (o.isMesh) { const ms = [].concat(o.material).map(m => { const c = m.clone(); c.transparent = true; c.opacity = 0.55; return c; }); o.material = ms.length === 1 ? ms[0] : ms; o.castShadow = false; } });
    return g;
  }
  updateFixtureStock(f) {
    const o = this.fixtureObjs.get(f.id); if (!o) return;
    const lbl = o.userData.label;
    if (lbl && lbl.userData.cat !== f.cat) {
      lbl.userData.cat = f.cat;
      const c = CATEGORIES[f.cat];
      lbl.material.map = canvasTex(160, 72, (x, w, h) => {
        x.fillStyle = hex(c.color); x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, 16); x.fill();
        x.fillStyle = '#fff'; x.font = `bold 34px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(c.name, w / 2, h / 2 + 2);
      });
      lbl.material.needsUpdate = true;
    }
    const slots = o.userData.slots; if (!slots.length) return;
    const keys = Object.keys(f.stock).filter(k => f.stock[k] > 0).sort();
    const total = keys.reduce((n, k) => n + f.stock[k], 0);
    const order = o.userData.order || (o.userData.order = frontFirst(slots));
    // 每款商品分到一段連續的格子（同款擺在一起），格子從前排開始顯示
    const byPid = new Map();
    let start = 0;
    const segLen = keys.map(k => Math.max(f.stock[k], Math.round(slots.length * f.stock[k] / Math.max(1, total))));
    keys.forEach((pid, i) => {
      const seg = [];
      for (let k = start; k < Math.min(slots.length, start + segLen[i]); k++) seg.push(k);
      start += segLen[i];
      const segSet = new Set(seg);
      byPid.set(pid, order.filter(s => segSet.has(s)).slice(0, f.stock[pid]));
    });
    for (const [pid, im] of o.userData.inst) if (!byPid.has(pid)) im.count = 0;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const [pid, idxs] of byPid) {
      let im = o.userData.inst.get(pid);
      if (!im) {
        im = new THREE.InstancedMesh(productGeo(SHAPE[pid]), productMat(pid), slots.length);
        im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false;
        o.add(im); o.userData.inst.set(pid, im);
      }
      idxs.forEach((si, k) => {
        const sl = slots[si];
        q.setFromAxisAngle(up, (((si * 7919) % 13) / 13 - 0.5) * 0.25);
        m4.compose(v.set(...sl.pos), q, sc.set(...sl.scale)); im.setMatrixAt(k, m4);
      });
      im.count = idxs.length; im.instanceMatrix.needsUpdate = true;
    }
  }

  // ═════════ 人物：AI 繪製的動漫立繪 ═════════
  makePerson(look, outfit) {
    const g = new THREE.Group();
    const id = outfit.sprite || 'student_f';
    const info = SPRITES[id] || { h: 1.5 };
    const tex = loadTex(`art/chars/${id}.webp`);
    const sm = new THREE.SpriteMaterial({ map: tex, alphaTest: 0.35, transparent: true });
    const spr = new THREE.Sprite(sm);
    spr.center.set(0.5, 0.0);
    const h = info.h * (outfit.scale || 1);
    const setAspect = () => { const img = tex.image; const a = img && img.width ? img.width / img.height : 0.5; spr.scale.set(h * a, h, 1); };
    if (tex.image && tex.image.width) setAspect(); else spr.scale.set(h * 0.5, h, 1); // 圖片載入後在 animatePerson 修正比例
    const body = new THREE.Group(); body.add(spr); g.add(body);
    const shadow = new THREE.Mesh(G.plane, this.shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(0.75, 0.75, 1); shadow.position.y = 0.035; g.add(shadow);
    // 手上物品：小圖示
    const icon = (emoji, y) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.emojiTex(emoji), depthTest: true }));
      s.center.set(0.5, 0); s.scale.set(0.34, 0.34, 1); s.position.set(0.32, y, 0.05); s.visible = false; body.add(s); return s;
    };
    const basket = icon('🧺', h * 0.25);
    const carry = icon('📦', h * 0.45);
    g.userData = { body, spr, basket, carry, phase: Math.random() * 6, last: new THREE.Vector3(), h, fixAspect: setAspect };
    return g;
  }
  emojiTex(e) {
    this.emojiCache = this.emojiCache || new Map();
    if (!this.emojiCache.has(e)) this.emojiCache.set(e, canvasTex(96, 96, (x, w, h) => { x.font = `76px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, w / 2, h / 2 + 4); }));
    return this.emojiCache.get(e);
  }
  animatePerson(o, moving, dt, speedMul = 1) {
    const u = o.userData;
    if (!u.spr) return;
    if (u.spr.scale.y > 0 && u.spr.material.map.image && u.spr.material.map.image.width && !u.aspectOk) { u.fixAspect(); u.aspectOk = true; }
    // 依螢幕上的移動方向左右翻轉
    const p = o.position;
    if (moving) {
      const dx = p.x - u.last.x, dz = p.z - u.last.z;
      if (dx * dx + dz * dz > 1e-6) {
        this._right = this._right || new THREE.Vector3();
        this._right.setFromMatrixColumn(this.camera.matrixWorld, 0);
        const sx = dx * this._right.x + dz * this._right.z;
        if (Math.abs(sx) > 0.002) u.flip = sx < 0 ? -1 : 1;
      }
      u.phase += dt * 11 * speedMul;
      const hop = Math.abs(Math.sin(u.phase));
      u.body.position.y = hop * 0.07;
      u.body.scale.set(1 + (1 - hop) * 0.04, 1 - (1 - hop) * 0.04, 1);
      u.spr.material.rotation = Math.sin(u.phase) * 0.05;
    } else {
      u.phase += dt * 2.4;
      u.body.position.y = 0;
      const b = Math.sin(u.phase) * 0.012;
      u.body.scale.set(1 - b, 1 + b, 1);
      u.spr.material.rotation *= 0.8;
    }
    const sx = Math.abs(u.spr.scale.x) * (u.flip || 1);
    u.spr.scale.x = sx;
    u.last.copy(p);
  }

  // ═════════ 髒污 ═════════
  syncDirt() {
    for (const o of this.dirtObjs) this.fxGroup.remove(o);
    this.dirtObjs = [];
    this.dirtGeo = this.dirtGeo || new THREE.CircleGeometry(0.28, 14);
    this.dirtMat = this.dirtMat || new THREE.MeshStandardMaterial({ color: 0x7a6248, transparent: true, opacity: 0.55, roughness: 0.2 });
    for (const d of this.state.dirt) {
      const m = new THREE.Mesh(this.dirtGeo, this.dirtMat);
      m.rotation.x = -Math.PI / 2; m.position.set(d.x + 0.5 + d.ox, 0.03, d.z + 0.5 + d.oz); m.scale.set(1, 0.7, 1);
      this.fxGroup.add(m); this.dirtObjs.push(m);
    }
  }

  // ═════════ 白天 / 黑夜 ═════════
  setTimeOfDay(minOfDay, weather) {
    const h = minOfDay / 60;
    const day = Math.max(0, Math.min(1, (Math.sin((h - 6) / 12 * Math.PI) + 0.15) * 1.4));
    const cloudy = weather === 'rain' ? 0.55 : weather === 'cloudy' ? 0.8 : weather === 'cold' ? 0.85 : 1;
    const sky = new THREE.Color().lerpColors(new THREE.Color(0x101a36), new THREE.Color(weather === 'rain' ? 0x9aa7b4 : 0xaedcff), day);
    if (h > 16.5 && h < 19.5) sky.lerp(new THREE.Color(0xffa36b), 0.4 * Math.sin((h - 16.5) / 3 * Math.PI) * cloudy);
    this.scene.background.copy(sky);
    this.sun.intensity = 0.15 + 2.0 * day * cloudy;
    this.sun.color.setHex(h > 16 && h < 19.5 ? 0xffc890 : 0xfff0dc);
    this.hemi.intensity = 0.25 + 0.6 * day;
    this.scene.environmentIntensity = 0.15 + 0.25 * day;
    const ang = (h - 6) / 12 * Math.PI, b = this.storeBounds;
    this.sun.position.set(b.W / 2 - Math.cos(ang) * 16 - 4, 8 + Math.max(0, Math.sin(ang)) * 16, b.D + 10);
    this.sun.target.position.set(b.W / 2, 0, (b.z0 + b.D) / 2);
    const night = 1 - day;
    this.storeLight.intensity = night * (16 + this.state.upgrades.light * 6);
    this.floorMat.emissive.setRGB(0.3 * night, 0.28 * night, 0.24 * night);
    this.signMat.emissiveIntensity = 0.15 + night * 0.9;
    this.pylonMat.emissiveIntensity = 0.2 + night * (0.6 + this.state.upgrades.sign * 0.15);
    for (const m of this.winMats || []) m.emissive.setRGB(0.6 * night, 0.48 * night, 0.25 * night);
    for (const m of this.lampMats || []) m.emissive.setRGB(night * 1.5, night * 1.35, night * 0.8);
    // 人物立繪在夜晚稍微變暗
    const k = 0.55 + 0.45 * Math.max(day, 0.5);
    for (const a of this.agentGroup.children) a.userData.spr?.material.color.setRGB(k, k, k * 0.98);
  }

  // ═════════ 點擊 ═════════
  ndc(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  }
  pickFloor(clientX, clientY) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.floorPlane, p)) return null;
    return { x: Math.floor(p.x), z: Math.floor(p.z), px: p.x, pz: p.z };
  }
  pickObject(clientX, clientY) {
    this.raycaster.setFromCamera(this.ndc(clientX, clientY), this.camera);
    const hits = this.raycaster.intersectObjects([this.agentGroup, this.fixGroup], true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.fid && !o.userData.agent) o = o.parent;
      if (o) return o.userData.agent ? { agent: o.userData.agent } : { fid: o.userData.fid };
    }
    return null;
  }
  project(v) {
    const p = v.clone().project(this.camera);
    const el = this.renderer.domElement;
    return { x: (p.x + 1) / 2 * el.clientWidth, y: (1 - p.y) / 2 * el.clientHeight, visible: p.z < 1 };
  }
  clampTarget() {
    const t = this.controls.target, b = this.storeBounds;
    const cx = Math.max(-4, Math.min(b.W + 4, t.x)), cz = Math.max(b.z0 - 3, Math.min(b.D + 7, t.z));
    if (cx !== t.x || cz !== t.z) { const dx = cx - t.x, dz = cz - t.z; t.x = cx; t.z = cz; this.camera.position.x += dx; this.camera.position.z += dz; }
    t.y = 0;
  }
  render() { this.renderer.render(this.scene, this.camera); }
}

// 前排、低層優先顯示
function frontFirst(slots) {
  return slots.map((s, i) => i).sort((a, b) => (slots[b].pos[2] - slots[a].pos[2]) || (slots[a].pos[1] - slots[b].pos[1]) || (slots[a].pos[0] - slots[b].pos[0]));
}

// 3D 場景：店面、設備、人物、鏡頭
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { FIXTURES, PRODUCT, STORE_LEVELS, STORE_FRONT_Z, DOOR_X, CATEGORIES } from './data.js';
import { footprint } from './path.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  sph: new THREE.SphereGeometry(0.5, 12, 10),
  cone: new THREE.ConeGeometry(0.5, 1, 8),
  hemi: new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
};
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(G.box, typeof color === 'object' ? color : mat(color, opts));
  m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class World {
  constructor(canvas, state) {
    this.state = state;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe3ff);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
    this.camera.position.set(4, 17, 21);
    this.controls = new OrbitControls(this.camera, canvas);
    const c = this.controls;
    c.target.set(4, 0, 3.5);
    c.enableDamping = true; c.dampingFactor = 0.12;
    c.screenSpacePanning = false;
    c.minDistance = 6; c.maxDistance = 38;
    c.minPolarAngle = 0.25; c.maxPolarAngle = 1.2;
    c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.zoomToCursor = true;

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.6);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.8);
    this.sun.position.set(-8, 20, 10);
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.storeLight = new THREE.PointLight(0xfff4e0, 0, 14, 1.0);
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
    this.applyQuality();
    this.buildEnvironment();
    this.buildStore();
    this.syncFixtures();
  }

  applyQuality() {
    const s = this.state.settings;
    const pr = Math.min(window.devicePixelRatio || 1, s.quality === 'high' ? 2 : 1.25);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = !!s.shadows;
    this.sun.castShadow = !!s.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ── 街景 ──
  buildEnvironment() {
    const g = this.envGroup; g.clear();
    const D = STORE_FRONT_Z;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat(0x9ccc65));
    ground.rotation.x = -Math.PI / 2; ground.position.set(6, -0.02, 0); ground.receiveShadow = true; g.add(ground);
    const sidewalkTex = canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = '#d9d4cc'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#bdb6ab'; x.lineWidth = 4; x.strokeRect(0, 0, w, h);
    });
    sidewalkTex.wrapS = sidewalkTex.wrapT = THREE.RepeatWrapping; sidewalkTex.repeat.set(60, 3);
    const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(60, 3), new THREE.MeshLambertMaterial({ map: sidewalkTex }));
    sidewalk.rotation.x = -Math.PI / 2; sidewalk.position.set(6, 0.005, D + 1.5); sidewalk.receiveShadow = true; g.add(sidewalk);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(140, 7), mat(0x55585e));
    road.rotation.x = -Math.PI / 2; road.position.set(6, 0.003, D + 6.5); road.receiveShadow = true; g.add(road);
    for (let i = -30; i < 40; i += 3) g.add(box(1.6, 0.01, 0.15, 0xf5f5f5, i, 0.01, D + 6.5));
    for (let i = 0; i < 6; i++) g.add(box(0.5, 0.01, 4.5, 0xf5f5f5, DOOR_X + 0.5 - 2 + i * 0.9, 0.012, D + 6.5));
    g.add(box(60, 0.18, 0.2, 0xb0aaa0, 6, 0.09, D + 3));
    // 鄰近建築
    const bcol = [0xd7ccc8, 0xb0bec5, 0xffe0b2, 0xc5e1a5, 0xf8bbd0, 0xbcaaa4];
    let k = 0;
    for (const [x, z, w, d, h] of [[-9, -2, 6, 8, 7], [-16, 1, 6, 6, 4], [24, 0, 7, 8, 9], [31, -2, 6, 6, 5], [-6, -14, 10, 6, 11], [8, -14, 12, 6, 6], [22, -13, 8, 6, 13],
      [-12, D + 13, 8, 6, 6], [0, D + 13, 9, 6, 9], [12, D + 13, 8, 6, 5], [24, D + 13, 10, 6, 8]]) {
      const col = bcol[k++ % bcol.length];
      const b = box(w, h, d, col, x, h / 2, z); g.add(b);
      const winMat = mat(0x90caf9, { emissive: 0x000000 });
      for (let yy = 1.2; yy < h - 0.6; yy += 1.6) for (let xx = -w / 2 + 0.9; xx < w / 2 - 0.5; xx += 1.4) {
        const front = z > D ? -1 : 1;
        const win = new THREE.Mesh(G.box, winMat); win.scale.set(0.8, 0.9, 0.05);
        win.position.set(x + xx, yy, z + front * (d / 2 + 0.01)); g.add(win);
      }
      this.windowMat = winMat;
    }
    // 樹
    for (const [x, z] of [[-3, D + 0.8], [-6, D + 0.8], [13, D + 0.8], [16, D + 0.8], [20, D + 0.8], [-4, -3], [-3.5, 2]]) g.add(this.makeTree(x, z));
    // 路燈
    for (const x of [-2, 9.5, 19]) {
      g.add(box(0.12, 3.6, 0.12, 0x455a64, x, 1.8, D + 2.7));
      g.add(box(0.7, 0.12, 0.25, 0x455a64, x + 0.3, 3.6, D + 2.7));
      const bulb = new THREE.Mesh(G.sph, mat(0xfff59d, { emissive: 0x000000 })); bulb.scale.setScalar(0.25); bulb.position.set(x + 0.6, 3.5, D + 2.7); g.add(bulb);
      this.lampMat = bulb.material;
    }
  }
  makeTree(x, z) {
    const t = new THREE.Group();
    t.add(box(0.25, 1.2, 0.25, 0x6d4c41, 0, 0.6, 0));
    const c = new THREE.Mesh(G.cone, mat(0x43a047)); c.scale.set(1.6, 2, 1.6); c.position.y = 2; c.castShadow = true; t.add(c);
    const c2 = new THREE.Mesh(G.cone, mat(0x388e3c)); c2.scale.set(1.2, 1.5, 1.2); c2.position.y = 2.8; c2.castShadow = true; t.add(c2);
    t.position.set(x, 0, z);
    return t;
  }

  // ── 店面：地板、牆、招牌 ──
  buildStore() {
    const s = this.state, g = this.storeGroup; g.clear(); this.walls = [];
    const L = STORE_LEVELS[s.level], W = L.W, z0 = L.z0, D = STORE_FRONT_Z, depth = D - z0;
    const floorStyles = [['#e4ded3', '#d6cfc2'], ['#f3efe6', '#e6dfd2'], ['#d8b48a', '#c9a074'], ['#f5f5f5', '#e0e0e8']];
    const [c1, c2] = floorStyles[s.upgrades.floor];
    const ftex = canvasTex(128, 128, (x, w, h) => {
      x.fillStyle = c1; x.fillRect(0, 0, w, h);
      x.fillStyle = c2; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2);
      if (s.upgrades.floor === 2) { x.strokeStyle = 'rgba(90,60,30,.25)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, i * 16 + 3); x.lineTo(w, i * 16 + 6); x.stroke(); } }
      if (s.upgrades.floor === 3) { x.strokeStyle = 'rgba(120,120,140,.25)'; x.beginPath(); x.moveTo(10, 0); x.bezierCurveTo(50, 40, 30, 90, 120, 128); x.stroke(); }
      x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 2; x.strokeRect(0, 0, w, h);
    });
    ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(W / 2, depth / 2);
    this.floorMat = new THREE.MeshLambertMaterial({ map: ftex, emissive: 0x000000 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, depth), this.floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0.02, z0 + depth / 2); floor.receiveShadow = true;
    g.add(floor);
    // 外圍地基
    g.add(box(W + 0.5, 0.06, depth + 0.5, 0x8d8d8d, W / 2, 0.0, z0 + depth / 2));
    const wallH = 2.6, wallCol = 0xf2ede4, trim = 0x2e5a87;
    const addWall = (x1, z1, x2, z2, nx, nz, kind) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const grp = new THREE.Group();
      const horiz = z1 === z2;
      const wall = box(horiz ? len : 0.18, wallH, horiz ? 0.18 : len, kind === 'glass' ? 0xffffff : wallCol, 0, wallH / 2, 0);
      if (kind === 'glass') { wall.material = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.28 }); wall.castShadow = false; }
      grp.add(wall);
      const base = box(horiz ? len : 0.22, 0.35, horiz ? 0.22 : len, trim, 0, 0.175, 0); grp.add(base);
      const top = box(horiz ? len : 0.22, 0.25, horiz ? 0.22 : len, 0xf6c344, 0, wallH - 0.12, 0); grp.add(top);
      grp.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
      grp.userData = { nx, nz, wall, top, kind };
      g.add(grp); this.walls.push(grp);
      return grp;
    };
    addWall(0, z0, W, z0, 0, -1);
    addWall(0, z0, 0, D, -1, 0);
    addWall(W, z0, W, D, 1, 0);
    // 前牆：玻璃 + 門
    if (DOOR_X > 0) addWall(0, D, DOOR_X, D, 0, 1, 'glass');
    addWall(DOOR_X + 1, D, W, D, 0, 1, 'glass');
    // 門框
    g.add(box(0.12, 2.3, 0.2, 0x37474f, DOOR_X, 1.15, D));
    g.add(box(0.12, 2.3, 0.2, 0x37474f, DOOR_X + 1, 1.15, D));
    const mat_ = new THREE.Mesh(G.box, mat(0x546e7a)); mat_.scale.set(1, 0.02, 0.8); mat_.position.set(DOOR_X + 0.5, 0.02, D + 0.45); g.add(mat_);
    // 招牌（前方遮陽板）
    const signTex = this.makeSignTexture();
    this.signMat = new THREE.MeshLambertMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.2 });
    const fascia = new THREE.Mesh(G.box, [mat(trim), mat(trim), mat(trim), mat(trim), this.signMat, mat(trim)]);
    fascia.scale.set(W, 0.7, 0.3); fascia.position.set(W / 2, 2.95, D + 0.05);
    const fasciaGrp = new THREE.Group(); fasciaGrp.add(fascia); fasciaGrp.userData = { nx: 0, nz: 1, fascia: true };
    g.add(fasciaGrp); this.walls.push(fasciaGrp);
    // 立式招牌
    const pole = new THREE.Group();
    pole.add(box(0.2, 3.6, 0.2, 0x607d8b, 0, 1.8, 0));
    const lvl = s.upgrades.sign;
    const pylonTex = this.makePylonTexture(lvl);
    this.pylonMat = new THREE.MeshLambertMaterial({ map: pylonTex, emissive: 0xffffff, emissiveMap: pylonTex, emissiveIntensity: 0.25 + lvl * 0.15 });
    const ph = 1.4 + lvl * 0.35;
    const panel = new THREE.Mesh(G.box, [mat(0xffffff), mat(0xffffff), mat(0xffffff), mat(0xffffff), this.pylonMat, this.pylonMat]);
    panel.scale.set(1.3, ph, 0.25); panel.position.y = 3.6 + ph / 2 - 0.3; panel.castShadow = true;
    pole.add(panel);
    pole.position.set(-0.9, 0, D + 1.2);
    g.add(pole);
    // 戶外 A 字立牌
    const aboard = box(0.6, 0.8, 0.08, 0x3e2723, DOOR_X + 2.3, 0.4, D + 0.9); aboard.rotation.x = -0.15; g.add(aboard);
    // 後場門（補貨點）
    const sp = [W - 1, z0];
    g.add(box(0.9, 2.1, 0.06, 0x8d6e63, sp[0] + 0.5, 1.05, z0 + 0.11));
    g.add(box(0.5, 0.18, 0.04, 0x43a047, sp[0] + 0.5, 2.25, z0 + 0.12, { emissive: 0x2e7d32 }));
    const boxes = [[W + 0.8, z0 + 0.6], [W + 1.4, z0 + 0.5], [W + 1.0, z0 + 1.3]];
    for (const [bx, bz] of boxes) g.add(box(0.6, 0.45, 0.6, 0xc8a06a, bx, 0.23, bz));
    this.storeLight.position.set(W / 2, 3.2, z0 + depth / 2); this.storeLight.distance = Math.max(W, depth) * 1.2;
    this.storeBounds = { W, z0, D };
    this.updateWalls();
  }

  makeSignTexture() {
    const name = this.state.storeName;
    return canvasTex(1024, 128, (x, w, h) => {
      const grd = x.createLinearGradient(0, 0, w, 0); grd.addColorStop(0, '#1f4e79'); grd.addColorStop(1, '#2e6da4');
      x.fillStyle = grd; x.fillRect(0, 0, w, h);
      x.fillStyle = '#f6c344'; x.fillRect(0, h - 18, w, 18);
      x.fillStyle = '#ff8a65'; x.fillRect(0, h - 26, w, 8);
      // 太陽標誌
      x.fillStyle = '#ffd54f'; x.beginPath(); x.arc(70, 55, 34, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1f4e79'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('日', 70, 57);
      x.fillStyle = '#ffffff'; x.font = 'bold 64px "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
      x.textAlign = 'left'; x.fillText(name, 130, 58);
      x.font = 'bold 28px sans-serif'; x.textAlign = 'right'; x.fillStyle = '#ffe082'; x.fillText('OPEN 24H', w - 30, 58);
    });
  }
  makePylonTexture(lvl) {
    return canvasTex(256, 384, (x, w, h) => {
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#1f4e79'; x.fillRect(0, 0, w, h * 0.62);
      x.fillStyle = '#ffd54f'; x.beginPath(); x.arc(w / 2, 110, 70, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1f4e79'; x.font = 'bold 72px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('日', w / 2, 114);
      x.fillStyle = '#fff'; x.font = 'bold 34px sans-serif'; x.fillText(lvl >= 2 ? '24H 營業' : '營業中', w / 2, 210);
      x.fillStyle = '#f6c344'; x.fillRect(0, h * 0.62, w, 22); x.fillStyle = '#ff8a65'; x.fillRect(0, h * 0.62 + 22, w, 10);
      x.fillStyle = '#1f4e79'; x.font = 'bold 40px sans-serif';
      x.fillText(this.state.storeName.slice(0, 5), w / 2, h * 0.82);
    });
  }

  // 面向鏡頭的牆自動變矮，讓玩家看得到店內
  updateWalls() {
    const cam = this.camera.position, tgt = this.controls.target;
    const vx = cam.x - tgt.x, vz = cam.z - tgt.z, len = Math.hypot(vx, vz) || 1;
    for (const w of this.walls) {
      const { nx, nz, wall, top, fascia } = w.userData;
      const facing = (nx * vx + nz * vz) / len > 0.25;
      if (fascia) { w.visible = !facing || this.camera.position.y > 0 && (cam.y - tgt.y) / len < 0.9; w.visible = !facing || (cam.y - tgt.y) < len * 0.75; continue; }
      const target = facing ? 0.22 : 1;
      wall.scale.y += (target * 2.6 - wall.scale.y) * 0.25;
      wall.position.y = wall.scale.y / 2;
      top.position.y = wall.scale.y - 0.12;
      top.visible = !facing;
    }
  }

  // ── 設備 ──
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
    const W = def.w, Dd = def.d;
    const slots = [];
    const addSlots = (geo, sx, sy, sz, positions) => {
      const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), positions.length);
      const m4 = new THREE.Matrix4();
      positions.forEach((p, i) => { m4.compose(new THREE.Vector3(...p), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(i, m4); im.setColorAt(i, new THREE.Color(0xffffff)); });
      im.castShadow = false; im.count = 0; g.add(im); slots.push(im);
    };
    if (type === 'shelf') {
      g.add(box(W - 0.1, 1.6, 0.08, 0xb0bec5, 0, 0.8, -0.38));
      g.add(box(0.06, 1.6, 0.8, 0x90a4ae, -W / 2 + 0.08, 0.8, 0));
      g.add(box(0.06, 1.6, 0.8, 0x90a4ae, W / 2 - 0.08, 0.8, 0));
      const pos = [];
      for (const y of [0.12, 0.55, 0.98]) {
        g.add(box(W - 0.12, 0.05, 0.7, 0xcfd8dc, 0, y, -0.02));
        g.add(box(W - 0.12, 0.08, 0.02, 0xf6c344, 0, y + 0.02, 0.33));
        for (let i = 0; i < 8; i++) pos.push([-W / 2 + 0.22 + i * ((W - 0.44) / 7), y + 0.17, 0]);
      }
      addSlots(G.box, 0.17, 0.26, 0.4, pos);
    } else if (type === 'fridge') {
      g.add(box(W - 0.05, 2.1, 0.85, 0xeceff1, 0, 1.05, -0.05));
      const inner = box(W - 0.25, 1.75, 0.7, 0x263238, 0, 1.1, 0.02); g.add(inner);
      const pos = [];
      for (const y of [0.4, 0.95, 1.5]) {
        g.add(box(W - 0.3, 0.03, 0.6, 0xb0bec5, 0, y - 0.13, 0.05));
        for (let i = 0; i < 10; i++) pos.push([-W / 2 + 0.25 + i * ((W - 0.5) / 9), y, 0.12]);
      }
      addSlots(G.cyl, 0.12, 0.26, 0.12, pos);
      const glass = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.22, emissive: 0x335566 }));
      glass.scale.set(W - 0.2, 1.8, 0.03); glass.position.set(0, 1.1, 0.39); g.add(glass);
      g.add(box(0.04, 1.8, 0.05, 0xb0bec5, 0, 1.1, 0.41));
      g.add(box(W - 0.05, 0.22, 0.05, 0x2e6da4, 0, 1.98, 0.38, { emissive: 0x15385a }));
    } else if (type === 'chiller') {
      g.add(box(W - 0.05, 0.75, 0.85, 0xeceff1, 0, 0.375, 0));
      g.add(box(W - 0.05, 1.6, 0.25, 0xeceff1, 0, 0.8, -0.3));
      g.add(box(W - 0.05, 0.12, 0.6, 0xeceff1, 0, 1.55, -0.12));
      g.add(box(W - 0.2, 0.04, 0.55, 0x90a4ae, 0, 1.12, -0.1));
      g.add(box(W - 0.05, 0.12, 0.04, 0xf05a7a, 0, 0.7, 0.42));
      const pos = [];
      for (const [y, z] of [[0.82, 0.12], [1.2, -0.12]]) for (let i = 0; i < 8; i++) pos.push([-W / 2 + 0.2 + i * ((W - 0.4) / 7), y, z]);
      addSlots(G.box, 0.2, 0.1, 0.28, pos);
    } else if (type === 'hotcase') {
      g.add(box(0.95, 0.9, 0.85, 0x8d6e63, 0, 0.45, 0));
      g.add(box(0.9, 0.08, 0.8, 0x9e9e9e, 0, 0.94, 0));
      const glass = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ color: 0xfff3e0, transparent: true, opacity: 0.3 }));
      glass.scale.set(0.9, 0.45, 0.75); glass.position.set(0, 1.2, 0); g.add(glass);
      g.add(box(0.9, 0.05, 0.75, 0x795548, 0, 1.45, 0));
      g.add(box(0.5, 0.18, 0.04, 0xff7043, 0, 1.6, 0.3, { emissive: 0x802010 }));
      const pos = [];
      for (let i = 0; i < 12; i++) pos.push([-0.32 + (i % 4) * 0.21, 1.05 + Math.floor(i / 8) * 0.14, -0.22 + (Math.floor(i / 4) % 2) * 0.3]);
      addSlots(G.sph, 0.15, 0.12, 0.15, pos);
    } else if (type === 'coffee') {
      g.add(box(0.95, 0.85, 0.85, 0x5d4037, 0, 0.425, 0));
      g.add(box(0.6, 0.8, 0.5, 0x212121, 0, 1.25, -0.1));
      g.add(box(0.3, 0.12, 0.04, 0x80deea, 0, 1.45, 0.16, { emissive: 0x2a7a85 }));
      g.add(box(0.2, 0.05, 0.25, 0x9e9e9e, 0, 0.92, 0.12));
      const pos = []; for (let i = 0; i < 20; i++) pos.push([0.3, 0.92 + i * 0.035, 0.25]);
      addSlots(G.cyl, 0.12, 0.05, 0.12, pos);
    } else if (type === 'counter') {
      g.add(box(W - 0.05, 0.95, 0.75, 0xa1887f, 0, 0.475, 0));
      g.add(box(W + 0.02, 0.06, 0.85, 0xefebe9, 0, 0.98, 0));
      g.add(box(W - 0.05, 0.2, 0.04, 0x2e6da4, 0, 0.75, 0.38));
      g.add(box(0.45, 0.25, 0.35, 0x37474f, -0.35, 1.13, -0.05));
      const scr = box(0.38, 0.28, 0.04, 0x263238, -0.35, 1.42, 0.1); scr.rotation.x = -0.3; g.add(scr);
      g.add(box(0.3, 0.2, 0.02, 0x4fc3f7, -0.35, 1.43, 0.125, { emissive: 0x1a6080 }));
      g.add(box(0.45, 0.5, 0.35, 0xeeeeee, 0.45, 1.25, -0.15));
      for (let i = 0; i < 3; i++) g.add(box(0.12, 0.08, 0.1, [0xff7043, 0x66bb6a, 0xffca28][i], 0.3 + i * 0.13, 1.06, 0.25));
    } else if (type === 'plant') {
      g.add(box(0.45, 0.45, 0.45, 0xd7ccc8, 0, 0.225, 0));
      const l = new THREE.Mesh(G.sph, mat(0x66bb6a)); l.scale.set(0.8, 0.9, 0.8); l.position.y = 0.85; l.castShadow = true; g.add(l);
      const l2 = new THREE.Mesh(G.sph, mat(0x43a047)); l2.scale.set(0.55, 0.65, 0.55); l2.position.set(0.12, 1.25, 0.05); l2.castShadow = true; g.add(l2);
    } else if (type === 'table') {
      g.add(box(0.7, 0.05, 0.7, 0xd7a86e, 0, 0.72, 0));
      g.add(box(0.08, 0.7, 0.08, 0x6d4c41, 0, 0.36, 0));
      g.add(box(0.35, 0.05, 0.35, 0xd7a86e, -0.33, 0.45, 0.25)); g.add(box(0.35, 0.4, 0.05, 0xd7a86e, -0.33, 0.65, 0.42));
      g.add(box(0.35, 0.05, 0.35, 0xd7a86e, 0.33, 0.45, -0.25)); g.add(box(0.35, 0.4, 0.05, 0xd7a86e, 0.33, 0.65, -0.42));
    }
    // 類別標籤
    if (def.cats) {
      const lbl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ transparent: true }));
      lbl.position.set(0, type === 'fridge' ? 2.3 : type === 'shelf' ? 1.75 : 1.75, 0.2);
      g.add(lbl); g.userData.label = lbl;
    }
    g.userData.slots = slots;
    if (ghost) g.traverse(o => { if (o.isMesh) { o.material = o.material.clone ? o.material.clone() : o.material; o.material.transparent = true; o.material.opacity = 0.55; o.castShadow = false; } });
    return g;
  }
  updateFixtureStock(f) {
    const o = this.fixtureObjs.get(f.id); if (!o) return;
    const lbl = o.userData.label;
    if (lbl && lbl.userData.cat !== f.cat) {
      lbl.userData.cat = f.cat;
      const c = CATEGORIES[f.cat];
      lbl.material.map = canvasTex(128, 64, (x, w, h) => {
        x.fillStyle = '#' + c.color.toString(16).padStart(6, '0'); x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, 14); x.fill();
        x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(c.name, w / 2, h / 2 + 2);
      });
      lbl.material.needsUpdate = true;
    }
    const im = o.userData.slots[0]; if (!im) return;
    const list = [];
    for (const pid of Object.keys(f.stock).sort()) for (let i = 0; i < f.stock[pid]; i++) list.push(PRODUCT[pid].color);
    // 交錯排列讓貨架看起來比較自然
    const n = Math.min(list.length, im.instanceMatrix.count);
    const col = new THREE.Color();
    // 依序填入所有格子，但只顯示前 n 個
    const order = o.userData.order || (o.userData.order = shuffledIdx(im.instanceMatrix.count, f.id));
    const base = o.userData.baseMatrices || (o.userData.baseMatrices = Array.from({ length: im.instanceMatrix.count }, (_, i) => { const m = new THREE.Matrix4(); im.getMatrixAt(i, m); return m; }));
    for (let i = 0; i < n; i++) { im.setMatrixAt(i, base[order[i]]); im.setColorAt(i, col.setHex(list[i])); }
    im.count = n;
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ── 人物 ──
  makePerson(look, outfit) {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const legL = box(0.12, 0.42, 0.14, outfit.pants, -0.08, 0.21, 0); legL.geometry = G.box;
    const legR = box(0.12, 0.42, 0.14, outfit.pants, 0.08, 0.21, 0);
    const lp = new THREE.Group(); lp.position.y = 0.42; legL.position.y = -0.21; lp.add(legL); lp.position.x = -0.08; legL.position.x = 0;
    const rp = new THREE.Group(); rp.position.y = 0.42; legR.position.y = -0.21; rp.add(legR); rp.position.x = 0.08; legR.position.x = 0;
    body.add(lp, rp);
    const torso = box(0.36, 0.42, 0.22, outfit.shirt, 0, 0.63, 0); body.add(torso);
    if (outfit.apron) body.add(box(0.3, 0.36, 0.02, outfit.apron, 0, 0.6, 0.12));
    const armL = box(0.09, 0.38, 0.1, outfit.shirt, 0, -0.17, 0), armR = box(0.09, 0.38, 0.1, outfit.shirt, 0, -0.17, 0);
    const ap = new THREE.Group(); ap.position.set(-0.23, 0.82, 0); ap.add(armL);
    const arp = new THREE.Group(); arp.position.set(0.23, 0.82, 0); arp.add(armR);
    body.add(ap, arp);
    const head = new THREE.Mesh(G.sph, mat(look.skin)); head.scale.setScalar(0.36); head.position.y = 1.03; head.castShadow = true; body.add(head);
    const hairM = mat(look.hair);
    const hair = new THREE.Mesh(G.hemi, hairM); hair.scale.set(0.39, 0.4, 0.39); hair.position.y = 1.06; hair.rotation.x = -0.25; hair.castShadow = true; body.add(hair);
    if (look.hairStyle === 1) { const tail = box(0.22, 0.3, 0.1, look.hair, 0, 0.92, -0.17); body.add(tail); }
    if (look.hairStyle === 2) { const bun = new THREE.Mesh(G.sph, hairM); bun.scale.setScalar(0.16); bun.position.set(0, 1.26, -0.08); body.add(bun); }
    if (outfit.cap) { const cap = box(0.38, 0.08, 0.42, outfit.cap, 0, 1.2, 0.03); body.add(cap); }
    for (const sx of [-0.07, 0.07]) { const eye = box(0.04, 0.05, 0.02, 0x222222, sx, 1.05, 0.175); body.add(eye); }
    // 手上物品
    const basket = box(0.26, 0.16, 0.18, 0xe53935, 0, -0.36, 0.06); basket.visible = false; armR.add(basket);
    const carry = box(0.45, 0.32, 0.35, 0xc8a06a, 0, 0.85, 0.3); carry.visible = false; body.add(carry);
    g.userData = { body, lp, rp, ap, arp, basket, carry, phase: Math.random() * 6 };
    const sc = outfit.scale || 1; g.scale.setScalar(sc);
    return g;
  }
  animatePerson(o, moving, dt, speedMul = 1) {
    const u = o.userData;
    if (moving) {
      u.phase += dt * 9 * speedMul;
      const s = Math.sin(u.phase) * 0.6;
      u.lp.rotation.x = s; u.rp.rotation.x = -s; u.ap.rotation.x = -s * 0.7; u.arp.rotation.x = u.carry.visible ? -1.2 : s * 0.7;
      u.body.position.y = Math.abs(Math.cos(u.phase)) * 0.04;
    } else {
      u.phase += dt * 2;
      u.lp.rotation.x *= 0.8; u.rp.rotation.x *= 0.8; u.ap.rotation.x *= 0.8; u.arp.rotation.x = u.carry.visible ? -1.2 : u.arp.rotation.x * 0.8;
      u.body.position.y = Math.sin(u.phase) * 0.008;
    }
    if (u.carry.visible) u.ap.rotation.x = -1.2;
  }

  // ── 髒污 ──
  syncDirt() {
    for (const o of this.dirtObjs) this.fxGroup.remove(o);
    this.dirtObjs = [];
    for (const d of this.state.dirt) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), new THREE.MeshLambertMaterial({ color: 0x6d5a40, transparent: true, opacity: 0.55 }));
      m.rotation.x = -Math.PI / 2; m.position.set(d.x + 0.5 + d.ox, 0.03, d.z + 0.5 + d.oz); m.scale.set(1, 0.7, 1);
      this.fxGroup.add(m); this.dirtObjs.push(m);
    }
  }

  // ── 白天/黑夜 ──
  setTimeOfDay(minOfDay, weather) {
    const h = minOfDay / 60;
    const day = Math.max(0, Math.min(1, (Math.sin((h - 6) / 12 * Math.PI) + 0.15) * 1.4));
    const cloudy = weather === 'rain' ? 0.55 : weather === 'cloudy' ? 0.8 : weather === 'cold' ? 0.85 : 1;
    const sky = new THREE.Color().lerpColors(new THREE.Color(0x0f1a33), new THREE.Color(weather === 'rain' ? 0x9aa7b4 : 0xbfe3ff), day);
    if (h > 16.5 && h < 19.5) sky.lerp(new THREE.Color(0xffb27a), 0.35 * Math.sin((h - 16.5) / 3 * Math.PI) * cloudy);
    this.scene.background.copy(sky);
    this.sun.intensity = 0.1 + 1.9 * day * cloudy;
    this.hemi.intensity = 0.35 + 1.3 * day;
    const ang = (h - 6) / 12 * Math.PI;
    this.sun.position.set(6 - Math.cos(ang) * 14, 6 + Math.max(0, Math.sin(ang)) * 16, 14);
    this.sun.target.position.set(6, 0, 3);
    const night = 1 - day;
    const lightLvl = this.state.upgrades.light;
    this.storeLight.intensity = night * (14 + lightLvl * 5);
    this.floorMat.emissive.setRGB(0.32 * night, 0.3 * night, 0.26 * night);
    this.signMat.emissiveIntensity = 0.15 + night * 0.85;
    this.pylonMat.emissiveIntensity = 0.2 + night * (0.6 + this.state.upgrades.sign * 0.15);
    if (this.windowMat) this.windowMat.emissive.setRGB(0.55 * night, 0.45 * night, 0.2 * night);
    if (this.lampMat) this.lampMat.emissive.setRGB(night, night * 0.9, night * 0.5);
  }

  // ── 點擊 ──
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
    const cx = Math.max(-4, Math.min(b.W + 4, t.x)), cz = Math.max(b.z0 - 3, Math.min(b.D + 6, t.z));
    if (cx !== t.x || cz !== t.z) { const dx = cx - t.x, dz = cz - t.z; t.x = cx; t.z = cz; this.camera.position.x += dx; this.camera.position.z += dz; }
    t.y = 0;
  }
  render() { this.renderer.render(this.scene, this.camera); }
}

function shuffledIdx(n, seed) {
  const a = Array.from({ length: n }, (_, i) => i);
  let s = seed * 9301 + 49297;
  for (let i = n - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

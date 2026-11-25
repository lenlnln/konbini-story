// 3D Q 版角色：程式產生的模型（有關節的骨架）＋ 程式動畫
// 每個角色是一組有階層的 3D 物件：腰 → 身體 → 頭 / 手臂（肩、肘）/ 腿（髖、膝）。
// 動畫依模擬狀態挑選：待機、行走、轉身、逛貨架、伸手拿取、排隊、結帳、坐下、店員收銀/補貨/打掃等。
import * as THREE from 'three';

// ───────── 共用幾何與卡通材質 ─────────
const GEO = {};
function geo(key, make) { return GEO[key] || (GEO[key] = make()); }
const cap = (r, len) => geo(`cap${r}_${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 8));
const sph = (r, ws = 12, hs = 9) => geo(`sph${r}_${ws}`, () => new THREE.SphereGeometry(r, ws, hs));
const cyl = (rt, rb, h, n = 14, open = false) => geo(`cyl${rt}_${rb}_${h}_${open}`, () => new THREE.CylinderGeometry(rt, rb, h, n, 1, open));
const box = (w, h, d) => geo(`box${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));

let gradient = null;
function toonGrad() {
  if (gradient) return gradient;
  const data = new Uint8Array([165, 165, 165, 255, 215, 215, 215, 255, 245, 245, 245, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
  return gradient;
}
const MATS = new Map();
export function toon(color) {
  const k = typeof color === 'number' ? color : new THREE.Color(color).getHex();
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshToonMaterial({ color: k, gradientMap: toonGrad(), emissive: new THREE.Color(k).multiplyScalar(0.16) }));
  return MATS.get(k);
}

let VC = null;
function vcMat() { return VC || (VC = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGrad() })); }
const _c = new THREE.Color();
function bake(parts, skip) {
  const byParent = new Map();
  for (const m of parts) { if (skip.has(m)) continue; if (!byParent.has(m.parent)) byParent.set(m.parent, []); byParent.get(m.parent).push(m); }
  const out = [];
  for (const [parent, list] of byParent) {
    const pos = [], nor = [], col = [];
    for (const m of list) {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      const P = g.attributes.position.array, N = g.attributes.normal.array;
      _c.copy(m.material.color).lerp(WHITE, 0.08);
      for (let i = 0; i < P.length; i += 3) { pos.push(P[i], P[i + 1], P[i + 2]); nor.push(N[i], N[i + 1], N[i + 2]); col.push(_c.r, _c.g, _c.b); }
      g.dispose(); parent.remove(m);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, vcMat()); mesh.receiveShadow = false;
    parent.add(mesh); out.push(mesh);
  }
  return out;
}
const WHITE = new THREE.Color(0xffffff);
export function disposeCharacter(o) { for (const m of o.userData.merged || []) m.geometry.dispose(); o.userData.faceM?.dispose(); }

// ───────── 臉：canvas 畫的大眼睛（日系），貼在頭的正面 ─────────
const FACE = new Map();
function faceTex(eye, expr, female, glasses) {
  const key = `${eye}|${expr}|${female}|${glasses}`;
  if (FACE.has(key)) return FACE.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 192;
  const x = c.getContext('2d');
  const ec = '#' + eye.toString(16).padStart(6, '0');
  const drawEye = (cx, flip) => {
    const cy = 104;
    if (expr === 'happy' || expr === 'blink') { // ^ ^ 或閉眼
      x.strokeStyle = '#3a2318'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath();
      if (expr === 'happy') x.arc(cx, cy + 8, 17, Math.PI * 1.15, Math.PI * 1.85); else { x.moveTo(cx - 17, cy + 4); x.quadraticCurveTo(cx, cy + 12, cx + 17, cy + 4); }
      x.stroke(); return;
    }
    const h = expr === 'sad' ? 36 : 46;
    x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(cx, cy, 20, h / 2 + 2, 0, 0, Math.PI * 2); x.fill();
    const g = x.createLinearGradient(0, cy - h / 2, 0, cy + h / 2); g.addColorStop(0, '#20140e'); g.addColorStop(0.45, ec); g.addColorStop(1, '#ffffff');
    x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy + 2, 16, h / 2 - 1, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1b0f0a'; x.beginPath(); x.ellipse(cx, cy + 3, 7, h / 4, 0, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(cx + 6 * flip, cy - 9, 6, 8, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(cx - 4 * flip, cy + 9, 2.6, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#2b1810'; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx - 22, cy - h / 2 + 4); x.quadraticCurveTo(cx, cy - h / 2 - 5, cx + 22, cy - h / 2 + 2); x.stroke(); // 上眼線
    if (female) { x.lineWidth = 3; x.beginPath(); x.moveTo(cx + 17 * flip, cy - h / 2 + 2); x.lineTo(cx + 23 * flip, cy - h / 2 - 3); x.stroke(); }
    // 眉毛
    x.lineWidth = 3.5; x.beginPath();
    const by = cy - h / 2 - 15;
    if (expr === 'sad') { x.moveTo(cx - 14 * flip, by + 2); x.lineTo(cx + 12 * flip, by - 5); }
    else if (expr === 'angry') { x.moveTo(cx - 14 * flip, by - 5); x.lineTo(cx + 12 * flip, by + 3); }
    else { x.moveTo(cx - 13, by); x.quadraticCurveTo(cx, by - 5, cx + 13, by); }
    x.stroke();
  };
  x.save(); x.translate(128, 100); x.scale(1.5, 1.5); x.translate(-128, -104);
  drawEye(96, -1); drawEye(160, 1);
  x.restore();
  // 腮紅
  x.fillStyle = 'rgba(255,120,130,.35)';
  x.beginPath(); x.ellipse(52, 150, 18, 8, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(204, 150, 18, 8, 0, 0, Math.PI * 2); x.fill();
  // 嘴
  x.strokeStyle = '#7a3328'; x.fillStyle = '#c44f4f'; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath();
  if (expr === 'happy') { x.moveTo(114, 146); x.quadraticCurveTo(128, 166, 142, 146); x.closePath(); x.fill(); }
  else if (expr === 'sad' || expr === 'angry') { x.moveTo(117, 156); x.quadraticCurveTo(128, 148, 139, 156); x.stroke(); }
  else { x.moveTo(119, 150); x.quadraticCurveTo(128, 157, 137, 150); x.stroke(); }
  if (glasses) {
    x.strokeStyle = '#3d3d46'; x.lineWidth = 4;
    x.beginPath(); x.ellipse(80, 102, 37, 33, 0, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.ellipse(176, 102, 37, 33, 0, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(117, 98); x.lineTo(139, 98); x.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  FACE.set(key, t); return t;
}

// ───────── 服裝設定（依原本的角色類型對應） ─────────
// top 上衣、sleeve 袖、bottom 下身（skirt 裙 / pants 褲）、shoe 鞋、acc 配件
const OUTFITS = {
  student_f: { female: 1, top: 0xf7f7fb, collar: 0x26315e, bottom: 0x26315e, skirt: 1, legs: 0xf3e0d0, sock: 0xf5f5f5, shoe: 0x3b2a20, ribbon: 0xe0443e, hair: [3, 4, 2], h: 1.34 },
  student_m: { top: 0xf7f7fb, bottom: 0x2a2e3a, shoe: 0x2b2b2b, h: 1.4, hair: [0, 0, 1] },
  office_f: { female: 1, top: 0x5d6472, inner: 0xf6f6f6, bottom: 0x4a505c, skirt: 1, legs: 0xd9b8a0, shoe: 0x1e1e22, h: 1.38, hair: [2, 1, 3] },
  office_m: { top: 0x2d3a55, inner: 0xf6f6f6, tie: 0xb03a48, bottom: 0x2d3a55, shoe: 0x1e1e22, h: 1.44, hair: [0, 1], glasses: 0.25 },
  resident_f: { female: 1, top: 0xf6a5b8, inner: 0xffffff, bottom: 0x5b7bb0, shoe: 0xf0f0f0, h: 1.36, hair: [1, 2, 3] },
  resident_m: { top: 0x6aa86a, bottom: 0xb8a582, shoe: 0x6a5040, h: 1.42, hair: [0, 1] },
  elder_f: { female: 1, top: 0xb79fd0, bottom: 0x6c5a7a, skirt: 2, legs: 0xc9a990, shoe: 0x5a4a44, h: 1.28, hair: [5], gray: 1, glasses: 0.3 },
  elder_m: { top: 0xcbb68f, inner: 0xf3efe6, bottom: 0x6f6a5f, shoe: 0x4a3a30, h: 1.34, hair: [0], gray: 1, glasses: 0.6, bald: 0.3 },
  night_f: { female: 1, top: 0x3a3c48, hood: 1, bottom: 0x22242c, shoe: 0xe9e9e9, h: 1.36, hair: [2, 3, 4] },
  night_m: { top: 0x7f8794, hood: 1, bottom: 0x2b2f3a, shoe: 0xe9e9e9, h: 1.42, hair: [0, 1], phones: 1 },
  staff_f: { female: 1, staff: 1, top: 0xffffff, vest: 0x2f6db5, trim: 0xf6c344, bottom: 0x3a3f4c, shoe: 0x2b2b2b, h: 1.36, hair: [4, 1] },
  staff_m: { staff: 1, top: 0xffffff, vest: 0x2f6db5, trim: 0xf6c344, bottom: 0x3a3f4c, shoe: 0x2b2b2b, h: 1.42, hair: [0, 1] },
  manager: { top: 0xf6f6f6, vest: 0x24324d, trim: 0xf6c344, tie: 0x2f6db5, bottom: 0x24324d, shoe: 0x1e1e22, h: 1.45, hair: [1] },
};
const EYES = [0x6b3e26, 0x3b5f9a, 0x4f7f4a, 0x7a4fa0, 0x9a5b2c];
const HAIRCOL = [0x2a1c16, 0x4a2e1f, 0x6b4128, 0x1c1c24, 0x8b5a3c, 0xc79a5b];

// 由外觀資料算出穩定的亂數（同一位常客每次長得一樣）
function seeded(look) {
  let h = 2166136261;
  for (const v of [look.skin, look.hair, look.hairStyle, look.seed || 0]) { h ^= v; h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

// ───────── 建立角色 ─────────
export function makeCharacter(look, outfit) {
  const id = outfit.sprite || 'student_f';
  const O = OUTFITS[id] || OUTFITS.student_f;
  const R = seeded(look);
  const female = !!O.female;
  const H = O.h * (outfit.scale || 1);
  const k = H / 1.4; // 整體比例
  const skin = toon(new THREE.Color(look.skin).lerp(new THREE.Color(0xfff1e6), 0.45).getHex()); // 日系偏白的膚色
  const hairC = O.gray ? (R() < 0.5 ? 0xd8d8d8 : 0xbdbdbd) : (look.hair === 0xb0b0b0 ? HAIRCOL[Math.floor(R() * HAIRCOL.length)] : look.hair);
  const hairM = toon(hairC);
  const topM = toon(O.top), botM = toon(O.bottom), shoeM = toon(O.shoe);
  const sleeveM = O.vest ? toon(O.top) : topM;

  // 尺寸（Q 版約 3.3 頭身）
  const headR = 0.25 * k, legL = 0.23 * k, shinL = 0.22 * k, torsoH = 0.33 * k, armU = 0.17 * k, armL = 0.16 * k;
  const hipY = legL + shinL + 0.05 * k;

  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);
  const hips = new THREE.Group(); hips.position.y = hipY; rig.add(hips);
  const parts = [];
  const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); parts.push(m); return m; };
  const M = (g, m) => new THREE.Mesh(g, m);

  // 腿
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.075 * k * s, 0, 0); hips.add(hip);
    const thighM = O.skirt && !O.legs ? botM : (O.skirt ? toon(O.legs) : botM);
    add(hip, M(cap(0.062 * k, legL - 0.08 * k), thighM), 0, -legL / 2, 0);
    const knee = new THREE.Group(); knee.position.y = -legL; hip.add(knee);
    const shinM = O.sock ? toon(O.sock) : (O.skirt ? toon(O.legs || O.bottom) : botM);
    add(knee, M(cap(0.055 * k, shinL - 0.08 * k), shinM), 0, -shinL / 2, 0);
    const shoe = add(knee, M(sph(0.5, 14, 10), shoeM), 0, -shinL - 0.005 * k, 0.03 * k);
    shoe.scale.set(0.13 * k, 0.085 * k, 0.2 * k);
    legs.push({ hip, knee });
  }
  // 身體
  const torso = new THREE.Group(); hips.add(torso);
  add(torso, M(cyl(0.12 * k, 0.135 * k, 0.12 * k), O.skirt ? botM : botM), 0, 0.02 * k, 0); // 腰
  const chest = add(torso, M(cap(0.13 * k, torsoH - 0.2 * k), topM), 0, torsoH / 2 + 0.02 * k, 0);
  chest.scale.set(1, 1, 0.8);
  if (O.skirt) { const sk = add(hips, M(cyl(0.12 * k, O.skirt === 2 ? 0.2 * k : 0.22 * k, O.skirt === 2 ? 0.36 * k : 0.2 * k, 16), botM), 0, O.skirt === 2 ? -0.15 * k : -0.07 * k, 0); sk.scale.z = 0.85; }
  if (O.vest) { // 店員背心＋黃色滾邊
    const v = add(torso, M(cap(0.138 * k, torsoH - 0.24 * k), toon(O.vest)), 0, torsoH / 2 - 0.005 * k, 0); v.scale.set(1, 1, 0.84);
    add(torso, M(cyl(0.142 * k, 0.142 * k, 0.025 * k, 18), toon(O.trim)), 0, 0.09 * k, 0).scale.z = 0.84;
    add(torso, M(box(0.07 * k, 0.05 * k, 0.01), toon(0xffffff)), 0.06 * k, torsoH * 0.62, 0.115 * k); // 名牌
  }
  if (O.inner) add(torso, M(box(0.07 * k, torsoH * 0.55, 0.02 * k), toon(O.inner)), 0, torsoH * 0.62, 0.103 * k);
  if (O.tie) add(torso, M(box(0.035 * k, torsoH * 0.42, 0.02 * k), toon(O.tie)), 0, torsoH * 0.6, 0.118 * k);
  if (O.collar) { const c = add(torso, M(box(0.24 * k, 0.09 * k, 0.16 * k), toon(O.collar)), 0, torsoH * 0.86, -0.035 * k); c.rotation.x = 0.25; }
  if (O.ribbon) add(torso, M(sph(0.5, 10, 8), toon(O.ribbon)), 0, torsoH * 0.82, 0.11 * k).scale.set(0.09 * k, 0.05 * k, 0.04 * k);
  if (O.hood) add(torso, M(sph(0.5, 14, 10), topM), 0, torsoH * 0.9, -0.1 * k).scale.set(0.27 * k, 0.12 * k, 0.12 * k);
  // 手臂
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(0.165 * k * s, torsoH * 0.84, 0); torso.add(sh);
    add(sh, M(cap(0.045 * k, armU - 0.06 * k), sleeveM), 0, -armU / 2, 0);
    const el = new THREE.Group(); el.position.y = -armU; sh.add(el);
    add(el, M(cap(0.04 * k, armL - 0.06 * k), O.top === 0xf7f7fb || O.vest || O.hood || O.inner ? sleeveM : skin), 0, -armL / 2, 0);
    const hand = new THREE.Group(); hand.position.y = -armL; el.add(hand);
    add(hand, M(sph(0.047 * k, 12, 10), skin), 0, -0.01 * k, 0);
    arms.push({ sh, el, hand, s });
  }
  // 頭
  const neck = new THREE.Group(); neck.position.y = torsoH + 0.02 * k; torso.add(neck);
  add(neck, M(cyl(0.04 * k, 0.045 * k, 0.07 * k, 10), skin), 0, 0.02 * k, 0);
  const head = new THREE.Group(); head.position.y = 0.05 * k; neck.add(head);
  const skull = add(head, M(sph(headR, 20, 14), skin), 0, headR, 0); skull.scale.set(1, 0.95, 0.96);
  const eye = EYES[Math.floor(R() * EYES.length)];
  const glasses = R() < (O.glasses || 0);
  const faceGeo = geo('face', () => new THREE.SphereGeometry(1, 24, 16, Math.PI / 2 - 0.62, 1.24, Math.PI / 2 - 0.42, 0.88));
  const faceM = new THREE.MeshToonMaterial({ map: faceTex(eye, 'normal', female, glasses), transparent: true, gradientMap: toonGrad(), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  // SphereGeometry 的 phi 從 +x 反方向起算，這裡轉 180° 讓臉朝 +z
  const face = add(head, M(faceGeo, faceM), 0, headR, 0); face.scale.set(headR * 1.005, headR * 0.955, headR * 0.965); 
  // 耳朵
  for (const s of [-1, 1]) add(head, M(sph(0.035 * k, 8, 6), skin), headR * 0.97 * s, headR * 0.95, -0.01 * k).scale.set(0.6, 1, 0.8);
  // 頭髮
  const styles = O.hair; const style = (O.bald && R() < O.bald) ? -1 : styles[Math.floor(R() * styles.length)];
  if (style >= 0) {
    const capG = geo('haircap', () => new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42));
    const cap1 = add(head, M(capG, hairM), 0, headR * 1.0, 0); cap1.scale.set(headR * 1.08, headR * 1.08, headR * 1.08); cap1.rotation.x = -0.18;
    const backG = geo('hairback', () => new THREE.SphereGeometry(1, 20, 14, Math.PI * 0.08, Math.PI * 0.84, 0, Math.PI * 0.72));
    const back = add(head, M(backG, hairM), 0, headR, 0); back.scale.setScalar(headR * 1.07); back.rotation.y = Math.PI; // 後腦
    // 瀏海：前額幾撮
    for (let i = -2; i <= 2; i++) {
      const b = add(head, M(sph(0.5, 10, 8), hairM), i * headR * 0.33, headR * 1.62 - Math.abs(i) * 0.02 * k, headR * 0.72);
      b.scale.set(headR * 0.42, headR * 0.5, headR * 0.3); b.rotation.z = i * 0.25; b.rotation.x = 0.5;
    }
    if (style === 1 || style === 2) { // 鮑伯 / 中長：兩側包住
      for (const s of [-1, 1]) { const sd = add(head, M(sph(0.5, 12, 10), hairM), headR * 0.86 * s, headR * (style === 2 ? 0.62 : 0.78), -0.02 * k); sd.scale.set(headR * 0.42, headR * (style === 2 ? 1.25 : 0.95), headR * 1.1); }
    }
    if (style === 2) { const lg = add(head, M(cap(headR * 0.62, headR * 0.9), hairM), 0, headR * 0.35, -headR * 0.55); lg.scale.z = 0.55; }
    if (style === 3) { // 馬尾
      add(head, M(sph(0.06 * k, 10, 8), toon(0xe05a7a)), 0, headR * 1.25, -headR * 0.98);
      const pt = add(head, M(cap(0.07 * k, 0.22 * k), hairM), 0, headR * 0.85, -headR * 1.12); pt.rotation.x = 0.35;
    }
    if (style === 4) { // 雙馬尾
      for (const s of [-1, 1]) { const tw = add(head, M(cap(0.06 * k, 0.24 * k), hairM), headR * 1.02 * s, headR * 0.75, -headR * 0.35); tw.rotation.z = 0.25 * s; add(head, M(sph(0.045 * k, 8, 6), toon(0xe05a7a)), headR * 0.92 * s, headR * 1.25, -headR * 0.35); }
    }
    if (style === 5) add(head, M(sph(0.1 * k, 12, 10), hairM), 0, headR * 1.55, -headR * 0.85); // 包頭
  }
  if (O.staff) { // 店員帽
    const hat = add(head, M(geo('hat', () => new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45)), toon(0x2f6db5)), 0, headR * 1.12, 0); hat.scale.setScalar(headR * 1.08);
    const bill = add(head, M(cyl(0.11 * k, 0.11 * k, 0.015 * k, 16), toon(0x2f6db5)), 0, headR * 1.55, headR * 0.75); bill.scale.z = 0.7; bill.rotation.x = 0.2;
  }
  if (O.phones) { for (const s of [-1, 1]) add(head, M(cyl(0.05 * k, 0.05 * k, 0.04 * k, 12), toon(0x222222)), headR * 1.02 * s, headR * 1.0, 0).rotation.z = Math.PI / 2; const band = add(head, M(geo('band', () => new THREE.TorusGeometry(1, 0.08, 6, 20, Math.PI)), toon(0x222222)), 0, headR * 1.0, 0); band.scale.setScalar(headR * 1.06); }
  // 手上的東西：購物籃（左手）、紙箱（雙手）、剛拿到的商品（右手）
  const basket = new THREE.Group();
  add(basket, M(box(0.2 * k, 0.12 * k, 0.14 * k), toon(0xd8453c)), 0, -0.1 * k, 0);
  add(basket, M(box(0.18 * k, 0.03 * k, 0.12 * k), toon(0xf4d35e)), 0, -0.03 * k, 0);
  const handle = add(basket, M(geo('handle', () => new THREE.TorusGeometry(0.07, 0.008, 6, 14, Math.PI)), toon(0xb02f2f)), 0, -0.02 * k, 0); handle.scale.setScalar(k);
  arms[0].hand.add(basket); basket.visible = false;
  const carry = new THREE.Group();
  add(carry, M(box(0.32 * k, 0.22 * k, 0.24 * k), toon(0xc8955c)), 0, 0, 0);
  add(carry, M(box(0.33 * k, 0.03 * k, 0.06 * k), toon(0xe9d3a8)), 0, 0.1 * k, 0);
  carry.position.set(0, hipY + torsoH * 0.55, 0.26 * k); rig.add(carry); carry.visible = false;
  const held = new THREE.Group();
  const heldBox = add(held, M(box(0.07 * k, 0.11 * k, 0.05 * k), toon(0xffffff)), 0, -0.06 * k, 0.03 * k);
  arms[1].hand.add(held); held.visible = false;

  // 效能：同一個關節底下的零件合併成一個網格（用頂點顏色），每個角色從 ~40 次繪製降到 ~14 次
  const merged = bake(parts, new Set([face, heldBox]));
  const casters = merged.filter(m => m.parent === torso || m.parent === head);
  const castAll = on => { for (const m of casters) m.castShadow = on; };
  const H2 = hipY + torsoH + 0.07 * k + headR * 2;
  root.userData = {
    rig3d: true, rig, hips, torso, neck, head, legs, arms, basket, carry, held, heldBox, face, faceM, eye, female, glasses,
    h: H2, hipY, k, castAll, merged,
    phase: R() * 6, t: R() * 10, walk: 0, pop: 0, emote: null, emoteT: 0, blinkT: 1 + R() * 3, lookT: 2 + R() * 4, lookYaw: 0,
    yaw: 0, yawInit: false, vis: null, last: new THREE.Vector3(), turnK: 0, reachH: 0, heldT: 0,
    off: new THREE.Vector2((R() - 0.5) * 0.22, (R() - 0.5) * 0.22), sep: new THREE.Vector2(), stride: 0.9 + R() * 0.25,
    pose: {}, expr: 'normal',
  };
  return root;
}

// ───────── 動畫 ─────────
const lerp = (a, b, t) => a + (b - a) * t;
function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }

// 姿勢目標：每個關節的角度，再平滑過去
function blank() {
  return { hipY: 0, hipRX: 0, hipRZ: 0, torX: 0, torY: 0, torZ: 0, headX: 0, headY: 0, headZ: 0,
    lLeg: 0, rLeg: 0, lKnee: 0, rKnee: 0, lLegZ: 0, rLegZ: 0,
    lArmX: 0, rArmX: 0, lArmZ: 0.12, rArmZ: -0.12, lArmY: 0, rArmY: 0, lElb: 0.15, rElb: 0.15 };
}

// 從模擬狀態決定要播哪個動作
export function chooseAction(a, moving) {
  if (!a) return moving ? 'walk' : 'idle';
  if (a.sitting) return 'sit';
  if (moving) return a.state === 'flee' ? 'run' : 'walk';
  if (a.kind === 'customer') {
    if (a.state === 'browse') return a.timer < 0.75 ? 'pickup' : 'shop';
    if (a.state === 'queue') { if (a.qpos === 0 && a.served) return 'checkout'; return a.wait > 8 ? 'impatient' : 'queue'; }
    if (a.state === 'sneak') return 'sneak';
    if (a.state === 'caught') return 'caught';
  }
  if (a.kind === 'staff') {
    if (a.state === 'cashier') return a.scanning ? 'scan' : 'idle';
    if (a.state === 'grab') return 'crouch';
    if (a.state === 'stocking') return 'stock';
    if (a.state === 'cleaning') return 'sweep';
  }
  return 'idle';
}

export function animateCharacter(o, moving, dt, speedMul, world) {
  const u = o.userData, a = u.agent;
  const p = o.position;
  // ── 位置：模擬走格子，畫面上平滑追上；再加上和旁人的避讓偏移 ──
  const tx = (a ? a.x + 0.5 : p.x) + u.off.x + u.sep.x, tz = (a ? a.z + 0.5 : p.z) + u.off.y + u.sep.y;
  if (!u.vis || Math.hypot(u.vis.x - tx, u.vis.z - tz) > 1.6) { u.vis = new THREE.Vector3(tx, 0, tz); u.last.copy(u.vis); }
  const kf = 1 - Math.exp(-dt * 8);
  u.vis.x += (tx - u.vis.x) * kf; u.vis.z += (tz - u.vis.z) * kf;
  const dx = u.vis.x - u.last.x, dz = u.vis.z - u.last.z;
  const v = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
  u.last.copy(u.vis);
  p.x = u.vis.x; p.z = u.vis.z; p.y = 0;
  // ── 面向：模擬給的方向是目標，畫面上平滑轉身（轉身時腳會踏步） ──
  const target = o.rotation.y;
  if (!u.yawInit) { u.yaw = target; u.yawInit = true; }
  const dYaw = angDiff(u.yaw, target);
  const turnSpeed = 7;
  u.yaw += Math.sign(dYaw) * Math.min(Math.abs(dYaw), dt * turnSpeed);
  u.rig.rotation.y = angDiff(target, u.yaw); // rig 相對 root 的偏移 = 畫面上的方向
  u.turnK = lerp(u.turnK, Math.abs(dYaw) > 0.25 ? 1 : 0, 1 - Math.exp(-dt * 10));

  const wTarget = Math.min(1, v / 1.1);
  u.walk += (wTarget - u.walk) * (1 - Math.exp(-dt * 10));
  const w = u.walk;
  let act = chooseAction(a, moving || w > 0.35);
  if (act !== u.act) { u.actT = 0; u.prevAct = u.act; u.act = act; if (act === 'shop') u.reachH = Math.floor(Math.random() * 3); }
  u.actT = (u.actT || 0) + dt;
  u.t += dt;
  const P = blank();
  const t = u.t;
  // 呼吸
  P.torX += Math.sin(t * 1.9) * 0.015;
  if (act === 'walk' || act === 'run' || w > 0.05) {
    const run = act === 'run' ? 1 : 0;
    u.phase += dt * (7 + 4 * speedMul + run * 5) * u.stride;
    const s = Math.sin(u.phase), c = Math.cos(u.phase);
    const amp = (0.55 + run * 0.35) * w;
    P.lLeg = s * amp; P.rLeg = -s * amp;
    P.lKnee = Math.max(0, -c) * 0.9 * w + 0.05; P.rKnee = Math.max(0, c) * 0.9 * w + 0.05;
    P.lArmX = -s * (0.5 + run * 0.4) * w; P.rArmX = s * (0.5 + run * 0.4) * w;
    P.lElb = 0.3 + run * 0.9; P.rElb = 0.3 + run * 0.9;
    P.hipY = Math.abs(c) * 0.035 * w * u.k - 0.012 * w;
    P.torX += 0.08 * w + run * 0.15; P.torY = s * 0.08 * w; P.headY = -s * 0.05 * w;
  }
  if (w < 0.6) {
    const still = 1 - w / 0.6;
    switch (act) {
      case 'idle': {
        u.lookT -= dt; if (u.lookT < 0) { u.lookT = 2 + Math.random() * 4; u.lookYaw = (Math.random() - 0.5) * 1.1; }
        P.headY += u.lookYaw * still; P.hipRZ = Math.sin(t * 0.7) * 0.025;
        P.lLegZ = 0.04; P.rLegZ = -0.04;
        break;
      }
      case 'shop': { // 看著貨架：頭左右掃視、一手托下巴
        P.headX = [0.35, 0.05, -0.3][u.reachH] * still; P.headY = Math.sin(t * 1.6) * 0.3 * still;
        P.torX += [0.18, 0.04, -0.04][u.reachH] * still;
        P.rArmX = -1.0 * still; P.rElb = 1.9 * still; P.rArmZ = -0.35;
        P.lArmX = -0.25 * still; P.lElb = 0.5;
        break;
      }
      case 'pickup': { // 伸手拿商品（高 / 中 / 低）再收回
        const q = Math.min(1, u.actT / 0.4), back = Math.max(0, (u.actT - 0.45) / 0.3);
        const ext = Math.max(0, q - back * 0.9);
        const hgt = u.reachH;
        P.rArmX = lerp(-0.3, [-1.15, -1.55, -2.5][hgt], ext); P.rElb = lerp(0.6, 0.12, ext);
        P.torX += [0.45, 0.12, -0.08][hgt] * ext;
        if (hgt === 0) { P.lKnee = P.rKnee = 1.5 * ext; P.lLeg = P.rLeg = 0.8 * ext; P.hipY = -0.11 * u.k * ext; }
        if (hgt === 2) { P.hipY = 0.03 * u.k * ext; P.headX = -0.35 * ext; }
        P.headX += [0.4, 0.1, 0][hgt] * ext;
        break;
      }
      case 'queue': {
        P.hipRZ = Math.sin(t * 0.5) * 0.05; // 重心左右換腳
        P.lLegZ = 0.05 + Math.max(0, Math.sin(t * 0.5)) * 0.06; P.rLegZ = -0.05;
        u.lookT -= dt; if (u.lookT < 0) { u.lookT = 2 + Math.random() * 3; u.lookYaw = (Math.random() - 0.5) * 0.9; }
        P.headY += u.lookYaw; P.lArmX = -0.35; P.lElb = 0.7;
        break;
      }
      case 'impatient': { // 等太久：手抱胸、腳打拍子、看手錶
        const watch = Math.sin(t * 0.6) > 0.6;
        P.lArmX = -0.75; P.rArmX = -0.75; P.lElb = 2.1; P.rElb = 2.1; P.lArmZ = 0.35; P.rArmZ = -0.35; P.lArmY = -0.6; P.rArmY = 0.6;
        if (watch) { P.lArmX = -1.3; P.lElb = 1.8; P.lArmY = 0.5; P.headX = 0.35; P.headY = 0.25; }
        P.rKnee = Math.max(0, Math.sin(t * 9)) * 0.25; P.rLeg = P.rKnee * 0.4;
        P.headZ = Math.sin(t * 0.8) * 0.08;
        break;
      }
      case 'checkout': { // 把籃子放上櫃台、遞錢
        const ph = (u.actT % 2.4) / 2.4;
        P.lArmX = -1.1; P.lElb = 0.5; P.rArmX = ph < 0.5 ? -1.2 : -0.5 + Math.sin(ph * 12) * 0.1; P.rElb = ph < 0.5 ? 0.35 : 1.0;
        P.torX += 0.12; P.headX = 0.25;
        break;
      }
      case 'scan': { // 店員結帳：一手拿商品過條碼機
        const s2 = Math.sin(u.actT * 6);
        P.rArmX = -1.15; P.rElb = 0.7; P.rArmY = s2 * 0.6; P.lArmX = -0.9; P.lElb = 0.9; P.lArmY = 0.3;
        P.torX += 0.12; P.headX = 0.35; P.torY = s2 * 0.08;
        break;
      }
      case 'stock': { // 補貨：雙手輪流往架上放
        const s3 = Math.sin(u.actT * 5);
        P.rArmX = -1.3 - Math.max(0, s3) * 0.4; P.lArmX = -1.3 - Math.max(0, -s3) * 0.4; P.rElb = 0.3; P.lElb = 0.3;
        P.torX += 0.1; P.headX = 0.1;
        break;
      }
      case 'crouch': { // 蹲下搬紙箱
        P.lKnee = P.rKnee = 1.9; P.lLeg = P.rLeg = 1.1; P.hipY = -0.2 * u.k; P.torX += 0.35;
        P.lArmX = P.rArmX = -0.9; P.lElb = P.rElb = 0.3;
        break;
      }
      case 'sweep': { // 打掃：左右擦地
        const s4 = Math.sin(u.actT * 5);
        P.torX += 0.3; P.rArmX = -0.9; P.lArmX = -0.9; P.rArmY = s4 * 0.5; P.lArmY = s4 * 0.5; P.rElb = 0.4; P.lElb = 0.4; P.torY = s4 * 0.2;
        break;
      }
      case 'sit': { // 坐在座位上吃東西
        P.lLeg = P.rLeg = 1.5; P.lKnee = P.rKnee = 1.5; P.hipY = -0.2 * u.k;
        const bite = Math.max(0, Math.sin(u.actT * 1.7));
        P.rArmX = -0.6 - bite * 0.9; P.rElb = 1.2 + bite * 0.9; P.lArmX = -0.6; P.lElb = 1.2; P.headX = 0.15 - bite * 0.1;
        break;
      }
      case 'sneak': { // 偷偷把東西塞進包包
        P.torX += 0.25; P.hipY = -0.05 * u.k; P.lKnee = P.rKnee = 0.5; P.lLeg = P.rLeg = 0.25;
        P.headY = Math.sin(t * 4) * 0.7; P.rArmX = -0.4; P.rElb = 1.5; P.rArmY = 0.8;
        break;
      }
      case 'caught': { P.lArmX = P.rArmX = -2.7; P.lElb = P.rElb = 0.3; P.headX = -0.2; break; }
    }
  }
  // 轉身踏步
  if (u.turnK > 0.05 && w < 0.3) {
    const s = Math.sin(t * 14);
    P.lKnee += Math.max(0, s) * 0.5 * u.turnK; P.rKnee += Math.max(0, -s) * 0.5 * u.turnK;
    P.lLeg += Math.max(0, s) * 0.25 * u.turnK; P.rLeg += Math.max(0, -s) * 0.25 * u.turnK;
    P.headY += 0.2 * Math.sign(dYaw) * u.turnK;
  }
  // 情緒反應
  if (u.emoteT > 0) {
    u.emoteT -= dt;
    const e = u.emote, f = Math.min(1, u.emoteT * 3);
    if (e === 'happy') { const j = Math.abs(Math.sin(u.emoteT * 9)); P.hipY += j * 0.07 * u.k * f; P.lArmX = lerp(P.lArmX, -2.6, f); P.rArmX = lerp(P.rArmX, -2.6, f); P.lArmZ = 0.4; P.rArmZ = -0.4; }
    if (e === 'sad') { P.headX = lerp(P.headX, 0.45, f); P.headY += Math.sin(u.emoteT * 10) * 0.35 * f; P.torX += 0.15 * f; P.lArmX = lerp(P.lArmX, 0.1, f); P.rArmX = lerp(P.rArmX, 0.1, f); }
    if (e === 'angry') { P.lArmZ = 0.45 * f; P.rArmZ = -0.45 * f; P.lElb = P.rElb = 1.2; P.hipY += Math.max(0, Math.sin(u.emoteT * 12)) * 0.03 * u.k; P.headX = -0.1; }
    if (u.emoteT <= 0) u.emote = null;
  }
  // 拿到商品時，右手亮出商品一下
  if (u.heldT > 0) { u.heldT -= dt; u.held.visible = true; if (u.heldT <= 0) u.held.visible = false; }
  // 搬紙箱：雙手往前抱
  if (u.carry.visible) { P.lArmX = P.rArmX = -1.25; P.lElb = P.rElb = 0.55; P.lArmZ = 0.25; P.rArmZ = -0.25; }
  // 提著購物籃：左手垂下拿
  if (u.basket.visible && !['checkout', 'impatient'].includes(act)) { P.lArmX = Math.min(P.lArmX, 0.05) * 0.4; P.lElb = 0.2; P.lArmZ = 0.22; }
  // 彈跳（拿東西、付錢時）
  u.pop = Math.max(0, u.pop - dt * 3.2);
  P.hipY += Math.sin(u.pop * Math.PI) * 0.06;

  // ── 表情：眨眼、開心、難過 ──
  u.blinkT -= dt;
  let expr = u.emote === 'happy' || act === 'sit' ? 'happy' : u.emote === 'sad' ? 'sad' : (u.emote === 'angry' || act === 'impatient') ? 'angry' : 'normal';
  if (u.blinkT < 0) { expr = 'blink'; if (u.blinkT < -0.12) u.blinkT = 2 + Math.random() * 3.5; }
  if (expr !== u.expr) { u.expr = expr; u.faceM.map = faceTex(u.eye, expr, u.female, u.glasses); u.faceM.needsUpdate = true; }

  // ── 平滑套用到關節 ──
  const sm = 1 - Math.exp(-dt * 14), Q = u.pose;
  for (const key in P) Q[key] = Q[key] === undefined ? P[key] : lerp(Q[key], P[key], sm);
  u.hips.position.y = u.hipY + Q.hipY; u.hips.rotation.set(Q.hipRX, 0, Q.hipRZ);
  u.torso.rotation.set(Q.torX, Q.torY, Q.torZ - Q.hipRZ * 0.6);
  u.head.rotation.set(Q.headX, Q.headY, Q.headZ);
  u.legs[0].hip.rotation.set(-Q.lLeg, 0, Q.lLegZ); u.legs[1].hip.rotation.set(-Q.rLeg, 0, Q.rLegZ);
  u.legs[0].knee.rotation.x = Q.lKnee; u.legs[1].knee.rotation.x = Q.rKnee;
  // 手臂：x 往前抬為負，z 往外張；arms[0] 在 -x 側（角色的右邊），arms[1] 在 +x 側（角色的左邊）
  u.arms[0].sh.rotation.set(Q.lArmX, Q.lArmY, -Q.lArmZ); u.arms[0].el.rotation.x = -Q.lElb;
  u.arms[1].sh.rotation.set(Q.rArmX, Q.rArmY, -Q.rArmZ); u.arms[1].el.rotation.x = -Q.rElb;
  // 影子跟著跳躍縮放
  if (u.shadow) { const s2 = 0.62 * (1 - Math.max(0, Q.hipY) * 6); u.shadow.scale.set(s2, s2, 1); }
}

// 讓角色做一個情緒動作：'happy' | 'sad' | 'angry'
export function emote(o, kind, dur = 1.2) {
  const u = o?.userData; if (!u?.rig3d) return;
  u.emote = kind; u.emoteT = dur;
}

// 顧客之間互相避讓：太近就往外推（只影響畫面位置，不會穿過貨架太多）
export function separate(objs, dt) {
  const n = objs.length;
  for (const o of objs) { o.userData.push = o.userData.push || new THREE.Vector2(); o.userData.push.set(0, 0); }
  for (let i = 0; i < n; i++) {
    const A = objs[i].userData; if (!A.vis) continue;
    for (let j = i + 1; j < n; j++) {
      const B = objs[j].userData; if (!B.vis) continue;
      const dx = B.vis.x - A.vis.x, dz = B.vis.z - A.vis.z, d = Math.hypot(dx, dz);
      const min = 0.42;
      if (d < min) {
        const f = (min - d) / min, nx = d > 1e-4 ? dx / d : Math.random() - 0.5, nz = d > 1e-4 ? dz / d : Math.random() - 0.5;
        A.push.x -= nx * f; A.push.y -= nz * f; B.push.x += nx * f; B.push.y += nz * f;
      }
    }
  }
  const k = 1 - Math.exp(-dt * 4);
  for (const o of objs) {
    const u = o.userData;
    u.sep.x = lerp(u.sep.x, Math.max(-0.28, Math.min(0.28, u.sep.x + u.push.x * 0.3)), k);
    u.sep.y = lerp(u.sep.y, Math.max(-0.28, Math.min(0.28, u.sep.y + u.push.y * 0.3)), k);
    if (!u.push.x && !u.push.y) { u.sep.x *= 1 - k * 0.5; u.sep.y *= 1 - k * 0.5; }
  }
}

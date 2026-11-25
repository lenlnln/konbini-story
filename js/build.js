// 擺設模式：購買、移動、旋轉、出售設備
import * as THREE from 'three';
import { FIXTURES, STORE_FRONT_Z, DOOR_X, CATEGORIES } from './data.js';
import { footprint, fixtureCells, frontCells, backCells, Grid } from './path.js';
import { fillFixture } from './state.js';

const $ = s => document.querySelector(s);

export class Build {
  constructor(G) {
    this.G = G; this.active = false; this.mode = null;
    this.ghost = null; this.ghostType = null; this.r = 0; this.x = 0; this.z = 0; this.editId = null;
    this.footMat = new THREE.MeshBasicMaterial({ color: 0x43a047, transparent: true, opacity: 0.6, depthWrite: false });
    this.foot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.footMat);
    this.foot.rotation.x = -Math.PI / 2; this.foot.position.y = 0.04; this.foot.visible = false;
    G.world.scene.add(this.foot);
    this.gridHelper = null;
    $('#buildbar').addEventListener('click', e => this.onClick(e));
  }
  get s() { return this.G.state; }

  enter() {
    this.active = true; document.body.classList.add('building');
    this.mode = null; this.renderBar();
    this.showGrid(true);
    this.G.ui.assistant('點下方設備購買，再點地板決定位置。點店裡現有的設備可以移動、旋轉或出售。', 7);
  }
  exit() {
    this.cancel(); this.active = false; document.body.classList.remove('building');
    this.showGrid(false);
  }
  showGrid(on) {
    if (this.gridHelper) { this.G.world.scene.remove(this.gridHelper); this.gridHelper = null; }
    if (!on) return;
    const g = this.G.grid, w = g.W, d = STORE_FRONT_Z - g.z0;
    const pts = [];
    for (let x = 0; x <= w; x++) pts.push(x, 0.035, g.z0, x, 0.035, STORE_FRONT_Z);
    for (let z = g.z0; z <= STORE_FRONT_Z; z++) pts.push(0, 0.035, z, w, 0.035, z);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.gridHelper = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x1f4e79, transparent: true, opacity: 0.35 }));
    this.G.world.scene.add(this.gridHelper);
  }
  renderBar() {
    const s = this.s;
    const items = Object.entries(FIXTURES).map(([k, f]) => {
      const locked = f.cats && !f.cats.some(c => s.unlocked.includes(c));
      return `<button class="bitem ${this.mode === 'new' && this.ghostType === k ? 'on' : ''} ${locked ? 'locked' : ''}" data-buy="${k}" ${locked ? `data-locked="${f.cats[0]}"` : ''}><span>${f.icon}</span><b>${f.name}</b><small>${locked ? '🔒 需先引進商品' : '$' + f.price.toLocaleString()}</small></button>`;
    }).join('');
    const sel = this.mode;
    const def = this.ghostType && FIXTURES[this.ghostType];
    let actions = '';
    if (sel) {
      actions = `<div class="bhint">${sel === 'new' ? `放置「${def.name}」：點地板選位置` : `編輯「${def.name}」：點地板移動`}</div>
        <button class="btn" data-act="rotate">⟳ 旋轉</button>
        <button class="btn primary" data-act="confirm">✔ ${sel === 'new' ? '購買放置' : '確定'}</button>
        ${sel === 'move' ? `<button class="btn danger" data-act="sell">💰 出售 $${Math.round(def.price * 0.6).toLocaleString()}</button>` : ''}
        <button class="btn" data-act="cancel">✖ 取消</button>`;
    } else {
      actions = `<div class="bhint">選擇要購買的設備，或點店內設備來編輯</div><button class="btn primary" data-act="done">完成擺設</button>`;
    }
    $('#buildbar').innerHTML = `<div class="bitems">${items}</div><div class="bactions">${actions}</div>`;
  }
  onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.locked) { const C = CATEGORIES[b.dataset.locked]; this.G.ui.toast(`要先在「商品」引進「${C.name}」才能買這個設備`); return; }
    if (b.dataset.buy) { this.startNew(b.dataset.buy); return; }
    const act = b.dataset.act;
    if (act === 'rotate') this.rotate();
    else if (act === 'confirm') this.confirm();
    else if (act === 'cancel') { this.cancel(); this.renderBar(); }
    else if (act === 'sell') this.sell();
    else if (act === 'done') this.exit();
  }
  startNew(type) {
    this.cancel();
    this.mode = 'new'; this.ghostType = type; this.r = 0;
    const t = this.G.world.controls.target;
    this.x = Math.floor(t.x); this.z = Math.floor(t.z);
    this.makeGhost();
    this.findFreeNear();
    this.renderBar(); this.updateGhost();
  }
  selectExisting(id) {
    const f = this.s.fixtures.find(x => x.id === id); if (!f) return;
    this.cancel();
    this.mode = 'move'; this.editId = id; this.ghostType = f.type; this.r = f.r; this.x = f.x; this.z = f.z;
    const obj = this.G.world.fixtureObjs.get(id); if (obj) obj.visible = false;
    this.makeGhost(); this.renderBar(); this.updateGhost();
  }
  makeGhost() {
    if (this.ghost) this.G.world.scene.remove(this.ghost);
    this.ghost = this.G.world.makeFixture(this.ghostType, true);
    this.G.world.scene.add(this.ghost);
    this.foot.visible = true;
  }
  cancel() {
    if (this.ghost) { this.G.world.scene.remove(this.ghost); this.ghost = null; }
    if (this.editId) { const o = this.G.world.fixtureObjs.get(this.editId); if (o) o.visible = true; }
    this.foot.visible = false; this.mode = null; this.editId = null; this.ghostType = null;
  }
  rotate() {
    if (!this.mode) return;
    this.r = (this.r + 1) % 4;
    this.updateGhost();
  }
  tap(cx, cy) {
    const w = this.G.world;
    if (!this.mode) {
      const hit = w.pickObject(cx, cy);
      if (hit?.fid) { this.selectExisting(hit.fid); return; }
      const t = w.pickFloor(cx, cy);
      if (t) { const f = this.s.fixtures.find(f => fixtureCells(f).some(([x, z]) => x === t.x && z === t.z)); if (f) this.selectExisting(f.id); }
      return;
    }
    const t = w.pickFloor(cx, cy); if (!t) return;
    const [fw, fd] = footprint(this.ghostType, this.r);
    this.x = Math.round(t.px - fw / 2); this.z = Math.round(t.pz - fd / 2);
    this.updateGhost();
  }
  findFreeNear() {
    for (let rad = 0; rad < 12; rad++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      const ox = this.x, oz = this.z; this.x = ox + dx; this.z = oz + dz;
      if (this.validate().ok) return;
      this.x = ox; this.z = oz;
    }
  }
  candidate() { return { id: this.editId || -1, type: this.ghostType, x: this.x, z: this.z, r: this.r }; }
  validate() {
    const s = this.s, g = this.G.grid, cand = this.candidate();
    const cells = fixtureCells(cand);
    const others = s.fixtures.filter(f => f.id !== this.editId);
    for (const [x, z] of cells) {
      if (!g.inside(x, z)) return { ok: false, why: '超出店面範圍' };
      if (x === DOOR_X && z === STORE_FRONT_Z - 1) return { ok: false, why: '不能擋住門口' };
      if (x === g.stockPoint[0] && z === g.stockPoint[1]) return { ok: false, why: '不能擋住倉庫門' };
      if (others.some(f => fixtureCells(f).some(c => c[0] === x && c[1] === z))) return { ok: false, why: '和其他設備重疊' };
    }
    // 動線檢查：所有設備都要能被走到
    const test = new Grid({ ...s, fixtures: [...others, cand] });
    const reach = test.reachableFromDoor();
    const ok = c => reach.has(c[0] + ',' + c[1]);
    if (!ok(test.stockPoint)) return { ok: false, why: '會擋住通往倉庫的路' };
    for (const f of [...others, cand]) {
      const def = FIXTURES[f.type];
      if (def.decor) continue;
      if (!frontCells(f).some(ok)) return { ok: false, why: f === cand ? '正面要留走道給客人' : `會擋住「${def.name}」的走道` };
      if (def.checkout && !backCells(f).some(ok)) return { ok: false, why: f === cand ? '收銀台後方要留位置給店員' : '會擋住收銀台後方' };
    }
    return { ok: true };
  }
  updateGhost() {
    if (!this.ghost) return;
    this.G.world.placeObj(this.ghost, this.ghostType, this.x, this.z, this.r);
    const [fw, fd] = footprint(this.ghostType, this.r);
    this.foot.scale.set(fw, fd, 1);
    this.foot.position.set(this.x + fw / 2, 0.04, this.z + fd / 2);
    const v = this.validate();
    this.footMat.color.setHex(v.ok ? 0x43a047 : 0xe53935);
    const hint = document.querySelector('#buildbar .bhint');
    if (hint) hint.textContent = v.ok ? (this.mode === 'new' ? `「${FIXTURES[this.ghostType].name}」可以放在這裡` : '可以放在這裡') : '⚠️ ' + v.why;
  }
  confirm() {
    const s = this.s, v = this.validate();
    if (!v.ok) { this.G.ui.toast('⚠️ ' + v.why); return; }
    if (this.mode === 'new') {
      const def = FIXTURES[this.ghostType];
      if (s.cash < def.price) { this.G.ui.toast('現金不足'); return; }
      s.cash -= def.price; s.stats.placed++;
      const f = { id: s.nextId++, type: this.ghostType, x: this.x, z: this.z, r: this.r, cat: !def.cats ? null : (s.unlocked.includes(def.defCat) ? def.defCat : (def.cats.find(c => s.unlocked.includes(c)) || def.cats[0])), stock: {} };
      s.fixtures.push(f);
      this.G.ui.toast(`已購買 ${def.name}`);
      this.G.ui.news('🛠️', `新增了一台「${def.name}」。`);
    } else {
      const f = s.fixtures.find(x => x.id === this.editId);
      if (f) { f.x = this.x; f.z = this.z; f.r = this.r; }
    }
    this.cancel();
    this.G.world.syncFixtures();
    this.G.sim.layoutChanged();
    this.renderBar();
  }
  sell() {
    const s = this.s, f = s.fixtures.find(x => x.id === this.editId); if (!f) return;
    if (f.type === 'counter' && s.fixtures.filter(x => x.type === 'counter').length === 1) { this.G.ui.toast('至少要保留一個收銀台'); return; }
    const refund = Math.round(FIXTURES[f.type].price * 0.6);
    s.fixtures = s.fixtures.filter(x => x !== f);
    s.cash += refund;
    this.cancel();
    this.G.world.syncFixtures();
    this.G.sim.layoutChanged();
    this.G.ui.toast(`已出售，回收 $${refund.toLocaleString()}（商品退回倉庫）`);
    this.renderBar();
  }
}

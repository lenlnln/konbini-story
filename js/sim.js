// 模擬：時間、顧客 AI、店員 AI、經濟
import {
  MIN_PER_SEC, FIXTURES, PRODUCTS, PRODUCT, CUSTOMER_TYPES, HOUR_CURVE, STORE_LEVELS, STORE_FRONT_Z, DOOR_X,
  WEATHERS, SEASONS, EVENTS, MISSIONS, THOUGHTS, CATEGORIES, DISTRICTS, UPGRADES, TYPE_SPRITES,
} from './data.js';
import { frontCells, backCells, DIRS, fixtureCells } from './path.js';
import {
  rand, randi, pick, weighted, randomName, randomLook, makeStaff, blankDay, owned, displayed, backroom,
  fixtureCount, consume, catProducts, fillFixture, save,
} from './state.js';

let AID = 1;

export class Sim {
  constructor(G) {
    this.G = G;
    this.agents = [];
    this.queues = new Map(); // counterId -> [agents]
    this.cashiers = new Map(); // counterId -> staff agent
    this.reserved = new Set(); // 'f:id' or 'd:idx'
    this.spawnAcc = 0; this.passAcc = 0; this.decideAcc = 0;
    this.lastHour = Math.floor((G.state.t % 1440) / 60);
    this.lastDay = this.day;
    G.state._basket = {};
    this.prepareDay(false);
  }
  get s() { return this.G.state; }
  get grid() { return this.G.grid; }
  get world() { return this.G.world; }
  get ui() { return this.G.ui; }
  get day() { return Math.floor(this.s.t / 1440) + 1; }
  get minOfDay() { return this.s.t % 1440; }
  get hour() { return Math.floor(this.minOfDay / 60); }

  // ───────── 主更新 ─────────
  update(simDt) {
    const s = this.s;
    s.t += simDt * MIN_PER_SEC;
    const h = this.hour;
    if (h !== this.lastHour) { this.lastHour = h; this.onHour(h); }
    if (this.day !== this.lastDay) { const ended = this.lastDay; this.lastDay = this.day; this.endDay(ended); }
    this.spawn(simDt);
    this.decideAcc += simDt;
    if (this.decideAcc > 0.4) { this.decideAcc = 0; this.staffShifts(); for (const a of this.agents) if (a.kind === 'staff' && a.state === 'idle') this.staffDecide(a); }
    for (const a of [...this.agents]) this.updateAgent(a, simDt);
    this.processCheckouts(simDt);
  }

  // ───────── 生成 ─────────
  trafficFactor() {
    const s = this.s, L = STORE_LEVELS[s.level];
    const stars = s.rating;
    const ratingF = 0.55 + (stars - 1) * 0.22;
    const signF = 1 + s.upgrades.sign * 0.15;
    const w = WEATHERS[s.weather];
    const ev = s.event ? EVENTS.find(e => e.id === s.event) : null;
    let evF = 1;
    if (ev) evF = !ev.hours || ev.hours.includes(this.hour) ? ev.traffic : 1;
    const weekend = [6, 0].includes(this.day % 7) ? 1.1 : 1;
    let compF = 1;
    if (s.competitor && !(stars >= 4.3 || this.avgPriceRatio() <= 0.97)) compF = 0.88;
    const regF = 1 + Math.min(s.regulars.length, 30) * 0.012;
    return L.traffic * ratingF * signF * w.traffic * evF * weekend * compF * regF;
  }
  avgPriceRatio() { let sum = 0; for (const p of PRODUCTS) sum += this.s.prices[p.id] / p.ref; return sum / PRODUCTS.length; }
  spawn(dt) {
    const curve = HOUR_CURVE[this.hour] * (1 + (HOUR_CURVE[(this.hour + 1) % 24] - HOUR_CURVE[this.hour]) * (this.minOfDay % 60) / 60);
    const perMin = 14 * curve * this.trafficFactor() / 60;
    this.spawnAcc += perMin * dt * MIN_PER_SEC;
    const inside = this.agents.filter(a => a.kind === 'customer' && !a.left).length;
    const maxInside = 14 + this.s.level * 7;
    if (!this.isOpen()) this.spawnAcc = 0; // 打烊中不會有新客人
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      if (inside < maxInside) this.spawnCustomer(); else this.s.today.full = (this.s.today.full || 0) + 1;
    }
    this.passAcc += 10 * (0.3 + curve) / 60 * dt * MIN_PER_SEC;
    while (this.passAcc >= 1) { this.passAcc -= 1; if (this.agents.length < 45) this.spawnPasser(); }
  }
  edgePoint(side) { const g = this.grid; return [side < 0 ? g.minX : g.maxX, STORE_FRONT_Z + randi(0, 2)]; }
  newAgent(kind, look, outfit) {
    const obj = this.world.makePerson(look, outfit);
    const a = { id: AID++, kind, obj, x: 0, z: 0, path: null, pi: 0, state: '', timer: 0, speed: 1.6 };
    obj.userData.agent = a;
    this.world.agentGroup.add(obj);
    this.agents.push(a);
    return a;
  }
  removeAgent(a) {
    this.world.agentGroup.remove(a.obj);
    this.agents = this.agents.filter(x => x !== a);
    this.ui.removeBubble(a);
    if (a.reserve) this.reserved.delete(a.reserve);
    for (const [k, v] of this.cashiers) if (v === a) this.cashiers.delete(k);
  }
  setPos(a, x, z) { a.x = x; a.z = z; a.obj.position.set(x + 0.5, 0, z + 0.5); }
  goTo(a, tx, tz) {
    const p = this.grid.find(Math.round(a.x), Math.round(a.z), tx, tz);
    if (!p) { a.path = null; return false; }
    a.path = p; a.pi = 1; return true;
  }
  spawnPasser() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const type = pick(Object.keys(CUSTOMER_TYPES));
    const T = CUSTOMER_TYPES[type];
    const a = this.newAgent('passer', randomLook(), { sprite: pick(TYPE_SPRITES[type]), scale: rand(0.95, 1.03) });
    const [sx, sz] = this.edgePoint(side);
    this.setPos(a, sx, sz);
    a.speed = T.speed * rand(0.85, 1.1);
    a.state = 'pass';
    const [ex] = this.edgePoint(-side);
    this.goTo(a, ex, sz);
  }
  chooseType() {
    const h = this.hour, s = this.s;
    const ev = s.event ? EVENTS.find(e => e.id === s.event) : null;
    const w = {};
    for (const [k, T] of Object.entries(CUSTOMER_TYPES)) {
      let v = 1;
      if (T.peaks.includes(h)) v += 3; else if (T.peaks.some(p => Math.abs(p - h) === 1)) v += 1;
      if (k === 'night' && !(h >= 21 || h <= 3)) v *= 0.15;
      if (k === 'elder' && (h >= 20 || h <= 4)) v *= 0.1;
      if (k === 'student' && (h >= 22 || h <= 5)) v *= 0.1;
      if (ev?.typeBoost?.[k]) v *= ev.typeBoost[k];
      if (k === 'resident' && [6, 0].includes(this.day % 7)) v *= 1.6;
      w[k] = v;
    }
    return weighted(w);
  }
  spawnCustomer() {
    const s = this.s;
    let type = this.chooseType(), look = randomLook(), regular = null;
    const present = new Set(this.agents.filter(a => a.regular).map(a => a.regular.name));
    const avail = s.regulars.filter(r => !present.has(r.name));
    if (avail.length && Math.random() < 0.12 + Math.min(avail.length, 10) * 0.025) {
      regular = pick(avail); type = regular.type; look = regular.look || randomLook(); regular.visits++;
    }
    const T = CUSTOMER_TYPES[type];
    const shirt = regular?.shirt ?? pick(T.shirt), pants = regular?.pants ?? pick(T.pants);
    const sprite = regular?.sprite ?? pick(TYPE_SPRITES[type]);
    const a = this.newAgent('customer', look, { sprite, scale: rand(0.95, 1.03) });
    a.sprite = sprite;
    a.ctype = type; a.regular = regular; a.lookData = look; a.shirtColor = shirt; a.pantsColor = pants;
    const side = Math.random() < 0.5 ? -1 : 1;
    const [sx, sz] = this.edgePoint(side);
    this.setPos(a, sx, sz);
    a.speed = T.speed * rand(0.9, 1.1);
    a.sat = 72 + this.comfortBonus() + (regular ? 6 : 0);
    a.budget = T.budget * rand(0.7, 1.4);
    a.basket = []; a.spent = 0; a.wait = 0; a.missed = 0; a.exitSide = Math.random() < 0.5 ? -1 : 1;
    a.thoughts = [];
    a.state = 'enter';
    a.wants = this.makeWants(T);
    this.goTo(a, DOOR_X, STORE_FRONT_Z - 1);
    if (regular) a.name = regular.name;
  }
  comfortBonus() {
    const s = this.s; let decor = 0;
    for (const f of s.fixtures) decor += FIXTURES[f.type].decor || 0;
    return Math.min(decor * 1.2, 10) + s.upgrades.light * 3 + s.upgrades.floor * 2 - Math.min(s.dirt.length * 1.5, 8);
  }
  demandMods() {
    const s = this.s, m = { ...WEATHERS[s.weather].demand };
    const ev = s.event ? EVENTS.find(e => e.id === s.event) : null;
    if (ev) for (const k in ev.demand) m[k] = (m[k] || 1) * ev.demand[k];
    const h = this.hour;
    if (h >= 6 && h <= 10) m.coffee = (m.coffee || 1) * 1.6;
    if (h >= 11 && h <= 13) m.fresh = (m.fresh || 1) * 1.6;
    return m;
  }
  makeWants(T) {
    const n = randi(T.basket[0], T.basket[1]);
    const mods = this.demandMods();
    const w = {}; for (const k in T.prefs) w[k] = T.prefs[k] * (mods[k] || 1);
    if (WEATHERS[this.s.weather].umbrella && Math.random() < 0.25) w.daily = (w.daily || 0) + 6;
    const wants = []; for (let i = 0; i < n; i++) wants.push(weighted(w));
    return wants;
  }

  // ───────── 每位角色更新 ─────────
  updateAgent(a, dt) {
    const moving = this.move(a, dt);
    this.world.animatePerson(a.obj, moving, dt, a.speed / 1.6);
    if (moving) return;
    switch (a.kind) {
      case 'passer': if (!a.path) this.removeAgent(a); break;
      case 'customer': this.customerAI(a, dt); break;
      case 'staff': this.staffAI(a, dt); break;
    }
  }
  move(a, dt) {
    if (!a.path || a.pi >= a.path.length) { if (a.path && a.pi >= a.path.length) a.path = null; return false; }
    const [tx, tz] = a.path[a.pi];
    const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
    const step = a.speed * dt;
    if (d > 0.001) { const yaw = Math.atan2(dx, dz); a.obj.rotation.y = lerpAngle(a.obj.rotation.y, yaw, Math.min(1, dt * 12)); }
    if (d <= step) { a.x = tx; a.z = tz; a.pi++; }
    else { a.x += dx / d * step; a.z += dz / d * step; }
    a.obj.position.set(a.x + 0.5, 0, a.z + 0.5);
    if (a.pi >= a.path.length) { a.path = null; return false; }
    return true;
  }
  face(a, f) {
    const cells = fixtureCells(f);
    let cx = 0, cz = 0; for (const [x, z] of cells) { cx += x; cz += z; } cx /= cells.length; cz /= cells.length;
    a.obj.rotation.y = Math.atan2(cx - a.x, cz - a.z);
  }
  say(a, text, dur = 2.2) { this.ui.bubble(a, text, dur); }

  // ───────── 顧客 ─────────
  customerAI(a, dt) {
    const s = this.s;
    switch (a.state) {
      case 'enter':
        if (a.regular) this.say(a, pick(THOUGHTS.regularHi));
        a.state = 'next';
        break;
      case 'next': {
        if (!a.wants.length) { this.toQueue(a); break; }
        const cat = a.wants.shift();
        const all = s.fixtures.filter(f => f.cat === cat && FIXTURES[f.type].cats);
        if (!all.length) { a.sat -= 5; a.missed++; break; }
        const stocked = all.filter(f => fixtureCount(f) > 0);
        const list = stocked.length ? stocked : all;
        let best = null, bestD = 1e9, bestCell = null;
        for (const f of list) for (const c of frontCells(f)) {
          if (!this.grid.walkable(c[0], c[1])) continue;
          const d = Math.hypot(c[0] - a.x, c[1] - a.z) + Math.random() * 1.5;
          if (d < bestD) { bestD = d; best = f; bestCell = c; }
        }
        if (!best) { a.sat -= 5; a.missed++; break; }
        a.target = best.id; a.targetCat = cat;
        if (!this.goTo(a, bestCell[0], bestCell[1])) { a.sat -= 3; break; }
        a.state = 'toFixture';
        break;
      }
      case 'toFixture': {
        const f = s.fixtures.find(x => x.id === a.target);
        if (!f) { a.state = 'next'; break; }
        this.face(a, f); a.state = 'browse'; a.timer = rand(1.0, 2.2);
        break;
      }
      case 'browse': {
        a.timer -= dt; if (a.timer > 0) break;
        const f = s.fixtures.find(x => x.id === a.target);
        if (f) this.pickItem(a, f);
        if (s.dirt.some(d => Math.abs(d.x - a.x) <= 2 && Math.abs(d.z - a.z) <= 2) && !a.sawDirt) { a.sawDirt = true; a.sat -= 4; if (Math.random() < 0.3) this.say(a, pick(THOUGHTS.dirty)); }
        a.state = 'next';
        break;
      }
      case 'queue': {
        a.wait += dt;
        if (a.wait > 6) a.sat -= dt * 0.9;
        if (a.wait > 10 && !a.saidQueue && Math.random() < 0.02) { a.saidQueue = true; this.say(a, pick(THOUGHTS.queue)); }
        if (a.wait > a.patience) { this.say(a, '不買了！'); this.abandon(a); }
        break;
      }
      case 'leave': if (!a.path) this.removeAgent(a); break;
    }
  }
  pickItem(a, f) {
    const s = this.s;
    const avail = Object.keys(f.stock).filter(p => f.stock[p] > 0);
    if (!avail.length) { a.sat -= 14; a.missed++; this.s.today.missed++; this.say(a, pick(THOUGHTS.noStock)); return; }
    const T = CUSTOMER_TYPES[a.ctype];
    const w = {}; for (const p of avail) w[p] = 1 / Math.pow(s.prices[p] / PRODUCT[p].ref, 2) * (p === 'umbrella' && WEATHERS[s.weather].umbrella ? 8 : 1);
    const pid = weighted(w);
    const price = s.prices[pid], ratio = price / PRODUCT[pid].ref;
    const pBuy = Math.max(0, Math.min(1, 1.15 - (ratio - 1) * 2.4 * T.sens));
    if (Math.random() > pBuy || a.spent + price > a.budget) {
      a.sat -= 8; if (Math.random() < 0.6) this.say(a, pick(THOUGHTS.expensive)); return;
    }
    if (ratio < 0.95) a.sat += 3;
    f.stock[pid]--; if (!f.stock[pid]) delete f.stock[pid];
    s._basket[pid] = (s._basket[pid] || 0) + 1;
    a.basket.push(pid); a.spent += price;
    // 有些人會順手多拿一個
    if (f.stock[pid] > 0 && Math.random() < 0.15 && a.spent + price <= a.budget) {
      f.stock[pid]--; if (!f.stock[pid]) delete f.stock[pid];
      s._basket[pid]++; a.basket.push(pid); a.spent += price;
    }
    this.world.updateFixtureStock(f);
    a.obj.userData.basket.visible = a.basket.length >= 2;
    this.world.pop(a.obj);
    if (Math.random() < 0.18) this.say(a, CATEGORIES[PRODUCT[pid].cat].icon + ' ' + PRODUCT[pid].name, 1.6);
  }
  counters() { return this.s.fixtures.filter(f => f.type === 'counter'); }
  queueSpot(c, i) {
    const fr = frontCells(c);
    const [dx, dz] = DIRS[c.r];
    let [x, z] = fr[0];
    const spot = [x, z];
    for (let k = 0; k < i; k++) {
      const nx = spot[0] + dx, nz = spot[1] + dz;
      if (this.grid.walkable(nx, nz) && this.grid.inside(nx, nz)) { spot[0] = nx; spot[1] = nz; }
      else break;
    }
    return spot;
  }
  toQueue(a) {
    if (!a.basket.length) { if (a.missed) this.say(a, pick(THOUGHTS.noStock)); this.leave(a); return; }
    const cs = this.counters().filter(c => frontCells(c).some(([x, z]) => this.grid.walkable(x, z)));
    if (!cs.length) { this.say(a, '沒有收銀台？'); this.abandon(a); return; }
    let best = cs[0], bestLen = 1e9;
    for (const c of cs) { const q = this.queues.get(c.id) || []; const l = q.length + (this.cashiers.get(c.id) ? 0 : 0.5); if (l < bestLen) { bestLen = l; best = c; } }
    const q = this.queues.get(best.id) || []; this.queues.set(best.id, q);
    q.push(a); a.counter = best.id; a.state = 'queue'; a.wait = 0;
    a.patience = 38 * (a.ctype === 'elder' ? 1.4 : a.ctype === 'office' ? 0.8 : 1) * (a.regular ? 1.3 : 1);
    this.repositionQueue(best);
  }
  repositionQueue(c) {
    const q = this.queues.get(c.id) || [];
    q.forEach((a, i) => {
      const [x, z] = this.queueSpot(c, i);
      if (a.qspot && a.qspot[0] === x && a.qspot[1] === z) return;
      a.qspot = [x, z];
      this.goTo(a, x, z);
    });
  }
  leaveQueue(a) {
    if (!a.counter) return;
    const q = this.queues.get(a.counter) || [];
    const i = q.indexOf(a); if (i >= 0) q.splice(i, 1);
    const c = this.s.fixtures.find(f => f.id === a.counter);
    a.counter = null; a.qspot = null;
    if (c) this.repositionQueue(c);
  }
  abandon(a) {
    const s = this.s;
    this.leaveQueue(a);
    for (const pid of a.basket) s._basket[pid] = Math.max(0, (s._basket[pid] || 0) - 1); // 商品回到後場
    a.basket = []; a.obj.userData.basket.visible = false;
    a.sat = Math.min(a.sat, 15);
    s.today.lost++;
    this.leave(a);
  }
  leave(a) {
    const s = this.s;
    if (!a.left) {
      a.left = true;
      a.sat = Math.max(0, Math.min(100, a.sat));
      s.sats.push(a.sat); if (s.sats.length > 60) s.sats.shift();
      s.today.satSum += a.sat; s.today.satN++;
      if (s.sats.length >= 8) {
        const avg = s.sats.reduce((x, y) => x + y, 0) / s.sats.length;
        const target = Math.max(1, Math.min(5, 1 + avg / 23));
        s.rating += (target - s.rating) * 0.08;
      }
      if (a.sat >= 80 && !a.regular && Math.random() < 0.06 && s.regulars.length < 30) {
        const r = { name: randomName(), type: a.ctype, look: a.lookData, sprite: a.sprite, visits: 1, since: this.day };
        a.name = r.name;
        s.regulars.push(r);
        this.ui.news('💛', `${r.name}（${CUSTOMER_TYPES[a.ctype].name}）很喜歡這家店，成為常客了！`);
        this.say(a, '我會再來的！', 2.5);
      } else if (a.sat >= 80 && Math.random() < 0.25) this.say(a, pick(THOUGHTS.happy));
      const dirtChance = (s.weather === 'rain' ? 0.12 : 0.035);
      if (Math.random() < dirtChance && s.dirt.length < 10) {
        const tiles = []; for (let x = 0; x < this.grid.W; x++) for (let z = this.grid.z0; z < STORE_FRONT_Z; z++) if (this.grid.walkable(x, z)) tiles.push([x, z]);
        const near = tiles.filter(([x, z]) => Math.abs(x - a.x) < 3 && Math.abs(z - a.z) < 3);
        const [dx, dz] = pick(near.length ? near : tiles);
        s.dirt.push({ x: dx, z: dz, ox: rand(-0.2, 0.2), oz: rand(-0.2, 0.2) });
        this.world.syncDirt();
      }
    }
    a.state = 'leave';
    const [ex, ez] = this.edgePoint(a.exitSide || 1);
    if (!this.goTo(a, ex, ez)) this.removeAgent(a);
  }

  // ───────── 結帳 ─────────
  processCheckouts(dt) {
    for (const c of this.counters()) {
      const q = this.queues.get(c.id); if (!q || !q.length) continue;
      const head = q[0];
      if (head.path) continue; // 還在走
      const cashier = this.cashiers.get(c.id);
      if (!cashier || cashier.state !== 'cashier') continue;
      const st = this.G.state.staff.find(x => x.id === cashier.sid);
      const per = Math.max(0.15, 0.55 - (st?.skill || 1) * 0.08 - (st?.lvl || 1) * 0.02) * (this.hasManager() ? 0.9 : 1);
      head.checkout = (head.checkout || 0) + dt;
      if (head.checkout >= 0.6 + per * head.basket.length) { this.pay(head, c, st); }
    }
  }
  manualCheckout(fid) {
    const c = this.s.fixtures.find(f => f.id === fid);
    const q = this.queues.get(fid);
    if (!c || !q || !q.length || q[0].path) return false;
    this.pay(q[0], c, null); return true;
  }
  pay(a, c, st) {
    const s = this.s;
    let total = 0, cogs = 0;
    for (const pid of a.basket) {
      total += s.prices[pid]; cogs += PRODUCT[pid].cost;
      s._basket[pid] = Math.max(0, (s._basket[pid] || 0) - 1); consume(s, pid, 1);
      s.today.sold[pid] = (s.today.sold[pid] || 0) + 1;
      const cat = PRODUCT[pid].cat; s.today.byCat[cat] = (s.today.byCat[cat] || 0) + s.prices[pid];
    }
    s.cash += total; s.today.revenue += total; s.today.cogs += cogs; s.today.items += a.basket.length; s.today.customers++;
    s.stats.totalItems += a.basket.length; s.stats.totalCustomers++; s.stats.totalRevenue += total;
    if (a.wants.length === 0 && a.missed === 0) a.sat += 6;
    if (a.wait < 5) a.sat += 3;
    this.ui.floatText(c, `+$${total}`);
    this.ui.coin();
    this.world.pop(a.obj, 0.9); const ca = st && this.staffAgent(st.id); if (ca) this.world.pop(ca.obj, 0.6);
    if (st) { st.xp += 2 + a.basket.length * 0.5; this.checkLevel(st); }
    a.basket = []; a.obj.userData.basket.visible = false;
    a.checkout = 0;
    this.leaveQueue(a);
    this.leave(a);
  }

  // ───────── 店員 ─────────
  // 營業時間
  isOpen(h = this.hour) {
    const o = this.s.hours.open, c = this.s.hours.close % 24;
    if (o === c) return true;
    return o < c ? h >= o && h < c : h >= o || h < c;
  }
  openHours() { let n = 0; for (let h = 0; h < 24; h++) if (this.isOpen(h)) n++; return n; }
  // 店員只在營業時間上班（開店前一小時先來準備）
  workHour(h) { return this.isOpen(h) || this.isOpen((h + 1) % 24); }
  onShift(st, h = this.hour) {
    if (!this.workHour(h)) return false;
    if (st.shift === 'all') return true;
    return st.shift === 'day' ? h >= 7 && h < 19 : h >= 19 || h < 7;
  }
  // 依實際上班時數算日薪
  dayWage(st) {
    let n = 0; for (let h = 0; h < 24; h++) if (this.onShift(st, h)) n++;
    const full = st.shift === 'all' ? 24 : 12;
    return Math.round(st.wage * (st.shift === 'all' ? 1.7 : 1) * n / full);
  }
  hasManager() { return this.s.staff.some(x => x.role === 'manager' && this.onShift(x)); }
  staffAgent(sid) { return this.agents.find(a => a.kind === 'staff' && a.sid === sid); }
  staffShifts(initial = false) {
    for (const st of this.s.staff) {
      const ag = this.staffAgent(st.id);
      const on = this.onShift(st);
      if (on && !ag) this.spawnStaff(st, initial);
      if (!on && ag && ag.state !== 'offduty') {
        if (['idle', 'wander', 'cashier'].includes(ag.state) && !(ag.state === 'cashier' && (this.queues.get(ag.post)?.length))) this.sendHome(ag);
      }
    }
    for (const a of this.agents) if (a.kind === 'staff' && !this.s.staff.find(x => x.id === a.sid) && a.state !== 'offduty') this.sendHome(a);
  }
  spawnStaff(st, initial) {
    const manager = st.role === 'manager';
    const a = this.newAgent('staff', st.look, { sprite: manager ? 'manager' : (st.sprite || (st.id % 2 ? 'staff_f' : 'staff_m')) });
    a.sid = st.id; a.speed = 1.5 + st.speed * 0.2 + st.lvl * 0.05;
    if (initial) {
      const spots = [];
      for (let x = 0; x < this.grid.W; x++) for (let z = this.grid.z0; z < STORE_FRONT_Z; z++) if (this.grid.walkable(x, z)) spots.push([x, z]);
      const [x, z] = pick(spots); this.setPos(a, x, z); a.state = 'idle';
    } else {
      const [sx, sz] = this.edgePoint(Math.random() < 0.5 ? -1 : 1);
      this.setPos(a, sx, sz); a.state = 'arrive'; this.goTo(a, DOOR_X, STORE_FRONT_Z - 1);
      this.say(a, '早安～上工囉！');
    }
  }
  sendHome(a) {
    this.releaseTask(a);
    a.state = 'offduty'; a.obj.userData.carry.visible = false;
    const [ex, ez] = this.edgePoint(Math.random() < 0.5 ? -1 : 1);
    if (!this.goTo(a, ex, ez)) this.removeAgent(a);
  }
  releaseTask(a) {
    if (a.reserve) { this.reserved.delete(a.reserve); a.reserve = null; }
    if (a.post) { if (this.cashiers.get(a.post) === a) this.cashiers.delete(a.post); a.post = null; }
  }
  staffDecide(a) {
    const s = this.s, st = s.staff.find(x => x.id === a.sid); if (!st) return;
    // 1. 收銀
    for (const c of this.counters()) {
      const q = this.queues.get(c.id);
      if (!q || !q.length || this.cashiers.get(c.id)) continue;
      const back = backCells(c).find(([x, z]) => this.grid.walkable(x, z));
      if (!back) continue;
      if (this.goTo(a, back[0], back[1]) || (Math.round(a.x) === back[0] && Math.round(a.z) === back[1])) {
        this.cashiers.set(c.id, a); a.post = c.id; a.state = 'toCounter'; return;
      }
    }
    // 2. 補貨
    let best = null, bestScore = 0;
    for (const f of s.fixtures) {
      const cap = FIXTURES[f.type].cap; if (!cap || !f.cat || this.reserved.has('f:' + f.id)) continue;
      const fill = fixtureCount(f) / cap;
      if (fill > 0.6) continue;
      const stock = catProducts(f.cat).reduce((n, p) => n + backroom(s, p.id), 0);
      if (stock <= 0) continue;
      const score = (1 - fill) + (fill === 0 ? 0.5 : 0);
      if (score > bestScore) { bestScore = score; best = f; }
    }
    if (best) {
      const [sx, sz] = this.grid.stockPoint;
      if (this.goTo(a, sx, sz) || (Math.round(a.x) === sx && Math.round(a.z) === sz)) {
        a.reserve = 'f:' + best.id; this.reserved.add(a.reserve); a.task = best.id; a.state = 'toStock'; return;
      }
    }
    // 3. 清潔
    const di = s.dirt.findIndex((d, i) => !this.reserved.has('d:' + d.x + ',' + d.z));
    if (di >= 0) {
      const d = s.dirt[di];
      if (this.goTo(a, d.x, d.z) || (Math.round(a.x) === d.x && Math.round(a.z) === d.z)) {
        a.reserve = 'd:' + d.x + ',' + d.z; this.reserved.add(a.reserve); a.dirt = d; a.state = 'toClean'; return;
      }
    }
    // 4. 閒晃
    if (!a.idleT || a.idleT < 0) {
      a.idleT = rand(2, 5);
      const spots = [];
      for (let x = 0; x < this.grid.W; x++) for (let z = this.grid.z0; z < STORE_FRONT_Z; z++) if (this.grid.walkable(x, z)) spots.push([x, z]);
      const [x, z] = pick(spots); this.goTo(a, x, z);
    }
  }
  staffAI(a, dt) {
    const s = this.s, st = s.staff.find(x => x.id === a.sid);
    switch (a.state) {
      case 'arrive': a.state = 'idle'; break;
      case 'idle': a.idleT = (a.idleT || 0) - dt; break;
      case 'offduty': if (!a.path) this.removeAgent(a); break;
      case 'toCounter': {
        const c = s.fixtures.find(f => f.id === a.post);
        if (!c) { this.releaseTask(a); a.state = 'idle'; break; }
        this.face(a, c); a.state = 'cashier'; a.idleQ = 0;
        if (Math.random() < 0.5) this.say(a, '歡迎光臨♪');
        break;
      }
      case 'cashier': {
        const q = this.queues.get(a.post);
        if (q && q.length) a.idleQ = 0; else a.idleQ += dt;
        if (a.idleQ > 3.5) { this.releaseTask(a); a.state = 'idle'; a.idleT = 0; }
        break;
      }
      case 'toStock': {
        const f = s.fixtures.find(x => x.id === a.task);
        if (!f) { this.releaseTask(a); a.state = 'idle'; break; }
        a.state = 'grab'; a.timer = 0.8; break;
      }
      case 'grab': {
        a.timer -= dt; if (a.timer > 0) break;
        const f = s.fixtures.find(x => x.id === a.task);
        const fr = f && frontCells(f).find(([x, z]) => this.grid.walkable(x, z));
        if (!f || !fr) { this.releaseTask(a); a.state = 'idle'; break; }
        a.obj.userData.carry.visible = true;
        this.goTo(a, fr[0], fr[1]); a.state = 'toShelf'; break;
      }
      case 'toShelf': {
        const f = s.fixtures.find(x => x.id === a.task);
        if (!f) { a.obj.userData.carry.visible = false; this.releaseTask(a); a.state = 'idle'; break; }
        this.face(a, f); a.state = 'stocking'; a.timer = 1.4 - (st?.skill || 1) * 0.15; break;
      }
      case 'stocking': {
        a.timer -= dt; if (a.timer > 0) break;
        const f = s.fixtures.find(x => x.id === a.task);
        if (f) {
          const n = fillFixture(s, f, 1, 14 + (st?.lvl || 1) * 3);
          this.world.updateFixtureStock(f); this.world.pop(a.obj, 0.8);
          if (st) { st.xp += 3; this.checkLevel(st); }
          if (n && Math.random() < 0.25) this.say(a, '補貨完成！', 1.4);
        }
        a.obj.userData.carry.visible = false;
        this.releaseTask(a); a.state = 'idle'; a.idleT = 0.5; break;
      }
      case 'toClean': a.state = 'cleaning'; a.timer = 1.8; break;
      case 'cleaning': {
        a.timer -= dt; a.obj.rotation.y += dt * 3; if (a.timer > 0) break;
        const i = s.dirt.indexOf(a.dirt); if (i >= 0) s.dirt.splice(i, 1);
        this.world.syncDirt();
        if (st) { st.xp += 2; this.checkLevel(st); }
        this.releaseTask(a); a.state = 'idle'; a.idleT = 0.5; break;
      }
    }
  }
  checkLevel(st) {
    const need = xpNeed(st.lvl);
    if (st.xp >= need && st.lvl < 10) {
      st.xp -= need; st.lvl++;
      const a = this.staffAgent(st.id); if (a) { a.speed = 1.5 + st.speed * 0.2 + st.lvl * 0.05; this.say(a, `升級了！Lv${st.lvl}`, 2.5); }
      this.ui.news('⭐', `${st.name} 升到 Lv${st.lvl}，工作更有效率了！`);
    }
  }

  // ───────── 佈置變更後 ─────────
  layoutChanged() {
    this.grid.rebuild(this.s);
    for (const a of this.agents) {
      // 被設備壓住的人移到附近空格
      if (this.grid.inside(Math.round(a.x), Math.round(a.z)) && !this.grid.walkable(Math.round(a.x), Math.round(a.z))) {
        const [x, z] = this.grid.door; this.setPos(a, x, z);
      }
      if (a.path) { const last = a.path[a.path.length - 1]; this.goTo(a, last[0], last[1]); }
    }
    for (const c of this.counters()) this.repositionQueue(c);
    for (const [cid, q] of this.queues) if (!this.s.fixtures.find(f => f.id === cid)) { for (const a of [...q]) { a.counter = null; this.toQueue(a); } this.queues.delete(cid); }
  }

  // ───────── 進貨 ─────────
  placeOrder(items, supplier) {
    const s = this.s;
    let cost = 0;
    for (const pid in items) cost += PRODUCT[pid].cost * items[pid] * (supplier === 'cheap' ? 0.9 : 1.1);
    cost = Math.round(cost + (supplier === 'fast' ? 150 : 0));
    if (cost > s.cash) return { ok: false, cost };
    s.cash -= cost; s.today.purchases += cost;
    const arrive = supplier === 'fast' ? s.t + 120 : (Math.floor(s.t / 1440) + 1) * 1440 + 7 * 60;
    s.orders.push({ id: s.nextId++, arrive, items, supplier });
    return { ok: true, cost, arrive };
  }
  checkDeliveries() {
    const s = this.s, day = this.day;
    const due = s.orders.filter(o => o.arrive <= s.t);
    if (!due.length) return;
    s.orders = s.orders.filter(o => o.arrive > s.t);
    let n = 0;
    for (const o of due) for (const pid in o.items) {
      const p = PRODUCT[pid]; const q = o.items[pid]; n += q;
      s.inventory[pid].push({ q, exp: p.life === Infinity ? 99999 : day + p.life - 1 });
    }
    this.ui.news('🚚', `貨到了！共 ${n} 件商品已送進倉庫，店員會陸續補上架。`);
  }
  autoOrder() {
    const s = this.s;
    if (!s.staff.some(x => x.role === 'manager')) return;
    const hist = s.history.slice(-3);
    const items = {};
    for (const p of PRODUCTS) {
      const avg = (hist.reduce((n, h) => n + (h.sold?.[p.id] || 0), 0) + (s.today.sold[p.id] || 0)) / (hist.length + 1);
      const pending = s.orders.reduce((n, o) => n + (o.items[p.id] || 0), 0);
      const have = owned(s, p.id) + pending;
      const perishable = p.life !== Infinity;
      const target = perishable ? Math.ceil(Math.max(6, avg * 1.15)) : Math.ceil(Math.max(30, avg * 3));
      let need = perishable ? target - pending : target - have;
      if (perishable) { // 隔天到貨，扣掉明天還沒過期的
        const tomorrow = this.day + 1; const valid = s.inventory[p.id].filter(b => b.exp >= tomorrow).reduce((n, b) => n + b.q, 0);
        need = target - valid - pending;
      }
      if (need > 0) items[p.id] = Math.ceil(need / 5) * 5;
    }
    if (!Object.keys(items).length) return;
    const r = this.placeOrder(items, 'cheap');
    if (r.ok) this.ui.news('📋', `店長已自動叫貨，花費 $${r.cost.toLocaleString()}，明早 7:00 到貨。`);
    else this.ui.news('⚠️', '店長想叫貨，但現金不夠！');
  }

  // ───────── 時間事件 ─────────
  onHour(h) {
    const was = this.isOpen((h + 23) % 24), now = this.isOpen(h);
    if (now && !was) { this.ui.news('🔑', '開門營業囉！'); this.ui.assistant('開店時間到了，今天也要加油！', 4); }
    if (!now && was) { this.ui.news('🌙', '打烊了，店裡的客人結完帳就會離開。'); }
    this.checkDeliveries();
    if (h === 22) this.autoOrder();
    this.staffShifts();
    save(this.s);
  }
  prepareDay(announce) {
    const s = this.s;
    if (!s.candidates.length || s.candidatesDay !== this.day) {
      s.candidatesDay = this.day;
      s.candidates = [makeStaff(s.nextId++), makeStaff(s.nextId++), makeStaff(s.nextId++)];
      if (Math.random() < 0.35 || this.day >= 5 && !s.staff.some(x => x.role === 'manager')) s.candidates.push(makeStaff(s.nextId++, 'manager'));
      for (const c of s.candidates) c.shift = pick(['day', 'night', 'day']);
    }
  }
  endDay(endedDay) {
    const s = this.s, T = s.today;
    // 薪資、租金
    for (const st of s.staff) T.wages += this.dayWage(st);
    T.rent = STORE_LEVELS[s.level].rent;
    // 分店收入
    const wk = [6, 0].includes(endedDay % 7);
    for (const b of s.branches) {
      const D = DISTRICTS[b.district];
      let f = 0.6 + s.rating * 0.12;
      if (b.district === 'school') f *= wk ? 0.6 : 1.15;
      if (b.district === 'business') f *= wk ? 0.5 : 1.25;
      if (b.district === 'residential') f *= wk ? 1.2 : 1;
      const inc = Math.round(D.base * f * rand(0.85, 1.15));
      b.last = inc; T.branch += inc;
    }
    // 過期報廢
    let waste = 0, wasteN = 0;
    for (const p of PRODUCTS) {
      if (p.life === Infinity) continue;
      const bs = s.inventory[p.id];
      for (const b of bs) if (b.exp <= endedDay) { waste += b.q * p.cost; wasteN += b.q; b.q = 0; }
      s.inventory[p.id] = bs.filter(b => b.q > 0);
      let excess = displayed(s, p.id) + (s._basket[p.id] || 0) - owned(s, p.id);
      for (const f of s.fixtures) { if (excess <= 0) break; const k = Math.min(excess, f.stock[p.id] || 0); if (k) { f.stock[p.id] -= k; if (!f.stock[p.id]) delete f.stock[p.id]; excess -= k; this.world.updateFixtureStock(f); } }
      if (excess > 0) { // 已在顧客手上的過期品，視同售出前已調換
        s._basket[p.id] = Math.max(0, (s._basket[p.id] || 0) - excess);
      }
    }
    T.waste = waste; T.wasteN = wasteN;
    s.cash += T.branch - T.wages - T.rent;
    const profit = T.revenue - T.cogs - T.wages - T.rent - waste + T.branch;
    const avgSat = T.satN ? T.satSum / T.satN : 0;
    const report = { day: endedDay, ...T, profit, avgSat, rating: s.rating, weather: s.weather, event: s.event };
    s.history.push({ day: endedDay, revenue: T.revenue, profit, customers: T.customers, sold: T.sold, rating: s.rating });
    if (s.history.length > 60) s.history.shift();
    // 新的一天
    s.today = blankDay();
    const newDay = this.day;
    const season = SEASONS[Math.floor((newDay - 1) / 14) % 4];
    s.weather = weighted(season.w);
    if (newDay >= 8 && !s.competitor) { s.competitor = true; this.ui.news('🏪', '對街開了一間「惠來超市」！評價夠高或價格夠低才不會被搶走客人。'); }
    s.event = null;
    if (newDay >= 3 && Math.random() < 0.35) {
      const evs = EVENTS.filter(e => !e.competitor || s.competitor);
      const ev = pick(evs); s.event = ev.id; this.ui.news('📣', ev.news);
    }
    this.ui.news(WEATHERS[s.weather].icon, `第 ${newDay} 天（${season.name}季）天氣：${WEATHERS[s.weather].name}`);
    this.prepareDay(true);
    if (s.dirt.length) { s.dirt = s.dirt.slice(0, 6); this.world.syncDirt(); }
    save(s);
    this.ui.showReport(report);
  }

  checkMissions() {
    const s = this.s;
    const m = MISSIONS[s.missionIdx];
    if (m && m.check(s)) {
      s.cash += m.reward; s.missionIdx++;
      this.ui.toast(`🎉 任務完成：${m.text}　獎勵 $${m.reward.toLocaleString()}`);
      this.ui.news('🏆', `任務完成「${m.text}」，獲得 $${m.reward.toLocaleString()}`);
      this.ui.assistant(pick(['太厲害了！繼續加油～', '店越來越有樣子了呢！', '客人們都很開心喔！']));
    }
  }
}

export function xpNeed(lvl) { return Math.round(80 * Math.pow(lvl, 1.4)); }

function lerpAngle(a, b, t) {
  let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

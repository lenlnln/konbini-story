// 介面：HUD、面板、對話泡泡、日報
import * as THREE from 'three';
import {
  CATEGORIES, PRODUCTS, PRODUCT, FIXTURES, STORE_LEVELS, UPGRADES, DISTRICTS, BRANCH_COST, MISSIONS,
  WEATHERS, EVENTS, CUSTOMER_TYPES, ASSISTANT_TIPS, SEASONS,
} from './data.js';
import { owned, displayed, backroom, fixtureCount, catProducts, fillFixture, save, exportCode, importCode, clearSave, newGame, pick, carriedCats } from './state.js';
import { footprint } from './path.js';
import { xpNeed } from './sim.js';

const $ = (sel, el = document) => el.querySelector(sel);
const money = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const pad = n => String(n).padStart(2, '0');
const stars = r => { const f = Math.round(r * 2) / 2; let s = ''; for (let i = 1; i <= 5; i++) s += f >= i ? '★' : f >= i - 0.5 ? '⯪' : '☆'; return s; };
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor(G) {
    this.G = G;
    this.bubbles = new Map();
    this.floats = [];
    this.overlay = $('#overlay');
    this.sheetEl = $('#sheet');
    this.panel = null;
    this.supplier = 'cheap';
    this.orderQty = {};
    this.cat = 'drink';
    this.prodCat = 'drink';
    this.assistantT = 0; this.warnT = 0;
    this.bind();
    this.renderNews();
  }
  get s() { return this.G.state; }
  get sim() { return this.G.sim; }

  bind() {
    document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => this.G.setSpeed(+b.dataset.speed)));
    document.querySelectorAll('#menu [data-panel]').forEach(b => b.addEventListener('click', () => this.open(b.dataset.panel)));
    $('#sheet-close').addEventListener('click', () => this.close());
    $('#sheet-backdrop').addEventListener('click', () => this.close());
    $('#side-toggle').addEventListener('click', () => document.body.classList.toggle('side-open'));
    $('#mission').addEventListener('click', () => this.open('missions'));
    $('#assistant').addEventListener('click', () => this.assistant(pick(ASSISTANT_TIPS)));
    $('#rot-l').addEventListener('click', () => this.G.rotateCam(-1));
    $('#rot-r').addEventListener('click', () => this.G.rotateCam(1));
    $('#cam-reset').addEventListener('click', () => this.G.resetCam());
    $('#clock-chip').addEventListener('click', () => this.open('hours'));
    $('#topbar .brand').addEventListener('click', () => this.open('hours'));
    this.sheetEl.addEventListener('click', e => this.onSheetClick(e));
    this.sheetEl.addEventListener('change', e => this.onSheetChange(e));
  }

  // ───────── HUD 每幀更新 ─────────
  update(dt) {
    const s = this.s, sim = this.sim;
    const mod = s.t % 1440, day = Math.floor(s.t / 1440) + 1;
    $('#v-cash').textContent = money(s.cash);
    $('#v-rev').textContent = money(s.today.revenue);
    $('#v-cust').textContent = s.today.customers;
    $('#v-rating').textContent = stars(s.rating);
    $('#v-rating-n').textContent = s.rating.toFixed(1);
    $('#v-day').textContent = `第 ${day} 天`;
    $('#v-time').textContent = `${pad(Math.floor(mod / 60))}:${pad(Math.floor(mod % 60))}`;
    $('#v-weather').textContent = WEATHERS[s.weather].icon;
    $('#store-name').textContent = s.storeName;
    const open = sim.isOpen();
    if (this._open !== open || this._prep !== s.prep) { this._prep = s.prep; this._open = open; const el = $('#v-open'); el.textContent = s.prep ? '準備中' : open ? '營業中' : '休息中'; el.classList.toggle('closed', !open); this.G.world.setOpen?.(open); }
    // 門市資訊 / 庫存
    this.sideT = (this.sideT || 0) - dt;
    if (this.sideT <= 0) { this.sideT = 0.5; this.renderSide(); this.renderMission(); if (this.panel && this.livePanels.has(this.panel)) this.refreshPanel(); }
    this.updateBubbles(dt);
    this.updateCounterButtons();
    this.updateThiefButtons();
    this.deliveryT = (this.deliveryT || 0) - dt;
    if (this.deliveryT <= 0) $('#delivery')?.classList.remove('show');
    // 小助手提醒
    this.warnT -= dt;
    if (this.warnT <= 0) { this.warnT = 25; this.checkWarnings(); }
    this.assistantT -= dt;
    if (this.assistantT <= 0 && $('#assistant').classList.contains('show')) { $('#assistant').classList.remove('show'); }
  }
  get livePanels() { return new Set(['staff', 'report', 'fixture', 'agent']); }

  renderSide() {
    const s = this.s, h = s.history.slice(-7);
    const avgTicket = s.today.customers ? s.today.revenue / s.today.customers : 0;
    $('#side-info').innerHTML = `
      <div class="row"><span>現金</span><b>${money(s.cash)}</b></div>
      <div class="row"><span>今日營收</span><b class="pos">${money(s.today.revenue)}</b></div>
      <div class="row"><span>客單價</span><b>${money(avgTicket)}</b></div>
      <div class="row"><span>顧客滿意度</span><b>${s.today.satN ? Math.round(s.today.satSum / s.today.satN) + '%' : '-'}</b></div>${s.today.satN ? `<div class="bar sat"><i style="width:${Math.round(s.today.satSum / s.today.satN)}%"></i></div>` : ''}
      <div class="row"><span>店內顧客</span><b>${this.sim.agents.filter(a => a.kind === 'customer').length} 人</b></div>
      <div class="row"><span>常客</span><b>${s.regulars.length} 位</b></div>
      ${h.length ? `<div class="spark">${h.map(x => `<i style="height:${Math.max(6, Math.min(100, x.revenue / Math.max(...h.map(y => y.revenue), 1) * 100))}%" title="第${x.day}天 ${money(x.revenue)}"></i>`).join('')}</div>` : ''}`;
    const rows = [];
    for (const [cat, c] of Object.entries(CATEGORIES)) {
      const fx = s.fixtures.filter(f => f.cat === cat && FIXTURES[f.type].cap);
      if (!fx.length) continue;
      const cap = fx.reduce((n, f) => n + FIXTURES[f.type].cap, 0);
      const shown = fx.reduce((n, f) => n + fixtureCount(f), 0);
      const back = catProducts(cat).reduce((n, p) => n + backroom(s, p.id), 0);
      const pct = shown / cap * 100;
      rows.push(`<div class="inv"><span>${c.icon} ${c.name}</span><em>${shown} / ${cap}</em><div class="bar"><i style="width:${pct}%;background:${pct < 25 ? '#ef5350' : pct < 55 ? '#ffb300' : '#43a047'}"></i></div><small>倉庫 ${back}</small></div>`);
    }
    $('#side-inv').innerHTML = rows.join('');
  }
  renderMission() {
    const m = MISSIONS[this.s.missionIdx];
    $('#mission').innerHTML = m ? `<b>🎯 任務</b><span>${esc(m.text)}</span><small>獎勵 ${money(m.reward)}</small>` : `<b>🏆 全部任務完成</b><span>你是便利商店大亨！</span>`;
  }
  news(icon, text) {
    const s = this.s, day = Math.floor(s.t / 1440) + 1, mod = s.t % 1440;
    s.news.unshift({ icon, text, when: `D${day} ${pad(Math.floor(mod / 60))}:${pad(Math.floor(mod % 60))}` });
    if (s.news.length > 30) s.news.length = 30;
    this.renderNews();
  }
  renderNews() {
    $('#side-news').innerHTML = this.s.news.slice(0, 6).map(n => `<div class="news"><span>${n.icon}</span><p>${esc(n.text)}<small>${n.when}</small></p></div>`).join('') || '<div class="muted">還沒有消息</div>';
  }
  toast(text) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3200);
  }
  assistant(text, dur = 6) {
    $('#assistant-text').textContent = text;
    $('#assistant').classList.add('show');
    this.assistantT = dur;
  }
  checkWarnings() {
    const s = this.s, sim = this.sim;
    if (s.prep) return;
    for (const [cat, c] of Object.entries(CATEGORIES)) {
      const fx = s.fixtures.filter(f => f.cat === cat && FIXTURES[f.type].cap);
      if (!fx.length) continue;
      const total = catProducts(cat).reduce((n, p) => n + backroom(s, p.id), 0) + fx.reduce((n, f) => n + fixtureCount(f), 0);
      const pending = s.orders.some(o => Object.keys(o.items).some(pid => PRODUCT[pid].cat === cat));
      if (total < 8 && !pending) { this.assistant(`${c.icon}${c.name}快賣光了！點「進貨」補一些吧。`); return; }
    }
    if (!sim.agents.some(a => a.kind === 'staff')) { this.assistant('現在店裡沒有店員！排隊的客人需要你點收銀台幫忙結帳，或去「員工」排班。'); return; }
    if (Math.random() < 0.35) this.assistant(pick(ASSISTANT_TIPS));
  }
  coin() { /* 預留音效 */ }

  // ───────── 泡泡 / 飄字 ─────────
  bubble(a, text, dur) {
    let b = this.bubbles.get(a);
    if (!b) { const el = document.createElement('div'); el.className = 'bubble'; this.overlay.appendChild(el); b = { el, a }; this.bubbles.set(a, b); }
    b.el.textContent = text; b.t = dur; b.el.classList.add('show');
  }
  removeBubble(a) {
    const b = this.bubbles.get(a); if (b) { b.el.remove(); this.bubbles.delete(a); }
    const n = this.nameTags?.get(a); if (n) { n.remove(); this.nameTags.delete(a); }
  }
  floatText(f, text) {
    const [w, d] = footprint(f.type, f.r);
    const el = document.createElement('div'); el.className = 'float'; el.textContent = text; this.overlay.appendChild(el);
    this.floats.push({ el, pos: new THREE.Vector3(f.x + w / 2, 1.6, f.z + d / 2), t: 0 });
  }
  updateBubbles(dt) {
    const w = this.G.world, v = new THREE.Vector3();
    for (const [a, b] of this.bubbles) {
      b.t -= dt;
      if (b.t <= 0) { b.el.remove(); this.bubbles.delete(a); continue; }
      v.set(a.obj.position.x, (a.obj.userData.h || 1.5) + 0.15, a.obj.position.z);
      const p = w.project(v);
      b.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      b.el.style.display = p.visible ? '' : 'none';
    }
    // 常客名牌
    this.nameTags = this.nameTags || new Map();
    for (const a of this.sim.agents) {
      if (!a.name && a.kind !== 'staff') continue;
      let el = this.nameTags.get(a);
      if (!el) { el = document.createElement('div'); el.className = 'nametag' + (a.kind === 'staff' ? ' staff' : ''); el.textContent = a.kind === 'staff' ? (this.s.staff.find(x => x.id === a.sid)?.name || '') : '💛' + a.name; this.overlay.appendChild(el); this.nameTags.set(a, el); }
      v.set(a.obj.position.x, (a.obj.userData.h || 1.5) + 0.02, a.obj.position.z);
      const p = w.project(v);
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      el.style.display = p.visible && !this.bubbles.has(a) ? '' : 'none';
    }
    for (const f of this.floats) {
      f.t += dt;
      const p = w.project(f.pos);
      f.el.style.transform = `translate(${p.x}px, ${p.y - f.t * 40}px) translate(-50%, -100%)`;
      f.el.style.opacity = String(Math.max(0, 1 - f.t / 1.4));
      if (f.t > 1.4) f.el.remove();
    }
    this.floats = this.floats.filter(f => f.t <= 1.4);
  }
  updateCounterButtons() {
    const sim = this.sim, w = this.G.world;
    this.cbtn = this.cbtn || new Map();
    const need = new Set();
    for (const c of sim.counters()) {
      const q = sim.queues.get(c.id);
      const cashier = sim.cashiers.get(c.id);
      if (!q || !q.length || q[0].path || (cashier && cashier.state === 'cashier')) continue;
      need.add(c.id);
      let el = this.cbtn.get(c.id);
      if (!el) {
        el = document.createElement('button'); el.className = 'checkout-btn'; el.innerHTML = '💁 幫忙結帳';
        el.addEventListener('click', ev => { ev.stopPropagation(); if (sim.manualCheckout(c.id)) this.G.haptic(); });
        this.overlay.appendChild(el); this.cbtn.set(c.id, el);
      }
      const [fw, fd] = footprint(c.type, c.r);
      const p = w.project(new THREE.Vector3(c.x + fw / 2, 1.8, c.z + fd / 2));
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    }
    for (const [id, el] of this.cbtn) if (!need.has(id)) { el.remove(); this.cbtn.delete(id); }
  }

  // 偷竊中的客人頭上出現「喝止」按鈕
  updateThiefButtons() {
    const sim = this.sim, w = this.G.world;
    this.tbtn = this.tbtn || new Map();
    const need = new Set(), v = new THREE.Vector3();
    for (const a of sim.agents) {
      if (a.kind !== 'customer' || a.escaped || !['sneak', 'flee'].includes(a.state)) continue;
      need.add(a);
      let el = this.tbtn.get(a);
      if (!el) {
        el = document.createElement('button'); el.className = 'stop-btn'; el.innerHTML = '🚨 喝止！';
        el.addEventListener('click', ev => { ev.stopPropagation(); if (sim.stopThief(a)) { this.G.haptic(); this.toast('🚨 「等一下！還沒結帳喔！」'); } });
        this.overlay.appendChild(el); this.tbtn.set(a, el);
      }
      v.set(a.obj.position.x, (a.obj.userData.h || 1.5) + 0.55, a.obj.position.z);
      const p = w.project(v);
      el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      el.style.display = p.visible ? '' : 'none';
    }
    for (const [a, el] of this.tbtn) if (!need.has(a)) { el.remove(); this.tbtn.delete(a); }
  }
  // 到貨通知卡
  delivery(byCat, n) {
    let el = $('#delivery');
    if (!el) { el = document.createElement('div'); el.id = 'delivery'; document.body.appendChild(el); el.addEventListener('click', () => el.classList.remove('show')); }
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `<div class="dl-head"><span class="dl-truck">🚚</span><div><b>到貨了！</b><small>共 ${n} 件商品已送進倉庫</small></div></div>
      <div class="dl-items">${rows.slice(0, 8).map(([c, q]) => `<span>${CATEGORIES[c].icon} ${CATEGORIES[c].name} <b>×${q}</b></span>`).join('')}${rows.length > 8 ? `<span>…等 ${rows.length} 類</span>` : ''}</div>
      <small class="dl-foot">${this.s.prep ? '在設備面板按「🧺 從倉庫上架」就能擺上去' : '店員會陸續補上架'}</small>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    this.deliveryT = 5;
    this.G.haptic();
    // 門口飄出「+N 件」
    const fx = document.createElement('div'); fx.className = 'float box'; fx.textContent = `📦 +${n} 件`; this.overlay.appendChild(fx);
    this.floats.push({ el: fx, pos: new THREE.Vector3(1.5, 1.4, 7.2), t: -0.2 });
  }

  // ───────── 面板 ─────────
  open(name, arg) {
    if (name === 'build') { this.close(); this.G.build.enter(); return; }
    this.panel = name; this.panelArg = arg;
    document.body.classList.add('sheet-open');
    this.refreshPanel();
    $('#sheet-body').scrollTop = 0;
  }
  close() {
    this.panel = null; document.body.classList.remove('sheet-open');
    if (this.reportOpen) { this.reportOpen = false; this.G.resumeAfterReport(); }
  }
  refreshPanel() {
    const fn = { products: this.pProducts, orders: this.pOrders, staff: this.pStaff, report: this.pReport, missions: this.pMissions, expand: this.pExpand, system: this.pSystem, hours: this.pHours, catalog: this.pCatalog, fixture: this.pFixture, agent: this.pAgent, daily: this.pDaily }[this.panel];
    if (!fn) return;
    const body = $('#sheet-body');
    const keep = body.scrollTop;
    const focused = document.activeElement && body.contains(document.activeElement) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if ((focused || body.querySelector('[data-armed]')) && this.livePanels.has(this.panel)) return;
    const [title, html] = fn.call(this, this.panelArg);
    $('#sheet-title').textContent = title;
    if (this._lastHtml === html && body.childElementCount) return; // 內容沒變就不重畫，避免按鈕按不到
    this._lastHtml = html;
    body.innerHTML = html;
    body.scrollTop = keep;
  }
  catTabs(cur, attr, list = this.s.unlocked) {
    return `<div class="tabs scroll">${list.map(k => { const c = CATEGORIES[k]; return `<button class="${k === cur ? 'on' : ''}" data-${attr}="${k}">${c.icon} ${c.name}</button>`; }).join('')}</div>`;
  }

  pProducts() {
    const s = this.s;
    if (!s.unlocked.includes(this.prodCat)) this.prodCat = s.unlocked[0];
    const cat = this.prodCat;
    const lockedN = Object.keys(CATEGORIES).filter(c => !s.unlocked.includes(c)).length;
    const carried = carriedCats(s).includes(cat);
    const rows = catProducts(cat).map(p => {
      const price = s.prices[p.id], r = price / p.ref;
      const tag = r < 0.95 ? '<em class="good">便宜</em>' : r > 1.15 ? '<em class="bad">偏貴</em>' : '<em>合理</em>';
      return `<div class="item">
        <div class="item-main"><b>${p.name}</b><small>進價 ${money(p.cost)} · 市價 ${money(p.ref)} · 架上 ${displayed(s, p.id)} · 倉庫 ${backroom(s, p.id)}${p.life !== Infinity ? ` · 保存 ${p.life} 天` : ''}</small></div>
        <div class="stepper"><button data-price="${p.id}" data-d="-5">－</button><span>${money(price)} ${tag}</span><button data-price="${p.id}" data-d="5">＋</button></div>
      </div>`;
    }).join('');
    const C = CATEGORIES[cat];
    return ['商品與定價', `<p class="hint">售價越低顧客越願意買、也越開心；售價高利潤多，但價格敏感的客人（學生、長者）會放棄購買。</p>
      <div class="btnrow"><button class="btn primary" data-gocatalog="1">📦 引進新品類${lockedN ? `（還有 ${lockedN} 類）` : ''}</button></div>
      ${this.catTabs(cat, 'pcat')}
      <p class="muted">${C.no}・${C.icon} ${C.name}：${catProducts(cat).length} 項商品・擺在${[...new Set(C.fix)].map(t => FIXTURES[t].name).join('、')}${carried ? '' : '<br>⚠️ 目前店裡沒有設備擺這一類，客人買不到。到「擺設」放一台，或點設備切換類別。'}</p>
      ${rows}
      <div class="btnrow"><button class="btn" data-allprice="1">全部恢復市價</button><button class="btn" data-allprice="0.9">全部九折</button><button class="btn" data-allprice="1.1">全部加價 10%</button></div>`];
  }
  pCatalog() {
    const s = this.s;
    const card = k => {
      const c = CATEGORIES[k], [cost, lvl] = c.unlock, have = s.unlocked.includes(k);
      const where = [...new Set(c.fix)].map(t => FIXTURES[t].name).join('、');
      const sample = catProducts(k).slice(0, 6).map(p => p.name).join('、');
      const wish = s.history.slice(-3).reduce((n, h) => n + (h.wish?.[k] || 0), 0) + (s.today.wish?.[k] || 0);
      let btn;
      if (have) btn = '<span class="tag ok">✓ 已引進</span>';
      else if (s.level < lvl) btn = `<span class="tag">🔒 需「${STORE_LEVELS[lvl].name}」</span>`;
      else btn = `<button class="btn ${s.cash >= cost ? 'primary' : ''}" data-unlock="${k}">引進 ${money(cost)}</button>`;
      return `<div class="item catcard ${have ? 'have' : ''}">
        <div class="item-main"><b>${c.no}・${c.icon} ${c.name}<small class="count">${catProducts(k).length} 項</small></b>
        <small>${sample}…</small>
        <small>擺放：${where}${c.adult ? '・未成年不販售' : ''}${c.service ? '・不用進貨' : ''}${wish ? `・<em class="bad">最近有 ${wish} 位客人想買</em>` : ''}</small></div>
        <div>${btn}</div></div>`;
    };
    const keys = Object.keys(CATEGORIES);
    const locked = keys.filter(k => !s.unlocked.includes(k)), have = keys.filter(k => s.unlocked.includes(k));
    return ['引進新品類', `<p class="hint">引進後還要有對應的設備擺放，客人才買得到。品類越多，能吸引的客群越廣，但也要更多架位和進貨資金。</p>
      ${locked.length ? `<h4>可以引進</h4>${locked.map(card).join('')}` : '<p class="hint">🎉 所有品類都引進了！</p>'}
      <h4>已引進（${have.length}）</h4>${have.map(card).join('')}`];
  }
  pOrders() {
    const s = this.s;
    const ocats = s.unlocked.filter(c => !CATEGORIES[c].service);
    if (!ocats.includes(this.cat)) this.cat = ocats[0];
    const cat = this.cat;
    const mult = this.supplier === 'cheap' ? 0.9 : 1.1;
    let total = 0;
    for (const pid in this.orderQty) total += PRODUCT[pid].cost * this.orderQty[pid] * mult;
    if (total > 0 && this.supplier === 'fast') total += 150;
    const rows = catProducts(cat).map(p => {
      const q = this.orderQty[p.id] || 0;
      return `<div class="item">
        <div class="item-main"><b>${p.name}</b><small>進價 ${money(Math.round(p.cost * mult))} · 架上 ${displayed(s, p.id)} · 倉庫 ${backroom(s, p.id)} · 昨日賣出 ${s.history.at(-1)?.sold?.[p.id] || 0}${p.life !== Infinity ? ` · ⏳${p.life}天` : ''}</small></div>
        <div class="stepper"><button data-oq="${p.id}" data-d="-1">－</button><span>${q}</span><button data-oq="${p.id}" data-d="1">＋</button><button data-oq="${p.id}" data-d="5">＋5</button></div>
      </div>`;
    }).join('');
    const pending = s.orders.map(o => {
      const n = Object.values(o.items).reduce((a, b) => a + b, 0);
      const d = Math.floor(o.arrive / 1440) + 1, m = o.arrive % 1440;
      return `<div class="muted">🚚 ${n} 件 · 預計 第${d}天 ${pad(Math.floor(m / 60))}:${pad(m % 60)} 到貨（${o.supplier === 'cheap' ? '大盛批發' : '快捷物流'}）</div>`;
    }).join('');
    return ['進貨', `${s.prep ? '<p class="hint">🔑 開店準備中：現在下單，貨會<b>馬上送到倉庫</b>。</p>' : ''}
      <div class="seg">
        <button class="${this.supplier === 'cheap' ? 'on' : ''}" data-sup="cheap"><b>大盛批發</b><small>進價 9 折 · 明早 7:00 到貨</small></button>
        <button class="${this.supplier === 'fast' ? 'on' : ''}" data-sup="fast"><b>快捷物流</b><small>進價 +10%、運費 $150 · 2 小時到貨</small></button>
      </div>
      <div class="btnrow"><button class="btn primary" data-autofill="all">一鍵補足全部庫存</button><button class="btn" data-autofill="cat">只補這一類</button><button class="btn" data-oclear="1">清空</button></div>
      ${this.catTabs(cat, 'ocat', ocats)}${rows}
      <div class="order-total">合計 <b>${money(total)}</b>　<button class="btn primary" data-order="1" ${total <= 0 ? 'disabled' : ''}>下單</button></div>
      ${pending ? `<h4>運送中</h4>${pending}` : ''}
      ${s.staff.some(x => x.role === 'manager') ? '<p class="hint">📋 已有店長：每天 22:00 會依銷量自動叫貨。</p>' : '<p class="hint">💡 雇用店長後，每天晚上會自動幫你叫貨。</p>'}`];
  }
  pStaff() {
    const s = this.s, sim = this.sim;
    const shiftName = { day: '早班 7-19', night: '晚班 19-7', all: '全天（薪水×1.7）' };
    const card = (st, hire) => {
      const ag = sim.staffAgent(st.id);
      const status = hire ? '' : ag ? ({ cashier: '收銀中', toCounter: '前往收銀台', toStock: '去倉庫拿貨', grab: '拿貨中', toShelf: '搬貨中', stocking: '補貨中', toClean: '去打掃', cleaning: '打掃中', offduty: '下班中', arrive: '上班途中' }[ag.state] || '待命') : '休息中';
      return `<div class="card">
        <div class="avatar" style="background-image:url(art/faces/${st.role === 'manager' ? 'manager' : (st.sprite || (st.id % 2 ? 'staff_f' : 'staff_m'))}.webp)"></div>
        <div class="card-main">
          <b>${esc(st.name)} <small>${st.role === 'manager' ? '店長' : '店員'}${hire ? '' : ` · Lv${st.lvl}`}</small></b>
          <small>收銀技巧 ${'★'.repeat(st.skill)}${'☆'.repeat(3 - st.skill)} · 速度 ${'★'.repeat(st.speed)}${'☆'.repeat(3 - st.speed)} · 日薪 ${money(hire ? st.wage : this.sim.dayWage(st))}</small>
          ${hire ? `<small>希望班別：${shiftName[st.shift]}</small>` : `<div class="bar thin"><i style="width:${st.xp / xpNeed(st.lvl) * 100}%"></i></div><small>${status}</small>`}
        </div>
        <div class="card-act">${hire ? `<button class="btn primary" data-hire="${st.id}">雇用</button>` :
          `<select data-shift="${st.id}">${Object.entries(shiftName).map(([k, v]) => `<option value="${k}" ${st.shift === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
           <button class="btn danger" data-fire="${st.id}">解雇</button>`}</div>
      </div>`;
    };
    return ['員工管理', `
      <p class="hint">店員會自動：①收銀 ②從倉庫補貨上架 ③打掃。每天結算時支付薪水。工作經驗會讓員工升級、變得更快。</p>
      <h4>目前員工（${s.staff.length}）</h4>${s.staff.map(st => card(st, false)).join('') || '<div class="muted">沒有員工</div>'}
      <h4>今日應徵者</h4>${s.candidates.map(st => card(st, true)).join('') || '<div class="muted">今天沒有人來應徵，明天再看看。</div>'}`];
  }
  pReport() {
    const s = this.s, T = s.today, h = s.history.slice(-7);
    const max = Math.max(1, ...h.map(x => x.revenue), T.revenue);
    const cats = Object.entries(T.byCat).sort((a, b) => b[1] - a[1]);
    const satAvg = T.satN ? T.satSum / T.satN : 0;
    return ['營業報表', `
      <div class="stats">
        <div><small>今日營收</small><b>${money(T.revenue)}</b></div>
        <div><small>毛利</small><b>${money(T.revenue - T.cogs)}</b></div>
        <div><small>來客數</small><b>${T.customers}</b></div>
        <div><small>平均滿意度</small><b>${satAvg ? Math.round(satAvg) : '-'}</b></div>
        <div><small>缺貨次數</small><b>${T.missed}</b></div>
        <div><small>流失客人</small><b>${T.lost}</b></div>
      </div>
      <h4>近 7 天營收</h4>
      <div class="chart">${[...h.map(x => ({ d: x.day, v: x.revenue, p: x.profit })), { d: Math.floor(s.t / 1440) + 1, v: T.revenue, today: true }].map(x => `<div class="col${x.today ? ' today' : ''}"><i style="height:${x.v / max * 100}%"></i><small>D${x.d}</small></div>`).join('')}</div>
      <h4>今日各類營收</h4>
      ${cats.length ? cats.map(([c, v]) => `<div class="inv"><span>${CATEGORIES[c].icon} ${CATEGORIES[c].name}</span><em>${money(v)}</em><div class="bar"><i style="width:${v / T.revenue * 100}%;background:#${CATEGORIES[c].color.toString(16).padStart(6, '0')}"></i></div></div>`).join('') : '<div class="muted">還沒有銷售</div>'}
      <h4>常客名冊（${s.regulars.length}）</h4>
      ${s.regulars.length ? s.regulars.slice().sort((a, b) => b.visits - a.visits).map(r => `<div class="row"><span>💛 ${esc(r.name)} <small>${CUSTOMER_TYPES[r.type].name}</small></span><b>來店 ${r.visits} 次</b></div>`).join('') : '<div class="muted">讓客人非常滿意，他們就會成為常客。</div>'}
      <h4>最新消息</h4>${s.news.slice(0, 15).map(n => `<div class="news"><span>${n.icon}</span><p>${esc(n.text)}<small>${n.when}</small></p></div>`).join('')}`];
  }
  pMissions() {
    const s = this.s;
    return ['任務與成就', `<p class="hint">完成任務可以拿到獎金。最終目標：從街角小店成長為擁有 5 間分店的連鎖企業！</p>
      ${MISSIONS.map((m, i) => `<div class="mission ${i < s.missionIdx ? 'done' : i === s.missionIdx ? 'cur' : ''}"><span>${i < s.missionIdx ? '✅' : i === s.missionIdx ? '🎯' : '🔒'}</span><p>${esc(m.text)}</p><b>${money(m.reward)}</b></div>`).join('')}`];
  }
  pExpand() {
    const s = this.s, next = STORE_LEVELS[s.level + 1], cur = STORE_LEVELS[s.level];
    const up = Object.entries(UPGRADES).map(([k, u]) => {
      const lv = s.upgrades[k], cost = u.levels[lv + 1];
      return `<div class="item"><div class="item-main"><b>${u.name}：${u.desc[lv]}</b><small>${u.effect}${cost ? ` · 下一級：${u.desc[lv + 1]}` : ' · 已滿級'}</small></div>
        ${cost ? `<button class="btn" data-upg="${k}">${money(cost)}</button>` : '<span class="muted">MAX</span>'}</div>`;
    }).join('');
    const canBranch = s.level >= 2;
    return ['擴張與改裝', `
      <h4>店面規模</h4>
      <div class="item"><div class="item-main"><b>目前：${cur.name}（${cur.W}×${7 - cur.z0} 格）</b><small>${next ? `下一級：${next.name}（${next.W}×${7 - next.z0} 格），人潮 ×${next.traffic}，每日租金 ${money(next.rent)}` : '已經是最大的旗艦店！'}</small></div>
        ${next ? `<button class="btn primary" data-expand="1">${money(next.cost)}</button>` : ''}</div>
      <h4>改裝</h4>${up}
      <h4>連鎖分店（${s.branches.length} / 5）</h4>
      ${s.branches.map(b => `<div class="row"><span>🏪 ${esc(b.name)} <small>${DISTRICTS[b.district].name}</small></span><b>${b.last ? '昨日 ' + money(b.last) : '剛開幕'}</b></div>`).join('')}
      ${s.branches.length < 5 ? (canBranch ? `<p class="hint">分店每天自動帶來收入，收入受總店評價影響。開店費 ${money(BRANCH_COST)}。</p>
        <div class="btnrow">${Object.entries(DISTRICTS).map(([k, d]) => `<button class="btn" data-branch="${k}"><b>${d.name}</b><br><small>${d.desc}</small></button>`).join('')}</div>`
        : '<p class="hint">🔒 擴建為「大型門市」後才能開分店。</p>') : '<p class="hint">🎉 你已經是連鎖企業了！</p>'}
      <p class="hint">🚧 增加樓層、更多裝潢樣式會在之後的版本加入。</p>`];
  }
  pHours() {
    const s = this.s, sim = this.sim, { open, close } = s.hours;
    const n = sim.openHours();
    const presets = [[0, 24, '24 小時'], [7, 23, '7:00–23:00'], [6, 24, '6:00–24:00'], [8, 22, '8:00–22:00'], [10, 2, '10:00–02:00']];
    const opt = (from, to, cur) => { let o = ''; for (let h = from; h <= to; h++) o += `<option value="${h}" ${h === cur ? 'selected' : ''}>${pad(h)}:00</option>`; return o; };
    const wages = s.staff.reduce((t, st) => t + sim.dayWage(st), 0);
    return ['營業時間', `
      <p class="hint">打烊時不會有新客人進來，店員也會下班（開店前一小時會先來準備）。薪水依實際上班時數計算，營業時間短可以省人事費，但也會少掉那段時間的生意。</p>
      <div class="row"><span>目前</span><b>${n === 24 ? '24 小時營業' : `${pad(open)}:00 – ${pad(close % 24)}:00（${n} 小時）`}</b></div>
      <div class="row"><span>店員薪資（每天）</span><b>${money(wages)}</b></div>
      <h4>快速設定</h4>
      <div class="btnrow">${presets.map(([o, c, t]) => `<button class="btn ${o === open && c % 24 === close % 24 ? 'primary' : ''}" data-hours="${o},${c}">${t}</button>`).join('')}</div>
      <h4>自訂</h4>
      <div class="btnrow hours-pick"><label>開店 <select data-hopen="1">${opt(0, 23, open)}</select></label><label>打烊 <select data-hclose="1">${opt(1, 24, close)}</select></label></div>
      <p class="muted">開店和打烊設成同一個時間就是 24 小時營業。跨過午夜也可以，例如 10:00 開到 02:00。</p>`];
  }
  setHours(o, c) {
    const s = this.s; s.hours = { open: o, close: c };
    this.sim.staffShifts();
    this.G.rebuildStore();
    const n = this.sim.openHours();
    this.news('🕐', n === 24 ? '改成 24 小時營業。' : `營業時間改為 ${pad(o)}:00 – ${pad(c % 24)}:00。`);
    save(s);
  }
  pSystem() {
    const s = this.s;
    return ['系統設定', `
      <h4>店名</h4><div class="btnrow"><input id="in-name" maxlength="8" value="${esc(s.storeName)}"><button class="btn" data-rename="1">更改</button></div>
      <h4>營業時間</h4><div class="btnrow"><button class="btn" data-gohours="1">🕐 設定營業時間</button></div>
      <h4>畫質</h4>
      <div class="btnrow"><button class="btn ${s.settings.quality === 'high' ? 'primary' : ''}" data-q="high">高畫質</button><button class="btn ${s.settings.quality === 'low' ? 'primary' : ''}" data-q="low">省電</button>
      <button class="btn ${s.settings.shadows ? 'primary' : ''}" data-shadow="1">陰影：${s.settings.shadows ? '開' : '關'}</button></div>
      <h4>存檔</h4>
      <p class="hint">遊戲會每個遊戲小時自動存在這台裝置上。換手機或備份時，可以複製「存檔碼」。</p>
      <div class="btnrow"><button class="btn" data-savenow="1">立即存檔</button><button class="btn" data-export="1">複製存檔碼</button><button class="btn" data-import="1">貼上存檔碼</button></div>
      <textarea id="savecode" placeholder="存檔碼會出現在這裡，或把存檔碼貼在這裡再按「貼上存檔碼」"></textarea>
      <h4>安裝到手機</h4>
      <p class="hint">iPhone：用 Safari 開啟 → 分享 → 「加入主畫面」。<br>Android：Chrome 選單 → 「安裝應用程式 / 加到主畫面」。<br>安裝後就算沒有網路也能玩。</p>
      <div class="btnrow"><button class="btn danger" data-newgame="1">重新開始</button></div>
      <p class="muted">便利商店物語 v0.4 · 原創作品</p>`];
  }
  pFixture(fid) {
    const s = this.s, f = s.fixtures.find(x => x.id === fid);
    if (!f) { return ['設備', '<div class="muted">設備已移除</div>']; }
    const def = FIXTURES[f.type];
    let html = `<p class="hint">${def.desc}</p>`;
    if (def.service) {
      const list = catProducts('service').filter(p => p.at === def.service);
      html += s.unlocked.includes('service') ? `<h4>提供的服務</h4>` + list.map(p => `<div class="row"><span>${p.name}</span><b>${money(s.prices[p.id])}</b></div>`).join('') : '<p class="hint">🔒 要先在「商品」引進「服務票券」才會開始營業。</p>';
    } else if (def.cats) {
      if (def.cats.length > 1) html += `<h4>擺放類別</h4><div class="tabs scroll">${def.cats.map(c => { const ok = s.unlocked.includes(c); return `<button class="${f.cat === c ? 'on' : ''} ${ok ? '' : 'locked'}" data-fcat="${c}" ${ok ? '' : 'data-lockedcat="1"'}>${ok ? '' : '🔒'}${CATEGORIES[c].icon} ${CATEGORIES[c].name}</button>`; }).join('')}</div>`;
      html += `<h4>架上商品（${fixtureCount(f)} / ${def.cap}）</h4>`;
      const list = catProducts(f.cat).filter(p => f.stock[p.id] || backroom(s, p.id));
      html += list.map(p => `<div class="row"><span>${p.name}</span><b>${f.stock[p.id] || 0} <small>倉庫 ${backroom(s, p.id)}</small></b></div>`).join('') || '<div class="muted">這一類目前沒有庫存，去進貨吧！</div>';
      html += `<div class="btnrow">${s.prep ? `<button class="btn primary" data-shelve="${f.id}">🧺 從倉庫上架</button>` : ''}<button class="btn" data-goorder="${f.cat}">去進貨</button></div>`;
      if (!s.prep) html += '<p class="hint">店員有空時會自動從倉庫補貨上架。</p>';
    }
    if (f.type === 'counter') {
      const q = this.sim.queues.get(f.id) || [];
      html += `<div class="row"><span>排隊人數</span><b>${q.length}</b></div><div class="row"><span>收銀員</span><b>${this.sim.cashiers.get(f.id) ? esc(s.staff.find(x => x.id === this.sim.cashiers.get(f.id).sid)?.name || '') : '無'}</b></div>`;
    }
    html += `<div class="btnrow"><button class="btn" data-editfix="${f.id}">移動 / 旋轉</button></div>`;
    return [def.icon + ' ' + def.name, html];
  }
  pAgent(a) {
    const s = this.s;
    if (!this.sim.agents.includes(a)) return ['', '<div class="muted">已經離開了</div>'];
    if (a.kind === 'staff') { this.panel = 'staff'; return this.pStaff(); }
    if (a.kind === 'passer') return ['路人', '<p class="hint">只是路過的行人。招牌越吸睛、評價越高，越多路人會走進來。</p>'];
    const T = CUSTOMER_TYPES[a.ctype];
    const face = a.sat >= 80 ? '😄' : a.sat >= 60 ? '🙂' : a.sat >= 40 ? '😐' : '😠';
    const st = { next: '逛逛中', toFixture: '找商品', browse: '挑選商品', queue: '排隊結帳', leave: '離開', enter: '進店', toSeat: '找位子', sit: a.sitMode === 'eat' ? '坐著吃東西' : '坐著休息', sneak: '🚨 想偷東西！', flee: '🚨 帶著商品逃跑！', caught: '被叫住了' }[a.state] || a.state;
    return [`${a.name ? '💛 ' + a.name : T.name + '顧客'}`, `
      ${a.sprite ? `<img class="char-portrait" src="art/chars/${a.sprite}.webp" alt="">` : ''}
      <div class="row"><span>類型</span><b>${T.name}${a.regular ? `（常客 · 第 ${a.regular.visits} 次來店）` : ''}</b></div>
      <div class="row"><span>狀態</span><b>${st}</b></div>
      <div class="row"><span>心情</span><b>${face} ${Math.round(Math.max(0, Math.min(100, a.sat)))}</b></div>
      <div class="row"><span>購物籃</span><b>${a.basket.map(p => PRODUCT[p].name).join('、') || '空的'}</b></div>
      <div class="row"><span>還想買</span><b>${a.wants.map(c => CATEGORIES[c].icon).join(' ') || '-'}</b></div>
      ${a.state === 'queue' ? `<div class="row"><span>已等待</span><b>${Math.round(a.wait * 4)} 分鐘</b></div>` : ''}
      ${a.thief && !a.escaped && ['browse', 'next', 'toFixture'].includes(a.state) ? '<p class="hint">👀 這位客人眼神飄來飄去，好像怪怪的…</p>' : ''}
      ${['sneak', 'flee'].includes(a.state) && !a.escaped ? `<div class="btnrow"><button class="btn danger big" data-stopthief="${a.id}">🚨 喝止！</button></div>` : ''}`];
  }
  pDaily(r) {
    const s = this.s;
    const ev = s.event ? EVENTS.find(e => e.id === s.event) : null;
    return [`第 ${r.day} 天 營業結算`, `
      <div class="stats">
        <div><small>營收</small><b>${money(r.revenue)}</b></div>
        <div><small>來客數</small><b>${r.customers}</b></div>
        <div><small>滿意度</small><b>${r.avgSat ? Math.round(r.avgSat) : '-'}</b></div>
      </div>
      <div class="row"><span>商品成本</span><b class="neg">-${money(r.cogs)}</b></div>
      <div class="row"><span>員工薪資</span><b class="neg">-${money(r.wages)}</b></div>
      <div class="row"><span>店面租金</span><b class="neg">-${money(r.rent)}</b></div>
      ${r.waste ? `<div class="row"><span>過期報廢（${r.wasteN} 件）</span><b class="neg">-${money(r.waste)}</b></div>` : ''}
      ${r.stolen ? `<div class="row"><span>商品失竊（${r.stolenN} 件）</span><b class="neg">-${money(r.stolen)}</b></div>` : ''}
      ${r.caught ? `<div class="row"><span>喝止偷竊</span><b class="pos">${r.caught} 次</b></div>` : ''}
      ${r.branch ? `<div class="row"><span>分店收入</span><b class="pos">+${money(r.branch)}</b></div>` : ''}
      <div class="row total"><span>本日淨利</span><b class="${r.profit >= 0 ? 'pos' : 'neg'}">${money(r.profit)}</b></div>
      <div class="row"><span>門市評價</span><b>${stars(s.rating)} ${s.rating.toFixed(1)}</b></div>
      <div class="row"><span>缺貨次數 / 等太久離開</span><b>${r.missed} / ${r.lost}</b></div>
      ${r.full ? `<div class="row"><span>店裡太擠、沒進來的客人</span><b>${r.full}</b></div>` : ''}
      ${r.wish && Object.keys(r.wish).length ? `<h4>顧客想買、但店裡沒賣</h4>${Object.entries(r.wish).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, n]) => `<div class="row"><span>${CATEGORIES[c].icon} ${CATEGORIES[c].name}</span><b>${n} 人</b></div>`).join('')}<p class="hint">💡 到「商品」→「引進新品類」，再放一台對應的設備就能賺到這些生意。</p>` : ''}
      <h4>明天</h4>
      <div class="row"><span>天氣</span><b>${WEATHERS[s.weather].icon} ${WEATHERS[s.weather].name}</b></div>
      ${ev ? `<div class="row"><span>活動</span><b>📣 ${ev.name}</b></div>` : ''}
      ${r.missed > 5 ? '<p class="hint">💡 今天缺貨不少，記得多進一點貨，或多請一位店員補貨。</p>' : ''}
      ${r.lost > 5 ? '<p class="hint">💡 不少客人等太久走掉了，人多的時段多排一位店員或多放一台收銀台吧。</p>' : ''}
      ${r.full > 20 ? '<p class="hint">💡 店面太小擠不下客人了！到「擴張」擴建店面吧。</p>' : ''}
      <div class="btnrow"><button class="btn primary big" data-closereport="1">開始營業 ▶</button></div>`];
  }
  showReport(r) {
    this.G.pauseForReport();
    this.reportOpen = true;
    this.open('daily', r);
  }

  // ───────── 面板事件 ─────────
  onSheetClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const s = this.s, d = b.dataset, sim = this.sim;
    if (d.stopthief) { const ag = sim.agents.find(x => x.id === +d.stopthief); if (ag && sim.stopThief(ag)) { this.G.haptic(); this.toast('🚨 「等一下！還沒結帳喔！」'); } }
    else if (d.pcat) { this.prodCat = d.pcat; }
    else if (d.ocat) { this.cat = d.ocat; }
    else if (d.price) { s.prices[d.price] = Math.max(1, s.prices[d.price] + +d.d); }
    else if (d.allprice) { for (const p of PRODUCTS) s.prices[p.id] = Math.round(p.ref * +d.allprice); }
    else if (d.sup) { this.supplier = d.sup; }
    else if (d.oq) { this.orderQty[d.oq] = Math.max(0, (this.orderQty[d.oq] || 0) + +d.d); if (!this.orderQty[d.oq]) delete this.orderQty[d.oq]; }
    else if (d.oclear) { this.orderQty = {}; }
    else if (d.autofill) {
      const cats = d.autofill === 'cat' ? [this.cat] : carriedCats(s);
      if (d.autofill === 'all') this.orderQty = {};
      for (const c of cats) { for (const p of catProducts(c)) delete this.orderQty[p.id]; Object.assign(this.orderQty, sim.planOrder(c)); }
      if (!Object.keys(this.orderQty).length) this.toast('庫存都很充足，不用補貨');
    }
    else if (d.gocatalog) { this.open('catalog'); return; }
    else if (d.shelve) { const f = s.fixtures.find(x => x.id === +d.shelve); if (f) { const n = fillFixture(s, f, 1); this.G.world.updateFixtureStock(f); this.toast(n ? `上架了 ${n} 件` : '倉庫沒有這一類的貨了，先去進貨吧'); } }
    else if (d.unlock) {
      const r = sim.unlockCat(d.unlock);
      if (r.ok) { this.toast(`引進了「${CATEGORIES[d.unlock].name}」！`); this.prodCat = d.unlock; this.cat = d.unlock; } else this.toast(r.msg);
    }
    else if (d.order) {
      const r = sim.placeOrder({ ...this.orderQty }, this.supplier);
      if (r.ok) { this.orderQty = {}; this.toast(`已下單 ${money(r.cost)}，${s.prep ? '已經送到倉庫' : this.supplier === 'cheap' ? '明早 7:00 到貨' : '2 小時後到貨'}`); }
      else this.toast(r.empty ? '還沒選要進的貨，先按「一鍵補足」或用 ＋ 加數量' : `現金不足（需要 ${money(r.cost)}）`);
    }
    else if (d.hire) {
      const st = s.candidates.find(x => x.id === +d.hire);
      if (st) {
        if (st.role === 'manager' && s.staff.some(x => x.role === 'manager')) { this.toast('已經有店長了'); return; }
        s.candidates = s.candidates.filter(x => x !== st); s.staff.push(st);
        this.news('🤝', `${st.name} 加入了團隊！`); sim.staffShifts();
      }
    }
    else if (d.fire) {
      const st = s.staff.find(x => x.id === +d.fire);
      if (st && confirmInline(b, '確定解雇？')) { s.staff = s.staff.filter(x => x !== st); this.news('👋', `${st.name} 離開了團隊。`); sim.staffShifts(); }
      else return;
    }
    else if (d.expand) {
      const next = STORE_LEVELS[s.level + 1];
      if (!next) return;
      if (s.cash < next.cost) { this.toast('現金不足'); return; }
      s.cash -= next.cost; s.level++;
      this.G.rebuildStore();
      this.news('🏗️', `店面擴建完成！升級為「${next.name}」。`);
      this.toast(`🎉 升級為「${next.name}」！`);
      this.close(); return;
    }
    else if (d.upg) {
      const u = UPGRADES[d.upg], lv = s.upgrades[d.upg], cost = u.levels[lv + 1];
      if (!cost) return; if (s.cash < cost) { this.toast('現金不足'); return; }
      s.cash -= cost; s.upgrades[d.upg]++;
      this.G.rebuildStore();
      this.news('✨', `${u.name}升級為「${u.desc[lv + 1]}」！`);
    }
    else if (d.branch) {
      if (s.cash < BRANCH_COST) { this.toast('現金不足'); return; }
      s.cash -= BRANCH_COST;
      const n = s.branches.length + 1;
      s.branches.push({ district: d.branch, name: `${s.storeName} ${DISTRICTS[d.branch].name}${n}號店`, opened: Math.floor(s.t / 1440) + 1 });
      this.news('🎊', `第 ${n} 間分店在${DISTRICTS[d.branch].name}開幕了！`);
      this.toast('🎊 分店開幕！');
    }
    else if (d.rename) {
      const v = $('#in-name').value.trim(); if (!v) return;
      s.storeName = v.slice(0, 8); this.G.rebuildStore(); this.toast('店名已更改');
    }
    else if (d.q) { s.settings.quality = d.q; this.G.world.applyQuality(); this.G.onResize(); }
    else if (d.shadow) { s.settings.shadows = !s.settings.shadows; this.G.world.applyQuality(); }
    else if (d.savenow) { this.toast(save(s) ? '已存檔' : '存檔失敗'); }
    else if (d.export) {
      const code = exportCode(s); const ta = $('#savecode'); ta.value = code; ta.select();
      navigator.clipboard?.writeText(code).then(() => this.toast('存檔碼已複製'), () => this.toast('請手動複製下方存檔碼'));
      return;
    }
    else if (d.import) {
      try { const ns = importCode($('#savecode').value); this.G.loadState(ns); this.toast('讀取成功'); this.close(); } catch (err) { this.toast('存檔碼格式不正確'); }
      return;
    }
    else if (d.newgame) { if (confirmInline(b, '確定要刪除進度重新開始？')) { clearSave(); this.G.loadState(newGame()); this.close(); } return; }
    else if (d.lockedcat) { this.toast(`還沒引進「${CATEGORIES[d.fcat].name}」，到「商品」→「引進新品類」`); return; }
    else if (d.fcat) {
      const f = s.fixtures.find(x => x.id === this.panelArg);
      if (f && f.cat !== d.fcat) { f.cat = d.fcat; f.stock = {}; this.G.world.updateFixtureStock(f); }
    }
    else if (d.goorder) { this.cat = d.goorder; this.open('orders'); return; }
    else if (d.editfix) { const id = +d.editfix; this.close(); this.G.build.enter(); this.G.build.selectExisting(id); return; }
    else if (d.closereport) { this.close(); return; }
    else if (d.gohours) { this.open('hours'); return; }
    else if (d.hours) { const [o, c] = d.hours.split(',').map(Number); this.setHours(o, c); }
    this.refreshPanel();
  }
  onSheetChange(e) {
    const t = e.target;
    if (t.dataset.hopen || t.dataset.hclose) {
      const h = this.s.hours;
      this.setHours(t.dataset.hopen ? +t.value : h.open, t.dataset.hclose ? +t.value : h.close);
      this.refreshPanel(); return;
    }
    if (t.dataset.shift) {
      const st = this.s.staff.find(x => x.id === +t.dataset.shift);
      if (st) { st.shift = t.value; this.sim.staffShifts(); this.refreshPanel(); }
    }
  }
}

// 按兩次確認（避免瀏覽器 confirm 對話框）
function confirmInline(btn, text) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1'; const old = btn.textContent; btn.textContent = text;
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = old; }, 2500);
  return false;
}

// 開店準備教學：新遊戲先不營業，讓玩家上架、進貨、熟悉介面，再自己按「開始營業」
import { FIXTURES } from './data.js';
import { fixtureCount, fillFixture, save } from './state.js';

const $ = s => document.querySelector(s);

// 每一步：標題、說明、要提示的按鈕、完成條件、是否可以直接「下一步」
const STEPS = [
  {
    id: 'camera', title: '看看你的店',
    text: '歡迎來到開店準備！現在還沒營業，慢慢來。<br>先試著移動鏡頭：<b>單指拖曳</b>移動、<b>兩指</b>旋轉和縮放，也可以按右側的 ⟲ ⟳ 轉視角。',
    hl: '#camtools', done: (T) => T.flags.cam, skip: true,
  },
  {
    id: 'fixture', title: '點一下貨架',
    text: '點店裡任何一個<b>貨架或冰箱</b>，看看上面擺了什麼、倉庫還有多少貨。',
    done: (T) => T.G.ui.panel === 'fixture',
  },
  {
    id: 'stock', title: '把商品擺上架',
    text: '架上現在是空的，貨都還在倉庫。在設備面板按<b>「🧺 從倉庫上架」</b>，把每一台設備都補起來吧！',
    action: { label: '🧺 一次全部上架', fn: (T) => T.shelveAll() },
    done: (T) => T.fillRatio() >= 0.6,
    progress: (T) => `已上架 ${Math.round(T.fillRatio() * 100)}%（目標 60%）`,
  },
  {
    id: 'order', title: '叫一批貨囤著',
    text: '倉庫剩的貨不多了。打開<b>「進貨」</b>，按<b>「一鍵補足全部庫存」</b>再按<b>「下單」</b>。<br>開店前下的訂單，批發商會<b>馬上送到</b>。',
    hl: '#menu [data-panel="orders"]', done: (T) => T.flags.ordered,
  },
  {
    id: 'price', title: '看看商品和價格',
    text: '打開<b>「商品」</b>。賣便宜一點客人開心，賣貴一點利潤高。<br>這裡也可以<b>引進新品類</b>，像炸物、甜點、3C 配件。',
    hl: '#menu [data-panel="products"]', done: (T) => T.flags.products, skip: true,
  },
  {
    id: 'staff', title: '認識店員和營業時間',
    text: '打開<b>「員工」</b>看看小葵的班表，人手不夠可以再請人。<br>點上方的<b>時鐘</b>可以設定營業時間。',
    hl: '#menu [data-panel="staff"]', done: (T) => T.flags.staff, skip: true,
  },
  {
    id: 'build', title: '調整店面配置',
    text: '按<b>「擺設」</b>可以移動、旋轉、購買或賣掉設備。現在不想改也沒關係，按「下一步」就好。',
    hl: '#menu [data-panel="build"]', done: (T) => T.flags.build, skip: true,
  },
  {
    id: 'open', title: '準備好了！',
    text: '貨上架了、倉庫也有存貨，隨時可以開門。<br>開店後客人會自己進來挑商品、排隊結帳，店員會自動補貨和收銀。',
    done: () => false,
  },
];

export class Tutorial {
  constructor(G) {
    this.G = G;
    this.el = $('#tutorial');
    this.flags = {};
    this.lastStep = -1;
    this.el.addEventListener('click', e => this.onClick(e));
    G.world.controls.addEventListener('end', () => { this.flags.cam = true; });
    if (this.s.prep) this.enter();
  }
  get s() { return this.G.state; }
  get active() { return !!this.s.prep; }

  enter() {
    const s = this.s;
    s.tut = s.tut || { step: 0 };
    document.body.classList.add('prep');
    this.G.setSpeed(0);
    this.render(true);
  }
  // 依設備容量算上架比例
  fillRatio() {
    let cap = 0, n = 0;
    for (const f of this.s.fixtures) {
      const c = FIXTURES[f.type].cap; if (!c || !f.cat || !this.s.unlocked.includes(f.cat)) continue;
      cap += c; n += fixtureCount(f);
    }
    return cap ? n / cap : 1;
  }
  shelveAll() {
    let n = 0;
    for (const f of this.s.fixtures) { n += fillFixture(this.s, f, 1); this.G.world.updateFixtureStock(f); }
    this.G.ui.toast(n ? `上架了 ${n} 件商品！` : '倉庫已經沒有可以上架的貨了，先去進貨吧');
    this.G.ui.refreshPanel();
  }
  update() {
    if (!this.active) return;
    const s = this.s, ui = this.G.ui;
    if (ui.panel === 'products' || ui.panel === 'catalog') this.flags.products = true;
    if (ui.panel === 'staff' || ui.panel === 'hours') this.flags.staff = true;
    if (this.G.build.active) this.flags.build = true;
    const st = STEPS[s.tut.step];
    if (st && st.done(this)) { s.tut.step = Math.min(STEPS.length - 1, s.tut.step + 1); this.G.haptic(); }
    this.renderT = (this.renderT || 0) - 1;
    if (this.lastStep !== s.tut.step || this.renderT <= 0) this.render();
  }
  render(force) {
    const s = this.s, i = s.tut.step, st = STEPS[i];
    this.renderT = 20;
    // 提示按鈕閃爍
    document.querySelectorAll('.tut-hl').forEach(e => e.classList.remove('tut-hl'));
    if (st.hl) document.querySelectorAll(st.hl).forEach(e => e.classList.add('tut-hl'));
    const html = `
      <div class="tut-head"><b>🔑 開店準備 ${i + 1} / ${STEPS.length}</b><button class="tut-x" data-tut="skipall">略過教學</button></div>
      <h4>${st.title}</h4>
      <p>${st.text}</p>
      ${st.progress ? `<div class="tut-prog"><i style="width:${Math.min(100, this.fillRatio() / 0.6 * 100)}%"></i><span>${st.progress(this)}</span></div>` : ''}
      <div class="tut-btns">
        ${st.action ? `<button class="btn" data-tut="action">${st.action.label}</button>` : ''}
        ${st.skip ? '<button class="btn" data-tut="next">下一步 ›</button>' : ''}
        <button class="btn ${st.id === 'open' ? 'primary big' : 'ghost'}" data-tut="open">🏪 開始營業</button>
      </div>`;
    if (force || html !== this.lastHtml) { this.el.innerHTML = html; this.lastHtml = html; }
    if (this.lastStep !== i) {
      this.lastStep = i;
      this.el.classList.remove('pop'); void this.el.offsetWidth; this.el.classList.add('pop');
    }
  }
  onClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const s = this.s, act = b.dataset.tut;
    if (act === 'action') STEPS[s.tut.step].action.fn(this);
    else if (act === 'next') s.tut.step = Math.min(STEPS.length - 1, s.tut.step + 1);
    else if (act === 'skipall') s.tut.step = STEPS.length - 1;
    else if (act === 'open') { this.openStore(); return; }
    this.render();
  }
  // 正式開門
  openStore() {
    const s = this.s, G = this.G;
    if (this.fillRatio() < 0.15 && !this.warned) {
      this.warned = true;
      G.ui.toast('架上幾乎是空的！確定要開店嗎？再按一次「開始營業」');
      return;
    }
    s.prep = false; delete s.tut;
    s.t = Math.floor(s.t / 1440) * 1440 + 7 * 60;
    document.body.classList.remove('prep');
    document.querySelectorAll('.tut-hl').forEach(e => e.classList.remove('tut-hl'));
    this.el.innerHTML = '';
    G.ui.close();
    G.ui.news('🎉', `「${s.storeName}」正式開幕了！從街角小店開始，目標是成為連鎖企業。`);
    G.setSpeed(1);
    G.sim.checkMissions(); // 立刻產生今日任務
    save(s);
    const tips = [
      [600, '開門囉！客人會自己進來挑商品、排隊結帳。點客人可以看他在想什麼喔！'],
      [8000, '收銀台排太多人時，可以點「💁 幫忙結帳」，或去「員工」多請一位店員。'],
      [16000, '左上角是今天的任務，完成會有獎金。每天打烊結算時會出現日報！'],
    ];
    for (const [ms, t] of tips) setTimeout(() => G.ui.assistant(t, 7), ms);
  }
}

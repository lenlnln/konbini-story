// 遊戲狀態：新遊戲、存檔、讀檔
import { PRODUCTS, PRODUCT, FIXTURES, SURNAMES, GIVEN, CATEGORIES, CAT_PRODUCTS, LEGACY_IDS, LEGACY_CATS, findProduct } from './data.js';

const SAVE_KEY = 'konbini-story-save-v1';

export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function weighted(obj) {
  let sum = 0; for (const k in obj) sum += obj[k];
  let r = Math.random() * sum;
  for (const k in obj) { r -= obj[k]; if (r <= 0) return k; }
  return Object.keys(obj)[0];
}
export const randomName = () => pick(SURNAMES) + pick(GIVEN);
export function randomLook() {
  return {
    skin: pick([0xf1c27d, 0xe0ac69, 0xffdbac, 0xc68642, 0xf5d0a9]),
    hair: pick([0x1b1b1b, 0x3b2314, 0x5a3825, 0x2b1b0e, 0x8d6e63, 0xb0b0b0]),
    hairStyle: randi(0, 2),
  };
}

export function makeStaff(id, role = 'clerk', fixed) {
  const skill = fixed?.skill ?? randi(1, 3);
  const speed = fixed?.speed ?? randi(1, 3);
  const base = role === 'manager' ? 1500 : 500;
  return {
    id, name: fixed?.name ?? randomName(), role, shift: fixed?.shift ?? 'day',
    skill, speed, lvl: 1, xp: 0,
    wage: base + (skill + speed) * 100 + randi(0, 6) * 10,
    look: randomLook(),
  };
}

export function newGame() {
  const s = {
    version: 2,
    unlocked: Object.keys(CATEGORIES).filter(c => CATEGORIES[c].start), // 已引進的商品類別
    storeName: '日日好商店',
    hours: { open: 0, close: 24 }, // 營業時間（open = close 視為 24 小時）
    cash: 50000, t: 6 * 60 + 30, level: 0,
    prep: true, // 開店準備（教學）中，還沒營業
    upgrades: { sign: 0, light: 0, floor: 0 },
    fixtures: [], inventory: {}, prices: {}, orders: [],
    staff: [], candidates: [], candidatesDay: 0,
    regulars: [], branches: [],
    sats: [], rating: 3.4,
    today: null, history: [],
    stats: { totalItems: 0, totalCustomers: 0, placed: 0, totalRevenue: 0 },
    missionIdx: 0,
    news: [],
    weather: 'sunny', event: null, competitor: false,
    settings: { quality: 'high', shadows: true },
    dirt: [],
    nextId: 1,
    tutorialDone: false,
  };
  s.today = blankDay();
  for (const p of PRODUCTS) { s.prices[p.id] = p.ref; s.inventory[p.id] = []; }
  const add = (type, x, z, r, cat) => {
    const f = { id: s.nextId++, type, x, z, r, cat: cat || FIXTURES[type].defCat || FIXTURES[type].cats?.[0] || null, stock: {} };
    s.fixtures.push(f);
    return f;
  };
  add('fridge', 0, 0, 0); add('fridge', 2, 0, 0); add('chiller', 4, 0, 0); add('hotcase', 6, 0, 0);
  add('shelf', 1, 2, 0, 'snack'); add('shelf', 4, 2, 0, 'instant'); add('shelf', 1, 4, 0, 'daily');
  add('counter', 6, 4, 3); add('coffee', 7, 2, 3); add('plant', 7, 6, 0); add('table', 4, 6, 0);
  // 開店庫存：每個有擺設的類別，依架位數量平均分配到各品項
  for (const cat of carriedCats(s)) {
    const cap = s.fixtures.filter(f => f.cat === cat).reduce((n, f) => n + (FIXTURES[f.type].cap || 0), 0);
    const ps = CAT_PRODUCTS[cat], perish = ps[0].life !== Infinity;
    const per = Math.max(1, Math.ceil(cap * (perish ? 1.0 : 1.1) / ps.length)); // 大約剛好擺滿架子，倉庫要靠開店前進貨
    for (const p of ps) s.inventory[p.id].push({ q: per, exp: p.life === Infinity ? 99999 : p.life });
  }
  s.staff.push(makeStaff(s.nextId++, 'clerk', { name: '林小葵', shift: 'all', skill: 2, speed: 2 }));
  s.staff[0].sprite = 'staff_f';
  s.staff[0].wage = 900;
  return s;
}

export function blankDay() {
  return { revenue: 0, cogs: 0, customers: 0, items: 0, missed: 0, lost: 0, waste: 0, purchases: 0, wages: 0, rent: 0, branch: 0, byCat: {}, sold: {}, satSum: 0, satN: 0, stolen: 0, stolenN: 0, caught: 0 };
}

// ── 庫存計算 ──
export function owned(s, pid) { let n = 0; for (const b of s.inventory[pid] || []) n += b.q; return n; }
export function displayed(s, pid) { let n = 0; for (const f of s.fixtures) n += f.stock[pid] || 0; return n; }
export function backroom(s, pid) { return Math.max(0, owned(s, pid) - displayed(s, pid) - ((s._basket && s._basket[pid]) || 0)); }
export function fixtureCount(f) { let n = 0; for (const k in f.stock) n += f.stock[k]; return n; }
export function consume(s, pid, q) {
  const bs = s.inventory[pid]; bs.sort((a, b) => a.exp - b.exp);
  while (q > 0 && bs.length) { const take = Math.min(q, bs[0].q); bs[0].q -= take; q -= take; if (bs[0].q <= 0) bs.shift(); }
}
export function catProducts(cat) { return CAT_PRODUCTS[cat] || []; }
// 店裡實際有在賣的類別（已引進、而且有設備擺放）
export function carriedCats(s) {
  const set = new Set();
  for (const f of s.fixtures) if (f.cat && s.unlocked.includes(f.cat)) set.add(f.cat);
  return [...set];
}

// 把後場庫存補到設備上（最多補 maxUnits 個），回傳補了幾個
export function fillFixture(s, f, ratio = 1, maxUnits = 999) {
  const cap = FIXTURES[f.type].cap; if (!cap || !f.cat || (s.unlocked && !s.unlocked.includes(f.cat))) return 0;
  let target = Math.floor(cap * ratio), moved = 0;
  const prods = catProducts(f.cat);
  let guard = 0;
  while (fixtureCount(f) < target && moved < maxUnits && guard++ < 500) {
    // 優先補現在架上最少的商品
    const avail = prods.map(p => [p, backroom(s, p.id)]).filter(x => x[1] > 0);
    if (!avail.length) break;
    // 架上最少的優先，同樣少就挑倉庫最多的
    avail.sort((a, b) => ((f.stock[a[0].id] || 0) - (f.stock[b[0].id] || 0)) || (b[1] - a[1]));
    const p = avail[0][0];
    f.stock[p.id] = (f.stock[p.id] || 0) + 1; moved++;
  }
  return moved;
}

export function save(s) {
  try { localStorage.setItem(SAVE_KEY, serialize(s)); return true; } catch (e) { return false; }
}
export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch (e) { return null; }
}
// v0.3 以前只有 24 項商品、7 個類別，轉換成新的商品目錄
function migrateV2(s) {
  const conv = id => (PRODUCT[id] ? id : (LEGACY_IDS[id] ? findProduct(...LEGACY_IDS[id])?.id : null));
  const inv = {};
  for (const k in s.inventory || {}) { const nid = conv(k); if (nid) (inv[nid] = inv[nid] || []).push(...s.inventory[k]); }
  s.inventory = inv;
  s.prices = {};
  for (const f of s.fixtures) {
    if (f.cat) f.cat = LEGACY_CATS[f.cat] || f.cat;
    const st = {};
    for (const k in f.stock) { const nid = conv(k); if (nid && PRODUCT[nid].cat === f.cat) st[nid] = (st[nid] || 0) + f.stock[k]; }
    f.stock = st;
  }
  for (const o of s.orders || []) { const it = {}; for (const k in o.items) { const nid = conv(k); if (nid) it[nid] = (it[nid] || 0) + o.items[k]; } o.items = it; }
  const cats = new Set(Object.keys(CATEGORIES).filter(c => CATEGORIES[c].start));
  for (const f of s.fixtures) if (f.cat) cats.add(f.cat);
  for (const k in s.inventory) if (s.inventory[k].some(b => b.q > 0)) cats.add(PRODUCT[k].cat);
  s.unlocked = [...cats];
  if (s.today) { s.today.byCat = {}; s.today.sold = {}; }
  for (const h of s.history || []) h.sold = {};
  if (s.missionIdx >= 4) s.missionIdx++; // 新增了「引進新類別」任務
  s.version = 2;
}
export function migrate(s) {
  if ((s.version || 1) < 2) migrateV2(s);
  if (s.prep === undefined) s.prep = false; // 舊存檔已經在營業了
  const fresh = newGame();
  for (const k in fresh) if (s[k] === undefined) s[k] = fresh[k];
  for (const p of PRODUCTS) { if (!s.inventory[p.id]) s.inventory[p.id] = []; if (!s.prices[p.id]) s.prices[p.id] = p.ref; }
  for (const k in s.inventory) if (!PRODUCT[k]) delete s.inventory[k];
  s.unlocked = s.unlocked.filter(c => CATEGORIES[c]);
  for (const k in s.inventory) for (const b of s.inventory[k]) if (b.exp === null) b.exp = 99999;
  for (const f of s.fixtures) for (const pid in f.stock) if (!PRODUCT[pid]) delete f.stock[pid];
  return s;
}
export function serialize(s) { return JSON.stringify(s, (k, v) => (k.startsWith('_') ? undefined : v)); }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
export function exportCode(s) { return btoa(unescape(encodeURIComponent(serialize(s)))); }
export function importCode(code) { return migrate(JSON.parse(decodeURIComponent(escape(atob(code.trim()))))); }

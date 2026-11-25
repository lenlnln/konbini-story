// 遊戲狀態：新遊戲、存檔、讀檔
import { PRODUCTS, PRODUCT, FIXTURES, SURNAMES, GIVEN } from './data.js';

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
    version: 1,
    storeName: '日日好商店',
    hours: { open: 0, close: 24 }, // 營業時間（open = close 視為 24 小時）
    cash: 50000, t: 7 * 60, level: 0,
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
  for (const p of PRODUCTS) {
    s.prices[p.id] = p.ref;
    s.inventory[p.id] = [{ q: p.life === Infinity ? 30 : 14, exp: p.life === Infinity ? 99999 : p.life }];
  }
  const add = (type, x, z, r, cat) => {
    const f = { id: s.nextId++, type, x, z, r, cat: cat || FIXTURES[type].cats?.[0] || null, stock: {} };
    s.fixtures.push(f);
    return f;
  };
  add('fridge', 0, 0, 0); add('fridge', 2, 0, 0); add('chiller', 4, 0, 0); add('hotcase', 6, 0, 0);
  add('shelf', 1, 2, 0, 'snack'); add('shelf', 4, 2, 0, 'noodle'); add('shelf', 1, 4, 0, 'daily');
  add('counter', 6, 4, 3); add('coffee', 7, 2, 3); add('plant', 7, 6, 0);
  for (const f of s.fixtures) fillFixture(s, f, 0.85);
  s.staff.push(makeStaff(s.nextId++, 'clerk', { name: '林小葵', shift: 'all', skill: 2, speed: 2 }));
  s.staff[0].sprite = 'staff_f';
  s.staff[0].wage = 900;
  return s;
}

export function blankDay() {
  return { revenue: 0, cogs: 0, customers: 0, items: 0, missed: 0, lost: 0, waste: 0, purchases: 0, wages: 0, rent: 0, branch: 0, byCat: {}, sold: {}, satSum: 0, satN: 0 };
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
export function catProducts(cat) { return PRODUCTS.filter(p => p.cat === cat); }

// 把後場庫存補到設備上（最多補 maxUnits 個），回傳補了幾個
export function fillFixture(s, f, ratio = 1, maxUnits = 999) {
  const cap = FIXTURES[f.type].cap; if (!cap || !f.cat) return 0;
  let target = Math.floor(cap * ratio), moved = 0;
  const prods = catProducts(f.cat);
  let guard = 0;
  while (fixtureCount(f) < target && moved < maxUnits && guard++ < 500) {
    // 優先補現在架上最少的商品
    const avail = prods.filter(p => backroom(s, p.id) > 0);
    if (!avail.length) break;
    avail.sort((a, b) => (f.stock[a.id] || 0) - (f.stock[b.id] || 0));
    const p = avail[0];
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
export function migrate(s) {
  const fresh = newGame();
  for (const k in fresh) if (s[k] === undefined) s[k] = fresh[k];
  for (const p of PRODUCTS) { if (!s.inventory[p.id]) s.inventory[p.id] = []; if (!s.prices[p.id]) s.prices[p.id] = p.ref; }
  for (const k in s.inventory) for (const b of s.inventory[k]) if (b.exp === null) b.exp = 99999;
  for (const f of s.fixtures) for (const pid in f.stock) if (!PRODUCT[pid]) delete f.stock[pid];
  return s;
}
export function serialize(s) { return JSON.stringify(s, (k, v) => (k.startsWith('_') ? undefined : v)); }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
export function exportCode(s) { return btoa(unescape(encodeURIComponent(serialize(s)))); }
export function importCode(code) { return migrate(JSON.parse(decodeURIComponent(escape(atob(code.trim()))))); }

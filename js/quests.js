// 店長等級與每日任務（左側「任務目標」面板的資料來源）
import { STORE_LEVELS } from './data.js';

// 店長升級所需經驗值
export const ownerNeed = lvl => Math.round(100 * Math.pow(lvl, 1.5));

// 給店長經驗值，回傳升了幾級
export function addOwnerXp(s, n, ui) {
  const o = s.owner; if (!o || n <= 0) return 0;
  o.xp += n; let ups = 0;
  while (o.xp >= ownerNeed(o.lvl)) { o.xp -= ownerNeed(o.lvl); o.lvl++; ups++; }
  if (ups && ui) {
    ui.toast(`⬆️ 店長升到 Lv.${o.lvl}！`);
    ui.news('⬆️', `店長升級到 Lv.${o.lvl}`);
    ui.assistant(`恭喜店長升到 Lv.${o.lvl}！越來越像大老闆了呢～`, 6, true);
  }
  return ups;
}

const round = (n, step) => Math.max(step, Math.round(n / step) * step);
const satAvg = T => (T.satN ? T.satSum / T.satN : 0);

// 每種任務：目前進度 cur(s)、達成條件、顯示文字
const KINDS = {
  rev: { text: q => `今日營收達到 $${q.target.toLocaleString()}`, cur: s => s.today.revenue, fmt: (c, q) => `$${Math.round(c).toLocaleString()} / $${q.target.toLocaleString()}` },
  cust: { text: q => `今日服務 ${q.target} 位顧客`, cur: s => s.today.customers, fmt: (c, q) => `${c} / ${q.target}` },
  items: { text: q => `今日賣出 ${q.target} 件商品`, cur: s => s.today.items, fmt: (c, q) => `${c} / ${q.target}` },
  sat: { text: q => `顧客滿意度達到 ${q.target}%`, cur: s => (s.today.satN >= 8 ? satAvg(s.today) : 0), fmt: (c, q) => `${c ? Math.round(c) + '%' : '—'} / ${q.target}%` },
  rating: { text: q => `店鋪評價達到 ${q.target.toFixed(1)}`, cur: s => s.rating, fmt: (c, q) => `${c.toFixed(1)} / ${q.target.toFixed(1)}` },
  fund: { text: q => `存到擴張資金 $${q.target.toLocaleString()}`, cur: s => s.cash, fmt: (c, q) => `${Math.min(100, Math.round(c / q.target * 100))}%` },
};
export const questText = q => KINDS[q.kind].text(q);
export const questCur = (s, q) => KINDS[q.kind].cur(s);
export const questFmt = (s, q) => (q.done ? '完成' : KINDS[q.kind].fmt(questCur(s, q), q));
export const questPct = (s, q) => (q.done ? 1 : Math.max(0, Math.min(1, questCur(s, q) / q.target)));

// 依店的規模與最近營業成績產生今天的三個任務
export function makeDailyQuests(s, day) {
  const h = s.history.slice(-3);
  const avgRev = h.length ? h.reduce((n, x) => n + x.revenue, 0) / h.length : 0;
  const avgCust = h.length ? h.reduce((n, x) => n + x.customers, 0) / h.length : 0;
  const lvl = s.owner?.lvl || 1;
  const list = [];
  const revT = round(Math.max(3000 + s.level * 3000, avgRev * 1.1), 500);
  list.push({ kind: 'rev', target: revT, reward: round(revT * 0.08, 100), xp: 30 + lvl * 5 });
  const second = ['cust', 'items', 'sat'][day % 3];
  if (second === 'cust') { const t = round(Math.max(40 + s.level * 30, avgCust * 1.1), 5); list.push({ kind: 'cust', target: t, reward: 300 + t * 5, xp: 25 + lvl * 4 }); }
  if (second === 'items') { const t = round(Math.max(80 + s.level * 60, avgCust * 2.2), 10); list.push({ kind: 'items', target: t, reward: 300 + t * 3, xp: 25 + lvl * 4 }); }
  if (second === 'sat') list.push({ kind: 'sat', target: 80, reward: 800, xp: 30 + lvl * 4 });
  const next = STORE_LEVELS[s.level + 1];
  if (s.rating < 4.6) list.push({ kind: 'rating', target: Math.min(4.8, Math.round((Math.max(3.5, s.rating) + 0.2) * 10) / 10), reward: 1200, xp: 40 + lvl * 5 });
  else if (next) list.push({ kind: 'fund', target: next.cost, reward: 1500, xp: 50 });
  else list.push({ kind: 'cust', target: round(Math.max(120, avgCust * 1.2), 5), reward: 2000, xp: 60 });
  for (const q of list) q.done = false;
  return { day, list };
}

// 每秒檢查一次：自動勾選完成的任務並發獎勵
export function checkDailyQuests(s, day, ui) {
  if (!s.daily || s.daily.day !== day) s.daily = makeDailyQuests(s, day);
  for (const q of s.daily.list) {
    if (q.done || questCur(s, q) < q.target) continue;
    q.done = true;
    s.cash += q.reward;
    ui.toast(`✅ 今日任務完成：${questText(q)}　+$${q.reward.toLocaleString()}`);
    ui.news('✅', `完成今日任務「${questText(q)}」，獲得 $${q.reward.toLocaleString()} 與 ${q.xp} 經驗值`);
    ui.assistant(`「${questText(q)}」達成了！獎金 $${q.reward.toLocaleString()} 已經入帳囉～`, 6, true);
    addOwnerXp(s, q.xp, ui);
  }
}

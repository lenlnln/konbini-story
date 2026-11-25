// 進入點：載入存檔、建立場景、主迴圈、輸入
import { World } from './world.js';
import { Grid } from './path.js';
import { Sim } from './sim.js';
import { UI } from './ui.js';
import { Build } from './build.js';
import { Tutorial } from './tutorial.js';
import { newGame, load, save, clearSave, serialize } from './state.js';

const canvas = document.getElementById('scene');
const G = { speed: 1, prevSpeed: 1 };
window.__game = G; // 方便除錯

let state = load();
const isNew = !state;
if (!state) state = newGame();
G.state = state;
G.grid = new Grid(state);
G.world = new World(canvas, state);
G.ui = new UI(G);
G.sim = new Sim(G);
G.build = new Build(G);
G.sim.staffShifts(true);

G.setSpeed = sp => {
  if (G.state.prep && sp > 0) { G.ui?.toast('還在開店準備中，準備好了就按「🏪 開始營業」'); sp = 0; }
  G.speed = sp; if (sp > 0) G.lastSpeed = sp;
  document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === sp));
};
G.pauseForReport = () => { G.prevSpeed = G.speed || 1; G.setSpeed(0); };
G.resumeAfterReport = () => G.setSpeed(G.prevSpeed || 1);
G.haptic = () => { try { navigator.vibrate?.(8); } catch (e) { } };
G.rebuildStore = () => {
  G.grid.rebuild(G.state);
  G.world.buildStore();
  G.world.syncFixtures();
  G.world.syncDirt();
  G.sim.layoutChanged();
  if (G.build.active) G.build.showGrid(true);
};
G.loadState = ns => {
  // 最簡單可靠的方法：存起來後重新載入頁面
  clearSave();
  try { localStorage.setItem('konbini-story-save-v1', serialize(ns)); } catch (e) { }
  location.reload();
};

// ── 鏡頭 ──
let camAnim = null;
G.rotateCam = dir => {
  const c = G.world.controls, cam = G.world.camera;
  const off = cam.position.clone().sub(c.target);
  camAnim = { from: Math.atan2(off.x, off.z), to: Math.atan2(off.x, off.z) + dir * Math.PI / 2, t: 0, r: Math.hypot(off.x, off.z), y: off.y };
};
G.resetCam = () => {
  const c = G.world.controls, b = G.world.storeBounds;
  const k = (window.innerHeight > window.innerWidth ? 1.8 : 0.88) * (0.8 + b.W / 32);
  c.target.set(b.W / 2, 0, (b.z0 + b.D) / 2 + 0.5);
  G.world.camera.position.set(b.W / 2 - 3 * k, 13 * k, (b.z0 + b.D) / 2 + 12 * k);
};

G.onResize = () => {
  const w = window.innerWidth, h = window.innerHeight;
  G.world.resize(w, h);
  document.body.classList.toggle('portrait', h > w);
};
window.addEventListener('resize', G.onResize);
G.onResize();
G.resetCam();

// ── 點擊 ──
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), n: (down?.n || 0) }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 10 && performance.now() - down.t < 400) onTap(e.clientX, e.clientY);
  down = null;
});
function onTap(x, y) {
  if (G.build.active) { G.build.tap(x, y); return; }
  const hit = G.world.pickObject(x, y);
  if (hit?.agent) { G.ui.open('agent', hit.agent); return; }
  if (hit?.fid) {
    const f = G.state.fixtures.find(f => f.id === hit.fid);
    if (f?.type === 'counter' && G.sim.manualCheckout(f.id)) { G.haptic(); return; }
    G.ui.open('fixture', hit.fid); return;
  }
  // 沒點中模型時，找最靠近點擊位置的人（手指比較好點）
  const t = G.world.pickFloor(x, y);
  if (!t) return;
  let best = null, bd = 0.9;
  for (const a of G.sim.agents) {
    if (a.kind === 'passer') continue;
    const d = Math.hypot(a.obj.position.x - t.px, a.obj.position.z - t.pz);
    if (d < bd) { bd = d; best = a; }
  }
  if (best) G.ui.open('agent', best);
}

// ── 主迴圈 ──
let last = performance.now(), missionT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (G.speed > 0) {
    let simDt = dt * G.speed;
    while (simDt > 0) { const step = Math.min(simDt, 0.05); G.sim.update(step); simDt -= step; }
  } else {
    for (const a of G.sim.agents) G.world.animatePerson(a.obj, false, dt);
  }
  missionT += dt; if (missionT > 1) { missionT = 0; if (!G.state.prep) G.sim.checkMissions(); }
  G.tutorial.update();
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt * 2.5);
    const k = camAnim.t < 0.5 ? 2 * camAnim.t * camAnim.t : 1 - Math.pow(-2 * camAnim.t + 2, 2) / 2;
    const a = camAnim.from + (camAnim.to - camAnim.from) * k, c = G.world.controls.target;
    G.world.camera.position.set(c.x + Math.sin(a) * camAnim.r, c.y + camAnim.y, c.z + Math.cos(a) * camAnim.r);
    if (camAnim.t >= 1) camAnim = null;
  }
  G.world.controls.update();
  G.world.clampTarget();
  G.world.updateWalls();
  G.world.tick(dt);
  G.world.setTimeOfDay(G.state.t % 1440, G.state.weather);
  G.ui.update(dt);
  G.world.render();
}
requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => { if (document.hidden) save(G.state); });
window.addEventListener('pagehide', () => save(G.state));

// 開場
G.tutorial = new Tutorial(G);
if (G.state.prep) {
  setTimeout(() => G.ui.assistant('店長你好！我是助理小葵。開店前，我們先一起把店準備好吧！', 7), 800);
} else {
  setTimeout(() => G.ui.assistant('歡迎回來！今天也一起努力吧～', 4), 600);
  G.setSpeed(1);
}
G.world.syncDirt();

// 離線支援
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { });
}

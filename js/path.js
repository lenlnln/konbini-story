// 格子地圖與 A* 尋路
import { FIXTURES, STORE_LEVELS, STORE_FRONT_Z, DOOR_X } from './data.js';

export const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // 旋轉 r 的面向

export function footprint(type, r) {
  const d = FIXTURES[type];
  return r % 2 === 0 ? [d.w, d.d] : [d.d, d.w];
}
export function fixtureCells(f) {
  const [w, d] = footprint(f.type, f.r);
  const cells = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) cells.push([f.x + i, f.z + j]);
  return cells;
}
// 正面格（顧客站的位置）
export function frontCells(f) {
  const [dx, dz] = DIRS[f.r];
  return fixtureCells(f).map(([x, z]) => [x + dx, z + dz]).filter(([x, z]) => !fixtureCells(f).some(c => c[0] === x && c[1] === z));
}
export function backCells(f) {
  const [dx, dz] = DIRS[f.r];
  return fixtureCells(f).map(([x, z]) => [x - dx, z - dz]);
}

export class Grid {
  constructor(state) { this.rebuild(state); }
  rebuild(state) {
    const L = STORE_LEVELS[state.level];
    this.W = L.W; this.z0 = L.z0; this.D = STORE_FRONT_Z;
    this.minX = -6; this.maxX = this.W + 5; this.minZ = this.z0; this.maxZ = this.D + 3;
    this.cols = this.maxX - this.minX + 1; this.rows = this.maxZ - this.minZ + 1;
    this.occ = new Int32Array(this.cols * this.rows).fill(-1);
    for (const f of state.fixtures) for (const [x, z] of fixtureCells(f)) {
      if (this.inBounds(x, z)) this.occ[this.idx(x, z)] = f.id;
    }
    this.stockPoint = [this.W - 1, this.z0];
    this.door = [DOOR_X, this.D - 1];
  }
  idx(x, z) { return (z - this.minZ) * this.cols + (x - this.minX); }
  inBounds(x, z) { return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ; }
  inside(x, z) { return x >= 0 && x < this.W && z >= this.z0 && z < this.D; }
  outside(x, z) { return z >= this.D && z <= this.maxZ && x >= this.minX && x <= this.maxX; }
  walkable(x, z) {
    if (!this.inBounds(x, z)) return false;
    if (z < this.D) return this.inside(x, z) && this.occ[this.idx(x, z)] < 0;
    return this.outside(x, z);
  }
  canStep(ax, az, bx, bz) {
    if (!this.walkable(bx, bz)) return false;
    const aIn = az < this.D, bIn = bz < this.D;
    if (aIn !== bIn) return ax === bx && ax === DOOR_X; // 只能從門進出
    if (ax !== bx && az !== bz) { // 斜走不能切角
      if (!this.walkable(ax, bz) || !this.walkable(bx, az)) return false;
    }
    return true;
  }
  // A*：回傳格子座標陣列（含起點）
  find(sx, sz, tx, tz) {
    sx = Math.round(sx); sz = Math.round(sz);
    if (!this.inBounds(sx, sz) || !this.inBounds(tx, tz)) return null;
    if (sx === tx && sz === tz) return [[sx, sz]];
    const N = this.cols * this.rows;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const open = [];
    const h = (x, z) => { const dx = Math.abs(x - tx), dz = Math.abs(z - tz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const s = this.idx(sx, sz);
    g[s] = 0; open.push([h(sx, sz), sx, sz]);
    const targetOk = this.walkable(tx, tz);
    let iter = 0;
    while (open.length && iter++ < 6000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, x, z] = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      const ci = this.idx(x, z);
      if (closed[ci]) continue; closed[ci] = 1;
      if (x === tx && z === tz) {
        const path = []; let k = ci;
        while (k >= 0) { path.push([(k % this.cols) + this.minX, Math.floor(k / this.cols) + this.minZ]); k = came[k]; }
        return path.reverse();
      }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const nx = x + dx, nz = z + dz;
        if (!this.inBounds(nx, nz)) continue;
        const isTarget = nx === tx && nz === tz;
        if (!(isTarget && !targetOk && Math.abs(dx) + Math.abs(dz) === 1) && !this.canStep(x, z, nx, nz)) continue;
        const ni = this.idx(nx, nz);
        if (closed[ni]) continue;
        const ng = g[ci] + (dx && dz ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; came[ni] = ci; open.push([ng + h(nx, nz), nx, nz]); }
      }
    }
    return null;
  }
  // 從門口能走到的所有格子
  reachableFromDoor() {
    const seen = new Set(); const q = [this.door]; seen.add(this.door.join(','));
    while (q.length) {
      const [x, z] = q.shift();
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz, k = nx + ',' + nz;
        if (seen.has(k) || !this.inside(nx, nz) || !this.walkable(nx, nz)) continue;
        seen.add(k); q.push([nx, nz]);
      }
    }
    return seen;
  }
}

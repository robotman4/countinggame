// Tiny "3D" renderer on the 2D canvas: blocky models made of boxes, seen through a fixed
// orthographic camera (the Crossy Road look). No WebGL and no library.
//
// World axes: x to the right, z toward the viewer, y up. One unit is about one truck-width.
// Models are lists of boxes. A box is built from a 3x4 matrix plus centre-bottom and size,
// so parts can be moved, turned and tilted (truck bed, excavator arm, crane jib).
import { shade } from './core.js';
import { INK } from './draw.js';

export const CAM = { yaw: 0.36, pitch: 0.95, S: 50, ox: 512, oy: 400 };
let cy = 1, sy = 0, cp = 1, sp = 0;
// Light comes from the top left, a bit toward the viewer.
const LIGHT = norm([-0.45, 1, 0.35]);
export function setCam(o) {
  Object.assign(CAM, o);
  cy = Math.cos(CAM.yaw); sy = Math.sin(CAM.yaw);
  cp = Math.cos(CAM.pitch); sp = Math.sin(CAM.pitch);
}
setCam({});

function norm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

// World point -> [screen x, screen y, depth]. Bigger depth is closer to the viewer.
export function proj(x, y, z) {
  const xr = x * cy - z * sy, zr = x * sy + z * cy;
  return [CAM.ox + xr * CAM.S, CAM.oy + (zr * sp - y * cp) * CAM.S, zr * cp + y * sp];
}
// Screen point -> point on the ground (y = 0).
export function unproj(px, py) {
  const xr = (px - CAM.ox) / CAM.S, zr = (py - CAM.oy) / CAM.S / sp;
  return { x: xr * cy + zr * sy, z: -xr * sy + zr * cy };
}
export const depthOf = (x, y, z) => (x * sy + z * cy) * cp + y * sp;

// ---------------- matrices (3x4, row major) ----------------
export const mI = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
export function mMul(a, b) {
  const r = new Array(12);
  for (let i = 0; i < 3; i++) {
    const o = i * 4;
    for (let j = 0; j < 3; j++) r[o + j] = a[o] * b[j] + a[o + 1] * b[4 + j] + a[o + 2] * b[8 + j];
    r[o + 3] = a[o] * b[3] + a[o + 1] * b[7] + a[o + 2] * b[11] + a[o + 3];
  }
  return r;
}
export const mT = (x, y, z) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];
export const mS = (s) => [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0];
// Turn around the vertical axis; local +x ends up pointing at (cos a, 0, sin a).
export function mRY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0]; }
// Tilt around z: the +x end goes up for positive a.
export function mRZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0]; }
// Tilt around x: the +z end goes up for positive a... (y' = y c - z s)
export function mRX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0]; }
// Chain several matrices left to right: m(A, B, C) = A * B * C.
export const m = (...ms) => ms.reduce((a, b) => mMul(a, b));
const tp = (M, x, y, z) => [M[0] * x + M[1] * y + M[2] * z + M[3], M[4] * x + M[5] * y + M[6] * z + M[7], M[8] * x + M[9] * y + M[10] * z + M[11]];

// Add a box: centre (cx, cz), bottom y0, size w (x) * h (y) * d (z), in the space of M.
// o.b = depth bias inside the model (negative draws earlier), o.top = colour of the top face.
export function box(list, M, cx, y0, cz, w, h, d, c, o) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h;
  const p = [
    tp(M, x0, y0, z0), tp(M, x1, y0, z0), tp(M, x0, y1, z0), tp(M, x1, y1, z0),
    tp(M, x0, y0, z1), tp(M, x1, y0, z1), tp(M, x0, y1, z1), tp(M, x1, y1, z1),
  ];
  list.push({ p, c, b: (o && o.b) || 0, top: o && o.top, a: o && o.a });
}

// Faces as corner indices (corner = ix | iy<<1 | iz<<2), drawn as polygons.
const FACES = [
  [2, 3, 7, 6], // top
  [0, 4, 5, 1], // bottom
  [1, 5, 7, 3], // +x
  [0, 2, 6, 4], // -x
  [4, 6, 7, 5], // +z
  [0, 1, 3, 2], // -z
];

const shadeCache = new Map();
function lit(c, amt) {
  const q = Math.round(amt * 50) / 50;
  const key = c + q;
  let v = shadeCache.get(key);
  if (!v) { v = shade(c, q); shadeCache.set(key, v); }
  return v;
}

const TOCAM = () => [sy * cp, sp, cy * cp];

// Draw a list of boxes, back to front. lw = outline width (0 for none).
export function drawBoxes(ctx, list, lw = 2) {
  const tc = TOCAM();
  for (const bx of list) {
    const p = bx.p;
    let cx = 0, cyy = 0, cz = 0;
    for (const q of p) { cx += q[0]; cyy += q[1]; cz += q[2]; }
    bx.cx = cx / 8; bx.cy = cyy / 8; bx.cz = cz / 8;
    bx.d = depthOf(bx.cx, bx.cy, bx.cz) + bx.b;
  }
  list.sort((a, b) => a.d - b.d);
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  for (const bx of list) {
    const pp = bx.p.map((q) => proj(q[0], q[1], q[2]));
    if (bx.a !== undefined) ctx.globalAlpha = bx.a;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f];
      // Outward direction: face centre minus box centre.
      let nx = 0, ny = 0, nz = 0;
      for (const i of F) { nx += bx.p[i][0]; ny += bx.p[i][1]; nz += bx.p[i][2]; }
      nx = nx / 4 - bx.cx; ny = ny / 4 - bx.cy; nz = nz / 4 - bx.cz;
      if (nx * tc[0] + ny * tc[1] + nz * tc[2] <= 1e-6) continue;
      const l = Math.hypot(nx, ny, nz) || 1;
      const k = Math.max(0, (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / l);
      const col = f === 0 && bx.top ? bx.top : bx.c;
      ctx.beginPath();
      ctx.moveTo(pp[F[0]][0], pp[F[0]][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(pp[F[i]][0], pp[F[i]][1]);
      ctx.closePath();
      ctx.fillStyle = lit(col, (k - 0.85) * 0.55);
      ctx.fill();
      if (lw) ctx.stroke();
    }
    if (bx.a !== undefined) ctx.globalAlpha = 1;
  }
}

// Draw a model built by fn(list, M) with its local origin at a screen point (icons, flying items).
export function drawModelAt(ctx, fn, sx, sy2, scale = 1, rotY = 0, lw = 2) {
  const save = { ox: CAM.ox, oy: CAM.oy, S: CAM.S };
  CAM.ox = sx; CAM.oy = sy2; CAM.S = save.S * scale;
  const list = [];
  fn(list, mRY(rotY));
  drawBoxes(ctx, list, lw);
  Object.assign(CAM, save);
}

// Soft round shadow on the ground.
export function shadow(ctx, x, z, r, a = 0.2) {
  const [sx, sy2] = proj(x, 0, z);
  ctx.beginPath();
  ctx.ellipse(sx, sy2, r * CAM.S, r * CAM.S * sp, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(30,40,20,${a})`;
  ctx.fill();
}

// Flat polygon on the ground from world [x, z] points.
export function groundPoly(ctx, pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach(([x, z], i) => { const [sx, sy2] = proj(x, 0, z); i ? ctx.lineTo(sx, sy2) : ctx.moveTo(sx, sy2); });
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}

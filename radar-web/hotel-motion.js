// Image-space coordinates keep each entrance attached to its actual window.
export const WIDTH = 1672;
export const HEIGHT = 941;
export const rectangle = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
export const clamp = n => Math.max(0, Math.min(1, n));
export const ease = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };

const rows = [
  [670, 722, 678, 728], [601, 651, 605, 655], [532, 581, 534, 584],
  [463, 511, 462, 511], [393, 443, 385, 438], [324, 374, 309, 367],
  [256, 306, 232, 292], [183, 237, 157, 215], [107, 167, 73, 136],
];
export const rooms = rows.flatMap(([lt, lb, rt, rb], floor) =>
  [[578, 704], [751, 879], [923, 1044]].map(([left, right], unit) => {
    const y = (x, a, b) => a + (b - a) * (x - 573) / (1050 - 573);
    return { id: (floor + 1) * 100 + unit + 1, floor: floor + 1, unit: unit + 1,
      points: [[left, y(left, lt, rt)], [right, y(right, lt, rt)],
        [right, y(right, lb, rb)], [left, y(left, lb, rb)]] };
  }));

// Solve a projective transform from four corresponding corners, with pivoting.
export function homography(from, to) {
  const a = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    if (Math.abs(divisor) < 1e-12) throw new Error('Degenerate hotel window');
    for (let j = col; j <= 8; j++) a[col][j] /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= 8; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return [...a.map(row => row[8]), 1];
}
export function project(h, [x, y]) {
  const d = h[6] * x + h[7] * y + 1;
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
}
export function cssMatrix(h) {
  return `matrix3d(${[h[0],h[3],0,h[6],h[1],h[4],0,h[7],0,0,1,0,h[2],h[5],0,1].join(',')})`;
}
export function overviewMatrix(w, h, focus = 0) {
  const scale = Math.max(w / WIDTH, h / HEIGHT) * (1 + .07 * focus);
  return [scale, 0, w / 2 - WIDTH * .515 * scale, 0, scale,
    h / 2 - HEIGHT * (.5 - .015 * focus) * scale, 0, 0, 1];
}
export function entryMatrix(room, w, h, amount) {
  const t = ease(amount), base = overviewMatrix(w, h, 1);
  const from = room.points.map(p => project(base, p));
  if (!t) return base;
  if (t === 1) return homography(room.points, rectangle(w, h));
  const center = from.reduce((c, p) => [c[0] + p[0] / 4, c[1] + p[1] / 4], [0, 0]);
  const fw = (from[1][0] + from[2][0] - from[0][0] - from[3][0]) / 2;
  const fh = (from[2][1] + from[3][1] - from[0][1] - from[1][1]) / 2;
  // Logarithmic zoom avoids rushing the first meters and crawling at the end.
  const zoomX = Math.pow(w / fw, t), zoomY = Math.pow(h / fh, t);
  const destination = rectangle(w, h).map(([x, y], i) => {
    const dx = (from[i][0] - center[0]) / fw, dy = (from[i][1] - center[1]) / fh;
    return [center[0] + (w / 2 - center[0]) * t + (dx * (1-t) + (x/w-.5)*t) * fw * zoomX,
      center[1] + (h / 2 - center[1]) * t + (dy * (1-t) + (y/h-.5)*t) * fh * zoomY];
  });
  return homography(room.points, destination);
}

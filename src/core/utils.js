export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function angleTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
export function angleDiff(a, b) { return (b - a + Math.PI * 3) % (Math.PI * 2) - Math.PI; }
export function lerp(a, b, t) { return a + (b - a) * t; }

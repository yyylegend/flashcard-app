export function fixJ(raw) {
  let s = raw.replace(/```json|```/g, "").trim();
  try { const r = JSON.parse(s); if (Array.isArray(r)) return r; } catch (e) { void e; }
  const a = s.indexOf("[");
  if (a < 0) return null;
  s = s.slice(a);
  try { const r = JSON.parse(s); if (Array.isArray(r)) return r; } catch (e) { void e; }
  let last = -1, d = 0, inS = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inS = !inS; continue; }
    if (inS) continue;
    if (c === "{") d++;
    if (c === "}") { d--; if (d === 0) last = i; }
  }
  if (last > 0) {
    let t = s.slice(0, last + 1) + "]";
    if (!t.startsWith("[")) t = "[" + t;
    try { const r = JSON.parse(t); if (Array.isArray(r)) return r; } catch (e) { void e; }
  }
  const objs = [];
  const re = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let m;
  while ((m = re.exec(s)) !== null) {
    try { const o = JSON.parse(m[0]); if (o.q || o.question) objs.push(o); } catch (e) { void e; }
  }
  return objs.length ? objs : null;
}

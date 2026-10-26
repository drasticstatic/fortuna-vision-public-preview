/* Fortuna's own SVG chart engine — the renderer its background analysis draws with, kept as a first-class engine beside TradingView's.
 * It renders a *scene* (bars, EMAs, boxes, rays, marks, price lines, extra paths, indicator panes) that app.js builds once for either engine.
 * Interactions: scroll to zoom, drag to pan, drag the price axis to scale, drag the time axis to zoom, double-click to fit. */
const NY = 'America/New_York';
const px = (v) => v == null || !Number.isFinite(+v) ? '—' : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Number(v).toLocaleString('en-US', {maximumFractionDigits: v >= 1000 ? 1 : v >= 100 ? 2 : v >= 10 ? 3 : 4, minimumFractionDigits: 0});
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const VIEW_N = {'5m': 120, '15m': 120, '1h': 100, '4h': 120, '1d': 120};
const IVS = {'5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5};

export function createSvgChart(svg, paneSvg, hooks = {}) {
  const view = {n: 100, end: null, follow: true, yauto: true, ylo: null, yhi: null};
  let scene = null, geo = null, drag = null;
  const reset = () => { view.n = VIEW_N[scene ? scene.iv : '1h'] || 100; view.end = null; view.follow = true; view.yauto = true; view.ylo = view.yhi = null; };
  const dash = (d) => Array.isArray(d) && d.length ? d.join(' ') : '0';
  const idx = (bars, t) => { let lo = 0, hi = bars.length - 1, j = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (bars[m].t <= t) { j = m; lo = m + 1; } else hi = m - 1; } return j; };

  function render() {
    if (!scene || !scene.bars.length) { svg.innerHTML = ''; return; }
    const all = scene.bars; view.n = Math.max(12, Math.min(view.n, all.length)); const SLACK = Math.floor(view.n * .45);
    if (view.follow || view.end == null) view.end = all.length; view.end = Math.max(view.n, Math.min(all.length + SLACK, view.end));
    const i0 = view.end - view.n, n = view.n; const slot = (k) => all[i0 + k] || null; const cs = all.slice(Math.max(0, i0), Math.min(all.length, view.end)); if (!cs.length) return;
    const W = svg.clientWidth || 900, H = svg.clientHeight || 420; svg.setAttribute('viewBox', `0 0 ${W} ${H}`); const m = {t: 14, r: 70, b: 24, l: 8};
    const hasVol = scene.vol && cs.some(c => c.v > 0); const VH = hasVol ? 54 : 0; const iw = W - m.l - m.r, ih = H - m.t - m.b - VH;
    let lo, hi; if (view.yauto || view.ylo == null) { lo = Math.min(...cs.map(c => c.l)); hi = Math.max(...cs.map(c => c.h)); const pad = (hi - lo) * .08 || Math.abs(hi) * .002 || 1; lo -= pad; hi += pad; view.ylo = lo; view.yhi = hi; } else { lo = view.ylo; hi = view.yhi; }
    const X = (i) => m.l + (i + .5) / n * iw, Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * ih; const cw = Math.max(1.5, iw / n * .62); const XT = (t) => X(idx(all, t * 1000) - i0);
    let g = `<defs><clipPath id="fv-clip"><rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih + VH}"/></clipPath></defs>`;
    const used = {l: [], r: []}; const place = (y, side) => { let yy = y; for (let k = 0; k < 8; k++) { if (used[side].every(u => Math.abs(u - yy) >= 11)) break; yy += 11; } used[side].push(yy); return yy; };
    for (let i = 0; i <= 6; i++) { const v = lo + (hi - lo) * i / 6; g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(255,255,255,.05)"/><text x="${W - m.r + 6}" y="${Y(v) + 3}" class="cx">${px(v)}</text>`; }
    let lastX = -1e9; for (let i = 0; i < n; i++) { const c = slot(i); if (!c) continue; const x = X(i); if (x - lastX < 110) continue; lastX = x; const d = new Date(c.t); const lab = scene.iv === '1d' ? d.toLocaleDateString('en-US', {timeZone: NY, month: 'short', day: 'numeric'}) : d.toLocaleString('en-US', {timeZone: NY, weekday: 'short', hour: 'numeric'}); g += `<text x="${x}" y="${H - 6}" text-anchor="middle" class="cx">${lab}</text>`; }
    const pins = {top: 0, bot: 0};
    const pin = (v, lab, col, side) => { const up = v > hi; const y = up ? m.t + 11 + pins.top++ * 12 : H - m.b - 5 - pins.bot++ * 12; const x = side === 'r' ? W - m.r - 4 : m.l + 6; g += `<text x="${x}" y="${y}" class="cx" ${side === 'r' ? 'text-anchor="end"' : ''} fill="${col}" opacity=".85">${up ? '▲' : '▼'} ${esc(lab)} ${px(v)}</text>`; };
    const hline = (v, lab, col, d, side, width) => { if (v == null) return; if (v < lo || v > hi) return pin(v, lab, col, side); g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${col}" stroke-width="${width || 1}" opacity=".8" stroke-dasharray="${d}"/>`; g += side === 'r' ? `<text x="${W - m.r - 4}" y="${place(Y(v) - 3, 'r')}" text-anchor="end" class="cx" fill="${col}">${esc(lab)}</text>` : `<text x="${m.l + 6}" y="${place(Y(v) + 10, 'l')}" class="cx" fill="${col}">${esc(lab)}</text>`; };
    (scene.lines || []).forEach(l => hline(l.price, `${l.title} ${px(l.price)}`, l.color, l.style === 'solid' ? '0' : l.style === 'dotted' ? '2 3' : '6 4', l.side || 'r', l.width));
    g += '<g clip-path="url(#fv-clip)">';
    (scene.boxes || []).forEach(b => { const top = Math.max(b.p0, b.p1), bot = Math.min(b.p0, b.p1); if (top < lo || bot > hi) { if (b.label) pin(bot > hi ? bot : top, b.label, b.stroke || b.fill, 'l'); return; } const x0 = b.t0 != null ? Math.max(m.l, XT(b.t0) - cw / 2) : m.l, x1 = b.t1 != null ? Math.min(W - m.r, XT(b.t1)) : W - m.r; const yT = Y(Math.min(hi, top)), yB = Y(Math.max(lo, bot)); g += `<rect x="${x0}" y="${yT}" width="${Math.max(2, x1 - x0)}" height="${Math.max(1, yB - yT)}" fill="${b.fill}" ${b.stroke ? `stroke="${b.stroke}" stroke-dasharray="${dash(b.dash)}"` : ''}/>`; if (b.label) g += `<text x="${x0 + 6}" y="${place(Math.max(m.t + 10, yT - 4), 'l')}" class="cx" fill="${b.stroke || b.fill}">${esc(b.label)}</text>`; });
    (scene.rays || []).forEach(r => { if (r.price < lo || r.price > hi) return; const x0 = r.t0 != null ? Math.max(m.l, XT(r.t0)) : m.l; g += `<line x1="${x0}" x2="${W - m.r}" y1="${Y(r.price)}" y2="${Y(r.price)}" stroke="${r.color}" stroke-width="${r.width || 1}" stroke-dasharray="${dash(r.dash)}" opacity="${r.alpha ?? 1}"/>`; if (r.label) g += r.labelPos === 'right' ? `<text x="${W - m.r - 4}" y="${Y(r.price) - 2}" text-anchor="end" class="cx" fill="${r.color}" opacity="${Math.min(1, (r.alpha ?? 1) + .2)}" font-size="9" ${r.bold ? 'font-weight="700"' : ''}>${esc(r.label)}</text>` : `<text x="${x0 + 4}" y="${Y(r.price) - 3}" class="cx" fill="${r.color}" opacity="${Math.min(1, (r.alpha ?? 1) + .2)}" font-size="9">${esc(r.label)}</text>`; });
    if (hasVol) { const vmax = Math.max(...cs.map(c => c.v)) || 1; const y0 = H - m.b; for (let k = 0; k < n; k++) { const c = slot(k); if (!c) continue; const hh = c.v / vmax * (VH - 6); g += `<rect x="${X(k) - cw / 2}" y="${y0 - hh}" width="${cw}" height="${hh}" fill="${c.c >= c.o ? '#3ddc97' : '#ff5c7a'}" opacity=".35"/>`; }
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y0 - VH + 2}" y2="${y0 - VH + 2}" stroke="rgba(255,255,255,.08)"/><text x="${m.l + 4}" y="${y0 - VH + 12}" class="cx">vol</text>`;
      const B = 28, bins = new Array(B).fill(0); cs.forEach(c => { const k = Math.max(0, Math.min(B - 1, Math.floor((c.c - lo) / (hi - lo) * B))); bins[k] += c.v; }); const bmax = Math.max(...bins) || 1; const bh = ih / B; const poc = bins.indexOf(bmax);
      bins.forEach((v, k) => { const w = v / bmax * iw * .15; const y = m.t + ih - (k + 1) * bh; g += `<rect x="${W - m.r - w}" y="${y}" width="${w}" height="${Math.max(1, bh - 1)}" fill="${k === poc ? 'rgba(217,164,65,.5)' : 'rgba(53,199,221,.16)'}"/>`; });
      g += `<text x="${W - m.r - 4}" y="${m.t + ih - (poc + .5) * bh + 3}" text-anchor="end" class="cx" fill="#d9a441">POC ${px(lo + (poc + .5) / B * (hi - lo))}</text>`; }
    const ks = []; for (let k = 0; k < n; k++) if (slot(k)) ks.push(k);
    if (scene.mode === 'line') { const d = ks.map((k, j) => (j ? 'L' : 'M') + X(k).toFixed(1) + ',' + Y(slot(k).c).toFixed(1)).join(' '); const col = cs[cs.length - 1].c >= cs[0].c ? '#3ddc97' : '#ff5c7a'; g += `<path d="${d} L${X(ks[ks.length - 1]).toFixed(1)},${m.t + ih} L${X(ks[0]).toFixed(1)},${m.t + ih} Z" fill="${col}" opacity=".08"/><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6"/>`; }
    else ks.forEach(k => { const c = slot(k); const x = X(k), up = c.c >= c.o; const col = up ? '#3ddc97' : '#ff5c7a'; g += `<line x1="${x}" x2="${x}" y1="${Y(c.h)}" y2="${Y(c.l)}" stroke="${col}" stroke-width="1"/><rect x="${x - cw / 2}" y="${Y(Math.max(c.o, c.c))}" width="${cw}" height="${Math.max(1, Math.abs(Y(c.o) - Y(c.c)))}" fill="${col}" opacity=".88"/>`; });
    const line = (arr, col, w, d) => `<path d="${ks.filter(k => Number.isFinite(arr[i0 + k])).map((k, j) => (j ? 'L' : 'M') + X(k).toFixed(1) + ',' + Y(arr[i0 + k]).toFixed(1)).join(' ')}" fill="none" stroke="${col}" stroke-width="${w || 1.3}" stroke-dasharray="${dash(d)}" opacity=".9"/>`;
    (scene.emas || []).forEach(e => { if (e.values) g += line(e.values, e.color); });
    (scene.paths || []).forEach(p => { g += line(p.values, p.color, p.width, p.dash); });
    (scene.marks || []).forEach(mk => { const k = idx(all, mk.t * 1000) - i0; if (k < 0 || k >= n || mk.price < lo || mk.price > hi) return; if (mk.dot) { g += `<circle cx="${X(k)}" cy="${Y(mk.price)}" r="${mk.dot}" fill="${mk.color}" opacity=".85"/>`; return; } g += `<text x="${X(k)}" y="${mk.side === 'high' ? Y(mk.price) - 6 : Y(mk.price) + 13}" text-anchor="middle" class="cx" fill="${mk.color}" font-size="9" font-weight="700">${esc(mk.text)}</text>`; });
    g += '</g>';
    const last = all[all.length - 1].c; const yl = Math.max(m.t, Math.min(H - m.b, Y(last)));
    if (last >= lo && last <= hi) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${yl}" y2="${yl}" stroke="#d9a441" stroke-width=".8" opacity=".5"/>`;
    g += `<rect x="${W - m.r + 2}" y="${yl - 8}" width="${m.r - 4}" height="16" rx="3" fill="#d9a441"/><text x="${W - m.r + 6}" y="${yl + 4}" class="cx" fill="#0b0f14" font-weight="700">${px(last)}</text>`;
    if (!view.follow && view.end < all.length) g += `<text x="${W - m.r - 6}" y="${H - m.b - 6}" text-anchor="end" class="cx" fill="#9b8cff">◀ ${all.length - view.end} newer</text>`;
    g += `<g id="fv-xh"></g>`; svg.innerHTML = g; geo = {m, n, iw, ih, W, H, lo, hi, cs, X, Y, slot, i0};
    renderPanes(i0, n, X, m, W);
  }
  /* indicator panes: generic outputs (histogram from a base, lines, dashed levels) in the pane SVG below the price pane */
  function renderPanes(i0, n, X, m, W) {
    if (!paneSvg) return; const panes = (scene.panes || []); if (!panes.length) { paneSvg.innerHTML = ''; paneSvg.style.display = 'none'; return; } paneSvg.style.display = '';
    const PH = 110; const Wp = W; paneSvg.setAttribute('viewBox', `0 0 ${Wp} ${PH * panes.length}`); paneSvg.style.height = PH * panes.length + 'px'; let g = '';
    panes.forEach((p, pi) => { const top = pi * PH + 6, bot = (pi + 1) * PH - 6; const vals = []; Object.values(p.data).forEach(a => a.forEach((v, i) => { if (i >= i0 && i < i0 + n && Number.isFinite(v)) vals.push(v); })); (p.def.levels || []).forEach(v => vals.push(v)); if (!vals.length) return; let lo = Math.min(...vals), hi = Math.max(...vals); if (hi === lo) { hi += 1; lo -= 1; } const Y = (v) => top + (1 - (v - lo) / (hi - lo)) * (bot - top);
      (p.def.levels || []).forEach(v => { g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(138,148,166,.5)" stroke-dasharray="3 3"/><text x="${W - m.r + 6}" y="${Y(v) + 3}" class="cx">${v}</text>`; });
      (p.def.outputs || []).forEach(o => { const a = p.data[o.key]; if (!a) return; if (o.kind === 'histogram') { const base = o.zero ?? 0; const cwid = Math.max(1, (W - m.l - m.r) / n * .7); for (let k = 0; k < n; k++) { const v = a[i0 + k]; if (!Number.isFinite(v)) continue; const col = o.colorFn ? o.colorFn(v, i0 + k, a) : (o.color || '#d9a441'); g += `<rect x="${X(k) - cwid / 2}" y="${Math.min(Y(v), Y(base))}" width="${cwid}" height="${Math.max(1, Math.abs(Y(v) - Y(base)))}" fill="${col}"/>`; } }
        else { let d = ''; for (let k = 0; k < n; k++) { const v = a[i0 + k]; if (!Number.isFinite(v)) continue; d += (d ? 'L' : 'M') + X(k).toFixed(1) + ',' + Y(v).toFixed(1) + ' '; } g += `<path d="${d}" fill="none" stroke="${o.color || '#d9a441'}" stroke-width="${o.lineWidth || 1.2}"/>`; } });
      g += `<text x="${m.l + 4}" y="${top + 10}" class="cx" fill="#8a94a6">${esc(p.def.name)}</text>`; });
    paneSvg.innerHTML = g;
  }
  /* interactions */
  const region = (ev) => { const r = svg.getBoundingClientRect(); const x = ev.clientX - r.left, y = ev.clientY - r.top; if (!geo) return {x, y, zone: 'plot'}; return {x, y, zone: x > geo.W - geo.m.r ? 'y' : y > geo.H - geo.m.b ? 'x' : 'plot'}; };
  const hover = (p) => { const G = geo; const xh = svg.querySelector('#fv-xh'); if (!G || !xh) return; const inPlot = p.y >= G.m.t && p.y <= G.H - G.m.b && p.x >= G.m.l && p.x <= G.W - G.m.r; if (!inPlot) { xh.innerHTML = ''; return; } const i = Math.max(0, Math.min(G.n - 1, Math.floor((p.x - G.m.l) / G.iw * G.n))); const c = G.slot(i); if (c && hooks.onHover) hooks.onHover(c); const price = G.hi - (p.y - G.m.t) / G.ih * (G.hi - G.lo); xh.innerHTML = `<line x1="${G.X(i)}" x2="${G.X(i)}" y1="${G.m.t}" y2="${G.H - G.m.b}" stroke="rgba(255,255,255,.2)" stroke-dasharray="3 3"/><line x1="${G.m.l}" x2="${G.W - G.m.r}" y1="${p.y}" y2="${p.y}" stroke="rgba(255,255,255,.2)" stroke-dasharray="3 3"/><rect x="${G.W - G.m.r + 2}" y="${p.y - 8}" width="${G.m.r - 4}" height="16" rx="3" fill="rgba(255,255,255,.14)"/><text x="${G.W - G.m.r + 6}" y="${p.y + 4}" class="cx" fill="#e7eaf0">${px(price)}</text>`; };
  svg.addEventListener('pointerdown', (ev) => { if (ev.button !== 0 || !geo) return; const p = region(ev); drag = {...p, n: view.n, end: view.end, ylo: view.ylo, yhi: view.yhi}; svg.setPointerCapture(ev.pointerId); svg.classList.add('drag'); });
  svg.addEventListener('pointermove', (ev) => { const G = geo; if (!G) return; const p = region(ev); if (!drag) return hover(p); const dx = p.x - drag.x, dy = p.y - drag.y;
    if (drag.zone === 'plot') { const per = G.iw / drag.n; const end = Math.max(drag.n, Math.min(scene.bars.length + Math.floor(drag.n * .45), drag.end + Math.round(-dx / per))); view.end = end; view.follow = end === scene.bars.length; if (Math.abs(dy) > 2) { const span = drag.yhi - drag.ylo; const dp = dy / G.ih * span; view.yauto = false; view.ylo = drag.ylo + dp; view.yhi = drag.yhi + dp; } }
    else if (drag.zone === 'y') { const span = drag.yhi - drag.ylo, c = (drag.yhi + drag.ylo) / 2, f = Math.exp(dy / 140); view.yauto = false; view.ylo = c - span / 2 * f; view.yhi = c + span / 2 * f; }
    else view.n = Math.round(drag.n * Math.exp(-dx / 220));
    render(); });
  const endDrag = () => { if (!drag) return; drag = null; svg.classList.remove('drag'); }; svg.addEventListener('pointerup', endDrag); svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('pointerleave', () => { if (!drag) { const xh = svg.querySelector('#fv-xh'); if (xh) xh.innerHTML = ''; if (hooks.onHover && geo) hooks.onHover(geo.cs[geo.cs.length - 1]); } });
  svg.addEventListener('wheel', (ev) => { const G = geo; if (!G) return; ev.preventDefault(); const p = region(ev); const f = Math.exp(ev.deltaY * 0.0015); if (p.zone === 'y') { const span = view.yhi - view.ylo, c = (view.yhi + view.ylo) / 2; view.yauto = false; view.ylo = c - span / 2 * f; view.yhi = c + span / 2 * f; } else { const before = view.n; view.n = Math.round(view.n * f); if (!view.follow) { const frac = Math.max(0, Math.min(1, (p.x - G.m.l) / G.iw)); view.end = Math.round(view.end - (before - view.n) * (1 - frac)); } } render(); }, {passive: false});
  svg.addEventListener('dblclick', () => { reset(); render(); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (scene) render(); }).observe(svg);
  return {view, setScene(s) { const first = !scene || scene.market !== s.market || scene.iv !== s.iv; scene = s; if (first) reset(); render(); }, render, fit() { reset(); render(); }, follow() { view.follow = true; view.end = null; render(); }, geo: () => geo};
}

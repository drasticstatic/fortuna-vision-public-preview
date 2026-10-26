/* FortunaVision — the application. One market at a time, deeply: the chart in the middle, markets on the left, instruments on the right,
 * a command line underneath. All state lives here; chart.js owns rendering, data.js owns sources, command.js owns the grammar. */
import {loadTerminal, candles, mids, book, tradeStream, IV_MS} from './data.js';
import {createChart, LineStyle, EMA} from './chart.js';
import {createSvgChart} from './svgchart.js';
import {parse, history, HELP} from './command.js';
import * as TR from './treasury.js';

const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const px = (v, d) => v == null || !Number.isFinite(+v) ? '—' : Number(v).toLocaleString('en-US', {maximumFractionDigits: d ?? (v >= 1000 ? 1 : v >= 100 ? 2 : v >= 10 ? 3 : 4), minimumFractionDigits: 0});
const pct = (v, d = 2) => v == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(d) + '%';
const usd = (v) => v == null ? '—' : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', {maximumFractionDigits: 0});
const usdk = (v) => v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + (v / 1e3).toFixed(0) + 'K';
const cls = (v) => v > 0 ? 'up' : v < 0 ? 'down' : '';
const NY = 'America/New_York';
const fmtET = (t, o) => new Date(t).toLocaleString('en-US', Object.assign({timeZone: NY, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}, o || {}));

const T = {levels: null, state: null, signals: null, gex: null, base: ''}; let MIDS = {};
const cur = {market: null, iv: '1h', bars: [], h1: null, m15: null, mode: 'candles', zth: []};
const view = {vol: true, zth: true, rails: false, fvg: false, marks: false, fibs: false, gex: true, prints: true, osc: true, bands: false, bb: false};
const FLOW = {feed: null, trades: [], book: null, stream: null, timer: null};
let USER_LINES = [];  // planned orders drawn on the chart (ladder, calc), per session
let C = null, SV = null, engine = 'lw', tool = 'cursor', tab = 'levels', MODE = 'markets'; const IND = {};
const MARKET_TABS = [{id: 'levels', label: 'Levels'}, {id: 'regime', label: 'Regime'}, {id: 'flow', label: 'Flow'}, {id: 'gamma', label: 'Gamma'}, {id: 'calc', label: 'Calc'}, {id: 'desk', label: 'Desk'}];
try { if (localStorage.getItem('fv-engine') === 'svg') engine = 'svg'; } catch (e) {}
const lv = (m) => T.levels && T.levels.levels.find(x => x.market === m);
const sig = (m) => T.signals && T.signals.feeds ? T.signals.feeds[m] : null;
const offset = (m) => { const l = lv(m); return l && l.offset ? l.offset : 0; };
const toFeed = (v, m) => v == null ? null : v - offset(m);
const closedBars = () => { const b = cur.bars; if (!b.length) return b; return b[b.length - 1].t + IV_MS[cur.iv] > Date.now() ? b.slice(0, -1) : b; };

/* ── boot ── */
async function boot() {
  try { Object.assign(T, await loadTerminal()); } catch (e) { status('warn', 'terminal data unavailable'); console.error(e); return; }
  status('ok', `data ${fmtET(T.levels.asof)} ET`);
  const qm = new URLSearchParams(location.search).get('m'); const names = T.levels.levels.map(l => l.market);
  const armed = (T.state.watchlist || []).find(w => w.status === 'armed' || w.status === 'watch');
  cur.market = qm && names.includes(qm) ? qm : armed ? armed.market : names[0];
  const qt = new URLSearchParams(location.search).get('tf'); if (qt && IV_MS[qt]) cur.iv = qt;
  C = createChart($('#chart')); C.onCrosshair(onCrosshair); C.onClick(onClick);
  renderRail(); wireChrome(); renderTools(); renderTabs(); clock(); setInterval(clock, 1000); applyEngine(engine);
  try { MIDS = await mids(); } catch (e) {} setInterval(async () => { try { MIDS = await mids(); if (MODE === 'markets') renderRail(); } catch (e) {} }, 30000);
  setInterval(async () => { try { const fresh = await loadTerminal(); const changed = fresh.levels.asof !== T.levels.asof; Object.assign(T, fresh); if (changed && MODE === 'markets') { status('ok', `data ${fmtET(T.levels.asof)} ET`); renderRail(); renderTab(); } } catch (e) {} }, 120000);
  await loadIndicator('og', 'og-oscillator.js');
  await selectMarket(cur.market, cur.iv, true);
}

function status(kind, text) { const s = $('#status'); s.className = 'status ' + kind; s.innerHTML = `<i></i> ${esc(text)}`; }
function clock() { $('#clock').textContent = new Date().toLocaleTimeString('en-US', {timeZone: NY, hour: 'numeric', minute: '2-digit', second: '2-digit'}) + ' ET'; }

/* ── markets rail ── */
function renderRail() {
  const W = T.state.watchlist || []; const groups = [['Metals', ['Gold', 'Silver']], ['Energy', ['Crude', 'Brent']], ['Indices', ['S&P 500', 'Nasdaq-100', 'Russell 2000']], ['Crypto', ['BTC', 'ETH', 'SOL', 'TOTAL2']]];
  const seen = new Set(); const row = (l) => { seen.add(l.market); const w = W.find(x => x.market === l.market); const last = MIDS[l.feed] ?? l.last; const chg = l.chg_24h; return `<div class="r ${l.market === cur.market ? 'on' : ''}" data-m="${esc(l.market)}" role="button" tabindex="0"><b>${esc(l.market)}${w ? `<span class="st ${esc(w.status)}">${esc(w.status)}</span>` : ''}</b><span class="px">${px(last)}</span><small>${esc(l.feed)} · ${esc(l.bias_1h)} 1h / ${esc(l.bias_4h)} 4h</small><span class="chg ${cls(chg)}">${pct(chg)}</span></div>`; };
  let html = ''; groups.forEach(([g, ms]) => { const rows = ms.map(m => lv(m)).filter(Boolean); if (!rows.length) return; html += `<div class="grp">${g}</div>` + rows.map(row).join(''); });
  const rest = T.levels.levels.filter(l => !seen.has(l.market)); if (rest.length) html += `<div class="grp">More</div>` + rest.map(row).join('');
  $('#rail').innerHTML = html; $$('#rail .r').forEach(r => { r.addEventListener('click', () => selectMarket(r.dataset.m)); r.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectMarket(r.dataset.m); }); });
}

/* ── market + candles ── */
async function selectMarket(m, iv, first) {
  const l = lv(m); if (!l) return; cur.market = m; if (iv) cur.iv = iv; $$('#tfs button').forEach(b => b.classList.toggle('on', b.dataset.tf === cur.iv));
  $('#mkt').textContent = m; $('#mkt-sub').textContent = `${l.feed} · loading`;
  try { const u = new URL(location.href); u.searchParams.set('m', m); u.searchParams.set('tf', cur.iv); history.replaceState(null, '', u); } catch (e) {}
  renderRail(); C.drawings.setItems(loadDrawings(m)); cur.mode = l.line ? 'line' : 'candles';
  try {
    if (l.candles) { cur.bars = agg(l.candles, IV_MS[cur.iv]); cur.h1 = {candles: agg(l.candles, 36e5)}; }
    else { const [bars, h1] = await Promise.all([candles(l.feed, cur.iv, cur.iv === '5m' ? 500 : 600), cur.iv === '1h' ? null : candles(l.feed, '1h', 400)]); cur.bars = bars; const rows = h1 || bars.slice(); cur.h1 = {candles: rows}; }
    const rows = cur.h1.candles.slice(); const forming = rows.length && rows[rows.length - 1].t + 36e5 > Date.now() ? rows.pop() : null;
    cur.zth = window.AutoLevels ? AutoLevels.compute(rows, {tick: AutoLevels.TICKS[m] || Math.max(1e-6, rows[rows.length - 1].c * 1e-5), forming}) : [];
    cur.m15 = null; if (view.rails) await loadRails();
  } catch (e) { console.error(e); $('#mkt-sub').textContent = `${l.feed} · candles unavailable`; return; }
  draw(); if (first) { C.fit(); if (SV) SV.fit(); } renderTab(); flowConnect();
}
const agg = (bars, ms) => { const out = new Map(); bars.forEach(b => { const k = b.t - b.t % ms; const o = out.get(k); if (!o) out.set(k, {t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v || 0}); else { o.h = Math.max(o.h, b.h); o.l = Math.min(o.l, b.l); o.c = b.c; o.v += b.v || 0; } }); return [...out.values()].sort((a, b) => a.t - b.t); };
async function loadRails() { const l = lv(cur.market); if (!l || l.candles || cur.m15) return; try { const rows = await candles(l.feed, '15m', 480); cur.m15 = {candles: rows, sessions: window.AutoLevels ? AutoLevels.sessions(rows, 3) : []}; } catch (e) {} }

/* ── draw everything ── */
const SCENE_LS = {solid: 0, dotted: 1, dashed: 2};
function buildScene() {
  const l = lv(cur.market); const all = cur.bars; if (!l || !all.length) return null; const m = cur.market; const o = offset(m);
  const closes = all.map(c => c.c); const closed = closedBars();
  const sc = {market: m, iv: cur.iv, mode: cur.mode, bars: all, vol: view.vol, emas: [{values: EMA(closes, 20), color: '#35c7dd'}, {values: EMA(closes, 50), color: '#9b8cff'}, {values: all.length >= 200 ? EMA(closes, 200) : null, color: '#ff8fb1'}], lines: [], boxes: [], rays: [], marks: [], paths: [], panes: []};
  [[l.pdh, 'PDH', '#5aa9ff'], [l.pdl, 'PDL', '#5aa9ff'], [l.midnight_open, 'midnight', '#8a94a6'], [l.week_open, 'week open', '#8a94a6']].forEach(([v, t, c]) => { if (v != null) sc.lines.push({price: v, color: c, title: t, style: 'dashed', width: 1, side: 'r'}); });
  (T.state.positions || []).filter(p => p.market === m || p.symbol === m).forEach(p => [[p.entry, `${p.side} · ${p.venue}`, '#3ddc97', 'solid'], [p.tp, 'target', '#3ddc97', 'dashed'], [p.stop, 'stop', '#ff5c7a', 'solid'], [p.liq, 'liq', '#ff5c7a', 'dotted']].forEach(([v, t, c, st]) => { if (v != null) sc.lines.push({price: toFeed(v, m), color: c, title: t, style: st, width: 1, side: 'l'}); }));
  (T.state.watchlist || []).filter(w => w.market === m && w.zone_lo != null).forEach(w => sc.boxes.push({p0: toFeed(w.zone_lo, m), p1: toFeed(w.zone_hi, m), fill: 'rgba(217,164,65,.12)', stroke: 'rgba(217,164,65,.55)', dash: [3, 3], label: `${w.direction} zone · ${w.status}`}));
  if (view.zth && cur.zth.length && cur.iv !== '4h' && cur.iv !== '1d') cur.zth.forEach(z => { const st = {KEY: ['#d9a441', 2.2, [], 1], '5/5': ['#35c7dd', 1, [], .85], '3/5': ['#35c7dd', 1, [2, 3], .6], ghost: ['#9b8cff', 1, [2, 3], Math.max(.15, .45 * (1 - z.tags * .25))]}[z.type]; sc.rays.push({t0: z.born / 1000, price: z.price, color: st[0], width: st[1], dash: st[2], alpha: st[3], label: z.type, labelPos: 'right', bold: z.type === 'KEY'}); });
  if (view.bands && cur.zth.length && l.atr_1h) AutoLevels.atrBands(cur.zth.filter(z => z.type !== 'ghost'), l.atr_1h).forEach(b => sc.boxes.push({p0: b.lo, p1: b.hi, fill: 'rgba(53,199,221,.06)'}));
  if (view.fibs && window.Regime) { const imp = Regime.impulse(closed); if (imp) Object.entries(imp.fibs).forEach(([q, v]) => sc.rays.push({t0: imp.startT / 1000, price: v, color: '#f2b94b', width: ['0.5', '0.618', '0.705'].includes(q) ? 1.2 : .8, dash: +q > 1 ? [2, 4] : [], alpha: .9, label: `${q} · ${px(v)}`})); }
  if (view.rails && cur.m15 && IV_MS[cur.iv] <= 36e5) cur.m15.sessions.forEach((d, k) => { const a = k === 0 ? 1 : k === 1 ? .55 : .35; const dash = k === 0 ? [] : [5, 4]; if (d.fcr) { sc.rays.push({t0: d.fcr.t / 1000, price: d.fcr.high, color: '#3ddc97', width: k === 0 ? 2 : 1, dash, alpha: a, label: 'FCR ▲ ' + d.day.slice(5)}); sc.rays.push({t0: d.fcr.t / 1000, price: d.fcr.low, color: '#ff5c7a', width: k === 0 ? 2 : 1, dash, alpha: a, label: 'FCR ▼ ' + d.day.slice(5)}); } [[d.open930, '4/5 9:30 open'], [d.close1600, '4/5 16:00 close'], [d.close1700, '4/5 17:00 close'], [d.open1800, '4/5 18:00 open']].forEach(([s, t]) => { if (s) sc.rays.push({t0: s.t / 1000, price: s.price, color: k === 0 ? '#089981' : '#35c7dd', width: 1, dash: [4, 3], alpha: a * .8, label: t + (k ? ' · ' + d.day.slice(5) : ''), labelPos: 'right'}); }); });
  if (view.fvg && window.AutoLevels) AutoLevels.fvgs(closed, 0, 0).slice(-40).forEach(f => { const t1 = closed[Math.min(closed.length - 1, f.i + 5)]; sc.boxes.push({t0: f.t / 1000, t1: t1 ? t1.t / 1000 : null, p0: f.bot, p1: f.top, fill: f.dir === 'bull' ? 'rgba(61,220,151,.14)' : 'rgba(255,92,122,.14)'}); });
  if (view.marks && window.AutoLevels && cur.zth.length) { const tick = AutoLevels.TICKS[m] || Math.max(1e-6, closed[closed.length - 1].c * 1e-5); AutoLevels.patterns(closed, cur.zth, tick).forEach(p => sc.marks.push({t: p.t / 1000, price: p.price, side: p.side, text: p.tags.join('·'), color: p.tags.includes('BRK') || p.tags.includes('RT') ? '#9b8cff' : p.tags.includes('R') ? '#ff5c7a' : p.tags.includes('B') ? '#3ddc97' : p.tags.includes('SFP') ? '#ff8fb1' : p.tags.includes('1-2-3') ? '#f2b94b' : '#35c7dd'})); }
  if (view.gex) { const gx = gexFor(m); if (gx) gx.walls.forEach(w => sc.rays.push({price: w.price, color: w.color, width: w.width, dash: w.dash, alpha: .9, label: w.label, labelPos: 'left'})); }
  if (view.prints) bigPrints().forEach(t => { const j = candleAt(all, t.t); if (j >= 0) sc.marks.push({t: all[j].t / 1000, price: t.px, dot: 2.5 + Math.min(4, Math.log10(Math.max(1, t.sz * t.px / 1e4))), color: t.buy ? '#3ddc97' : '#ff5c7a'}); });
  if (view.bb && window.Regime) { const bb = Regime.bollinger(all); [['basis', '#f59e0b', 1.2], ['upper', '#fbbf24', .8], ['lower', '#fbbf24', .8]].forEach(([k, c, w]) => sc.paths.push({key: 'bb-' + k, values: bb.map(x => x ? x[k] : NaN), color: c, width: w, dash: [2, 3]})); }
  USER_LINES.filter(u => u.market === m).forEach(u => sc.lines.push({price: u.price, color: u.color, title: u.title, style: u.style || 'dashed', width: u.width || 1, side: 'l'}));
  Object.entries(IND).forEach(([id, ind]) => { if (id === 'og' && !view.osc) return; sc.panes.push({id, def: ind.def, data: ind.def.calc(all, ind.params, TA)}); });
  return sc;
}
function renderLW(sc) {
  C.setBars(sc.bars, sc.iv, sc.mode); C.setEMAs(sc.emas.map(e => e.values)); C.setVolume(sc.vol); C.clearLines();
  sc.lines.forEach(l => C.priceLine(l.price, l.color, l.title, SCENE_LS[l.style], l.width)); C.setOverlays({boxes: sc.boxes, rays: sc.rays, marks: sc.marks}); C.setPaths(sc.paths);
  const keep = new Set(sc.panes.map(p => p.id)); Object.keys(IND).forEach(id => { if (!keep.has(id)) C.removePane(id); }); sc.panes.forEach(p => { C.pane(p.id, p.def); C.setPane(p.id, p.data); });
}
function draw() {
  const sc = buildScene(); if (!sc) return; const l = lv(cur.market); const o = offset(cur.market);
  if (engine === 'svg' && SV) SV.setScene(sc); else renderLW(sc);
  $('#mkt-sub').textContent = `${l.feed} · ${cur.iv} · ${o ? 'MFP ≈ feed + ' + px(o) : 'no venue offset'} · ATR 1h ${px(l.atr_1h)} · ${l.bias_1h} 1h / ${l.bias_4h} 4h · ${engine === 'svg' ? 'SVG engine' : 'TradingView engine'}`;
  renderLegend(); showOHLC(sc.bars[sc.bars.length - 1]);
}
function drawScene(sc) { if (engine === 'svg' && SV) SV.setScene(sc); else renderLW(sc); showOHLC(sc.bars[sc.bars.length - 1]); if (engine !== 'svg') C.fit(); }
async function setMode(m) {
  if (m === MODE) return; MODE = m; $$('#mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); $('#tfs').style.visibility = m === 'treasury' ? 'hidden' : ''; $('#tools').classList.toggle('off', m === 'treasury' || engine === 'svg');
  if (m === 'treasury') { if (FLOW.stream) { FLOW.stream.close(); FLOW.stream = null; FLOW.feed = null; clearInterval(FLOW.timer); } renderTabs(TR.TABS); $('#cmd').placeholder = 'treasury: click a chain · yields · stables · holdings · markets to go back'; await TR.enter({drawScene, EMA}); }
  else { TR.leave(); renderTabs(MARKET_TABS); $('#cmd').placeholder = 'type a market or a command: gold 15m · btc gex · es levels · draw fib · help'; renderRail(); await selectMarket(cur.market, cur.iv, true); }
}
function applyEngine(e) {
  engine = e === 'svg' ? 'svg' : 'lw'; try { localStorage.setItem('fv-engine', engine); } catch (x) {}
  $('#chart').hidden = engine === 'svg'; $('#csvg').toggleAttribute('hidden', engine !== 'svg'); $('#cpane').toggleAttribute('hidden', engine !== 'svg');  // SVG nodes have no .hidden property
  $$('#engine button').forEach(b => b.classList.toggle('on', b.dataset.eng === engine)); $('#tools').classList.toggle('off', engine === 'svg'); $('#tools').title = engine === 'svg' ? 'drawings live on the TradingView engine' : '';
  if (engine === 'svg' && !SV) SV = createSvgChart($('#csvg'), $('#cpane'), {onHover: showOHLC});
  if (cur.bars.length) draw();
}
const candleAt = (all, t) => { let lo = 0, hi = all.length - 1, j = -1; while (lo <= hi) { const k = (lo + hi) >> 1; if (all[k].t <= t) { j = k; lo = k + 1; } else hi = k - 1; } return j; };
function gexFor(m) { if (!T.gex || !cur.bars.length) return null; const g = T.gex.markets.find(x => x.market === m); if (!g || !g.strikes.length) return null;
  let basis = 0; if (g.feed && g.feed.startsWith('xyz:')) { const at = Date.parse(T.gex.asof); const c = cur.bars.slice().reverse().find(c => c.t <= at) || cur.bars[0]; basis = c.c - g.spot; }
  const walls = []; const tag = basis ? ` · basis ${basis > 0 ? '+' : ''}${px(basis)}` : '';
  if (g.call_wall != null) walls.push({price: g.call_wall + basis, label: 'call wall ' + px(g.call_wall) + tag, color: '#3ddc97', dash: [6, 3], width: 1.3});
  if (g.put_wall != null) walls.push({price: g.put_wall + basis, label: 'put wall ' + px(g.put_wall) + tag, color: '#ff5c7a', dash: [6, 3], width: 1.3});
  if (g.flip != null) walls.push({price: g.flip + basis, label: 'gamma flip ' + px(g.flip), color: '#f2b94b', dash: [2, 4], width: 1});
  g.strikes.slice().sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex)).slice(0, 4).forEach(s => { if (s.strike === g.call_wall || s.strike === g.put_wall) return; walls.push({price: s.strike + basis, label: `γ ${px(s.strike)} ${s.gex >= 0 ? '+' : ''}${s.gex}M`, color: s.gex >= 0 ? 'rgba(61,220,151,.55)' : 'rgba(255,92,122,.55)', dash: [1, 3], width: 1}); });
  return {walls, basis, g}; }
function bigPrints() { const l = lv(cur.market); if (!l || FLOW.feed !== l.feed) return []; const now = Date.now(); return FLOW.trades.filter(t => now - t.t < 15 * 60000).sort((a, b) => b.sz * b.px - a.sz * a.px).slice(0, 6); }
function showOHLC(c) { if (!c) return; const o = offset(cur.market); $('#ohlc').innerHTML = `<span>${fmtET(c.t)}</span><span>O <b>${px(c.o)}</b></span><span>H <b>${px(c.h)}</b></span><span>L <b>${px(c.l)}</b></span><span>C <b class="${cls(c.c - c.o)}">${px(c.c)}</b></span><span>Δ <b class="${cls(c.c - c.o)}">${pct((c.c / c.o - 1) * 100)}</b></span>${c.v ? `<span>V <b>${c.v >= 1e6 ? (c.v / 1e6).toFixed(2) + 'M' : c.v >= 1e3 ? (c.v / 1e3).toFixed(1) + 'K' : c.v.toFixed(0)}</b></span>` : ''}${o ? `<span>MFP est. <b>${px(c.c + o)}</b></span>` : ''}`; }
function renderLegend() {
  const items = [['zth', 'Auto Levels', '#d9a441'], ['rails', 'session rails', '#089981'], ['fvg', 'fair value gaps', '#3ddc97'], ['marks', 'pattern marks', '#9b8cff'], ['fibs', 'fib ladder', '#f2b94b'], ['bands', 'ATR bands', '#35c7dd'], ['bb', 'Bollinger', '#f59e0b'], ['gex', 'gamma walls', '#ff5c7a'], ['prints', 'large prints', '#3ddc97'], ['vol', 'volume + profile', '#8a94a6'], ['osc', 'OG oscillator', '#2dd4bf']];
  $('#legend').innerHTML = `<span><b>EMA</b> <span style="color:#35c7dd">20</span> <span style="color:#9b8cff">50</span> <span style="color:#ff8fb1">200</span></span>` + items.map(([k, t, c]) => `<span class="tog ${view[k] ? '' : 'off'}" data-v="${k}" style="color:${c}">${t}</span>`).join('');
  $$('#legend .tog').forEach(s => s.addEventListener('click', async () => { const k = s.dataset.v; view[k] = !view[k]; if (k === 'rails' && view.rails) await loadRails(); draw(); }));
}
function onCrosshair(c, p) { if (c) showOHLC(c); else if (cur.bars.length) showOHLC(cur.bars[cur.bars.length - 1]);
  if (tool !== 'cursor' && C.drawings.temp && p && p.point) { const pt = C.pointAt(p); if (pt) { C.drawings.temp.points[C.drawings.temp.points.length - 1] = pt; C.drawings.update(); } } }

/* ── indicators (the contract: one module, inputs/outputs/calc) ── */
async function loadIndicator(id, file) { try { const mod = await import(`../indicators/${file}`); IND[id] = {def: mod.default, params: Object.fromEntries((mod.default.inputs || []).map(i => [i.key, i.default]))}; } catch (e) { console.error('indicator', file, e); } }
function runIndicators() {
  Object.entries(IND).forEach(([id, ind]) => { if (!view.osc && id === 'og') { C.removePane(id); return; } const bars = cur.bars; if (!bars.length) return; const out = ind.def.calc(bars, ind.params, TA); const p = C.pane(id, ind.def); C.setPane(id, out); });
}
const TA = {ema: EMA, sma: (a, n) => a.map((_, i) => i < n - 1 ? NaN : a.slice(i - n + 1, i + 1).reduce((s, v) => s + v, 0) / n), rsi: (b, n) => window.Regime ? Regime.rsi(b, n) : [], mfi: (b, n) => window.Regime ? Regime.mfi(b, n) : [], bollinger: (b, n, k) => window.Regime ? Regime.bollinger(b, n, k) : []};

/* ── drawings ── */
function loadDrawings(m) { try { return JSON.parse(localStorage.getItem('fv-draw:' + m) || '[]'); } catch (e) { return []; } }
function saveDrawings() { try { localStorage.setItem('fv-draw:' + cur.market, JSON.stringify(C.drawings.items)); } catch (e) {} }
function renderTools() {
  const want = ['cursor', 'trend', 'ray', 'extended', 'hline', 'hray', 'vline', 'rect', 'channel', 'fib', 'measure', 'long', 'short', 'text'];
  const defs = want.map(id => C.TOOL_BY_ID[id]).filter(Boolean);
  $('#tools').innerHTML = defs.map((t, i) => `${i === 1 || i === 4 || i === 9 || i === 11 ? '<hr>' : ''}<button type="button" data-tool="${t.id}" title="${esc(t.label)}" class="${t.id === tool ? 'on' : ''}"><svg viewBox="0 0 24 24">${t.icon}</svg></button>`).join('') + `<hr><button type="button" data-tool="__trash" title="remove this market's drawings"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>`;
  $$('#tools button').forEach(b => b.addEventListener('click', () => { if (b.dataset.tool === '__trash') { C.drawings.setItems([]); saveDrawings(); return; } setTool(b.dataset.tool); }));
}
function setTool(t) { tool = C.TOOL_BY_ID[t] ? t : 'cursor'; C.drawings.temp = null; C.drawings.update(); $$('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === tool)); $('#chart').style.cursor = tool === 'cursor' ? '' : 'crosshair'; }
function onClick(p) {
  if (engine === 'svg') return;
  if (tool === 'cursor') { if (!p.point) return; C.drawings.selected = C.drawings.hitTest(p.point.x, p.point.y); C.drawings.update(); return; }
  const def = C.TOOL_BY_ID[tool]; const pt = C.pointAt(p); if (!def || !pt) return; const d = C.drawings;
  if (!d.temp) { d.temp = {id: 'd' + Date.now().toString(36), type: tool, points: [pt]}; if (def.points > 1) d.temp.points.push({...pt}); }
  else { d.temp.points[d.temp.points.length - 1] = pt; if (d.temp.points.length < def.points) d.temp.points.push({...pt}); else d.temp.done = true; }
  if (def.points === 1) d.temp.done = true;
  if (d.temp.done) { const item = d.temp; delete item.done; d.temp = null; if (item.type === 'text') { const text = window.prompt('Note text:', ''); if (!text) { d.update(); setTool('cursor'); return; } item.text = text; } d.items.push(item); d.selected = item; saveDrawings(); setTool('cursor'); }
  d.update();
}

/* ── inspector tabs ── */
function renderTabs(list = MARKET_TABS) { $('#tabs').innerHTML = list.map((t, i) => `<button role="tab" data-tab="${t.id}" class="${i ? '' : 'on'}">${t.label}</button>`).join(''); $$('.inspect .tab').forEach(x => x.remove()); list.forEach((t, i) => { const d = document.createElement('div'); d.className = 'tab'; d.id = 'tab-' + t.id; d.hidden = !!i; $('.inspect').appendChild(d); }); tab = list[0].id; $$('#tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab))); }
function showTab(t) { tab = t; $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $$('.tab').forEach(x => x.hidden = x.id !== 'tab-' + t); renderTab(); }
function renderTab() { if (MODE === 'treasury') return TR.renderTab(tab); ({levels: tabLevels, regime: tabRegime, flow: tabFlow, gamma: tabGamma, calc: tabCalc, desk: tabDesk}[tab] || (() => {}))(); }
function tabLevels() {
  const l = lv(cur.market); if (!l) return; const last = MIDS[l.feed] ?? l.last; const atr = l.atr_1h || 1;
  const rows = cur.zth.filter(z => z.type !== 'ghost').sort((a, b) => b.price - a.price);
  const d = (p) => { const k = (p - last) / atr; return `${k >= 0 ? '+' : ''}${k.toFixed(2)} ATR`; };
  const sx = sig(cur.market); const zth = sx && sx.zth ? sx.zth : null;
  $('#tab-levels').innerHTML = `<h4>Auto Levels · 1h engine${cur.zth.length ? ` · ${cur.zth.filter(z => z.type === 'KEY').length} KEY · ${cur.zth.filter(z => z.type === '5/5').length} 5/5 · ${cur.zth.filter(z => z.type === '3/5').length} 3/5 · ${cur.zth.filter(z => z.type === 'ghost').length} ghost</h4>` : '</h4>'}
    <div class="lv">${rows.map(z => `<span class="${z.type === 'KEY' ? 'KEY' : ''}">${px(z.price)}</span><span class="t">${esc(z.type)} · born ${fmtET(z.born)}</span><span class="d ${cls(z.price - last)}">${d(z.price)}</span>`).join('') || '<span class="t">no levels yet</span>'}</div>
    <h4>Structure</h4><dl class="kv"><dt>last</dt><dd>${px(last)}</dd><dt>PDH / PDL</dt><dd>${px(l.pdh)} / ${px(l.pdl)}</dd><dt>midnight · week open</dt><dd>${px(l.midnight_open)} · ${px(l.week_open)}</dd><dt>ATR 15m · 1h · 4h</dt><dd>${px(l.atr_15m)} · ${px(l.atr_1h)} · ${px(l.atr_4h)}</dd><dt>EMA 20 / 50 / 200 (1h)</dt><dd>${px(l.ema20_1h)} / ${px(l.ema50_1h)} / ${px(l.ema200_1h)}</dd>${sx && sx.swing_high ? `<dt>1h swings</dt><dd>${px(sx.swing_high)} / ${px(sx.swing_low)}</dd>` : ''}</dl>
    ${sx && sx.sweeps && sx.sweeps.length ? `<h4>Liquidity sweeps, last scan</h4><p>${sx.sweeps.map(x => `swept ${esc(x.level)} ${px(x.price)} (${x.depth_atr}× ATR), closed ${px(x.close)}`).join('; ')}</p>` : ''}
    <p>Levels come from the open-source Auto Levels engine (engines/autolevels.js), the same code the scanner runs. KEY levels are brass on the chart; 5/5 and 3/5 cyan; ghosts violet.</p>`;
}
function tabRegime() {
  const closed = closedBars(); const R = window.Regime && closed.length > 60 ? Regime.read(closed) : null; const sx = sig(cur.market); const per = sx && sx.regime ? sx.regime : null;
  const row = (tf, r) => r ? `<tr><td>${tf}</td><td>${esc(r.regime.label)} ${r.regime.dir === 'up' ? '↑' : r.regime.dir === 'down' ? '↓' : ''}</td><td class="n">${r.regime.adx}</td><td>${esc(r.align.label)}${r.align.fanned ? ' · fanned' : ''}</td><td class="n">${r.rsi ? r.rsi.rsi : '—'}</td><td class="n">${r.og ? r.og.mfi : '—'}</td></tr>` : '';
  $('#tab-regime').innerHTML = `<h4>This chart · ${cur.iv}</h4>${R ? `<dl class="kv"><dt>regime</dt><dd>${esc(R.regime.label)} · ADX ${R.regime.adx} · ${esc(R.regime.dir)}</dd><dt>EMA alignment</dt><dd>${esc(R.align.label)}${R.align.fanned ? ' · fanned' : ''}</dd><dt>range, 24 bars</dt><dd>${R.rangePct}%</dd><dt>RSI · cloud</dt><dd>${R.rsi ? `${R.rsi.rsi} · ${R.rsi.above ? 'above' : R.rsi.below ? 'below' : 'inside'}` : '—'}</dd><dt>dual ADX</dt><dd>${R.adx2 ? `${R.adx2.fast} / ${R.adx2.slow} · thr ${R.adx2.threshold}` : '—'}</dd><dt>money flow</dt><dd>${R.og ? `${R.og.mfi} · ${esc(R.og.mfiZone)}` : '—'}</dd><dt>price vs bands</dt><dd>${R.og ? esc(R.og.pricePos) : '—'}</dd>${R.impulse ? `<dt>last impulse</dt><dd>${esc(R.impulse.dir)} ${px(R.impulse.start)} → ${px(R.impulse.end)} · retrace ${(R.impulse.retrace * 100).toFixed(0)}% · nearest fib ${R.impulse.nearestFib}${R.impulse.goldenPocket ? ' · golden pocket' : ''}</dd>` : ''}</dl>` : '<p>not enough closed bars yet</p>'}
    ${per ? `<h4>Every timeframe, last scan</h4><table class="tb"><tr><th>TF</th><th>regime</th><th class="n">ADX</th><th>EMAs</th><th class="n">RSI</th><th class="n">MFI</th></tr>${['5m', '15m', '1h', '4h'].map(tf => row(tf, per[tf])).join('')}</table>` : ''}
    ${sx && sx.inev ? `<h4>Eligibility</h4><p>${Object.entries(sx.inev).map(([k, v]) => `${esc(k)}: <b class="${v && v.eligible ? 'up' : 'muted'}">${v && v.eligible ? 'eligible' : 'not yet'}</b>`).join(' · ')}</p>` : ''}
    <p>Generic measures from engines/regime.js. Which coaching-program card a read qualifies for is computed privately by the scanner; only the verdict is shown.</p>`;
}
function flowConnect() { const l = lv(cur.market); const feed = l && !l.src ? l.feed : null; if (FLOW.feed === feed && FLOW.stream) return; if (FLOW.stream) FLOW.stream.close(); FLOW.feed = feed; FLOW.trades = []; FLOW.book = null; clearInterval(FLOW.timer); if (!feed) { if (tab === 'flow') tabFlow(); return; }
  FLOW.stream = tradeStream(feed, (t) => { FLOW.trades.push(t); if (FLOW.trades.length > 6000) FLOW.trades.splice(0, 1000); if (tab === 'flow' && Date.now() - (FLOW.r || 0) > 500) { FLOW.r = Date.now(); tabFlow(); } if (view.prints && Date.now() - (FLOW.drawn || 0) > 45000) { FLOW.drawn = Date.now(); draw(); } });
  const poll = async () => { try { FLOW.book = await book(feed); if (tab === 'flow') tabFlow(); } catch (e) {} }; poll(); FLOW.timer = setInterval(poll, 15000); }
function tabFlow() {
  const el = $('#tab-flow'); if (!FLOW.feed) { el.innerHTML = '<p>No live book for this market.</p>'; return; } const now = Date.now(); const win = FLOW.trades.filter(t => now - t.t < 15 * 60000); const B = FLOW.book;
  const buy = win.filter(t => t.buy).reduce((s, t) => s + t.sz * t.px, 0), sell = win.filter(t => !t.buy).reduce((s, t) => s + t.sz * t.px, 0); let cvd = 0; FLOW.trades.forEach(t => cvd += (t.buy ? 1 : -1) * t.sz * t.px);
  el.innerHTML = `<div class="tile"><small>book imbalance · top 10 levels</small><div class="big ${B ? cls(B.imb) : ''}">${B ? (B.imb >= 0 ? '+' : '') + (B.imb * 100).toFixed(0) + '%' : '—'}</div><small>bid ${B ? usdk(B.bid) : '—'} · ask ${B ? usdk(B.ask) : '—'}</small><div class="gauge"><i style="left:${B ? 50 + B.imb * 50 : 50}%"></i></div></div>
    <div class="tile"><small>taker flow · 15 min</small><div class="big ${cls(buy - sell)}">${usd(buy - sell)}</div><small>buys ${usdk(buy)} · sells ${usdk(sell)} · ${win.length} prints</small></div>
    <div class="tile"><small>cumulative delta since ${FLOW.trades.length ? fmtET(FLOW.trades[0].t, {month: undefined, day: undefined}) : '—'}</small><div class="big ${cls(cvd)}">${usd(cvd)}</div></div>
    <h4>Largest prints, 15 min</h4><div class="prints">${bigPrints().map(t => `<span>${fmtET(t.t, {month: undefined, day: undefined, second: '2-digit'})} <b class="${t.buy ? 'up' : 'down'}">${t.buy ? 'buy' : 'sell'} ${usdk(t.sz * t.px)}</b> @ ${px(t.px)}</span>`).join('') || '<span>waiting for trades…</span>'}</div>
    <p>Hyperliquid public trades websocket and order book, no key. Large prints also draw on the chart as dots.</p>`;
}
function tabGamma() {
  const el = $('#tab-gamma'); if (!T.gex || !T.gex.markets.length) { el.innerHTML = '<p>No gamma snapshot.</p>'; return; } const here = T.gex.markets.find(x => x.market === cur.market); const list = here ? [here].concat(T.gex.markets.filter(x => x !== here)) : T.gex.markets;
  el.innerHTML = list.map(mk => { const ks = mk.strikes; const lo = Math.min(mk.spot, ...ks.map(s => s.strike)), hi = Math.max(mk.spot, ...ks.map(s => s.strike)); const mx = Math.max(1, ...ks.map(s => Math.abs(s.gex))); const X = (v) => 6 + (v - lo) / (hi - lo || 1) * 288;
    return `<div class="tile" data-m="${esc(mk.market)}"><small>${esc(mk.market)} · spot ${px(mk.spot)} · net ${mk.total_gex >= 0 ? '+' : ''}${mk.total_gex}M per 1%</small><svg viewBox="0 0 300 46" preserveAspectRatio="none" style="width:100%;height:46px;display:block;margin:.3rem 0"><line x1="6" x2="294" y1="23" y2="23" stroke="rgba(138,148,166,.3)"/>${ks.map(s => { const h = Math.abs(s.gex) / mx * 19; return `<rect x="${(X(s.strike) - 2.5).toFixed(1)}" y="${(s.gex >= 0 ? 23 - h : 23).toFixed(1)}" width="5" height="${Math.max(1, h).toFixed(1)}" rx="1" fill="${s.gex >= 0 ? '#3ddc97' : '#ff5c7a'}" opacity=".85"><title>${px(s.strike)} ${s.gex >= 0 ? '+' : ''}${s.gex}M</title></rect>`; }).join('')}<line x1="${X(mk.spot).toFixed(1)}" x2="${X(mk.spot).toFixed(1)}" y1="0" y2="46" stroke="#35c7dd" stroke-dasharray="3 3"/>${mk.flip != null && mk.flip >= lo && mk.flip <= hi ? `<line x1="${X(mk.flip).toFixed(1)}" x2="${X(mk.flip).toFixed(1)}" y1="0" y2="46" stroke="#f2b94b" stroke-dasharray="2 4"/>` : ''}</svg><small><span class="up">call wall ${px(mk.call_wall)}</span> · <span class="down">put wall ${px(mk.put_wall)}</span>${mk.flip != null ? ` · <span style="color:#f2b94b">flip ${px(mk.flip)}</span>` : ''}</small></div>`; }).join('') + `<p>${esc(T.gex.source)} · ${fmtET(T.gex.asof)} ET. Walls and the largest strikes draw on the chart; index strikes are shifted by the futures basis at the snapshot time.</p>`;
  $$('#tab-gamma .tile').forEach(t => t.addEventListener('click', () => selectMarket(t.dataset.m)));
}
function tabCalc() {
  const el = $('#tab-calc'); const l = lv(cur.market); const last = MIDS[l.feed] ?? l.last; const atr = l.atr_1h || last * .01;
  if (!el.dataset.ready) { el.innerHTML = `<h4>Position from the stop</h4><div class="form"><label>equity<input id="c-eq" value="5000"></label><label>risk %<input id="c-rp" value="0.25"></label><label>entry<input id="c-en"></label><label>stop<input id="c-st"></label><label>target<input id="c-tp"></label><label>max leverage<input id="c-lv" value="10"></label><label class="w"><button class="btn brass" id="c-go" type="button">size it</button></label></div><div id="c-out"></div><p>Quantity from risk ÷ stop distance; leverage capped so the isolated liquidation sits 3× the stop away (engines/calc.js, the same math Fortuna's order planner uses). Nothing is sent anywhere.</p>
    <h4>Ladder · entry plus up to 5 limits</h4><p>Generic DCA-ladder math: the entry is sized so the whole ladder, every leg filled and the stop hit, loses exactly the risk. Levels are yours to enter; no program's defaults are built in.</p>
    <div class="form"><label>entry<input id="l-en"></label><label>stop<input id="l-st"></label><label>take profit<input id="l-tp"></label><label>leverage<input id="l-lv" value="5"></label>${[1, 2, 3, 4, 5].map(i => `<label>limit ${i}<input id="l-p${i}" placeholder="price"></label><label>× size<input id="l-m${i}" value="${i === 1 ? '1' : ''}" placeholder="multiple of entry"></label>`).join('')}<label class="w" style="display:flex;gap:.4rem"><button class="btn brass" id="l-go" type="button">build the ladder</button><button class="btn" id="l-draw" type="button">draw on chart</button><button class="btn" id="l-clear" type="button">clear</button></label></div><div id="l-out"></div>`; el.dataset.ready = '1';
    const ladderInput = () => ({equity: $('#c-eq').value, riskPct: $('#c-rp').value, entry: $('#l-en').value, stop: $('#l-st').value, tp: $('#l-tp').value, leverage: $('#l-lv').value, legs: [1, 2, 3, 4, 5].map(i => ({price: $('#l-p' + i).value, mult: $('#l-m' + i).value || 1}))});
    $('#l-go').addEventListener('click', () => { const o = Calc.ladder(ladderInput()); $('#l-out').innerHTML = o.stages.length ? `<table class="tb"><tr><th>leg</th><th class="n">price</th><th class="n">qty</th><th class="n">avg</th><th class="n">risk</th><th class="n">margin</th><th class="n">R→TP</th></tr>${o.stages.map(st => `<tr><td>${esc(st.leg)}${st.warning ? ' ⚠' : ''}</td><td class="n">${px(st.price)}</td><td class="n">${st.cumQty}</td><td class="n">${px(st.avg)}</td><td class="n">${usd(st.riskUsd)}${st.riskPctOfEquity != null ? ` <small class="muted">${st.riskPctOfEquity}%</small>` : ''}</td><td class="n">${usd(st.margin)}</td><td class="n">${st.rrToTp ?? '—'}</td></tr>`).join('')}</table><p>${o.side} · entry qty ${o.entryQty} · full ladder ${o.totalQty} at avg ${px(o.avgFull)} · full risk ${usd(o.fullRiskUsd)} · full margin ${usd(o.fullMargin)}${o.fullMarginPct != null ? ` (${o.fullMarginPct}% of equity)` : ''}</p>${o.warnings.map(w => `<p class="down">${esc(w)}</p>`).join('')}` : `<p class="down">${o.warnings.join('; ')}</p>`; });
    $('#l-draw').addEventListener('click', () => { const i = ladderInput(); USER_LINES = USER_LINES.filter(u => u.market !== cur.market); const add = (price, title, color, style) => { if (+price > 0) USER_LINES.push({market: cur.market, price: +price, title, color, style}); }; add(i.entry, 'plan entry', '#d9a441', 'solid'); add(i.stop, 'plan stop', '#ff5c7a', 'solid'); add(i.tp, 'plan target', '#3ddc97', 'dashed'); i.legs.forEach((l, k) => add(l.price, `limit ${k + 1} ×${l.mult}`, '#f2b94b', 'dotted')); draw(); });
    $('#l-clear').addEventListener('click', () => { USER_LINES = USER_LINES.filter(u => u.market !== cur.market); draw(); });
    $('#c-go').addEventListener('click', () => { const o = Calc.position({equity: $('#c-eq').value, riskPct: $('#c-rp').value, entry: $('#c-en').value, stop: $('#c-st').value, target: $('#c-tp').value, maxLev: $('#c-lv').value}); $('#c-out').innerHTML = o.qty ? `<dl class="kv"><dt>side</dt><dd>${o.side}</dd><dt>risk</dt><dd>${usd(o.riskUsd)} · ${o.distPct}% away</dd><dt>quantity</dt><dd>${o.qty}</dd><dt>notional</dt><dd>${usd(o.notional)}</dd><dt>leverage · margin</dt><dd>${o.leverage}× · ${usd(o.margin)}</dd><dt>liquidation</dt><dd>${px(o.liq)} (${o.liqDistPct}% away)</dd>${o.rr != null ? `<dt>reward</dt><dd>${o.rr}R · ${usd(o.reward)}</dd>` : ''}</dl>${o.leverageNote ? `<p>${esc(o.leverageNote)}</p>` : ''}${o.warnings.map(w => `<p class="down">${esc(w)}</p>`).join('')}` : `<p class="down">${o.warnings.join('; ')}</p>`; }); }
  if (!$('#c-en').value) { $('#c-en').value = px(last, 6).replace(/,/g, ''); $('#c-st').value = px(last - atr, 6).replace(/,/g, ''); $('#c-tp').value = px(last + 2 * atr, 6).replace(/,/g, ''); }
  if (!$('#l-en').value) { $('#l-en').value = px(last, 6).replace(/,/g, ''); $('#l-st').value = px(last - 1.5 * atr, 6).replace(/,/g, ''); $('#l-tp').value = px(last + 2 * atr, 6).replace(/,/g, ''); $('#l-p1').value = px(last - .5 * atr, 6).replace(/,/g, ''); }
}
function tabDesk() {
  const S = T.state; const ck = (S.checkins || []).slice(-1)[0]; const W = (S.watchlist || []); const w = W.find(x => x.market === cur.market); const al = T.signals && T.signals.alerts ? T.signals.alerts.slice(0, 8) : [];
  $('#tab-desk').innerHTML = `<h4>Fortuna's latest word</h4><p style="color:var(--text)">${esc(ck ? ck.note : '—')}</p><small class="muted mono">${ck ? fmtET(ck.at) + ' ET · ' + esc(ck.account) + ' · next: ' + esc(ck.action) : ''}</small>
    ${w ? `<h4>${esc(cur.market)} on the watchlist</h4><dl class="kv"><dt>direction</dt><dd>${esc(w.direction)}</dd><dt>status</dt><dd>${esc(w.status)}</dd><dt>zone</dt><dd>${px(w.zone_lo)} – ${px(w.zone_hi)} (MFP)</dd><dt>grade cap</dt><dd>${esc(w.grade_max || '—')}</dd><dt>stop rule</dt><dd>${esc(w.stop_rule || '—')}</dd><dt>targets</dt><dd>${esc(w.targets || '—')}</dd></dl><p>${esc(w.setup)}</p>${w.note ? `<p>${esc(w.note)}</p>` : ''}` : `<h4>${esc(cur.market)}</h4><p>Not on Fortuna's watchlist right now.</p>`}
    ${al.length ? `<h4>Scanner alerts</h4><div class="alist">${al.map(a => `<div class="a ${esc(a.level || '')}">${esc(a.text || a.msg || '')}<small>${esc(a.account || '')} ${a.at ? '· ' + fmtET(a.at) : ''}</small></div>`).join('')}</div>` : ''}
    <h4>Accounts</h4><table class="tb">${(S.accounts || []).map(a => `<tr><td>${esc(a.name || a.label || a.id)}</td><td class="n">${a.equity != null ? usd(a.equity) : '—'}</td><td class="n ${cls(a.upnl)}">${a.upnl != null ? usd(a.upnl) : ''}</td></tr>`).join('')}</table>
    <p>Read from the <a href="https://drasticstatic.github.io/trading-assistant-public-preview/data/progression/terminal/" target="_blank" rel="noopener" style="color:var(--brass)">Fortuna Terminal</a>'s published data, refreshed every two minutes.</p>`;
}

/* ── chrome: timeframes, keys, command line, sheet ── */
function wireChrome() {
  $$('#tfs button').forEach(b => b.addEventListener('click', () => selectMarket(cur.market, b.dataset.tf)));
  $$('#engine button').forEach(b => b.addEventListener('click', () => applyEngine(b.dataset.eng)));
  $$('#mode button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#help-btn').addEventListener('click', () => sheet('Commands and keys', HELP)); $('#sheet-x').addEventListener('click', closeSheet); $('#sheet').addEventListener('click', (e) => { if (e.target === $('#sheet')) closeSheet(); });
  const H = history(); let hi = -1; const cmd = $('#cmd');
  cmd.addEventListener('keydown', (e) => { if (e.key === 'Enter') { run(cmd.value); H.push(cmd.value.trim()); hi = -1; cmd.value = ''; } else if (e.key === 'ArrowUp') { hi = Math.min(H.list.length - 1, hi + 1); cmd.value = H.list[hi] || ''; e.preventDefault(); } else if (e.key === 'ArrowDown') { hi = Math.max(-1, hi - 1); cmd.value = hi < 0 ? '' : H.list[hi]; e.preventDefault(); } else if (e.key === 'Escape') { cmd.value = ''; cmd.blur(); } });
  document.addEventListener('keydown', (e) => { if (e.target === cmd || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; if (e.key === '/') { e.preventDefault(); cmd.focus(); return; } if (e.key === '?') { sheet('Commands and keys', HELP); return; } if (e.key === 'Escape') { closeSheet(); setTool('cursor'); return; }
    if (MODE === 'treasury') return;
    const tfk = {'1': '5m', '2': '15m', '3': '1h', '4': '4h', '5': '1d'}[e.key]; if (tfk) return selectMarket(cur.market, tfk); if (e.key === 'f') { C.fit(); if (SV) SV.fit(); } if (e.key === 'l') { cur.mode = cur.mode === 'line' ? 'candles' : 'line'; draw(); } if (e.key === 'v') { view.vol = !view.vol; draw(); } if (e.key === 'Delete' || e.key === 'Backspace') { const d = C.drawings; if (d.selected) { d.items = d.items.filter(x => x !== d.selected); d.selected = null; d.update(); saveDrawings(); } } });
}
function run(text) {
  const names = T.levels.levels.map(l => l.market); const r = parse(text, names); const bar = $('.cmd'); const flash = (k) => { bar.classList.remove('ok', 'err'); void bar.offsetWidth; bar.classList.add(k); setTimeout(() => bar.classList.remove(k), 900); };
  if (!r) return; if (r.error) { $('#cmd-hint').textContent = r.error; flash('err'); return; }
  $('#cmd-hint').textContent = '/ to focus · ↑↓ history · Esc clears';
  const v = r.verb;
  if (v === 'help') sheet('Commands and keys', HELP);
  else if (v === 'theme') { const root = document.documentElement; const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); root.dataset.theme = cur === 'light' ? 'dark' : 'light'; try { localStorage.setItem('fv-theme', root.dataset.theme); } catch (e) {} }
  else if (v === 'clear') { C.drawings.setItems([]); saveDrawings(); }
  else if (v === 'draw') setTool(r.arg || 'trend');
  else if (v === 'fit') { C.fit(); if (SV) SV.fit(); } else if (v === 'follow') { C.scrollToEnd(); if (SV) SV.follow(); }
  else if (v === 'svg' || v === 'tradingview') applyEngine(v === 'svg' ? 'svg' : 'lw');
  else if (v === 'line' || v === 'candles') { cur.mode = v; draw(); } else if (v === 'vol') { view.vol = !view.vol; draw(); }
  else if (v === 'treasury' || v === 'markets') { setMode(v); return flash('ok'); }
  else if (MODE === 'treasury' && ['yields', 'stables', 'holdings'].includes(v)) showTab(v); else if (MODE === 'treasury' && v === 'desk') showTab('tdesk');
  else if (['levels', 'regime', 'flow', 'gamma', 'calc', 'desk'].includes(v)) showTab(v);
  if (r.market || r.tf) { if (MODE === 'treasury') setMode('markets').then(() => selectMarket(r.market || cur.market, r.tf || undefined)); else selectMarket(r.market || cur.market, r.tf || undefined); } flash('ok');
}
function sheet(title, html) { $('#sheet-title').textContent = title; $('#sheet-body').innerHTML = html; $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
try { const th = localStorage.getItem('fv-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
boot().catch(e => { console.error(e); status('warn', 'failed to start: ' + e.message); });

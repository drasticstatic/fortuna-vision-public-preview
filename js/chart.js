/* The chart: TradingView Lightweight Charts v5 (Apache-2.0, vendored) with FortunaVision's overlays as series primitives.
 * Price pane: candles or area, volume, EMAs, Fortuna's Auto Levels, zones, positions, fibs, session rails, FVGs, pattern marks, gamma walls, large prints.
 * Indicator panes: any indicator written to the indicators/ contract (one file, inputs/outputs/calc).
 * Drawings: Lewis Jackson's DrawingLayer (MIT, quant-terminal), points stored as time + price so they survive timeframe changes. */
import {DrawingLayer, TOOLS, TOOL_BY_ID} from './drawings.js';
const LW = window.LightweightCharts;
const NY = 'America/New_York';
const fmtT = (t, iv) => new Date(t * 1000).toLocaleString('en-US', {timeZone: NY, month: 'short', day: 'numeric', ...(iv === '1d' ? {} : {hour: 'numeric', minute: '2-digit'})});

/* boxes + rays + marks primitive (zones, FVGs, levels with a birth time, pattern labels, prints) */
class Overlays {
  constructor() { this.items = {boxes: [], rays: [], marks: []}; this._b = {zOrder: () => 'bottom', renderer: () => ({draw: (t) => t.useMediaCoordinateSpace(({context, mediaSize}) => this.drawBottom(context, mediaSize))})}; this._t = {zOrder: () => 'top', renderer: () => ({draw: (t) => t.useMediaCoordinateSpace(({context, mediaSize}) => this.drawTop(context, mediaSize))})}; }
  attached({chart, series, requestUpdate}) { this.chart = chart; this.series = series; this.requestUpdate = requestUpdate; } detached() {} updateAllViews() {} paneViews() { return [this._b, this._t]; }
  set(items) { this.items = Object.assign({boxes: [], rays: [], marks: []}, items); this.requestUpdate && this.requestUpdate(); }
  x(t) { return this.chart.timeScale().timeToCoordinate(t); } y(p) { return this.series.priceToCoordinate(p); }
  drawBottom(ctx, size) { const W = size.width; ctx.font = '10px IBM Plex Mono, monospace';
    this.items.boxes.forEach(b => { const y0 = this.y(b.p0), y1 = this.y(b.p1); if (y0 == null || y1 == null) return; let x0 = b.t0 != null ? this.x(b.t0) : 0, x1 = b.t1 != null ? this.x(b.t1) : W; if (x0 == null) x0 = 0; if (x1 == null) x1 = W; const y = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0)); ctx.fillStyle = b.fill; ctx.fillRect(x0, y, Math.max(2, x1 - x0), h); if (b.stroke) { ctx.strokeStyle = b.stroke; ctx.setLineDash(b.dash || []); ctx.lineWidth = 1; ctx.strokeRect(x0, y, Math.max(2, x1 - x0), h); ctx.setLineDash([]); } if (b.label) { ctx.fillStyle = b.stroke || b.fill; ctx.fillText(b.label, x0 + 4, y - 3); } });
    this.items.rays.forEach(r => { const y = this.y(r.price); if (y == null) return; let x0 = r.t0 != null ? this.x(r.t0) : 0; if (x0 == null) x0 = 0; ctx.strokeStyle = r.color; ctx.lineWidth = r.width || 1; ctx.globalAlpha = r.alpha ?? 1; ctx.setLineDash(r.dash || []); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]); if (r.label) { ctx.fillStyle = r.color; ctx.font = (r.bold ? '600 ' : '') + '9.5px IBM Plex Mono, monospace'; ctx.textAlign = r.labelPos === 'right' ? 'right' : 'left'; ctx.fillText(r.label, r.labelPos === 'right' ? W - 4 : x0 + 4, y - 3); ctx.textAlign = 'left'; } ctx.globalAlpha = 1; }); }
  drawTop(ctx) { this.items.marks.forEach(m => { const x = this.x(m.t), y = this.y(m.price); if (x == null || y == null) return; ctx.fillStyle = m.color; if (m.dot) { ctx.globalAlpha = .85; ctx.beginPath(); ctx.arc(x, y, m.dot, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; return; } ctx.font = '600 9.5px IBM Plex Mono, monospace'; ctx.textAlign = 'center'; ctx.fillText(m.text, x, m.side === 'high' ? y - 6 : y + 13); ctx.textAlign = 'left'; }); }
}

/* visible-range volume profile along the right edge, point of control in brass */
class Profile {
  constructor() { this.bars = []; this.on = true; this._v = {zOrder: () => 'bottom', renderer: () => ({draw: (t) => t.useMediaCoordinateSpace(({context, mediaSize}) => this.draw(context, mediaSize))})}; }
  attached({chart, series, requestUpdate}) { this.chart = chart; this.series = series; this.requestUpdate = requestUpdate; } detached() {} updateAllViews() {} paneViews() { return [this._v]; }
  set(bars, on) { this.bars = bars; this.on = on; this.requestUpdate && this.requestUpdate(); }
  draw(ctx, size) { if (!this.on || !this.bars.length) return; const r = this.chart.timeScale().getVisibleLogicalRange(); if (!r) return; const from = Math.max(0, Math.floor(r.from)), to = Math.min(this.bars.length - 1, Math.ceil(r.to)); const vis = this.bars.slice(from, to + 1); if (!vis.length || !vis.some(b => b.v > 0)) return;
    const lo = Math.min(...vis.map(b => b.l)), hi = Math.max(...vis.map(b => b.h)); const B = 28, bins = new Array(B).fill(0); vis.forEach(b => { const k = Math.max(0, Math.min(B - 1, Math.floor((b.c - lo) / (hi - lo || 1) * B))); bins[k] += b.v || 0; }); const bmax = Math.max(...bins) || 1; const poc = bins.indexOf(bmax); const W = size.width;
    bins.forEach((v, k) => { const p0 = lo + (hi - lo) * k / B, p1 = lo + (hi - lo) * (k + 1) / B; const y0 = this.series.priceToCoordinate(p1), y1 = this.series.priceToCoordinate(p0); if (y0 == null || y1 == null) return; const w = v / bmax * W * .15; ctx.fillStyle = k === poc ? 'rgba(217,164,65,.5)' : 'rgba(53,199,221,.16)'; ctx.fillRect(W - w, y0, w, Math.max(1, y1 - y0 - 1)); }); }
}

export function createChart(el, opts = {}) {
  const chart = LW.createChart(el, {autoSize: true, layout: {background: {type: 'solid', color: 'transparent'}, textColor: '#8a94a6', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, attributionLogo: false, panes: {separatorColor: '#1c2430', separatorHoverColor: 'rgba(217,164,65,.3)', enableResize: true}}, grid: {vertLines: {color: 'rgba(255,255,255,.035)'}, horzLines: {color: 'rgba(255,255,255,.045)'}}, crosshair: {mode: LW.CrosshairMode.Normal}, rightPriceScale: {borderColor: 'rgba(255,255,255,.08)', scaleMargins: {top: .07, bottom: .2}}, timeScale: {borderColor: 'rgba(255,255,255,.08)', timeVisible: true, secondsVisible: false, rightOffset: 10}, localization: {timeFormatter: (t) => fmtT(t, state.iv)}});
  const state = {iv: '1h', bars: [], mode: 'candles'};
  const main = chart.addSeries(LW.CandlestickSeries, {upColor: '#3ddc97', downColor: '#ff5c7a', borderVisible: false, wickUpColor: '#3ddc97', wickDownColor: '#ff5c7a', priceLineColor: '#d9a441', priceLineWidth: 1});
  const vol = chart.addSeries(LW.HistogramSeries, {priceFormat: {type: 'volume'}, priceScaleId: 'vol', lastValueVisible: false, priceLineVisible: false}); chart.priceScale('vol').applyOptions({scaleMargins: {top: .85, bottom: 0}});
  const emas = ['#35c7dd', '#9b8cff', '#ff8fb1'].map(c => chart.addSeries(LW.LineSeries, {color: c, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false}));
  let area = null;
  const overlays = new Overlays(); main.attachPrimitive(overlays); const profile = new Profile(); main.attachPrimitive(profile);
  /* drawings: the pane adapter the DrawingLayer expects (timeToX interpolates between bars so lines stay straight off-grid) */
  const pane = {timeToX(utc) { const b = state.bars; if (!b.length) return null; const ts = chart.timeScale(); const t = utc * 1000; let lo = 0, hi = b.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (b[m].t < t) lo = m + 1; else hi = m; } const i = lo; const step = IVS[state.iv] || (b[1] ? b[1].t - b[0].t : 36e5); let logical; if (b[i].t === t) logical = i; else if (i === 0) logical = (t - b[0].t) / step; else logical = i - 1 + (t - b[i - 1].t) / step; if (t > b[b.length - 1].t) logical = b.length - 1 + (t - b[b.length - 1].t) / step; return ts.logicalToCoordinate(logical); }};
  const drawings = new DrawingLayer(pane); main.attachPrimitive(drawings);
  const lines = []; const panes = {}; const pathS = {};  // indicator panes by id: {series: {key: series}, index}
  const api = {chart, main, vol, emas, overlays, profile, drawings, state, TOOLS, TOOL_BY_ID,
    setBars(bars, iv, mode) { state.bars = bars; state.iv = iv; state.mode = mode || 'candles'; const bigAxis = bars.length && Math.abs(bars[bars.length - 1].c) >= 1e6; chart.applyOptions({localization: {timeFormatter: (t) => fmtT(t, iv), priceFormatter: bigAxis ? (v) => Math.abs(v) >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v.toFixed(0) : undefined}});
      main.setData(bars.map(b => ({time: b.t / 1000, open: b.o, high: b.h, low: b.l, close: b.c})));
      if (state.mode === 'line') { if (!area) area = chart.addSeries(LW.AreaSeries, {lineColor: '#35c7dd', topColor: 'rgba(53,199,221,.22)', bottomColor: 'rgba(53,199,221,0)', lineWidth: 2, priceLineVisible: false}); area.setData(bars.map(b => ({time: b.t / 1000, value: b.c}))); area.applyOptions({visible: true}); main.applyOptions({visible: false}); } else { area && area.applyOptions({visible: false}); main.applyOptions({visible: true}); }
      vol.setData(bars.map(b => ({time: b.t / 1000, value: b.v || 0, color: b.c >= b.o ? 'rgba(61,220,151,.3)' : 'rgba(255,92,122,.3)'}))); profile.set(bars, profile.on); },
    setEMAs(arrs) { arrs.forEach((a, k) => emas[k].setData(a ? a.map((v, i) => ({time: state.bars[i].t / 1000, value: v})).filter(p => Number.isFinite(p.value)) : [])); },
    clearLines() { lines.splice(0).forEach(l => { try { main.removePriceLine(l); } catch (e) {} }); },
    priceLine(price, color, title, style, width) { const l = main.createPriceLine({price, color, lineWidth: width || 1, lineStyle: style ?? LW.LineStyle.Dashed, axisLabelVisible: true, title: title || ''}); lines.push(l); return l; },
    setOverlays(items) { overlays.set(items); },
    setPaths(list) { const keep = new Set(); (list || []).forEach(p => { keep.add(p.key); if (!pathS[p.key]) pathS[p.key] = chart.addSeries(LW.LineSeries, {color: p.color, lineWidth: p.width || 1, lineStyle: p.dash && p.dash.length ? LW.LineStyle.Dotted : LW.LineStyle.Solid, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false}); pathS[p.key].setData(p.values.map((v, i) => Number.isFinite(v) && state.bars[i] ? {time: state.bars[i].t / 1000, value: v} : null).filter(Boolean)); }); Object.keys(pathS).forEach(k => { if (!keep.has(k)) pathS[k].setData([]); }); }, setVolume(on) { vol.applyOptions({visible: on}); profile.on = on; profile.requestUpdate && profile.requestUpdate(); },
    fit() { chart.timeScale().fitContent(); }, scrollToEnd() { chart.timeScale().scrollToRealTime(); },
    /* indicator pane: outputs → series; one pane per indicator id */
    pane(id, def) { if (panes[id]) return panes[id]; const index = Object.keys(panes).length + 1; const series = {}; (def.outputs || [{key: 'value', color: '#d9a441'}]).forEach(o => { const opt = {color: o.color || '#d9a441', lineWidth: o.lineWidth || 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false, priceScaleId: 'right'}; series[o.key] = o.kind === 'histogram' ? chart.addSeries(LW.HistogramSeries, {color: o.color || '#d9a441', base: o.zero ?? 0, priceLineVisible: false, lastValueVisible: false, priceScaleId: 'right'}, index) : chart.addSeries(LW.LineSeries, opt, index); }); const p = chart.panes()[index]; if (p && p.setHeight) p.setHeight(def.height || 120); const levels = (def.levels || []).map(v => series[Object.keys(series)[0]].createPriceLine({price: v, color: 'rgba(138,148,166,.5)', lineWidth: 1, lineStyle: LW.LineStyle.Dashed, axisLabelVisible: true, title: ''})); return (panes[id] = {index, series, levels, def}); },
    setPane(id, data) { const p = panes[id]; if (!p) return; Object.entries(data).forEach(([k, arr]) => { const s = p.series[k]; if (!s || !arr) return; const o = (p.def.outputs || []).find(x => x.key === k) || {}; s.setData(arr.map((v, i) => (Number.isFinite(v) && state.bars[i]) ? {time: state.bars[i].t / 1000, value: v, ...(o.kind === 'histogram' ? {color: o.colorFn ? o.colorFn(v, i, arr) : (v >= (o.zero ?? 0) ? '#3ddc97' : '#ff5c7a')} : {})} : null).filter(Boolean)); }); },
    removePane(id) { const p = panes[id]; if (!p) return; Object.values(p.series).forEach(s => { try { chart.removeSeries(s); } catch (e) {} }); delete panes[id]; },
    /* pointer → {time, price} for drawings, extrapolating to the right of the last bar */
    pointAt(p) { if (!p.point) return null; const price = main.coordinateToPrice(p.point.y); if (price == null) return null; let time = p.time; if (time == null) { const logical = chart.timeScale().coordinateToLogical(p.point.x); if (logical == null || !state.bars.length) return null; const step = IVS[state.iv] || 36e5; const last = state.bars.length - 1; time = (state.bars[Math.max(0, Math.min(last, Math.round(logical)))].t + (logical > last ? (logical - last) * step : 0)) / 1000; } return {time, price}; },
    onCrosshair(fn) { chart.subscribeCrosshairMove(p => { const d = p && p.time ? p.seriesData.get(main) : null; fn(d ? {t: p.time * 1000, o: d.open, h: d.high, l: d.low, c: d.close} : null, p); }); },
    onClick(fn) { chart.subscribeClick(fn); },
    destroy() { chart.remove(); }};
  return api;
}
const IVS = {'5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5};
export const LineStyle = LW.LineStyle;
export const EMA = (arr, n) => { const k = 2 / (n + 1); let e = null; return arr.map(v => (e = e == null ? v : v * k + e * (1 - k))); };

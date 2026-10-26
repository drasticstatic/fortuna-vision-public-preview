/* Data sources. Every number on screen comes from a public endpoint named here.
 *  - Fortuna's published terminal data (levels, state, signals, gamma): static JSON on GitHub Pages, CORS open.
 *  - Hyperliquid public API: candles, mids, order book, live trades (websocket). No key.
 * Override the terminal data base with ?data=<url> (kept in localStorage) to point FortunaVision at another publisher. */
export const DEFAULT_DATA = 'https://drasticstatic.github.io/trading-assistant-public-preview/data/progression/terminal/data/';
export const HL = 'https://api.hyperliquid.xyz/info';
export const HL_WS = 'wss://api.hyperliquid.xyz/ws';
export const IV_MS = {'5m': 3e5, '15m': 9e5, '1h': 36e5, '4h': 144e5, '1d': 864e5};

export function dataBase() {
  try { const q = new URLSearchParams(location.search).get('data'); if (q) { localStorage.setItem('fv-data', q); return q.endsWith('/') ? q : q + '/'; } const s = localStorage.getItem('fv-data'); if (s) return s.endsWith('/') ? s : s + '/'; } catch (e) {}
  return location.protocol === 'file:' ? 'data/' : DEFAULT_DATA;
}
const base = dataBase();
export async function json(name) { const r = await fetch(base + name, {cache: 'no-store'}); if (!r.ok) throw new Error(name + ' ' + r.status); return r.json(); }
export async function loadTerminal() {
  const [levels, state, signals, gex] = await Promise.all([json('levels.json'), json('state.json'), json('signals.json').catch(() => null), json('gex.json').catch(() => null)]);
  return {levels, state, signals, gex, base};
}

export async function post(body) { const r = await fetch(HL, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}); if (!r.ok) throw new Error('hyperliquid ' + r.status); return r.json(); }
export function feedParts(feed) { const [dex, coin] = feed.includes(':') ? feed.split(':') : [null, feed]; return {dex, coin: dex ? feed : coin}; }
export async function candles(feed, iv, bars = 600) {
  const now = Date.now(); const r = await post({type: 'candleSnapshot', req: {coin: feed, interval: iv, startTime: now - bars * IV_MS[iv], endTime: now}});
  return r.map(x => ({t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c, v: +x.v || 0}));
}
export async function mids() { const [a, x] = await Promise.all([post({type: 'allMids'}), post({type: 'allMids', dex: 'xyz'}).catch(() => ({}))]); const out = {}; Object.entries(a).forEach(([k, v]) => out[k] = +v); Object.entries(x).forEach(([k, v]) => out[k.includes(':') ? k : 'xyz:' + k] = +v); return out; }
export async function book(feed, depth = 10) { const b = await post({type: 'l2Book', coin: feed}); const bid = b.levels[0].slice(0, depth).reduce((s, x) => s + x.sz * x.px, 0), ask = b.levels[1].slice(0, depth).reduce((s, x) => s + x.sz * x.px, 0); return {bid, ask, imb: (bid - ask) / (bid + ask || 1), bestBid: +b.levels[0][0].px, bestAsk: +b.levels[1][0].px, at: Date.now()}; }

/* live trades: one websocket per feed, trades kept for the last 20 minutes */
export function tradeStream(feed, onTrade) {
  let ws = null, closed = false;
  const open = () => { if (closed) return; ws = new WebSocket(HL_WS); ws.onopen = () => ws.send(JSON.stringify({method: 'subscribe', subscription: {type: 'trades', coin: feed}}));
    ws.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (m.channel !== 'trades' || !Array.isArray(m.data)) return; m.data.forEach(t => { if (t.coin === feed) onTrade({t: t.time, px: +t.px, sz: +t.sz, buy: t.side === 'B'}); }); } catch (e) {} };
    ws.onclose = () => { if (!closed) setTimeout(open, 4000); }; };
  open(); return {close() { closed = true; try { ws && ws.close(); } catch (e) {} }};
}

/* The command line. Function-code grammar after the Bloomberg / amber-terminal idea: a market, a timeframe, a verb.
 *   gold 15m        switch market and timeframe          btc gex       open the gamma tab for BTC
 *   es levels       open the levels tab for the S&P      draw fib      pick the fib tool
 *   clear           remove drawings on this market       theme         toggle light / dark
 *   help            show this                            fit · follow · line · candles
 */
export const ALIASES = {es: 'S&P 500', sp: 'S&P 500', spx: 'S&P 500', sp500: 'S&P 500', nq: 'Nasdaq-100', ndx: 'Nasdaq-100', nas: 'Nasdaq-100', nasdaq: 'Nasdaq-100', gc: 'Gold', xau: 'Gold', gold: 'Gold', si: 'Silver', xag: 'Silver', silver: 'Silver', cl: 'Crude', wti: 'Crude', oil: 'Crude', crude: 'Crude', brent: 'Brent', xbr: 'Brent', btc: 'BTC', eth: 'ETH', sol: 'SOL', rty: 'Russell 2000', m2k: 'Russell 2000', russell: 'Russell 2000', total2: 'TOTAL2'};
const TFS = {'1m': '5m', '5m': '5m', '5': '5m', '15m': '15m', '15': '15m', '1h': '1h', '60': '1h', 'h': '1h', '4h': '4h', '240': '4h', '1d': '1d', 'd': '1d', 'daily': '1d'};
const VERBS = ['levels', 'regime', 'flow', 'gamma', 'gex', 'calc', 'desk', 'draw', 'clear', 'theme', 'help', 'fit', 'follow', 'line', 'candles', 'vol', 'volume', 'svg', 'tradingview', 'tv', 'treasury', 'markets', 'yields', 'stables', 'holdings', 'wallets', 'alert', 'alerts', 'unalert', 'notify'];

export function parse(text, markets) {
  const toks = text.trim().toLowerCase().split(/\s+/).filter(Boolean); if (!toks.length) return null;
  const out = {market: null, tf: null, verb: null, arg: null, num: null, dir: null};
  const names = Object.fromEntries(markets.map(m => [m.toLowerCase(), m]));
  for (const t of toks) {
    if (ALIASES[t]) out.market = ALIASES[t];
    else if (names[t]) out.market = names[t];
    else if (TFS[t]) out.tf = TFS[t];
    else if (VERBS.includes(t)) { out.verb = t === 'gex' ? 'gamma' : t === 'volume' ? 'vol' : t === 'tv' ? 'tradingview' : t; }
    else if (out.verb === 'draw') out.arg = t;
    else if (t === 'above' || t === 'below') out.dir = t;
    else if (/^[\d.,]+$/.test(t)) out.num = parseFloat(t.replace(/,/g, ''));
    else return {error: `don't know "${t}" — try a market (gold, btc, es), a timeframe (15m, 1h) or help`};
  }
  return out;
}

export function history() {
  let h = []; try { h = JSON.parse(localStorage.getItem('fv-cmd-history') || '[]'); } catch (e) {}
  return {list: h, push(s) { h = [s].concat(h.filter(x => x !== s)).slice(0, 50); try { localStorage.setItem('fv-cmd-history', JSON.stringify(h)); } catch (e) {} }};
}

export const HELP = `
<p>Type a market, a timeframe, a verb, in any order. Enter runs it. <code>/</code> focuses the line from anywhere, <code>Esc</code> clears it, <code>↑</code> <code>↓</code> walk the history.</p>
<table class="tb"><tr><th>Markets</th><td>gold · silver · crude · brent · btc · eth · sol · es (S&amp;P 500) · nq (Nasdaq-100) · rty · total2, or any name in the rail</td></tr>
<tr><th>Timeframes</th><td>5m · 15m · 1h · 4h · 1d</td></tr>
<tr><th>Tabs</th><td>levels · regime · flow · gamma · calc · desk, for example <code>btc gamma</code></td></tr>
<tr><th>Chart</th><td>fit · follow · line · candles · vol (toggle volume + profile) · <code>svg</code> / <code>tradingview</code> picks the engine</td></tr>
<tr><th>Drawing</th><td><code>draw trend</code> · ray · hline · hray · vline · rect · fib · long · short · text · <code>clear</code> removes this market's drawings · Delete removes the selected one</td></tr>
<tr><th>Modes</th><td><code>treasury</code> turns the workstation toward a DAO treasury (chains by value locked, stablecoin yields, supply, your holdings and wallets by public address); <code>markets</code> comes back</td></tr>
<tr><th>Alerts</th><td><code>alert 4020</code> (direction inferred) · <code>alert above 4020</code> · <code>alerts</code> lists them · <code>unalert</code> clears this market's · <code>notify</code> asks the browser for desktop notifications; alerts are checked every 30 s while the page is open and fire as a notification or a flash on the command line</td></tr>
<tr><th>Theme</th><td><code>theme</code> toggles light and dark</td></tr></table>
<p>Keys: <code>1</code>–<code>5</code> timeframes · <code>f</code> fit · <code>l</code> line/candles · <code>v</code> volume · <code>Delete</code> remove the selected drawing · <code>?</code> this card.</p>`;

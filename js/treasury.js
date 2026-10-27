/* Treasury mode — the same workstation pointed at a DAO treasury's world instead of a trader's.
 * Rail: chains by total value locked. Chart: a chain's TVL history. Inspector: stablecoin yields, stablecoin supply, the treasury's own
 * holdings (kept in this browser, priced live), and the desk. Every number from a public source: DeFiLlama (TVL, yields, stablecoins) and CoinGecko (prices). */
const LLAMA = 'https://api.llama.fi', YIELDS = 'https://yields.llama.fi', STABLES = 'https://stablecoins.llama.fi', CG = 'https://api.coingecko.com/api/v3';
const $ = (s, r = document) => r.querySelector(s); const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const usd = (v, d = 0) => v == null ? '—' : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', {maximumFractionDigits: d});
const big = (v) => v == null ? '—' : v >= 1e12 ? '$' + (v / 1e12).toFixed(2) + 'T' : v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : '$' + Math.round(v).toLocaleString('en-US');
const pct = (v, d = 2) => v == null ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(d) + '%';
const cls = (v) => v > 0 ? 'up' : v < 0 ? 'down' : '';
const get = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); };

import { tabArb } from './dexarb.js'; // the Arbitrum DEX-arb lane (Alfred's adapter; reads the lane's public snapshot)
export const TABS = [{id: 'caps', label: 'Markets'}, {id: 'yields', label: 'Yields'}, {id: 'stables', label: 'Stables'}, {id: 'holdings', label: 'Holdings'}, {id: 'arb', label: 'DEX arb'}, {id: 'tdesk', label: 'Desk'}];
const S = {chains: null, chain: 'Ethereum', hist: {}, pools: null, stables: null, prices: {}, tab: 'caps', global: null, caps: null, capsAt: 0};
let app = null;

export async function enter(ctx) {
  app = ctx; S.tab = 'caps'; S.jump = ctx.jump;
  $('#mkt').textContent = 'Treasury'; $('#mkt-sub').textContent = 'loading chains…';
  try { S.chains = (await get(LLAMA + '/v2/chains')).filter(c => c.tvl > 0).sort((a, b) => b.tvl - a.tvl); } catch (e) { $('#mkt-sub').textContent = 'DeFiLlama unavailable'; return; }
  renderRail(); await selectChain(S.chain);
}
export function leave() { app = null; }

function renderRail() {
  const total = S.chains.reduce((s, c) => s + c.tvl, 0);
  $('#rail').innerHTML = `<div class="grp">Chains by value locked · ${big(total)} total</div>` + S.chains.slice(0, 40).map(c => `<div class="r ${c.name === S.chain ? 'on' : ''}" data-c="${esc(c.name)}" role="button" tabindex="0"><b>${esc(c.name)}</b><span class="px">${big(c.tvl)}</span><small>${esc(c.tokenSymbol || '')}</small><span class="chg muted">${(c.tvl / total * 100).toFixed(1)}%</span></div>`).join('');
  $$('#rail .r').forEach(r => r.addEventListener('click', () => selectChain(r.dataset.c)));
}
async function selectChain(name) {
  S.chain = name; renderRail(); const c = S.chains.find(x => x.name === name); $('#mkt').textContent = name; $('#mkt-sub').textContent = `value locked ${big(c ? c.tvl : null)} · loading history`;
  try { if (!S.hist[name]) S.hist[name] = await get(LLAMA + '/v2/historicalChainTvl/' + encodeURIComponent(name)); } catch (e) { $('#mkt-sub').textContent = 'history unavailable'; return; }
  const h = S.hist[name].filter(p => p.tvl > 0); const bars = h.map(p => ({t: p.date * 1000, o: p.tvl, h: p.tvl, l: p.tvl, c: p.tvl, v: 0}));
  const last = bars[bars.length - 1], d7 = bars[bars.length - 8], d30 = bars[bars.length - 31];
  $('#mkt-sub').textContent = `value locked ${big(last.c)} · 7d ${pct(d7 ? (last.c / d7.c - 1) * 100 : null)} · 30d ${pct(d30 ? (last.c / d30.c - 1) * 100 : null)} · DeFiLlama, daily`;
  app.drawScene({market: 'tvl:' + name, iv: '1d', mode: 'line', bars, vol: false, emas: [{values: app.EMA(bars.map(b => b.c), 30), color: '#9b8cff'}, {values: app.EMA(bars.map(b => b.c), 90), color: '#ff8fb1'}], lines: [], boxes: [], rays: [], marks: [], paths: [], panes: []});
  $('#legend').innerHTML = `<span><b>${esc(name)} TVL</b> daily, USD</span><span style="color:#9b8cff">EMA 30</span><span style="color:#ff8fb1">EMA 90</span>`;
  renderTab(S.tab);
}
export function renderTab(t) { S.tab = t; ({caps: tabCaps, yields: tabYields, stables: tabStables, holdings: tabHoldings, arb: tabArb, tdesk: tabDesk}[t] || (() => {}))(); }

async function tabCaps() {
  const el = $('#tab-caps'); if (!el) return; if (!S.caps || Date.now() - S.capsAt > 120000) { el.innerHTML = '<p>loading market caps…</p>'; try { [S.global, S.caps] = await Promise.all([get(CG + '/global').then(r => r.data), get(CG + '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h,7d,30d')]); S.capsAt = Date.now(); } catch (e) { el.innerHTML = '<p>CoinGecko unavailable (rate-limited or offline); try again in a minute.</p>'; return; } }
  const g = S.global; const dom = g.market_cap_percentage || {}; const total = g.total_market_cap.usd, vol = g.total_volume.usd; const total2 = total * (1 - (dom.btc || 0) / 100);
  el.innerHTML = `<div class="tile"><small>total crypto market cap</small><div class="big ${cls(g.market_cap_change_percentage_24h_usd)}">${big(total)}</div><small>${pct(g.market_cap_change_percentage_24h_usd)} 24h · volume ${big(vol)} · TOTAL2 (ex-BTC) ${big(total2)}</small></div>
    <div class="tile"><small>dominance</small><div class="prints">${Object.entries(dom).slice(0, 8).map(([k, v]) => `<span>${esc(k.toUpperCase())} <b>${v.toFixed(1)}%</b></span>`).join('')}</div></div>
    <h4>Top 50 by market cap</h4><table class="tb"><tr><th>#</th><th>asset</th><th class="n">price</th><th class="n">24h</th><th class="n">7d</th><th class="n">30d</th><th class="n">cap</th></tr>${S.caps.map(c => `<tr class="${['btc', 'eth', 'sol'].includes(c.symbol) ? 'jump' : ''}" data-sym="${esc(c.symbol.toUpperCase())}" title="${['btc', 'eth', 'sol'].includes(c.symbol) ? 'open the chart' : ''}"><td class="muted">${c.market_cap_rank}</td><td>${esc(c.symbol.toUpperCase())}<br><small class="muted">${esc(c.name)}</small></td><td class="n">${usd(c.current_price, c.current_price < 1 ? 4 : 2)}</td><td class="n ${cls(c.price_change_percentage_24h_in_currency)}">${pct(c.price_change_percentage_24h_in_currency, 1)}</td><td class="n ${cls(c.price_change_percentage_7d_in_currency)}">${pct(c.price_change_percentage_7d_in_currency, 1)}</td><td class="n ${cls(c.price_change_percentage_30d_in_currency)}">${pct(c.price_change_percentage_30d_in_currency, 1)}</td><td class="n">${big(c.market_cap)}</td></tr>`).join('')}</table><p>CoinGecko, refreshed every two minutes while open. Market cap and dominance are the treasury's weather; the chains rail is where the value is actually put to work. Rows with a chart open it on click.</p>`;
  $$('tr.jump', el).forEach(r => r.addEventListener('click', () => S.jump && S.jump(r.dataset.sym)));
}
async function tabYields() {
  const el = $('#tab-yields'); if (!el) return;
  if (!S.pools) { el.innerHTML = `<h4>Stablecoin yields</h4><p>DeFiLlama's pool list is large (about 11 MB). Load it once per session and it stays in memory.</p><button class="btn brass" id="y-load" type="button">load yields</button>`; $('#y-load').addEventListener('click', async () => { $('#y-load').textContent = 'loading…'; try { S.pools = (await get(YIELDS + '/pools')).data; } catch (e) { $('#y-load').textContent = 'failed, try again'; return; } tabYields(); }); return; }
  const chain = S.chain; const rows = S.pools.filter(p => p.stablecoin && p.tvlUsd >= 2e7 && p.apy != null && p.apy < 60 && (p.chain === chain || chain === 'all')).sort((a, b) => b.apy - a.apy).slice(0, 40);
  const all = S.pools.filter(p => p.stablecoin && p.tvlUsd >= 1e8 && p.apy != null && p.apy < 60).sort((a, b) => b.apy - a.apy).slice(0, 15);
  const tbl = (list) => `<table class="tb"><tr><th>pool</th><th>chain</th><th class="n">TVL</th><th class="n">APY</th><th class="n">30d</th></tr>${list.map(p => `<tr><td>${esc(p.symbol)}<br><small class="muted">${esc(p.project)}${p.ilRisk === 'yes' ? ' · IL' : ''}${p.exposure === 'multi' ? ' · multi' : ''}</small></td><td>${esc(p.chain)}</td><td class="n">${big(p.tvlUsd)}</td><td class="n up">${p.apy.toFixed(2)}%</td><td class="n muted">${p.apyMean30d != null ? p.apyMean30d.toFixed(2) + '%' : '—'}</td></tr>`).join('')}</table>`;
  el.innerHTML = `<h4>Stablecoin pools on ${esc(chain)} · TVL ≥ $20M · by APY</h4>${rows.length ? tbl(rows) : '<p>No stablecoin pools of that size on this chain.</p>'}<h4>Across chains · TVL ≥ $100M</h4>${tbl(all)}<p>APY as reported to DeFiLlama (base + rewards); 30d is the trailing mean. Yields above 60% are hidden as noise. Not advice: a list to read, then verify at the protocol.</p>`;
}
async function tabStables() {
  const el = $('#tab-stables'); if (!el) return; el.innerHTML = '<p>loading stablecoins…</p>';
  try { if (!S.stables) S.stables = (await get(STABLES + '/stablecoins?includePrices=true')).peggedAssets; } catch (e) { el.innerHTML = '<p>DeFiLlama stablecoins unavailable.</p>'; return; }
  const rows = S.stables.filter(a => a.pegType === 'peggedUSD' && a.circulating && a.circulating.peggedUSD > 1e8).map(a => ({name: a.name, sym: a.symbol, mech: a.pegMechanism, now: a.circulating.peggedUSD, w: a.circulatingPrevWeek ? a.circulatingPrevWeek.peggedUSD : null, m: a.circulatingPrevMonth ? a.circulatingPrevMonth.peggedUSD : null, price: a.price, chains: (a.chains || []).slice(0, 3).join(', ')})).sort((a, b) => b.now - a.now);
  const total = rows.reduce((s, r) => s + r.now, 0);
  el.innerHTML = `<h4>USD stablecoins · ${big(total)} in circulation</h4><table class="tb"><tr><th>coin</th><th class="n">supply</th><th class="n">7d</th><th class="n">30d</th><th class="n">peg</th></tr>${rows.slice(0, 25).map(r => `<tr><td>${esc(r.sym)}<br><small class="muted">${esc(r.mech || '')} · ${esc(r.chains)}</small></td><td class="n">${big(r.now)}</td><td class="n ${cls(r.w ? r.now - r.w : 0)}">${r.w ? pct((r.now / r.w - 1) * 100) : '—'}</td><td class="n ${cls(r.m ? r.now - r.m : 0)}">${r.m ? pct((r.now / r.m - 1) * 100) : '—'}</td><td class="n ${r.price && Math.abs(r.price - 1) > .005 ? 'down' : ''}">${r.price ? r.price.toFixed(4) : '—'}</td></tr>`).join('')}</table><p>Supply changes are the quiet signal of money entering or leaving the system; a peg more than half a cent off is flagged.</p>`;
}
function holdings() { try { return JSON.parse(localStorage.getItem('fv-holdings') || '[]'); } catch (e) { return []; } }
function saveHoldings(h) { try { localStorage.setItem('fv-holdings', JSON.stringify(h)); } catch (e) {} }
const CG_IDS = {btc: 'bitcoin', eth: 'ethereum', sol: 'solana', usdc: 'usd-coin', usdt: 'tether', dai: 'dai', usds: 'usds', wbtc: 'wrapped-bitcoin', steth: 'staked-ether', link: 'chainlink', arb: 'arbitrum', op: 'optimism', matic: 'matic-network', pol: 'polygon-ecosystem-token', avax: 'avalanche-2', bnb: 'binancecoin', ada: 'cardano', dot: 'polkadot', atom: 'cosmos', xrp: 'ripple', doge: 'dogecoin', ltc: 'litecoin', uni: 'uniswap', aave: 'aave', mkr: 'maker', cake: 'pancakeswap-token', gold: 'pax-gold', paxg: 'pax-gold', xaut: 'tether-gold'};
async function tabHoldings() {
  const el = $('#tab-holdings'); if (!el) return; const H = holdings();
  const ids = [...new Set(H.map(h => CG_IDS[h.asset.toLowerCase()] || h.asset.toLowerCase()))];
  if (ids.length) { try { const r = await get(CG + '/coins/markets?vs_currency=usd&ids=' + ids.join(',') + '&sparkline=false'); r.forEach(x => S.prices[x.id] = x); } catch (e) {} }
  const rows = H.map(h => { const id = CG_IDS[h.asset.toLowerCase()] || h.asset.toLowerCase(); const p = S.prices[id]; const price = h.asset.toLowerCase() === 'usd' ? 1 : p ? p.current_price : null; return {...h, id, price, value: price != null ? price * h.qty : null, chg: p ? p.price_change_percentage_24h : null}; });
  const total = rows.reduce((s, r) => s + (r.value || 0), 0);
  el.innerHTML = `<h4>Treasury holdings · ${usd(total)}</h4><p>A ledger kept in this browser only: asset and quantity, priced live by CoinGecko. Nothing leaves the page. Wallet-address reading comes with the treasury adapters.</p>
    ${rows.length ? `<table class="tb"><tr><th>asset</th><th class="n">qty</th><th class="n">price</th><th class="n">value</th><th class="n">24h</th><th></th></tr>${rows.map((r, i) => `<tr><td>${esc(r.asset.toUpperCase())}${r.note ? `<br><small class="muted">${esc(r.note)}</small>` : ''}</td><td class="n">${r.qty.toLocaleString('en-US', {maximumFractionDigits: 6})}</td><td class="n">${r.price != null ? usd(r.price, r.price < 10 ? 4 : 2) : '—'}</td><td class="n">${r.value != null ? usd(r.value) : '—'}</td><td class="n ${cls(r.chg)}">${pct(r.chg)}</td><td><button class="ghost" data-del="${i}" type="button" aria-label="remove">×</button></td></tr>`).join('')}</table>` : '<p>No holdings yet.</p>'}
    <h4>Add a holding</h4><div class="form"><label>asset<input id="h-a" placeholder="btc, eth, usdc, paxg…"></label><label>quantity<input id="h-q" placeholder="1.25"></label><label class="w">note<input id="h-n" placeholder="cold wallet · Gnosis safe · exchange"></label><label class="w"><button class="btn brass" id="h-add" type="button">add</button></label></div>
    <div class="alist" style="margin-top:.6rem"><div class="a"><small>allocation</small>${rows.filter(r => r.value).sort((a, b) => b.value - a.value).map(r => `${esc(r.asset.toUpperCase())} ${(r.value / total * 100).toFixed(1)}%`).join(' · ') || '—'}</div></div>`;
  $('#h-add').addEventListener('click', () => { const a = $('#h-a').value.trim(), q = parseFloat($('#h-q').value); if (!a || !(q > 0)) return; const h = holdings(); h.push({asset: a, qty: q, note: $('#h-n').value.trim()}); saveHoldings(h); tabHoldings(); });
  $$('[data-del]', el).forEach(b => b.addEventListener('click', () => { const h = holdings(); h.splice(+b.dataset.del, 1); saveHoldings(h); tabHoldings(); }));
}
async function tabDesk() {
  const el = $('#tab-tdesk'); if (!el) return; const c = S.chains ? S.chains.find(x => x.name === S.chain) : null;
  let lane = '<p>live snapshot unavailable</p>'; try { const d = await get('https://drasticstatic.github.io/trading-bot-arbitrage-public/edge/latest.json'); const e = d.edge || {}, pr = e.progress || {}, best = e.best || {}; lane = `<dl class="kv"><dt>study</dt><dd>${(pr.elapsedHours || 0).toFixed(1)} h of ${pr.targetDays || 7} d</dd><dt>simulated · cleared costs</dt><dd>${e.simulated ?? 0} · ${e.cleared ?? 0}</dd><dt>would have fired</dt><dd>${e.wouldFire ?? 0}</dd>${best.pair ? `<dt>best edge</dt><dd>${esc(best.pair)} · net ${best.netSpreadPct != null ? best.netSpreadPct.toFixed(3) + '%' : '—'}${best.clears ? ' · clears costs' : ' · below costs'}</dd>` : ''}</dl>`; } catch (e) {}
  el.innerHTML = `<h4>Treasury desk</h4><p>The same workstation, pointed at a treasury: where value sits across chains, what a stablecoin reserve can earn, how the supply of dollars on-chain is moving, and what the treasury itself holds. Built for the DAO and non-profit treasuries this terminal will serve: a yield-bearing reserve read in public, with every number traceable to its source.</p>
    <dl class="kv"><dt>chain in view</dt><dd>${esc(S.chain)}</dd><dt>value locked</dt><dd>${big(c ? c.tvl : null)}</dd><dt>chains tracked</dt><dd>${S.chains ? S.chains.length : '—'}</dd></dl>
    <h4>Sources</h4><p>DeFiLlama (chains, TVL history, yields, stablecoins), CoinGecko (prices). No keys, no accounts. Next adapters: wallet and Safe balances by public address, Fed and Treasury rates, CFTC positioning, and the DEX-arb lane's results feed.</p>
    <h4>DEX-arb lane · results only</h4>${lane}<p>The arbitrage bot's public snapshot: results, never the method.</p>
    <h4>Commands</h4><p><code>treasury</code> opens this mode · <code>markets</code> returns to the trading workstation · click a chain in the rail · <code>svg</code> / <code>tradingview</code> still pick the chart engine.</p>`;
}

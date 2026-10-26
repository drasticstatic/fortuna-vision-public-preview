/* DEX arb — the Arbitrum lane's results inside Treasury mode, read from the lane's public snapshot.
 * Authored by Alfred (FortunaTradesARB) as a tandem adapter for FortunaVision; Fortuna owns the shell.
 * Source: https://drasticstatic.github.io/trading-bot-arbitrage-public/edge/latest.json (CORS open, nightly,
 * in costume: pairs and venues wear stage names on the public copy, the numbers are the real study).
 * Shape documented in that repo's scripts/edge-report.js (writePublicSnapshot) and AGENT-SYNC loop-backs. */
const SNAP = 'https://drasticstatic.github.io/trading-bot-arbitrage-public/edge/latest.json';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const pct = (v, d = 3) => v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(d) + '%';
const eth = (v, d = 5) => v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(d) + ' ETH';
const usd = (v) => v == null || !isFinite(v) ? '—' : (v < 0 ? '−' : '') + '$' + Math.abs(v).toLocaleString('en-US', {maximumFractionDigits: 0});
const when = (t) => t ? new Date(t).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}) : '—';
let cache = null, at = 0;

async function load() {
  if (cache && Date.now() - at < 5 * 60e3) return cache;
  const r = await fetch(SNAP, {cache: 'no-store'}); if (!r.ok) throw new Error('snapshot ' + r.status);
  cache = await r.json(); at = Date.now(); return cache;
}

/** A 1-hour sparkline of one series ([{t, n}] or [{t, s, e, n}]) as inline SVG; zero line dashed. */
function spark(points, key = 'n', w = 120, h = 24) {
  const ys = (points || []).map(p => Number(p[key])).filter(Number.isFinite); if (ys.length < 2) return '';
  const lo = Math.min(0, ...ys), hi = Math.max(0, ...ys), span = hi - lo || 1;
  const x = (i) => (i / (ys.length - 1)) * (w - 2) + 1, y = (v) => h - 2 - ((v - lo) / span) * (h - 4);
  const d = ys.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const last = ys[ys.length - 1];
  return `<svg width="${w}" height="${h}" style="vertical-align:middle"><line x1="1" x2="${w - 1}" y1="${y(0)}" y2="${y(0)}" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 3"/><path d="${d}" fill="none" stroke="${last >= 0 ? '#4ade80' : 'currentColor'}" stroke-width="1.5"/></svg>`;
}

export async function tabArb() {
  const el = $('#tab-arb'); if (!el) return; el.innerHTML = '<p>loading the DEX-arb lane…</p>';
  let d; try { d = await load(); } catch (e) { el.innerHTML = '<p>The lane\'s snapshot is unavailable right now.</p>'; return; }
  const e = d.edge || {}, pr = e.progress || {}, best = e.best || {}, tri = e.triangles || {}, ch = e.chases || {}, sum = ch.summary || {}, fr = d.frontier || {}, infra = d.infra || {}, ours = (infra.endpoints || []).find(x => x.label === 'configured');
  const day = pr.elapsedHours != null ? Math.min(pr.targetDays || 7, Math.floor(pr.elapsedHours / 24) + 1) : null;
  const series = e.series || {}; const topPairs = Object.keys(series).slice(0, 6);
  const triRows = (tri.list || []).slice(0, 5);
  const alerts = (d.alerts || []).slice(0, 5);
  el.innerHTML = `
    <h4>Arbitrum DEX-arb lane · ${esc(d.mode || 'monitor-only')} · day ${day ?? '—'} of ${pr.targetDays ?? 7}</h4>
    <p>${d.costume?.on ? 'In costume: pairs and venues wear stage names on the public copy; counts, spreads, gas and outcomes are the real study. ' : ''}Snapshot ${when(d.generatedAt)}. Threshold ${d.threshold != null ? Number(d.threshold).toFixed(2) + '% after fees' : '—'}.</p>
    <dl class="kv"><dt>polls</dt><dd>${e.polls ?? '—'}</dd><dt>quoted</dt><dd>${e.simulated ?? '—'}</dd><dt>cleared gas</dt><dd>${e.cleared ?? 0}</dd><dt>would fire</dt><dd>${e.wouldFire ?? 0}</dd><dt>best route</dt><dd>${best.symbol ? `${esc(best.symbol)} ${esc(best.buyDex)} → ${esc(best.sellDex)} ${pct(best.netSpreadPct ?? best.spreadPct)}` : '—'}</dd><dt>best net</dt><dd>${best.best ? `${eth(best.best.netEth)} at ${esc(best.best.sizeEth)} ETH (${usd(best.best.netUsd)})` : '—'}</dd><dt>verdict</dt><dd>${esc(d.verdict?.text || d.verdict || '—')}</dd></dl>
    ${topPairs.length ? `<h4>After-fee spread, last hour</h4><table class="tb">${topPairs.map(p => `<tr><td>${esc(p)}</td><td class="n">${spark(series[p])}</td><td class="n">${pct(series[p][series[p].length - 1]?.n)}</td></tr>`).join('')}</table>` : ''}
    ${triRows.length ? `<h4>Triangles · three-pair cycles after fees</h4><table class="tb"><tr><th>cycle</th><th class="n">after fees</th><th class="n">last hour</th></tr>${triRows.map(r => `<tr><td>${esc(r.cycle)}<br><small class="muted">${(r.legs || []).map(l => esc(l.venue)).join(' · ')}</small></td><td class="n ${r.netPct > 0 ? 'up' : ''}">${pct(r.netPct)}</td><td class="n">${spark(tri.series?.[r.tri])}</td></tr>`).join('')}</table>` : ''}
    ${sum.count ? `<h4>Dislocation lifetimes · ${sum.count} chases</h4><p>median ${sum.medianLifetimeBlocks} blocks (${(sum.medianLifetimeMs / 1000).toFixed(1)} s); ${sum.reachableByPoller} of ${sum.count} outlived one poll plus a transaction; ${sum.closedBySwap} closed by a swap, ${sum.closedByDrift} by drift. Floor ${Number(sum.floorPct).toFixed(2)}% after fees.</p>` : ''}
    ${ours ? `<p><small class="muted">the wire: ${Math.round(ours.rttMs)} ms round trip, ${Math.round(ours.callMs)} ms per read, ${ours.headLagBlocks === 0 ? 'at the head' : ours.headLagBlocks + ' blocks behind'}; one ${Math.round((infra.pollMs || 15000) / 1000)} s poll ≈ ${infra.blocksPerPoll ?? '—'} blocks</small></p>` : ''}
    ${fr.ton || fr.rates ? `<h4>The frontier · four scouts, public sources</h4><dl class="kv">${['intents', 'rates', 'ton', 'rwa'].filter(k => fr[k]?.verdict).map(k => `<dt>${k === 'rwa' ? 'treasuries' : k}</dt><dd>${esc(String(fr[k].verdict).split(/(?<=\\.)\\s/)[0])}</dd>`).join('')}</dl>` : ''}
    ${alerts.length ? `<h4>Latest alerts</h4><table class="tb">${alerts.map(a => `<tr><td>${esc(a.title || '')}<br><small class="muted">${esc(a.text || a.message || '')}</small></td><td class="n"><small>${when(a.ts)}</small></td></tr>`).join('')}</table>` : ''}
    <p><small class="muted">Source: the lane's nightly public snapshot (GitHub Pages). Monitor only; nothing on this tab can send a transaction. Adapter by Alfred.</small></p>`;
}

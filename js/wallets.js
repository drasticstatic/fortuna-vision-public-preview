/* Wallets by public address — read-only adapters, no keys, every call to a public endpoint.
 * EVM (7 chains, native + a short list of blue-chip tokens via eth_call balanceOf), Solana (SOL + SPL accounts), Bitcoin (Blockstream).
 * Addresses are kept in this browser only (localStorage 'fv-wallets'); nothing is published. The kind is detected from the address shape. */
const EVM = [
  {id: 'ethereum', name: 'Ethereum', rpc: 'https://ethereum-rpc.publicnode.com', native: {sym: 'ETH', cg: 'ethereum'}, tokens: [
    ['USDC', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'usd-coin'], ['USDT', '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'tether'], ['DAI', '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'dai'],
    ['WETH', '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'ethereum'], ['WBTC', '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, 'wrapped-bitcoin'], ['stETH', '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', 18, 'staked-ether'],
    ['PAXG', '0x45804880De22913dAFE09f4980848ECE6EcbAf78', 18, 'pax-gold'], ['LINK', '0x514910771AF9Ca656af840dff83E8264EcF986CA', 18, 'chainlink'], ['UNI', '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'uniswap'], ['AAVE', '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, 'aave']]},
  {id: 'arbitrum', name: 'Arbitrum', rpc: 'https://arb1.arbitrum.io/rpc', native: {sym: 'ETH', cg: 'ethereum'}, tokens: [
    ['USDC', '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 6, 'usd-coin'], ['USDC.e', '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', 6, 'usd-coin'], ['USDT', '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 6, 'tether'], ['DAI', '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, 'dai'],
    ['WETH', '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 18, 'ethereum'], ['WBTC', '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 8, 'wrapped-bitcoin'], ['ARB', '0x912CE59144191C1204E64559FE8253a0e49E6548', 18, 'arbitrum']]},
  {id: 'base', name: 'Base', rpc: 'https://mainnet.base.org', native: {sym: 'ETH', cg: 'ethereum'}, tokens: [
    ['USDC', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, 'usd-coin'], ['WETH', '0x4200000000000000000000000000000000000006', 18, 'ethereum'], ['cbBTC', '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', 8, 'coinbase-wrapped-btc'], ['DAI', '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 18, 'dai']]},
  {id: 'optimism', name: 'Optimism', rpc: 'https://mainnet.optimism.io', native: {sym: 'ETH', cg: 'ethereum'}, tokens: [
    ['USDC', '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 6, 'usd-coin'], ['USDT', '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 6, 'tether'], ['DAI', '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 18, 'dai'], ['WETH', '0x4200000000000000000000000000000000000006', 18, 'ethereum'], ['OP', '0x4200000000000000000000000000000000000042', 18, 'optimism']]},
  {id: 'polygon', name: 'Polygon', rpc: 'https://polygon-bor-rpc.publicnode.com', native: {sym: 'POL', cg: 'polygon-ecosystem-token'}, tokens: [
    ['USDC', '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 6, 'usd-coin'], ['USDC.e', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', 6, 'usd-coin'], ['USDT', '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 6, 'tether'], ['DAI', '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 18, 'dai'], ['WETH', '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 18, 'ethereum']]},
  {id: 'avalanche', name: 'Avalanche', rpc: 'https://api.avax.network/ext/bc/C/rpc', native: {sym: 'AVAX', cg: 'avalanche-2'}, tokens: [
    ['USDC', '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', 6, 'usd-coin'], ['USDT', '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', 6, 'tether'], ['WETH.e', '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', 18, 'ethereum']]},
  {id: 'bnb', name: 'BNB Chain', rpc: 'https://bsc-dataseed.binance.org', native: {sym: 'BNB', cg: 'binancecoin'}, tokens: [
    ['USDC', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 18, 'usd-coin'], ['USDT', '0x55d398326f99059fF775485246999027B3197955', 18, 'tether'], ['ETH', '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 18, 'ethereum'], ['BTCB', '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', 18, 'bitcoin']]},
];
const SOL_RPC = 'https://solana-rpc.publicnode.com', SOL_TOKENS = {EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: ['USDC', 'usd-coin'], Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: ['USDT', 'tether'], mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: ['mSOL', 'msol'], J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: ['JitoSOL', 'jito-staked-sol']};
const BTC_API = 'https://blockstream.info/api';

export function kindOf(a) { a = (a || '').trim(); if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'evm'; if (/^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a)) return 'btc'; if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return 'sol'; return null; }
export const short = (a) => a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a;
export function list() { try { return JSON.parse(localStorage.getItem('fv-wallets') || '[]'); } catch (e) { return []; } }
export function save(w) { try { localStorage.setItem('fv-wallets', JSON.stringify(w)); } catch (e) {} }

const post = async (url, body) => { const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); };
const hexToNum = (hex, dec) => { if (!hex || hex === '0x') return 0; const n = BigInt(hex); const d = 10n ** BigInt(dec); return Number(n / d) + Number(n % d) / Number(d); };
const balanceOfData = (addr) => '0x70a08231' + addr.slice(2).toLowerCase().padStart(64, '0');

async function evmChain(ch, addr) {
  const calls = [{jsonrpc: '2.0', id: 0, method: 'eth_getBalance', params: [addr, 'latest']}].concat(ch.tokens.map((t, i) => ({jsonrpc: '2.0', id: i + 1, method: 'eth_call', params: [{to: t[1], data: balanceOfData(addr)}, 'latest']})));
  let res; try { res = await post(ch.rpc, calls); if (!Array.isArray(res)) throw new Error('no batch'); } catch (e) { res = await Promise.all(calls.map(c => post(ch.rpc, c).catch(() => ({id: c.id, result: '0x0'})))); }
  const by = {}; res.forEach(r => by[r.id] = r.result); if (res.some(r => r.error) && !res.some(r => r.result)) throw new Error(ch.name + ' rpc error');
  const out = []; const nat = hexToNum(by[0], 18); if (nat > 0) out.push({chain: ch.name, sym: ch.native.sym, cg: ch.native.cg, qty: nat});
  ch.tokens.forEach((t, i) => { const q = hexToNum(by[i + 1], t[2]); if (q > 0) out.push({chain: ch.name, sym: t[0], cg: t[3], qty: q}); });
  return out;
}
const SOL_RPCS = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];
async function sol(addr) {
  const first = async (body) => { let err; for (const rpc of SOL_RPCS) { try { const j = await post(rpc, body); if (j.error) throw new Error(j.error.message); return j; } catch (e) { err = e; } } throw err; };
  const b = await first({jsonrpc: '2.0', id: 1, method: 'getBalance', params: [addr]});
  const out = []; const lam = b.result ? b.result.value : 0; if (lam > 0) out.push({chain: 'Solana', sym: 'SOL', cg: 'solana', qty: lam / 1e9});
  try { const ta = await first({jsonrpc: '2.0', id: 2, method: 'getTokenAccountsByOwner', params: [addr, {programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'}, {encoding: 'jsonParsed'}]});
    ((ta.result || {}).value || []).forEach(a => { const info = a.account.data.parsed.info; const q = info.tokenAmount.uiAmount; if (!(q > 0)) return; const known = SOL_TOKENS[info.mint]; out.push({chain: 'Solana', sym: known ? known[0] : short(info.mint), cg: known ? known[1] : null, qty: q}); });
  } catch (e) { out.partial = 'Solana token accounts (public nodes block that call; SOL itself is read)'; }
  return out;
}
async function btc(addr) {
  const r = await fetch(BTC_API + '/address/' + addr); if (!r.ok) throw new Error('blockstream ' + r.status); const j = await r.json();
  const sats = (j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum) + (j.mempool_stats.funded_txo_sum - j.mempool_stats.spent_txo_sum);
  return sats > 0 ? [{chain: 'Bitcoin', sym: 'BTC', cg: 'bitcoin', qty: sats / 1e8}] : [];
}

/* Read one wallet: returns {rows: [{chain, sym, cg, qty}], errors: [chain names that failed]} */
export async function read(w) {
  const errors = []; let rows = [];
  if (w.kind === 'evm') { const r = await Promise.all(EVM.map(ch => evmChain(ch, w.addr).catch(() => { errors.push(ch.name); return []; }))); rows = r.flat(); }
  else if (w.kind === 'sol') { try { rows = await sol(w.addr); if (rows.partial) errors.push(rows.partial); } catch (e) { errors.push('Solana'); } }
  else if (w.kind === 'btc') { try { rows = await btc(w.addr); } catch (e) { errors.push('Bitcoin'); } }
  return {rows: rows.map(r => ({...r, wallet: w.label || short(w.addr)})), errors};
}
export const CHAINS = EVM.map(c => c.name).concat(['Solana', 'Bitcoin']);

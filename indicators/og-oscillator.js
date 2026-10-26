/* OG-style oscillator — money flow (MFI 14) as a four-colour area, RSI 14 as a line, 20 / 50 / 80 bands, with reversal events
 * when price closes outside the Bollinger bands while money flow turns from an extreme. A generic stand-in built from public
 * measures (nothing proprietary); the regime engine computes the same numbers for the scanner.
 * Written to the FortunaVision indicator contract (see CONTRACT.md): one file, inputs, outputs, calc(bars, p, ta). */
export default {
  name: 'OG-style oscillator',
  overlay: false,
  height: 120,
  inputs: [
    {key: 'mfiLen', type: 'int', default: 14, min: 2, max: 100, label: 'Money flow length'},
    {key: 'rsiLen', type: 'int', default: 14, min: 2, max: 100, label: 'RSI length'},
    {key: 'bbLen', type: 'int', default: 20, min: 5, max: 200, label: 'Bollinger length'},
    {key: 'bbK', type: 'float', default: 2, min: .5, max: 4, label: 'Bollinger width'},
  ],
  outputs: [
    {key: 'mfi', kind: 'histogram', label: 'Money flow', color: '#2dd4bf', zero: 50, colorFn: (v, i, a) => v >= 50 ? (a[i] >= (a[i - 1] ?? v) ? 'rgba(45,212,191,.75)' : 'rgba(153,246,228,.55)') : (a[i] <= (a[i - 1] ?? v) ? 'rgba(255,92,122,.75)' : 'rgba(254,202,202,.5)')},
    {key: 'rsi', kind: 'line', label: 'RSI', color: '#9b8cff', lineWidth: 1},
    {key: 'long', kind: 'histogram', label: 'Reversal up', color: '#3ddc97', zero: 0, colorFn: () => 'rgba(61,220,151,.7)'},
    {key: 'short', kind: 'histogram', label: 'Reversal down', color: '#ff5c7a', zero: 0, colorFn: () => 'rgba(255,92,122,.7)'},
  ],
  levels: [20, 50, 80],
  calc(bars, p, ta) {
    const R = window.Regime;
    const o = R ? R.og(bars, {mfiLen: p.mfiLen, rsiLen: p.rsiLen, bbLen: p.bbLen, bbK: p.bbK}) : null;
    if (!o) return {mfi: [], rsi: [], long: [], short: []};
    const long = bars.map(() => NaN), short = bars.map(() => NaN); o.events.forEach(e => { (e.side === 'long' ? long : short)[e.i] = 100; });
    return {mfi: o.series.mfi, rsi: o.series.rsi, long, short};  // money flow draws from 50 (its base); the event bars span the pane
  },
};

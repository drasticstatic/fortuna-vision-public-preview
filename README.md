# FortunaVision

A chart-first market workstation that runs anywhere a static file can be served. One market at a time, deeply: TradingView's open-source chart engine in the middle, the markets on the left, the instruments on the right, a function-code command line underneath.

**It is the application half of the [Fortuna Terminal](https://drasticstatic.github.io/trading-assistant-public-preview/data/progression/terminal/).** The terminal stays the journal and live-operations page of the trading-assistant repo; FortunaVision reads the terminal's published data and adds a real charting workspace, drawings, indicator files, order flow and dealer gamma on the chart, and a command line. The same shell is the foundation for a treasury terminal, where the data adapters change and the workspace does not.

## Run it

```sh
python3 -m http.server 8788      # then open http://localhost:8788/
```

No build step, no dependencies to install, no keys. Every number comes from a public source:

| Source | What | Where it is used |
|---|---|---|
| Fortuna Terminal data (GitHub Pages, CORS open) | levels, watchlist, positions, check-ins, scanner read, gamma snapshot | rail, Desk, Levels, Regime, Gamma, chart overlays |
| Hyperliquid public API | candles (5m–1d), mids, order book, live trades websocket | chart, Flow, large prints |
| DeFiLlama (api / yields / stablecoins) | chains and TVL history, pools and APY, stablecoin supply | Treasury mode |
| CoinGecko | prices for the holdings ledger | Treasury mode |

Point it at another publisher with `?data=https://…/data/` (remembered in the browser). Deep links: `?m=Gold&tf=15m`.

## What is on the chart

- Candles or area, volume with a visible-range profile (point of control in brass), EMA 20 / 50 / 200.
- **Auto Levels**: KEY (brass), 5/5 and 3/5 (cyan), ghosts (violet), each drawn from the hour it was born. The engine is `engines/autolevels.js`, a port of Christopher's TradingView indicator; the scanner runs the same code in Python.
- Zones from the watchlist, positions with stop / target / liquidation, PDH / PDL, midnight and week opens.
- Toggles in the legend: session rails (FCR 9:30, 4/5 opens and closes), fair value gaps, pattern marks (P · R · B · SFP · BRK/RT · 1-2-3), the fib ladder of the last impulse, ATR bands, **gamma walls** (call wall, put wall, flip, the largest strikes; index strikes shifted by the futures basis), **large prints** (the biggest taker prints of the last 15 minutes as dots), the **OG-style oscillator** pane.
- Drawings: trend, ray, extended line, horizontal line and ray, vertical line, rectangle, channel, fib retracement, measure, long / short position, text. Stored as time + price per market in the browser, so they survive a timeframe change.

## Two chart engines

TradingView's Lightweight Charts is the default. Fortuna's own SVG renderer, the one its background analysis draws with, is the second engine: it renders the same scene (candles, EMAs, Auto Levels, zones, rails, FVGs, fibs, gamma walls, prints, Bollinger, the volume profile, indicator panes) with scroll-to-zoom, drag-to-pan, axis scaling and double-click-to-fit. Switch in the header or type `svg` / `tradingview`. Drawings live on the TradingView engine.

## Treasury mode

`treasury` (or the Treasury switch in the header) turns the same workstation toward a DAO or non-profit treasury: chains by value locked in the rail, a chain's TVL history on the chart, stablecoin yields (DeFiLlama pools, loaded on demand), stablecoin supply and peg health, and a holdings ledger kept in the browser and priced live by CoinGecko. `markets` comes back. This is the seed of the treasury terminal for the organisations whose treasuries Christopher manages; wallet and Safe balances by public address, Fed and Treasury rates and the DEX-arb lane's results are the next adapters.

## Indicators are files

An indicator is one JavaScript module in `indicators/` with `inputs`, `outputs` and `calc(bars, p, ta)`: the contract in [`indicators/CONTRACT.md`](indicators/CONTRACT.md), adopted from Lewis Jackson's quant-terminal so one file runs in either workstation. `indicators/og-oscillator.js` is the first: money flow as a four-colour area, RSI, 20 / 50 / 80 bands, reversal events, built from generic measures. Auto Levels and the regime measures ship as plain engines under `engines/` (`autolevels.js`, `regime.js`, `calc.js`) and are the same files the Fortuna Terminal and its Python scanner use.

## The command line

Type a market, a timeframe, a verb, in any order: `gold 15m`, `btc gamma`, `es levels`, `draw fib`, `clear`, `theme`, `help`. `/` focuses it from anywhere; `1`–`5` switch timeframes; `f` fits; `l` toggles line and candles; `v` toggles volume; `Delete` removes the selected drawing; `?` opens the help card.

## The proprietary boundary

The coaching strategies Fortuna trades (ZTH, Inevitrade, STB) are their authors'. FortunaVision computes generic measures (levels, regime, alignment, fibs, money flow, gamma, flow) and shows whether a read is *eligible* per the private scanner, never the card rules, ladder defaults or gates. Christopher's own Auto Levels indicator is his to share, and it is.

## Credits

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) v5.2.1, Apache-2.0, vendored with its licence.
- Lewis Jackson's [quant-terminal](https://github.com/Lewis-Jackson-Investing) (part-timequant.com), MIT: `js/drawings.js`, `js/volume-profile.js` and the custom-indicator contract are carried from it with the licence.
- Everything else: MIT, © 2026 Christopher Wilson (drasticstatic). Built by Fortuna (Claude Code CLI, Anthropic Fable 5.1) with Christopher.

## Roadmap

Phase 1 (this): the workstation shell, two chart engines, overlays, drawings, the indicator contract, Flow, Gamma, Calc, Desk, Treasury mode, the command line. Next: the TCL ladder on the chart, bar replay and alerts on drawings (references in quant-terminal), the treasury adapters (Fed, Treasury, FRED, CFTC COT; the amber-terminal field map), a Cloudflare Worker for sources without CORS, GitHub Pages deployment, and the terminal's migration here after the October competition closes.

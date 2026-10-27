# 👁️ FortunaVision — a chart-first market & treasury workstation

> One market at a time, deeply: TradingView's open-source chart engine beside Fortuna's own SVG engine, the markets on the left, the instruments on the right, a function-code command line underneath. Static, runs anywhere, no keys.

[![License: MIT](https://img.shields.io/badge/license-MIT-lightgrey?style=flat)](LICENSE)
[![Live](https://img.shields.io/badge/%F0%9F%91%81%EF%B8%8F%20Live-drasticstatic.github.io%2Ffortuna--vision--public--preview-brightgreen)](https://drasticstatic.github.io/fortuna-vision-public-preview/)
[![Public Preview](https://img.shields.io/badge/%F0%9F%8C%90%20Public%20Preview-synced%20from%20the%20private%20lane-blue)](https://github.com/drasticstatic/fortuna-vision-public-preview)
[![Lightweight Charts](https://img.shields.io/badge/TradingView-Lightweight%20Charts%20v5.2.1-black?logo=tradingview)](https://github.com/tradingview/lightweight-charts)
[![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code%20%C2%B7%20Fable%205.1-6366f1)](https://claude.com/claude-code)
[![Data: public sources only](https://img.shields.io/badge/data-public%20sources%20only%20%C2%B7%20no%20keys-d9a441)](#-every-number-has-a-source)

> [👁️ **Open FortunaVision**](https://drasticstatic.github.io/fortuna-vision-public-preview/) &nbsp;·&nbsp; [⚡ Fortuna Terminal](https://drasticstatic.github.io/trading-assistant-public-preview/data/progression/terminal/) (the live-operations page that feeds it) &nbsp;·&nbsp; [📈 Trading Assistant](https://github.com/drasticstatic/trading-assistant-public-preview) &nbsp;·&nbsp; [🧭 Where things live](#%EF%B8%8F-where-things-live)

> 🔒 **Note for visitors:** this repository is the **public preview** of a private lane (`drasticstatic/fortuna-vision`), synced on every push. The private lane holds the agent-sync files, specs and scripts, and the design of a treasury-management framework for agentic DAOs. Everything you see here runs as-is: open `index.html` from any static host.

> 🧠 **The proprietary boundary:** the coaching strategies Fortuna trades (ZTH, Inevitrade, STB) belong to their authors. FortunaVision computes generic measures (levels, regime, alignment, fibs, money flow, gamma, flow) and shows whether a read is *eligible* per a private scanner, never the card rules, ladder defaults or gates. Christopher's own **Auto Levels** indicator is his to share, and it is, as `engines/autolevels.js`.

---

👋 Hi, I'm **Fortuna**, an AI assistant built by Anthropic, set up as Christopher's wealth warden. The [Fortuna Terminal](https://drasticstatic.github.io/trading-assistant-public-preview/data/progression/terminal/) is my live-operations page: every check-in, trade and scan is published there as data. **FortunaVision is the application half**: a real charting workspace on top of that data, with drawings, indicator files, order flow, dealer gamma, alerts, a ladder planner, and a Treasury mode. The same shell is the foundation for a treasury terminal for the organisations whose treasuries Christopher stewards, where the data adapters change and the workspace does not.

— *Fortuna (via Claude Code CLI)* 🙏🏼

## 🚀 Run it

```sh
python3 -m http.server 8788      # then open http://localhost:8788/
```

No build step, no dependencies to install, no keys. Deep links: `?m=Gold&tf=15m`. Point it at another publisher of the same data shape with `?data=https://…/data/` (remembered in the browser).

## 🧭 The workstation

| Region | What it does |
|---|---|
| 🧱 **Rail** (left) | every market Fortuna watches, live mid, 24h change, 1h / 4h bias, and its watchlist status (armed · watch · paused) |
| 📈 **Chart** (centre) | the hero: candles or area, volume with a visible-range profile (point of control in brass), EMA 20 / 50 / 200, and every overlay below; a drawing toolbar on its left edge |
| 🎛️ **Inspector** (right) | **Levels** · **Regime** · **Flow** · **Gamma** · **Calc** · **Desk** |
| ⌨️ **Command line** (bottom) | `gold 15m` · `btc gamma` · `es levels` · `draw fib` · `alert above 4020` · `treasury` · `help` |

### 📐 Two chart engines

TradingView's **Lightweight Charts** is the default. Fortuna's own **SVG renderer**, the one its background analysis draws with, is the second engine: it renders the same scene (candles, EMAs, Auto Levels, zones, rails, FVGs, fibs, gamma walls, prints, Bollinger, the volume profile, indicator panes) with scroll-to-zoom, drag-to-pan, axis scaling and double-click-to-fit. Switch in the header or type `svg` / `tradingview`. Drawings live on the TradingView engine.

### 🧩 What is on the chart

- **Auto Levels**: KEY (brass), 5/5 and 3/5 (cyan), ghosts (violet), each drawn from the hour it was born. The engine is `engines/autolevels.js`, a port of Christopher's TradingView indicator; the scanner runs the same code in Python.
- Zones from the watchlist, positions with stop / target / liquidation, PDH / PDL, midnight and week opens.
- Legend toggles: session rails (FCR 9:30, 4/5 opens and closes), fair value gaps, pattern marks (P · R · B · SFP · BRK/RT · 1-2-3), the fib ladder of the last impulse, ATR bands, Bollinger, **gamma walls** (call wall, put wall, flip, the largest strikes; index strikes shifted by the futures basis), **large prints** (the biggest taker prints of the last 15 minutes as dots), the **OG-style oscillator** pane.
- **Drawings**: trend, ray, extended line, horizontal line and ray, vertical line, rectangle, channel, fib retracement, measure, long / short position, text. Stored as time + price per market in the browser, so they survive a timeframe change.
- **Plans and alerts**: the Calc tab sizes a position from the stop and builds a **ladder** (entry plus up to five limits, generic DCA math: the entry is sized so the whole ladder loses exactly the risk if every leg fills and the stop hits) and draws the planned orders on the chart. `alert 4020` / `alert above 4020` sets a price alert, checked every 30 seconds against live mids, drawn on the chart, fired once as a desktop notification or a flash on the command line.

### 🧪 Indicators are files

An indicator is one JavaScript module in `indicators/` with `inputs`, `outputs` and `calc(bars, p, ta)`: the contract in [`indicators/CONTRACT.md`](indicators/CONTRACT.md), adopted from Lewis Jackson's quant-terminal so one file runs in either workstation. [`indicators/og-oscillator.js`](indicators/og-oscillator.js) is the first: money flow as a four-colour area, RSI, 20 / 50 / 80 bands, reversal events, built from generic measures. Auto Levels, the regime measures and the calculators ship as plain engines under `engines/` and are the same files the Fortuna Terminal and its Python scanner use.

## 🏛️ Treasury mode

`treasury` (or the **Markets | Treasury** switch in the header) turns the same workstation toward a DAO or non-profit treasury:

| Tab | What it shows | Source |
|---|---|---|
| 🌍 **Markets** | total crypto market cap, 24h change, volume, TOTAL2 ex-BTC, dominance, the top 50 by cap with 24h / 7d / 30d | CoinGecko |
| ⛓️ **Rail + chart** | chains by value locked; a chain's TVL history with EMA 30 / 90 | DeFiLlama |
| 🌾 **Yields** | stablecoin pools by APY on the chain in view and across chains (loaded on demand) | DeFiLlama |
| 💵 **Stables** | USD stablecoin supply, 7d / 30d change, peg health | DeFiLlama |
| 🧺 **Holdings** | wallets by **public address** (an EVM address read on seven chains for native and blue-chip tokens, Solana, Bitcoin), plus a ledger for what is off chain; allocation by asset and by chain, priced live | public RPCs, Blockstream, CoinGecko |
| 🔁 **DEX arb** | the Arbitrum arbitrage lane, results only, never the method | the lane's public snapshot |
| 🗒️ **Desk** | what this mode is for, sources, commands | — |

This is the seed of the treasury terminal for the organisations whose treasuries Christopher manages: every useful chain brought into one read, market and macro data beside the holdings, so a reserve can be balanced to bless others while capitalising on what the market offers. Wallet balances by public address are in; Safe owners and queues, Fed and Treasury rates and CFTC positioning are the next adapters (the last three through a small proxy, since those sources block browsers). Addresses you paste stay in your browser.

## 📡 Every number has a source

| Source | What | Where it is used |
|---|---|---|
| Fortuna Terminal data (GitHub Pages, CORS open) | levels, watchlist, positions, check-ins, scanner read, gamma snapshot | rail, Desk, Levels, Regime, Gamma, chart overlays |
| Hyperliquid public API | candles (5m–1d), mids, order book, live trades websocket | chart, Flow, large prints, alerts |
| DeFiLlama (api / yields / stablecoins) | chains and TVL history, pools and APY, stablecoin supply | Treasury mode |
| CoinGecko | global market cap, top assets, prices for holdings | Treasury mode |
| Public JSON-RPC nodes (publicnode, the chains' own endpoints) and Blockstream | balances by public address: Ethereum, Arbitrum, Base, Optimism, Polygon, Avalanche, BNB Chain, Solana, Bitcoin | Holdings tab |
| The DEX-arb lane's public snapshot | study progress, simulated and cleared edges | DEX arb tab, Desk |

No keys, no accounts, nothing leaves the page except the requests above.

## 🗺️ Where things live

| Surface | Role |
|---|---|
| [👁️ FortunaVision](https://drasticstatic.github.io/fortuna-vision-public-preview/) | the workstation (this repo's preview) |
| [⚡ Fortuna Terminal](https://drasticstatic.github.io/trading-assistant-public-preview/data/progression/terminal/) | Fortuna's live operations: check-ins, trades, scanner, alerts; the chart header links here |
| [🏛️ Gallery](https://drasticstatic.github.io/trading-assistant-public-preview/data/progression/gallery.html) · [💼 Portfolio](https://drasticstatic.github.io/trading-assistant-public-preview/portfolio.html) | prop-firm accounts · live personal venues |
| `drasticstatic/fortuna-vision` (private) | agent-sync, specs, scripts, the treasury-framework design |

## 🙏 Credits

- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) v5.2.1, Apache-2.0, vendored with its licence.
- Lewis Jackson's [quant-terminal](https://github.com/Lewis-Jackson-Investing) (part-timequant.com), MIT: `js/drawings.js`, `js/volume-profile.js` and the custom-indicator contract are carried from it with the licence. See [THIRD-PARTY.md](THIRD-PARTY.md).
- Everything else: MIT, © 2026 Christopher Wilson (drasticstatic). Built by Fortuna (Claude Code CLI, Anthropic Fable 5.1) with Christopher.

## 🧭 Roadmap

Phase 1 (shipped Oct 26, 2026): the workstation shell, two chart engines, overlays, drawings, the indicator contract, Flow, Gamma, Calc with the ladder planner, Desk, Treasury mode, price alerts, the command line. Oct 27: wallets by public address, a mobile pass. Next: Safe adapters, the macro adapters through a proxy, bar replay and alerts on drawings (references in quant-terminal), a mobile pass, and the Fortuna Terminal's migration here after the October competition closes.

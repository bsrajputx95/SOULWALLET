gudies 

# Jupiter

> Jupiter is DeFi infrastructure on Solana providing swap, lending, perpetuals, limit-order, DCA, and portfolio APIs.
> Two main swap APIs: **Ultra** (recommended — managed execution, gasless, RPC-less) and **Metis** (advanced — low-level routing primitives, bring your own RPC).
> Base URL: `https://api.jup.ag`. All endpoints require an `x-api-key` header — generate a free key at [portal.jup.ag](https://portal.jup.ag).

## Quick Reference

- Ultra Swap API (recommended): `GET /ultra/v1/order` + `POST /ultra/v1/execute`
- Metis Swap API (advanced): `GET /swap/v1/quote` + `POST /swap/v1/swap`
- Trigger (limit orders): `POST /trigger/v1/createOrder`
- Recurring (DCA): `POST /recurring/v1/createOrder`
- Lend: `POST /lend/v1/earn/deposit`
- Price: `GET /price/v3?ids={mints}`
- Tokens: `GET /tokens/v2/search?query={query}`
- Portfolio: `GET /portfolio/v1/positions?wallet={address}`

## Get Started

Setup guides for environment, tooling, and first API calls.

- [Get Started](https://dev.jup.ag/get-started/index.md): Jupiter developer documentation hub: explore the full product suite (Ultra Swap, Perps, Lend, Trigger, Recurring, Price, Tokens, Send, Studio, Lock) and find quick start paths for your integration.
- [Environment Setup](https://dev.jup.ag/get-started/environment-setup.md): Install Solana web3.js and spl-token libraries, configure an RPC connection, and set up a development wallet to build with the Jupiter API.
- [Development Basics](https://dev.jup.ag/get-started/development-basics.md): Solana fundamentals for Jupiter developers: accounts, programs, instructions, transactions, priority fees, compute units, slippage, and how Ultra Swap API simplifies it all.

## Portal

API key management, rate limits, tiers, and billing at portal.jup.ag.

- [Setting Up API Key](https://dev.jup.ag/portal/setup.md): Generate a free API key at portal.jup.ag. Pass it via x-api-key header. Free, Pro, and Ultra tiers available.
- [Migrate from Lite API](https://dev.jup.ag/portal/migrate-from-lite-api.md): Migrate from lite-api.jup.ag to api.jup.ag: update the base URL, generate a free API key at portal.jup.ag, and add the x-api-key header.
- [Payment Methods](https://dev.jup.ag/portal/payment.md): Payment options for Jupiter Portal Pro plans: USDC on Solana via Helio (manual monthly renewal) or credit card via CoinFlow (auto-renewing subscription).
- [Response Codes](https://dev.jup.ag/portal/responses.md): Common HTTP response codes from Jupiter APIs: 200 success, 400 bad request, 401 unauthorized, 429 rate limited, and 5xx server errors with debugging guidance.
- [Rate Limit](https://dev.jup.ag/portal/rate-limit.md): Jupiter API rate limiting: Fixed Rate Limits for Free and Pro tiers (60 req/min to 30K req/min), and Dynamic Rate Limits for Ultra that scale with executed swap volume.
- [Latency](https://dev.jup.ag/portal/latency.md): Jupiter API latency characteristics: distributed AWS gateway regions, factors affecting response times, and optimization tips for collocating servers.
- [FAQ](https://dev.jup.ag/portal/faq.md): Frequently asked questions about Jupiter Portal: tier differences, API key usage, payment, upgrades, and using Pro and Ultra together.

## Docs

Core product documentation covering each Jupiter API with usage guides and code examples.

### Ultra

- [Ultra Swap API Overview](https://dev.jup.ag/docs/ultra/index.md): Jupiter's flagship swap API: RPC-less, gasless, with automatic slippage optimization and sub-second transaction landing. Start here for most swap integrations.
- [Ultra Swap API Quick Start](https://dev.jup.ag/docs/ultra/get-started.md): Two-step swap flow: call GET /order to get a transaction, sign it, then POST /execute. Includes links to all Ultra endpoints and guides.
- [Gasless Support](https://dev.jup.ag/docs/ultra/gasless.md): Two gasless mechanisms: Ultra Gasless Support (covers all gas when taker has < 0.01 SOL, min ~$10 trade) and JupiterZ RFQ (market maker pays network fees). Also supports Integrator Gas Payer.
- [Fees](https://dev.jup.ag/docs/ultra/fees.md): Ultra Swap charges 5–10 bps per swap. Integrators can add custom fees (Jupiter takes 20% of integrator fees). Fee mint is determined by a priority list.
- [Manual Mode](https://dev.jup.ag/docs/ultra/manual-mode.md): Use manual mode to control Ultra API parameters like slippage or priority fee settings. Not recommended for default integrations — use only for user-facing trading UIs.
- [Get Order](https://dev.jup.ag/docs/ultra/get-order.md): GET /ultra/v1/order returns a base64-encoded unsigned swap transaction. Required params: inputMint, outputMint, amount, taker.
- [Execute Order](https://dev.jup.ag/docs/ultra/execute-order.md): POST /ultra/v1/execute accepts the signed transaction and requestId, broadcasts it, and returns the swap result.
- [Search Token](https://dev.jup.ag/docs/ultra/search-token.md): GET /ultra/v1/search?query={query} returns token metadata by symbol, name, or mint address. Supports comma-separated queries, up to 100 mints.
- [Get Holdings](https://dev.jup.ag/docs/ultra/get-holdings.md): GET /ultra/v1/holdings/{address} returns detailed token holdings including token account info, frozen status, and native SOL balance.
- [Get Shield](https://dev.jup.ag/docs/ultra/get-shield.md): GET /ultra/v1/shield?mints={mints} returns token security warnings (freeze authority, mint authority, low organic activity, etc.) for specified mint addresses.
- [Response](https://dev.jup.ag/docs/ultra/response.md): Ultra Swap API response schemas and error codes for /order (errorCode 1–3) and /execute (codes 0, -1 to -5, -1000s aggregator, -2000s RFQ, and program-level codes).
- [Rate Limit](https://dev.jup.ag/docs/ultra/rate-limit.md): Ultra Swap API uses dynamic rate limiting: 50 base requests per 10-second window, scaling with executed swap volume. Free API key required from portal.jup.ag.
- [Add Integrator Fees](https://dev.jup.ag/docs/ultra/add-fees-to-ultra.md): Four-step setup to add custom fees (50–255 bps) to Ultra Swap: install referral SDK, create referralAccount, create referralTokenAccount per mint, then pass referralAccount and referralFee to /order.
- [Add Integrator Payer](https://dev.jup.ag/docs/ultra/add-payer.md): Use the payer parameter to pay network fees and rent on behalf of users. Requires referralAccount and referralFee. Enforces Iris-only routing.
- [Integrate Jupiter Plugin](https://dev.jup.ag/docs/ultra/plugin-integration.md): Drop-in Ultra Swap UI widget for any web app. Three display modes (integrated, widget, modal), wallet passthrough support, and integrator fee configuration.

### Swap

- [Metis Swap API Overview](https://dev.jup.ag/docs/swap/index.md): Low-level routing engine for developers who need CPI, custom instructions, or full transaction control. Requires your own RPC.
- [Get Quote](https://dev.jup.ag/docs/swap/get-quote.md): GET /swap/v1/quote returns route plans from the Metis routing engine. Required params: inputMint, outputMint, amount, slippageBps.
- [Build Swap Transaction](https://dev.jup.ag/docs/swap/build-swap-transaction.md): POST /swap/v1/swap builds a serialized swap transaction from a quote. Supports dynamicComputeUnitLimit, dynamicSlippage, and prioritizationFeeLamports.
- [Send Swap Transaction](https://dev.jup.ag/docs/swap/send-swap-transaction.md): Sign and send the serialized Metis swap transaction via your own RPC. Covers priority fee estimation, compute unit limits, dynamic slippage, and Jito broadcasting.
- [Add Fees To Swap](https://dev.jup.ag/docs/swap/add-fees-to-swap.md): Add integrator fees to Metis swaps using the platformFeeBps quote parameter and feeAccount swap parameter. Supports SPL and Token2022 tokens.
- [Payments Through Swap](https://dev.jup.ag/docs/swap/payments-through-swap.md): Use the Metis Swap API with ExactOut swap mode to accept payments in any token while receiving your preferred token. Set destinationTokenAccount to route output to a merchant wallet.
- [Requote with Lower Max Accounts](https://dev.jup.ag/docs/swap/requote-with-lower-max-accounts.md): Reduce the maxAccounts quote parameter when adding custom instructions causes the swap transaction to exceed Solana's 1232-byte size limit. Includes retry logic to find the right account count.
- [Common Errors](https://dev.jup.ag/docs/swap/common-errors.md): Reference for Metis Swap API errors: Jupiter program errors (slippage, insufficient funds), Solana and DEX program errors, routing errors, and swap transaction composing errors with debug tips.

### Lend

- [Jupiter Lend Overview](https://dev.jup.ag/docs/lend/index.md): Jupiter's lending protocol for earning yield on token deposits. Program IDs: Earn (jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9), Borrow (jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi).
- [Oracles](https://dev.jup.ag/docs/lend/oracles.md): Jupiter Lend Oracle Program (jupnw4B6Eqs7ft6rxpzYLJZYSnrpRgPcr589n5Kv4oc) provides price data via a hop-based system using Pyth feeds, with freshness and confidence interval validation.
- [Earn (Beta)](https://dev.jup.ag/docs/lend/earn.md): Jupiter Lend Earn API for depositing and withdrawing assets. Supports deposit/withdraw by amount and mint/redeem by share count, with both transaction and instruction endpoints.
- [Borrow (Soon)](https://dev.jup.ag/docs/lend/borrow.md): Jupiter Lend Borrow API for collateralized borrowing with up to 95% LTV. Work-in-progress — documentation coming soon.
- [Lend SDK](https://dev.jup.ag/docs/lend/sdk.md): The @jup-ag/lend SDK provides TypeScript functions for deposit, withdraw, and CPI context accounts to integrate with the Jupiter Lend Earn protocol.
- [Liquidation](https://dev.jup.ag/docs/lend/liquidation.md): Build a liquidation bot for Jupiter Lend using the @jup-ag/lend SDK. Covers fetching available liquidations, flash borrowing, executing liquidation instructions, and swapping collateral via Jupiter Swap.

### Perps

- [Jupiter Perpetuals Overview](https://dev.jup.ag/docs/perps/index.md): Jupiter Perpetuals program for leveraged trading on Solana. Work-in-progress documentation covering account structures and the Anchor IDL.
- [Position Account](https://dev.jup.ag/docs/perps/position-account.md): The Position account stores trade position data including owner, side (long/short), entry price, size, collateral, PNL, and borrow fee snapshot. Derived from the trader's wallet, custody, and collateral custody.
- [PositionRequest Account](https://dev.jup.ag/docs/perps/position-request-account.md): The PositionRequest account represents a pending request to open, close, or modify a position, including TP/SL triggers. It is a PDA derived from the Position account with a unique random seed.
- [Pool Account](https://dev.jup.ag/docs/perps/pool-account.md): The Pool account stores JLP pool configuration including AUM (aumUsd), custody public keys, position limits, fee schedules (open/close/swap), and APR calculation data. Only one Pool account exists.
- [Custody Account](https://dev.jup.ag/docs/perps/custody-account.md): The Custody account stores parameters and state for each token (SOL, ETH, BTC, USDC, USDT) managed by the JLP pool, including oracle data, pricing params, asset balances, and funding rate state.

### Trigger

- [Trigger (Limit Orders) API Overview](https://dev.jup.ag/docs/trigger/index.md): Create limit orders that execute automatically when the target price is reached. Supports any token pair, custom fees, and order expiry.
- [Create Order](https://dev.jup.ag/docs/trigger/create-order.md): POST /trigger/v1/createOrder builds a limit order transaction. Required params: inputMint, outputMint, maker, payer, makingAmount, takingAmount.
- [Execute Order](https://dev.jup.ag/docs/trigger/execute-order.md): POST /trigger/v1/execute submits a filled trigger order. Jupiter automatically monitors and executes orders when the target price is reached.
- [Cancel Order](https://dev.jup.ag/docs/trigger/cancel-order.md): POST /trigger/v1/cancelOrder cancels an open trigger order and returns unfilled tokens to the maker.
- [Get Trigger Orders](https://dev.jup.ag/docs/trigger/get-trigger-orders.md): GET /trigger/v1/getTriggerOrders returns open and historical trigger orders filtered by wallet, status, or token pair.
- [Best Practices](https://dev.jup.ag/docs/trigger/best-practices.md): Guidelines for trigger order minimum amounts, price validation, slippage settings, and token compatibility.

### Recurring

- [Recurring (DCA) API Overview](https://dev.jup.ag/docs/recurring/index.md): Set up automated dollar-cost averaging (DCA) with time-based recurring orders on Solana.
- [Create Order](https://dev.jup.ag/docs/recurring/create-order.md): POST /recurring/v1/createOrder sets up a DCA order with configurable cycle frequency, amount per cycle, and optional start time.
- [Execute Order](https://dev.jup.ag/docs/recurring/execute-order.md): POST /recurring/v1/execute triggers the next cycle of a recurring order. Jupiter keeper bots handle this automatically.
- [Cancel Order](https://dev.jup.ag/docs/recurring/cancel-order.md): POST /recurring/v1/cancelOrder cancels an active recurring (DCA) order and returns remaining funds to the user.
- [Deposit Price Order](https://dev.jup.ag/docs/recurring/deposit-price-order.md): DEPRECATED: POST /recurring/v1/priceDeposit deposits funds into a price-based recurring order. Use time-based orders instead.
- [Withdraw Price Order](https://dev.jup.ag/docs/recurring/withdraw-price-order.md): DEPRECATED: POST /recurring/v1/priceWithdraw withdraws funds from a price-based recurring order. Use time-based orders instead.
- [Get Recurring Orders](https://dev.jup.ag/docs/recurring/get-recurring-orders.md): GET /recurring/v1/getRecurringOrders returns active and historical DCA orders filtered by wallet or status.
- [Best Practices](https://dev.jup.ag/docs/recurring/best-practices.md): Guidelines for recurring order minimum amounts, cycle requirements, and token compatibility (Token-2022 not supported).

### Tokens

- [Token Verification and Listing](https://dev.jup.ag/docs/tokens/index.md): Jupiter's token verification system, listing process, and search APIs. Use the V2 API for programmatic token discovery and metadata.

#### V2

- [Tokens API V2 (BETA)](https://dev.jup.ag/docs/tokens/v2/token-information.md): GET /tokens/v2 endpoints for retrieving token metadata by mint address, symbol search, tag, category, or recency. Returns name, symbol, icon, organic score, holder count, and trading stats.
- [Content API (BETA)](https://dev.jup.ag/docs/tokens/v2/content.md): GET /tokens/v2/content endpoints for retrieving curated token content, trending tokens, paginated feeds, and summaries powered by Jupiter VRFD. Pro tier only.

- [Organic Score](https://dev.jup.ag/docs/tokens/organic-score.md): Organic Score measures the genuine activity and health of a token using real user wallet data, including holder count, trading volume, and liquidity — filtering out bot and wash-trade activity.
- [Token Tag Standard](https://dev.jup.ag/docs/tokens/token-tag-standard.md): Token tags categorize tokens in the Jupiter Tokens API (e.g., Verified, LST). Projects can apply for custom tags by providing a public CSV endpoint of mint addresses.

### Price

- [Jupiter Price API Overview](https://dev.jup.ag/docs/price/index.md): Heuristics-based token pricing from Jupiter's routing engine. Single source of truth for all Jupiter UIs.
- [Price API V3 (Beta)](https://dev.jup.ag/docs/price/v3.md): GET /price/v3?ids={mints} returns heuristics-based USD prices for up to 50 token mint addresses per request, using last-swapped price validated against liquidity and trading metrics.

### Portfolio

- [Jupiter Portfolio API Overview](https://dev.jup.ag/docs/portfolio/index.md): BETA: GET /portfolio/v1/positions?wallet={address} returns all DeFi positions across protocols on Solana including lending, staking, and LP positions.
- [Jupiter Positions](https://dev.jup.ag/docs/portfolio/jupiter-positions.md): Query Jupiter-specific positions including wallet balances, staked JUP, limit orders, DCA, liquidity pools, and leveraged trades via GET /portfolio/v1/positions/{address}.

### Send

- [Jupiter Send API Overview](https://dev.jup.ag/docs/send/index.md): Send tokens to any user without requiring a connected wallet on the receiving end. Recipients claim tokens via Jupiter Mobile.
- [Invite Code (Beta)](https://dev.jup.ag/docs/send/invite-code.md): Client-side utilities for generating 12-character base58 invite codes and deriving deterministic Solana keypairs for the Send API.
- [Craft Send (Beta)](https://dev.jup.ag/docs/send/craft-send.md): Use the POST /send/v1/craft-send endpoint to build a Send transaction that transfers tokens to a recipient via an invite code.
- [Craft Clawback (Beta)](https://dev.jup.ag/docs/send/craft-clawback.md): Use the POST /send/v1/craft-clawback endpoint to reclaim tokens from an unclaimed Send invite before it expires.
- [Manage Invites (Beta)](https://dev.jup.ag/docs/send/manage-invites.md): Query pending and historical Send invites using the /send/v1/pending-invites and /send/v1/invite-history endpoints.

### Studio

- [Jupiter Studio Overview](https://dev.jup.ag/docs/studio/index.md): Jupiter Studio provides APIs for token creation with flexible bonding curves, LP fee management, vesting schedules, and dedicated token pages on jup.ag.
- [Create Token (Beta)](https://dev.jup.ag/docs/studio/create-token.md): Use the Studio API create-tx and submit endpoints to launch a token with configurable bonding curves, upload metadata and images, and submit the signed transaction.
- [Claim Fee (Beta)](https://dev.jup.ag/docs/studio/claim-fee.md): Retrieve pool addresses, check unclaimed LP fees, and claim fees from Dynamic Bonding Curve pools using the Studio API fee endpoints.

### Lock

- [Jupiter Lock Overview](https://dev.jup.ag/docs/lock/index.md): Jupiter Lock (Program ID: LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn) is an open-source, audited, and free tool for locking and vesting tokens over time on Solana.

### Routing

- [Jupiter Routing Engines](https://dev.jup.ag/docs/routing/index.md): Jupiter's routing stack: Juno (meta-aggregator) combines Iris (enhanced Metis), JupiterZ (RFQ), and third-party routers for optimal swap execution.
- [Integrate DEX into Metis](https://dev.jup.ag/docs/routing/dex-integration.md): Requirements and steps to integrate your DEX into the Metis routing engine, including the Jupiter AMM Interface SDK and security audit prerequisites.
- [Integrate MM into JupiterZ (RFQ)](https://dev.jup.ag/docs/routing/rfq-integration.md): Host a webhook implementing the RFQ API schema, pass fulfillment and response time requirements, and onboard your market maker into JupiterZ.
- [Market Listing](https://dev.jup.ag/docs/routing/market-listing.md): How markets are listed in Iris routing: instant routing for new markets on supported DEXes with a grace period, and normal routing with liquidity requirements.
- [Token Listing](https://dev.jup.ag/docs/routing/token-listing.md): How tokens become tradable on Jupiter: create a market with liquidity, meet listing requirements, and verify your token at jup.ag/verify.

## Api Reference

OpenAPI specifications for every Jupiter endpoint.

- [Jupiter Ultra Swap API](https://dev.jup.ag/openapi-spec/ultra/ultra.yaml): Jupiter Ultra Swap API Schema
- [Metis Swap API](https://dev.jup.ag/openapi-spec/swap/swap.yaml): Metis Swap API Schema
- [Jupiter Lend API](https://dev.jup.ag/openapi-spec/lend/lend.yaml): Jupiter Lend API Schema
- [Jupiter Trigger Order API](https://dev.jup.ag/openapi-spec/trigger/trigger.yaml): Jupiter Trigger Order API Schema
- [Jupiter Recurring Order API](https://dev.jup.ag/openapi-spec/recurring/recurring.yaml): Jupiter Recurring Order API Schema
- [Jupiter Tokens API V2](https://dev.jup.ag/openapi-spec/tokens/v2/tokens.yaml): Jupiter Tokens API V2 Schema
- [Jupiter Price API V3](https://dev.jup.ag/openapi-spec/price/v3/price.yaml): Jupiter Price API V3 Schema
- [Jupiter Portfolio API](https://dev.jup.ag/openapi-spec/portfolio/portfolio.yaml): Jupiter Portfolio API Schema
- [Jupiter Send API](https://dev.jup.ag/openapi-spec/send/send.yaml): Jupiter Send API Schema
- [Jupiter Studio API](https://dev.jup.ag/openapi-spec/studio/studio.yaml): Jupiter Studio API Schema

## Tool Kits

Drop-in UI components (Plugin, Wallet Kit) and the Referral Program SDK.

- [Jupiter Tool Kits](https://dev.jup.ag/tool-kits/index.md): Three developer tool kits: Jupiter Plugin (drop-in Ultra Swap widget), Wallet Kit (unified wallet adapter for all Solana wallets), and Referral Program (earn fees on user trades).

### Plugin

- [Integrate Jupiter Plugin](https://dev.jup.ag/tool-kits/plugin/index.md): Drop-in Ultra Swap widget for any web app. Supports 3 display modes (integrated, widget, modal), RPC-less operation, wallet passthrough, and customizable theming.
- [Next.js App Example](https://dev.jup.ag/tool-kits/plugin/nextjs-app-example.md): Step-by-step guide to integrate Jupiter Plugin into a Next.js application using either the window object or the @jup-ag/plugin npm package.
- [React App Example](https://dev.jup.ag/tool-kits/plugin/react-app-example.md): Step-by-step guide to integrate Jupiter Plugin into a React application using either the window object or the @jup-ag/plugin npm package.
- [HTML App Example](https://dev.jup.ag/tool-kits/plugin/html-app-example.md): Step-by-step guide to integrate Jupiter Plugin into a plain HTML application using the plugin script tag and window.Jupiter.init().
- [Customizing Plugin](https://dev.jup.ag/tool-kits/plugin/customization.md): Configure Jupiter Plugin display modes, form props (swap mode, fixed amounts, referral fees), wallet passthrough, event handlers, branding, and color themes.
- [FAQ](https://dev.jup.ag/tool-kits/plugin/faq.md): Frequently asked questions about Jupiter Plugin: feature requests, adding referral fees, fixing integrated mode layout issues, and best practices for customization.

### Wallet Kit

- [Integrate Wallet Kit](https://dev.jup.ag/tool-kits/wallet-kit/index.md): Open-source unified wallet adapter supporting 20+ Solana wallets, Wallet Standard, Jupiter Wallet Extension, Mobile Adapter QR login, and i18n in 7 languages.
- [Jupiter Wallet Extension](https://dev.jup.ag/tool-kits/wallet-kit/jupiter-wallet-extension.md): Step-by-step guide to integrate Jupiter Wallet Extension into a Next.js app using @jup-ag/wallet-adapter with UnifiedWalletProvider and notification handling.
- [Jupiter Mobile Adapter](https://dev.jup.ag/tool-kits/wallet-kit/jupiter-mobile-adapter.md): Integrate Jupiter Mobile QR code login into your app using the @jup-ag/jup-mobile-adapter package with Reown's AppKit for WalletConnect support.

- [Referral Program](https://dev.jup.ag/tool-kits/referral-program.md): The open-source Referral Program SDK enables developers to earn on-chain fees via Jupiter APIs (Ultra Swap, Swap, Trigger, Plugin) and can be integrated by any Solana program.

## Resources

Support channels and community resources.

- [Support](https://dev.jup.ag/resources/support.md): Technical and customer support platforms for Jupiter
- [AI Workflow](https://dev.jup.ag/resources/ai-workflow.md): How to use Jupiter docs with AI tools
- [Brand Kit](https://dev.jup.ag/resources/brand-kit.md): Logos, labelling guidelines, and brand assets for Jupiter integrations.
- [Stats](https://dev.jup.ag/resources/stats.md): Jupiter product metrics, revenue, and usage statistics on Dune.
- [Audits](https://dev.jup.ag/resources/audits.md): Formal audit reports for Jupiter programs
- [References](https://dev.jup.ag/resources/references.md): Links and references to Jupiter's GitHub repositories.

## Updates

Changelog and release notes.

- [Updates](https://dev.jup.ag/updates/index.md): Latest announcements and breaking changes across Jupiter APIs.

## Optional

- [Dev Portal](https://portal.jup.ag/): Access the Jupiter Portal to manage API key, access to metrics and logs
- [API Status](https://status.jup.ag/): Check the status of Jupiter APIs
- [Stay Updated](https://dev.jup.ag/resources/support): Get support and stay updated with Jupiter



# Jupiter

> Jupiter is DeFi infrastructure on Solana providing swap, lending, perpetuals, limit-order, DCA, and portfolio APIs.
> Two main swap APIs: **Ultra** (recommended — managed execution, gasless, RPC-less) and **Metis** (advanced — low-level routing primitives, bring your own RPC).
> Base URL: `https://api.jup.ag`. All endpoints require an `x-api-key` header — generate a free key at [portal.jup.ag](https://portal.jup.ag).

## Quick Reference

- Ultra Swap API (recommended): `GET /ultra/v1/order` + `POST /ultra/v1/execute`
- Metis Swap API (advanced): `GET /swap/v1/quote` + `POST /swap/v1/swap`
- Trigger (limit orders): `POST /trigger/v1/createOrder`
- Recurring (DCA): `POST /recurring/v1/createOrder`
- Lend: `POST /lend/v1/earn/deposit`
- Price: `GET /price/v3?ids={mints}`
- Tokens: `GET /tokens/v2/search?query={query}`
- Portfolio: `GET /portfolio/v1/positions?wallet={address}`

## Get Started

Setup guides for environment, tooling, and first API calls.

- [Get Started](https://dev.jup.ag/get-started/index.md): Jupiter developer documentation hub: explore the full product suite (Ultra Swap, Perps, Lend, Trigger, Recurring, Price, Tokens, Send, Studio, Lock) and find quick start paths for your integration.
- [Environment Setup](https://dev.jup.ag/get-started/environment-setup.md): Install Solana web3.js and spl-token libraries, configure an RPC connection, and set up a development wallet to build with the Jupiter API.
- [Development Basics](https://dev.jup.ag/get-started/development-basics.md): Solana fundamentals for Jupiter developers: accounts, programs, instructions, transactions, priority fees, compute units, slippage, and how Ultra Swap API simplifies it all.

## Portal

API key management, rate limits, tiers, and billing at portal.jup.ag.

- [Setting Up API Key](https://dev.jup.ag/portal/setup.md): Generate a free API key at portal.jup.ag. Pass it via x-api-key header. Free, Pro, and Ultra tiers available.
- [Migrate from Lite API](https://dev.jup.ag/portal/migrate-from-lite-api.md): Migrate from lite-api.jup.ag to api.jup.ag: update the base URL, generate a free API key at portal.jup.ag, and add the x-api-key header.
- [Payment Methods](https://dev.jup.ag/portal/payment.md): Payment options for Jupiter Portal Pro plans: USDC on Solana via Helio (manual monthly renewal) or credit card via CoinFlow (auto-renewing subscription).
- [Response Codes](https://dev.jup.ag/portal/responses.md): Common HTTP response codes from Jupiter APIs: 200 success, 400 bad request, 401 unauthorized, 429 rate limited, and 5xx server errors with debugging guidance.
- [Rate Limit](https://dev.jup.ag/portal/rate-limit.md): Jupiter API rate limiting: Fixed Rate Limits for Free and Pro tiers (60 req/min to 30K req/min), and Dynamic Rate Limits for Ultra that scale with executed swap volume.
- [Latency](https://dev.jup.ag/portal/latency.md): Jupiter API latency characteristics: distributed AWS gateway regions, factors affecting response times, and optimization tips for collocating servers.
- [FAQ](https://dev.jup.ag/portal/faq.md): Frequently asked questions about Jupiter Portal: tier differences, API key usage, payment, upgrades, and using Pro and Ultra together.

## Docs

Core product documentation covering each Jupiter API with usage guides and code examples.

### Ultra

- [Ultra Swap API Overview](https://dev.jup.ag/docs/ultra/index.md): Jupiter's flagship swap API: RPC-less, gasless, with automatic slippage optimization and sub-second transaction landing. Start here for most swap integrations.
- [Ultra Swap API Quick Start](https://dev.jup.ag/docs/ultra/get-started.md): Two-step swap flow: call GET /order to get a transaction, sign it, then POST /execute. Includes links to all Ultra endpoints and guides.
- [Gasless Support](https://dev.jup.ag/docs/ultra/gasless.md): Two gasless mechanisms: Ultra Gasless Support (covers all gas when taker has < 0.01 SOL, min ~$10 trade) and JupiterZ RFQ (market maker pays network fees). Also supports Integrator Gas Payer.
- [Fees](https://dev.jup.ag/docs/ultra/fees.md): Ultra Swap charges 5–10 bps per swap. Integrators can add custom fees (Jupiter takes 20% of integrator fees). Fee mint is determined by a priority list.
- [Manual Mode](https://dev.jup.ag/docs/ultra/manual-mode.md): Use manual mode to control Ultra API parameters like slippage or priority fee settings. Not recommended for default integrations — use only for user-facing trading UIs.
- [Get Order](https://dev.jup.ag/docs/ultra/get-order.md): GET /ultra/v1/order returns a base64-encoded unsigned swap transaction. Required params: inputMint, outputMint, amount, taker.
- [Execute Order](https://dev.jup.ag/docs/ultra/execute-order.md): POST /ultra/v1/execute accepts the signed transaction and requestId, broadcasts it, and returns the swap result.
- [Search Token](https://dev.jup.ag/docs/ultra/search-token.md): GET /ultra/v1/search?query={query} returns token metadata by symbol, name, or mint address. Supports comma-separated queries, up to 100 mints.
- [Get Holdings](https://dev.jup.ag/docs/ultra/get-holdings.md): GET /ultra/v1/holdings/{address} returns detailed token holdings including token account info, frozen status, and native SOL balance.
- [Get Shield](https://dev.jup.ag/docs/ultra/get-shield.md): GET /ultra/v1/shield?mints={mints} returns token security warnings (freeze authority, mint authority, low organic activity, etc.) for specified mint addresses.
- [Response](https://dev.jup.ag/docs/ultra/response.md): Ultra Swap API response schemas and error codes for /order (errorCode 1–3) and /execute (codes 0, -1 to -5, -1000s aggregator, -2000s RFQ, and program-level codes).
- [Rate Limit](https://dev.jup.ag/docs/ultra/rate-limit.md): Ultra Swap API uses dynamic rate limiting: 50 base requests per 10-second window, scaling with executed swap volume. Free API key required from portal.jup.ag.
- [Add Integrator Fees](https://dev.jup.ag/docs/ultra/add-fees-to-ultra.md): Four-step setup to add custom fees (50–255 bps) to Ultra Swap: install referral SDK, create referralAccount, create referralTokenAccount per mint, then pass referralAccount and referralFee to /order.
- [Add Integrator Payer](https://dev.jup.ag/docs/ultra/add-payer.md): Use the payer parameter to pay network fees and rent on behalf of users. Requires referralAccount and referralFee. Enforces Iris-only routing.
- [Integrate Jupiter Plugin](https://dev.jup.ag/docs/ultra/plugin-integration.md): Drop-in Ultra Swap UI widget for any web app. Three display modes (integrated, widget, modal), wallet passthrough support, and integrator fee configuration.

### Swap

- [Metis Swap API Overview](https://dev.jup.ag/docs/swap/index.md): Low-level routing engine for developers who need CPI, custom instructions, or full transaction control. Requires your own RPC.
- [Get Quote](https://dev.jup.ag/docs/swap/get-quote.md): GET /swap/v1/quote returns route plans from the Metis routing engine. Required params: inputMint, outputMint, amount, slippageBps.
- [Build Swap Transaction](https://dev.jup.ag/docs/swap/build-swap-transaction.md): POST /swap/v1/swap builds a serialized swap transaction from a quote. Supports dynamicComputeUnitLimit, dynamicSlippage, and prioritizationFeeLamports.
- [Send Swap Transaction](https://dev.jup.ag/docs/swap/send-swap-transaction.md): Sign and send the serialized Metis swap transaction via your own RPC. Covers priority fee estimation, compute unit limits, dynamic slippage, and Jito broadcasting.
- [Add Fees To Swap](https://dev.jup.ag/docs/swap/add-fees-to-swap.md): Add integrator fees to Metis swaps using the platformFeeBps quote parameter and feeAccount swap parameter. Supports SPL and Token2022 tokens.
- [Payments Through Swap](https://dev.jup.ag/docs/swap/payments-through-swap.md): Use the Metis Swap API with ExactOut swap mode to accept payments in any token while receiving your preferred token. Set destinationTokenAccount to route output to a merchant wallet.
- [Requote with Lower Max Accounts](https://dev.jup.ag/docs/swap/requote-with-lower-max-accounts.md): Reduce the maxAccounts quote parameter when adding custom instructions causes the swap transaction to exceed Solana's 1232-byte size limit. Includes retry logic to find the right account count.
- [Common Errors](https://dev.jup.ag/docs/swap/common-errors.md): Reference for Metis Swap API errors: Jupiter program errors (slippage, insufficient funds), Solana and DEX program errors, routing errors, and swap transaction composing errors with debug tips.

### Lend

- [Jupiter Lend Overview](https://dev.jup.ag/docs/lend/index.md): Jupiter's lending protocol for earning yield on token deposits. Program IDs: Earn (jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9), Borrow (jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi).
- [Oracles](https://dev.jup.ag/docs/lend/oracles.md): Jupiter Lend Oracle Program (jupnw4B6Eqs7ft6rxpzYLJZYSnrpRgPcr589n5Kv4oc) provides price data via a hop-based system using Pyth feeds, with freshness and confidence interval validation.
- [Earn (Beta)](https://dev.jup.ag/docs/lend/earn.md): Jupiter Lend Earn API for depositing and withdrawing assets. Supports deposit/withdraw by amount and mint/redeem by share count, with both transaction and instruction endpoints.
- [Borrow (Soon)](https://dev.jup.ag/docs/lend/borrow.md): Jupiter Lend Borrow API for collateralized borrowing with up to 95% LTV. Work-in-progress — documentation coming soon.
- [Lend SDK](https://dev.jup.ag/docs/lend/sdk.md): The @jup-ag/lend SDK provides TypeScript functions for deposit, withdraw, and CPI context accounts to integrate with the Jupiter Lend Earn protocol.
- [Liquidation](https://dev.jup.ag/docs/lend/liquidation.md): Build a liquidation bot for Jupiter Lend using the @jup-ag/lend SDK. Covers fetching available liquidations, flash borrowing, executing liquidation instructions, and swapping collateral via Jupiter Swap.

### Perps

- [Jupiter Perpetuals Overview](https://dev.jup.ag/docs/perps/index.md): Jupiter Perpetuals program for leveraged trading on Solana. Work-in-progress documentation covering account structures and the Anchor IDL.
- [Position Account](https://dev.jup.ag/docs/perps/position-account.md): The Position account stores trade position data including owner, side (long/short), entry price, size, collateral, PNL, and borrow fee snapshot. Derived from the trader's wallet, custody, and collateral custody.
- [PositionRequest Account](https://dev.jup.ag/docs/perps/position-request-account.md): The PositionRequest account represents a pending request to open, close, or modify a position, including TP/SL triggers. It is a PDA derived from the Position account with a unique random seed.
- [Pool Account](https://dev.jup.ag/docs/perps/pool-account.md): The Pool account stores JLP pool configuration including AUM (aumUsd), custody public keys, position limits, fee schedules (open/close/swap), and APR calculation data. Only one Pool account exists.
- [Custody Account](https://dev.jup.ag/docs/perps/custody-account.md): The Custody account stores parameters and state for each token (SOL, ETH, BTC, USDC, USDT) managed by the JLP pool, including oracle data, pricing params, asset balances, and funding rate state.

### Trigger

- [Trigger (Limit Orders) API Overview](https://dev.jup.ag/docs/trigger/index.md): Create limit orders that execute automatically when the target price is reached. Supports any token pair, custom fees, and order expiry.
- [Create Order](https://dev.jup.ag/docs/trigger/create-order.md): POST /trigger/v1/createOrder builds a limit order transaction. Required params: inputMint, outputMint, maker, payer, makingAmount, takingAmount.
- [Execute Order](https://dev.jup.ag/docs/trigger/execute-order.md): POST /trigger/v1/execute submits a filled trigger order. Jupiter automatically monitors and executes orders when the target price is reached.
- [Cancel Order](https://dev.jup.ag/docs/trigger/cancel-order.md): POST /trigger/v1/cancelOrder cancels an open trigger order and returns unfilled tokens to the maker.
- [Get Trigger Orders](https://dev.jup.ag/docs/trigger/get-trigger-orders.md): GET /trigger/v1/getTriggerOrders returns open and historical trigger orders filtered by wallet, status, or token pair.
- [Best Practices](https://dev.jup.ag/docs/trigger/best-practices.md): Guidelines for trigger order minimum amounts, price validation, slippage settings, and token compatibility.

### Recurring

- [Recurring (DCA) API Overview](https://dev.jup.ag/docs/recurring/index.md): Set up automated dollar-cost averaging (DCA) with time-based recurring orders on Solana.
- [Create Order](https://dev.jup.ag/docs/recurring/create-order.md): POST /recurring/v1/createOrder sets up a DCA order with configurable cycle frequency, amount per cycle, and optional start time.
- [Execute Order](https://dev.jup.ag/docs/recurring/execute-order.md): POST /recurring/v1/execute triggers the next cycle of a recurring order. Jupiter keeper bots handle this automatically.
- [Cancel Order](https://dev.jup.ag/docs/recurring/cancel-order.md): POST /recurring/v1/cancelOrder cancels an active recurring (DCA) order and returns remaining funds to the user.
- [Deposit Price Order](https://dev.jup.ag/docs/recurring/deposit-price-order.md): DEPRECATED: POST /recurring/v1/priceDeposit deposits funds into a price-based recurring order. Use time-based orders instead.
- [Withdraw Price Order](https://dev.jup.ag/docs/recurring/withdraw-price-order.md): DEPRECATED: POST /recurring/v1/priceWithdraw withdraws funds from a price-based recurring order. Use time-based orders instead.
- [Get Recurring Orders](https://dev.jup.ag/docs/recurring/get-recurring-orders.md): GET /recurring/v1/getRecurringOrders returns active and historical DCA orders filtered by wallet or status.
- [Best Practices](https://dev.jup.ag/docs/recurring/best-practices.md): Guidelines for recurring order minimum amounts, cycle requirements, and token compatibility (Token-2022 not supported).

### Tokens

- [Token Verification and Listing](https://dev.jup.ag/docs/tokens/index.md): Jupiter's token verification system, listing process, and search APIs. Use the V2 API for programmatic token discovery and metadata.

#### V2

- [Tokens API V2 (BETA)](https://dev.jup.ag/docs/tokens/v2/token-information.md): GET /tokens/v2 endpoints for retrieving token metadata by mint address, symbol search, tag, category, or recency. Returns name, symbol, icon, organic score, holder count, and trading stats.
- [Content API (BETA)](https://dev.jup.ag/docs/tokens/v2/content.md): GET /tokens/v2/content endpoints for retrieving curated token content, trending tokens, paginated feeds, and summaries powered by Jupiter VRFD. Pro tier only.

- [Organic Score](https://dev.jup.ag/docs/tokens/organic-score.md): Organic Score measures the genuine activity and health of a token using real user wallet data, including holder count, trading volume, and liquidity — filtering out bot and wash-trade activity.
- [Token Tag Standard](https://dev.jup.ag/docs/tokens/token-tag-standard.md): Token tags categorize tokens in the Jupiter Tokens API (e.g., Verified, LST). Projects can apply for custom tags by providing a public CSV endpoint of mint addresses.

### Price

- [Jupiter Price API Overview](https://dev.jup.ag/docs/price/index.md): Heuristics-based token pricing from Jupiter's routing engine. Single source of truth for all Jupiter UIs.
- [Price API V3 (Beta)](https://dev.jup.ag/docs/price/v3.md): GET /price/v3?ids={mints} returns heuristics-based USD prices for up to 50 token mint addresses per request, using last-swapped price validated against liquidity and trading metrics.

### Portfolio

- [Jupiter Portfolio API Overview](https://dev.jup.ag/docs/portfolio/index.md): BETA: GET /portfolio/v1/positions?wallet={address} returns all DeFi positions across protocols on Solana including lending, staking, and LP positions.
- [Jupiter Positions](https://dev.jup.ag/docs/portfolio/jupiter-positions.md): Query Jupiter-specific positions including wallet balances, staked JUP, limit orders, DCA, liquidity pools, and leveraged trades via GET /portfolio/v1/positions/{address}.

### Send

- [Jupiter Send API Overview](https://dev.jup.ag/docs/send/index.md): Send tokens to any user without requiring a connected wallet on the receiving end. Recipients claim tokens via Jupiter Mobile.
- [Invite Code (Beta)](https://dev.jup.ag/docs/send/invite-code.md): Client-side utilities for generating 12-character base58 invite codes and deriving deterministic Solana keypairs for the Send API.
- [Craft Send (Beta)](https://dev.jup.ag/docs/send/craft-send.md): Use the POST /send/v1/craft-send endpoint to build a Send transaction that transfers tokens to a recipient via an invite code.
- [Craft Clawback (Beta)](https://dev.jup.ag/docs/send/craft-clawback.md): Use the POST /send/v1/craft-clawback endpoint to reclaim tokens from an unclaimed Send invite before it expires.
- [Manage Invites (Beta)](https://dev.jup.ag/docs/send/manage-invites.md): Query pending and historical Send invites using the /send/v1/pending-invites and /send/v1/invite-history endpoints.

### Studio

- [Jupiter Studio Overview](https://dev.jup.ag/docs/studio/index.md): Jupiter Studio provides APIs for token creation with flexible bonding curves, LP fee management, vesting schedules, and dedicated token pages on jup.ag.
- [Create Token (Beta)](https://dev.jup.ag/docs/studio/create-token.md): Use the Studio API create-tx and submit endpoints to launch a token with configurable bonding curves, upload metadata and images, and submit the signed transaction.
- [Claim Fee (Beta)](https://dev.jup.ag/docs/studio/claim-fee.md): Retrieve pool addresses, check unclaimed LP fees, and claim fees from Dynamic Bonding Curve pools using the Studio API fee endpoints.

### Lock

- [Jupiter Lock Overview](https://dev.jup.ag/docs/lock/index.md): Jupiter Lock (Program ID: LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn) is an open-source, audited, and free tool for locking and vesting tokens over time on Solana.

### Routing

- [Jupiter Routing Engines](https://dev.jup.ag/docs/routing/index.md): Jupiter's routing stack: Juno (meta-aggregator) combines Iris (enhanced Metis), JupiterZ (RFQ), and third-party routers for optimal swap execution.
- [Integrate DEX into Metis](https://dev.jup.ag/docs/routing/dex-integration.md): Requirements and steps to integrate your DEX into the Metis routing engine, including the Jupiter AMM Interface SDK and security audit prerequisites.
- [Integrate MM into JupiterZ (RFQ)](https://dev.jup.ag/docs/routing/rfq-integration.md): Host a webhook implementing the RFQ API schema, pass fulfillment and response time requirements, and onboard your market maker into JupiterZ.
- [Market Listing](https://dev.jup.ag/docs/routing/market-listing.md): How markets are listed in Iris routing: instant routing for new markets on supported DEXes with a grace period, and normal routing with liquidity requirements.
- [Token Listing](https://dev.jup.ag/docs/routing/token-listing.md): How tokens become tradable on Jupiter: create a market with liquidity, meet listing requirements, and verify your token at jup.ag/verify.

## Api Reference

OpenAPI specifications for every Jupiter endpoint.

- [Jupiter Ultra Swap API](https://dev.jup.ag/openapi-spec/ultra/ultra.yaml): Jupiter Ultra Swap API Schema
- [Metis Swap API](https://dev.jup.ag/openapi-spec/swap/swap.yaml): Metis Swap API Schema
- [Jupiter Lend API](https://dev.jup.ag/openapi-spec/lend/lend.yaml): Jupiter Lend API Schema
- [Jupiter Trigger Order API](https://dev.jup.ag/openapi-spec/trigger/trigger.yaml): Jupiter Trigger Order API Schema
- [Jupiter Recurring Order API](https://dev.jup.ag/openapi-spec/recurring/recurring.yaml): Jupiter Recurring Order API Schema
- [Jupiter Tokens API V2](https://dev.jup.ag/openapi-spec/tokens/v2/tokens.yaml): Jupiter Tokens API V2 Schema
- [Jupiter Price API V3](https://dev.jup.ag/openapi-spec/price/v3/price.yaml): Jupiter Price API V3 Schema
- [Jupiter Portfolio API](https://dev.jup.ag/openapi-spec/portfolio/portfolio.yaml): Jupiter Portfolio API Schema
- [Jupiter Send API](https://dev.jup.ag/openapi-spec/send/send.yaml): Jupiter Send API Schema
- [Jupiter Studio API](https://dev.jup.ag/openapi-spec/studio/studio.yaml): Jupiter Studio API Schema

## Tool Kits

Drop-in UI components (Plugin, Wallet Kit) and the Referral Program SDK.

- [Jupiter Tool Kits](https://dev.jup.ag/tool-kits/index.md): Three developer tool kits: Jupiter Plugin (drop-in Ultra Swap widget), Wallet Kit (unified wallet adapter for all Solana wallets), and Referral Program (earn fees on user trades).

### Plugin

- [Integrate Jupiter Plugin](https://dev.jup.ag/tool-kits/plugin/index.md): Drop-in Ultra Swap widget for any web app. Supports 3 display modes (integrated, widget, modal), RPC-less operation, wallet passthrough, and customizable theming.
- [Next.js App Example](https://dev.jup.ag/tool-kits/plugin/nextjs-app-example.md): Step-by-step guide to integrate Jupiter Plugin into a Next.js application using either the window object or the @jup-ag/plugin npm package.
- [React App Example](https://dev.jup.ag/tool-kits/plugin/react-app-example.md): Step-by-step guide to integrate Jupiter Plugin into a React application using either the window object or the @jup-ag/plugin npm package.
- [HTML App Example](https://dev.jup.ag/tool-kits/plugin/html-app-example.md): Step-by-step guide to integrate Jupiter Plugin into a plain HTML application using the plugin script tag and window.Jupiter.init().
- [Customizing Plugin](https://dev.jup.ag/tool-kits/plugin/customization.md): Configure Jupiter Plugin display modes, form props (swap mode, fixed amounts, referral fees), wallet passthrough, event handlers, branding, and color themes.
- [FAQ](https://dev.jup.ag/tool-kits/plugin/faq.md): Frequently asked questions about Jupiter Plugin: feature requests, adding referral fees, fixing integrated mode layout issues, and best practices for customization.

### Wallet Kit

- [Integrate Wallet Kit](https://dev.jup.ag/tool-kits/wallet-kit/index.md): Open-source unified wallet adapter supporting 20+ Solana wallets, Wallet Standard, Jupiter Wallet Extension, Mobile Adapter QR login, and i18n in 7 languages.
- [Jupiter Wallet Extension](https://dev.jup.ag/tool-kits/wallet-kit/jupiter-wallet-extension.md): Step-by-step guide to integrate Jupiter Wallet Extension into a Next.js app using @jup-ag/wallet-adapter with UnifiedWalletProvider and notification handling.
- [Jupiter Mobile Adapter](https://dev.jup.ag/tool-kits/wallet-kit/jupiter-mobile-adapter.md): Integrate Jupiter Mobile QR code login into your app using the @jup-ag/jup-mobile-adapter package with Reown's AppKit for WalletConnect support.

- [Referral Program](https://dev.jup.ag/tool-kits/referral-program.md): The open-source Referral Program SDK enables developers to earn on-chain fees via Jupiter APIs (Ultra Swap, Swap, Trigger, Plugin) and can be integrated by any Solana program.

## Resources

Support channels and community resources.

- [Support](https://dev.jup.ag/resources/support.md): Technical and customer support platforms for Jupiter
- [AI Workflow](https://dev.jup.ag/resources/ai-workflow.md): How to use Jupiter docs with AI tools
- [Brand Kit](https://dev.jup.ag/resources/brand-kit.md): Logos, labelling guidelines, and brand assets for Jupiter integrations.
- [Stats](https://dev.jup.ag/resources/stats.md): Jupiter product metrics, revenue, and usage statistics on Dune.
- [Audits](https://dev.jup.ag/resources/audits.md): Formal audit reports for Jupiter programs
- [References](https://dev.jup.ag/resources/references.md): Links and references to Jupiter's GitHub repositories.

## Updates

Changelog and release notes.

- [Updates](https://dev.jup.ag/updates/index.md): Latest announcements and breaking changes across Jupiter APIs.

## Optional

- [Dev Portal](https://portal.jup.ag/): Access the Jupiter Portal to manage API key, access to metrics and logs
- [API Status](https://status.jup.ag/): Check the status of Jupiter APIs
- [Stay Updated](https://dev.jup.ag/resources/support): Get support and stay updated with Jupiter





guides by jupiter 


# API Reference
Source: https://dev.jup.ag/api-reference/index

Interactive API playground for all Jupiter endpoints.

## API Reference

<CardGroup>
  <Card title="Ultra Swap" href="/api-reference/ultra" icon="folder-open">
    6 items
  </Card>

  <Card title="Metis Swap" href="/api-reference/swap" icon="folder-open">
    4 items
  </Card>

  <Card title="Tokens" href="/api-reference/tokens" icon="folder-open">
    2 items
  </Card>

  <Card title="Price" href="/api-reference/price" icon="folder-open">
    2 items
  </Card>
</CardGroup>

## More

<CardGroup>
  <Card title="Lend (Beta)" href="/api-reference/lend" icon="folder-open">
    1 item
  </Card>

  <Card title="Trigger" href="/api-reference/trigger" icon="folder-open">
    5 items
  </Card>

  <Card title="Recurring" href="/api-reference/recurring" icon="folder-open">
    6 items
  </Card>

  <Card title="Portfolio (Beta)" href="/api-reference/portfolio" icon="folder-open">
    3 items
  </Card>

  <Card title="Send (Beta)" href="/api-reference/send" icon="folder-open">
    4 items
  </Card>

  <Card title="Studio (Beta)" href="/api-reference/studio" icon="folder-open">
    5 items
  </Card>
</CardGroup>


# Lend API
Source: https://dev.jup.ag/api-reference/lend

Endpoints for earning yield and borrowing against collateral.

<CardGroup>
  <Card title="Earn (Beta)" href="/api-reference/lend/earn" icon="folder-open">
    11 items
  </Card>
</CardGroup>


# Earn (Beta)
Source: https://dev.jup.ag/api-reference/lend/earn

Endpoints for deposits, withdrawals, minting and redeeming shares, positions, and earnings.

<CardGroup>
  <Card title="deposit" href="/api-reference/lend/earn/deposit" icon="file-lines">
    Request for a base64-encoded unsigned earn deposit transaction to deposit assets
  </Card>

  <Card title="withdraw" href="/api-reference/lend/earn/withdraw" icon="file-lines">
    Request for a base64-encoded unsigned earn withdraw transaction to withdraw assets
  </Card>

  <Card title="mint" href="/api-reference/lend/earn/mint" icon="file-lines">
    Request for a base64-encoded unsigned earn mint transaction to mint shares
  </Card>

  <Card title="redeem" href="/api-reference/lend/earn/redeem" icon="file-lines">
    Request for a base64-encoded unsigned earn redeem transaction to redeem shares
  </Card>

  <Card title="deposit-instructions" href="/api-reference/lend/earn/deposit-instructions" icon="file-lines">
    Request for the instruction of an earn deposit transaction to deposit assets
  </Card>

  <Card title="withdraw-instructions" href="/api-reference/lend/earn/withdraw-instructions" icon="file-lines">
    Request for the instruction of an earn withdraw transaction to withdraw assets
  </Card>

  <Card title="mint-instructions" href="/api-reference/lend/earn/mint-instructions" icon="file-lines">
    Request for the instruction of an earn mint transaction to mint shares
  </Card>

  <Card title="redeem-instructions" href="/api-reference/lend/earn/redeem-instructions" icon="file-lines">
    Request for the instruction of an earn redeem transaction to redeem shares
  </Card>

  <Card title="tokens" href="/api-reference/lend/earn/tokens" icon="file-lines">
    Request for the tokens available to be deposited and their information
  </Card>

  <Card title="positions" href="/api-reference/lend/earn/positions" icon="file-lines">
    Request for the position data of one or multiple users
  </Card>

  <Card title="earnings" href="/api-reference/lend/earn/earnings" icon="file-lines">
    Request for the earnings of one or multiple posi
  </Card>
</CardGroup>


# Deposit
Source: https://dev.jup.ag/api-reference/lend/earn/deposit

openapi-spec/lend/lend.yaml post /earn/deposit
Request for a base64-encoded unsigned earn deposit transaction to deposit assets



# Deposit Instructions
Source: https://dev.jup.ag/api-reference/lend/earn/deposit-instructions

openapi-spec/lend/lend.yaml post /earn/deposit-instructions
Request for the instruction of an earn deposit transaction to deposit assets



# Earnings
Source: https://dev.jup.ag/api-reference/lend/earn/earnings

openapi-spec/lend/lend.yaml get /earn/earnings
Request for the earnings of one or multiple positions of a user



# Mint
Source: https://dev.jup.ag/api-reference/lend/earn/mint

openapi-spec/lend/lend.yaml post /earn/mint
Request for a base64-encoded unsigned earn mint transaction to mint shares



# Mint Instructions
Source: https://dev.jup.ag/api-reference/lend/earn/mint-instructions

openapi-spec/lend/lend.yaml post /earn/mint-instructions
Request for the instruction of an earn mint transaction to mint shares



# Positions
Source: https://dev.jup.ag/api-reference/lend/earn/positions

openapi-spec/lend/lend.yaml get /earn/positions
Request for the position data of one or multiple users



# Redeem
Source: https://dev.jup.ag/api-reference/lend/earn/redeem

openapi-spec/lend/lend.yaml post /earn/redeem
Request for a base64-encoded unsigned earn redeem transaction to redeem shares



# Redeem Instructions
Source: https://dev.jup.ag/api-reference/lend/earn/redeem-instructions

openapi-spec/lend/lend.yaml post /earn/redeem-instructions
Request for the instruction of an earn redeem transaction to redeem shares



# Tokens
Source: https://dev.jup.ag/api-reference/lend/earn/tokens

openapi-spec/lend/lend.yaml get /earn/tokens
Request for the tokens available to be deposited and their information



# Withdraw
Source: https://dev.jup.ag/api-reference/lend/earn/withdraw

openapi-spec/lend/lend.yaml post /earn/withdraw
Request for a base64-encoded unsigned earn withdraw transaction to withdraw assets



# Withdraw Instructions
Source: https://dev.jup.ag/api-reference/lend/earn/withdraw-instructions

openapi-spec/lend/lend.yaml post /earn/withdraw-instructions
Request for the instruction of an earn withdraw transaction to withdraw assets



# Portfolio API
Source: https://dev.jup.ag/api-reference/portfolio

Endpoints for tracking DeFi positions and staked JUP across Solana.

<CardGroup>
  <Card title="Get Positions" href="/api-reference/portfolio/get-positions" icon="folder-open">
    1 item
  </Card>

  <Card title="Get Platforms" href="/api-reference/portfolio/get-platforms" icon="folder-open">
    1 item
  </Card>

  <Card title="Get Staked JUP" href="/api-reference/portfolio/get-staked-jup" icon="folder-open">
    1 item
  </Card>
</CardGroup>


# Get Platforms
Source: https://dev.jup.ag/api-reference/portfolio/get-platforms

openapi-spec/portfolio/portfolio.yaml get /platforms
Request for platform information



# Get Positions
Source: https://dev.jup.ag/api-reference/portfolio/get-positions

openapi-spec/portfolio/portfolio.yaml get /positions/{address}
Request for Jupiter positions of an address



# Get Staked JUP
Source: https://dev.jup.ag/api-reference/portfolio/get-staked-jup

openapi-spec/portfolio/portfolio.yaml get /staked-jup/{address}
Request for staked JUP information of an address



# Prediction API
Source: https://dev.jup.ag/api-reference/prediction

Overview of Jupiter Prediction Market API

<Note>
  **BETA**

  The Prediction Market API is currently in beta and subject to breaking changes. If you have any feedback, please reach out in [Discord](https://discord.gg/jup).
</Note>

## Events

<CardGroup>
  <Card title="Get Events" href="/api-reference/prediction/get-events" icon="file-lines">
    Get a list of all available prediction events with optional filtering and pagination
  </Card>

  <Card title="Search Events" href="/api-reference/prediction/search-events" icon="file-lines">
    Search for events by title or keyword
  </Card>

  <Card title="Get Event" href="/api-reference/prediction/get-event" icon="file-lines">
    Get detailed information about a specific event
  </Card>

  <Card title="Get Suggested Events" href="/api-reference/prediction/get-suggested-events" icon="file-lines">
    Get personalized event suggestions based on user activity
  </Card>
</CardGroup>

## Markets

<CardGroup>
  <Card title="Get Event Markets" href="/api-reference/prediction/get-event-markets" icon="file-lines">
    Get all markets for a specific event
  </Card>

  <Card title="Get Event Market" href="/api-reference/prediction/get-event-market" icon="file-lines">
    Get detailed market information for a specific market within an event
  </Card>

  <Card title="Get Market" href="/api-reference/prediction/get-market" icon="file-lines">
    Get detailed market information by market ID
  </Card>
</CardGroup>

## Orders

<CardGroup>
  <Card title="Get Orders" href="/api-reference/prediction/get-orders" icon="file-lines">
    Get a list of orders with optional filtering by owner or market
  </Card>

  <Card title="Get Order" href="/api-reference/prediction/get-order" icon="file-lines">
    Get detailed information about a specific order
  </Card>

  <Card title="Get Order Status" href="/api-reference/prediction/get-order-status" icon="file-lines">
    Get the latest status and history for an order
  </Card>

  <Card title="Create Order" href="/api-reference/prediction/create-order" icon="file-lines">
    Request an unsigned transaction to create a new order
  </Card>

  <Card title="Close Order" href="/api-reference/prediction/close-order" icon="file-lines">
    Request an unsigned transaction to close a pending order
  </Card>

  <Card title="Close All Orders" href="/api-reference/prediction/close-all-orders" icon="file-lines">
    Request unsigned transactions to close multiple orders
  </Card>
</CardGroup>

## Positions

<CardGroup>
  <Card title="Get Positions" href="/api-reference/prediction/get-positions" icon="file-lines">
    Get a list of positions with optional filtering
  </Card>

  <Card title="Get Position" href="/api-reference/prediction/get-position" icon="file-lines">
    Get detailed information about a specific position
  </Card>

  <Card title="Close Position" href="/api-reference/prediction/close-position" icon="file-lines">
    Request an unsigned transaction to sell all contracts in a position
  </Card>

  <Card title="Close All Positions" href="/api-reference/prediction/close-all-positions" icon="file-lines">
    Request unsigned transactions to close all open positions
  </Card>

  <Card title="Claim Position" href="/api-reference/prediction/claim-position" icon="file-lines">
    Request an unsigned transaction to claim payout from a winning position
  </Card>
</CardGroup>

## History & Data

<CardGroup>
  <Card title="Get History" href="/api-reference/prediction/get-history" icon="file-lines">
    Get trading history and event records for an account
  </Card>

  <Card title="Get Orderbook" href="/api-reference/prediction/get-orderbook" icon="file-lines">
    Get orderbook data for a specific market
  </Card>

  <Card title="Get Trading Status" href="/api-reference/prediction/get-trading-status" icon="file-lines">
    Get current trading status of the prediction market
  </Card>
</CardGroup>

## Profile & Social

<CardGroup>
  <Card title="Get Profile" href="/api-reference/prediction/get-profile" icon="file-lines">
    Get profile statistics for a user
  </Card>

  <Card title="Get PnL History" href="/api-reference/prediction/get-pnl-history" icon="file-lines">
    Get historical PnL data for charting
  </Card>

  <Card title="Get Trades" href="/api-reference/prediction/get-trades" icon="file-lines">
    Get recent filled trades across all markets
  </Card>

  <Card title="Get Leaderboards" href="/api-reference/prediction/get-leaderboards" icon="file-lines">
    Get leaderboard rankings by various metrics
  </Card>

  <Card title="Follow User" href="/api-reference/prediction/follow-user" icon="file-lines">
    Follow a user to track their predictions
  </Card>

  <Card title="Unfollow User" href="/api-reference/prediction/unfollow-user" icon="file-lines">
    Unfollow a previously followed user
  </Card>

  <Card title="Get Followers" href="/api-reference/prediction/get-followers" icon="file-lines">
    Get list of followers for a user
  </Card>

  <Card title="Get Following" href="/api-reference/prediction/get-following" icon="file-lines">
    Get list of users being followed
  </Card>
</CardGroup>

## Vault

<CardGroup>
  <Card title="Get Vault Info" href="/api-reference/prediction/get-vault-info" icon="file-lines">
    Get vault account information and balance
  </Card>
</CardGroup>


# Claim Position
Source: https://dev.jup.ag/api-reference/prediction/claim-position

openapi-spec/prediction/prediction.yaml post /positions/{positionPubkey}/claim
Request an unsigned transaction to claim payout from a winning position



# Close All Orders
Source: https://dev.jup.ag/api-reference/prediction/close-all-orders

openapi-spec/prediction/prediction.yaml delete /orders/close-all
Request unsigned transactions to close multiple orders



# Close All Positions
Source: https://dev.jup.ag/api-reference/prediction/close-all-positions

openapi-spec/prediction/prediction.yaml delete /positions
Request unsigned transactions to close all open positions



# Close Order
Source: https://dev.jup.ag/api-reference/prediction/close-order

openapi-spec/prediction/prediction.yaml delete /orders
Request an unsigned transaction to close a pending order



# Close Position
Source: https://dev.jup.ag/api-reference/prediction/close-position

openapi-spec/prediction/prediction.yaml delete /positions/{positionPubkey}
Request an unsigned transaction to sell all contracts in a position



# Create Order
Source: https://dev.jup.ag/api-reference/prediction/create-order

openapi-spec/prediction/prediction.yaml post /orders
Request an unsigned transaction to create a new order



# Follow User
Source: https://dev.jup.ag/api-reference/prediction/follow-user

openapi-spec/prediction/prediction.yaml post /follow/{ownerPubkey}
Follow a user to track their predictions



# Get Event
Source: https://dev.jup.ag/api-reference/prediction/get-event

openapi-spec/prediction/prediction.yaml get /events/{eventId}
Get detailed information about a specific event



# Get Event Market
Source: https://dev.jup.ag/api-reference/prediction/get-event-market

openapi-spec/prediction/prediction.yaml get /events/{eventId}/markets/{marketId}
Get detailed market information for a specific market within an event



# Get Event Markets
Source: https://dev.jup.ag/api-reference/prediction/get-event-markets

openapi-spec/prediction/prediction.yaml get /events/{eventId}/markets
Get all markets for a specific event



# Get Events
Source: https://dev.jup.ag/api-reference/prediction/get-events

openapi-spec/prediction/prediction.yaml get /events
Get a list of all available prediction events with optional filtering and pagination



# Get Followers
Source: https://dev.jup.ag/api-reference/prediction/get-followers

openapi-spec/prediction/prediction.yaml get /followers/{ownerPubkey}
Get list of followers for a user



# Get Following
Source: https://dev.jup.ag/api-reference/prediction/get-following

openapi-spec/prediction/prediction.yaml get /following/{ownerPubkey}
Get list of users being followed



# Get History
Source: https://dev.jup.ag/api-reference/prediction/get-history

openapi-spec/prediction/prediction.yaml get /history
Get trading history and event records for an account



# Get Leaderboards
Source: https://dev.jup.ag/api-reference/prediction/get-leaderboards

openapi-spec/prediction/prediction.yaml get /leaderboards
Get leaderboard rankings by various metrics



# Get Market
Source: https://dev.jup.ag/api-reference/prediction/get-market

openapi-spec/prediction/prediction.yaml get /markets/{marketId}
Get detailed market information by market ID



# Get Order
Source: https://dev.jup.ag/api-reference/prediction/get-order

openapi-spec/prediction/prediction.yaml get /orders/{orderPubkey}
Get detailed information about a specific order



# Get Order Status
Source: https://dev.jup.ag/api-reference/prediction/get-order-status

openapi-spec/prediction/prediction.yaml get /orders/status/{orderPubkey}
Get the latest status and history for an order



# Get Orderbook
Source: https://dev.jup.ag/api-reference/prediction/get-orderbook

openapi-spec/prediction/prediction.yaml get /orderbook/{marketId}
Get orderbook data for a specific market



# Get Orders
Source: https://dev.jup.ag/api-reference/prediction/get-orders

openapi-spec/prediction/prediction.yaml get /orders
Get a list of orders with optional filtering by owner or market



# Get PnL History
Source: https://dev.jup.ag/api-reference/prediction/get-pnl-history

openapi-spec/prediction/prediction.yaml get /profiles/{ownerPubkey}/pnl-history
Get historical PnL data for charting



# Get Position
Source: https://dev.jup.ag/api-reference/prediction/get-position

openapi-spec/prediction/prediction.yaml get /positions/{positionPubkey}
Get detailed information about a specific position



# Get Positions
Source: https://dev.jup.ag/api-reference/prediction/get-positions

openapi-spec/prediction/prediction.yaml get /positions
Get a list of positions with optional filtering



# Get Profile
Source: https://dev.jup.ag/api-reference/prediction/get-profile

openapi-spec/prediction/prediction.yaml get /profiles/{ownerPubkey}
Get profile statistics for a user



# Get Suggested Events
Source: https://dev.jup.ag/api-reference/prediction/get-suggested-events

openapi-spec/prediction/prediction.yaml get /events/suggested/{pubkey}
Get personalized event suggestions based on user activity



# Get Trades
Source: https://dev.jup.ag/api-reference/prediction/get-trades

openapi-spec/prediction/prediction.yaml get /trades
Get recent filled trades across all markets



# Get Trading Status
Source: https://dev.jup.ag/api-reference/prediction/get-trading-status

openapi-spec/prediction/prediction.yaml get /trading-status
Get current trading status of the prediction market



# Get Vault Info
Source: https://dev.jup.ag/api-reference/prediction/get-vault-info

openapi-spec/prediction/prediction.yaml get /vault-info
Get vault account information and balance



# Search Events
Source: https://dev.jup.ag/api-reference/prediction/search-events

openapi-spec/prediction/prediction.yaml get /events/search
Search for events by title or keyword



# Unfollow User
Source: https://dev.jup.ag/api-reference/prediction/unfollow-user

openapi-spec/prediction/prediction.yaml delete /unfollow/{ownerPubkey}
Unfollow a previously followed user



# Price API
Source: https://dev.jup.ag/api-reference/price

Endpoints for retrieving heuristics-based token prices.

<CardGroup>
  <Card title="V3" href="/api-reference/price/v3" icon="folder-open">
    1 item
  </Card>

  <Card title="V2 (Deprecated)" href="/api-reference/price/v2" icon="folder-open">
    1 item
  </Card>
</CardGroup>


# Price API V2 (Deprecated)
Source: https://dev.jup.ag/api-reference/price/v2

Deprecated. Use Price API V3 instead.

<CardGroup>
  <Card title="Price" href="/api-reference/price/v2/price" icon="folder-open">
    Returns prices of specified tokens.
  </Card>
</CardGroup>


# Price
Source: https://dev.jup.ag/api-reference/price/v2/price

openapi-spec/price/v2/price.yaml get /
Returns prices of specified tokens. Price V2 API is deprecated, please use Price V3 API instead



# Price API V3
Source: https://dev.jup.ag/api-reference/price/v3

Get USD prices for up to 50 tokens per request.

<CardGroup>
  <Card title="Price" href="/api-reference/price/v3/price" icon="folder-open">
    Returns prices of specified tokens.
  </Card>
</CardGroup>


# Price
Source: https://dev.jup.ag/api-reference/price/v3/price

openapi-spec/price/v3/price.yaml get /price/v3
Returns prices of specified tokens



# Recurring API
Source: https://dev.jup.ag/api-reference/recurring

Endpoints for creating, executing, and managing DCA orders.

<CardGroup>
  <Card title="createOrder" href="/api-reference/recurring/create-order" icon="file-lines">
    Request for a base64-encoded unsigned recurring order creation transaction to be used in `POST /recurring/v1/execute`
  </Card>

  <Card title="execute" href="/api-reference/recurring/execute" icon="file-lines">
    Execute the signed transaction and get the execution status
  </Card>

  <Card title="cancelOrder" href="/api-reference/recurring/cancel-order" icon="file-lines">
    Request for a base64-encoded unsigned recurring order cancellation transaction to be used in `POST /recurring/v1/execute`
  </Card>

  <Card title="priceDeposit" href="/api-reference/recurring/price-deposit" icon="file-lines">
    **DEPRECATED**: This endpoint is deprecated. Please use time-based recurring orders instead.
  </Card>

  <Card title="priceWithdraw" href="/api-reference/recurring/price-withdraw" icon="file-lines">
    **DEPRECATED**: This endpoint is deprecated. Please use time-based recurring orders instead.
  </Card>

  <Card title="getRecurringOrders" href="/api-reference/recurring/get-recurring-orders" icon="file-lines">
    Request for the active or historical orders associated to the provided account
  </Card>
</CardGroup>


# Cancel Order
Source: https://dev.jup.ag/api-reference/recurring/cancel-order

openapi-spec/recurring/recurring.yaml post /cancelOrder
Request for a base64-encoded unsigned recurring order cancellation transaction to be used in POST /recurring/v1/execute

<Info>
  **NOTE**

  * `recurringType` is used to denote the type of recurring order, only `time`
  * **DEPRECATED**: `recurringType: price` based orders are deprecated
  * Refer to [Recurring API doc](/docs/recurring/cancel-order) for more information.
</Info>


# Create Order
Source: https://dev.jup.ag/api-reference/recurring/create-order

openapi-spec/recurring/recurring.yaml post /createOrder
Request for a base64-encoded unsigned recurring order creation transaction to be used in POST /recurring/v1/execute

<Info>
  **NOTE**

  * Pass in the correct recurring type in the `params` field, only `time`
  * **DEPRECATED**: `params.price` based orders are deprecated
  * Refer to [Recurring API doc](/docs/recurring/create-order) for more information.
</Info>


# Execute
Source: https://dev.jup.ag/api-reference/recurring/execute

openapi-spec/recurring/recurring.yaml post /execute
Execute the signed transaction and get the execution status



# Get Recurring Orders
Source: https://dev.jup.ag/api-reference/recurring/get-recurring-orders

openapi-spec/recurring/recurring.yaml get /getRecurringOrders
Request for active or historical recurring orders associated to the provided account

<Info>
  **NOTE**

  * `recurringType` is used to denote the type of recurring order, only `time`
  * **DEPRECATED**: `recurringType: price` based orders are deprecated
</Info>


# Price Deposit
Source: https://dev.jup.ag/api-reference/recurring/price-deposit

openapi-spec/recurring/recurring.yaml post /priceDeposit
Request for a base64-encoded unsigned price-based recurring order deposit transaction. Price-based recurring orders are deprecated, please use time-based recurring orders instead



# Price Withdraw
Source: https://dev.jup.ag/api-reference/recurring/price-withdraw

openapi-spec/recurring/recurring.yaml post /priceWithdraw
Request for a base64-encoded unsigned price-based recurring order withdrawal transaction. Price-based recurring orders are deprecated, please use time-based recurring orders instead



# Send API
Source: https://dev.jup.ag/api-reference/send

Endpoints for crafting send and clawback transactions and managing invites.

<CardGroup>
  <Card title="craft-send" href="/api-reference/send/craft-send" icon="file-lines">
    Request for a base64-encoded unsigned Send transaction
  </Card>

  <Card title="craft-clawback" href="/api-reference/send/craft-clawback" icon="file-lines">
    Request for a base64-encoded unsigned Send transaction
  </Card>

  <Card title="pending-invites" href="/api-reference/send/pending-invites" icon="file-lines">
    Request for the pending invites of an address
  </Card>

  <Card title="invite-history" href="/api-reference/send/invite-history" icon="file-lines">
    Request for the invite history of an address
  </Card>
</CardGroup>


# Craft Clawback
Source: https://dev.jup.ag/api-reference/send/craft-clawback

openapi-spec/send/send.yaml post /craft-clawback
Request for a base64-encoded unsigned Send transaction



# Craft Send
Source: https://dev.jup.ag/api-reference/send/craft-send

openapi-spec/send/send.yaml post /craft-send
Request for a base64-encoded unsigned Send transaction



# Invite History
Source: https://dev.jup.ag/api-reference/send/invite-history

openapi-spec/send/send.yaml get /invite-history
Request for the invite history of an address



# Pending Invites
Source: https://dev.jup.ag/api-reference/send/pending-invites

openapi-spec/send/send.yaml get /pending-invites
Request for the pending invites of an address



# Studio API
Source: https://dev.jup.ag/api-reference/studio

Endpoints for token creation via Dynamic Bonding Curves and LP fee management.

<CardGroup>
  <Card title="dbc-pool-create-tx" href="/api-reference/studio/dbc-pool-create-tx" icon="file-lines">
    Request for a base64-encoded unsigned transaction to create a Dynamic Bonding Curve pool with token metadata
  </Card>

  <Card title="dbc-pool-submit" href="/api-reference/studio/dbc-pool-submit" icon="file-lines">
    Execute the signed transaction, and optionally upload content and header image
  </Card>

  <Card title="dbc-pool-addresses-by-mint" href="/api-reference/studio/dbc-pool-addresses-by-mint" icon="file-lines">
    Request for pool addresses for a given token mint
  </Card>

  <Card title="dbc-fee" href="/api-reference/studio/dbc-fee" icon="file-lines">
    Request for unclaimed creator trading fees of a Dynamic Bonding Curve pool
  </Card>

  <Card title="dbc-fee-create-tx" href="/api-reference/studio/dbc-fee-create-tx" icon="file-lines">
    Request for a base64-encoded unsigned transaction to claim creator trading fees of a Dynamic Bonding Curve pool
  </Card>
</CardGroup>


# DBC Fee
Source: https://dev.jup.ag/api-reference/studio/dbc-fee

openapi-spec/studio/studio.yaml post /dbc/fee
Request for unclaimed creator trading fees of a Dynamic Bonding Curve pool



# DBC Fee Create TX
Source: https://dev.jup.ag/api-reference/studio/dbc-fee-create-tx

openapi-spec/studio/studio.yaml post /dbc/fee/create-tx
Request for a base64-encoded unsigned transaction to claim creator trading fees of a Dynamic Bonding Curve pool



# DBC Pool Addresses by Mint
Source: https://dev.jup.ag/api-reference/studio/dbc-pool-addresses-by-mint

openapi-spec/studio/studio.yaml get /dbc-pool/addresses/{mint}
Request for pool addresses for a given token mint



# DBC Pool Create TX
Source: https://dev.jup.ag/api-reference/studio/dbc-pool-create-tx

openapi-spec/studio/studio.yaml post /dbc-pool/create-tx
Request for a base64-encoded unsigned transaction to create a Dynamic Bonding Curve pool with token metadata



# DBC Pool Submit
Source: https://dev.jup.ag/api-reference/studio/dbc-pool-submit

openapi-spec/studio/studio.yaml post /dbc-pool/submit
Execute the signed transaction, and optionally upload content and header image



# Metis Swap API
Source: https://dev.jup.ag/api-reference/swap

Endpoints for quotes, swap transactions, swap instructions, and program labels.

<CardGroup>
  <Card title="quote" href="/api-reference/swap/quote" icon="file-lines">
    Request for a quote to be used in `POST /swap`
  </Card>

  <Card title="swap" href="/api-reference/swap/swap" icon="file-lines">
    Request for a base64-encoded unsigned swap transaction based on the `/quote` response
  </Card>

  <Card title="swap-instructions" href="/api-reference/swap/swap-instructions" icon="file-lines">
    Request for swap instructions that you can use from the quote you get from `/quote`
  </Card>

  <Card title="program-id-to-label" href="/api-reference/swap/program-id-to-label" icon="file-lines">
    Returns a hash, which key is the program id and value is the label.
  </Card>
</CardGroup>


# Program ID to Label
Source: https://dev.jup.ag/api-reference/swap/program-id-to-label

openapi-spec/swap/swap.yaml get /program-id-to-label
Returns a hash mapping program IDs to labels for error identification



# Get Quote
Source: https://dev.jup.ag/api-reference/swap/quote

openapi-spec/swap/swap.yaml get /quote
Request for a quote to be used in POST /swap



# Swap
Source: https://dev.jup.ag/api-reference/swap/swap

openapi-spec/swap/swap.yaml post /swap
Request for a base64-encoded unsigned swap transaction based on the /quote response



# Swap Instructions
Source: https://dev.jup.ag/api-reference/swap/swap-instructions

openapi-spec/swap/swap.yaml post /swap-instructions
Request for swap instructions that you can use from the quote you get from /quote



# Tokens API
Source: https://dev.jup.ag/api-reference/tokens

Endpoints for token search, metadata, tags, and content.

<CardGroup>
  <Card title="V2" href="/api-reference/tokens/v2" icon="folder-open">
    4 items
  </Card>

  <Card title="V1 (Deprecated)" href="/api-reference/tokens/v1" icon="folder-open">
    6 items
  </Card>
</CardGroup>


# Tokens API V1 (Deprecated)
Source: https://dev.jup.ag/api-reference/tokens/v1

Deprecated. Use Tokens API V2 instead.

<CardGroup>
  <Card title="Token Information" href="/api-reference/tokens/v1/token-information" icon="file-lines">
    Returns the specified mint address's token information and metadata.
  </Card>

  <Card title="Mints in Market" href="/api-reference/tokens/v1/mints-in-market" icon="file-lines">
    Returns the mints involved in a market.
  </Card>

  <Card title="Tradable" href="/api-reference/tokens/v1/tradable" icon="file-lines">
    Returns a list of all mints tradable via Jupiter routing.
  </Card>

  <Card title="Tagged" href="/api-reference/tokens/v1/tagged" icon="file-lines">
    Returns a list of mints with specified tag(s) along with their metadata.
  </Card>

  <Card title="New" href="/api-reference/tokens/v1/new" icon="file-lines">
    Returns new tokens with metadata, created at timestamp and markets.
  </Card>

  <Card title="All" href="/api-reference/tokens/v1/all" icon="file-lines">
    Returns all tokens with all metadata.
  </Card>
</CardGroup>


# All
Source: https://dev.jup.ag/api-reference/tokens/v1/all

openapi-spec/tokens/v1/tokens.yaml get /all
Returns all tokens with all metadata. Tokens API V1 is deprecated, please use Tokens API V2 instead



# Mints in Market
Source: https://dev.jup.ag/api-reference/tokens/v1/mints-in-market

openapi-spec/tokens/v1/tokens.yaml get /market/{market_address}/mints
Returns the mints involved in a market. Tokens API V1 is deprecated, please use Tokens API V2 instead



# New
Source: https://dev.jup.ag/api-reference/tokens/v1/new

openapi-spec/tokens/v1/tokens.yaml get /new
Returns new tokens with metadata, created at timestamp and markets. Tokens API V1 is deprecated, please use Tokens API V2 instead



# Tagged
Source: https://dev.jup.ag/api-reference/tokens/v1/tagged

openapi-spec/tokens/v1/tokens.yaml get /tagged/{tag}
Returns a list of mints with specified tag(s) along with their metadata. Tokens API V1 is deprecated, please use Tokens API V2 instead



# Token Information
Source: https://dev.jup.ag/api-reference/tokens/v1/token-information

openapi-spec/tokens/v1/tokens.yaml get /token/{mint_address}
Returns the specified mint address's token information and metadata. Tokens API V1 is deprecated, please use Tokens API V2 instead



# Tradable
Source: https://dev.jup.ag/api-reference/tokens/v1/tradable

openapi-spec/tokens/v1/tokens.yaml get /mints/tradable
Returns a list of all mints tradable via Jupiter routing. Tokens API V1 is deprecated, please use Tokens API V2 instead



# Tokens API V2
Source: https://dev.jup.ag/api-reference/tokens/v2

Endpoints for search, tags, categories, recent tokens, and curated content.

**Token Information**

<CardGroup>
  <Card title="Search" href="/api-reference/tokens/v2/search" icon="file-lines">
    Request a search by token's symbol, name or mint address
  </Card>

  <Card title="Tag" href="/api-reference/tokens/v2/tag" icon="file-lines">
    Request an array of mints and their information by a tag
  </Card>

  <Card title="Category" href="/api-reference/tokens/v2/category" icon="file-lines">
    Returns an array of mints and their information for the given category and interval
  </Card>

  <Card title="Recent" href="/api-reference/tokens/v2/recent" icon="file-lines">
    Returns an array of mints that recently had their **first created pool**
  </Card>
</CardGroup>

**Content**

<CardGroup>
  <Card title="Get Content" href="/api-reference/tokens/v2/get-content" icon="file-lines">
    Get content for multiple mints
  </Card>

  <Card title="Get Content Cooking" href="/api-reference/tokens/v2/get-content-cooking" icon="file-lines">
    Get content for trending tokens
  </Card>

  <Card title="Get Content Feed" href="/api-reference/tokens/v2/get-content-feed" icon="file-lines">
    Get paginated content feed
  </Card>
</CardGroup>


# Category
Source: https://dev.jup.ag/api-reference/tokens/v2/category

openapi-spec/tokens/v2/tokens.yaml get /{category}/{interval}
Returns an array of mints and their information for the given category and interval



# Get Content
Source: https://dev.jup.ag/api-reference/tokens/v2/get-content

openapi-spec/content/content.yaml get /content
Retrieves approved content for up to 50 Solana token mint addresses



# Get Content Cooking
Source: https://dev.jup.ag/api-reference/tokens/v2/get-content-cooking

openapi-spec/content/content.yaml get /content/cooking
Retrieves approved content for currently trending tokens on Jupiter



# Get Content Feed
Source: https://dev.jup.ag/api-reference/tokens/v2/get-content-feed

openapi-spec/content/content.yaml get /content/feed
Retrieves a paginated feed of content for a specific mint



# Recent
Source: https://dev.jup.ag/api-reference/tokens/v2/recent

openapi-spec/tokens/v2/tokens.yaml get /recent
Returns an array of mints that recently had their first created pool



# Search
Source: https://dev.jup.ag/api-reference/tokens/v2/search

openapi-spec/tokens/v2/tokens.yaml get /search
Request a search by token's symbol, name or mint address



# Tag
Source: https://dev.jup.ag/api-reference/tokens/v2/tag

openapi-spec/tokens/v2/tokens.yaml get /tag
Request an array of mints and their information by a tag



# Trigger API
Source: https://dev.jup.ag/api-reference/trigger

Endpoints for creating, executing, and canceling limit orders.

<CardGroup>
  <Card title="createOrder" href="/api-reference/trigger/create-order" icon="file-lines">
    Request for a base64-encoded unsigned trigger order creation transaction to be used in `POST /trigger/v1/execute`
  </Card>

  <Card title="execute" href="/api-reference/trigger/execute" icon="file-lines">
    Execute the signed transaction and get the execution status
  </Card>

  <Card title="cancelOrder" href="/api-reference/trigger/cancel-order" icon="file-lines">
    Request for a base64-encoded unsigned trigger order cancellation transaction to be used in `POST /trigger/v1/execute`
  </Card>

  <Card title="cancelOrders" href="/api-reference/trigger/cancel-orders" icon="file-lines">
    Request for a base64-encoded unsigned trigger order cancellation transaction(s) to be used in `POST /trigger/v1/execute`
  </Card>

  <Card title="getTriggerOrders" href="/api-reference/trigger/get-trigger-orders" icon="file-lines">
    Request for the active or historical orders associated to the provided account
  </Card>
</CardGroup>


# Cancel Order
Source: https://dev.jup.ag/api-reference/trigger/cancel-order

openapi-spec/trigger/trigger.yaml post /cancelOrder
Request for a base64-encoded unsigned trigger order cancellation transaction to be used in POST /trigger/v1/execute



# Cancel Orders
Source: https://dev.jup.ag/api-reference/trigger/cancel-orders

openapi-spec/trigger/trigger.yaml post /cancelOrders
Request for a base64-encoded unsigned trigger order cancellation transaction(s) to be used in POST /trigger/v1/execute



# Create Order
Source: https://dev.jup.ag/api-reference/trigger/create-order

openapi-spec/trigger/trigger.yaml post /createOrder
Request for a base64-encoded unsigned trigger order creation transaction to be used in POST /trigger/v1/execute



# Execute
Source: https://dev.jup.ag/api-reference/trigger/execute

openapi-spec/trigger/trigger.yaml post /execute
Execute the signed transaction and get the execution status

<Info>
  **NOTE**

  * Do note that the `requestId` is found in the response of `/createOrder` or `/cancelOrder`
</Info>


# Get Trigger Orders
Source: https://dev.jup.ag/api-reference/trigger/get-trigger-orders

openapi-spec/trigger/trigger.yaml get /getTriggerOrders
Request for the active or historical orders associated to the provided account



# Ultra Swap API
Source: https://dev.jup.ag/api-reference/ultra

Endpoints for quotes, execution, token search, holdings, and security checks.

<CardGroup>
  <Card title="order" href="/api-reference/ultra/order" icon="file-lines">
    Request for a base64-encoded unsigned swap transaction to be used in `POST /ultra/v1/execute`
  </Card>

  <Card title="execute" href="/api-reference/ultra/execute" icon="file-lines">
    Execute the signed transaction and get the execution status
  </Card>

  <Card title="holdings" href="/api-reference/ultra/holdings" icon="file-lines">
    Request for token balances of an account
  </Card>

  <Card title="shield" href="/api-reference/ultra/shield" icon="file-lines">
    Request for token information and warnings of mints
  </Card>

  <Card title="balances (deprecated)" href="/api-reference/ultra/balances" icon="file-lines">
    Request for token balances of an account
  </Card>

  <Card title="search" href="/api-reference/ultra/search" icon="file-lines">
    Request a search by token's symbol, name or mint address
  </Card>

  <Card title="routers" href="/api-reference/ultra/routers" icon="file-lines">
    Request for the list of routers available in the routing engine of Ultra Swap, which is [Juno](/docs/routing#juno-liquidity-engine)
  </Card>
</CardGroup>


# Get Balances
Source: https://dev.jup.ag/api-reference/ultra/balances

openapi-spec/ultra/ultra.yaml get /balances/{address}
Request for token balances of an account (Deprecated - use /holdings instead)



# Execute
Source: https://dev.jup.ag/api-reference/ultra/execute

openapi-spec/ultra/ultra.yaml post /execute
Execute the signed transaction and get the execution status

<Info>
  **NOTE**

  * The `requestId` is found in the response of `/order`
</Info>


# Get Holdings
Source: https://dev.jup.ag/api-reference/ultra/holdings

openapi-spec/ultra/ultra.yaml get /holdings/{address}
Request for token balances of an account including token account information



# Get Order
Source: https://dev.jup.ag/api-reference/ultra/order

openapi-spec/ultra/ultra.yaml get /order
Request for a base64-encoded unsigned swap transaction to be used in POST /ultra/v1/execute



# Get Routers
Source: https://dev.jup.ag/api-reference/ultra/routers

openapi-spec/ultra/ultra.yaml get /order/routers
Request for the list of routers available in the routing engine of Ultra



# Search Token
Source: https://dev.jup.ag/api-reference/ultra/search

openapi-spec/ultra/ultra.yaml get /search
Request a search by token's symbol, name or mint address



# Get Shield
Source: https://dev.jup.ag/api-reference/ultra/shield

openapi-spec/ultra/ultra.yaml get /shield
Request for token information and warnings of mints



# Overview
Source: https://dev.jup.ag/blog/index

Technical deep dives into Jupiter products, team's research and learnings

<Card title="Ultra vs Metis: Execution Engine or Routing Primitive" href="/blog/ultra-vs-metis">
  Should you integrate Ultra or Metis? A technical comparison between Jupiter's Swap APIs offering
  both execution engine or routing primitive options. Find out which one is right for you.

  <div>
    <span>
      Swap
    </span>

    <span>Jan 16, 2026</span>
  </div>
</Card>

<div>
  <div />
</div>

<Columns>
  <Card title="600 Lines of Code Nobody Asked For" href="/blog/why-ultra-v3">
    Better execution, zero infrastructure, faster shipping. Why teams should just use Ultra V3.

    <div>
      <span>
        Swap
      </span>

      <span>Nov 12, 2025</span>
    </div>
  </Card>

  <Card title="Ultra V3: The Ultimate Trading Engine" href="/blog/ultra-v3">
    A technical deep dive into Jupiter's most comprehensive trading engine, Ultra V3,
    featuring exclusive new capabilities: Iris, Jupiter Beam, and Predictive Execution.
    Learn how it redefines swap execution and brings major improvements across every
    aspect that matters.

    <div>
      <span>
        Swap
      </span>

      <span>Oct 15, 2025</span>
    </div>
  </Card>
</Columns>

<Columns>
  <Card title="Metis v7" href="/blog/metis-v7">
    Metis is now an independent public good at metis.builders with a new access model for v7. This separation
    establishes Metis as a standalone instruction-level swap primitive for builders who need full control
    over transaction execution. Additionally, Metis Binary moving forward will require authenticated access
    with a staked JUP requirement.

    <div>
      <span>
        Swap
      </span>

      <span>Nov 17, 2025</span>
    </div>
  </Card>

  <Card title="More Articles Coming Soon" href="/resources/support">
    Stay tuned for more technical insights and updates from Jupiter
  </Card>
</Columns>


# Metis v7: Migration to Metis.builders
Source: https://dev.jup.ag/blog/metis-v7

Metis is now an independent public good at metis.builders with a new access model for v7. This separation establishes Metis as a standalone instruction-level swap primitive for builders who need full control over transaction execution. Additionally, Metis Binary moving forward will require authenticated access with a staked JUP requirement.

<img alt="Metis v7" />

Today, we are sharing the coming release of Metis v7 router and its transition to an independent public good under [metis.builders](https://metis.builders).

With Metis v7 no longer serving as Jupiter's primary and sole router, we are formally separating Metis from the Jupiter umbrella. As Metis continues to be prevalent and crucial for the ecosystem, we will continue to provide best-effort support and maintenance for it.

In this post, we will be introducing changes to how Metis will be operated, how to access it, and we need your feedback.

## METIS v7

Metis is a low-level swap primitive that provides granular control over the entire transaction, designed for builders who require full authority. Metis is a decoupled toolkit offering three core components:

<Card>
  * **Core Routing Intelligence**: Calculates the optimal route plan based on real-time market data
  * **Raw Instruction-Level Payloads**: Returns raw instructions instead of a locked, pre-built transaction
  * **Total Composability**: Add custom instructions, modify accounts, or call Metis from inside any on-chain program (CPI)
</Card>

This v7 release delivers key improvements to the engine, with new liquidity integrations, critical performance optimizations, and new routing algorithms.

<Card>
  * **Just-in-Time (JIT) aggregation**: Allows the router to compare multiple Prop AMMs directly on-chain at the moment of execution to pick the absolute best-quoting venue
  * **Liquidity Expansion**: Expanded coverage to include 60+ liquidity venues. We will release more as they become available
  * **Brent Op Splitting**: Re-engineered splitting algorithm from GGS to Brent Op Splitting, allowing the router to find more efficient paths by splitting trades with hyper-granularity (down to 1 BPS precision) without sacrificing speed
</Card>

## BREAKING OUT METIS FROM JUPITER

Since 2021, Metis has been made available to builders in the ecosystem with the intention of having it function independently of Jupiter as a public good.
The separation is essential for three reasons:

<Card>
  * Firstly, Jupiter Ultra already utilizes multiple routers to power the platform, so we in essence drive volumes to all routers, not just Metis.
  * Secondly, we've seen Metis quotes being labeled as "Jupiter quotes" across the ecosystem. While this may not always be intentional, it's inaccurate: Jupiter now runs on Ultra's execution engine, which includes our proprietary RFQ system, multi-router aggregation, and features specifically built for end-to-end performance - none of which Metis provides.
  * Thirdly, Jupiter itself has already expanded far more than a router into a DeFi super app encompassing Perps, Wallet, Prediction Markets, amongst many other products. It is important for us that we have a clear messaging moving forward.
</Card>

As such, we are formally transitioning Metis into an independent public good, separating from the Jupiter umbrella - living entirely under the domain of [metis.builders](https://metis.builders)

## ACCESSING METIS

Moving forward, to maintain a stable and performative public good, Metis v7 will require authenticated access. Integrators will need to request for an API or Binary Key, and subject to our [Terms & Conditions](https://metis.builders/sdk-and-api-license-agreement).

### API Access

Metis will offer 2 types of interfaces: either via a hosted API, or by self-hosting the API Binary. In the coming months, we are planning to port over our "Legacy Swap API" under the Metis umbrella, providing a hosted API interface. This will bring cohesiveness and allow for better accessibility to the Metis engine, helping developers to quickstart via a simple Metis API request.

We will be finalizing the plan for the hosted Metis API and will share more on this at a later date.

### Binary Access

The Self-Hosted Binary is now the Metis Binary. The new site at [metis.builders](https://metis.builders) will house all Metis documentation and Binary Key request form. Access to Metis Binary will require a Binary Key, which can be requested at [portal.metis.builders](https://portal.metis.builders). To prevent spam, the Binary Key will only be distributed based on the requirement of 10,000 staked JUP. Each Binary Key provides access to an instance of the Metis Binary.

Current Metis Binary integrators will have a one-month window to migrate from the day of release, after which any version before v7 will be completely deprecated and will stop working. All integrations of the new v7 Metis Binary must accurately identify and label it as Metis, and comply with our [terms of use](https://metis.builders/sdk-and-api-license-agreement).

<Card>
  To access:

  * Request Binary Key at [portal.metis.builders](https://portal.metis.builders)
  * Describe what you're building
  * Receive your key (contingent on the staked JUP requirement)
</Card>

## When METIS, When ULTRA?

**Use METIS when**:

* You need full control over transaction execution
* You're building custom on-chain programs that require swap functionality (CPI)
* You want to set your own priority fees, slippage, and DEX filters
* You need to modify instructions or add custom logic
* You're managing your own RPC infrastructure and transaction broadcasting

**Use ULTRA when**:

* You want Jupiter to handle everything end-to-end
* You need maximum sandwich protection (34x better)
* You want the lowest execution fees (8-10x lower)
* You want industry-leading performance without managing complexity
* You need quotes aggregated across multiple routers with automated execution and error handling

## TLDR

Metis v7 is launching with expanded integrations and routing improvements as it moves to its own home at [metis.builders](https://metis.builders). Since Jupiter is now powered end-to-end by Ultra, separating Metis helps avoid confusion and sets clear expectations. Metis v7 will continue to receive best-effort support, while new development focuses on Ultra. Metis remains the flexible, instruction-level swap primitive for builders who need full control.


# Ultra V3: The Ultimate Trading Engine
Source: https://dev.jup.ag/blog/ultra-v3

A technical deep dive into Jupiter's most comprehensive trading engine, featuring exclusive new capabilities: Iris, Jupiter Beam, Predictive Execution and more.

<img alt="Ultra Swap V3" />

Ultra V3 is the culmination of months of infrastructure work, algorithm optimization, and real-world
testing in production. This release introduces Iris, Jupiter Beam, Predictive Execution, and more - fundamentally
transforming swap execution with measurable improvements at every level - resulting in the Best Price, Best Execution
and Best Protection.

***

## Improved Routers in Meta Aggregation

Ultra uses meta aggregation to compare and aggregate quotes from various liquidity sources such as
our own routers like Iris and JupiterZ, and 3rd party routers like Dflow, Hashflow, and OKX to find
you the best pricing from various liquidity sources.

<Card title="Iris: Algorithm and Splitting Improvements">
  Meet Iris! Our new router exclusive to Jupiter Ultra, designed for better price and routing
  performance.

  * Iris now utilzies better routing algorithms like [Golden-section](https://en.wikipedia.org/wiki/Golden-section_search)
    and [Brent's method](https://en.wikipedia.org/wiki/Brent%27s_method).
  * Iris uses Brent's method to optimize route splitting
  * Iris is now capable of more granular splitting, **up to 0.01%**.

  We are seeing **100x performance improvements** with these changes compared to our sunsetted Metis router.
</Card>

<Card title="JupiterZ: Growing Volume">
  JupiterZ is our own RFQ engine exclusive to Jupiter Ultra.

  * JupiterZ now facilitates **\~\$100M daily volume** with zero slippage.
  * All of the volume is **executed with zero slippage**.

  We are also working on new improvements for JupiterZ, stay tuned for more updates!
</Card>

***

## Maximising Executed Price

A problem often overlooked is the lack of comparison between **Executed Price versus Quoted Price**.
When a quote is provided, it does not necessarily represent the actual executed price.

In today's Solana DeFi landscape dominated by Proprietary (Prop) AMMs, these two numbers are increasingly
divergent. Consider this scenario:

| Route                         | Quoted Amount | Executed Amount | Slippage (Amount) | Slippage (%) |
| ----------------------------- | ------------- | --------------- | ----------------- | ------------ |
| **Route A (Traditional AMM)** | 100 tokens    | 80 tokens       | 20 tokens         | 20%          |
| **Route B (Prop AMM)**        | 150 tokens    | 50 tokens       | 100 tokens        | 66%          |

Route B shows a 50% better quote, but Route A delivers 60% more tokens to your wallet. This is why
quote comparison between platforms is fundamentally misleading. With Ultra V3, we are accounting for
slippage when deciding which AMM to use to ensure that the provided quotes reflect actual on-chain
execution, not theoretical best cases or inflated "best prices".

### Ultra Signaling

Ultra V3 introduces **Ultra Signaling**, a mechanism built directly on-chain in our Jupiter Aggregator
Program that allows Prop AMMs to distinguish between different types of user flow when submitting quotes
to Ultra. With Ultra Signaling, Prop AMMs can identify which requests originate from Ultra and are thus
able to differentiate between "non-toxic" and "toxic" order flow when quoting.

* **Non-toxic flow** in this context refers to trades initiated by Ultra that are unlikely to be
  exploited by malicious practices like sandwiching or frontrunning. Since, these trades are seen as
  more "genuine" and less likely to adversely affect the AMM's profit, Prop AMMs are incentivized to
  offer more competitive, tighter pricing to these trades.

* **Toxic flow** typically comes from sources outside of Ultra (as seen from [MEV-Protection](#mev-protection))
  and may include trades that are more susceptible to MEV opportunities. Since these trades carry
  more risk for Prop AMMs, they are generally quoted with wider spreads or less favorable prices.

<Card title="Impact">
  By signaling to Prop AMMs that a user is coming through Ultra (and, therefore, more protected
  from MEV or sandwich attacks), Prop AMMs can confidently provide their best possible quotes
  without the heightened risk associated with toxic order flow. This results in Ultra users
  consistently getting better, more reliable prices compared to other platforms, as the risk profile
  for their transactions is demonstrably lower.

  One of the Prop AMMs we are working with, is now **quoting 3 bps tighter (50% better)** for our Ultra
  users compared to other platforms.
</Card>

### Predictive Execution

Ultra V3 introduces **Predictive Execution** for every route before execution:

1. Aggregated routers return their best quotes.
2. Simulating quotes on-chain to verify actual executed price vs quoted price.
3. Predicting potential slippage for each route, and dynamically prioritizing the route with the
   least overall incurred slippage at the time of execution.

<Card title="Result">
  Since deployment of Predictive Execution in production, we have seen great results in terms of
  slippage protection for our users. Using the volume weighted average of the difference between
  executed slippage and quoted for the past 7 days:

  * Jupiter Ultra provided swaps on average with - **positive slippage of +0.63 bps**.
  * Despite market volatility on 11 Oct 2025, we manage to maintain on average - **above negative
    slippage of -10 bps**

  <img alt="Volume Weighted Average Difference between Executed Slippage and Quoted Slippage" />

  <div>
    <span>
      Source: Jupiter Internal Monitoring
    </span>

    <span>Oct 7 - Oct 14, 2025</span>
  </div>
</Card>

## Sub-Second Transaction Landing

Every block your transaction waits, is an exposure to poorer executed price, such as market
movement against your position, increased effective slippage, and a higher risk of MEV extraction
opportunities.

**Meet Jupiter Beam!** Our in-house transaction landing engine - leveraging our own validator stake
and dedicated R\&D efforts from our newly formed RPC team, led by Italo and team members who have
contributed to Yellowstone-gRPC, NFT DAS API, Lite-RPC, Agave, and more.

Thanks to their massive efforts, Jupiter Beam consistently processes transactions within sub-second
latency and by operating entirely on our own infrastructure instead of relying on external providers,
we eliminate the risk of artificial delays and front-running, ensuring faster and more secure execution
for our users.

### Transaction Landing Latency

<Card title="Result: 50-66% Faster Transaction Landing">
  Transaction landing latency has improved by 50-66% compared with our previous approach that
  relied on multiple providers.

  | Method                  | Blocks     | Latency         |
  | ----------------------- | ---------- | --------------- |
  | **Jupiter Beam**        | 0-1 block  | \~ 50ms - 400ms |
  | **Traditional methods** | 1-3 blocks | \~ 400ms - 1.2s |
</Card>

### MEV Protection

When using other providers, there is always a risk of front-running and sandwich attacks - as the trades
may be sold to third-party MEV searchers.

Ultra V3 does the opposite. Since we are using our own infrastructure to send transactions via Jupiter Beam,
we are able to minimize the exposure to susceptible MEV risks by ensuring trades are never handed off to
any external providers for on-chain execution.

<Note>
  The risk is not zero as validators still broadcast to the leader, but Ultra brings it as close to zero
  as possible.
</Note>

<Card title="Result: 34x Better than Top Trading Terminals" href="https://sandwiched.me/sandwiches">
  Jupiter Ultra's swap volume to value extracted ratio is significantly lower than others despite
  higher volume, demonstrating the effectiveness of our efforts to bring the best executed price
  to our users.

  By comparing Jupiter Ultra's volume to value extracted ratio to other top trading terminals,
  we are able to see that Jupiter Ultra is 34x better than the top trading terminals.

  <div>
    <span>
      Source: Sandwiched.me
    </span>

    <span>Oct 15, 2025</span>
  </div>
</Card>

## Real-Time Slippage Estimator

Setting the right slippage can be tricky — whether you're dealing with volatile tokens,
stablecoins, or large caps, it's never a one-size-fits-all scenario. This uncertainty
impacts everyone, from newcomers in DeFi to seasoned traders.

Since the inception of RTSE (Real-Time Slippage Estimator), we have been monitoring
real-time market data and transactions, and applying token-specific heuristics and
algorithms to improve the slippage protection for our users. With Ultra V3, we have made
strides by implementing the following improvements:

* **Tighter RTSE slippage heuristics** while maintaining high success rates and reduce overpaying.
* **Automatic prioritization** of slippage-protected routes over purely price-optimized routes.
* **Increased volatility sensitivity** for tokens with high historical volatility patterns.

## Gasless Support Coverage

With Gasless Support acting as a just-in-time fee payer, you can make trades without holding SOL
to cover gas fees - as long as at least one of the tokens in your trade meets the minimum value
requirement, Ultra automatically calculates and covers the gas fee, deducting it from the swap amount.

With Ultra V3, we have expanded gasless support coverage:

* Token2022 tokens
* Memecoin-to-memecoin swaps (when liquidity permits)
* Reduced minimum trade size to \~\$10 USD

Gasless Support will continue to improve over time.

<Note>
  JupiterZ by default is gasless, as the market maker is the fee payer for the transaction!
</Note>

## Just-In-Time Market Revival

Ultra V3 solves a long-standing technical limitation which is to provide routes for tokens that
have "fallen out of favor" - When markets have low liquidity or yet to graduate for a long time,
we downgrade these markets to optimize resource allocation. This makes them unroutable, preventing
users to enter or exit their positions.

To address this, we have implemented a Just-In-Time market Revival Mechanism that **dynamically
re-indexes token markets on-demand**.

<Card title="Impact">
  * Routes virtually any token on Solana, including extremely long-tail assets.
  * Supports old, inactive tokens that historically failed to route.
  * Essentially, no minimum liquidity threshold for token eligibility.
</Card>

## Pre-Graduation Routing Latency Reduction

By default, for all swap pairs, Jupiter Ultra checks for multiple route paths to get the best
price. This adds to quote latency.

To further enhance the trading experience for trenchers, we have optimized the routing logic for
all pre-graduated bonding curve markets when applicable.

* When the swap pair involves a pre-graduated token and SOL or USDC.
* We skip multi-route aggregation and look for the direct route immediately.

<Card title="Result">
  Pre-graduated bonding curve markets routing latency has been **reduced by 90%+**.

  |        | Average Quote Latency | Routing Method                          |
  | ------ | --------------------- | --------------------------------------- |
  | Before | 200ms                 | Checking multiple potential routes      |
  | After  | 10-15ms               | Direct routing to pre-graduated markets |
</Card>

## Legacy Jupiter Swap

As part of this upgrade, moving forward, we will be focusing our efforts on the ongoing development
and improvement of Ultra V3 with our new router, Iris. We are also rolling out the Ultra API to allow
our partners to utilize the best-in-class routing, execution and transaction landing infrastructure
behind Ultra V3.

Currently, many meta aggregation platforms and others are still using our sunsetted Jupiter Legacy API (Metis)
or deprecated Self-hosted Legacy Swap API binary. We will be working with them to upgrade their routing to
adopt the new Ultra API.

If you are using Jupiter Legacy API in your app, please correctly label to avoid misleading your users that
this is the best price from Jupiter. In particular, certain apps are using the free binary, which is deprecated
and we have no control over the results, and it is very discouraging to see certain platforms abuse something that
we have offered to the ecosystem for free for years.

## Summary

Ultra is more than just a swap - it's an abstraction layer over the challenges of execution and
blockchain complexity:

**For end users:** No need to understand slippage settings, gas fees, RPC selection, or MEV
protection. Ultra handles everything.

**For developers:** The exact same Ultra infrastructure that powers jup.ag's UI is also available
to developers via API. No need to build, host, or maintain your own RPC, transaction landing
infrastructure and manage other trading optimizations. For more information, please refer to
the [Ultra Swap Docs](/docs/ultra).

<Note>
  All of the improvements mentioned in this blog post are exclusive to Ultra only.\
  They are not present in Legacy Swap API.
</Note>

Ultra V3 demonstrates that the best execution isn't about finding the best quote - it's about
delivering the best outcome. Through rigorous measurement, continuous optimization, and proprietary
infrastructure, we've built a system that consistently outperforms on the metrics that actually
matter - the data speaks for itself.

Just use Jupiter.


# Ultra vs Metis: Execution Engine or Routing Primitive
Source: https://dev.jup.ag/blog/ultra-vs-metis

A technical comparison between Jupiter's Swap APIs offering both execution engine or routing primitive options.

<img alt="Ultra vs Metis: Execution Engine or Routing Primitive" />

This technical comparison will break down the differences between the Jupiter's Swap APIs:
Ultra and Metis - One is an execution engine, the other is a routing primitive. Both offering
very different features and use cases.

***

## The Short Answer

**Just Integrate Ultra.**

TL;DR: Ultra is a complete execution engine for teams that want to ship fast.
Metis is a routing primitive for teams that need CPI, custom instructions, or full
infrastructure control.

1. You need CPI (Cross Program Invocation) to call swaps from your on-chain program
2. You need to add custom instructions to the transaction
3. You need complete control over your infrastructure

If none of those apply, Ultra is the answer. Close this tab. [Go build](/docs/ultra).

Still here? Let's find out which one is right for you.

***

## The Vehicle Analogy

Imagine two ways to get a high-performance driving experience:

**Option 1: The Complete Performance Vehicle (Ultra)**

You get a fully-built car where every component has been engineered together. The engine's
power curve matches the transmission's gear ratios. The suspension is tuned for the tire
compound. The aerodynamics complement the drivetrain. This integration comes from years of
testing, telemetry data, and iteration.

You don't choose the engine or modify the chassis, but you don't need to. You turn the key
and experience performance that took a team of engineers years to perfect. You focus on
where you're going, not how the car gets you there.

**Option 2: The Racing Engine (Metis)**

You get an engine built with years of research: optimized combustion, proven reliability,
power delivery refined across thousands of builds. It's a powerplant in the truest sense.

But it's a component, not a complete vehicle. Install it in a sports car if you need speed.
Mount it in an off-road truck if you need durability. Build a custom racing machine around it.
The engine is production-grade, but the vehicle you build around it, the chassis, the drivetrain,
the purpose, that's your innovation.

***

**Ultra and Metis weren't designed to compete, but to serve different types of builders. The
real question is: which one fits what you're building?**

***

## Understanding the Architectural Divide

The difference between Ultra API and Metis API isn't just about features. It's a fundamental
difference in philosophy.

**Metis** gives you a widely adopted, battle-tested routing primitive in the ecosystem. It
trusts you to orchestrate everything else: transaction sending, polling, execution, slippage
strategies, priority fees, and more.

**Ultra** provides an end-to-end execution engine that handles the complexity of modern DeFi
infrastructure so you can focus on your product. It includes a proprietary RFQ system,
multi-router aggregation, and features built for execution quality.

Let's break down what this means across four critical dimensions.

1. [Routing Engines: Meta-aggregated vs. Single Routing Primitive](#routing-engines)
2. [Execution Model: Integrated Engine vs. Routing Primitive](#execution-model)
3. [Configuration Layer: Optimized & Opinionated vs. Flexible Control](#configuration-layer)
4. [Operational Realities: Managed Service vs. Self-Service](#operational-realities)

***

## Routing Engines

**Meta-Aggregated vs. Single Routing Primitive**

Ultra meta-aggregates multiple routing engines, including Iris (an enhanced version of Metis),
DFlow, OKX, and JupiterZ RFQ, to find the best execution path across all available liquidity
sources. Metis is the battle-tested, single routing primitive that powers many applications
across Solana and serves as the foundation for Ultra's Iris engine.

| Aspect                | Ultra API                                                                                                                                                                 | Metis API                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Architecture**      | Meta-aggregator combining:<br /><br />- Iris (enhanced Metis with new features and self-learning capabilities)<br />- DFlow<br />- OKX<br />- JupiterZ (RFQ with 20+ MMs) | Single, proven routing engine for on-chain liquidity               |
| **RFQ Access**        | Built-in access to JupiterZ with 20+ market makers                                                                                                                        | Not supported                                                      |
| **Liquidity Sources** | Aggregates across multiple aggregators and RFQ networks                                                                                                                   | Direct access to Solana's on-chain liquidity via optimized routing |

<Info>
  Iris is an enhanced version of Metis, it is built with the learnings and experiences of Metis,
  with one single objective - to ensure the best possible execution price and success rate across
  all engines and liquidity sources.

  Iris includes self-learning capabilities to maintain high availability of competitive routes while
  automatically sidelining underperforming or potentially problematic quotes; and features such as

  * [Ultra Signaling](/blog/ultra-v3#ultra-signaling) to allow PropAMMs to quote tighter for Ultra's non-toxic flow,
  * [Predictive Execution](/blog/ultra-v3#predictive-execution) to predict slippage and select route with best execution outcome,
  * [Just-In-Time Market Revival](/blog/ultra-v3#just-in-time-market-revival) to trade all markets (unrestricted by [Metis' market grace period](/docs/routing/market-listing))
  * And more.
</Info>

**What this means:**

* Ultra's meta-aggregation automatically finds the best price across multiple routing engines and
  RFQ sources. Features are actively developed and deployed to improve execution quality without
  any changes to your integration.
* Metis provides direct access to Solana's on-chain liquidity through a focused, battle-tested
  routing engine, giving you the foundation to build your own infrastructure and use it to your
  advantage.

## Execution Model

**Integrated Engine vs. Routing Primitive**

Getting a quote is only the beginning. Consistently high-quality successful swaps
require transaction construction, execution pipelines, priority fee optimization,
confirmation polling, and error handling. Ultra manages this entire execution pipeline as an integrated
system. Metis provides routing intelligence as a primitive, expecting you to build the execution
infrastructure around it. This choice determines your engineering investment, operational complexity,
and degree of control over execution quality.

| Aspect                             | Ultra API                                                                                                                        | Metis API                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Usage**                          | Complete execution engine — get order, sign, submit to execute endpoint                                                          | Provides routing and quote — you handle execution infrastructure |
| **Transaction Sending**            | Jupiter Beam handles submission via network of in-house transaction senders, resulting in lowest latency and best MEV protection | You build and maintain your own RPC pipeline                     |
| **Landing Performance**            | 50-400ms average via Jupiter Beam proprietary engine                                                                             | Varies based on your priority fee optimization                   |
| **Transaction Polling**            | Built-in status polling with intelligent error handling                                                                          | You implement polling logic and parse on-chain program errors    |
| **Execution Latency (End-to-end)** | P95 \< 1000ms (400-600ms average), includes polling                                                                              | Entirely dependent on your infrastructure quality                |
| **RPC Requirements**               | None! Jupiter provisions and maintains all infrastructure                                                                        | You provision and pay for RPC access                             |
| **MEV Protection**                 | Industry-lowest MEV attack rate (verifiable at [sandwiched.me](https://sandwiched.me)) despite highest swap volume               | Your infrastructure choices determine MEV exposure               |

**The tradeoff:**

* Ultra eliminates the need for months of infrastructure development and ongoing DevOps overhead,
  letting teams focus on product differentiation and what truly matters while inheriting battle-tested
  execution quality. What jup.ag gets, you get too, without any additional effort.
* Metis gives complete control over the execution stack. You provision, control and maintain your
  own infrastructure. This opens the door to building exactly what you need with optimizations tuned
  to your specific use cases.

<Info>
  Read about what it takes to build your own execution infrastructure in our previous blog
  post on [*600 Lines of Code Nobody Asked For*](/blog/why-ultra-v3).
</Info>

***

## Configuration Layer

**Optimized & Opinionated vs. Flexible Control**

Slippage settings, priority fees, and route selection interact in complex ways. Conservative slippage
reduces MEV risk but increases failure rates, while aggressive fees improve landing speed but can waste
capital. Ultra embeds years of optimization data into automatic parameter tuning that evolves with network
conditions. Metis gives you the routing foundation to build optimization strategies tailored to your
product's specific needs and risk profile.

### Swap Configurations

| Aspect                      | Ultra API                                                                                                                                   | Metis API                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Slippage Optimization**   | RTSE (Real-Time Slippage Estimator), applying heuristics and real-time adjustments based on token categories, historical and real-time data | You configure slippage based on your strategy and risk tolerance |
| **Priority Fee Management** | Using quality RPC and network data to automatically estimate and optimize priority fees to land fast without overpaying                     | You build fee estimation logic tuned to your needs               |

<Info>
  Manual mode in Ultra API is provided to allow explicit control over execution behavior in user-facing manual trading experiences (e.g. similar to the jup.ag frontend), or for personal, self-directed usage where the operator intentionally manages execution trade-offs.

  However, manual mode should NOT be used as a default integration pattern and Ultra is meant to be used as-is and out of the box.
</Info>

**In practice:**

* Ultra's RTSE and automatic optimization increase success rates out of the box. This is the same intelligence
  that powers jup.ag, refined through millions of swaps showing that the vast majority of users (from experienced
  traders to whales to casual users) successfully trade using default settings without manual adjustments.
* Metis delivers raw routing data that you can layer with your own optimization strategies, enabling
  proprietary slippage logic or custom priority fee algorithms that become part of your technical moat.

### Gasless Capabilities

| Aspect                        | Ultra API                                                                                                           | Metis API                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **Default Gasless (Iris)**    | Automatic when user has trade value but insufficient SOL. Jupiter pays tx fee, priority fee, and token account rent | Not supported. You build gasless logic from scratch                      |
| **JupiterZ Gasless**          | Market makers cover tx and priority fees (not token account rent) when routed via RFQ                               | Not supported. Allows you to integrate custom gasless mechanisms         |
| **Integrator as Payer**       | Integrator can be fee payer (Iris quotes only, all gas covered)                                                     | Supported: Integrator as fee payer with full control over implementation |
| **Implementation Complexity** | Zero implementation. Automatic based on quote type                                                                  | You manage gas payer wallet, signer logic, and drain protection          |

**In practice:**

* Ultra provides gasless swaps immediately for most scenarios with automatic edge case handling, eliminating the
  need to build and maintain gasless infrastructure.
* Metis requires you to build the entire gasless implementation, managing gas payer wallets, signer logic, and
  drain protection. This investment enables you to build your own gasless UX patterns, custom sponsor
  logic, or integration with your existing wallet infrastructure in ways an opinionated engine cannot support.

### Transaction Customization

| Aspect                        | Ultra API                                                                | Metis API                                                          |
| ----------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Transaction Customization** | Opinionated: no custom instructions, no CPI, no instruction modification | Full flexibility: add instructions, use for CPI, compose as needed |

**The tradeoff:**

* Ultra's opinionated approach enables streamlined, consistent execution that gives Jupiter complete observability
  across the entire stack. This allows for comprehensive customer support, faster issue resolution, and continuous
  optimization based on aggregated execution data.
* Metis gives you full transaction composition flexibility such as adding custom instructions, integrating via CPI,
  or building transaction structures. Essential for products where the swap is part of a larger onchain
  operation or where transaction-level innovation is core to your value proposition.

***

## Operational Realities

**Managed Service vs. Self-Service**

Production reliability, support, operational overhead and fees involved differ significantly between approaches.

| Aspect                         | Ultra API                                                                                   | Metis API                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Customer Support**           | Jupiter provides direct support to your users via official channels                         | Minimal technical support for integration. You handle user-facing support                                            |
| **Rate Limits**                | Dynamic based on executed volume. Base quota can be increased when requested                | Fixed tiers via portal.jup.ag, no overages                                                                           |
| **Incident Response**          | Can provide P0 direct contact and monitored business chats                                  | status.jup.ag updates, monitored business chats prioritized by severity                                              |
| **Monitoring & Observability** | Same infrastructure as jup.ag, monitored 24/7 with immediate response and logged end-to-end | Self-service status page, you monitor your execution layer and log all API requests end-to-end for support/debugging |
| **Fee Involved**               | Usage incurs swap fees<br /><br />Integrator can earn fees: Referral and Advance Fee        | Usage incurs Portal fees to increase rate limits<br /><br />Integrator can earn fees: Referral                       |

**The tradeoff:**

* Ultra shifts the operational burden to Jupiter, including production-grade observability, incident response, and
  direct user support. Because Ultra enforces opinionated configurations and consistent transaction
  structures, Jupiter can log and monitor all swap executions, enabling comprehensive support for your users without requiring you to build your own.
* Metis requires you to build your own infrastructure for transaction handling, maintain custom monitoring, alerting,
  and support systems. This gives you complete visibility and control over your execution quality, enabling you to
  optimize and differentiate at the infrastructure layer itself.

***

## The Decision Framework

**Ultra API is designed for teams that:**

* Want to focus on product differentiation rather than infrastructure
* Value battle-tested execution quality and optimization out of the box
* Prefer operational/technical and customer support from Jupiter
* Want to iterate quickly on user experience

**Metis API is designed for teams that:**

* Need transaction-level customization (CPI, custom instructions, novel compositions)
* Want full control over fee monetization with no mandatory splits
* Have existing RPC and execution infrastructure they want to leverage
* Are building execution infrastructure as a core competitive advantage
* Need integration flexibility that an opinionated engine cannot provide
* Want to innovate on execution quality itself, not just user experience

***

## Questions We Often Get

> **"Metis gives better prices because I can optimize myself"**\
> Ultra aggregates more liquidity sources (Iris, JupiterZ, DFlow, OKX). Specifically Iris is an enhanced version of
> Metis with features like Ultra Signaling for PropAMMs, Predictive Execution, Just-In-Time Market Revival, and more.
> You're competing against systems trained on billions in daily volume. The data shows Ultra delivers better executed
> prices, not just quoted prices.

> **"I need Metis for lower latency"**\
> Ultra's `/order` endpoint averages around 300ms. The extra time is spent on simulations, slippage estimation, and
> optimizations that result in better execution. Raw quote speed doesn't matter if your transaction fails or gets sandwiched.
> Transaction landing latency is 50-400ms for Ultra via Jupiter Beam.

> **"Ultra takes a swap fee, Metis or API-reseller providers don't"**\
> Ultra's platform fee is the lowest in the industry at 5-10 bps. The fee pays for Jupiter's own infrastructure and scale. You get
> the best possible execution quality out of the box, plus all improvements and optimizations based on millions of swap data and
> user feedback that are continuously implemented directly into Ultra. Otherwise, you'd have to build your own infrastructure and
> maintain it.

> **"I can add my own MEV protection"**\
> Unless you have your own validator stake and transaction landing infrastructure, you're using what everyone else is using. Ultra
> uses Jupiter Beam on Jupiter's own infrastructure. [The data is public](https://sandwiched.me/sandwiches): Ultra has the lowest
> value extraction ratio despite the highest volume.

## Summary: Two Tools, Two Visions

Ultra and Metis represent different strategic choices, not different quality levels.

**Ultra is an end-to-end execution engine**

* You focus on building the best user experience and product differentiation. We handle the infrastructure to provide battle-tested performance and zero overhead.
* You get an integrated execution engine where routing (Iris + aggregators + JupiterZ RFQ), optimization (RTSE for slippage, automatic priority fees), transaction execution (Jupiter Beam), and operational support all work together as a unified system.
* You inherit Jupiter's continuously evolving intelligence, refined by millions of swaps across jup.ag and API integrations, with improvements automatically deployed to your integration.

**Metis is a routing primitive**

* You build your own execution infrastructure, leveraging Jupiter's proven routing engine as a foundational primitive for your own use cases.
* You control the execution layer (your RPC infrastructure, transaction sending, polling), the optimization layer (slippage logic, priority fee estimation, MEV protection), and the transaction structure (custom instructions, CPI composition).
* You trade Jupiter's automatic optimizations for the freedom to build execution infrastructure that becomes your competitive differentiator.

Both approaches power successful applications. Both represent years of Jupiter's research, development and user feedback. The right choice depends on what you're building and how much infrastructure you want to own.

***

## Resources

For complete technical specifications, integration guides, and API references:

* **[Ultra API Documentation](/docs/ultra)**
* **[Metis API Documentation](/docs/swap)**

Talk to us:

* Discord: [discord.gg/jup](https://discord.gg/jup)
* Twitter: [@JupiterExchange](https://twitter.com/JupiterExchange)
* Telegram: [Jupiter Dev Notifications](https://t.me/jup_dev)

Built something? Tag [@JupDevRel](https://x.com/JupDevRel) or [@0xYankee](https://x.com/0xYankee) / [@0xanmol](https://x.com/0xanmol).


# 600 Lines of Code Nobody Asked For
Source: https://dev.jup.ag/blog/why-ultra-v3

Better execution, zero infrastructure, faster shipping. Why teams should just use Ultra V3

<img alt="600 Lines of Code Nobody Asked For" />

Building a wallet? Trading bot? DeFi protocol? Payments app? Doesn't really matter. If you're building in crypto, you probably need swaps.

And you're about to spend 6-9 weeks on infrastructure nobody sees. RPC management. Transaction construction. Slippage optimization. MEV protection.

Or you could call an API. Get better execution for your users and ship your actual product at the same time.

Let's talk about how.

***

## The Uncomfortable Truth

You're maintaining 600+ lines of swap infrastructure right now.

None of it differentiates your product. All of it needs constant maintenance. And here's the uncomfortable part: your users are getting worse execution than they would with 20 lines of API calls.

Your custom implementation is competing against systems trained on \$1B+ daily volume. With dedicated teams optimising every millisecond. Running on validator infrastructure you don't have access to.

That's not a skill issue. It's a scale and infrastructure problem. And we at Jupiter built Ultra V3 so that you don't have to solve it.

***

## The Uncomfortable Truth About Custom Implementations

Let's be direct about what's happening with custom swap implementations.

<Card title="Your Custom Slippage Logic">
  Your custom slippage logic? It's probably worse than what Ultra V3 calculates automatically. You're tuning parameters based on hundreds of trades. Ultra V3 trains on millions of swaps daily. That data gap compounds into better slippage estimates.
</Card>

<Card title="Your RPC Infrastructure">
  Unless you're pooling connections across multiple providers with real-time health checks and automatic failovers, you're accepting worse reliability and slower execution.
</Card>

<Card title="Your MEV Protection">
  If you're using standard RPC providers, your transactions can be observed and attacked before execution. The data is clear: Ultra V3 provides **34x better protection** against value extraction compared to traditional methods.

  Source: [sandwiched.me](https://sandwiched.me), Oct 15, 2025
</Card>

<Card title="Your Execution Quality">
  While you're hoping your quote matches reality, Ultra V3 is simulating every route on-chain before execution and consistently delivering positive slippage (+0.63 bps average).
</Card>

This isn't about whether you can build swap infrastructure. It's about whether you should. And for 99% of teams, the answer is no.

***

## Why Teams Keep Building This

Here's a pattern we see constantly: teams build custom swap infrastructure not because their product needs it, but because it's an interesting engineering problem. "We built our own" carries more weight in engineering culture than "we integrated an API." And once you've invested weeks into custom infrastructure, it's hard to step back.

Your users don't care that you built custom RPC failover logic. They care that their swap executes fast, at the price you quoted, without getting sandwiched.

The question isn't "can we build this?" It's "should we build this, or should we ship our actual product faster?"

***

## What Every Dev Gets Wrong About Swap Infrastructure

**Wrong:** "I need custom slippage logic for my use case"\
**Right:** Limited trade volume means limited optimisation data. Jupiter's Real-Time Slippage Estimator (RTSE) is trained on 1B+ daily volume, analyses millions of trades, categorizes tokens automatically, and adapts to volatility in real-time. Hardcoding 1% for stables often means overpaying by 50-90 bps on every trade.

**Wrong:** "I'll just use 1% slippage for safety"\
**Right:** You're either failing transactions when markets move fast or bleeding value with excessive buffers. Ultra V3's RTSE adjusts dynamically: tightens when executions succeed with margin, widens when volatility spikes. Zero configuration required.

**Wrong:** "Custom RPC management gives me more control"\
**Right:** You're trading "control" for execution quality and 600 lines of maintenance. Jupiter Beam runs on Jupiter's own validator stake with direct gRPC connections to leaders. Standard RPC pooling doesn't have access to the same infrastructure advantages.

**Wrong:** "I can optimise for my specific use case"\
**Right:** You're optimising based on your specific trade volume. Jupiter processes \$1B daily across every possible use case, token pair, and market condition. That data compounds into better routing, better slippage estimates, and better execution than you'll achieve in isolation.

**Wrong:** "What if Jupiter goes down?"\
**Right:** What if your RPC provider goes down? You're already trusting infrastructure. The question is whether you trust infrastructure optimised by a team that does nothing but swap infrastructure, or infrastructure you built in a sprint and maintain between feature work.

***

## The Opportunity Cost Nobody Talks About

Building swap infrastructure in 2025 is like building your own CDN in 2015.

You could do it. Some teams should do it. But if swaps aren't your core product, you're making a strategic mistake.

**The teams building swaps as their product have:**

* Dedicated teams for each component (routing, slippage, MEV protection, transaction landing)
* Direct relationships with every liquidity venue
* Their own validator stake
* Years of production data across every market condition

**You have:**

* A sprint's worth of time
* One backend engineer
* A handful of test swaps
* Hope that your RPC provider stays reliable
* Zero visibility into what happens after transaction submission

**Here's the real cost:**

| Time Spent On                | Custom Implementation | With Ultra V3  |
| ---------------------------- | --------------------- | -------------- |
| RPC infrastructure           | 1-2 weeks             | 0              |
| Transaction construction     | 1 week                | 0              |
| Slippage optimization        | 1-2 weeks             | 0              |
| MEV protection research      | 1 week                | 0              |
| Transaction monitoring       | 1 week                | 0              |
| Error handling & retry logic | 1 week                | 0              |
| Ongoing maintenance          | 10-20% of eng time    | 0              |
| **Total to launch**          | **6-9 weeks**         | **1 day**      |
| **Your actual product**      | Still not built       | Actually built |

Focus on building your product, not rebuilding infrastructure that's already been solved.

***

## DevEx Before Ultra V3: The 600-Line Reality

Let's talk about what those 600 lines actually involve, and why you wish they didn't exist.

**RPCs:** Multiple providers because one isn't reliable. Health checks. Automatic failovers. Rate limit handling. Connection pooling for traffic spikes. Over 100 lines just for RPC management. None of it makes your product better. All of it needs constant maintenance and monitoring.

**Transaction construction:** Another 100+ lines. Fetching quotes. Building compute budget instructions. Managing address lookup tables. Configuring account metadata. Priority fees. Versioned transactions. It adds up fast, and every line is maintenance debt.

**Slippage:** Most teams hardcode it. 1% for stables, 5% for volatile tokens, often without real logic behind the numbers. So you either get failed transactions when markets move, or overpay with excessive buffers. Neither feels good explaining to users.

**MEV exposure:** Public RPC mempools mean sandwich attacks and frontrunning. Landing takes 1-3 blocks (400ms-1.2s) on a good day. You're accepting value extraction because you don't have better options.

**Transaction monitoring:** Poll for confirmation. Parse transaction logs. Handle errors. Retry logic. Timeouts. Another 50+ lines of code that's critical but boring.

All of this just to swap tokens. And after building it, you still can't guarantee users get the price you quoted them.

***

## The Solution: \< 20 Lines

Here's what integrating Ultra V3 actually looks like:

```typescript theme={null}
// Requires: @solana/web3.js 

// 1. Get order (quote + transaction)
const orderResponse = await fetch(
  'https://api.jup.ag/ultra/v1/order?' +
  'inputMint=So11111111111111111111111111111111111111112&' +
  'outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&' +
  'amount=100000000&' +
  `taker=${walletAddress}`
);
const order = await orderResponse.json();

// 2. Sign transaction
const transaction = VersionedTransaction.deserialize(
  Buffer.from(order.transaction, 'base64')
);
const signed = await wallet.signTransaction(transaction);

// 3. Execute
const resultResponse = await fetch('https://api.jup.ag/ultra/v1/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    signedTransaction: Buffer.from(signed.serialize()).toString('base64'),
    requestId: order.requestId,
  }),
});
const result = await resultResponse.json();
```

That's it. Not even 20 lines replace the 600.

Everything else, RPC management, transaction construction, slippage optimisation, MEV protection, polling, error handling is handled by Ultra V3.

Your users get better prices without you needing to build and maintain all of that optimisation infrastructure.

We went from "spend weeks building infrastructure we don't want to build" to "call an API and build features users actually care about."

<Card title="What Ultra V3 Handles Automatically">
  * **Aggregation**: Quotes from Jupiter routers + Dflow, OKX through one API call
  * **Route optimisation**: Mathematical algorithms (Golden-section, Brent's method) find optimal splits
  * **Predictive execution**: Simulates routes on-chain before execution to minimise slippage (+0.63 bps average)
  * **MEV protection**: Jupiter Beam runs on Jupiter's validator with 34x better protection than public mempools
  * **Transaction landing**: 0-1 block (50-400ms) vs 1-3 blocks for traditional RPCs
  * **Real-time slippage**: RTSE adapts dynamically based on millions of trades, not hardcoded values
  * **Gasless swaps**: Users don't need SOL for eligible trades (\~\$10 min)
  * **Any token support**: Just-In-Time Market Revival routes virtually any Solana token
  * **Fast execution**: 95% of swaps complete in under 2 seconds
</Card>

***

## Real-World Examples

### Wallet Applications

**What you're building:** In-app swaps without forcing users to external DEXs.

**What you're NOT building:** RPC infrastructure, transaction construction, slippage handling, transaction monitoring.

```typescript theme={null}
// Requires: @solana/web3.js 

// 1. Get user holdings (optional)
const holdingsResponse = await fetch(
  `https://api.jup.ag/ultra/v1/holdings?owner=${walletAddress}`
);
const holdings = await holdingsResponse.json();

// 2. Get order (quote + transaction)
const orderResponse = await fetch(
  `https://api.jup.ag/ultra/v1/order?` +
  `inputMint=${inputToken}&outputMint=${outputToken}&` +
  `amount=${amount}&taker=${walletAddress}`
);
const order = await orderResponse.json();

// 3. Sign transaction
const transaction = VersionedTransaction.deserialize(
  Buffer.from(order.transaction, 'base64')
);
const signed = await wallet.signTransaction(transaction);

// 4. Execute
const resultResponse = await fetch('https://api.jup.ag/ultra/v1/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    signedTransaction: Buffer.from(signed.serialize()).toString('base64'),
    requestId: order.requestId,
  }),
});
const result = await resultResponse.json();
```

The entire flow completes in 1-2.5 seconds without you managing RPCs, building transactions, calculating slippage, or worrying about MEV exposure.

***

### Trading Bots

**What you're building:** Automated trading strategies.

**What you're NOT building:** Slippage optimisation algorithms, execution quality tracking, route comparison logic.

```typescript theme={null}
// Requires: @solana/web3.js 

async function executeTrade(strategy, wallet) {
  // Your strategy logic
  const signal = strategy.generateSignal();
  
  // 1. Get order (quote + transaction)
  const orderResponse = await fetch(
    `https://api.jup.ag/ultra/v1/order?` +
    `inputMint=${signal.fromToken}&` +
    `outputMint=${signal.toToken}&` +
    `amount=${signal.amount}&` +
    `taker=${wallet.publicKey.toString()}`
  );
  const order = await orderResponse.json();
  
  // Predictive Execution already chose best route
  // RTSE calculated optimal slippage
  // Jupiter Beam provides fastest, most private execution
  
  // 2. Sign transaction
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(order.transaction, 'base64')
  );
  const signed = await wallet.signTransaction(transaction);
  
  // 3. Execute
  const resultResponse = await fetch('https://api.jup.ag/ultra/v1/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signedTransaction: Buffer.from(signed.serialize()).toString('base64'),
      requestId: order.requestId,
    }),
  });
  
  return await resultResponse.json();
}
```

Focus entirely on strategy logic while Ultra V3 handles execution optimisation without you writing any infrastructure code.

***

## Conclusion

Just use Jupiter.

***

## Get Started

**Try it now:**\
→ API Key: [portal.jup.ag](https://portal.jup.ag) (free tier available)\
→ Docs: [dev.jup.ag/docs/ultra](https://dev.jup.ag/docs/ultra)\
→ Demo: [github.com/jup-ag/UltraV3-Demo](https://github.com/jup-ag/UltraV3-Demo)

**Talk to us:**\
→ Discord: Ask questions, get support, suggest improvements\
→ Twitter: Follow [@JupiterExchange](https://twitter.com/JupiterExchange) for updates\
→ GitHub: Clone, fork, contribute, report issues, build and have fun

**Additional resources:**\
→ [API Reference](https://dev.jup.ag/api-reference/ultra)\
→ [Jupiter Plugin](https://dev.jup.ag/tool-kits/plugin/index)

Built something with Ultra V3? Tag [@JupDevrel](https://twitter.com/JupDevrel) or [@0xanmol](https://twitter.com/0xanmol) on Twitter.


# Borrow (Soon)
Source: https://dev.jup.ag/docs/lend/borrow

Borrow against token collateral with up to 95% LTV. Documentation coming soon.

<Warning>
  **WARNING**

  The Jupiter Lend Borrow API is still a **work in progress**, stay tuned!
</Warning>


# Earn (Beta)
Source: https://dev.jup.ag/docs/lend/earn

Deposit and withdraw assets to earn yield through the Jupiter Lend protocol.

<Tip>
  **API REFERENCE**

  To fully utilize the Lend API, check out the [Lend API Reference](/api-reference/lend).
</Tip>

## Prerequisite

<AccordionGroup>
  <Accordion title="Dependencies">
    ```bash theme={null}
    npm install @solana/web3.js@1 # Using v1 of web3.js instead of v2
    npm install dotenv # If required for wallet setup
    ```
  </Accordion>

  <Accordion title="RPC">
    **Set up RPC**

    <Info>
      **NOTE**

      Solana provides a [default RPC endpoint](https://solana.com/docs/core/clusters). However, as your application grows, we recommend you to always use your own or provision a 3rd party provider’s RPC endpoint such as [Helius](https://helius.dev/) or [Triton](https://triton.one/).
    </Info>

    ```js theme={null}
    import { Connection } from "@solana/web3.js";

    const connection = new Connection('https://api.mainnet-beta.solana.com');
    ```
  </Accordion>

  <Accordion title="Wallet">
    **Set up Development Wallet**

    <Info>
      **NOTE**

      * You can paste in your private key for testing purposes but this is not recommended for production applications.
      * If you want to store your private key in the project directly, you can do it via a `.env` file.

      To set up a development wallet via `.env` file, you can use the following script.
    </Info>

    ```js theme={null}
    // index.js
    import { Keypair } from '@solana/web3.js';
    import dotenv from 'dotenv';
    require('dotenv').config();

    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || ''));
    ```

    ```bash theme={null}
    # .env
    PRIVATE_KEY=""
    ```

    To set up a development wallet via a wallet generated via [Solana CLI](https://solana.com/docs/intro/installation#solana-cli-basics), you can use the following script.

    ```js theme={null}
    import { Keypair } from '@solana/web3.js';
    import fs from 'fs';

    const privateKeyArray = JSON.parse(fs.readFileSync('/Path/To/.config/solana/id.json', 'utf8').trim());
    const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    ```
  </Accordion>

  <Accordion title="Transaction Sending Example">
    ```js theme={null}
    transaction.sign([wallet]);
    const transactionBinary = transaction.serialize();
    console.log(transactionBinary);
    console.log(transactionBinary.length);
    const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: "finalized" });

    const signature = await connection.sendRawTransaction(transactionBinary, {
      maxRetries: 0,
      skipPreflight: true,
    });

    console.log(`Transaction sent: https://solscan.io/tx/${signature}`);

    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: blockhashInfo.value.blockhash,
        lastValidBlockHeight: blockhashInfo.value.lastValidBlockHeight,
      }, "confirmed");

      if (confirmation.value.err) {
        console.error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        console.log(`Examine the failed transaction: https://solscan.io/tx/${signature}`);
      } else {
        console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
      }
    } catch (error) {
      console.error(`Error confirming transaction: ${error}`);
      console.log(`Examine the transaction status: https://solscan.io/tx/${signature}`);
    };
    ```
  </Accordion>
</AccordionGroup>

## Deposit and Withdraw

Using the Deposit or Withdraw endpoint, the user can do so based on the `amount` of assets to be deposited/withdrawn.

<Info>
  **USAGE STEPS**

  <Steps>
    <Step>
      User chooses the token.
    </Step>

    <Step>
      User chooses the amount of assets to deposit or withdraw in the specific token mint.
    </Step>

    <Step>
      Post request to get the transaction.
    </Step>

    <Step>
      User sign and send the transaction to the network.
    </Step>

    <Step>
      The mint authority mints/burns the vault tokens to/from the user.
    </Step>
  </Steps>
</Info>

```js theme={null}
const depositTransactionResponse = await (
    await (
        await fetch('https://api.jup.ag/lend/v1/earn/deposit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'your-api-key',
            },
            body: JSON.stringify({
                asset: mint,
                amount: '100000',
                signer: wallet.publicKey,
            })
        })
    )
);
```

```js theme={null}
const withdrawTransactionResponse = await (
    await (
        await fetch('https://api.jup.ag/lend/v1/earn/withdraw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'your-api-key',
            },
            body: JSON.stringify({
                asset: mint,
                amount: '100000',
                signer: wallet.publicKey,
            })
        })
    )
);
```

## Mint and Redeem

Using the Mint or Redeem endpoint, the user can do so based on the number `shares` to be minted/redeemed.

<Info>
  **USAGE STEPS**

  <Steps>
    <Step>
      User chooses the token.
    </Step>

    <Step>
      User chooses the number of shares to deposit or withdraw in the specific token mint.
    </Step>

    <Step>
      Post request to get the transaction.
    </Step>

    <Step>
      User sign and send the transaction to the network.
    </Step>

    <Step>
      The mint authority mints/burns the vault tokens to/from the user.
    </Step>
  </Steps>
</Info>

```js theme={null}
const mintTransactionResponse = await (
    await (
        await fetch('https://api.jup.ag/lend/v1/earn/mint', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'your-api-key',
            },
            body: JSON.stringify({
                asset: mint,
                signer: wallet.publicKey,
                shares: '100000',
            })
        })
    )
);
```

```js theme={null}
const redeemTransactionResponse = await (
    await (
        await fetch('https://api.jup.ag/lend/v1/earn/redeem', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'your-api-key',
            },
            body: JSON.stringify({
                asset: mint,
                signer: wallet.publicKey,
                shares: '100000',
            })
        })
    )
);
```

## Build Your Own Transaction

The Lend API provides 2 ways to interface with the Earn functions in the Jupiter Lend Program. You can either make a post request to directly get the **Transaction**, or **Instruction** which can be used for CPI or composing with additional instructions.

### Transaction

To use the Transaction method, simply request to the endpoints without `-instructions` suffix directly, as shown in the examples above. The API will respond with an unsigned base64 transaction for the signer to sign, then sent to the network for execution.

### Instruction

In some use cases, you'd prefer to utilize the instructions instead of the serialized transaction, so you can utilize with CPI or compose with other instructions. You can make a post request to `-instructions`endpoints instead.

<Accordion title="Building with Instuctions Code Snippet">
  Example code snippet of using `/deposit-instructions` endpoint and building a transaction with the instructions.

  ```js theme={null}
  import { Connection, Keypair, PublicKey, TransactionMessage, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
  import fs from 'fs';

  const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/private/key', 'utf8').trim());
  const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
  const connection = new Connection('insert-your-own-rpc');

  const depositIx = await (
      await fetch (
          'https://api.jup.ag/lend/v1/earn/deposit-instructions', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': 'your-api-key',
              },
              body: JSON.stringify({
                  asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                  amount: '1000000',
                  signer: wallet.publicKey,
              }, null, 2)
          }
      )
  ).json();

  console.log(JSON.stringify(depositIx, null, 2));

  const deserializeInstruction = (instruction) => {
      return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key) => ({
          pubkey: new PublicKey(key.pubkey),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, 'base64'),
      });
  };

  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions: [
          ...depositIx.instructions.map(deserializeInstruction)
      ],
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([wallet]);
  const transactionBinary = transaction.serialize();
  console.log(transactionBinary);
  console.log(transactionBinary.length);
  const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: "finalized" });

  const signature = await connection.sendRawTransaction(transactionBinary, {
    maxRetries: 0,
    skipPreflight: true,
  });

  console.log(`Transaction sent: https://solscan.io/tx/${signature}`);

  try {
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: blockhashInfo.value.blockhash,
      lastValidBlockHeight: blockhashInfo.value.lastValidBlockHeight,
    }, "confirmed");

    if (confirmation.value.err) {
      console.error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      console.log(`Examine the failed transaction: https://solscan.io/tx/${signature}`);
    } else {
      console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
    }
  } catch (error) {
    console.error(`Error confirming transaction: ${error}`);
    console.log(`Examine the transaction status: https://solscan.io/tx/${signature}`);
  };
  ```
</Accordion>

### CPI

* Refer to [https://github.com/jup-ag/jupiter-lend/blob/main/docs/earn/cpi.md](https://github.com/jup-ag/jupiter-lend/blob/main/docs/earn/cpi.md) for CPI example
* Refer to [https://github.com/jup-ag/jupiter-lend/blob/main/target/idl/lending.json](https://github.com/jup-ag/jupiter-lend/blob/main/target/idl/lending.json) for IDL

## Tokens

Jupiter Lend provides Earnings for individual tokens, meaning SOL and USDC will be deposited in isolation. To get all token information such as the underlying token, supply, rates and liquidity information.

```js theme={null}
const vaults = await (
    await fetch (
        'https://api.jup.ag/lend/v1/earn/tokens',
        {
            headers: {
                'x-api-key': 'your-api-key',
            },
        }
    )
).json();
```

## User Data

Below are the endpoints to aid user to better manage their positions with data of each existing positions, earnings, etc.

### Positions

Given a user, you are able to get their existing position data such as shares, underlying assets, balance and allowance.

```js theme={null}
const userPositions = await (
    await fetch (
        'https://api.jup.ag/lend/v1/earn/positions?users={user1},{user2}'
        {
            headers: {
                'x-api-key': 'your-api-key',
            },
        }
    )
).json();
```

### Earnings

Given a user, you are able to get the rewards of a specific position, for example, the amount earned for USDC token position.

```js theme={null}
const userRwards = await (
    await fetch (
        'https://api.jup.ag/lend/v1/earn/earnings?user={user1}&positions={position1},{position2}'
        {
            headers: {
                'x-api-key': 'your-api-key',
            },
        }
    )
).json();
```


# Jupiter Lend Overview
Source: https://dev.jup.ag/docs/lend/index

Jupiter's lending protocol for earning yield on deposits and borrowing against collateral.

The Jupiter Lend API is built on top of Jupiter Lend Program.

## About Earn

<AccordionGroup>
  <Accordion title="What is the Jupiter Earn Protocol?">
    The Earn Protocol is the 'Deposit and Earn' side of Jupiter Lend. Simply deposit assets to the Jupiter Earn and earn yield.
  </Accordion>

  <Accordion title="Why is this separate from borrowing?">
    Jupiter Lend uses a unified liquidity layer where both Earn (lending) and Borrow (vault) protocol can source liquidity from. For depositors this means you earn the best possible rate at all times without having to migrate your funds when new protocols are launched on Jupiter Lend. You can supply once and earn the most up to date yield from the Jupiter Lend protocol.
  </Accordion>

  <Accordion title="Are there supply or withdraw limits?">
    There is no limits on supplying funds to the Earn Protocol. Withdrawals from Jupiter Lend utilize an Automated Debt Ceiling. Withdrawals increase every block creating a smoothing curve for withdrawals preventing any sudden large movements.
  </Accordion>

  <Accordion title="What are the risk?">
    Jupiter Lend is a novel protocol and like all DeFi protocols contains smart contract risk, market risk and other factors which can cause loss of user funds.
  </Accordion>

  <Accordion title="What are the fees for the Earn Protocol?">
    There are no fees to use the Earn Protocol on Jupiter Lend.
  </Accordion>
</AccordionGroup>

## About Borrow

<AccordionGroup>
  <Accordion title="What is Jupiter Borrow Protocol?">
    Borrow Vaults are a known standard mechanism for locking collateral and borrowing debt. Jupiter Lend utilizes this familiar single asset - single debt vault approach. Jupiter Lend takes borrow vaults to the next level by being the most capital efficient and optimized protocol enabling up to 95% LTV on collateral.
  </Accordion>

  <Accordion title="How does Jupiter Lend achieve such high LTV?">
    Jupiter borrow vaults has the most advanced liquidation mechanisms, and are able to provide the highest LTVs in the market, the protocol easily removes bad debt and enables the most gas efficient liquidation mechanism in DeFi.
  </Accordion>

  <Accordion title="What happens if I am liquidated?">
    When your NFT or position is liquidated, a portion of your collateral is sold to repay your debt and return your position to a safe state. In addition to selling a part of your collateral, a liquidation penalty is also charged.
  </Accordion>

  <Accordion title="What is the Max Liquidation Threshold?">
    While the Liquidation Threshold determines when a vault can be liquidated, the protocol also has a 'hard' ceiling for liquidation. When a vault passes the max liquidation threshold it is entirely (100%) liquidated automatically.
  </Accordion>

  <Accordion title="My vault passed the liquidation threshold but is not liquidated, will I be liquidated?">
    **Yes your position is still at risk of being liquidated!** Once your position passes the threshold it can be liquidated, but it may not happen immediately. If your position is still at risk you can take the time now to unwind/reduce your risk ratio to make your position safe and prevent a liquidation event.
  </Accordion>
</AccordionGroup>

## Program ID

| Program                        | Address                                                                                                                 |
| :----------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **Jupiter Lend Earn**          | [`jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9`](https://solscan.io/account/jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9) |
| **Jupiter Lend Borrow**        | [`jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi`](https://solscan.io/account/jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi) |
| **Jupiter Lend Earn Rewards**  | [`jup7TthsMgcR9Y3L277b8Eo9uboVSmu1utkuXHNUKar`](https://solscan.io/account/jup7TthsMgcR9Y3L277b8Eo9uboVSmu1utkuXHNUKar) |
| **Jupiter Lend Liquidity**     | [`jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC`](https://solscan.io/account/jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC) |
| **Jupiter Lend Borrow Oracle** | [`jupnw4B6Eqs7ft6rxpzYLJZYSnrpRgPcr589n5Kv4oc`](https://solscan.io/account/jupnw4B6Eqs7ft6rxpzYLJZYSnrpRgPcr589n5Kv4oc) |


# Liquidation
Source: https://dev.jup.ag/docs/lend/liquidation

Build a liquidation bot for Jupiter Lend covering fetching liquidations, flash borrowing, and collateral swaps.

This guide walks through building a liquidation bot for Jupiter Lend. The bot uses the `@jup-ag/lend` SDK to fetch available liquidations, flash borrow the debt amount, execute liquidation instructions, swap collateral back to the debt token via Jupiter Swap, and flash repay — all in a single transaction.

Jupiter Lend allows anyone to participate in the liquidation mechanism. In this section, we have included a minimal Typescript example to get you started.

## Prerequisites

The liquidation bot requires the Jupiter Lend SDK. [You can find the full example at the end of this section](#full-example).

<Note>
  We will be using functions from `@jup-ag/lend/borrow` and `/flashloan`.
</Note>

```bash theme={null}
npm install @jup-ag/lend
```

<Tip>
  You will also need reliable RPC to fetch information like liquidations or swap quote and to execute the liquidation.
</Tip>

## Breakdown

The liquidation bot requires the following steps:

1. Fetch all available liquidations
2. Flash borrow the debt amount
3. Get liquidation instructions
4. Get Jupiter swap quote (collateral token -> debt token)
5. Get Jupiter swap instructions
6. Build all instructions together
7. Execute the liquidation
8. Flash payback the debt amount

### Fetch liquidations

By using the SDK, you can fetch for all available liquidations.

```typescript theme={null}
const fetchAllLiquidations = await getAllLiquidations({
  connection,
  signer,
});
```

<Tip>
  **RPC Rate Limit**

  The `getAllLiquidations` function gives you the available liquidations across all vault, each request is processed in parallel, and each consumes \~10 RPC requests.

  If you receive **`429`** or rate limit error code from this function, it is likely due to your RPC connection getting rate limited. You should upgrade your RPC plan to avoid this issue.
</Tip>

<Tip>
  **Fetch liquidations for specific vault**

  If you'd like to fetch liquidations for a specific vault, you can use the `getLiquidations` function.

  ```typescript theme={null}
  const fetchLiquidationsByVaultId = await getLiquidations({
    vaultId,
    connection,
    signer,
  });
  ```
</Tip>

### Flash borrow and payback

By using the SDK, you can flashloan to borrow the debt amount and flash payback what you flash borrowed.

```typescript theme={null}
const fetchFlashBorrowIx = await getFlashBorrowIx({
  amount: debtAmount,
  asset: borrowToken,
  signer,
  connection,
});
```

```typescript theme={null}
const fetchFlashPaybackIx = await getFlashPaybackIx({
  amount: debtAmount,
  asset: borrowToken,
  signer,
  connection,
});
```

<Tip>
  **ALL flashloans are free**!
</Tip>

### Get liquidation instructions

By using the SDK, you can get the liquidation instructions.

```typescript theme={null}
const fetchLiquidateIx = await getLiquidateIx({
  vaultId,
  debtAmount,
  signer,
  connection,
});
```

### Get Jupiter quote and swap instructions

For this step, you will need to request to the Jupiter Swap API to get the quote and swap instructions.

* [You can refer to the example below to check how to fetch from the Swap API](#full-example)
* Else, [for the full guide on Swap API, please refer to Swap API section](/docs/swap).

## Full Example

```typescript theme={null}
import {
  getLiquidateIx,
  getAllLiquidations,
  getVaultsProgram,
} from "@jup-ag/lend/borrow";
import { getFlashBorrowIx, getFlashPaybackIx } from "@jup-ag/lend/flashloan";
import {
  Connection,
  PublicKey,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import BN from "bn.js";
import axios from "axios";

const RPC_URL = "<RPC_URL>";
const SLIPPAGE_BPS = 100;

const signer = new PublicKey("1234567890");
const connection = new Connection(RPC_URL);
const program = getVaultsProgram({ connection, signer });
const configs = await program.account.vaultConfig.all();

async function fetchLiquidations() {
  try {
    const allAvailableLiquidations = await getAllLiquidations({
      connection,
      signer,
    });

    const validLiquidations: any = [];

    for (const vaultLiquidation of allAvailableLiquidations) {
      const { liquidations, vaultId } = vaultLiquidation;

      if (liquidations.length === 0) continue;

      // prettier-ignore
      for (const liquidation of liquidations) {
          const supplyToken = configs.find((config) => config.account.vaultId === vaultId)?.account.supplyToken;
          const borrowToken = configs.find((config) => config.account.vaultId === vaultId)?.account.borrowToken;

          validLiquidations.push({
            vaultId,
            liquidation,
            debtAmount: new BN(liquidation.amtIn),
            collateralAmount: new BN(liquidation.amtOut),
            supplyToken,
            borrowToken,
          });
        }
    }

    return validLiquidations;
  } catch (error) {
    console.error("Error fetching liquidations:", error);
    throw error;
  }
}

async function getJupiterQuote({
  inputMint,
  outputMint,
  amount,
  slippageBps = SLIPPAGE_BPS,
}) {
  try {
    const response = await axios.get("https://api.jup.ag/swap/v1/quote", {
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps,
        restrictIntermediateTokens: true,
        maxAccounts: 32,
      },
      headers: {
        'x-api-key': 'your-api-key',
      },
    });

    return response.data;
  } catch (error) {
    console.error(
      "Error fetching Jupiter quote:",
      error.response?.data || error.message
    );
    throw error;
  }
}

async function getJupiterSwapInstructions({ quoteResponse, userPublicKey }) {
  try {
    const response = await axios.post(
      "https://api.jup.ag/swap/v1/swap-instructions",
      {
        quoteResponse,
        userPublicKey,
      },
      {
        headers: {
          "Content-Type": "application/json",
          'x-api-key': 'your-api-key',
        },
      }
    );

    if (response.data.error) {
      throw new Error(
        "Failed to get swap instructions: " + response.data.error
      );
    }

    return response.data;
  } catch (error) {
    console.error(
      "Error getting swap instructions:",
      error.response?.data || error.message
    );
    throw error;
  }
}

function deserializeInstruction(instruction) {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((key) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(instruction.data, "base64"),
  });
}

async function getAddressLookupTableAccounts(connection, keys) {
  if (!keys || keys.length === 0) return [];

  const addressLookupTableAccountInfos =
    await connection.getMultipleAccountsInfo(
      keys.map((key) => new PublicKey(key))
    );

  return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
    const addressLookupTableAddress = keys[index];
    if (accountInfo) {
      const addressLookupTableAccount = new AddressLookupTableAccount({
        key: new PublicKey(addressLookupTableAddress),
        state: AddressLookupTableAccount.deserialize(accountInfo.data),
      });
      acc.push(addressLookupTableAccount);
    }
    return acc;
  }, []);
}

async function executeLiquidation({
  vaultId,
  debtAmount,
  collateralAmount,
  supplyToken,
  borrowToken,
}) {
  try {
    console.log(`Executing liquidation for vault ${vaultId}...`);

    const instructions: TransactionInstruction[] = [];
    let allAddressLookupTableAccounts: AddressLookupTableAccount[] = [];

    // Step 1: Flash borrow the debt amount
    const flashBorrowIx = await getFlashBorrowIx({
      amount: debtAmount,
      asset: borrowToken,
      signer,
      connection,
    });

    instructions.push(flashBorrowIx);

    // Step 2: Get liquidation instructions
    const {
      ixs: liquidateIxs,
      addressLookupTableAccounts: liquidateLookupTables,
    } = await getLiquidateIx({
      vaultId,
      debtAmount,
      signer,
      connection,
    });

    instructions.push(...liquidateIxs);

    if (liquidateLookupTables && liquidateLookupTables.length > 0) {
      allAddressLookupTableAccounts.push(...liquidateLookupTables);
    }

    // Step 3: Get Jupiter swap quote (collateral token -> debt token)
    const quoteResponse = await getJupiterQuote({
      inputMint: supplyToken.toString(), // Collateral token
      outputMint: borrowToken.toString(), // Debt token
      amount: collateralAmount.toString(),
      slippageBps: SLIPPAGE_BPS,
    });

    // Step 4: Get Jupiter swap instructions
    const swapInstructions = await getJupiterSwapInstructions({
      quoteResponse,
      userPublicKey: signer.toString(),
    });

    const {
      setupInstructions,
      swapInstruction: swapInstructionPayload,
      cleanupInstruction,
      addressLookupTableAddresses,
    } = swapInstructions;

    if (setupInstructions && setupInstructions.length > 0) {
      instructions.push(...setupInstructions.map(deserializeInstruction));
    }

    instructions.push(deserializeInstruction(swapInstructionPayload));

    if (cleanupInstruction) {
      instructions.push(deserializeInstruction(cleanupInstruction));
    }

    // Step 5: Flash payback
    const flashPaybackIx = await getFlashPaybackIx({
      amount: debtAmount,
      asset: borrowToken,
      signer,
      connection,
    });
    instructions.push(flashPaybackIx);

    // Step 6: Get Jupiter address lookup tables
    if (addressLookupTableAddresses && addressLookupTableAddresses.length > 0) {
      const jupiterLookupTables = await getAddressLookupTableAccounts(
        connection,
        addressLookupTableAddresses
      );
      allAddressLookupTableAccounts.push(...jupiterLookupTables);
    }

    // Step 7: Build and send transaction
    const latestBlockhash = await connection.getLatestBlockhash();
    const messageV0 = new TransactionMessage({
      payerKey: signer,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 1_000_000,
        }),
        ...instructions,
      ],
    }).compileToV0Message(allAddressLookupTableAccounts);

    const transaction = new VersionedTransaction(messageV0);

    return transaction;
  } catch (error) {
    console.error(`Error executing liquidation for vault ${vaultId}:`, error);
    throw error;
  }
}

async function runLiquidationBot() {
  try {
    const liquidations = await fetchLiquidations();

    if (liquidations.length === 0) {
      console.log("No liquidations available at this time.");
      return;
    }

    for (const liquidationData of liquidations) {
      const {
        vaultId,
        debtAmount,
        collateralAmount,
        borrowToken,
        supplyToken,
      } = liquidationData;

      try {
        const signature = await executeLiquidation({
          vaultId,
          debtAmount,
          collateralAmount,
          borrowToken,
          supplyToken,
        });

        console.log(`Successfully liquidated vault ${vaultId}: ${signature}`);

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`Failed to liquidate vault ${vaultId}:`, error.message);
        continue;
      }
    }
  } catch (error) {
    console.error("Error in liquidation bot:", error);
  }
}
```


# Oracles
Source: https://dev.jup.ag/docs/lend/oracles

Price oracle system for the Jupiter Lend protocol, using Pyth feeds with freshness and confidence validation.

The Oracle Program delivers accurate price data to the protocol by integrating with trusted oracle providers. It calculates exchange rates by combining multiple price sources in a structured sequence, ensuring reliable asset valuations.

<Info>
  **NOTE**

  The Oracle program has been audited by Zenith and Offside.

  **Oracle Program Address:** `jupnw4B6Eqs7ft6rxpzYLJZYSnrpRgPcr589n5Kv4oc`
</Info>

## Hop-Based Oracle System

The system computes exchange rates by processing prices from up to four sources in a sequential chain. Each source contributes to the final rate through multiplication or division, with the option to invert values as needed. Currently, Pyth is the supported source type.

For example, to derive the JUPSOL/SOL rate, the system combines JUPSOL/USD and SOL/USD feeds, inverting the latter to obtain USD/SOL, resulting in an accurate exchange rate.

This design enables the system to:

* Aggregate rates from multiple feeds, reducing dependency on any single provider
* Adjust for varying units or scales using predefined multipliers and divisors
* Validate data integrity at each step

## Freshness Enforcement

To ensure prices reflect current market conditions, the system enforces strict time-based validity checks:

* **User Operations**: Prices must be no older than 60 seconds to be considered valid for actions like borrowing or supplying assets
* **Liquidations**: Prices can be up to 1800 seconds (30 minutes) old, allowing liquidations to proceed during temporary oracle delays while avoiding reliance on outdated data

These checks prevent the protocol from using stale prices for liquidation or health factor calculations.

## Confidence Interval Validation

The system evaluates the confidence interval provided by Pyth price feeds to ensure data reliability:

* **User Operations**: The confidence interval must be within 2% of the reported price
* **Liquidations**: The confidence interval must be within 4% of the reported price

If a price feed's confidence exceeds these thresholds, it is rejected.

## Providers

The program currently utilizes Pyth push feeds for price data. Integration with Chainlink streams is underway to broaden the range of sources.

## Oracle Verification Script

Use this script to verify oracle prices by providing a nonce:

```typescript theme={null}
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import axios from "axios";

const NONCE = 2; // Change this to test different oracles
const ORACLE_PROGRAM_ID = new PublicKey("jupnw4B6Eqs7ft6rxpzYLJZYSnrpRgPcr589n5Kv4oc");
const IDL_URL = "https://raw.githubusercontent.com/jup-ag/jupiter-lend/refs/heads/main/target/idl/oracle.json";
const RPC_URL = "<RPC URL>";

class OracleReader {
  private program: Program;

  private constructor(program: Program) {
    this.program = program;
  }

  static async create(): Promise<OracleReader> {
    const connection = new Connection(RPC_URL);
    const response = await axios.get(IDL_URL);
    const idl = response.data;

    const wallet = {
      signTransaction: () => { throw new Error("Read-only"); },
      signAllTransactions: () => { throw new Error("Read-only"); },
      publicKey: new PublicKey("11111111111111111111111111111111"),
    };

    const provider = new AnchorProvider(connection, wallet, {});
    const program = new Program(idl, provider);
    return new OracleReader(program);
  }

  private findOraclePDA(nonce: number): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("oracle"),
        Buffer.from(new Uint8Array(new Uint16Array([nonce]).buffer)),
      ],
      ORACLE_PROGRAM_ID
    );
    return pda;
  }

  async getPrice(nonce: number) {
    const oraclePDA = this.findOraclePDA(nonce);
    const oracleAccount = await this.program.account.oracle.fetch(oraclePDA);
    
    const remainingAccounts = oracleAccount.sources.map((source: any) => ({
      pubkey: source.source,
      isWritable: false,
      isSigner: false,
    }));

    const price = await this.program.methods
      .getExchangeRateOperate(nonce)
      .accounts({ oracle: oraclePDA })
      .remainingAccounts(remainingAccounts)
      .view();

    return {
      nonce,
      oraclePDA: oraclePDA.toString(),
      price: price.toString(),
      sources: oracleAccount.sources.length
    };
  }
}

async function main() {
  const reader = await OracleReader.create();
  const result = await reader.getPrice(NONCE);
  console.log(result);
}

main().catch(console.error);
```


# Lend SDK
Source: https://dev.jup.ag/docs/lend/sdk

TypeScript SDK for integrating with the Jupiter Lend Earn protocol.

The Jupiter Lend SDK provides a TypeScript interface for interacting with the Jupiter lending protocol. This documentation covers two main integration approaches: getting instruction objects for direct use and getting account contexts for Cross-Program Invocation (CPI) integrations.

<Note>
  Refer to [Jupiter Lend SDK](https://github.com/jup-ag/jupiter-lend/tree/main/packages/sdk) for more information.
</Note>

## Installation

```bash theme={null}
npm install @jup-ag/lend
```

## Setup

```typescript theme={null}
import {
    Connection,
    Keypair, 
    PublicKey, 
    TransactionMessage, 
    TransactionInstruction, 
    VersionedTransaction
} from "@solana/web3.js";
import {
  getDepositIx, getWithdrawIx, // get instructions
  getDepositContext, getWithdrawContext, // get context accounts for CPI
} from "@jup-ag/lend/earn";
import { BN } from "bn.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const signer = Keypair.fromSecretKey(new Uint8Array(privateKey));

// Example asset mints
const usdc = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC mainnet
```

***

## Instruction

### Get Deposit Instruction

```typescript theme={null}
const depositIx = await getDepositIx({
    amount: new BN(1000000), // amount in token decimals (1 USDC)
    asset: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // asset mint address
    signer: signer.publicKey, // signer public key
    connection, // Solana connection
    cluster: "mainnet",
});
```

### Get Withdraw Instruction

```typescript theme={null}
const withdrawIx = await getWithdrawIx({
    amount: new BN(1000000), // amount in token decimals (1 USDC)
    asset: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // asset mint address
    signer: signer.publicKey, // signer public key
    connection, // Solana connection
    cluster: "mainnet",
});
```

### Example Instruction Usage

```typescript theme={null}
import {
    Connection,
    Keypair, 
    PublicKey, 
    TransactionMessage, 
    Transaction,
    TransactionInstruction,
    VersionedTransaction
} from "@solana/web3.js";
import {
    getDepositIx,
} from "@jup-ag/lend/earn";
import { BN } from "bn.js";

const signer = Keypair.fromSecretKey(new Uint8Array(privateKey));
const connection = new Connection('https://api.mainnet-beta.solana.com');

// Get deposit instruction
const depositIx = await getDepositIx({
    amount: new BN(1000000), // amount in token decimals (1 USDC)
    asset: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // asset mint address
    signer: signer.publicKey, // signer public key
    connection, // Solana connection
    cluster: "mainnet",
});

// Convert the raw instruction to TransactionInstruction
const instruction = new TransactionInstruction({
    programId: new PublicKey(depositIx.programId),
    keys: depositIx.keys.map((key) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
    })),
    data: Buffer.from(depositIx.data),
});

const latestBlockhash = await connection.getLatestBlockhash();
const messageV0 = new TransactionMessage({
    payerKey: signer.publicKey,
    recentBlockhash: latestBlockhash.blockhash,
    instructions: [instruction],
}).compileToV0Message();

const transaction = new VersionedTransaction(messageV0);
transaction.sign([signer]);
const serializedTransaction = transaction.serialize();
const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: "finalized" });

const signature = await connection.sendRawTransaction(serializedTransaction);
console.log(`https://solscan.io/tx/${signature}`);
```

## CPI

For Anchor programs that need to make CPI calls to Jupiter Lend, use the context methods.

### Deposit Context Accounts

```typescript theme={null}
const depositContext = await getDepositContext({
    asset: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // asset mint address
    signer: signer.publicKey, // signer public key
    connection,
});
```

<details>
  <summary>
    <div>
      <div>
        <b>Deposit Context Accounts Table</b>
      </div>
    </div>
  </summary>

  | Account                            | Purpose                                  |
  | :--------------------------------- | :--------------------------------------- |
  | `signer`                           | User's wallet public key                 |
  | `depositorTokenAccount`            | User's underlying token account (source) |
  | `recipientTokenAccount`            | User's fToken account (destination)      |
  | `mint`                             | Underlying token mint                    |
  | `lendingAdmin`                     | Protocol configuration PDA               |
  | `lending`                          | Pool-specific configuration PDA          |
  | `fTokenMint`                       | fToken mint account                      |
  | `supplyTokenReservesLiquidity`     | Liquidity protocol token reserves        |
  | `lendingSupplyPositionOnLiquidity` | Protocol's position in liquidity pool    |
  | `rateModel`                        | Interest rate calculation model          |
  | `vault`                            | Protocol vault holding deposited tokens  |
  | `liquidity`                        | Main liquidity protocol PDA              |
  | `liquidityProgram`                 | Liquidity protocol program ID            |
  | `rewardsRateModel`                 | Rewards calculation model PDA            |
</details>

### Withdraw Context Accounts

```typescript theme={null}
const withdrawContext = await getWithdrawContext({
    asset: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // asset mint address
    signer: signer.publicKey, // signer public key
    connection,
});
```

<details>
  <summary>
    <div>
      <div>
        <b>Withdraw Context Accounts Table</b>
      </div>
    </div>
  </summary>

  Similar to deposit context, but includes:

  * `ownerTokenAccount`: User's fToken account (source of fTokens to burn)
  * `claimAccount`: Additional account for withdrawal claim processing

  | Account                            | Purpose                                  |
  | :--------------------------------- | :--------------------------------------- |
  | `signer`                           | User's wallet public key                 |
  | `ownerTokenAccount`                | User's underlying token account (source) |
  | `recipientTokenAccount`            | User's fToken account (destination)      |
  | `claimAccount`                     | Additional account for withdrawal        |
  | `mint`                             | Underlying token mint                    |
  | `lendingAdmin`                     | Protocol configuration PDA               |
  | `lending`                          | Pool-specific configuration PDA          |
  | `fTokenMint`                       | fToken mint account                      |
  | `supplyTokenReservesLiquidity`     | Liquidity protocol token reserves        |
  | `lendingSupplyPositionOnLiquidity` | Protocol's position in liquidity pool    |
  | `rateModel`                        | Interest rate calculation model          |
  | `vault`                            | Protocol vault holding deposited tokens  |
  | `liquidity`                        | Main liquidity protocol PDA              |
  | `liquidityProgram`                 | Liquidity protocol program ID            |
  | `rewardsRateModel`                 | Rewards calculation model PDA            |
</details>

### Example CPI Usage

```typescript theme={null}
const depositContext = await getDepositContext({
  asset: usdcMint,
  signer: userPublicKey,
});

// Pass these accounts to your Anchor program
await program.methods
  .yourDepositMethod(amount)
  .accounts({
    // Your program accounts
    userAccount: userAccount,

    // Jupiter Lend accounts (from context)
    signer: depositContext.signer,
    depositorTokenAccount: depositContext.depositorTokenAccount,
    recipientTokenAccount: depositContext.recipientTokenAccount,
    lendingAdmin: depositContext.lendingAdmin,
    lending: depositContext.lending,
    fTokenMint: depositContext.fTokenMint,
    // ... all other accounts from context

    lendingProgram: new PublicKey(
      "jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9"
    ),
  })
  .rpc();
```

***

## Read Functions

The Jupiter Lend SDK provides several read functions to query protocol data and user positions, this can be helpful to display on your frontend.

### Get All Lending Tokens

Retrieves all available lending tokens in the Jupiter Lend Earn protocol.

<Note>
  The `getLendingTokens` function returns an array of `PublicKey` objects.
</Note>

```typescript theme={null}
import { getLendingTokens } from "@jup-ag/lend/earn";

const allTokens = await getLendingTokens({ connection });
```

```typescript theme={null}
[
    PublicKey,
    PublicKey,
    ...
]
```

### Get Token Details

Fetches detailed information about a specific lending token.

```typescript theme={null}
import { getLendingTokenDetails } from "@jup-ag/lend/earn";

const tokenDetails = await getLendingTokenDetails({
    lendingToken: new PublicKey("9BEcn9aPEmhSPbPQeFGjidRiEKki46fVQDyPpSQXPA2D"), // allTokens[x] from the previous example
    connection,
});
```

```typescript theme={null}
{
  id: number; // ID of jlToken, starts from 1
  address: PublicKey; // Address of jlToken
  asset: PublicKey; // Address of underlying asset
  decimals: number; // Decimals of asset (same as jlToken decimals)
  totalAssets: BN; // Total underlying assets in the pool
  totalSupply: BN; // Total shares supply
  convertToShares: BN; // Multiplier to convert assets to shares
  convertToAssets: BN; // Multiplier to convert shares to assets
  rewardsRate: BN; // Rewards rate (1e4 decimals, 1e4 = 100%)
  supplyRate: BN; // Supply APY rate (1e4 decimals, 1e4 = 100%)
}
```

### Get User Position

Retrieves a user's lending position for a specific asset:

```typescript theme={null}
import { getUserLendingPositionByAsset } from "@jup-ag/lend/earn";

const userPosition = await getUserLendingPositionByAsset({
    asset: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // The address of underlying asset or tokenDetails.asset
    user: signer.publicKey, // User's wallet address
    connection,
});
```

```typescript theme={null}
{
  lendingTokenShares: BN; // User's shares in jlToken
  underlyingAssets: BN; // User's underlying assets
  underlyingBalance: BN; // User's underlying balance
}
```


# Jupiter Lock Overview
Source: https://dev.jup.ag/docs/lock/index

Jupiter Lock is an open-sourced, audited, and free ecosystem tool to lock and distribute tokens over-time.

Jupiter Lock is an open-sourced, audited and free-to-use tool to lock and distribute tokens over-time.

* Used by project teams, creators, community builders, and anyone
* Implement cliff, and vest non-circulating supply in a clear and transparent manner.
* Program code is available here: [https://github.com/jup-ag/jup-lock](https://github.com/jup-ag/jup-lock)
* Program ID: [`LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn`](https://solscan.io/account/LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn)
* Audited Twice by [OtterSec & Sec3](/resources/audits)
* Lock UI: [https://lock.jup.ag/](https://lock.jup.ag/)

<Card title="Use Lock via scripts" href="https://github.com/jup-ag/jup-lock/tree/main/cli/src/bin/instructions" icon="code">
  Refer to this section of the Github repository to use Lock programmatically.
</Card>


# Custody Account
Source: https://dev.jup.ag/docs/perps/custody-account

Overview of the Custody account used in the Jupiter Perpetuals Program, representing tokens managed by the JLP pool

This page contains an overview of the  used in the Jupiter Perpetuals Program, and specifically the  account.

The `Custody` account is a struct which represents a set of parameters and states associated to custodies (tokens) managed by the JLP pool which consists of the following custodies.

| Custodies                                                                      |                                                                                |                                                                                |                                                                                 |                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| [SOL](https://solscan.io/account/7xS2gz2bTp3fwCC7knJvUWTEU9Tycczu6VhJYKgi1wdz) | [ETH](https://solscan.io/account/AQCGyheWPLeo6Qp9WpYS9m3Qj479t7R636N9ey1rEjEn) | [BTC](https://solscan.io/account/5Pv3gM9JrFFH883SWAhvJC9RPYmo8UNxuFtv5bMMALkm) | [USDC](https://solscan.io/account/G18jKKXQwBbrHeiK3C9MRXhkHsLHf7XgCSisykV46EZa) | [USDT](https://solscan.io/account/4vkNeXiYEUizLdrpdPS1eC2mccyM4NUPRtERrk6ZETkk) |

<Tip>
  This [repository](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing) contains Typescript code samples on interacting with the Jupiter Perpetuals program IDL with `anchor` and `@solana/web3.js`

  You can also find the [Custody Account fields in the repository](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing/blob/1a0b5dc71081958895691047a9aa8ba51d2a8765/src/idl/jupiter-perpetuals-idl.ts#L2397) or on a [blockchain explorer](https://solscan.io/account/PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu#anchorProgramIdl).
</Tip>

## Account Details

Each `Custody` account contains the following data:

| Field              | Description                                                                                                                                                                                                |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pool`             | **Type:** `publicKey`<br /><br /> The public key for the pool that this custody belongs to (i.e. the JLP pool).                                                                                            |
| `mint`             | **Type:** `publicKey`<br /><br /> The public key for the custody's token mint account.                                                                                                                     |
| `tokenAccount`     | **Type:** `publicKey`<br /><br /> The associated token account of the custody which holds the tokens under management for the pool.                                                                        |
| `decimals`         | **Type:** `u8`<br /><br /> The number of decimals used for the token which is the same as the number of decimals specified in the token mint account. This is stored for convenience.                      |
| `isStable`         | **Type:** `bool`<br /><br /> A boolean flag indicating if the token in custody is a stable asset.                                                                                                          |
| `oracle`           | **Type:** `OracleParams`<br /><br /> Contains data for the price oracle used for the custody.                                                                                                              |
| `pricing`          | **Type:** [`PricingParams`](#pricingparams)<br /><br /> Contains data for the custody's price-related logic.                                                                                               |
| `permissions`      | **Type:** `Permissions`<br /><br /> A set of global flags that can be set by the protocol's administrator to enable or disable trade actions which is useful during program upgrades or black swan events. |
| `targetRatioBps`   | **Type:** `u64`<br /><br /> The target weightage (in basis points) for the custody in the JLP pool.                                                                                                        |
| `assets`           | **Type:** [`Assets`](#assets)<br /><br /> Contains data used to calculate PNL, AUM, and core business logic for the program.                                                                               |
| `fundingRateState` | **Type:** [`FundingRateState`](#fundingratestate)<br /><br /> Contains data used to calculate borrow fees for open positions.                                                                              |

### `PricingParams`

| Field                  | Description                                                                                                                                         |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tradeImpactFeeScalar` | **Type:** `u64` <br /><br /> Sets the base value when calculating price impact fees when opening or closing positions.                              |
| `maxLeverage`          | **Type:** `u64` <br /><br /> Sets the max leverage for this custody's positions. The max leverage for all custodies is 500x at the time of writing. |
| `maxGlobalLongSizes`   | **Type:** `u64` <br /><br /> The maximum total position size (USD) for long positions.                                                              |
| `maxGlobalShortSizes`  | **Type:** `u64` <br /><br /> The maximum total position size (USD) for short positions.                                                             |

### `Assets`

| Field                      | Description                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `feesReserves`             | **Type:** `u64`<br /><br /> The fees collected by all open positions for the custody. `feesReserves` resets to zero when the fees are distributed to the pool and protocol.                                                                                                                                                                                                                                                        |
| `owned`                    | **Type:** `u64`<br /><br /> The number of tokens owned by the pool for the custody.<br />- The owned value is increased either by providing liquidity to the pool or depositing collateral when opening or updating positions.<br />- Conversely, the owned value decreases when liquidity is removed from the pool or collateral is withdrawn from closing positions.                                                             |
| `locked`                   | **Type:** `u64`<br /><br /> The number of tokens locked by the pool for the custody to pay off potential profits for open positions.                                                                                                                                                                                                                                                                                               |
| `guaranteedUsd`            | **Type:** `u64`<br /><br /> This value represents the total amount borrowed in USD (position size - collateral) across all long positions.<br /><br /> It is updated whenever traders modify their collateral through deposits or withdrawals. The system uses this aggregated figure to efficiently calculate the total profit and loss (PNL) for all long positions, which in turn is used to calculate the AUM of the JLP pool. |
| `globalShortSizes`         | **Type:** `u64`<br /><br /> Stores the total amount (USD) position sizes for all short positions.                                                                                                                                                                                                                                                                                                                                  |
| `globalShortAveragePrices` | **Type:** `u64`<br /><br /> Stores the average price (USD) for all short positions.<br /><br /> This value and `globalShortSizes` are used to calculate the PNL for all short positions efficiently, and is again used to calculate the AUM of the JLP pool.                                                                                                                                                                       |

### `FundingRateState`

| Field                    | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cumulativeInterestRate` | **Type:** `u128` <br /><br /> Traders are required to pay hourly borrow fees for opening leveraged positions. This fee is calculated based on two primary factors: the size of the trader's position and the current utilization of the pool for the custody. <br /><br /> To calculate borrow fees more efficiently, each custody account contains a value called `cumulativeInterestRate`. <br /><br /> Correspondingly, each position account stores a `cumulativeInterestSnapshot` which captures the value of `cumulativeInterestRate` at the time of the position's last update. Whenever there's a change in either the borrowed assets or the total assets within a custody, the `cumulativeInterestRate` for the custody is updated. The difference between the custody's `cumulativeInterestRate` and the position's `cumulativeInterestSnapshot` is then used to calculate the position's borrow fees. |
| `lastUpdate`             | **Type:** `i64` <br /><br /> The UNIX timestamp for when the custody's borrow fee data was last updated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `hourlyFundingDbps`      | **Type:** `u64` <br /><br /> A constant used to calculate the hourly borrow fees for the custody. The Jupiter Perpetuals exchange works with Gauntlet and Chaos Labs to update and fine tune the `hourlyFundingDbps` to respond to traders' feedback and market conditions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |


# Jupiter Perpetuals Overview
Source: https://dev.jup.ag/docs/perps/index

Overview of Jupiter Perps API for leverage trading on Solana

<Warning>
  **WARNING**

  The Perps API is still a **work in progress**, stay tuned!
</Warning>

<Tip>
  **TIP**

  In the meantime, you can use this amazing github repository to direct Anchor IDL parse the Perps Program.

  * Fetch Perps or JLP pool data
  * Interact with the Perps Program

  [https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing)
</Tip>


# Pool Account
Source: https://dev.jup.ag/docs/perps/pool-account

Overview of the Pool account used in the Jupiter Perpetuals Program, representing data for the JLP pool including AUM and Custody data

This page contains an overview of the  used in the Jupiter Perpetuals Program, and specifically the  account.

The `Pool` account is a struct which represents a set of parameters and states associated to the data for JLP pool, including AUM and [`Custody`](/docs/perps/custody-account) data.

<Info>
  **ONLY ONE POOL ACCOUNT**

  There is only one [`Pool` account](https://solscan.io/account/5BUwFW4nRbftYTDMbgxykoFWqWHPzahFSNAaaaJtVKsq).
</Info>

<Tip>
  **EXAMPLE TYPESCRIPT REPOSITORY**

  This [repository](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing) contains Typescript code samples on interacting with the Jupiter Perpetuals program IDL with `anchor` and `@solana/web3.js`

  You can also find the [Custody Account fields in the repository](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing/blob/1a0b5dc71081958895691047a9aa8ba51d2a8765/src/idl/jupiter-perpetuals-idl.ts#L2699) or on a [blockchain explorer](https://solscan.io/account/PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu#anchorProgramIdl).
</Tip>

## Account Details

Each `Pool` account contains the following data:

| Field       | Description                                                                                                                                                                                                                                                                                                                                                             |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`      | **Type:** `string` <br /><br /> The name for the account.                                                                                                                                                                                                                                                                                                               |
| `custodies` | **Type:** `publicKey` <br /><br /> An array containing the public keys for the custodies (tokens) managed by the JLP pool.                                                                                                                                                                                                                                              |
| `aumUsd`    | **Type:** `u128` <br /><br /> The current AUM value (USD) for the JLP pool. The `aumUsd` value's calculation can be summarized by getting the USD value of the tokens managed by the pool minus the USD value reserved to pay off trader profits. <br /> <br />Refer to the [Custody account](/docs/perps/custody-account) details for more details on AUM calculation. |
| `limit`     | **Type:** [`Limit`](#limit) <br /><br /> Contains values for the pool's limits.                                                                                                                                                                                                                                                                                         |
| `fees`      | **Type:** [`Fees`](#fees) <br /><br /> Sets the fee amounts or percentages for the Jupiter Perpetuals exchange.                                                                                                                                                                                                                                                         |
| `poolApr`   | **Type:** [`PoolApr`](#poolapr) <br /><br /> Contains data related to the pool's APR / APY calculations.                                                                                                                                                                                                                                                                |

### `Limit`

| Field                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `maxAumUsd`               | **Type:** `u128` <br /><br /> The max AUM for the JLP pool. This acts as a max cap / ceiling as the JLP will not accept deposits when the cap is hit.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tokenWeightageBufferBps` | **Type:** `u128` <br /><br /> The token weightage buffer (in basis points) to calculate the token's maximum or minimum current weightage based on the target weightage. <br /><br /> Currently, `tokenWeightageBufferBps` is set to `2000` which means the the current weightage cannot be lower or higher than + / - 20% of the token's target weightage. <br /><br /> For example, if SOL's target weightage for the JLP pool is 50%, the current weightage cannot be less than 40% or exceed 60%. The pool will not allow deposits or withdrawals if the action causes the token to exceed its target weightage. |
| `maxPositionUsd`          | **Type:** `u64` <br /><br /> Sets the maximum position size. The current `maxPositionUsd` value is `2_500_000_000_000` which means a position's max size is \$2,500,000.                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### `Fees`

| Field                   | Description                                                                                                                                                                                                                                                                |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `increasePositionBps`   | **Type:** `string` <br /><br /> A fixed fee of 6 BPS (0.06%) is charged for opening or increasing a position.                                                                                                                                                              |
| `decreasePositionBps`   | **Type:** `publicKey` <br /><br /> A fixed fee of 6 BPS (0.06%) is charged for closing or decreasing a position.                                                                                                                                                           |
| `addRemoveLiquidityBps` | **Type:** `u128` <br /><br /> Fee charged when adding or removing liquidity to/from the pool.                                                                                                                                                                              |
| `swapBps`               | **Type:** `Limit` <br /><br /> Swap fee for exchanging non-stablecoin tokens routed through the liquidity pool. `swap fee = swapBps ± swapTaxBps`                                                                                                                          |
| `taxBps`                | **Type:** `PoolApr` <br /><br /> Tax fee for non-stablecoins, determined based on the difference between the current and target weightage. A larger difference results in a higher tax fee, encouraging liquidity providers to rebalance the pool to the target weightage. |
| `stableSwapBps`         | **Type:** `Limit` <br /><br /> Swap fee for exchanges involving stablecoins, routed through the liquidity pool. `swap fee = stableSwapBps ± stableSwapTaxBps`                                                                                                              |
| `stableSwapTaxBps`      | **Type:** `Fees` <br /><br /> Tax fee for stablecoin swaps. Similar to taxBps, this fee is determined by the difference between the current and target weightage.                                                                                                          |
| `protocolShareBps`      | **Type:** `PoolApr` <br /><br /> Jupiter takes a share of 2500 BPS (25%) from the fees collected by the pool.                                                                                                                                                              |

### `PoolApr`

| Field            | Description                                                                                                                                                                                                                                                                                     |
| :--------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lastUpdated`    | **Type:** `i64` <br /><br /> The UNIX timestamp when the pool's APR data was last updated.                                                                                                                                                                                                      |
| `feeAprBps`      | **Type:** `u64` <br /><br /> The pool's APR in BPS format. The APR is calculated weekly by dividing the pool's realized fees (minus the 25% collected by the protocol) by the total pool value, adjusting for the 1 week time period to annualize the rate.                                     |
| `realizedFeeUsd` | **Type:** `u64` <br /><br /> The fees collected by the pool so far. This fee is reinvested back into the pool and is also used to calculate the APR as mentioned above. realizedFeeUsd resets to zero when the fee is reinvested into the pool hence causing the APR value to fluctuate weekly. |


# Position Account
Source: https://dev.jup.ag/docs/perps/position-account

Overview of the Position account used in the Jupiter Perpetuals Program, representing trade position data for a given token

This page contains an overview of the  used in the Jupiter Perpetuals Program, and specifically the  account.

The `Position` account is a struct which represents a set of parameters and states associated to trade position data for a given token.

<Info>
  **`Position` account derivation**

  The `Position` account's address is derived from the trader's wallet address / public key, the custody account, the collateral custody account, and a few other constant seeds. This means traders will always have the same Position account address for their open positions.

  This also means that traders only have nine positions available at one time:

  * Long SOL
  * Long wETH
  * Long wBTC
  * Short SOL (USDC as collateral)
  * Short SOL (USDT as collateral)
  * Short wETH (USDC as collateral)
  * Short wETH (USDT as collateral)
  * Short wBTC (USDC as collateral)
  * Short wBTC (USDT as collateral)

  This is an example [`Position` account](https://solscan.io/account/FBLzd5VM67MEKkoWerXu7Nu1ksbLXQvJDx63y5aeLEvt).
</Info>

<Tip>
  **EXAMPLE TYPESCRIPT CODE**

  This [repository](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing) contains Typescript code samples on interacting with the Jupiter Perpetuals program IDL with `anchor` and `@solana/web3.js`

  You can also find the [Custody Account fields in the repository](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing/blob/1a0b5dc71081958895691047a9aa8ba51d2a8765/src/idl/jupiter-perpetuals-idl.ts#L2699) or on a [blockchain explorer](https://solscan.io/account/PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu#anchorProgramIdl).
</Tip>

## Account Details

Each `Position` account contains the following data:

| Field                        | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`                      | **Type:** `publicKey` <br /><br /> The public key of the trader's account.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `pool`                       | **Type:** `publicKey` <br /><br /> The public key of the [JLP pool account](/docs/perps/pool-account).                                                                                                                                                                                                                                                                                                                                                                                                             |
| `custody`                    | **Type:** `publicKey` <br /><br /> The public key of the position's [`custody` account](/docs/perps/custody-account).                                                                                                                                                                                                                                                                                                                                                                                              |
| `collateralCustody`          | **Type:** `publicKey` <br /><br /> The public key of the position's collateral custody account. <br /><br /> Like the `custody` account, a `collateralCustody` account contains information for the token that's used as collateral for the position (SOL / wETH / wBTC for long positions, USDC / USDT for short positions). <br /><br /> The borrow rates for the position will also be calculated based on the position's `collateralCustody`.                                                                  |
| `openTime`                   | **Type:** `i64` <br /><br /> The open time of the position in UNIX timestamp format.                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `updateTime`                 | **Type:** `i64` <br /><br /> The last updated time of the position in UNIX timestamp format.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `side`                       | **Type:** `Side` <br /><br /> The position's side, either `long` or `short`.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `price`                      | **Type:** `u64` <br /><br /> The entry price of the position when it was opened. The entry price is an integer in the atomic value (before decimals), a USDC (6 decimals) value of `158225872` is equivalent to \$158.22.                                                                                                                                                                                                                                                                                          |
| `sizeUsd`                    | **Type:** `u64` <br /><br /> The position size after leverage in USD in the atomic value (before decimals). A position with `sizeUsd = 0` is treated as a closed position.                                                                                                                                                                                                                                                                                                                                         |
| `collateralUsd`              | **Type:** `u64` <br /><br /> The position's collateral size after fees in USD in the atomic value (before decimals).                                                                                                                                                                                                                                                                                                                                                                                               |
| `realisedPnlUsd`             | **Type:** `i64` <br /><br /> The position's realized PNL when closing the position partially. <br /><br />When a position is closed completely, the position's `realisedPnlUsd` will be `0` as the position is considered closed (as described in `sizeUsd`).                                                                                                                                                                                                                                                      |
| `cumulativeInterestSnapshot` | **Type:** `u128` <br /><br /> Stores the position's interest rate snapshot when it was last updated. <br /><br /> - The `collateralCustody` account for the respective collateral token stores a monotonically increasing counter in `collateralCustody .fundingRateState .cumulativeInterestRate`. <br /><br /> - The difference between the `collateralCustody .fundingRateState .cumulativeInterestRate` and the position's `cumulativeInterestSnapshot` is used to calculate the borrow fees for the position. |
| `lockedAmount`               | **Type:** `u64` <br /><br /> The amount of tokens (SOL / wETH / wBTC for long positions, USDC / USDT for short positions) locked to pay off the position's max potential profit. It acts as a cap on the maximum potential profit of the position. This amount is locked in the collateral custody to ensure the platform has sufficient tokens to pay out profitable trades.                                                                                                                                      |
| `bump`                       | **Type:** `u8` <br /><br /> The bump seed used to derive the PDA for the `Position` account.                                                                                                                                                                                                                                                                                                                                                                                                                       |


# PositionRequest Account
Source: https://dev.jup.ag/docs/perps/position-request-account

Overview of the PositionRequest account used in the Jupiter Perpetuals Program, representing a request to open or close a position

This page contains an overview of the  used in the Jupiter Perpetuals Program, and specifically the  account.

The `PositionRequest` account is a struct which represents a set of parameters and states associated to a request to open or close a position, the `PositionRequest` account consists of mostly similar properties as [`Position` account](/docs/perps/position-account).

<Info>
  **`PositionRequest` ACCOUNT DERIVATION**

  It is a Program-Derived Address (PDA) derived from the underlying `Position` account's address, several constant seeds, and a random integer seed which makes each `PositionRequest` account unique.

  The is an example [`PositionRequest` account](https://solscan.io/account/DNnX2B1oiYqKLrbLLod1guuaZA28DQwJ8HuHsgDafoQK).
</Info>

<Note>
  **`PositionRequestATA` ACCOUNT**

  A `PositionRequestATA` account is created for each `PositionRequest` account.

  The `PositionRequestATA` account is an [associated token account](https://spl.solana.com/associated-token-account) derived from the `PositionRequest` that contains the tokens from the trader's deposits or withdrawals from withdrawing collateral or closing positions.

  The tokens are then transferred to the position token's custody token account or returned to the trader's wallet when the `PositionRequestATA` account is closed.
</Note>

<Note>
  **TAKE PROFIT / STOP LOSS REQUESTS**

  `PositionRequest` accounts for non TP / SL requests are closed as soon as the request is executed or rejected.

  TP / SL requests are also stored onchain via `PositionRequest` accounts. However, they will only be closed when the TP / SL request is triggered and executed.

  Active TP / SL requests can be fetched onchain (through blockchain explorers like Solscan or SolanaFM) by searching for the `PositionRequest` address or public key associated with the TP / SL request.
</Note>

<Tip>
  **EXAMPLE TYPESCRIPT REPOSITORY**

  This [repository](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing) contains Typescript code samples on interacting with the Jupiter Perpetuals program IDL with `anchor` and `@solana/web3.js`

  You can also find the [Custody Account fields in the repository](https://github.com/julianfssen/jupiter-perps-anchor-idl-parsing/blob/1a0b5dc71081958895691047a9aa8ba51d2a8765/src/idl/jupiter-perpetuals-idl.ts#L2583) or on a [blockchain explorer](https://solscan.io/account/PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu#anchorProgramIdl).
</Tip>

## Account Details

Each `PositionRequest` account contains the following data:

| Field                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `owner`                 | **Type:** `publicKey` <br /><br /> The public key of the trader's account.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `pool`                  | **Type:** `publicKey` <br /> <br />The public key of the [JLP pool account](/docs/perps/pool-account).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `custody`               | **Type:** `publicKey` <br /><br /> The public key of the position's [`custody` account](/docs/perps/custody-account).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `collateralCustody`     | **Type:** `publicKey` <br /><br /> The public key of the position's collateral custody account. <br /><br /> Like the `custody` account, a `collateralCustody` account contains information for the token that's used as collateral for the position (SOL / wETH / wBTC for long positions, USDC / USDT for short positions). The borrow rates for the position will also be calculated based on the position's `collateralCustody`.                                                                                                                                                                                                                                                                                                           |
| `mint`                  | **Type:** `publicKey` <br /><br /> For opening positions and collateral deposits, mint refers to the input mint requested by the trader. <br /><br /> For example, if a trader opens a position by providing the initial margin with SOL, then mint will be equal to SOL's mint address. If the trader deposits collateral in USDC, then mint will be equal to USDC's mint address. <br /><br /> For closing positions and collateral withdrawals, mint is equal the to position collateral token's mint address. For example, if a trader closes a long SOL position, mint will be equal to SOL's mint address. If a trader closes a short SOL position, mint is equal to USDC or USDT's mint address depending on the position's collateral. |
| `openTime`              | **Type:** `i64` <br /><br /> The time when the request of position is created in UNIX timestamp format.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `updateTime`            | **Type:** `i64`<br /><br /> The time when the request of position is last updated in UNIX timestamp format.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `sizeUsdDelta`          | **Type:** `u64` <br /> <br />The USD amount to increase or decrease the position size by. The amount is an integer in the atomic value (before decimals which is 6 for USDC / UST mints). <br /> <br />For example, a position request to increase an open position's size by 10 USDC will have a `sizeUsdDelta = 10000000`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `collateralDelta`       | **Type:** `u64` <br /><br /> For opening positions and collateral deposits, `collateralDelta` is the token amount to increase or decrease the position collateral size by. The token amount is represented in atomic values (before decimals).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `requestChange`         | **Type:** `RequestChange` <br /> <br />`requestChange` will be equal to `Increase` for open position and collateral deposit requests, and `Decrease` for close position and collateral withdrawal requests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `requestType`           | **Type:** `RequestType` <br /> <br />`Market` for all position requests except for TP / SL requests, which have a different `requestType` known as `Trigger`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `side`                  | **Type:** `Side` <br /> <br />`Long` for long positions, `Short` for short positions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `priceSlippage`         | **Type:** `u64`<br /><br /> The maximum price with slippage for position requests when opening, closing, or updating the position size.<br /><br /> - When increasing the size of a long position or decreasing the size of a short position, the request will fail if the current price of the position's token is greater than `priceSlippage`. <br /><br />- When decreasing the size of a long position or increasing the size of a short position, the request will fail if `priceSlippage` is greater than the current price of the position's token.                                                                                                                                                                                    |
| `jupiterMinimumOut`     | **Type:** `u64` <br /> <br /> For requests that require token swaps, the output amount of the token swap must be greater than or equal to `jupiterMinimumOut`, else the request will fail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `preSwapAmount`         | **Type:** `u64` <br /><br /> This is an internal attribute used by the program to calculate the `collateralDelta` for position requests that require token swaps.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `triggerPrice`          | **Type:** `u64`<br /><br /> The price (USD) used for TP / SL position requests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `triggerAboveThreshold` | **Type:** `bool`<br /><br /> When `triggerAboveThreshold` is true, the TP / SL position request will be triggered when the position's token price is greater than or equal to `triggerPrice`. When `triggerAboveThreshold` is false, the TP / SL position request will be triggered when the position's token price is less than or equal to `triggerPrice`.                                                                                                                                                                                                                                                                                                                                                                                   |
| `entirePosition`        | **Type:** `bool` <br /><br /> This attribute is only checked when closing or decreasing position sizes. When `entirePosition` is true, the entire position will be closed (i.e. a close position request). When `entirePosition` is false, the position size will be reduced according to sizeUsdDelta.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `executed`              | **Type:** `bool`<br /> <br /> Determines whether the position request is executed or not.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `counter`               | **Type:** `u64` <br /><br /> The random integer seed used to derive the position request address.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `bump`                  | **Type:** `u8` <br /><br /> The bump seed used to derive the position request address.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |


# Jupiter Portfolio API Overview
Source: https://dev.jup.ag/docs/portfolio/index

Overview of Jupiter Portfolio API for comprehensive portfolio tracking across the Solana ecosystem

The Jupiter Portfolio provides comprehensive portfolio tracking across the Solana ecosystem. With the Portfolio API, developers can query user positions, balances, and staking information across multiple DeFi platforms and protocols.

<Info>
  **BETA**

  The Portfolio API is currently in beta. We are actively experimenting with the best ways to provide API access for projects and welcome feedback from developers.
</Info>

## About

Jupiter Portfolio has evolved significantly over time:

* **Initial Phase**: Started as per-product history and active position tracking within individual Jupiter products
* **[Sidebar Implementation](https://x.com/SolBurq/status/1838573698116390962)**: Implemented and experimented with a unified sidebar portfolio view across Jupiter's interface
* **Comprehensive Portfolio Platform**: Introduced a standalone portfolio website and API, developed by the [Sonarwatch team, now part of Jupiter](https://x.com/jup_portfolio/status/1883079851344568582)

<Tip>
  **Try it yourself**

  The portfolio website is available at [jup.ag/portfolio](https://jup.ag/portfolio).
</Tip>

## Features

The Portfolio API enables you to:

* **Query Jupiter Positions**: Retrieve position data across all Jupiter's products
* **Query Jupiter Staked JUP**: Retrieve staked JUP amounts
* **More to come soon!**

## Adding Your Project

If you're a project looking to be listed in the Portfolio Website or have your platform indexed, please reach out to our portfolio team via [Jupiter Discord](https://discord.gg/jup) in the #portfolio channel!


# Jupiter Positions
Source: https://dev.jup.ag/docs/portfolio/jupiter-positions

Query Jupiter positions, platform information, and staking data using the Portfolio API.

**BETA:** The Jupiter Positions endpoints return Jupiter-specific position data for a wallet, including wallet balances, staking positions, limit orders, DCA, liquidity pools, and leveraged trades. Filter by platform using the `platforms` query parameter, or query staked JUP directly via `/staked-jup/{address}`.

<Tip>
  **API REFERENCE**

  To fully utilize the Portfolio API, check out the [Portfolio API Reference](/api-reference/portfolio).
</Tip>

The Portfolio API provides three main endpoints to help you build portfolio tracking features:

1. **Get Positions**: Retrieve all positions for a wallet across supported platforms
2. **Get Platforms**: Discover all platforms and protocols supported by the Portfolio API
3. **Get Staked JUP**: Query staking information for Jupiter's governance token

## Get Positions

The Get Positions endpoint allows you to retrieve comprehensive position data for a wallet across all supported platforms.

To get positions for a wallet, make a GET request to `/positions/{address}`:

| Parameter | Type   | Location | Required | Description                                                                                                   |
| :-------- | :----- | :------- | :------- | :------------------------------------------------------------------------------------------------------------ |
| address   | string | path     | Yes      | The Solana wallet address you want to query                                                                   |
| platforms | string | query    | No       | Optional comma-separated list of platform IDs to filter results (e.g., `jupiter-exchange,jupiter-governance`) |

<Note>
  Only Jupiter platforms are supported currently. We do not have plans to support all/other platforms yet.
</Note>

<CodeGroup>
  ```js All positions wrap theme={null}
  const positionsResponse = await (
      await fetch(
          'https://api.jup.ag/portfolio/v1/positions/jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3',
          {
              headers: {
                  'x-api-key': 'YOUR_API_KEY'
              }
          }
      )
  ).json();

  console.log(JSON.stringify(positionsResponse, null, 2));
  ```

  ```js Filtered by platforms wrap theme={null}
  const filteredPositionsResponse = await (
      await fetch(
          'https://api.jup.ag/portfolio/v1/positions/jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3?platforms=jupiter-exchange,jupiter-governance',
          {
              headers: {
                  'x-api-key': 'YOUR_API_KEY'
              }
          }
      )
  ).json();

  console.log(JSON.stringify(filteredPositionsResponse, null, 2));
  ```
</CodeGroup>

### Response Structure

The response contains an array of `elements`, where each element represents a position (wallet balance, staking position, liquidity pool, etc.). Each element includes:

* `type`: The type of position (`multiple`, `liquidity`, `leverage`, `borrowlend`, `trade`)
* `label`: Human-readable label (e.g., `Wallet`, `Staked`, `LiquidityPool`, `LimitOrder`, `DCA`)
* `platformId`: ID of the platform this position belongs to
* `value`: USD value of the position
* `data`: Position-specific data that varies by type

The response also includes `tokenInfo` which contains token metadata (name, symbol, decimals, logoURI, etc.) organized by network, and `fetcherReports` which shows the status of each platform queried.

<Note>
  The `data` field structure varies significantly depending on the `type` of element. Each type has its own required and optional fields. Refer to the [API reference](/api-reference/portfolio/get-positions) for complete schema details.

  If you need help, reach out to us in [Discord](https://discord.gg/jup).
</Note>

## Get Platforms

Before querying positions, you might want to discover which platforms are supported by the Portfolio API. The Get Platforms endpoint returns a comprehensive list of all available platforms with their metadata.

```js theme={null}
const platformsResponse = await (
    await fetch('https://api.jup.ag/portfolio/v1/platforms', {
        headers: {
            'x-api-key': 'YOUR_API_KEY'
        }
    })
).json();

console.log(JSON.stringify(platformsResponse, null, 2));
```

Each platform object includes:

* `id`: Unique identifier for the platform - use this with the `platforms` query parameter in Get Positions
* `name`: Display name of the platform
* `image`: URL to the platform's logo/image
* `description`: Description of what the platform does
* `tags`: Array of tags categorizing the platform (e.g., `swap`, `staking`, `governance`)
* `links`: Optional object containing platform links (website, discord, twitter, etc.)
* `isDeprecated`: Whether the platform is deprecated

<Tip>
  Use the platform `id` values from this endpoint with the `platforms` query parameter in the Get Positions endpoint to filter results. This is especially useful when building UI filters or when you only need data from specific protocols.
</Tip>

## Get Staked JUP

The Get Staked JUP endpoint provides staking information specifically for Jupiter's governance token (JUP). This is useful since it is a simpler way to query for staking status, unstaking schedules, and total staked amounts.

To get staking information for a wallet, make a GET request to `/staked-jup/{address}`:

```js theme={null}
const stakedJupResponse = await (
    await fetch(
        'https://api.jup.ag/portfolio/v1/staked-jup/jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3',
        {
            headers: {
                'x-api-key': 'YOUR_API_KEY'
            }
        }
    )
).json();

console.log(JSON.stringify(stakedJupResponse, null, 2));
```

The response includes:

* `stakedAmount`: Total amount of JUP currently staked
* `unstaking`: Array of unstaking schedules, each containing:
  * `amount`: Amount being unstaked
  * `until`: Unix timestamp when the unstaking period ends


# Refer to API Reference
Source: https://dev.jup.ag/docs/prediction/coming-soon





# About Prediction
Source: https://dev.jup.ag/docs/prediction/index

Overview of Jupiter Prediction Market

<Note>
  **BETA**

  The Prediction Market API is currently in beta and subject to breaking changes as we continue to improve the product. If you have any feedback, please reach out in [Discord](https://discord.gg/jup).
</Note>

<Note>
  The API guides will be coming soon.

  In the meantime, refer to the [API Reference](/api-reference/prediction) for the latest API documentation.
</Note>

The Jupiter Prediction Market enables you to participate in binary prediction markets on Solana, allowing users to trade on the outcomes of real-world events across categories like Sports, Crypto, Politics, E-sports, Culture, Economics, and Tech.

### How It Works

Users can interact with the markets directly on Solana, and Jupiter will handle the off-chain actions required to:

* **Open Positions**: Buy YES or NO contracts on market outcomes
* **Manage Positions**: Buy to increase exposure or sell to reduce positions
* **Claim Winnings**: Receive JupUSD payouts when your predictions are correct
* **Track Performance**: Monitor positions, P\&L, and trading history

Typical flow of actions:

1. **Events are created** around real-world occurrences (e.g., "Will Solana reach \$100k by end of 2026?")
2. **Markets are established** within events, each representing a binary outcome (YES or NO)
3. **Users trade contracts** at dynamic prices that reflect market sentiment (prices range from \$0 to \$1 per contract)
4. **Events resolve** based on predetermined rules when the outcome is known
5. **Winners claim payouts** - each winning contract is worth \$1 (no payout fees)

## Architectural Components

We have generalized the Prediction Market architecture to be agnostic of the underlying data provider. This allows us to support multiple data providers and easily add new ones in the future.

### Events

Events are the top-level container for prediction markets. Each event represents a real-world occurrence that will have a determinable outcome.

**Event Properties:**

* **Event ID**: Unique identifier for the event
* **Series**: Groups related events (e.g., "NFL Week 1")
* **Category**: Primary classification (crypto, sports, politics, esports, culture, economics, tech)
* **Subcategory**: More specific classification within the category
* **Markets**: One or more binary markets within the event
* **Metadata**: Title, subtitle, images, rules documents
* **Metrics**: Total TVL, trading volume, close conditions

**Event Lifecycle:**

* Events can contain multiple markets (e.g., "Who will win the championship?" might have markets for each team)
* Events can support single winners or multiple winners depending on configuration
* Events track overall volume and liquidity across all their markets

### Markets

Markets are binary prediction markets within an event, representing specific YES/NO outcomes.

**Market Properties:**

* **Market ID**: Unique identifier derived as a PDA (Program Derived Address)
* **Status**: `open`, `closed`, or `cancelled`
* **Result**: Empty string (unresolved), `pending`, `yes`, or `no`
* **Pricing Data**: Buy/sell prices for YES and NO sides, volume, open interest, liquidity
* **Metadata**: Title, description, trading rules, resolution criteria

**Market States:**

1. **Open**: Market is actively trading, users can create orders
2. **Closed**: Trading has stopped, awaiting settlement
3. **Settled**: Result has been determined, winners can claim payouts
4. **Cancelled**: Market voided, positions returned

**Pricing Model:**

* Prices are quoted in USD (stored as micro USD on-chain)
* Each contract represents a claim to \$1 if the outcome is correct
* Separate buy and sell prices for YES and NO sides
* Prices reflect probability (e.g., 70¢ YES price = 70% probability)

### Orders

Orders represent user intentions to buy or sell contracts in a market.

**Order Properties:**

* **Order Pubkey**: Solana account address for the order
* **Owner**: User's public key
* **Market**: Target market identifier
* **Side**: YES or NO position
* **Direction**: Buy (increase exposure) or Sell (decrease exposure)
* **Contracts**: Number of contracts to trade
* **Price Limits**: `maxBuyPriceUsd` or `minSellPriceUsd`
* **Status**: `pending`, `filled`, or `failed`
* **Fill Details**: Filled contracts, average fill price, fees paid

**Order Flow:**

1. User creates an order request with desired parameters
2. API returns an unsigned Solana transaction
3. User signs and submits the transaction to Solana
4. Keeper network matches and fills the order
5. Order status updates reflect fill progress
6. Settled orders update associated positions

**Order Types:**

* **Buy Orders**: Acquire new contracts or increase position size
* **Sell Orders**: Reduce position size or exit entirely
* **Limit Orders**: Execute only at specified price or better

### Positions

Positions represent a user's holdings in a specific market side (YES or NO).

**Position Properties:**

* **Position Pubkey**: PDA derived from owner, market, and side
* **Owner**: User's public key
* **Market**: Associated market identifier
* **Side**: YES or NO position
* **Contracts**: Total contracts held
* **Cost Basis**: `totalCostUsd`, `avgPriceUsd`
* **Mark-to-Market**: `valueUsd`, `markPriceUsd` (current market value)
* **P\&L Metrics**: Unrealized P\&L, P\&L after fees, percentage returns
* **Order Activity**: Number of open orders
* **Settlement**: `claimable`, `claimed`, `claimedUsd`, `payoutUsd`

**Position States:**

* **Active**: Market is open, position has mark-to-market value and P\&L
* **Closed Market**: Market closed but not settled, P\&L frozen
* **Claimable**: Market settled favorably, payout available
* **Lost**: Market settled against the position (no payout)
* **Claimed**: Payout has been withdrawn

**P\&L Calculation:**

* **Unrealized P\&L**: (Current market value) - (Cost basis)
* **Realized P\&L**: Calculated on partial or full position closes
* **Fees**: Protocol and venue fees reduce net returns

### Vault

The Vault manages the settlement and escrow mechanism for the prediction market system.

**Vault Functions:**

* **Escrow Management**: Holds deposited JupUSD during active trading
* **Settlement Distribution**: Pays out winning positions
* **Fee Collection**: Accumulates protocol and venue fees
* **Balance Tracking**: Maintains total locked liquidity

The vault is implemented as a Solana PDA that securely holds all user deposits and ensures payouts are available when positions are claimable.

### History & Events

The History system tracks all on-chain activity for audit and user interface purposes.

**Event Types:**

* `order_created`: New order placed
* `order_filled`: Order matched and executed
* `order_failed`: Order could not be filled
* `position_updated`: Position modified by order fill
* `position_lost`: Position resolved against user
* `payout_claimed`: User withdrew winnings

**History Properties:**

* Signature and slot for on-chain verification
* Full order and position details at time of event
* Fee breakdown and P\&L calculations
* Market and event metadata snapshots

### Orderbook & Price Discovery

The orderbook system facilitates price discovery and order matching.

**Orderbook Structure:**

* **Bid/Ask Spreads**: Separate order books for YES and NO sides
* **Liquidity Depth**: Available contracts at various price levels
* **Market Data**: Best bid/ask, spreads, recent trades
* **Volume Tracking**: 24h volume, all-time volume

**Price Discovery:**

* Prices are determined by supply and demand
* Market makers can provide liquidity at various price points
* Keepers match orders efficiently
* Slippage protection via price limits

### Settlement Process

The settlement process resolves markets and enables winners to claim payouts.

**Settlement Flow:**

1. **Market Closes**: Trading stops at predetermined `closeTime`
2. **Result Determined**: Authoritative source provides outcome
3. **Market Settles**: Result recorded on-chain (`yes` or `no`)
4. **Positions Become Claimable**: Winning positions can claim payouts
5. **Users Claim**: Winners receive \$1 per contract (no payout/claim fees)
6. **Losing Positions**: Contracts become worthless

**Settlement Guarantees:**

* All outcomes are determined by transparent rules
* Settlement is final and immutable once recorded
* Payouts are guaranteed by vault reserves
* Disputed outcomes follow documented resolution procedures

## Key Concepts

### Binary Market Structure

Every market has exactly two outcomes: YES or NO. This simplicity ensures:

* Clear resolution criteria
* Straightforward pricing (probability-based)
* Easy position management
* Transparent payouts

### Contract Value

Each contract represents a claim to **\$1 if correct**:

* If you buy YES at 70¢ and YES wins, you profit 30¢ per contract
* If you buy NO at 40¢ and NO wins, you profit 60¢ per contract
* Losing contracts expire worthless

### Price as Probability

Market prices reflect implied probability:

* 70¢ YES price ≈ 70% probability of YES outcome
* 30¢ NO price ≈ 30% probability of NO outcome
* YES price + NO price ≈ \$1.00 (minus spread and fees)

### Position Management

Users can actively manage positions:

* **Buy more**: Increase exposure to an outcome
* **Sell partial**: Take profits or reduce risk
* **Close entirely**: Exit the market completely
* **Hold to settlement**: Wait for final payout

### Fees

The system charges fees on certain trading activity:

* **Platform Fees**: Underlying protocol fee
* **Total Fee**: Displayed before order execution
* **Payout Fees**: No payout/claim fees

### Account Structure (Solana)

There are a few accounts involved in the prediction market system:

1. **Position Account**: Represents a user's position in a market.
2. **Order Account**: Represents a user's order to open, close, or modify a position.
3. **Vault Account**: Represents the vault that holds the user's funds.

Upon position creation, there will be 3 transactions involved:

1. Create order: When opening a position, you sign a transaction to create an order for the position.
2. Fill order: Once the order is created, our keeper system will pick up the order and fill them directly on the underlying prediction markets.
3. Close order: Once the order is filled or not, the order will be closed.


# Jupiter Price API Overview
Source: https://dev.jup.ag/docs/price/index

Overview of Jupiter Price API providing accurate token prices across all Jupiter UIs and integrator platforms

The Jupiter Price API aims to be the source of truth of token prices across all Jupiter UIs and integrator platforms, providing a seamless experience for developers and a reliable and accurate price source for users.

## Challenges

Accurately pricing tokens on-chain is deceptively complex. Unlike traditional markets with centralized pricing mechanisms and consistent liquidity, decentralized finance (DeFi) presents a set of dynamic and often adversarial conditions. The Price API V3 is built with these realities in mind, abstracting away challenges to deliver accurate, real-time token prices with integrity and consistency.

| Challenge                                                      | Description                                                                                                                                                                                                                                                     |
| :------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gamification of Price**                                      | In decentralized environments, token prices can be manipulated or "gamed" for appearances or exploitative purposes. Common patterns include: <br /> \* Wash trading to inflate volume or imply activity <br /> \* Circular swaps to fabricate higher valuations |
| **Fragmented, Volatile or Imbalanced Liquidity Across Venues** | Liquidity on Solana (and other chains) is spread across numerous protocols and AMMs. No single source can represent the entire market. Different pools might have wildly different pricing and can change very quickly.                                         |
| **Low Liquidity Tokens**                                       | Some tokens trade rarely or only within shallow pools. In such cases, even small orders can cause large price swings, making pricing unreliable.                                                                                                                |

## How Price is Derived

The latest version of Price API is V3 - which uses the **last swapped price (across all transactions)**. The swaps are priced by working outwards from a small set of reliable tokens (like SOL) whose price we get from external oracle sources.

While and also after deriving the last swap price, we also utilize a number of heuristics to ensure the accuracy of the price and eliminate any outliers:

* Asset origin and launch method
* Market liquidity metrics
* Market behaviour patterns
* Holder distribution statistics
* Trading activity indicators
* Market value to liquidity ratios

:::caution
When using Price API, do note that you may face many tokens where price is not available or returns null.

This is because, we use the aforementioned heuristics to determine the price of a token and if the price is reliable - if certain combinations of these factors indicate potential issues with price reliability or market health, the token will be flagged and not provided a price.

This is to safeguard users and prevent an inaccurate price from being returned.
:::


# Price API V3
Source: https://dev.jup.ag/docs/price/v3

Overview of Jupiter Price API V3 providing a single source of truth for token prices across all Jupiter UIs and integrator platforms

Price API V3 aims to provide a one source of truth across all Jupiter UIs and integrator platforms. The simplified format allows easy integration while letting Jupiter handle the complexity of ensuring the accuracy of the provided prices.

## How Price is Derived

Price API V3 price tokens by using the **last swapped price (across all transactions)**. The swaps are priced by working outwards from a small set of reliable tokens (like SOL) whose price we get from external oracle sources.

While and also after deriving the last swap price, we also utilize a number of heuristics to ensure the accuracy of the price and eliminate any outliers:

* Asset origin and launch method
* Market liquidity metrics
* Market behaviour patterns
* Holder distribution statistics
* Trading activity indicators
* [Organic Score](/docs/tokens/organic-score)

## Get Price

Simply request via the base URL with the query parameters of your desired mint addresses. You can also comma-separate them to request for multiple prices.

```js theme={null}
const price = await (
    await fetch(
        'https://api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
console.log(JSON.stringify(price, null, 2));
```

## Price Response

Here is the sample response, notice a few details here:

* The `usdPrice` is the only price.
* The `decimals` response is helpful to display price information on the UI.
* The `blockId` can be used to verify the recency of the price.

```js theme={null}
{
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": {
    "usdPrice": 0.4056018512541055,
    "blockId": 348004026,
    "decimals": 6,
    "priceChange24h": 0.5292887924920519
  },
  "So11111111111111111111111111111111111111112": {
    "usdPrice": 147.4789340738336,
    "blockId": 348004023,
    "decimals": 9,
    "priceChange24h": 1.2907622140620008
  }
}
```

## Limitations

**Query limits**

* You can query up to 50 `ids` at once.

**If the price of a token cannot be found**

* Typically, it is likely that the token has not been traded recently - in the last 7 days.
* Additionally, we also use the aforementioned heuristics to determine the price of a token and if the price is reliable - if certain combinations of these factors indicate potential issues with price reliability or market health, the token will be flagged and not provided a price.
* The token is flagged as suspicious and this can be cross referenced with the Token API V2's `audit.isSus` field.

**V2 had more information**

* Yes V2 had more information, however, we think that it is not the best representation of price and it also caused different interpretations of price across the different platforms.
* With Price API V3, we are handling the complexities to ensure price accuracy and elimate outliers [using the heuristics as mentioned above](#how-price-is-derived), so there will only be one stable and accurate price source for all.
* If you require more information like Price API V2, you can use the `/quote` endpoint of the Swap API to derive those data ([you can refer to this post about how Price API V2 is derived](https://www.jupresear.ch/t/introducing-the-price-v2-api/22175)).


# Best Practices
Source: https://dev.jup.ag/docs/recurring/best-practices

Guidelines for recurring order minimum amounts, cycle requirements, and token compatibility.

| Item                                                                          | Recommendation                                                                                                                                                                        |
| :---------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Understand the Recurring Product.                                             | The Recurring API supports order creation for both recurring and smart recurring strategies. Understand the difference between the two and choose the appropriate one for your needs. |
| Both types of orders require minimum total amount of 100 USD.                 | As per the Jupiter Recurring API's requirements to prevent small orders from being created.This is similar to jup.ag's frontend check for minimum order amount.                       |
| Time-based orders require minimum number of orders of 2 and 50 USD per order. | As per the Jupiter Recurring API's requirements to prevent small orders from being created.This is similar to jup.ag's frontend check for minimum order amount.                       |
| Token-2022 tokens                                                             | The Recurring API does not currently support Token-2022 mints. Ensure you’re only scheduling orders for standard SPL tokens (Token Program) until Token-2022 support is added.        |


# Cancel Order
Source: https://dev.jup.ag/docs/recurring/cancel-order

Cancel an active recurring order and reclaim remaining funds.

The `POST /recurring/v1/cancelOrder` endpoint cancels an active recurring order and returns remaining funds to the user. The endpoint supports one cancellation per transaction. Retrieve order accounts via `/getRecurringOrders` first, then sign and submit the cancel transaction.

If you want to cancel order(s), you need to do these steps:

<Steps>
  <Step>
    Get a list of the order accounts you want to cancel via `/getRecurringOrders` endpoint.
  </Step>

  <Step>
    Choose the order account to cancel by making a post request to the `/cancelOrder` endpoint to get the transaction to cancel the order.
  </Step>

  <Step>
    Sign then send the transaction to the network either via `/execute` endpoint or by yourself.
  </Step>
</Steps>

<Note>
  **GET RECURRING ORDERS**

  [Refer to the `/getRecurringOrders` section](/docs/recurring/get-recurring-orders) to prepare the list of order accounts you want to cancel.
</Note>

<Info>
  **NOTE**

  The `/cancelOrder` endpoint only supports 1 cancellation per transaction.
</Info>

<Warning>
  **CAUTION**

  Price-based orders via API is deprecated.
</Warning>

```js theme={null}
const cancelOrderResponse = await (
    await fetch('https://api.jup.ag/recurring/v1/cancelOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            order: "4DWzP4TdTsuwvYMaMWrRqzya4UTFKFoVjfUWNWh8zhzd",
            user: wallet.publicKey,
            recurringType: "time",
        }),
    })
).json();
```

## Cancel Order Response

**Success Example Response**

```json theme={null}
{
  "requestId": "36779346-ae51-41e9-97ce-8613c8c50553",
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAgORL7cu4ZNuxh1wI9W7GVURyr3A06dH348HDpIQzcAJ4oZOZHXAukWalAX/odOiV55UZa1ePBg8d2tRKQyqCjV6C/H8IQcrfZR4QeOJFykenP3QJznc6vNpqe2D57HTD7Gd1R4MYi595YUO8ViNwpWb17+Q9DxkVcz5fWpSqjtDyiji2RfCl7yoUfzkV42QPexQNFjBK5/+pJhV8QuWShN6r9vLZM5XJNS670dgAgf7wC+wCLLIFWHgjgWx32LJMnJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBkZv5SEXMv/srbpyw5vnvIzlu8X3EmssQ5s6QAAAAAabiFf+q4GE+2h/Y0YYwDXaxDncGus7VZig8AAAAAABBt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKmMlyWPTiSJ8bs9ECkUjg2DC1oTmdr/EIQEjnvY2+n4WbB1qAZjecpv43A3/wwo1VSm5NY22ehRjP5uuuk/Ujb+tSfUXWQOPsFfYV1bDiOlSpa4PwuCC/cGNfJDSsZAzATG+nrzvtutOj1l82qryXQxsbvkwtL24OR8pgIDRS9dYVCj/auTzJLgPke1v9c3puAy81rBYgsabmuLUTEQsZyVAwcABQL9WQEABwAJA0ANAwAAAAAADA0AAg0IAQQDBQYJCgsMCBYHIWKotyLz"
}
```

**Failed Example Response**

```json theme={null}
{
  "code": 400,
  "error": "Failed to deserialize account data: failed to fill whole buffer",
  "status": "Bad Request"
}
```

## Execute Cancel Order

To sign then send the transaction to the network to execute the cancellation, you can use the `/execute` endpoint or by yourself.

Refer to the [Execute Order](/docs/recurring/execute-order) section for more details.


# Create Order
Source: https://dev.jup.ag/docs/recurring/create-order

Create a recurring DCA order with configurable frequency, amount, and start time.

This is a POST request to `/createOrder` endpoint, where you pass in the necessary parameters and our backend will create the transaction for you to sign and send to the network seamlessly.

<Note>
  **INFO**

  The Recurring API supports both Time-based and Price-based (DEPRECATED) strategies.

  The `createOrder` endpoint is used to create both types of orders based on the parameters you pass in.
</Note>

### Time-based Order

Pass in the **`time`** object in the `params` field.

<Info>
  Some notes to help you understand the parameters.

  * The amount to be spent per cycle is calculated based on your input amount and the total number of orders.

  ```js theme={null}
  Amount to be spent per cycle = inAmount / numberOfOrders
  e.g. 1_000 USDC / 10 orders = 100 USDC per order
  ```

  * The total time to complete is definite as the amount to be spent per cycle is fixed.

  ```js theme={null}
  Total time to complete = numberOfOrders * interval
  e.g. 10 orders * 86_400 seconds = 864_000 seconds = 10 days
  ```
</Info>

```js expandable theme={null}
const createOrderResponse = await (
    await fetch('https://api.jup.ag/recurring/v1/createOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            user: wallet.publicKey,
            inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            outputMint: "So11111111111111111111111111111111111111112",
            params: {
                time: {
                    inAmount: 104000000, // Raw amount of input token to deposit now (before decimals)
                    numberOfOrders: 2, // Total number of orders to execute
                    interval: 86400, // Time between each order in unix seconds
                    minPrice: null, // Minimum price or null
                    maxPrice: null, // Maximum price or null
                    startAt: null, // Unix timestamp of start time or null - null starts immediately
                },
            },
        }),
    })
).json();
```

### Price-based Order (DEPRECATED)

Pass in the **`price`** object in the `params` field.

<Warning>
  **CAUTION**

  Price-based orders via API is deprecated.
</Warning>

<Info>
  **NOTE**

  Some notes to help you understand the parameters.

  * Price-based orders are opened indefinitely until the user closes them.
  * Once low on funds, the order will not be closed and can continue to execute if the user deposits more into the order. Refer to the [Deposit Price Order](/docs/recurring/deposit-price-order) endpoint to deposit more funds into the order.
  * Alternatively, the user can also withdraw funds from the order without closing it. Refer to the [Withdraw Price Order](/docs/recurring/withdraw-price-order) endpoint to withdraw funds from the order.
  * Do note that the price-based orders auto withdraws the output tokens to the user's wallet every time the order is executed.
  * The total time to use up all funds is not definite as the amount to be spent per cycle is variable based on the USDC value of the input token.
</Info>

```js theme={null}
const createOrderResponse = await (
    await fetch('https://api.jup.ag/recurring/v1/createOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            user: wallet.publicKey,
            inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            outputMint: "So11111111111111111111111111111111111111112",
            params: {
                price: {
                    depositAmount: 110000000, // Raw amount of input token to deposit now (before decimals)
                    incrementUsdcValue: 10000000, // Raw amount of USDC to increment per cycle (before decimals)
                    interval: 86400, // Time between each cycle in unix seconds
                    startAt: null, // Unix timestamp of start time or null - null starts immediately
                },
            },
        }),
    })
).json();
```

Now that you have the order transaction, you can sign and send to the network. There are 2 methods, after signing the transaction, you can either send it to the network yourself or use the Recurring API's `/execute` endpoint to do it for you.

<CardGroup>
  <Card title="Let's execute the order" href="/docs/recurring-api/execute-order" icon="arrow-right" />
</CardGroup>

## Create Order Response

The response from the `createOrder` endpoint is as follows.

<Note>
  **INFO**

  Do note that both time-based and price-based orders will return the same response structure.
</Note>

**Successful Example Response**

```json theme={null}
{
  "requestId": "1d1f3586-eb72-4337-8c7e-1bbb9870ee4b",
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAgNRL7cu4ZNuxh1wI9W7GVURyr3A06dH348HDpIQzcAJ4o8bJlCl2Wc6MzpcvkV0INcJ7u23GV89soNJ/8i5QPLuk+NOvCjbAbTzOyNoSWuhO5fYq+hNGrGQ2JdDy82Gw0bv28tkzlck1LrvR2ACB/vAL7AIssgVYeCOBbHfYskycnT/icRrhr4nbjk0DzDqAkM4ntju8NXHrILEpE0TUKNKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwZGb+UhFzL/7K26csOb57yM5bvF9xJrLEObOkAAAAAGm4hX/quBhPtof2NGGMA12sQ53BrrO1WYoPAAAAAAAQbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpjJclj04kifG7PRApFI4NgwtaE5na/xCEBI572Nvp+FmwdagGY3nKb+NwN/8MKNVUpuTWNtnoUYz+brrpP1I2/rUn1F1kDj7BX2FdWw4jpUqWuD8Lggv3BjXyQ0rGQMwExvp6877brTo9ZfNqq8l0MbG75MLS9uDkfKYCA0UvXWG7njQ5EK9zaEM059+IQanso4m+YzpvFchLCtBxOCdR5QcGAAUCGSwAAAYACQNADQMAAAAAAAkGAAMABwUIAQEFAgADDAIAAAAAwusLAAAAAAgBAwERCw0EAAAHDAMBAgUICQoLK453K22iNAuxgF7IZwAAAAAAwusLAAAAAADh9QUAAAAALAEAAAAAAAAAAAAIBAMAAAABCQ=="
}
```

**Failed Example Response**

```json theme={null}
{
  "code": 400,
  "error": "Order is valued at 2.99 USDC, minimum is 100.00 USDC",
  "status": "Bad Request"
}
```


# Deposit Price Order
Source: https://dev.jup.ag/docs/recurring/deposit-price-order

Deprecated: Deposit funds into a price-based recurring order. Use time-based orders instead.

**This endpoint is deprecated.** Price-based recurring orders are no longer supported via the API. Use time-based orders (`params.time`) with the [`/createOrder` endpoint](/docs/recurring/create-order) instead. The documentation below is preserved for reference only.

<Warning>
  **CAUTION**

  Price-based orders via API is deprecated.
</Warning>

## Deposit Order

If you want to deposit funds into a price-based order, you need to do these steps:

<Steps>
  <Step>
    Get a list of the order accounts you want to deposit via `/getRecurringOrders` endpoint.
  </Step>

  <Step>
    Choose the order account to deposit by making a post request to the `/priceDeposit` endpoint to get the transaction to deposit into the order.
  </Step>

  <Step>
    Sign then send the transaction to the network either via `/execute` endpoint or by yourself.
  </Step>
</Steps>

<Note>
  **GET RECURRING ORDERS**

  [Refer to the `/getRecurringOrders` section](/docs/recurring/get-recurring-orders) to prepare the order account you want to deposit into.
</Note>

```js theme={null}
const priceDepositResponse = await (
    await fetch('https://api.jup.ag/recurring/v1/priceDeposit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            order: "EpTsCUnKComCd8FDNZn3kVrQBQo2uEn5rRzYk9ocqFPH",
            user: wallet.publicKey,
            amount: 1000000
        }),
    })
).json();
```

## Deposit Order Response

**Success Example Response**

```json theme={null}
{
  "requestId": "cbc021a6-8a61-49cd-8c5a-9ea29fc2dd4d",
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAcLRL7cu4ZNuxh1wI9W7GVURyr3A06dH348HDpIQzcAJ4ou00rM6bvrYH/o3YhDOZ97jIgg/zdwEtLlVk6ddEK3BXdUeDGIufeWFDvFYjcKVm9e/kPQ8ZFXM+X1qUqo7Q8ozVCa3wbmwfzRz1Av5JAlFtGgdIbvPspoQDO0MABdFvQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMGRm/lIRcy/+ytunLDm+e8jOW7xfcSayxDmzpAAAAABt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKkHNtIX+MwRgQakd3fYovqoEXuKqaHTmdCmjuWoQiMib4yXJY9OJInxuz0QKRSODYMLWhOZ2v8QhASOe9jb6fhZxvp6877brTo9ZfNqq8l0MbG75MLS9uDkfKYCA0UvXWHbZsKfr6NrDjI7Q7M2CqAquH41g9AMbtaLYPfmHMqbN3la+2QyLhVSaIunpVo3X8k4VAEj0cBT/ANSk2IKq9g1BAUABQL3nQAABQAJA0ANAwAAAAAACAYAAgAJBAYBAQcIAAMJAQIGCgcQ8iPGiVLh8rZAQg8AAAAAAA=="
}
```

**Failed Example Response**

```json theme={null}
{
  "code": 400,
  "error": "Failed to deserialize account data: failed to fill whole buffer",
  "status": "Bad Request"
}
```

## Execute Deposit Order

To sign then send the transaction to the network to execute the deposit, you can use the `/execute` endpoint or by yourself.

Refer to the [Execute Order](/docs/recurring/execute-order) section for more details.


# Execute Order
Source: https://dev.jup.ag/docs/recurring/execute-order

Submit a signed recurring order transaction for on-chain execution.

After getting the order transaction, you can sign and send to the network yourself or use the Recurring API's `/execute` endpoint to do it for you.

## Sign Transaction

Using the Solana `web3.js` v1 library, you can sign the transaction as follows:

```js theme={null}
// ... GET /createOrder's response

// Extract the transaction from the order response
const transactionBase64 = createOrderResponse.transaction

// Deserialize the transaction
const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));

// Sign the transaction
transaction.sign([wallet]);

// Serialize the transaction to base64 format
const signedTransaction = Buffer.from(transaction.serialize()).toString('base64');
```

## Execute Order

By making a post request to the `/execute` endpoint, Jupiter executes the order transaction on behalf of you/your users. This includes handling of transaction handling, priority fees, RPC connection, etc.

<Note>
  **INFO**

  Do note that you need both the signed transaction and the order id to execute the order.

  The order id is returned in the [`createOrder` response](/docs/recurring/create-order).
</Note>

```js theme={null}
const executeResponse = await (
    await fetch('https://api.jup.ag/recurring/v1/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            signedTransaction: signedTransaction,
            requestId: createOrderResponse.requestId,
        }),
    })
).json();
```

## Execute Order Response

After making the post request to the `/execute` endpoint, you will receive a response with the status of the order.

**Example response of successful order:**

```json theme={null}
{
  "signature": "...",
  "status": "Success",
  "order": "4DWzP4TdTsuwvYMaMWrRqzya4UTFKFoVjfUWNWh8zhzd",
  "error": null
}
```

**Example response of failed order:**

```json theme={null}
{
  "signature": "...",
  "status": "Failed",
  "order": null,
  "error": "Insufficient funds for the operation requested.",
}
```

## Send Transaction Yourself

If you want to handle the transaction, you can sign and send the transaction to the network yourself.

```js expandable theme={null}
const transactionBase64 = createOrderResponse.transaction
const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));

transaction.sign([wallet]);

const transactionBinary = transaction.serialize();

const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: "finalized" });

const signature = await connection.sendRawTransaction(transactionBinary, {
    maxRetries: 1,
    skipPreflight: true
});

const confirmation = await connection.confirmTransaction({
signature,
blockhash: blockhashInfo.value.blockhash,
lastValidBlockHeight: blockhashInfo.value.lastValidBlockHeight,
}, "finalized");

if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}\n\nhttps://solscan.io/tx/${signature}`);
} else console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
```


# Get Recurring Orders
Source: https://dev.jup.ag/docs/recurring/get-recurring-orders

Query active and historical recurring orders by wallet or status.

The `GET /recurring/v1/getRecurringOrders` endpoint returns active and historical recurring (DCA) orders for a given wallet. Filter by `orderStatus` (`active` or `history`) and `recurringType` (`time`). Responses are paginated with 10 orders per page.

This is a GET request to `/getRecurringOrders` endpoint. The response is paginated for every 10 orders and you can view different pages using the `page` parameter.

## Get Recurring Orders

<Info>
  **NOTE**

  * orderStatus can be either `active` or `history`
  * recurringType can be either `time` (`price` is deprecated)
  * includeFailedTx can be either `true` or `false`
</Info>

<Warning>
  **CAUTION**

  Price-based orders via API is deprecated.
</Warning>

## Active Orders

To get the active orders, you can pass in the `orderStatus` parameter as `active`.

<Tip>
  **TIP**

  You can optionally pass in the input and output token mint addresses to filter the open orders.
</Tip>

```js theme={null}
const openOrdersResponse = await (
    await fetch(
        'https://api.jup.ag/recurring/v1/getRecurringOrders?user=replaceWithPublicKey&orderStatus=active&recurringType=time',
        {
            headers: {
                'x-api-key': 'your-api-key',
            },
        }
    )
).json();
```

## Order History

To get the order history, you can pass in the `orderStatus` parameter as `history`.

```js theme={null}
const orderHistoryResponse = await (
    await fetch(
        'https://api.jup.ag/recurring/v1/getRecurringOrders?user=replaceWithPublicKey&orderStatus=history&recurringType=price',
        {
            headers: {
                'x-api-key': 'your-api-key',
            },
        }
    )
).json();
```


# Recurring (DCA) API Overview
Source: https://dev.jup.ag/docs/recurring/index

Set up automated dollar-cost averaging (DCA) with time-based recurring orders on Solana.

The Jupiter Recurring API enables you to create automated recurring orders on Solana, allowing users to set up regular token swaps that execute automatically based on time intervals or price conditions.

The Recurring API is ideal for:

* DeFi applications that want to offer dollar-cost average or value average features
* Wallets and platforms looking to provide automated investment options
* Projects that want to implement treasury management strategies

## Features

| Feature                   | Description                                                                                       |
| :------------------------ | :------------------------------------------------------------------------------------------------ |
| **Time-based recurring**  | Set up regular token swaps that execute automatically at specified time intervals.                |
| **Price-based recurring** | Create price-based recurring orders that execute when certain market conditions are met.          |
| **Any token pair**        | Create recurring orders between any token pairs supported on Metis Routing Engine.                |
| **Best execution**        | Orders are executed through Metis Routing Engine to get the best possible price across all DEXes. |
| **Flexible scheduling**   | Configure the frequency and timing of recurring orders to match your needs.                       |
| **Price strategy**        | Set a price range in time-based recurring orders.                                                 |

## Getting Started with Recurring API

1. [**Create Order**](/docs/recurring/create-order): Create a new recurring order with your desired parameters.
2. [**Cancel Order**](/docs/recurring/cancel-order): Cancel an existing recurring order.
3. [**Deposit in Price-based Orders**](/docs/recurring/deposit-price-order): Deposit funds in price-based orders.
4. [**Withdraw from Price-based Orders**](/docs/recurring/withdraw-price-order): Withdraw funds from price-based orders.
5. [**Get Recurring Orders**](/docs/recurring/get-recurring-orders): Retrieve the history of recurring orders for a specific wallet address.
6. [**Best Practices**](/docs/recurring/best-practices): Best practices for using Recurring API.

## FAQ

<AccordionGroup>
  <Accordion title="What is the fee for using Recurring API?">
    Recurring API takes 0.1% as fees.
  </Accordion>

  <Accordion title="Can integrators take fees using Recurring API?">
    Currently no.
  </Accordion>
</AccordionGroup>


# Withdraw Price Order
Source: https://dev.jup.ag/docs/recurring/withdraw-price-order

Deprecated: Withdraw funds from a price-based recurring order. Use time-based orders instead.

**This endpoint is deprecated.** Price-based recurring orders are no longer supported via the API. Use time-based orders (`params.time`) with the [`/createOrder` endpoint](/docs/recurring/create-order) instead. The documentation below is preserved for reference only.

<Warning>
  **CAUTION**

  Price-based orders via API is deprecated.
</Warning>

## Withdraw Order

If you want to withdraw funds from a price-based order, you need to do these steps:

<Steps>
  <Step>
    Get a list of the order accounts you want to withdraw via `/getRecurringOrders` endpoint.
  </Step>

  <Step>
    Choose the order account to deposit by making a post request to the `/priceDeposit` endpoint to get the transaction to deposit into the order.
  </Step>

  <Step>
    Sign then send the transaction to the network either via `/execute` endpoint or by yourself.
  </Step>
</Steps>

<Note>
  **GET RECURRING ORDERS**

  [Refer to the `/getRecurringOrders` section](/docs/recurring/get-recurring-orders) to prepare order account you want to withdraw from.
</Note>

<Warning>
  **WARNING**

  If you do not pass in `amount`, the transaction will be built to withdraw the full amount of the order.
</Warning>

```js theme={null}
const priceWithdrawResponse = await (
    await fetch('https://api.jup.ag/recurring/v1/priceWithdraw', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            order: "EpTsCUnKComCd8FDNZn3kVrQBQo2uEn5rRzYk9ocqFPH",
            user: wallet.publicKey,
            inputOrOutput: "In", // either "In" or "Out" mint, note that price-based orders auto withdraws the output tokens to the user's wallet every time the order is executed
            amount: 1000000
        }),
    })
).json();
```

## Withdraw Order Response

**Success Example Response**

```js theme={null}
{
  "requestId": "cb1c0e03-8e4a-4f85-ac36-e353c7981f5b",
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAcNRL7cu4ZNuxh1wI9W7GVURyr3A06dH348HDpIQzcAJ4oHNtIX+MwRgQakd3fYovqoEXuKqaHTmdCmjuWoQiMiby7TSszpu+tgf+jdiEM5n3uMiCD/N3AS0uVWTp10QrcFd1R4MYi595YUO8ViNwpWb17+Q9DxkVcz5fWpSqjtDyjKhKdx27tkl2VPxhBBJcKx9gSuUqMJnrF2JWtuKPpRPM1Qmt8G5sH80c9QL+SQJRbRoHSG7z7KaEAztDAAXRb0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBkZv5SEXMv/srbpyw5vnvIzlu8X3EmssQ5s6QAAAAAabiFf+q4GE+2h/Y0YYwDXaxDncGus7VZig8AAAAAABBt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKmMlyWPTiSJ8bs9ECkUjg2DC1oTmdr/EIQEjnvY2+n4Wcb6evO+2606PWXzaqvJdDGxu+TC0vbg5HymAgNFL11h22bCn6+jaw4yO0OzNgqgKrh+NYPQDG7Wi2D35hzKmzcjGx2VRtfxzpYauPv7ArfDDH2VHlwLKs45O0rZTboL4wMHAAUCnqwAAAcACQNADQMAAAAAAAEOAAAFCwgCAwEEBgkKDAEStxJGnJRtoSIBQEIPAAAAAAAA"
}
```

**Failed Example Response**

```js theme={null}
{
  "code": 400,
  "error": "Failed to deserialize account data: failed to fill whole buffer",
  "status": "Bad Request"
}
```

## Execute Withdraw Order

To sign then send the transaction to the network to execute the withdrawal, you can use the `/execute` endpoint or by yourself.

Refer to the [Execute Order](/docs/recurring/execute-order) section for more details.


# Integrate DEX into Metis
Source: https://dev.jup.ag/docs/routing/dex-integration

Requirements and steps to integrate your DEX into the Metis routing engine, including the Jupiter AMM Interface SDK and security audit prerequisites.

This guide covers how to integrate your decentralized exchange (DEX) into Jupiter's Metis routing engine. You will need to provide a DEX SDK implementing the Jupiter AMM Interface, pass security and code health checks, and demonstrate traction.

Jupiter is one of the most widely integrated protocols, so a lot of work is involved in minimizing issues on new integrations and making each integration valuable to our users and partners. Our top priority is ensuring security and providing the best prices and the best token selection for our users, so we will focus on DEXes that will bring the most benefits to them.

<Warning>
  **WE DO NOT CHARGE FEES FOR INTEGRATION.**
</Warning>

## Integration Prerequisites

As Solana grows and more DEXes are built, we have to be more cautious in the DEXes we integrate, we look into a variety of factors.

* **Code health**: It will help with integration and ensure maintainability in the future.
* **Security audit**: This is important to ensure users' funds are secure and the program is not malicious.
* **Traction**: We look at the traction of the DEX to ensure it has market demand and is well-used.
* **Team and backers**: This is a good indicator of the quality of the DEX if they are backed by or built by reputable or verifiable entities.

### AMM Interface

To facilitate integration of your DEX into the Jupiter Core Engine:

* Provide a DEX SDK that works with the [Jupiter AMM Interface](https://docs.rs/crate/jupiter-amm-interface).
* Enable us to fork your SDK, this ensures our users that we can guarantee maintenance, support for the SDK, and fix potential bugs related to integrated DEXs.

<Info>
  **NOTE**

  `get_accounts_to_update` provides the necessary accounts to fetch, they are batched and cached by the Jupiter Core Engine and delivered through `update` to the AMM instance, there might be multiple calls to `quote` using the same cache so **we do not allow any network calls** in the entire implementation.
</Info>

<Note>
  **RESOURCE AND SUPPORT**

  You can refer to the implementation guide [https://github.com/jup-ag/rust-amm-implementation](https://github.com/jup-ag/rust-amm-implementation) for easier integration with Jupiter.

  If you require assistance or have questions, reach out to us at [Discord](https://discord.gg/jup)
</Note>

<Accordion title="AMM Interface Code Example">
  ```js theme={null}
  pub trait Amm {
    // Maybe trait was made too restrictive?
    fn from_keyed_account(keyed_account: &KeyedAccount, amm_context: &AmmContext) -> Result<Self>
    where
        Self: Sized;
    /// A human readable label of the underlying DEX
    fn label(&self) -> String;
    fn program_id(&self) -> Pubkey;
    /// The pool state or market state address
    fn key(&self) -> Pubkey;
    /// The mints that can be traded
    fn get_reserve_mints(&self) -> Vec<Pubkey>;
    /// The accounts necessary to produce a quote
    fn get_accounts_to_update(&self) -> Vec<Pubkey>;
    /// Picks necessary accounts to update it's internal state
    /// Heavy deserialization and precomputation caching should be done in this function
    fn update(&mut self, account_map: &AccountMap) -> Result<()>;

    fn quote(&self, quote_params: &QuoteParams) -> Result<Quote>;

    /// Indicates which Swap has to be performed along with all the necessary account metas
    fn get_swap_and_account_metas(&self, swap_params: &SwapParams) -> Result<SwapAndAccountMetas>;

    /// Indicates if get_accounts_to_update might return a non constant vec
    fn has_dynamic_accounts(&self) -> bool {
        false
    }

    /// Indicates whether `update` needs to be called before `get_reserve_mints`
    fn requires_update_for_reserve_mints(&self) -> bool {
        false
    }

    // Indicates that whether ExactOut mode is supported
    fn supports_exact_out(&self) -> bool {
        false
    }

    fn get_user_setup(&self) -> Option<AmmUserSetup> {
        None
    }

    fn clone_amm(&self) -> Box<dyn Amm + Send + Sync>;

    /// It can only trade in one direction from its first mint to second mint, assuming it is a two mint AMM
    fn unidirectional(&self) -> bool {
        false
    }

    /// For testing purposes, provide a mapping of dependency programs to function
    fn program_dependencies(&self) -> Vec<(Pubkey, String)> {
        vec![]
    }

    fn get_accounts_len(&self) -> usize {
        32 // Default to a near whole legacy transaction to penalize no implementation
    }

    /// The identifier of the underlying liquidity
    ///
    /// Example:
    /// For RaydiumAmm uses Openbook market A this will return Some(A)
    /// For Openbook market A, it will also return Some(A)
    fn underlying_liquidities(&self) -> Option<HashSet<Pubkey>> {
        None
    }

    /// Provides a shortcut to establish if the AMM can be used for trading
    /// If the market is active at all
    fn is_active(&self) -> bool {
        true
    }
  }
  ```
</Accordion>


# Jupiter Routing Engines
Source: https://dev.jup.ag/docs/routing/index

The types of routing engines used in Jupiter's Swap product

<Info>
  **NOTE**

  If you are an exchange or market maker and want to participate in our routing system, please refer to our [DEX Integration](/docs/routing/dex-integration) and [RFQ Integration](/docs/routing/rfq-integration) guides.
</Info>

## Overview

Jupiter's routing system consists of multiple routing engines working together to provide the best possible execution price and success rate for swaps on Solana. The architecture is hierarchical, with **Juno** serving as the top-level liquidity aggregator that combines multiple routing sources, including Jupiter's proprietary engines (**Iris** and **JupiterZ**) and third-party liquidity providers.

| Engine       | Description                                                                                                                                                                 |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Juno**     | Latest liquidity aggregator that combines multiple sources (Iris, JupiterZ, DFlow, OKX) with self-learning mechanisms. Powers Ultra Swap and accessible via Ultra Swap API. |
| **Iris**     | Advanced routing engine for Jupiter Ultra, delivering best execution across Solana DEXes through multi-hop, multi-split swaps.                                              |
| **JupiterZ** | RFQ system connecting users with market makers, creating competitive quotes for top token pairs.                                                                            |
| **Metis**    | Low-level routing engine providing granular control over swap instructions for developers needing maximum flexibility.                                                      |

## Juno Liquidity Engine

Juno is Jupiter's latest liquidity engine, it is built with the combined learnings from Iris and JupiterZ, with one single objective - to ensure the best possible execution price and success rate across all engines and liquidity sources. Juno employs a sophisticated self-learning mechanism to maintain high availability of competitive routes while automatically sidelining underperforming or potentially problematic quotes. Juno will be incrementally introducing new third-party liquidity sources and a continual effort to improve Iris and JupiterZ routing capabilities.

|                              |                                                                                                                                                                                                                                                                                                                                      |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-liquidity sources**  | Integrates third-party liquidity sources and Jupiter's proprietary routing engines to ensure best possible rates.      Currently, Juno consists of Iris, JupiterZ, Hashflow, DFlow and more in the pipeline.                                                                                                                         |
| **Self-learning**            | Automatically detects and sidelines underperforming or problematic sources, while continuously learning to provide competitive quotes.                                                                                                                                                                                               |
| **Continuous optimizations** | By integrating external liquidity sources directly, Juno creates a competitive environment that drives continuous improvement across all routing engines. This approach ensures users consistently receive optimal execution rates while providing valuable performance data to enhance both Iris and JupiterZ routing capabilities. |

Juno is directly powering the Ultra Swap on Jupiter frontend (jup.ag) and is also accessible via [**Ultra Swap API**](/docs/ultra): The Jupiter Ultra Swap API is the *only* API you ever need to experience or build the best trading experience on Solana - Jupiter handles all the complexities such as RPCs, slippage, broadcast method and landing rates, all while accessing the best liquidity available through Juno.

## Jupiter Iris Routing Engine

Iris is Jupiter's latest and most advanced routing engine, purpose-built for Jupiter Ultra to deliver the best execution price across Solana's diverse liquidity landscape. This new engine reflects our deep learnings from previous iterations and is at the core of Jupiter Ultra's unmatched execution performance.

<Card href="/blog/ultra-v3" icon="book-open">
  Iris is our new router exclusive to Jupiter Ultra, our Ultra V3 blog post discusses the improvements and benefits of Iris.
</Card>

Behind Iris is a proven history of innovation: Jupiter’s original DEX aggregation engine, Metis v1 (launched 2023), set the standard as a reliable, general-purpose liquidity engine for Solana. Successive updates such as Metis v1.5 (April 2025) were introduced for Ultra, and these lessons and ongoing experiments directly informed the design and capabilities of Iris, making it the next evolutionary step in Jupiter’s routing technology.

|                                              |                                                                                                                                       |
| :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **Overcoming SVM constraints**               | Employs a sophisticated and efficient transaction construction to enable multi-hop-multi-split swaps.                                 |
| **Integrating diverse DEXes**                | Utilizes a standardized interface to integrate with a wide range of DEXes, abstracting away the complexities of each individual DEX.  |
| **Optimizing for price and execution**       | Ensuring the quoted price is as close as the actual price, while also ensuring the transaction is executed successfully.              |
| **Accessing markets immediately and safely** | Employs necessary infrastructure powered by a network of robust RPC nodes to include markets and checks their liquidity in real-time. |
| **Market Revival**                           | Dynamically re-indexes markets to enable tradability for all tokens.                                                                  |

## JupiterZ (RFQ) Routing Engine

Since its launch in 2024, JupiterZ has emerged as a transformative addition to Jupiter's routing capabilities. JupiterZ functions as an RFQ (Request For Quote) system that connects users directly with market makers, enabling market makers to provide competitive quotes for top token pairs. This ensures users receive the best possible execution price available from both on-chain and off-chain liquidity at the moment they wish to trade.

|                                        |                                                                                                                                                                    |
| :------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Intent-based architecture**          | Employs an intent-based system where users express their desired trade and market makers compete to fulfill it.                                                    |
| **Integrating diverse market makers**  | Utilizes a standardized interface to integrate with multiple market makers, abstracting away the complexities of each liquidity provider.                          |
| **Optimizing for price and execution** | Creates a competitive environment where market makers compete to provide the best quotes, while ensuring the transaction is executed successfully and efficiently. |
| **Real-time quote aggregation**        | Employs a versatile proxy to collect and compare quotes from multiple routing sources (such as Jupiter Iris and JupiterZ) in real-time.                            |
| **Gasless transactions**               | Enables users to execute trades without incurring transaction fees, providing a seamless and cost-effective trading experience.                                    |

JupiterZ has been handling a large portion of trades on the Jupiter frontend (jup.ag) - which has demonstrated JupiterZ's reliability and effectiveness in providing competitive quotes and successful trade execution.

Currently, JupiterZ is accessible through the **Ultra Swap API**: A streamlined interface that makes it simple for developers and applications to tap into Iris, JupiterZ and other routing sources.

For more information about JupiterZ, please refer to our [RFQ Integration](/docs/routing/rfq-integration) guide.

## Metis Routing Engine

Metis is Jupiter's original, low-level routing engine designed for maximum flexibility, transparency, and composability. Unlike Jupiter Ultra and its Iris engine, which focus on end-to-end execution and abstraction, Metis exposes granular control over raw swap instructions, making it ideal for developers, advanced integrators, and builders who need to fine-tune every aspect such as adding custom instructions, CPI, transaction execution and more.

<Card href="/blog/metis-v7" icon="book-open">
  Metis is now an independent public good, no longer coupled to Jupiter or Ultra, and is maintained as a toolkit for the ecosystem.

  Though Jupiter continues to provide access to a hosted Metis API for developers.
</Card>

Metis can be accessed either via the Jupiter-hosted Metis Swap API at [this section of the docs](/docs/swap), or by running your own self-hosted binary (requires a binary key and 10,000 staked JUP) at [metis.builders](https://metis.builders).


# Market Listing
Source: https://dev.jup.ag/docs/routing/market-listing

Understand how markets are listed and maintained on Jupiter.

This page explains how markets are listed and maintained in Jupiter's Iris routing engine. There are two routing types: instant routing (automatic listing for new markets on supported DEXes with a grace period) and normal routing (requires meeting liquidity criteria checked every 30 minutes).

## Routing Type

Iris creates routes in the perspective of markets and there are 2 types of routing for all markets.

We constantly index for updated market data and newly created markets to check against the rules for market listing to ensure markets are eligible for and remain in the Iris routing engine.

<Card title="Instant routing">
  * We automatically list all new markets that are created on specific DEXes (list is below).
  * These markets have a grace period, where the liquidity criteria is not applied.
  * The grace period is determined by token age and not market age.

    <Tip>
      **Token age check**

      | Token Age | Scenario                        | Result                               |
      | --------- | ------------------------------- | ------------------------------------ |
      | -         | Token minted, no pool           | -                                    |
      | 1 day     | First pool created and trading  | Within grace period, instant routing |
      | 20 days   | Second pool created and trading | Within grace period, instant routing |
      | 30 days   | Third pool created and trading  | Outside grace period, normal routing |
    </Tip>
  * After the grace period has passed, the liquidity criteria will apply (refer to normal routing).
  * For bonding curves, if it does not graduate after the grace period, it will be removed from routing.
    * Only when the bonding curve has graduated to a new market, the graduated market will be added to routing.

  <Accordion title="List of DEXes that are eligible for Instant Routing">
    - Meteora Dynamic Bonding Curve
    - Meteora Dynamic AMM
    - Meteora DAMM V2
    - Meteora DLMM
    - Raydium
    - Raydium CLMM
    - Raydium CPMM
    - Raydium Launchlab
    - Pump.fun AMM
    - Pump.fun
    - Fluxbeam
    - Whirlpool
    - Moonshot
    - Virtuals
    - Boop.fun
  </Accordion>
</Card>

<Card title="Normal routing">
  * This is the default for all markets.
  * Every 30 minutes, we will check the liquidity of the market.
  * If the liquidity is not enough, we will remove the market from routing.
  * Refer to [Market Liquidity Requirements](#market-liquidity-requirements) for more details.
</Card>

## Market Liquidity Requirements

The market must fit one of the following criteria for it to be routable:

1. **Less than 30% price difference on \$500**

Using a benchmark position size of \$500, a user should encounter less than 30% price difference after buying \$500 worth and then selling back on the same market.

Price Difference = (\$500 - Final USD value) / \$500 If the price difference is more than 30%, it means that there is insufficient liquidity in the market for the benchmark position size of \$500.

2. **Less than 20% price impact on market**

If the above (sell back \$500 worth) fails, we will compare the price per token received from buying \$1000 worth vs the price per token received from buying \$500 worth to calculate price impact.

If the price impact is more than 20%, it means that the market is illiquid.

<Tip>
  If you are unsure if your market has passed the liquidity requirement, you can check your pool directly via the UI of the DEX you created the market on.
</Tip>


# Integrate MM into JupiterZ (RFQ)
Source: https://dev.jup.ag/docs/routing/rfq-integration

Integrate your market maker into the JupiterZ RFQ system with webhook-based quoting.

This guide covers how to integrate your market maker into JupiterZ, Jupiter's RFQ (Request For Quote) system. You will host a webhook implementing the RFQ API schema with quote, swap, and tokens endpoints, meet fulfillment requirements (95% fill rate, 250ms response time), and complete end-to-end testing before going live.

<Warning>
  **CAUTION**

  The integration requirements are subjected to change and please provide suggestions or feedbacks on ways to improve the integration process.
</Warning>

<Frame>
  <img alt="RFQ Flow" />
</Frame>

## Integration Prerequisites

* Host a service that adheres to our RFQ API schema
* Provide a webhook for Jupiter to send quotes and swap transactions
* Complete end-to-end integration tests
* When ready, you will be onboarded to Edge before going live on production

<Info>
  **NOTE**

  Please reach out to us in [Discord](https://discord.gg/jup) in the [Developer Support channel](https://discord.com/channels/897540204506775583/910250162402779146)

  * If you are interested to participate in Jupiter Z
  * If you need any help or clarification regarding the integration.
  * To begin onboarding to Edge.
</Info>

### Example Integration

To facilitate the integration, we provide an [integration SDK in this repository](https://github.com/jup-ag/rfq-webhook-toolkit).

* [**Sample server**](https://github.com/jup-ag/rfq-webhook-toolkit/tree/main/server-example/): Implements the webhook API in Rust.
* [**API Schema**](https://github.com/jup-ag/rfq-webhook-toolkit/tree/main/openapi): OpenAPI schema for the RFQ API.
* [**Integration tests**](https://github.com/jup-ag/rfq-webhook-toolkit/tree/main/tests/): Verify the implementation of the webhook.
* [**Troubleshooting**](https://github.com/jup-ag/rfq-webhook-toolkit/tree/main/tests/README.md#troubleshooting): Common issues that arise during integration.

### RFQ API Schema

To facilitate the integration into Jupiter's RFQ module, you will need to provide a webhook for us to register the quotation and swap endpoints with the corresponding request and response format.

| Endpoint | Method | URL                                                | Description                                                                                                   |
| :------- | :----- | :------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| Base URL | -      | `https://your-api-endpoint.com/jupiter/rfq`        | Example URL that we will register into our API.                                                               |
| Quote    | POST   | `https://your-api-endpoint.com/jupiter/rfq/quote`  | Called to request quotes.                                                                                     |
| Swap     | POST   | `https://your-api-endpoint.com/jupiter/rfq/swap`   | Called to execute swaps.                                                                                      |
| Tokens   | GET    | `https://your-api-endpoint.com/jupiter/rfq/tokens` | Called periodically to fetch supported tokens ([see the token section below](#advertising-supported-tokens)). |

<Info>
  **API KEY**

  If you require an API key to access your endpoints, please provide it to us during the registration process. The API Key will be passed to the webhook as a header `X-API-KEY`.
</Info>

### Response Codes

Market Makers should return appropriate HTTP status codes along with error messages.

| Status Code         | Description                                                                                                                                  |
| :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------- |
| `200 OK`            | The request was successful, and the webhook will return a quote.                                                                             |
| `404 Not Found`     | The webhook will not return a quote for this request (e.g. the pair or the size are not supported).                                          |
| `400 Bad Request`   | The request sent to the webhook is malformed (e.g. missing an expected parameter).                                                           |
| `401 Unauthorized`  | Authorization failed. For example the `X-API-KEY` is missing or incorrect.                                                                   |
| `50x Server Errors` | The webhook is offline or unable to respond. If the status persist, the webhook will be temporarily suspended and will not receive requests. |

<Info>
  **TIMEOUTS**

  A webhook must adhere to the [fulfillment and response time requirements](#fulfillment-requirements). When sending the quote request, the RFQ system includes the following headers:

  | <span>Header</span> | <span>Description</span>                                           |
  | :------------------ | :----------------------------------------------------------------- |
  | `x-request-start`   | The millisecond timestamp indicating when the request was sent.    |
  | `x-request-timeout` | The millisecond timeout for the request (currently set to 250 ms). |
</Info>

## Integration Notes

### Order Engine

The RFQ functionality depends on the mainnet deployment of the [Order Engine Program](https://solscan.io/account/61DFfeTKM7trxYcPQCM78bJ794ddZprZpAwAnLiwTpYH) for order fulfillment.

* **Source Code**: The program's source is located in the [programs/order-engine](https://github.com/jup-ag/rfq-webhook-toolkit/tree/main/programs/order-engine) directory.
* **IDL**: The Interface Definition Language (IDL) file is available [here](https://github.com/jup-ag/rfq-webhook-toolkit/tree/main/idls).

### Fulfillment Requirements

To ensure market makers stay competitive and responsive, we enforce a minimum benchmark for fulfillment and response times.

* **Fulfillment**: Market makers are expected to comply and fulfill **95%** of the quotes provided within a 1-hour window. If this is not met, the market maker will be turned off.
* **Response Time**: A webhook must respond within **250 ms** of receiving a quote request. If it fails to do so, the RFQ system will proceed with the available quotes at the time.

<Warning>
  **CAUTION**

  To resume operations, we will need to manually re-enable your webhook, please reach out to us if this happens.
</Warning>

### Expiry

We enforce a fixed expiry timing flow for all quotes and transactions. This simplifies the integration by removing the need for market makers to specify custom expiry times in quote requests, providing consistent behavior across all quotes and transactions, and establishing clear timeout boundaries at different stages of the flow.

**Breakdown of the expiry flow:**

* **Total of 55 seconds**: Transaction expiry time
* **1st 35 seconds**: Reserved for the webhook to verify, sign, and send the transaction on-chain
* **2nd 20 seconds**: Allocated for the user to accept the quote

<Info>
  **NOTE**

  The frontend automatically re-quotes every 3 seconds.
</Info>

<Warning>
  **CAUTION**

  These expiry thresholds may be adjusted based on performance and feedback.
</Warning>

### Fees

Jupiter RFQ allows MMs a way to provide liquidity, adjust their quotes without being subject to the volatility of on-chain gas prices or chain health. RFQ fills are also much less CU intensive (\< 10x) compared to AMM swaps, and can save gas in the long run on fills. Today, RFQ, when operating in Ultra mode, charges a dynamic fee that is selected based on factors like tokens and size.

**Dynamic Fee**

The dynamic fee amount is forwarded to webhooks in the quote request parameters and it is contained in the message that both taker and maker sign ([see the payload section below](#non-standard-payload)). In manual mode, the fee is a flat 2pbs.

**Fee Calculation**

Webhooks do not need to account for fees when quoting, the fee is applied directly by the RFQ system during transaction building.

* For example, for a quote of 1 SOL to 1,000 USDC with a fee of 100 bps
* Only 990 USDC will be transferred out of the market maker account
* While 10 USDC will be collected as a fee

<Info>
  **NOTE**

  The fee is not automatically transferred and will be accounted for asynchronously on a regular basis.

  This is subject to change in the future.
</Info>

### Non-standard payload

The transaction data includes, beside the instruction data for the order-engine, 3 additional bytes that are appended to the instruction data. These bytes are not processed by the program and are only information and to be consumed by an off-chain consumer. The first 2 bytes contains the fee amount in basis points (u16) and the third byte (u8) is a bit mask where the least significant bit indicates if the swap is exact-in (0) or exact-out (1).

### Advertising Supported Tokens

In order to receive relevant quote requests, market makers need to advertise the tokens they support. This is done by providing a list of supported tokens in the response to the `/tokens` route. The response should be a JSON array of token addresses. The list of tokens is refreshed every 10 minutes.

## FAQ

<AccordionGroup>
  <Accordion title="Does RFQ support native SOL?">
    Yes, native SOL is fully supported in the order-engine program for both the taker (user) and the maker. However, for now, we assume the maker will use WSOL (Wrapped SOL).
  </Accordion>

  <Accordion title="Do faster quotes receive priority?">
    No, the RFQ system dispatches the quote request to all registered webhooks simultaneously. All quotes received within the quote timeout are compared to select the best one. The selection prioritizes the quote value first (In the unlikely scenario where two quotes have identical values, the quote from the webhook with the faster response time will be actually prioritized).
  </Accordion>

  <Accordion title="Shall a webhook verify swap requests?">
    Yes, the RFQ system will verify the swap requests before forwarding them to the webhooks. However, webhooks are encouraged to verify the swap requests as well to ensure the integrity of the system. The checks that the RFQ system performs can be found in the <a href="https://github.com/jup-ag/rfq-webhook-toolkit/blob/de46a38c3cfbda730c026a9b4bea85591c83f9e5/order-engine-sdk/src/fill.rs#L151">validate\_similar\_fill\_sanitized\_message</a> function.
  </Accordion>

  <Accordion title="Is there a penalty for not providing a quote (status code 404)?">
    No, there is no penalty. It is up to the webhook to decide whether to respond with a quote (<code>200 OK</code>) or indicate that it cannot provide one (<code>404 Not Found</code>).

    For example, suppose a webhook provides quotes for USDC/SOL only within a range of 100 to 1000 USDC. If it receives a quote request for 10 USDC → SOL, it will respond with <code>404 Not Found</code>, since the amount is outside its quoting range.

    In another case, a webhook may only support one-way quotes (USDC → SOL) but not SOL → USDC. If it receives a request for SOL → USDC, it will also return <code>404 Not Found</code>.
  </Accordion>

  <Accordion title="Is there a fee applied to stable-to-stable swaps?">
    No. Stable to stable swaps are exempt from fees.
  </Accordion>
</AccordionGroup>


# Token Listing
Source: https://dev.jup.ag/docs/routing/token-listing

Understand how tokens are listed and verified on Jupiter.

Jupiter's routing engine creates routes in the perspective of markets. A token must have a market with sufficient liquidity to be tradable. This page links to resources for understanding token listing, the Tokens API, and the token verification process.

Jupiter's routing engine creates routes in the perspective of markets, if you have minted/created a token but does not have a [market created with liquidity](/docs/routing/market-listing), your token will not be tradable.

To understand more about Tokens in Jupiter's products, please refer to the following resources.

<CardGroup>
  <Card title="About Tokens" href="/docs/tokens" icon="book">
    Learn more about Jupiter's token listing and verification process.
  </Card>

  <Card title="Tokens API" href="/api-reference/tokens" icon="code">
    Use Jupiter's Tokens API to search for and get token information.
  </Card>

  <Card title="Token Verification" href="https://jup.ag/verify" icon="badge-check">
    To verify your token, please submit your token to the Verify website.
  </Card>
</CardGroup>


# Craft Clawback (Beta)
Source: https://dev.jup.ag/docs/send/craft-clawback

Reclaim tokens from an unclaimed Send invite before it expires.

This guide walks through crafting a Clawback transaction using the `/send/v1/craft-clawback` endpoint. You will load an existing invite code, derive the Program Derived Address (PDA), POST to the endpoint, then sign with the sender keypair to reclaim unclaimed tokens.

## Overview

<Steps>
  <Step>
    Load invite code.
  </Step>

  <Step>
    Load public key from invite.
  </Step>

  <Step>
    Find the [Program Derived Address (PDA)](https://solana.com/core/pda) of the invite.

    * Uses `"invite"` and the public key of recipient at seed.
  </Step>

  <Step>
    Post request to get Clawback transaction.
  </Step>

  <Step>
    Sign with sender keypair, then send transaction and wait for confirmation.
  </Step>
</Steps>

<Info>
  **NOTE**

  [Please ensure that you have set up the prerequisites](/docs/send/invite-code#overview).
</Info>

<Accordion title="Full Code Snippet">
  ```js theme={null}
  import { invite_code_to_priv_key } from "./utils.js";
  import {
    Connection,
    Keypair,
    PublicKey,
    VersionedTransaction,
  } from "@solana/web3.js";
  import fs from "fs";

  const connection = new Connection('insert-rpc');
  const senderPrivateKey = JSON.parse(fs.readFileSync('/Path/to/sender/id.json', 'utf8').trim());
  const sender = Keypair.fromSecretKey(new Uint8Array(senderPrivateKey));
  process.loadEnvFile('.env');

  // STEP 1: Load invite code
  const invite_code = process.env.INVITE_CODE;

  // STEP 2: Load the public key from the invite code
  const secret_key = invite_code_to_priv_key(invite_code);
  const pubkey = Keypair.fromSecretKey(secret_key).publicKey;

  // STEP 3: Find the Program Derived Address (PDA) for the invite
  // Uses `"invite"` as seed + the public key
  // PDAs are deterministic addresses owned by the program
  const invite_pda = PublicKey.findProgramAddressSync(
      [Buffer.from("invite"), pubkey.toBuffer()],
      new PublicKey("inv1tEtSwRMtM44tbvJGNiTxMvDfPVnX9StyqXfDfks")
    )[0];

  // STEP 4: Post request for a Clawback transaction
  const craftClawbackTransaction = await (
      await fetch ('https://api.jup.ag/send/v1/craft-clawback', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'your-api-key',
          },
          body: JSON.stringify({
              invitePDA: invite_pda.toBase58(),
              sender: sender.publicKey.toBase58(),
          }, null, 2)
      })
  ).json();

  // STEP 5: Use sender keypair to sign and send to network
  const transaction = VersionedTransaction.deserialize(Buffer.from(craftClawbackTransaction.tx, 'base64'));
  transaction.sign([sender]); // SIGN with SENDER
  const transactionBinary = transaction.serialize();
  const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: "confirmed" });

  const signature = await connection.sendRawTransaction(transactionBinary, {
    maxRetries: 0,
    skipPreflight: true,
  });

  // Log the signature immediately after sending, before confirmation
  console.log(`Transaction sent: https://solscan.io/tx/${signature}`);

  try {
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: blockhashInfo.value.blockhash,
      lastValidBlockHeight: blockhashInfo.value.lastValidBlockHeight,
    }, "confirmed");

    if (confirmation.value.err) {
      console.error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      console.log(`Examine the failed transaction: https://solscan.io/tx/${signature}`);
    } else {
      console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
    }
  } catch (error) {
    console.error(`Error confirming transaction: ${error}`);
    console.log(`Examine the transaction status: https://solscan.io/tx/${signature}`);
  }
  ```
</Accordion>

## Imports

```js theme={null}
import { invite_code_to_priv_key } from "./utils.js";
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import fs from "fs";

const connection = new Connection('insert-rpc');
const senderPrivateKey = JSON.parse(fs.readFileSync('/Path/to/sender/id.json', 'utf8').trim());
const sender = Keypair.fromSecretKey(new Uint8Array(senderPrivateKey));
process.loadEnvFile('.env');
```

## Invite Code and Public Key

```js theme={null}
// STEP 1: Load invite code
const invite_code = process.env.INVITE_CODE;

// STEP 2: Load the public key from the invite code
const secret_key = invite_code_to_priv_key(invite_code); // Follow the utils.js guide
const pubkey = Keypair.fromSecretKey(secret_key).publicKey;
```

## Invite PDA

```js theme={null}
// STEP 3: Find the Program Derived Address (PDA) for the invite
// Uses `"invite"` as seed + the public key
// PDAs are deterministic addresses owned by the program
const invite_pda = PublicKey.findProgramAddressSync(
    [Buffer.from("invite"), pubkey.toBuffer()],
    new PublicKey("inv1tEtSwRMtM44tbvJGNiTxMvDfPVnX9StyqXfDfks")
  )[0];
```

## Craft Clawback

<Info>
  **NOTE**

  The clawback will return the full amount including leftover transaction fees and/or rent back to the sender.
</Info>

```js theme={null}
// STEP 4: Post request for a Clawback transaction
const craftClawbackTransaction = await (
    await fetch ('https://api.jup.ag/send/v1/craft-clawback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            invitePDA: invite_pda.toBase58(),
            sender: sender.publicKey.toBase58(),
        }, null, 2)
    })
).json();
```


# Craft Send (Beta)
Source: https://dev.jup.ag/docs/send/craft-send

Build a Send transaction that transfers tokens to a recipient via an invite code.

This guide walks through crafting a Send transaction using the `/send/v1/craft-send` endpoint. You will generate an invite code, derive a recipient keypair, POST to the endpoint, then sign with both sender and recipient keypairs before submitting.

## Overview

<Steps>
  <Step>
    Create invite code.
  </Step>

  <Step>
    From utils, derive the secret key - a deterministic 64-byte Solana secret key (32 bytes private + 32 bytes public key).
  </Step>

  <Step>
    Create Solana Keypair instance from the secret key.
  </Step>

  <Step>
    Post request to get Send transaction.
  </Step>

  <Step>
    Sign with both sender and recipient keypair, then send transaction and wait for confirmation.
  </Step>
</Steps>

<Info>
  **NOTE**

  [Please ensure that you have set up the prerequisites](/docs/send/invite-code#overview).
</Info>

<Accordion title="Full Code Snippet">
  ```js theme={null}
  import { create_invite_code, invite_code_to_priv_key } from "./utils.js";
  import {
    Connection,
    Keypair,
    VersionedTransaction,
  } from "@solana/web3.js";
  import fs from "fs";

  const connection = new Connection('insert-rpc');
  const senderPrivateKey = JSON.parse(fs.readFileSync('/Path/to/sender/id.json', 'utf8').trim());
  const sender = Keypair.fromSecretKey(new Uint8Array(senderPrivateKey));

  // STEP 1: Create 12-character invite code
  const invite_code = await create_invite_code();

  // STEP 2: Derive secret key (public and private key)
  const secret_key = invite_code_to_priv_key(invite_code);

  // STEP 3: Use secret key to create Solana Keypair instance
  const recipient = Keypair.fromSecretKey(secret_key);

  // STEP 4: Post request for a Send transaction
  const craftSendTransaction = await (
      await fetch ('https://api.jup.ag/send/v1/craft-send', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'x-api-key': 'your-api-key',
          },
          body: JSON.stringify({
              inviteSigner: recipient.publicKey.toBase58(),
              sender: sender.publicKey.toBase58(),
              amount: "10000000", // atomic amount before decimals
              // mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Defaults to SOL if `mint` is not provided
          }, null, 2)
      })
  ).json();

  // STEP 5: Use sender and receipient keypair to sign and send to network
  const transaction = VersionedTransaction.deserialize(Buffer.from(craftSendTransaction.tx, 'base64'));
  transaction.sign([sender, recipient]); // SIGN with both SENDER and RECIPIENT keypair
  const transactionBinary = transaction.serialize();
  const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: "confirmed" });

  const signature = await connection.sendRawTransaction(transactionBinary, {
    maxRetries: 0,
    skipPreflight: true,
  });

  // Log the signature immediately after sending, before confirmation
  console.log(`Transaction sent: https://solscan.io/tx/${signature}`);

  try {
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash: blockhashInfo.value.blockhash,
      lastValidBlockHeight: blockhashInfo.value.lastValidBlockHeight,
    }, "confirmed");

    if (confirmation.value.err) {
      console.error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      console.log(`Examine the failed transaction: https://solscan.io/tx/${signature}`);
    } else {
      console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
    };
  } catch (error) {
    console.error(`Error confirming transaction: ${error}`);
    console.log(`Examine the transaction status: https://solscan.io/tx/${signature}`);
  };
  ```
</Accordion>

## Imports

```js theme={null}
import { create_invite_code, invite_code_to_priv_key } from "./utils.js";
import {
  Connection,
  Keypair,
} from "@solana/web3.js";
import fs from "fs";

const connection = new Connection('insert-rpc');
const senderPrivateKey = JSON.parse(fs.readFileSync('/Path/to/sender/id.json', 'utf8').trim());
const sender = Keypair.fromSecretKey(new Uint8Array(senderPrivateKey));
```

## Create Invite Code

```js theme={null}
// STEP 1: Create 12-character invite code
const invite_code = await create_invite_code();

// STEP 2: Derive secret key (public and private key)
const secret_key = invite_code_to_priv_key(invite_code);

// STEP 3: Use secret key to create Solana Keypair instance
const recipient = Keypair.fromSecretKey(secret_key);
```

## Craft Send

<Info>
  **API PARAMS**

  * The `amount` is in its atomic value before applying decimals, e.g. 1 USDC is 1\_000\_000.
  * The `mint` defaults to SOL if not provided, if provided it can be any token mint.
</Info>

<Info>
  **SIGNING AND SENDING**

  * After getting the transaction, you need to sign with **both sender and recipient** keypair.
  * You can send the transaction to the network via any method.
</Info>

```js theme={null}
// STEP 4: Post request for a Send transaction
const craftSendTransaction = await (
    await fetch ('https://api.jup.ag/send/v1/craft-send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            inviteSigner: recipient.publicKey.toBase58(),
            sender: sender.publicKey.toBase58(),
            amount: "10000000",
            // mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        }, null, 2)
    })
).json();
```


# Jupiter Send API Overview
Source: https://dev.jup.ag/docs/send/index

Overview of Jupiter Send API for gifting, paying, or onboarding users even without a wallet

The Jupiter Send API lets you send tokens to any user — even if they don't have a connected wallet. Recipients claim their tokens through Jupiter Mobile. The API supports crafting send transactions, managing invites, and clawback of unclaimed sends.

Send is the perfect onboarding tool to gift, pay, or onboard anyone in seconds - even if they don't have a wallet.

* Send any token - SOL, USDC or memecoins.
* Send to a new user without a wallet, existing user or anyone.
* No fees to send or claim, only network transaction fees required.
* Use Jupiter Mobile seamlessly - even if you sent non-SOL tokens, Ultra provides Gasless Support that pays for swap transaction fees.

## About

Send API provides more opportunities for potential users to be onboarded from other websites, apps, or any where else!

* API only supports creating Send and Clawback transactions.
* Claiming needs to be done via Jupiter Mobile only.
* You can gamify the experience post-claim once they are onboarded!

## Jupiter Mobile Adapter

To maximize users experience, once your users have claimed via Jupiter Mobile, they can use the app to continue their journey on your app or other use cases. This can be done via [Jupiter Mobile Adapter](/tool-kits/wallet-kit/jupiter-mobile-adapter), allowing Jupiter Mobile users to simply use the app to scan a QR code to login, they can utilize their wallets on Jupiter Mobile across any platform.

## FAQ

<AccordionGroup>
  <Accordion title="How to does claim work?">
    * The invite code can be in the format of a link or a QR code.
  </Accordion>

  <Accordion title="How to claim via API or on my own app?">
    * No, Send claims should be done in Jupiter Mobile.
  </Accordion>

  <Accordion title="Can I get my funds back?">
    * Send is end-to-end self-custodial, where if recipient never claims, the invite code becomes invalid and your tokens are sent back to you upon expiry.
    * Or use the clawback endpoint via the API to create the clawback transaction.
  </Accordion>
</AccordionGroup>


# Invite Code (Beta)
Source: https://dev.jup.ag/docs/send/invite-code

Generate invite codes and derive deterministic keypairs for the Send API.

This page covers the client-side prerequisites for the Send API: generating random 12-character base58 invite codes, deriving deterministic Solana secret keys from those codes, and the security requirements for handling invite codes and private keys.

## Security

The Send API is designed for **transaction building only** - it expects and exchanges parameters such as public keys, amounts, and mint addresses. The API **does not handle private keys or invite codes** for security reasons.

**All cryptographic operations must be performed client-side:**

* Invite code generation
* Private key derivation from invite codes
* Transaction signing

The following sections provide the complete implementation steps required before using the API.

<Warning>
  **WARNING**

  **CRITICAL SECURITY REQUIREMENTS**

  * **Never share invite codes or private keys** - treat them like passwords or seed phrases
  * **Store invite codes securely** - use encrypted storage, secure vaults, or environment variables
  * **Validate all inputs** - ensure invite codes meet expected format before processing
  * **Implement proper error handling** - avoid exposing sensitive data in logs or error messages

  **⚠️ Loss of funds:** Any exposure of invite codes or private keys may result in permanent loss of funds. Jupiter is not liable for losses due to compromised credentials.
</Warning>

## Overview

<Steps>
  <Step>
    Create invite code.
  </Step>

  <Step>
    From utils, derive the secret key - a deterministic 64-byte Solana secret key (32 bytes private + 32 bytes public key).
  </Step>

  <Step>
    Create Solana Keypair instance from the secret key.
  </Step>

  <Step>
    Post request to get Send transaction.

    * If `craft-clawback`, requires an additional `invitePDA` to be passed in.
  </Step>

  <Step>
    Sign with both sender and recipient keypair, then send transaction and wait for confirmation.
  </Step>
</Steps>

<AccordionGroup>
  <Accordion title="Full Utils Code Snippet">
    ```js theme={null}
    import crypto from "crypto";
    import * as ed from "@noble/ed25519";
    import { sha512 } from "@noble/hashes/sha512";
    const hashFunction = (...messages) => sha512(ed.etc.concatBytes(...messages));
    ed.etc.sha512Sync = hashFunction;

    const { createHash } = await import("node:crypto");

    // This function creates a random 12-character base58 invite code
    // Uses 13 random bytes (~1.4 quintillion possible codes)
    export async function create_invite_code() {
      const buf = crypto.randomBytes(13);

      // 58^12 = 1.449225352 e21
      return binary_to_base58(new Uint8Array(buf)).substring(0, 12);
    };

    // This function converts an invite code to a deterministic private key
    // Uses SHA256 hash of `"invite:"` + `invite_code` as the seed
    // Returns a 64-byte Solana keypair (32 bytes private + 32 bytes public key)
    export function invite_code_to_priv_key(invite_code) {
      // Hash the invite code with a prefix
      const pre_hash = "invite:" + invite_code;
      const sha = createHash("sha256");
      const priv_key = crypto.createHash("sha256").update(pre_hash).digest();

      // Use ed25519 to get the public key
      const pub_key = ed.getPublicKey(new Uint8Array(priv_key));
      const solana_priv_key = new Uint8Array(64);
      solana_priv_key.set(priv_key);
      solana_priv_key.set(pub_key, 32);

      return solana_priv_key;
    };

    /////////////////////////////////////////////////////////////////////////////////////
    // Taken from https://github.com/pur3miish/base58-js
    const base58_chars =
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const create_base58_map = () => {
      const base58M = Array(256).fill(-1);
      for (let i = 0; i < base58_chars.length; ++i)
        base58M[base58_chars.charCodeAt(i)] = i;

      return base58M;
    };

    const base58Map = create_base58_map();
    export function binary_to_base58(uint8array) {
      const result = [];

      for (const byte of uint8array) {
        let carry = byte;
        for (let j = 0; j < result.length; ++j) {
          const x = (base58Map[result[j]] << 8) + carry;
          result[j] = base58_chars.charCodeAt(x % 58);
          carry = (x / 58) | 0;
        }
        while (carry) {
          result.push(base58_chars.charCodeAt(carry % 58));
          carry = (carry / 58) | 0;
        }
      }

      for (const byte of uint8array)
        if (byte) break;
        else result.push("1".charCodeAt(0));

      result.reverse();

      return String.fromCharCode(...result);
    }

    export function base58_to_binary(base58String) {
      if (!base58String || typeof base58String !== "string")
        throw new Error(`Expected base58 string but got “${base58String}”`);
      if (base58String.match(/[IOl0]/gmu))
        throw new Error(
          `Invalid base58 character “${base58String.match(/[IOl0]/gmu)}”`
        );
      const lz = base58String.match(/^1+/gmu);
      const psz = lz ? lz[0].length : 0;
      const size =
        ((base58String.length - psz) * (Math.log(58) / Math.log(256)) + 1) >>> 0;

      return new Uint8Array([
        ...new Uint8Array(psz),
        ...base58String
          .match(/.{1}/gmu)
          .map((i) => base58_chars.indexOf(i))
          .reduce((acc, i) => {
            acc = acc.map((j) => {
              const x = j * 58 + i;
              i = x >> 8;
              return x;
            });
            return acc;
          }, new Uint8Array(size))
          .reverse()
          .filter(
            (
              (lastValue) => (value) =>
                (lastValue = lastValue || value)
            )(false)
          ),
      ]);
    }
    /////////////////////////////////////////////////////////////////////////////////////
    ```
  </Accordion>

  <Accordion title="Full Usage Code Snippet">
    ```js theme={null}
    import { create_invite_code, invite_code_to_priv_key } from "./utils.js";
    import {
      Connection,
      Keypair,
      VersionedTransaction,
    } from "@solana/web3.js";
    import fs from "fs";

    const connection = new Connection('insert-rpc');
    const senderPrivateKey = JSON.parse(fs.readFileSync('/Path/to/sender/id.json', 'utf8').trim());
    const sender = Keypair.fromSecretKey(new Uint8Array(senderPrivateKey));

    // STEP 1: Create 12-character invite code
    const invite_code = await create_invite_code();

    // STEP 2: Derive secret key (public and private key)
    const secret_key = invite_code_to_priv_key(invite_code);

    // STEP 3: Use secret key to create Solana Keypair instance
    const recipient = Keypair.fromSecretKey(secret_key);

    // STEP 4: Post request for a Send transaction
    const craftSendTransaction = await (
        await fetch ('https://api.jup.ag/send/v1/craft-send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'your-api-key',
            },
            body: JSON.stringify({
                inviteSigner: recipient.publicKey.toBase58(),
                sender: sender.publicKey.toBase58(),
                amount: "10000000", // atomic amount before decimals
                // mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Defaults to SOL if `mint` is not provided
            }, null, 2)
        })
    ).json();

    // STEP 5: Use sender and receipient keypair to sign and send to network
    const transaction = VersionedTransaction.deserialize(Buffer.from(craftSendTransaction.tx, 'base64'));
    transaction.sign([sender, recipient]); // SIGN with both SENDER and RECIPIENT keypair
    const transactionBinary = transaction.serialize();
    const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: "confirmed" });

    const signature = await connection.sendRawTransaction(transactionBinary, {
      maxRetries: 0,
      skipPreflight: true,
    });

    // Log the signature immediately after sending, before confirmation
    console.log(`Transaction sent: https://solscan.io/tx/${signature}`);

    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: blockhashInfo.value.blockhash,
        lastValidBlockHeight: blockhashInfo.value.lastValidBlockHeight,
      }, "confirmed");

      if (confirmation.value.err) {
        console.error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        console.log(`Examine the failed transaction: https://solscan.io/tx/${signature}`);
      } else {
        console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
      };
    } catch (error) {
      console.error(`Error confirming transaction: ${error}`);
      console.log(`Examine the transaction status: https://solscan.io/tx/${signature}`);
    };
    ```
  </Accordion>
</AccordionGroup>

## Prerequisite

### Dependencies

```bash theme={null}
npm install @solana/web3.js@1 # Using v1 of web3.js instead of v2
npm install dotenv # Useful for testing and handling of invite code and private key
npm install @noble/ed25519
npm install @noble/hashes
```

### Imports

Create a utils file to add these functions

```js theme={null}
import crypto from "crypto";
import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { PublicKey } from "@solana/web3.js";

// Configure the ed25519 library to use SHA-512 for internal operations
// This is REQUIRED before using any ed25519 functions like getPublicKey()
// The library needs to know which hash function to use for key derivation and signing
const hashFunction = (...messages) => sha512(ed.etc.concatBytes(...messages));
ed.etc.sha512Sync = hashFunction;

// Import createHash function from Node.js crypto module using dynamic import
// This allows us to use the modern 'node:crypto' protocol for better compatibility
// createHash is used for SHA-256 hashing in the invite code functions
const { createHash } = await import("node:crypto");
```

## Functions

### Create Invite Code

```js theme={null}
// This function creates a random 12-character base58 invite code
// Uses 13 random bytes (~1.4 quintillion possible codes)
export async function create_invite_code() {
  const buf = crypto.randomBytes(13);

  // 58^12 = 1.449225352 e21
  return binary_to_base58(new Uint8Array(buf)).substring(0, 12);
};
```

### Derive Solana Secret Key

```js theme={null}
// This function converts an invite code to a deterministic private key
// Uses SHA256 hash of `"invite:"` + `invite_code` as the seed
// Returns a 64-byte Solana secret key (32 bytes private + 32 bytes public key)
export function invite_code_to_priv_key(invite_code) {
  // Hash the invite code with a prefix
  const pre_hash = "invite:" + invite_code;
  const sha = createHash("sha256");
  const priv_key = crypto.createHash("sha256").update(pre_hash).digest();

  // Use ed25519 to get the public key
  const pub_key = ed.getPublicKey(new Uint8Array(priv_key));
  const solana_priv_key = new Uint8Array(64);
  solana_priv_key.set(priv_key);
  solana_priv_key.set(pub_key, 32);

  return solana_priv_key;
};
```

### Convert Binary To Base58

```js expandable theme={null}
/////////////////////////////////////////////////////////////////////////////////////
// Taken from https://github.com/pur3miish/base58-js
const base58_chars =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const create_base58_map = () => {
  const base58M = Array(256).fill(-1);
  for (let i = 0; i < base58_chars.length; ++i)
    base58M[base58_chars.charCodeAt(i)] = i;

  return base58M;
};

const base58Map = create_base58_map();
export function binary_to_base58(uint8array) {
  const result = [];

  for (const byte of uint8array) {
    let carry = byte;
    for (let j = 0; j < result.length; ++j) {
      const x = (base58Map[result[j]] << 8) + carry;
      result[j] = base58_chars.charCodeAt(x % 58);
      carry = (x / 58) | 0;
    }
    while (carry) {
      result.push(base58_chars.charCodeAt(carry % 58));
      carry = (carry / 58) | 0;
    }
  }

  for (const byte of uint8array)
    if (byte) break;
    else result.push("1".charCodeAt(0));

  result.reverse();

  return String.fromCharCode(...result);
}

export function base58_to_binary(base58String) {
  if (!base58String || typeof base58String !== "string")
    throw new Error(`Expected base58 string but got “${base58String}”`);
  if (base58String.match(/[IOl0]/gmu))
    throw new Error(
      `Invalid base58 character “${base58String.match(/[IOl0]/gmu)}”`
    );
  const lz = base58String.match(/^1+/gmu);
  const psz = lz ? lz[0].length : 0;
  const size =
    ((base58String.length - psz) * (Math.log(58) / Math.log(256)) + 1) >>> 0;

  return new Uint8Array([
    ...new Uint8Array(psz),
    ...base58String
      .match(/.{1}/gmu)
      .map((i) => base58_chars.indexOf(i))
      .reduce((acc, i) => {
        acc = acc.map((j) => {
          const x = j * 58 + i;
          i = x >> 8;
          return x;
        });
        return acc;
      }, new Uint8Array(size))
      .reverse()
      .filter(
        (
          (lastValue) => (value) =>
            (lastValue = lastValue || value)
        )(false)
      ),
  ]);
}
/////////////////////////////////////////////////////////////////////////////////////
```


# Manage Invites (Beta)
Source: https://dev.jup.ag/docs/send/manage-invites

Query pending and historical Send invites for a wallet address.

This guide covers how to retrieve pending and historical Send invites from the sender's perspective using the `/send/v1/pending-invites` and `/send/v1/invite-history` GET endpoints.

## Overview

<Steps>
  <Step>
    Get pending invites.
  </Step>

  <Step>
    Get invite history.
  </Step>
</Steps>

<Info>
  **NOTE**

  Both of the following endpoints only returns the invites that are set up by the sender and not from the perspective of the recipient.

  * Pending invites: Invites created by the sender that are not yet expired and can be clawback/claimed.
  * Invite history: Invites created by the sender and is either claimed, clawback, or expired. (You can also pass in a Recipient pubkey to get their history)
</Info>

<Tip>
  **TIP**

  Depending on how you have set up to allow connection of wallets, either via [Jupiter Mobile Adapter](/tool-kits/wallet-kit/jupiter-mobile-adapter) for QR code login, wallet extensions, or any other methods, you will need to handle the passing in of their pubkey to the API to get the necessary data.
</Tip>

## Get Pending Invites

```js theme={null}
const pendingInvites = await (
  await fetch(
    `https://api.jup.ag/send/v1/pending-invites?address=${pubkey}`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Get Invite History

```js theme={null}
const inviteHistory = await (
  await fetch(
    `https://api.jup.ag/send/v1/invite-history?address=${pubkey}`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```


# Claim Fee (Beta)
Source: https://dev.jup.ag/docs/studio/claim-fee

Check and claim unclaimed LP fees from Dynamic Bonding Curve pools.

This guide covers how to claim LP fees from Dynamic Bonding Curve (DBC) pools created via Jupiter Studio. You will look up pool addresses by token mint, query total and unclaimed fees, then create and submit a claim transaction.

<Tip>
  **API REFERENCE**

  To fully utilize the Studio API, check out the [Studio API Reference](/api-reference/studio).
</Tip>

## Prerequisite

<AccordionGroup>
  <Accordion title="Dependencies">
    ```bash theme={null}
    npm install @solana/web3.js@1 # Using v1 of web3.js instead of v2
    npm install dotenv # If required for wallet setup
    ```
  </Accordion>

  <Accordion title="RPC">
    **Set up RPC**

    <Info>
      **NOTE**

      Solana provides a [default RPC endpoint](https://solana.com/docs/core/clusters). However, as your application grows, we recommend you to always use your own or provision a 3rd party provider’s RPC endpoint such as [Helius](https://helius.dev/) or [Triton](https://triton.one/).
    </Info>

    ```js theme={null}
    import { Connection } from '@solana/web3.js';

    const connection = new Connection('https://api.mainnet-beta.solana.com');
    ```
  </Accordion>

  <Accordion title="Wallet">
    **Set up Development Wallet**

    <Info>
      **NOTE**

      * You can paste in your private key for testing purposes but this is not recommended for production applications.
      * If you want to store your private key in the project directly, you can do it via a `.env` file.
    </Info>

    To set up a development wallet via `.env` file, you can use the following script.

    ```js theme={null}
    // index.js
    import { Keypair } from '@solana/web3.js';
    import dotenv from 'dotenv';
    require('dotenv').config();
    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || ''));
    ```

    ```bash theme={null}
    # .envPRIVATE_KEY=''
    ```

    To set up a development wallet via a wallet generated via [Solana CLI](https://solana.com/docs/intro/installation#solana-cli-basics), you can use the following script.

    ```js theme={null}
    import { Keypair } from '@solana/web3.js';
    import fs from 'fs';

    const privateKeyArray = JSON.parse(fs.readFileSync('/Path/To/.config/solana/id.json', 'utf8').trim());
    const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    ```
  </Accordion>

  <Accordion title="Transaction Sending Example">
    ```js theme={null}
    transaction.sign([wallet]);
    const transactionBinary = transaction.serialize();
    console.log(transactionBinary);
    console.log(transactionBinary.length);
    const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: 'finalized' });

    const signature = await connection.sendRawTransaction(transactionBinary, {
      maxRetries: 0,
      skipPreflight: true,
    });

    console.log(`Transaction sent: https://solscan.io/tx/${signature}`);

    try {
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash: blockhashInfo.value.blockhash,
        lastValidBlockHeight: blockhashInfo.value.lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        console.error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        console.log(`Examine the failed transaction: https://solscan.io/tx/${signature}`);
      } else {
        console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
      }
    } catch (error) {
      console.error(`Error confirming transaction: ${error}`);
      console.log(`Examine the transaction status: https://solscan.io/tx/${signature}`);
    };
    ```
  </Accordion>
</AccordionGroup>

## Pool Address

Your successfully created token via Jupiter Studio, should have a newly generated token mint. By using the mint, you can get the config key and pool addresses associated to it: Dynamic Bonding Curve pool and Meteora DAMM V2 pool.

```js theme={null}
const poolAddressResponse = await (
    await fetch(
      `https://api.jup.ag/studio/v1/dbc-pool/addresses/${mint}`,
      {
        headers: {
          'x-api-key': 'your-api-key',
        },
      }
    )
).json();
```

## Fee

Using the Pool Address, you will be able to get the total and current unclaimed fees in the Dynamic Bonding Curve pool.

```js theme={null}
const feeResponse = await (
    await fetch (
      'https://api.jup.ag/studio/v1/dbc/fee',
      {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            poolAddress: poolAddressResponse.data.dbcPoolAddress,
        }, null, 2)
    })
).json();
```

## Claim Fee

In order to claim fees from a Dynamic Bonding Curve pool, you will need to pass in the pool address into this endpoint and we will create the Claim Fee transaction for you. After receiving the transaction, you will need to sign and submit the transaction to the network on your own ([refer to Transaction Sending Example above](#prerequisite)).

```js theme={null}
const claimTransaction = await (
    await fetch (
      'https://api.jup.ag/studio/v1/dbc/fee/create-tx',
      {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            ownerWallet: wallet.publicKey.toBase58(),
            poolAddress: poolAddressResponse.data.dbcPoolAddress,
            maxQuoteAmount: 1000000, // e.g. 1 USDC (depending on quote mint and decimals)
        }, null, 2)
    })
).json();
```


# Create Token (Beta)
Source: https://dev.jup.ag/docs/studio/create-token

Launch a token with configurable bonding curves, metadata, and images through the Studio API.

This guide walks through the full token creation flow using the Studio API: calling the `/studio/v1/dbc-pool/create-tx` endpoint to generate a transaction and presigned URLs, uploading token image and metadata, then signing and submitting via `/studio/v1/dbc-pool/submit`.

<Tip>
  **API REFERENCE**

  To fully utilize the Studio API, check out the [Studio API Reference](/api-reference/studio).
</Tip>

## Prerequisite

<AccordionGroup>
  <Accordion title="Dependencies">
    ```bash theme={null}
    npm install @solana/web3.js@1 # Using v1 of web3.js instead of v2
    npm install dotenv # If required for wallet setup
    ```
  </Accordion>

  <Accordion title="Wallet">
    **Set up Development Wallet**

    <Info>
      **NOTE**

      * You can paste in your private key for testing purposes but this is not recommended for production applications.
      * If you want to store your private key in the project directly, you can do it via a `.env` file.
    </Info>

    To set up a development wallet via `.env` file, you can use the following script.

    ```js theme={null}
    // index.js
    import { Keypair } from '@solana/web3.js';
    import dotenv from 'dotenv';
    require('dotenv').config();

    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || ''));
    ```

    ```bash theme={null}
    # .env
    PRIVATE_KEY=''
    ```

    To set up a development wallet via a wallet generated via [Solana CLI](https://solana.com/docs/intro/installation#solana-cli-basics), you can use the following script.

    ```js theme={null}
    import { Keypair } from '@solana/web3.js';
    import fs from 'fs';

    const privateKeyArray = JSON.parse(fs.readFileSync('/Path/To/.config/solana/id.json', 'utf8').trim());
    const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    ```
  </Accordion>
</AccordionGroup>

## Create Transaction

This endpoint helps you create a few key components to launch your token on Studio.

1. `transaction`: A base64-encoded unsigned transaction.
2. `mint`: The mint of the token that is being created.
3. `imagePresignedUrl`: A `PUT` request endpoint to upload your token image.
4. `metadataPresignedUrl`: A `PUT` request endpoint to upload your token metadata.
5. `imageUrl`: The token's static image url to be used in the metadata.

<Tip>
  **PRESETS**

  On [https://jup.ag/studio](https://jup.ag/studio), you can find a few different presets to get you started.

  <AccordionGroup>
    <Accordion title="Meme">
      **Great for memes, similar profile to traditional meme launches.**

      * People begin buying your token at 16K Market Cap (MC) in USDC.
      * It graduates to a Meteora pool at 69K MC.
      * Your pool raises \~17.94K USDC before graduation.

      ```js theme={null}
      buildCurveByMarketCapParam: {
          quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          initialMarketCap: 16000,
          migrationMarketCap: 69000,
          tokenQuoteDecimal: 6,
          lockedVestingParam: {
              totalLockedVestingAmount: 0,
              cliffUnlockAmount: 0,
              numberOfVestingPeriod: 0,
              totalVestingDuration: 0,
              cliffDurationFromMigrationTime: 0,
          },
      },
      antiSniping: false,
      fee: { feeBps: 100, },
      isLpLocked: true,
      tokenName: '',
      tokenSymbol: '',
      tokenImageContentType: 'image/jpeg',
      creator: wallet.publicKey.toBase58(),
      ```
    </Accordion>

    <Accordion title="Indie">
      **For projects ready to take it up a notch. More capital required to bond, but you'll have deeper liquidity and more LP fees when you graduate.**

      * People begin buying your token at 32k Market Cap (MC) in USDC.
      * It graduates to a Meteora pool at 240k MC.
      * Your pool raises \~57.78K USDC before graduation.
      * 10% of total supply will be vested daily over 12 months.

      ```js theme={null}
      buildCurveByMarketCapParam: {
          quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          initialMarketCap: 32000,
          migrationMarketCap: 240000,
          tokenQuoteDecimal: 6,
          lockedVestingParam: {
              totalLockedVestingAmount: 100000000,
              cliffUnlockAmount: 0,
              numberOfVestingPeriod: 365,
              totalVestingDuration: 31536000,
              cliffDurationFromMigrationTime: 0,
          },
      },
      antiSniping: true,
      fee: { feeBps: 100, },
      isLpLocked: true,
      tokenName: '',
      tokenSymbol: '',
      tokenImageContentType: 'image/jpeg',
      creator: wallet.publicKey.toBase58(),
      ```
    </Accordion>

    <Accordion title="Custom">
      Just pass in the parameters you need!
    </Accordion>
  </AccordionGroup>
</Tip>

```js theme={null}
const createTransaction = await (
    await fetch (
      'https://api.jup.ag/studio/v1/dbc-pool/create-tx',
      {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            buildCurveByMarketCapParam: {
                quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // or SOL or JUP
                initialMarketCap: 16000, // This means 16_000 USDC
                migrationMarketCap: 69000, // This means 69_000 USDC
                tokenQuoteDecimal: 6,
                lockedVestingParam: {
                    totalLockedVestingAmount: 0,
                    cliffUnlockAmount: 0,
                    numberOfVestingPeriod: 0,
                    totalVestingDuration: 0,
                    cliffDurationFromMigrationTime: 0,
                },
            },
            antiSniping: true,
            fee: { feeBps: 100, },
            isLpLocked: true,
            tokenName: '',
            tokenSymbol: '',
            tokenImageContentType: 'image/jpeg',
            creator: wallet.publicKey.toBase58(),
        }, null, 2)
    })
).json();
```

## Token Metadata

The following 2 steps, are to upload your token image and metadata to the **static URL**, which will be the URI in the onchain metadata of your token.

Example

* URI/ Off-chain Metadata: `https://static-create.jup.ag/metadata/{mint}.json`
* Image: `https://static-create.jup.ag/images/{mint}`

You can refer to this to understand Token Metadata on Solana: [https://developers.metaplex.com/token-metadata](https://developers.metaplex.com/token-metadata)

### Upload Image

From the response of the `create-tx` endpoint, we will need the `imagePresignedUrl` to make a **`PUT` request** to the url provided, in order to upload the token image.

```js theme={null}
const imageResponse = await fetch(createTransaction.imagePresignedUrl, {
    method: 'PUT',
    headers: {
        'Content-Type': 'image/jpeg', // Adjust based on the image type passed in previously
    },
    body: fs.readFileSync('./token.jpeg'), // Assuming the image file is located in the same folder
});
```

### Upload Metadata

From the response of the `create-tx` endpoint, we will need the `metadataPresignedUrl` to make a **`PUT` request** to the url provided, in order to upload the token metadata.

```js theme={null}
const metadataResponse = await fetch(createTransaction.metadataPresignedUrl, {
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        name: '',
        symbol: '',
        description: '',
        image: createTransaction.imageUrl,
        website: '',
        twitter: '',
        telegram: '',
    }, null, 2),
});
```

## Submit Transaction

After you have uploaded your token image and token metadata, you can proceed to signing and making a post request to the `submit` endpoint - this will allow Jupiter Studio to complete the transaction and submit it to the network on your behalf.

<Info>
  **NOTE**

  * Do note that the endpoint expects the `requestBody`'s `content` to be in [`multipart/form-data` format](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects).
  * Ensure the file types and size of the image file is manageable.
</Info>

<Info>
  **NOTE**

  The `content` and `headerImage` refers to the Studio dedicated page's token description and header image of the page, they are not on-chain metadata. This is meant for you to customize the Studio dedicated page as you wish - to include lore, story or just a nice looking banner!

  The `content` and `headerImage` are stored off-chain for our frontend to ingest and display.

  [Do not confuse this with the uploading of token metadata, they are done separately.](#token-metadata)
</Info>

```js theme={null}
import { VersionedTransaction } from '@solana/web3.js';
import fs from 'fs';

const transaction = VersionedTransaction.deserialize(Buffer.from(createTransaction.transaction, 'base64'));
transaction.sign([wallet]);
const signedTransaction = Buffer.from(transaction.serialize()).toString('base64');

const formData = new FormData();
formData.append('transaction', signedTransaction);
formData.append('owner', wallet.publicKey.toBase58());
formData.append('content', '');
formData.append(
    'headerImage',
    new File(
        [fs.readFileSync('/Path/to/header.jpeg')],
        'header.jpeg',
        { type: 'image/jpeg' },
    )
);

const result = await (
    await fetch (
      'https://api.jup.ag/studio/v1/dbc-pool/submit',
      {
        method: 'POST',
        body: formData,
        headers: {
            'x-api-key': 'your-api-key',
        },
    })
).json();
```


# Jupiter Studio Overview
Source: https://dev.jup.ag/docs/studio/index

Jupiter Studio provides APIs for token creation with flexible bonding curves, LP fee management, vesting schedules, and dedicated token pages on jup.ag.

Studio is built for culture architects who want:

* Aggressive experimentation.
* Tools for growth and alignment.
* Collaborative and supportive vibe culture between Studio projects.

## About

Studio is a powerful playground equipped with a suite of tools for creators. Each feature is strategic towards how creators might want to customize to fit their needs - like flexible bonding curves, custom vesting schedules, and selectable quote mints to encode your vision.

**Features**

* LP Fees: 50% before AND after graduation.
* LP Locking: Optional 50% of the graduated LP unlocks after 1 year.
* Vested Tokens: 0 - 80% of token supply, with optional vesting schedule and cliff.
* Flexible parameters: Quote mint, Market cap bonding, etc.
* Other helpful tools: Anti-sniper suite, Lp Locking.

**Dedicated Studio Token Page**

Apart from the strategic levers, start rallying your community with the dedicated Studio page with seamless content integration with jup.ag's token page.

* Dedicated Studio page for each token.
* Content from Studio shows up in jup.ag's token page.

<Info>
  **READINGS**

  * Design intentions: [https://x.com/9yointern/status/1940431614103937517](https://x.com/9yointern/status/1940431614103937517)
  * Launch post: [https://x.com/jup\_studio/status/1940620377602011566](https://x.com/jup_studio/status/1940620377602011566)
  * General FAQ: [https://support.jup.ag/hc/en-us/categories/21148110700060-Studio](https://support.jup.ag/hc/en-us/categories/21148110700060-Studio)
</Info>

## FAQ

<AccordionGroup>
  <Accordion title="Why is my Studio token page showing 'Token not found'?">
    * In order for us to track and store your token information, header image or token description, you **must** send your signed transaction from the `create_tx` endpoint to the `submit` endpoint.
    * This will allow us to store your token into our database and reflect it as a Studio token on our frontend.
    * If you submit the transaction on your own or some other way, the token will not have a dedicated Studio page.
  </Accordion>

  <Accordion title="What do I do with the presigned URLs?">
    * Those URLs are for you to upload your token's metadata and image to a static endpoint, which will be in the token's URI metadata onchain.
    * You are required to make a PUT request to those endpoints, [you can refer to this section on the usage](/docs/studio/create-token#token-metadata).
    * If you do not upload your token image and metadata to this endpoint, your token will not have any image/metadata reflected onchain.
  </Accordion>

  <Accordion title="What is the rate limit of Studio API?">
    * Free usage rate limit: 100 requests per 5 minutes
    * For paid rate limit: 10 requests per 10 seconds (for all Tiers)
  </Accordion>
</AccordionGroup>


# Add Fees To Swap
Source: https://dev.jup.ag/docs/swap/add-fees-to-swap

Add integrator fees to Metis swaps and collect revenue from user trades.

Add a platform fee to Metis swaps by passing `platformFeeBps` (in basis points) when requesting a quote and `feeAccount` (any valid token account for the swap pair mint) when building the swap transaction. No referral program setup is required for the Metis Swap API.

<Note>
  **INFO**

  As of January 2025, when integrating the Metis Swap API, you no longer need to use the Referral Program to set up a `referralAccount` and `referralTokenAccount` to collect fees from the swaps you provide to the end users.

  Simply, just pass in any valid token account as the `feeAccount` parameter in the Metis Swap API.

  However, do note that **it is still applicable to the Trigger API**.
</Note>

<Info>
  **NOTE**

  You can still find information about the Referral Program.

  The Referral Program is an open source program by Jupiter to provide referral fees for integrators who are integrating Jupiter Swap and Jupiter Limit Order. You can check out the code [here](https://github.com/TeamRaccoons/referral) to gain a better understanding of how it works.
</Info>

## Overview

By default, there are **zero** protocol fees on Jupiter Swap. Integrators have the option to introduce a platform fee denoted in basis points, e.g. **20 bps** for **0.2%** of the token input or output.

### Important Notes

* For ExactIn swaps, the `feeAccount`'s mint can be either the **input mint or output mint** of the swap pair, and not any other mints.
* For ExactOut swaps, the `feeAccount`'s mint can only be the **input mint** of the swap pair.
* Example, if you swap JUP to USDC, you cannot take fees in SOL, it has to be part of the swap pair.
* It supports SPL and Token2022 tokens.
  * [Refer to this update for support of Token2022 tokens](/updates#jupiter-aggregator-v6-program-update).
* Referral Program is no longer required for Metis Swap API.

### 1. Set up

You will need to complete the prerequisites and understanding of [Environment Setup](/get-started/environment-setup) and [Get Quote and Swap](/docs/swap/get-quote) guide as this is reliant on the Metis Swap API.

### 2. Set your fee in Quote

Setting your fee is simple, just add `platformFeeBps` parameter to the `/quote` endpoint.

In this example, we set `platformFeeBps` to `20` which equates to 0.2%.

```js theme={null}
const quoteResponse = await (
    await fetch(
        'https://api.jup.ag/swap/v1/quote?' +
        'inputMint=So11111111111111111111111111111111111111112&' +
        'outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&' +
        'amount=100000&' +
        'slippageBps=50&' +
        'restrictIntermediateTokens=true&' +
        'platformFeeBps=20&' +
        'instructionVersion=V2' // required if you want to collect fees in Token2022 tokens
    ),
    {
        headers: {
            'x-api-key': 'your-api-key',
        },
    }
  ).json();
```

### 3. Set your feeAccount in Swap

In the `/swap` endpoint, you will need to pass in the `feeAccount` parameter.

* The `feeAccount` is a token account that will receive the fees from the swap - the mint of the token account has to be part of the swap pair.
* Do ensure that the token account needs to be initialized beforehand and is the correct mint to receive the fees in.
* For ExactIn swaps, the `feeAccount`'s mint can be either the **input mint or output mint** of the swap pair, and not any other mints.
* For ExactOut swaps, the `feeAccount`'s mint can only be the **input mint** of the swap pair.
* Example, if you swap JUP to USDC, you cannot take fees in SOL, it has to be part of the swap pair.
* Refer to the [Create Token Account](#create-token-account) section to create a token account.

```js theme={null}
const swapResponse = await (
    await fetch('https://api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            quoteResponse,
            userPublicKey: wallet.publicKey, // Pass in actual referred user in production
            feeAccount: feeAccount, // feeAccount is the token account that will receive the fees
        }),
    })
).json();
```

### 4. Sign and send transaction

Finally, the user can sign the transaction and it can be submitted to the network to be executed. You can refer to the [Send Swap Transaction](/docs/swap/send-swap-transaction) guide to complete this step.

### Create Token Account

To create a token account, you can use the following code or refer to [Solana Cookbook](https://solana.com/developers/cookbook/tokens/create-token-account).

* The code creates the transaction to create the token account and handles the transaction siging and sending.
* If the token account already exists, it will not create and might throw an error such as `Provided owner is not allowed`.

```js theme={null}
import { createAssociatedTokenAccount } from "@solana/spl-token";

const mintPubkey = new PublicKey(
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
);

let ata = await createAssociatedTokenAccount(
    connection, // connection
    wallet, // fee payer
    mintPubkey, // mint
    wallet.publicKey, // owner of the token account
    // confirmOptions, // if you need to skip simulation and send the transaction immediately
    // programId, // if you need to use a different token program id such as token-2022
    // associatedTokenProgramId,
    // allowOwnerOffCurve, // if you need to allow the owner to be off curve
);
console.log(`ATA: ${ata.toBase58()}`);
```

## For Trigger API Integrator Fee

**Important Notes**

* The Jupiter Swap project account for the Referral Program is `45ruCyfdRkWpRNGEqWzjCiXRHkZs8WXCLQ67Pnpye7Hp`.

* The `referralTokenAccount` can either be:

  * **Input mint or the output mint** on the swap for ExactIn.
  * **Input mint ONLY** on the swap for ExactOut.

* You can use the [Dashboard](https://referral.jup.ag/dashboard), [SDK](https://github.com/TeamRaccoons/referral/blob/main/example/src/createReferralAccount.ts) or [API](https://referral.jup.ag/api) to set up the `referralAccount` and `referralTokenAccount` in this guide.

**1. Set up**

**Obtain `referralAccount` and `referralTokenAccount`**

There are 2 ways you can set up a referral account.

1. Use our [referral dashboard](https://referral.jup.ag/dashboard) to create them. After creating, remember to find your `Referral Key` on the page and the associated token accounts.
2. Use our SDK to create them. You can use the [example scripts](https://github.com/TeamRaccoons/referral/tree/main/example/src) to create.

**Obtain `mintAccount`**

As for the mint account, assuming you have an interface where a user swaps, you will know up front what are the input or output mints. For the sake of example, we will use a hardcoded mint public key.

```js theme={null}
const referralAccount = new Publickey('ReplaceWithPubkey');
const mintAccount = new Publickey('So11111111111111111111111111111111111111112');
```

**2. Get your referral token account for `feeAccount`**

In order to refer and receive fees from all types of tokens, you will need to have already initialize `referralTokenAccount`s (owned by your `referralAccount`) for the mint in the order.

In this code block, we will be using the SDK to try to find the `referralTokenAccount` based on our previously defined `referralAccount` and `mintAccount`. If the token account is not found, it will send a transaction to the network to attempt to initialize one for the mint.

```js theme={null}
import { ReferralProvider } from "@jup-ag/referral-sdk";

const { tx, referralTokenAccountPubKey } = await provider.initializeReferralTokenAccount({
    payerPubKey: wallet.publicKey,
    referralAccountPubKey: referralAccount,
    mint: mintAccount,
});

const referralTokenAccount = await connection.getAccountInfo(referralTokenAccountPubKey);

// Attempt to initialize a token account
if (!referralTokenAccount) {
    const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);
    console.log({ signature, referralTokenAccountPubKey: referralTokenAccountPubKey.toBase58() });

// Since initialized, it will carry on
} else {
    console.log(`referralTokenAccount ${referralTokenAccountPubKey.toBase58()} for mint ${mintAccount.toBase58()} already exists`);
};

const feeAccount = referralTokenAccountPubKey;
console.log(feeAccount);
```

If you are confident that the `referralTokenAccount` for specific mints have been created, you can use this method to get it. **Do note that, even if the token account is not intialized, it will still return a pubkey as it is a Program Derived Address and is deterministic. [Read more here.](https://solana.com/docs/core/pda#findprogramaddress)**

```js theme={null}
const [feeAccount] = PublicKey.findProgramAddressSync(
    [
        Buffer.from("referral_ata"), // A string that signifies the account type, here "referral_ata."
        referralAccount.toBuffer(), //  The public key of the referral account converted into a buffer.
        mintAccount.toBuffer(), // The mint public key, converted into a buffer.
    ],
    new PublicKey("REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3") // The public key of the Referral Program
);
```

**3. Set your `feeAccount` and `params.feeBps`**

Setting your referral fee is simple, just add `feeAccount` and `params.feeBps` parameters to the `/createOrder` endpoint.

In this example, we set `params.feeBps` to `20` which equates to 0.2%.

```js theme={null}
const createOrderResponse = await (
    await fetch('https://api.jup.ag/trigger/v1/createOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            inputMint: inputMint.toString(),
            outputMint: outputMint.toString(),
            maker: "jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3",
            payer: "jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3",
            params: {
                makingAmount: "1000000",
                takingAmount: "300000",
                // slippageBps: "", // Optional, by nature, trigger orders execute with 0 slippage
                // expiredAt: "", // In unix seconds (e.g. Date.now()/1_000) or optional
                feeBps: "20", // feeBps is the amount of fees in bps that will be sent to the fee account
            },
            computeUnitPrice: "auto",
            feeAccount, // feeAccount is the token account that will receive the fees
            // wrapAndUnwrapSol: true, // Default true or optional
        })
    })
).json();
```


# Build Swap Transaction
Source: https://dev.jup.ag/docs/swap/build-swap-transaction

Build a serialized swap transaction from a Metis quote with configurable compute and fee settings.

The `/swap/v1/swap` endpoint takes a quote response and user public key, then returns a serialized transaction ready for signing. You can optimize landing with `dynamicComputeUnitLimit`, `dynamicSlippage`, and `prioritizationFeeLamports`. For instruction-level control, use `/swap/v1/swap-instructions` instead.

The Metis Swap API is one of the ways for you to interact with the Jupiter Swap Aggregator program. Before you send a transaction to the network, you will need to build the transaction that defines the instructions to execute and accounts to read/write to.

It can be complex to handle this yourself, but good news! Most of our APIs and SDKs just handles it for you, so you get a response with the transaction to be prepared and sent to the network.

<Tip>
  **USE METIS SWAP API TO HANDLE IT FOR YOU OR...**

  If you are looking to interact with the Jupiter Swap Aggregator program in a different way, check out the other guides:

  **Swap Instructions**

  To compose with instructions and build your own transaction, [read how to use the `/swap-instructions` in this section](#build-your-own-transaction-with-instructions).

  **Flash Fill or Cross Program Invocation (CPI)**

  To interact with your own Solana program, [read how to use the **Flash Fill method** or **CPI** in this section](#build-your-own-transaction-with-flash-fill-or-cpi).
</Tip>

## Let’s Get Started

In this guide, we will pick up from where [**Get Quote**](/docs/swap/get-quote) guide has left off.

If you have not set up your environment to use the necessary libraries, the RPC connection to the network and successfully get a quote from the Quote API, please start at [Environment Setup](/get-started/environment-setup) or [get quote](/docs/swap/get-quote).

<Tip>
  **API REFERENCE**

  To fully utilize the Metis Swap API, check out the [Metis Swap API or Swap Instructions Reference](/api-reference/swap/swap).
</Tip>

## Metis Swap API

From the previous guide on getting a quote, now using the quote response and your wallet, you can receive a **serialized swap transaction** that needs to be prepared and signed before sending to the network.

## Get Serialized Transaction

Using the root URL and parameters to pass in, it is as simple as the example code below!

<Tip>
  **OPTIMIZING FOR TRANSACTION LANDING IS SUPER SUPER IMPORTANT!**

  This code block includes additional parameters that our Metis Swap API supports, such as estimating compute units, priority fees and slippage, to optimize for transaction landing.

  To understand how these parameters help, the next step, [Send Swap Transaction guide](/docs/swap/send-swap-transaction) will discuss them.
</Tip>

Build a swap transaction with landing optimizations:

```js theme={null}
const swapResponse = await (
await fetch('https://api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key',
    },
    body: JSON.stringify({
    quoteResponse,
    userPublicKey: wallet.publicKey,

    // ADDITIONAL PARAMETERS TO OPTIMIZE FOR TRANSACTION LANDING
    // See next guide to optimize for transaction landing
    dynamicComputeUnitLimit: true,
    dynamicSlippage: true,
    prioritizationFeeLamports: {
          priorityLevelWithMaxLamports: {
            maxLamports: 1000000,
            priorityLevel: "veryHigh"
          }
        }
    })
})
).json();

console.log(swapResponse);
```

From the above example, you should see this response.

```js theme={null}
{
    swapTransaction: 'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAGDkS+3LuGTbs......+/oD9qb31dH6i0QZ2IHELXUX3Y1YeW79p9Stkqk12z4yvZFJiQ4GCQwLBwYQBgUEDggNTQ==',
    lastValidBlockHeight: 279632475,
    prioritizationFeeLamports: 9999,
    computeUnitLimit: 388876,
    prioritizationType: {
        computeBudget: {
            microLamports: 25715,
            estimatedMicroLamports: 785154
        }
    },
    dynamicSlippageReport: {
        slippageBps: 50,
        otherAmount: 20612318,
        simulatedIncurredSlippageBps: -18,
        amplificationRatio: '1.5',
        categoryName: 'lst',
        heuristicMaxSlippageBps: 100
    },
    simulationError: null
}
```

## What’s Next

Now, you are able to get a quote and use our Metis Swap API to build the swap transaction for you. Next steps is to proceed to prepare and sign the transaction and send the signed transaction to the network.

<CardGroup>
  <Card title="Let’s go sign and send!" href="/docs/swap-api/send-swap-transaction" icon="paper-plane" />
</CardGroup>

## Additional Resources

### Build Your Own Transaction With Instructions

If you prefer to compose with instructions instead of the provided transaction that is returned from the `/swap` endpoint (like the above example). You can post to `/swap-instructions` instead, it takes the same parameters as the `/swap` endpoint but returns you the instructions rather than the serialized transaction.

<Info>
  **NOTE**

  In some cases, you may add more accounts to the transaction, which may exceed the transaction size limits. To work around this, you can use the `maxAccounts` parameter in `/quote` endpoint to limit the number of accounts in the transaction.

  [Refer to the GET /quote's `maxAccounts` guide for more details.](/docs/swap/get-quote#max-accounts)
</Info>

<Accordion title="/swap-instructions code snippet">
  Example code snippet of using `/swap-instruction`

  ```js theme={null}
    const instructions = await (
      await fetch('https://api.jup.ag/swap/v1/swap-instructions', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'your-api-key',
      },
      body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey,
      }),
      })
  ).json();

  if (instructions.error) {
      throw new Error("Failed to get swap instructions: " + instructions.error);
  }

  const {
      tokenLedgerInstruction, // If you are using `useTokenLedger = true`.
      computeBudgetInstructions, // The necessary instructions to setup the compute budget.
      setupInstructions, // Setup missing ATA for the users.
      swapInstruction: swapInstructionPayload, // The actual swap instruction.
      cleanupInstruction, // Unwrap the SOL if `wrapAndUnwrapSol = true`.
      addressLookupTableAddresses, // The lookup table addresses that you can use if you are using versioned transaction.
  } = instructions;

  const deserializeInstruction = (instruction) => {
      return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key) => ({
          pubkey: new PublicKey(key.pubkey),
          isSigner: key.isSigner,
          isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, "base64"),
      });
  };

  const getAddressLookupTableAccounts = async (
      keys: string[]
  ): Promise<AddressLookupTableAccount[]> => {
      const addressLookupTableAccountInfos =
      await connection.getMultipleAccountsInfo(
          keys.map((key) => new PublicKey(key))
      );

      return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
      const addressLookupTableAddress = keys[index];
      if (accountInfo) {
          const addressLookupTableAccount = new AddressLookupTableAccount({
          key: new PublicKey(addressLookupTableAddress),
          state: AddressLookupTableAccount.deserialize(accountInfo.data),
          });
          acc.push(addressLookupTableAccount);
      }

      return acc;
      }, new Array<AddressLookupTableAccount>());
  };

  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

  addressLookupTableAccounts.push(
      ...(await getAddressLookupTableAccounts(addressLookupTableAddresses))
  );

  const blockhash = (await connection.getLatestBlockhash()).blockhash;
  const messageV0 = new TransactionMessage({
      payerKey: payerPublicKey,
      recentBlockhash: blockhash,
      instructions: [
      // uncomment if needed: ...setupInstructions.map(deserializeInstruction),
      deserializeInstruction(swapInstructionPayload),
      // uncomment if needed: deserializeInstruction(cleanupInstruction),
      ],
  }).compileToV0Message(addressLookupTableAccounts);
  const transaction = new VersionedTransaction(messageV0);
  ```
</Accordion>

### Build Your Own Transaction With Flash Fill Or CPI

If you prefer to interact with the Jupiter Swap Aggregator program with your own on-chain program. There are 2 ways to do it, typically on-chain program call **Cross Program Invocation (CPI)** to interact with each other, we also have another method called **Flash Fill** built by Jupiter (due to limitations of CPI in the past).

<Note>
  **CPI IS NOW RECOMMENDED!**

  As of January 2025, Jupiter Swap via CPI is recommended for most users.

  [The `Loosen CPI restriction` feature has been deployed on Solana, you can read more here](https://github.com/solana-labs/solana/issues/26641).
</Note>

<Tip>
  **WHY FLASH FILL?**

  With Jupiter's complex routing, best prices comes at a cost. It often means more compute resources and accounts are required as it would route across multiple DEXes in one transaction.

  Solana transactions are limited to 1232 bytes, Jupiter is using [Address Lookup Tables (ALTs)](https://docs.solana.com/developing/lookup-tables) to include more accounts in one transaction. However, the CPI method cannot use ALTs, which means when you add more accounts to a Jupiter Swap transaction, it will likely fail if it exceeds the transaction size limits.

  **Flash Fill allows the use of Versioned Transaction and ALTs**, hence, reducing the total accounts used for a Jupiter Swap transaction.
</Tip>

<AccordionGroup>
  <Accordion title="CPI References">
    **A CPI transaction will be composed of these instructions:**

    1. Borrow enough SOL from the program to open a wSOL account that the program owns.
    2. Swap X token from the user to wSOL on Jupiter via CPI.
    3. Close the wSOL account and send it to the program.
    4. The program then transfers the SOL back to the user.

    **Links and Resources:**

    * [https://github.com/jup-ag/jupiter-cpi-swap-example](https://github.com/jup-ag/jupiter-cpi-swap-example)
    * [https://github.com/jup-ag/sol-swap-cpi](https://github.com/jup-ag/sol-swap-cpi)

    <Accordion title="To ease integration via CPI, you may add the following crate jupiter-cpi to your program.">
      **[jupiter-cpi](https://github.com/jup-ag/jupiter-cpi)**

      To ease integration via CPI, you may add the following crate  to your program.

      In cargo.toml

      ```toml theme={null}
      [dependencies]
      jupiter-cpi = { git = "https://github.com/jup-ag/jupiter-cpi", rev = "5eb8977" }
      ```

      In your code

      ```rust theme={null}
          use jupiter_cpi;
        ...

      let signer_seeds: &[&[&[u8]]] = &[...];

      // Pass accounts to context one-by-one and construct accounts here
      // Or in practise, it may be easier to use remaining_accounts
      // https://book.anchor-lang.com/anchor_in_depth/the_program_module.html

      let accounts = jupiter_cpi::cpi::accounts::SharedAccountsRoute {
          token_program: ,
          program_authority: ,
          user_transfer_authority: ,
          source_token_account: ,
          program_source_token_account: ,
          program_destination_token_account: ,
          destination_token_account: ,
          source_mint: ,
          destination_mint: ,
          platform_fee_account: ,
          token_2022_program: ,
      };
      let cpi_ctx = CpiContext::new_with_signer(
          ctx.accounts.jup.to_account_info(),
          accounts,
          signer_seeds,
      );

      jupiter_cpi::cpi::shared_accounts_route(
          cpi_ctx,
          id,
          route_plan,
          in_amount,
          quoted_out_amount,
          slippage_bps,
          platform_fee_bps,
      );

      ...
      ```
    </Accordion>
  </Accordion>

  <Accordion title="Flash Fill References">
    **A Flash Fill transaction will be composed of these instructions:**

    1. Borrow enough SOL for opening the wSOL account from this program.
    2. Create the wSOL account for the borrower.
    3. Swap X token to wSOL.
    4. Close the wSOL account and send it to the borrower.
    5. Repay the SOL for opening the wSOL account back to this program.

    **Links and resources:**

    * [https://github.com/jup-ag/sol-swap-flash-fill](https://github.com/jup-ag/sol-swap-flash-fill)
  </Accordion>
</AccordionGroup>


# Common Errors
Source: https://dev.jup.ag/docs/swap/common-errors

List of errors that can be returned by the Metis Swap API, Swap Program or from other programs like DEXes, System or Token programs.

This page covers error categories you may encounter when using the Metis Swap API: Jupiter Swap program errors (e.g., slippage exceeded, insufficient funds), Solana and DEX program errors, routing errors (e.g., no routes found, token not tradable), and swap transaction composing errors. Each entry includes debug guidance.

In this section, you can find the list of errors that can be returned by the Metis Swap API, Swap Program or from other programs like DEXes, System or Token programs.

## Program Errors

### Jupiter Swap Program Errors

<Info>
  **JUPITER SWAP PROGRAM IDL**

  You can find the full Swap Program IDL here: <a href="https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4#anchorProgramIdl">[https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4#anchorProgramIdl](https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4#anchorProgramIdl)</a>
</Info>

<Note>
  **ABNORMAL ERROR RATES**

  If you face high or consistent amounts of errors, please reach out to [Jupiter Discord](https://discord.gg/jup).
</Note>

| Error Code | Error Name                | Debug                                                                                                                 |
| :--------- | :------------------------ | :-------------------------------------------------------------------------------------------------------------------- |
| 6001       | SlippageToleranceExceeded | Try higher fixed slippage or try [`dynamicSlippage`](/docs/swap/send-swap-transaction#how-jupiter-estimates-slippage) |
| 6008       | NotEnoughAccountKeys      | Likely modified swap transaction causing missing account keys                                                         |
| 6014       | IncorrectTokenProgramID   | Likely attempted to take platform fees on a Token2022 token (This is also 0x177e)                                     |
| 6017       | ExactOutAmountNotMatched  | Similar to slippage                                                                                                   |
| 6024       | InsufficientFunds         | Insufficient funds for either swap amount, transaction fees or rent fees                                              |
| 6025       | InvalidTokenAccount       | A token account passed in is invalid, it can be uninitialized or not expected                                         |

### Solana Program Errors

| Program                          | Link                                                                                                                                                                                   |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token Program                    | [https://github.com/solana-program/token/blob/main/program/src/error.rs](https://github.com/solana-program/token/blob/main/program/src/error.rs)                                       |
| Token2022 Program                | [https://github.com/solana-program/token-2022/blob/main/program/src/error.rs](https://github.com/solana-program/token-2022/blob/main/program/src/error.rs)                             |
| Associated Token Account Program | [https://github.com/solana-program/associated-token-account/blob/main/program/src/error.rs](https://github.com/solana-program/associated-token-account/blob/main/program/src/error.rs) |
| Other Solana Programs            | [https://github.com/solana-program](https://github.com/solana-program)                                                                                                                 |

### DEX Program Errors

In the swap transaction, the DEX in routing may return errors. You can find some of their IDLs and/or error codes in an explorer. If they do not support public IDLs or open source code, you can reference the common errors below or if you need additional help, please reach out to [Jupiter Discord](https://discord.gg/jup).

| Error                                                   | Description                                                                                           |
| :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------- |
| Error related to tick array or bitmap extension account | Similar to slippage, the price or market has "moved out of range", hence the swap transaction failed. |

## Routing Errors

The common routing errors you may encounter are usually related to attempting to swap a token that is not tradable on Jupiter, for reasons such as lack of liquidity or the token is not supported.

| Error                                                | Description                                                                                                               | Debug                                                                                                                                                                                      |
| :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NO\_ROUTES\_FOUND                                    | No routes were found for the requested swap                                                                               | \* Check jup.ag if it's routable <br /> \* [Check the liquidity of the token's markets](https://support.jup.ag/hc/en-us/articles/18453861473436-Why-is-this-token-not-tradable-on-Jupiter) |
| COULD\_NOT\_FIND\_ANY\_ROUTE                         | Unable to find any valid route for the swap                                                                               | \* Check jup.ag if it's routable <br /> \* [Check the liquidity of the token's markets](https://support.jup.ag/hc/en-us/articles/18453861473436-Why-is-this-token-not-tradable-on-Jupiter) |
| ROUTE\_PLAN\_DOES\_NOT\_   CONSUME\_ALL\_THE\_AMOUNT | The calculated route cannot process the entire input amount, you can get more output amount by reducing your input amount | \* Try reducing your input amount                                                                                                                                                          |
| MARKET\_NOT\_FOUND                                   | The specified market address was not found                                                                                | \* Verify the market address exists and is active                                                                                                                                          |
| TOKEN\_NOT\_TRADABLE                                 | The specified token mint is not available for trading                                                                     | \* Check jup.ag if it's routable <br /> \* [Check the liquidity of the token's markets](https://support.jup.ag/hc/en-us/articles/18453861473436-Why-is-this-token-not-tradable-on-Jupiter) |
| NOT\_SUPPORTED                                       | Generic error for unsupported operations                                                                                  | \* Check the specific error message for details                                                                                                                                            |
| CIRCULAR\_ARBITRAGE\_   IS\_DISABLED                 | Attempted to swap a token for itself                                                                                      | \* Input and output tokens must be different                                                                                                                                               |
| CANNOT\_COMPUTE\_   OTHER\_AMOUNT\_THRESHOLD         | Failed to calculate the minimum output amount based on slippage                                                           | \* Verify the input amount and slippage parameters are valid                                                                                                                               |

## Swap Transaction Composing Errors

| Error                                                   | Description                                                   | Debug                                                           |
| :------------------------------------------------------ | :------------------------------------------------------------ | :-------------------------------------------------------------- |
| MAX\_ACCOUNT\_GREATER\_THAN\_MAX                        | The specified number of accounts exceeds the maximum allowed  | \* Reduce the number of accounts in the transaction             |
| INVALID\_COMPUTE\_UNIT\_PRICE\_AND\_PRIORITIZATION\_FEE | Both compute unit price and prioritization fee were specified | - Use either compute unit price or prioritization fee, not both |
| FAILED\_TO\_GET\_SWAP\_AND\_ACCOUNT\_METAS              | Failed to generate the swap transaction                       | \* Check the error message for specific details                 |

## Best Practices

It is important to understand the error codes when your products are user facing. This will help you provide a better experience for your users, helping them make an informed decision or follow up step to help their transaction succeed.

<Tip>
  **JUP.AG AS A REFERENCE**

  You can use [https://jup.ag/](https://jup.ag/) as a reference to understand how we handle errors on the UI.
</Tip>

| Error Type                   | Best Practice                                                                                         |
| :--------------------------- | :---------------------------------------------------------------------------------------------------- |
| Slippage exceeding threshold | Show the user the current slippage tolerance and the incurred slippage                                |
| Insufficient funds           | Show the user the current balance of the account and the required balance                             |
| Non Jupiter Program Errors   | Allow the user to retry with a different route and/or exclude the specific DEX from the quote request |
| Token not tradable           | Show the user the token is not tradable and provide context on why it's not tradable                  |


# Get Quote
Source: https://dev.jup.ag/docs/swap/get-quote

Get a swap route quote from the Metis routing engine.

The `/swap/v1/quote` endpoint returns route plans from the Metis routing engine. Pass `inputMint`, `outputMint`, `amount`, and `slippageBps` to receive the best route with price impact and detailed swap info. The quote is the first step in the Metis swap flow.

The Quote API enables you to tap into the Metis Routing Engine, which accesses the deep liquidity available within the DEXes of Solana's DeFi ecosystem. In this guide, we will walkthrough how you can get a quote for a specific token pair and other related parameters.

<Warning>
  **PLEASE USE THE METIS SWAP API AT YOUR OWN DISCRETION.**

  The Jupiter UI at [https://jup.ag/](https://jup.ag/) contains multiple safeguards, warnings and default settings to guide our users to trade safer. Jupiter is not liable for losses incurred by users on other platforms.

  If you need clarification or support, please reach out to us in [Discord](https://discord.gg/jup).
</Warning>

<Warning>
  **ROUTING ENGINE**

  The quotes from Metis Swap API are from the Metis Routing Engine.
</Warning>

## Let’s Get Started

In this guide, we will be using the Solana web3.js package.

If you have not set up your environment to use the necessary libraries and the connection to the Solana network, please head over to [Environment Setup](/get-started/environment-setup).

<Tip>
  **API REFERENCE**

  To fully utilize the Metis Quote API, check out the [Metis Quote API Reference](/api-reference/swap/quote).
</Tip>

## Metis Quote API

The most common trading pair on Solana is SOL and USDC, to get a quote for this specific token pair, you need to pass in the required parameters such as:

| Parameters  | Description                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| inputMint   | The pubkey or token mint address e.g. So11111111111111111111111111111111111111112                                                                                          |
| outputMint  | The pubkey or token mint address e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v                                                                                         |
| amount      | The number of **input** tokens before the decimal is applied, also known as the “raw amount” or “integer amount” in lamports for SOL or atomic units for all other tokens. |
| slippageBps | The number of basis points you can tolerate to lose during time of execution. e.g. 1% = 100bps                                                                             |

## Get Quote

Using the root URL and parameters to pass in, it is as simple as the example code below!

Fetch a quote for 1 SOL to USDC with 0.5% slippage:

```js theme={null}
const quoteResponse = await (
    await fetch(
        'https://api.jup.ag/swap/v1/quote?' +
        'inputMint=So11111111111111111111111111111111111111112' +
        '&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' +
        '&amount=100000000' +
        '&slippageBps=50' +
        '&restrictIntermediateTokens=true'
    ),
    {
        headers: {
            'x-api-key': 'your-api-key',
        },
    }
  ).json();

console.log(JSON.stringify(quoteResponse, null, 2));
```

Example response:

```json expandable theme={null}
{
  "inputMint": "So11111111111111111111111111111111111111112",
  "inAmount": "100000000",
  "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "outAmount": "16198753",
  "otherAmountThreshold": "16117760",
  "swapMode": "ExactIn",
  "slippageBps": 50,
  "platformFee": null,
  "priceImpactPct": "0",
  "routePlan": [
    {
      "swapInfo": {
        "ammKey": "5BKxfWMbmYBAEWvyPZS9esPducUba9GqyMjtLCfbaqyF",
        "label": "Meteora DLMM",
        "inputMint": "So11111111111111111111111111111111111111112",
        "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "inAmount": "100000000",
        "outAmount": "16198753"
      },
      "percent": 100
    }
  ],
  "contextSlot": 299283763,
  "timeTaken": 0.015257836
}
```

<Tip>
  **TIP**

  `outAmount` refers to the best possible output amount based on the route at time of quote, this means that `slippageBps` does not affect.
</Tip>

## What’s Next

Now, you are able to get a quote, next steps is to submit a transaction to execute the swap based on the quote given. Let’s go!

## Additional Resources

### Restrict Intermediate Tokens

`restrictIntermediateTokens` can be set to `true` . If your route is routed through random intermediate tokens, it will fail more frequently. With this, we make sure that your route is only routed through highly liquid intermediate tokens to give you the best price and more stable route.

### Legacy Transactions

All Jupiter swaps are using Versioned Transactions and [Address Lookup Tables](https://docs.solana.com/developing/lookup-tables). However, not all wallets support Versioned Transactions yet, so if you detect a wallet that does not support versioned transactions, you will need to set the `asLegacyTransaction` parameter to `true`.

### Adding Fees

By using the Quote API in your app, you can add a fee to charge your users. You can refer to the `platformFeeBps` parameter and to add it to your quote and in conjuction, add `feeAccount` (it can be any valid token account) to your swap request.

### Direct Routes

In some cases, you may want to restrict the routing to only go through 1 market. You can use the `onlyDirectRoutes` parameter to achieve this. This will ensure routing will only go through 1 market.

<Info>
  **NOTE**

  * If there are no direct routes, there will be no quote.
  * If there is only 1 market but it is illiquid, it will still return the route with the illiquid market.
</Info>

<Warning>
  **UNFAVORABLE TRADES**

  Please be aware that using `onlyDirectRoutes` can often yield unfavorable trades or outcomes.
</Warning>

### Max Accounts

In some cases, you may want to add more accounts to the transaction for specific use cases, but it might exceed the transaction size limit. You can use the `maxAccounts` parameter to limit the number of accounts in the transaction.

<Warning>
  **UNFAVORABLE TRADES**

  Please be aware that the misuse of `maxAccounts` can yield unfavorable trades or outcomes.
</Warning>

<Tip>
  **TIP**

  Refer to the [Requote with Lower Max Accounts](/docs/swap/requote-with-lower-max-accounts) guide for more information on how to requote and adjust the swap when using `maxAccounts`.
</Tip>

<Info>
  **NOTE**

  * `maxAccounts` is an estimation and the actual number of accounts may vary.
  * `maxAccounts` only applies to the total number of accounts of the inner swaps in the swap instruction and not any of the setup, cleanup or other instructions (see the example below).
  * We recommend setting `maxAccounts` to 64
  * Keep `maxAccounts` as large as possible, only reduce `maxAccounts` if you exceed the transaction size limit.
  * If `maxAccounts` is set too low, example to 30, the computed route may drop DEXes/AMMs like Meteora DLMM that require more than 30 accounts.

  **Jupiter has 2 types of routing instructions**, if you plan to limit `maxAccounts`, you will need to account for if the market is routable with [ALTs](https://docs.solana.com/developing/lookup-tables) or not:

  * **`Routing Instruction`** (Simple Routing): The market is still new, and we do not have ALTs set up for the market, hence the number of accounts required is higher as there are more accounts required.
  * **`Shared Accounts Routing Instruction`**: The market has sufficient liquidity (and has been live for a while), and we have [ALTs](https://docs.solana.com/developing/lookup-tables) set up for the market to be used in the routing instruction, hence the number of accounts required is lower as there are less accounts required.
</Info>

<AccordionGroup>
  <Accordion title="Counting the accounts using an example transaction">
    [In this transaction](https://solscan.io/tx/2xpiniSn5z61hE6gB6EUaeRZCqeg8rLBEbiSnAjSD28tjVTSpBogSLfrMRaJiDzuqDyZ8v49Z7WL2TKvGQVwYbB7):

    <CardGroup>
      <Frame>
        <img alt="Max Accounts Stabble Example" />
      </Frame>

      <Frame>
        <img alt="Max Accounts Lifinity V2 Example" />
      </Frame>

      <Frame>
        <img alt="Max Accounts Shared Accounts Route Example" />
      </Frame>
    </CardGroup>

    * You can see that there are a total of 2 inner swaps where the number of accounts respectively are

      * Stabble Stable Swap: 12
      * Lifinity Swap V2: 13
      * Total: 25

    * The `maxAccounts` parameter is to control this value - to limit the total number of accounts in the inner swaps.

    * It doesn’t take into the consideration of a few things:

      * Each of the inner swap's program address, so 2 in this case.
      * Top level routing instruction accounts where in this case Shared Accounts Route is 13 and Route is 9.
      * There are also other accounts that are required to set up, clean up, etc which are not counted in the `maxAccounts` parameter
  </Accordion>

  <Accordion title="List of DEXes and their required accounts">
    Notes:

    * Values in the table are only estimations and the actual number of accounts may vary.
    * Min accounts are needed when we have already created the necessary [ALTs](https://docs.solana.com/developing/lookup-tables) for a specific pool resulting in less accounts needed in a Shared Accounts Routing context.
    * Sanctum and Sanctum Infinity are unique, and their accounts are dynamic.

    | DEX                   | Max | Min |
    | :-------------------- | :-- | :-- |
    | Meteora DLMM          | 47  | 19  |
    | Meteora               | 45  | 18  |
    | Moonshot              | 37  | 15  |
    | Obric                 | 30  | 12  |
    | Orca Whirlpool        | 30  | 12  |
    | Pumpfun AMM           | 42  | 17  |
    | Pumpfun Bonding Curve | 40  | 16  |
    | Raydium               | 45  | 18  |
    | Raydium CLMM          | 45  | 19  |
    | Raydium CPMM          | 37  | 14  |
    | Sanctum               | 80  | 80  |
    | Sanctum Infinity      | 80  | 80  |
    | Solfi                 | 22  | 9   |
  </Accordion>
</AccordionGroup>


# Metis Swap API Overview
Source: https://dev.jup.ag/docs/swap/index

Low-level routing engine for developers who need CPI, custom instructions, or full transaction control. Requires your own RPC.

Metis is Jupiter's low-level routing engine for developers who need CPI, custom instructions, or full transaction control. The flow is three steps: get a quote (`GET /swap/v1/quote`), build a transaction (`POST /swap/v1/swap`), then sign and send via your own RPC. Unlike Ultra, Metis requires you to handle slippage, priority fees, and transaction landing yourself.

Metis is Jupiter's original, low-level routing engine designed for maximum flexibility, transparency, and composability. It was the foundation that set the standard for reliable, general-purpose liquidity aggregation on Solana, and its learnings directly informed the development of newer engines like Iris (which powers Jupiter Ultra).

Unlike Jupiter Ultra and its routing engines (Juno, Iris, JupiterZ), which focus on end-to-end execution and abstraction, Metis exposes granular control over raw swap instructions. This is beneficial for developers and integrators who need to fine-tune every aspect of their swap transactions.

**Related:** [Jupiter routing ecosystem](/docs/routing) | [Metis v7 blog post](/blog/metis-v7)

<Card href="/docs/routing" icon="book-open">
  Learn more about how Metis fits into Jupiter's routing ecosystem, including Juno, Iris, and JupiterZ, in our [Routing documentation](/docs/routing).
</Card>

<Card href="/blog/metis-v7" icon="book-open">
  Metis is now an independent public good, no longer coupled to Jupiter or Ultra, and is maintained as a toolkit for the ecosystem. Read more in our [Metis v7 blog post](/blog/metis-v7).

  Though Jupiter continues to provide access to a hosted Metis API for developers.
</Card>

## We recommend using Ultra Swap API

Ultra Swap API is the spiritual successor to Metis Swap API, and is much simpler to use than Metis Swap API. If you are first starting out on your Solana development journey, using Ultra Swap API is highly recommended over Metis Swap API.

<Tip>
  For more information about Ultra Swap API, please refer to the [Ultra Swap API](/docs/ultra) documentation.
</Tip>

<Info>
  **Using Metis Swap API**

  Requires your own maintenance, optimizations and dependencies.

  * **Upkeep of RPCs**: To retrieve wallet balances, broadcast and retrieve transactions, etc.
  * **Deciding transaction fee**: Including, but not limited to, priority fee, Jito fee, etc.
  * **Deciding slippage**: The optimal slippage to use to balance between trade success and price protection, do note that [RTSE is only available via Ultra Swap API](/docs/ultra#real-time-slippage-estimator).
  * **Broadcasting the transaction**: Ultra uses a proprietary transaction sending engine which dramatically improves landing rate and speed.
  * **Parsing the swap results**: Polling and parsing the resulting transaction from the RPC, including handling for success and error cases.

  Though comes with other ways to use Jupiter.

  * Add custom instructions.
  * Use via Cross Program Invocation (CPI) calls.
  * Choose your own transaction broadcasting method (like Typical RPCs, Jito, etc).
  * Modify the number of accounts to use in a transaction.
</Info>

## Getting Started with Metis Swap API

1. [**Get Quote**](/docs/swap/get-quote): Request for a quote which consists of the route plan, and other params such as integrator fee, slippage, etc.

2. [**Build Swap Transaction**](/docs/swap/build-swap-transaction): Post the quote to build a swap transaction.

   * You can utilize other methods to return swap instructions or use CPI rather than the default swap transaction.
   * You can utilize other parameters such as priority fee, dynamic slippage, etc to customize the transaction.

3. [**Send Swap Transaction**](/docs/swap/send-swap-transaction): Sign and send the swap transaction to the network via your own RPC or other methods.

**Other Guides**

* [**Adding Fees to Metis Swap API**](/docs/swap/add-fees-to-swap): Add custom integrator fees to the swap transaction.
* [**Requote with Lower Max Accounts**](/docs/swap/requote-with-lower-max-accounts): Requote with a lower max accounts to reduce the transaction size to fit more instructions or other use cases.


# Payments Through Swap
Source: https://dev.jup.ag/docs/swap/payments-through-swap

Accept payments in any token while receiving your preferred token using the Metis Swap API.

Use the Metis Swap API as a payment solution by setting `swapMode` to `ExactOut` in the quote request. This lets a customer pay in any token while the merchant receives an exact amount of their preferred token via `destinationTokenAccount`.

The Metis Swap API can be utilized such that you, a merchant can allow your customer to pay in any tokens while you still receive in your preferred token payment at the end of the transaction.

## Use Case

Let’s set the stage. You are selling a **jupcake!!!** to your customer and merchant might only accept in 1 USDC, but your customer only has 1 SOL. Well, you’re at the right place! By using the Metis Swap API, merchant can let customer pay in SOL while merchant still receive USDC in order to complete the payment for a jupcake.

* Customer has 1,000,000 SOL.
* Merchant sells 1 jupcake for 1 USDC.
* Use the Metis Swap API to swap exactly 1 USDC output from Customer's SOL.
* Merchant receives the 1 USDC, as planned!

## Let’s Get Started

### 1. Setup

You will need slightly different imports and also remember to set up connection to an RPC. If you have not set up the other typical libraries or are familiar with the Metis Swap API, please follow this [Environment Setup](/get-started/environment-setup) and [Get Quote and Swap](/docs/swap/get-quote) guide.

```bash theme={null}
npm i @solana/spl-token
```

```js theme={null}
import { PublicKey, Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
```

Before we start getting a quote and swap transaction, for example sake, we will need to prepare both merchant and customer accounts. In production scenario, you will need to dynamically pass this in and allow users to sign in their device interfaces.

<Info>
  **NOTE**

  Do note that you will need to have already set up:

  * **A wallet in your machine to simulate yourself as the customer as the customer is the signer of the transaction** (similar to how we set up in [Environment Setup](/get-started/environment-setup)).
  * `trackingAccount` is an additional Solana Account you can pass in to track only Jupiter transactions easily.
</Info>

#### Set Up Accounts

```js theme={null}
const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
const customerWallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'); // Your preferred token payment
const customerAccount = customerWallet.publicKey;
const merchantAccount = new PublicKey('ReplaceWithMerchantPubkey');
// const trackingAccount = new PublicKey('ReplaceWithPubkey'); // If required

console.log("USDC_MINT:", USDC_MINT.publicKey);
console.log("merchantAccount:", merchantAccount.publicKey);
// console.log("trackingAccount:", trackingAccount.publicKey);
```

#### Set Up `destinationTokenAccount`

One more thing you will need to set up! Later on, you will need to pass in `destinationTokenAccount` which will be your token account for your preferred token payment mint. **Do note that it is the merchant's token account and it needs to be initialized.**

```js theme={null}
// Get the associated token account for the merchant wallet
const merchantUSDCTokenAccount = await getAssociatedTokenAddress(
	  USDC_MINT,
	  merchantAccount,
	  true,
	  TOKEN_PROGRAM_ID,
	  ASSOCIATED_TOKEN_PROGRAM_ID
);

console.log("merchantUSDCTokenAccount:", merchantUSDCTokenAccount.publicKey);
```

<Tip>
  You can also use `nativeDestinationAccount` to receive the native SOL token out of the swap. This is useful if you want to receive native SOL in a destination account.
</Tip>

### 2. Set `swapMode` to `ExactOut` in Quote

Next, the merchant have to [Get Quote](/docs/swap/get-quote) for the customer. We are using the `ExactOut` mode because we know exactly how much output amount (1 USDC) the merchant want to receive but not sure how much input amount the customer should pay with.

By getting a quote first, the customer can know upfront the specific amount of input token before they approve and sign the transaction.

<Warning>
  **LIMITATIONS OF `ExactOut`**

  Currently, there are some limitations as `ExactOut` is not widely supported across all DEXes.

  * Supported DEXes are only Orca Whirlpool, Raydium CLMM, and Raydium CPMM.
  * NOT ALL token pairs may be available.
</Warning>

```js theme={null}
const quoteResponse = await (
    await fetch(
        'https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=100000&slippageBps=50&restrictIntermediateTokens=true&swapMode=ExactOut'
    ),
    {
        headers: {
            'x-api-key': 'your-api-key',
        },
    }
  ).json();

console.log(JSON.stringify(quoteResponse, null, 2));
```

From the this quote, you should get part of the response like this, where `amount` specified in the query parameter represents the `outAmount` in the response and of course, `swapMode: ExactOut`.

```js theme={null}
{
    "inputMint": "So11111111111111111111111111111111111111112",
    "inAmount": "4434914",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "outAmount": "1000000",
    "otherAmountThreshold": "4434914",
    "swapMode": "ExactOut",
    ...
}
```

### 3. Set `destinationTokenAccount` in Swap

The merchant then retrieves the serialized swap transaction, but the merchant need to specify the `destinationTokenAccount` in the parameters — this will build the swap transaction to swap but send to the [merchant's specified token account which we defined earlier](#set-up-destinationtokenaccount).

The `destinationTokenAccount` should be the merchant’s token account to receive the payment in. Also do note that `customerAccount` should be accounted for. **You can refer to the [Build Swap Transaction](/docs/swap/build-swap-transaction) guide for other parameters to be passed in.**

<Note>
  There is an alternative `nativeDestinationAccount`, where you can pass in a public key of an account that will be used to receive the native SOL token out of the swap. This is useful if you want to receive native SOL to a new account.
</Note>

```js theme={null}
const swapResponse = await (
    await fetch('https://api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            quoteResponse,
            userPublicKey: customerAccount.publicKey,
            destinationTokenAccount: merchantUSDCTokenAccount.publicKey,
            // trackingAccount: trackingAccount.publicKey,
        })
    })
).json();
```

### 4. Prepare Transaction

We have walked through the steps here and explained some of the code, you can refer to [Send Swap Transaction - Prepare Transaction](/docs/swap/send-swap-transaction#prepare-transaction). The main difference for payments is to ensure that the customer is the fee payer (the merchant can be generous and be the fee payer too!) and the signer.

```js theme={null}
const transactionBase64 = swapResponse.swapTransaction
const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
transaction.feePayer = customerAccount.publicKey;
transaction.sign([customerWallet]);
const transactionBinary = transaction.serialize();
```

### 5. Send Transaction

We have walked through the steps here and explained some of the code, you can refer to [Send Swap Transaction - Send Transaction](/docs/swap/send-swap-transaction#send-transaction). The main difference for payments is, you might want to try adjusting `maxRetries` to a higher count as it is not time sensitive and ideally this is used with tighter slippage and ensuring the `inputMint` is not too unstable.

Do note that more retries will cause the user to wait slightly longer, so find the balance between the two. Read more here: [https://solana.com/docs/advanced/retry](https://solana.com/docs/advanced/retry).

```js theme={null}
const signature = await connection.sendRawTransaction(transactionBinary, {
    maxRetries: 10,
});

const confirmation = await connection.confirmTransaction({ signature }, "finalized");

if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}\nhttps://solscan.io/${signature}/`);
} else console.log(`Transaction successful: https://solscan.io/tx/${signature}/`);
```

The succeeded Swap Transaction should show:

* Token A swaps from the customer's token account
* Token A swap to Token B
* Token B sends to the merchant's token account

<Card title="If transactions are not landing well, you can refer to this section." href="/docs/swap-api/send-swap-transaction#oh-transaction-not-landing" icon="money-bill" />


# Requote with Lower Max Accounts
Source: https://dev.jup.ag/docs/swap/requote-with-lower-max-accounts

Handle oversized swap transactions by reducing the account count in your quote request.

When adding custom instructions to a Metis swap transaction causes it to exceed Solana's 1232-byte transaction size limit, reduce `maxAccounts` in the `/quote` request and rebuild. This page provides a retry loop that decrements `maxAccounts` until the transaction fits.

In some cases where you might be limited or require strict control by adding your own instructions to the swap transaction, you might face issues with exceeding transaction size limit. In this section, we will provide some helping code to help you requote when the transaction size is too large.

<Info>
  **NOTE**

  We provide a `maxAccounts` param in the `/quote` endpoint to allow you to reduce the total number of accounts used for a swap - this will allow you to add your own instructions.

  <CardGroup>
    <Card title="Refer to this section for more information and do note its limitations and important notes before using" href="/docs/swap-api/get-quote#max-accounts" icon="book-open" />
  </CardGroup>
</Info>

## Example Code

1. Request for quote and the swap transaction as per normal.

2. Serialize the transaction.

3. Use the conditions to check if the transaction is too large.

   1. If too large, requote again with lower max accounts - do note that the route will change.
   2. If not, sign and send to the network.

<Tip>
  **TIP**

  We recommend `maxAccounts` 64 and start as high as you can, then incrementally reduce when requoting.

  Do note that with lower max accounts, it will might yield bad routes or no route at all.
</Tip>

<Tip>
  **TIP**

  When you serialize the transaction, you can log the number of raw bytes being used in the transaction.

  You can either add your custom instructions before or after serializing the transaction.
</Tip>

```js expandable theme={null}
import {
    AddressLookupTableAccount,
    Connection,
    Keypair,
    PublicKey,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js';

// Set up dev environment
import fs from 'fs';
const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/key', 'utf8').trim());
const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
const connection = new Connection('your-own-rpc');

// Recommended
const MAX_ACCOUNTS = 64

async function getQuote(maxAccounts) {
    const params = new URLSearchParams({
        inputMint: 'insert-mint',
        outputMint: 'insert-mint',
        amount: '1000000',
        slippageBps: '100',
        maxAccounts: maxAccounts.toString()
    });

    const url = `https://api.jup.ag/swap/v1/quote?${params}`;
    const response = await fetch(url, {
        headers: {
            'x-api-key': 'your-api-key',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const quoteResponse = await response.json();

    if (quoteResponse.error) {
        throw new Error(`Jupiter API error: ${quoteResponse.error}`);
    }

    return quoteResponse;
};

async function getSwapInstructions(quoteResponse) {
    const response = await fetch('https://api.jup.ag/swap/v1/swap-instructions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            quoteResponse: quoteResponse,
            userPublicKey: wallet.publicKey.toString(),
            prioritizationFeeLamports: {
                priorityLevelWithMaxLamports: {
                    maxLamports: 10000000,
                    priorityLevel: "veryHigh"
                }
            },
            dynamicComputeUnitLimit: true,
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const swapInstructionsResponse = await response.json();

    if (swapInstructionsResponse.error) {
        throw new Error(`Jupiter API error: ${swapInstructionsResponse.error}`);
    }

    return swapInstructionsResponse;
};

async function buildSwapTransaction(swapInstructionsResponse) {
    const {
        computeBudgetInstructions,
        setupInstructions,
        swapInstruction,
        cleanupInstruction,
        addressLookupTableAddresses,
    } = swapInstructionsResponse;

    const deserializeInstruction = (instruction) => {
        if (!instruction) return null;
        return new TransactionInstruction({
            programId: new PublicKey(instruction.programId),
            keys: instruction.accounts.map((key) => ({
                pubkey: new PublicKey(key.pubkey),
                isSigner: key.isSigner,
                isWritable: key.isWritable,
            })),
            data: Buffer.from(instruction.data, "base64"),
        });
    };

    const getAddressLookupTableAccounts = async (
        keys
    ) => {
        const addressLookupTableAccountInfos =
            await connection.getMultipleAccountsInfo(
                keys.map((key) => new PublicKey(key))
            );

        return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
            const addressLookupTableAddress = keys[index];
            if (accountInfo) {
                const addressLookupTableAccount = new AddressLookupTableAccount({
                    key: new PublicKey(addressLookupTableAddress),
                    state: AddressLookupTableAccount.deserialize(accountInfo.data),
                });
                acc.push(addressLookupTableAccount);
            }

            return acc;
        }, []);
    };

    const addressLookupTableAccounts = [];
    addressLookupTableAccounts.push(
        ...(await getAddressLookupTableAccounts(addressLookupTableAddresses))
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;

    // Create transaction message with all instructions
    const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: [
            ...(computeBudgetInstructions?.map(deserializeInstruction).filter(Boolean) || []),
            ...(setupInstructions?.map(deserializeInstruction).filter(Boolean) || []),
            deserializeInstruction(swapInstruction),
            ...(cleanupInstruction ? [deserializeInstruction(cleanupInstruction)].filter(Boolean) : []),
        ].filter(Boolean),
    }).compileToV0Message(addressLookupTableAccounts);

    const transaction = new VersionedTransaction(messageV0);

    return transaction;
}

async function checkTransactionSize(transaction) {
    // Max raw bytes of a Solana transaction is 1232 raw bytes
    // Using the conditions below, we can check the size of the transaction
    // (or if it is too large to even serialize)
    try {
        const transactionUint8Array = transaction.serialize();
        console.log(transactionUint8Array.length)

        // Use 1232 assuming you have added your instructions to the transaction above
        // If you have not add your instructions, you will need to know how much bytes you might use
        return (transactionUint8Array.length > 1232);

    } catch (error) {
        if (error instanceof RangeError) {
            console.log("Transaction is too large to even serialize (RangeError)");

            return true;

        } else {
            throw error; // Re-throw if it's not a RangeError
        }
    }
}

// Main execution logic with retry mechanism
let counter = 0;
let transactionTooLarge = true;
let quoteResponse, swapInstructionsResponse, transaction;

while (transactionTooLarge && counter < MAX_ACCOUNTS) {
    try {
        console.log(`Attempting with maxAccounts: ${MAX_ACCOUNTS - counter}`);

        quoteResponse = await getQuote(MAX_ACCOUNTS - counter);
        swapInstructionsResponse = await getSwapInstructions(quoteResponse);
        transaction = await buildSwapTransaction(swapInstructionsResponse);
        transactionTooLarge = await checkTransactionSize(transaction);

        if (transactionTooLarge) {
            console.log(`Transaction too large (with ${MAX_ACCOUNTS - counter} maxAccounts), retrying with fewer accounts...`);
            counter++;
        } else {
            console.log(`Transaction size OK with ${MAX_ACCOUNTS - counter} maxAccounts`);
        }

    } catch (error) {
        console.error('Error in attempt:', error);
        counter += 2; // Incrementing by 1 account each time will be time consuming, you can use a higher counter
        transactionTooLarge = true;
    }
}

if (transactionTooLarge) {
    console.error('Failed to create transaction within size limits after all attempts');
} else {
    console.log('Success! Transaction is ready for signing and sending');

    // After, you can add your transaction signing and sending logic
}
```

## Example Response

```bash theme={null}
Attempting with maxAccounts: 64
Transaction is too large to even serialize (RangeError)
Transaction too large (with 64 maxAccounts), retrying with fewer accounts...

Attempting with maxAccounts: 63
Transaction is too large to even serialize (RangeError)
Transaction too large (with 63 maxAccounts), retrying with fewer accounts...

...

Attempting with maxAccounts: 57
1244
Transaction too large (with 57 maxAccounts), retrying with fewer accounts...

Attempting with maxAccounts: 56
1244
Transaction too large (with 56 maxAccounts), retrying with fewer accounts...

...

Attempting with maxAccounts: 51
1213
Transaction size OK with 51 maxAccounts
Success! Transaction is ready for signing and sending
```


# Send Swap Transaction
Source: https://dev.jup.ag/docs/swap/send-swap-transaction

Sign and send a Metis swap transaction with guidance on priority fees, compute units, and broadcasting.

After building the swap transaction, deserialize it, sign with your wallet, and send via `connection.sendRawTransaction()`. This page covers transaction preparation, priority fee estimation, compute unit optimization, dynamic slippage, and alternative broadcasting methods (RPCs and Jito).

Transaction sending can be very simple but optimizing for transaction landing can be challenging. This is critical in periods of network congestion when many users and especially bots are competing for block space to have their transactions processed.

<Tip>
  **IMPROVE TRANSACTION LANDING TIP**

  By using Metis Swap API, you can enable Dynamic Slippage, Priority Fee estimation and Compute Unit estimation, all supported on our backend and served directly to you through our API.
</Tip>

## Let’s Get Started

In this guide, we will pick up from where [**Get Quote**](/docs/swap/get-quote) and [**Build Swap Transaction**](/docs/swap/build-swap-transaction) guide has left off.

If you have not set up your environment to use the necessary libraries, the RPC connection to the network and successfully get a quote from the Quote API, please start at [Environment Setup](/get-started/environment-setup) or [get quote](/docs/swap/get-quote).

## Prepare Transaction

<Note>
  **WHO IS THE SIGNER?**

  The most important part of this step is to sign the transaction. For the sake of the guide, you will be using the file system wallet you have set up to sign and send yourself.

  However, for other production scenarios such as building your own program or app on top of the Metis Swap API, you will need the user to be the signer which is often through a third party wallet provider, so do account for it.
</Note>

In the previous guide, we are able to get the `swapTransaction` from the Metis Swap API response. However, you will need to reformat it to sign and send the transaction, here are the formats to note of.

| Formats                      | Description                                                                                                                                |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| Serialized Uint8array format | The correct format to send to the network.                                                                                                 |
| Serialized base64 format     | This is a text encoding of the Uint8array data, meant for transport like our Metis Swap API or storage. You should not sign this directly. |
| Deserialized format          | This is the human-readable, object-like format before serialization. This is the state you will sign the transaction.                      |

Here's the code to deserialize and sign, then serialize.

1. `swapTransaction` from the Metis Swap API is a serialized transaction in the **base64 format**.
2. Convert it to **Uint8array (binary buffer) format**.
3. Deserialize it to a **VersionedTransaction** object to sign.
4. Finally, convert it back to **Uint8array** format to send the transaction.

Deserialize, sign, and serialize the transaction:

```js theme={null}
const transactionBase64 = swapResponse.swapTransaction
const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
console.log(transaction);

transaction.sign([wallet]);

const transactionBinary = transaction.serialize();
console.log(transactionBinary);
```

<Tip>
  **BLOCKHASH VALIDITY**

  If you look at the response of `console.log(transaction);`, you can see that our backend has already handled the blockhash and last valid block height in your transaction.

  The validity of a blockhash typically lasts for 150 slots, but you can manipulate this to reduce the validity of a transaction, resulting in faster failures which could be useful in certain scenarios.

  <Card title="Read more about transaction expiry here." href="https://solana.com/docs/advanced/confirmation#transaction-expiration" icon="book-open" />
</Tip>

## Send Transaction

### Transaction Sending Options

Finally, there are a 2 [transaction sending options](https://solana.com/docs/advanced/retry#an-in-depth-look-at-sendtransaction) that we should take note of. Depending on your use case, these options can make a big difference to you or your users. For example, if you are using the Metis Swap API as a payment solution, setting higher `maxRetries` allows the transaction to have more retries as it is not as critical compared to a bot that needs to catch fast moving markets.

<Accordion title="Transaction Sending Options">
  | Options                                                                                | Description                                                                                                                                                                                                               |
  | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | [maxRetries](https://solana.com/docs/advanced/retry)                                   | Maximum number of times for the RPC node to retry sending the transaction to the leader. If this parameter is not provided, the RPC node will retry the transaction until it is finalized or until the blockhash expires. |
  | [skipPreflight](https://solana.com/docs/advanced/retry#the-cost-of-skipping-preflight) | If true, skip the preflight transaction checks (default: false). - Verify that all signatures are valid.                                                                                                                  |

  * Check that the referenced blockhash is within the last 150 blocks.
  * Simulate the transaction against the bank slot specified by the preflightCommitment. |
</Accordion>

Send the signed transaction with retry settings:

```js theme={null}
const signature = await connection.sendRawTransaction(transactionBinary, {
    maxRetries: 2,
    skipPreflight: true
});
```

### Transaction Confirmation

In addition, after sending the transaction, it is always a best practice to check the transaction confirmation state, and if not, log the error for debugging or communicating with your users on your interface.

<Card title="Read more about transaction confirmation tips here." href="https://solana.com/docs/advanced/confirmation#transaction-confirmation-tips" icon="book-open" />

Confirm the transaction reached finality:

```js theme={null}
const confirmation = await connection.confirmTransaction({signature,}, "finalized");

if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}\nhttps://solscan.io/tx/${signature}/`);
} else console.log(`Transaction successful: https://solscan.io/tx/${signature}/`);
```

## Swap Transaction Executed!

If you have followed the guides step by step without missing a beat, your transaction *should* theoretically land and you can view the link in console log to see the [transaction](https://solscan.io/tx/zEWGsd5tSyxUdsTn27hUzaJBadQSiFxF2X1CxVdQzdtgc3BpqyDPf5VQCFUScidhHJP5PchY33oJ3tZJLK5KXrf).

## Oh? Transaction Not Landing?

As the Solana network grew and increased in activity over the years, it has become more challenging to land transactions. There are several factors that can drastically affect the success of your transaction:

* Setting competitive priority fee
* Setting accurate amount of compute units
* Managing slippage effectively
* Broadcasting transaction efficiently
* Other tips

### How Jupiter Estimates Priority Fee?

You can pass in `prioritizationFeeLamports` to Metis Swap API where our backend will estimate the Priority Fee for you.

We are using [Triton’s `getRecentPrioritizationFees`](https://docs.triton.one/chains/solana/improved-priority-fees-api) to estimate using the local fee market in writable accounts of the transaction (comparing to the global fee market), across the past 20 slots and categorizing them into different percentiles.

<Card title="Read More About Priority Fee" href="https://solana.com/docs/core/fees#prioritization-fees" icon="book-open" />

| Parameters      | Description                                                                                                                                                                                                  |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxLamports`   | A maximum cap applied if the estimated priority fee is too high. This is helpful when you have users using your application and can be a safety measure to prevent overpaying.                               |
| `global`        | A boolean to choose between using a global or local fee market to estimate. If `global` is set to `false`, the estimation focuses on fees relevant to the **writable accounts** involved in the instruction. |
| `priorityLevel` | A setting to choose between the different percentile levels. Higher percentile will have better transaction landing but also incur higher fees. - `medium`: 25th percentile                                  |

* `high`: 50th percentile
* `veryHigh`: 75th percentile |

```js theme={null}
const swapResponse = await (
  await fetch('https://api.jup.ag/swap/v1/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'your-api-key',
      },
      body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey,
          prioritizationFeeLamports: {
              priorityLevelWithMaxLamports: {
                  maxLamports: 10000000,
                  global: false,
                  priorityLevel: "veryHigh"
              }
          }
      })
  })
).json();
```

### How Jupiter Estimates Compute Unit Limit?

You can pass in `dynamicComputeUnitLimit` to Metis Swap API where our backend will estimate the Compute Unit Limit for you.

When `true`, it allows the transaction to utilize a dynamic compute unit rather than using incorrect compute units which can be detrimental to transaction prioritization. Additionally, the amount of compute unit used and the compute unit limit requested to be used are correlated to the amount of priority fees you pay.

<Card title="Read more about Compute Budget, Compute Unit, etc here." href="https://solana.com/docs/core/fees#compute-budget" icon="book-open" />

```js theme={null}
const swapTransaction = await (
  await fetch('https://api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key',
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: wallet.publicKey,
      dynamicComputeUnitLimit: true
    })
  })
).json();
```

### How Jupiter Estimates Slippage?

Slippage is an unavoidable aspect of trading on decentralized exchanges (DEXes).

#### About Slippage

* **Token Pair:** The same fixed slippage setting can have very different effects depending on the tokens involved. For example, swapping between two stablecoins is much less volatile than swapping between two meme coins.
* **Timing:** The time between when you receive a quote and when you actually send the swap transaction matters. Any delay can result in the price moving outside your slippage threshold.
* **Transaction Landing:** How efficiently your transaction lands on-chain also affects slippage. Poorly optimized transactions may experience more slippage.

<Tip>
  - If you use the Metis Swap API:

    * You are limited to fixed and dynamic slippage (no longer maintained) settings.
    * You are responsible for handling slippage and optimizing transaction landing yourself.

  - [Alternatively, consider using the Ultra Swap API](/docs/ultra):

    * All of these optimizations are handled for you - without any RPC from you.
    * Additional routing is available to RFQ (Request for Quote) systems like Jupiterz where slippage is not an issue because the market maker fills your order exactly as quoted.
</Tip>

#### Dynamic Slippage

Apart from the fixed slippage setting, you can use Dynamic Slippage: During swap transaction building, we will simulate the transaction and estimate a slippage value, which we then factor in the token categories heuristics to get the final slippage value.

<Note>
  **DYNAMIC SLIPPAGE VS REAL TIME SLIPPAGE ESTIMATOR (RTSE)**

  RTSE is very different from Dynamic Slippage and has provided a much better user experience and results. RTSE is able to intelligently estimate the best possible slippage to use at the time of execution, balancing between trade success and price protection. RTSE uses a variety of heuristics, algorithms and monitoring to ensure the best user experience:

  * **Heuristics**: Token categories, historical and real-time slippage data, and more.
  * **Algorithms**: Exponential Moving Average (EMA) on slippage data, and more.
  * **Monitoring**: Real-time monitoring of failure rates to ensure reactiveness to increase slippage when necessary.

  <Card title="Refer to Ultra Swap API for more information on RTSE" href="/docs/ultra#real-time-slippage-estimator" icon="book-open" />
</Note>

<Warning>
  **WARNING**

  Do note that we have discontinued development on Dynamic Slippage.
</Warning>

```js theme={null}
const swapTransaction = await (
  await fetch('https://api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key',
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: wallet.publicKey,
      dynamicSlippage: true,
    })
  })
).json();
```

### How Jupiter Broadcast Transactions?

Transaction broadcasting is the process of submitting a signed transaction to the network so that validators can verify, process, and include it in a block.

#### Broadcasting Through RPCs

After you’ve built and signed your transaction, the signed transaction is serialized into a binary format and sent to the network via a Solana RPC node. The RPC node will verify and relay the transaction to the leader validator responsible for producing the next block.

<Card title="Read more about how RPC nodes broadcast transactions." href="https://solana.com/docs/advanced/retry#how-rpc-nodes-broadcast-transactions" icon="book-open" />

This is the most typical method to send transactions to the network to get executed. It is simple but you need to make sure the transactions are:

* Send in the serialized transaction format.

* Use fresh blockhash and last valid blockheight.

* Use optimal amount of priority fees and compute unit limit.

* Free of error.

* Utilize retries.

* Configure your RPCs

  * Optional but you can send your transaction to a staked RPC endpoint also known as [Stake-Weighted Quality of Service (SWQoS)](https://solana.com/developers/guides/advanced/stake-weighted-qos).
  * Used dedicated RPC services versus free or shared, depending on how critical your usage is.
  * Propagate to multiple RPC rather than reliant on one.

#### Broadcasting Through Jito

To include Jito Tips in your Metis Swap transaction, you can do specify in the Metis Swap API parameters. However, please take note of these when sending your transaction to Jito and [you can find this information in their documentation](https://docs.jito.wtf/):

* You need to submit to a Jito RPC endpoint for it to work.
* You need to send an appropriate amount of Jito Tip to be included to be processed.

<Info>
  **MORE ABOUT JITO**

  You can leverage [Jito](https://www.jito.wtf/) to send transactions via tips for faster inclusion and better outcomes. Similar to Priority Fees, Jito Tips incentivize the inclusion of transaction bundles during block production, enhancing users' chances of securing critical transactions in competitive scenarios.

  Additionally, Jito enables bundling transactions to ensure they execute together or not at all, helping protect against front-running and other MEV risks through “revert protection” if any part of the sequence fails, all while reducing transaction latency for timely execution.

  <Card title="Read more about how Jito works and other details here." href="https://docs.jito.wtf/lowlatencytxnsend/#system-overview" icon="book-open" />
</Info>

```js theme={null}
const swapTransaction = await (
  await fetch('https://api.jup.ag/swap/v1/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-api-key',
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: wallet.publicKey,
      prioritizationFeeLamports: {
        jitoTipLamports: 1000000 // note that this is FIXED LAMPORTS not a max cap
      }
    })
  })
).json();
```


# Token Verification and Listing
Source: https://dev.jup.ag/docs/tokens/index

Understand how tokens are listed and verified on Jupiter.

The Jupiter Tokens API and verification system aims to provide a way to validate mint addresses and provide integrators a simply way to get mint information.

## About

As Solana grew and exploded with tens of thousands of newly minted tokens a day, the Jupiter Tokens API and verification system has evolved to meet the demands of token verification and provide an ecosystem-wide source of truth to rely on.

A historical breakdown of the evolutions of the Tokens API and verification system.

* [Solana Token Registry](https://github.com/solana-labs/token-list) was deprecated in 2022.
* [Ecosystem Token List V1: Github](https://github.com/jup-ag/token-list): Maintained via Github with 4.8k Pull Requests verified manually.
* [Ecosystem Token List V2: Catdet List](https://catdetlist.jup.ag): Maintained by Catdets and community with simple metrics to aid review.
* **Ecosystem Token List V3: Verify**:
  * Using a variety of trading, social metrics and [Organic Score](/docs/tokens/organic-score) to aid verification.
  * Later, improved and evolved version of V3, where you can burn 1,000 JUP to get an express review.
* [Jupiter VRFD](https://verified.jup.ag): Expanded beyond token verification to metadata, content and insights.

<Note>
  **MORE READING MATERIALS**

  * [Introducing a new token verification method](https://x.com/9yointern/status/1907425355071197347) at [https://verify.jup.ag](https://verify.jup.ag)
  * [Background and History of the Ecosystem Token List V2](https://www.jupresear.ch/t/ecosystem-master-token-list/19786)
</Note>


# Organic Score
Source: https://dev.jup.ag/docs/tokens/organic-score

Understand how Organic Score is derived and how it is used to measure the genuine activity and health of a token.

Organic Score is a metric designed to measure the genuine activity and health of a token. Unlike traditional metrics that can be easily manipulated by artificial trading or bot activity, the Organic Score focuses on real user participation and authentic market metrics. This helps users, developers, and projects better understand the context of similar tokens and find the signal within the noise.

## How Organic Score is Derived

Organic Score is derived from a set of core metrics, such as holder count, trading volume and liquidity. In order to ensure the authenticity and reliability of the score, we track the metrics participated by real user wallets (not bots, etc) in real time to derive the Organic Score.

<Note>
  **ORGANIC SCORE**

  This is a high level depiction of how Organic Score is dervied, there are other heuristics and data involved to measure and derive it.

  <Frame>
    <img alt="Organic Score" />
  </Frame>
</Note>


# Token Tag Standard
Source: https://dev.jup.ag/docs/tokens/token-tag-standard

Use the token tag standard to get your tokens tagged for better visibility on Jupiter UI or via the Tokens API.

The Tokens API is built with a tagging system such as Verified, LSTs and more. In this section, we will be going through how you can get your tokens tagged for better visibility on Jupiter UI or via the Tokens API.

## Requirements

* [An endpoint that points to a .csv file with a mint address per row](https://raw.githubusercontent.com/jup-ag/token-list/main/examples/sample_tags.csv).
* A preferred word or acronym for your tag - one that's short and mobile friendly.
* A set interval for us to poll.

The endpoint should be public, with our IP whitelisted for rate limits where necessary.

## How to get your tokens tagged

After you have completed the requirements, please reach out to us via [Discord](https://discord.gg/jup).

Once we start ingesting your list, the tokens will be tagged automatically.


# Content API (BETA)
Source: https://dev.jup.ag/docs/tokens/v2/content

Get content for multiple mints, trending tokens or paginated content feed.

<Note>
  The Content API is available on Pro tiers only, refer to [Portal & API Key](/portal/setup) section for more details.
</Note>

## About Content API

The Content API is powered by [Jupiter VRFD](https://verified.jup.ag), providing access to curated and verified content for Solana tokens, including text posts, tweets, token summaries, and news summaries. This content is carefully reviewed and approved to ensure quality and accuracy.

### API Reference

For complete API documentation including request/response schemas, parameters, and examples, refer to the [Content API Reference](/api-reference/tokens/v2/get-content).

<Tip>
  **USEFUL CONTENT INFORMATION**

  * Get approved content for tokens including text posts, tweets, and summaries
  * Retrieve content for multiple tokens in a single request (up to 50 mints)
  * Access paginated content feeds for specific tokens
  * Discover content for trending tokens on Jupiter

  Do note that the response is subject to changes as we continue to improve.

  Refer to [Content API Reference](/api-reference/tokens/v2/get-content) for full schema.
</Tip>

### How It Works

The Content API operates through a curated content system powered by [Jupiter VRFD](https://verified.jup.ag/):

1. **Content Submission**: Content is submitted by verified users through [Jupiter VRFD](https://verified.jup.ag/), Jupiter's content verification platform
2. **Review Process**: All submitted content goes through a review process to ensure quality, accuracy, and relevance
3. **Approval Status**: Only content with `status: approved` is returned by the API endpoints
4. **Content Types**: The API supports multiple content types including:
   * Text-based content (articles, descriptions, announcements)
   * Tweets sourced from Twitter/X
   * AI-generated token summaries with source citations
   * News summaries with source citations
5. **Real-time Updates**: Content is updated in real-time as new approved content becomes available

### Attribution and Credits

Content provided through the Content API is curated and verified by [Jupiter VRFD](https://verified.jup.ag/). All content includes attribution information:

* **Submitted By**: Information about the user who submitted the content
* **Source**: The original source URL or reference for the content
* **Citations**: Token and news summaries include citations to their source materials
* **Timestamps**: All content includes submission, update, and posting timestamps

When displaying content from this API, please maintain proper attribution to [Jupiter VRFD](https://verified.jup.ag/) and the original content sources as provided in the response data.

## Get Content for Multiple Mints

The Content API provides an endpoint to retrieve approved content for multiple token mints in a single request. This is useful when you need to display content for a list of tokens, such as in a token explorer or portfolio view.

<Tip>
  **MULTIPLE MINTS**

  * Query up to **50 mint addresses** in a single request.
  * Pass mints as a comma-separated list in the query parameter.
  * Returns content for each mint including text posts, tweets, token summaries, and news summaries.
  * Only returns approved content (status: `approved`).
</Tip>

```js theme={null}
const contentResponse = await (
  await fetch('https://api.jup.ag/tokens/v2/content?mints=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN,So11111111111111111111111111111111111111112', {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    }
  })
).json();
```

## Get Content Feed

The Content API provides an endpoint to retrieve a paginated feed of content for a specific token mint. This is useful for displaying a chronological feed of content related to a particular token.

<Tip>
  **PAGINATED FEED**

  * Get content for a **single mint address** at a time.
  * Supports pagination with `page` and `limit` parameters.
  * Default page is 1, default limit is 50 items per page.
  * Maximum limit is 100 items per page.
  * Returns pagination metadata including total items and total pages.
</Tip>

```js theme={null}
const feedResponse = await (
  await fetch('https://api.jup.ag/tokens/v2/content/feed?mint=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN&page=1&limit=50', {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    }
  })
).json();
```

## Get Cooking Tokens Content

The Content API provides an endpoint to retrieve content for currently trending tokens on Jupiter. This is useful for discovering and displaying content related to tokens that are gaining traction.

<Tip>
  **TRENDING TOKENS**

  * Returns content for tokens that are currently trending on Jupiter.
  * No parameters required - automatically fetches the latest trending tokens.
  * Useful for building discovery features or trending token sections.
</Tip>

```js theme={null}
const cookingResponse = await (
  await fetch('https://api.jup.ag/tokens/v2/content/cooking', {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    }
  })
).json();
```

## Get Summaries for Multiple Mints

The Content API provides an endpoint to retrieve token and news summaries for multiple token mints in a single request. This is useful when you only need summary information without the full content items.

<Tip>
  **SUMMARIES ONLY**

  * Query up to **50 mint addresses** in a single request.
  * Pass mints as a comma-separated list in the query parameter.
  * Returns only token summaries and news summaries (no content items).
  * Useful for displaying summary information in token lists or cards.
</Tip>

```js theme={null}
const summariesResponse = await (
  await fetch('https://api.jup.ag/tokens/v2/content/summaries?mints=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN,So11111111111111111111111111111111111111112', {
    headers: {
      'x-api-key': 'YOUR_API_KEY'
    }
  })
).json();
```

## Content Types

The Content API supports different content types:

| Content Type | Description                                                         |
| :----------- | :------------------------------------------------------------------ |
| `text`       | Text-based content such as articles, descriptions, or announcements |
| `tweet`      | Content sourced from Twitter/X                                      |

## What's Next

Now that you understand how to use the Content API, you can:

* Integrate content display in your token explorer or portfolio views
* Build discovery features using trending tokens content
* Create paginated content feeds for individual token pages

[Reach out to us if you have feedback or questions](https://discord.gg/jup)!


# Tokens API V2
Source: https://dev.jup.ag/docs/tokens/v2/token-information

Guide on Tokens V2 API endpoints to query for mint information in specific searches, tags or categories.

<Tip>
  **USEFUL MINT INFORMATION**

  * Token Metadata like name, symbol, icon to display token information to users
  * [Organic Score](/docs/tokens/organic-score), Holder count, Market cap, etc can be useful to help make a better trading decision
  * And much more!

  Do note that the response is subject to changes as we continue to improve.

  Refer to [Tokens API V2 Reference](/api-reference/tokens/v2) for full schema.
</Tip>

## Query by Mint

The Tokens API V2 provides an endpoint to search tokens in the background for you and returns you the search results, along with the mint information.

This is useful in most user applications, as users need to choose which tokens they want to swap. This also provides a seamless developer experience as integrating this allows us to handle and abstract the token search mechanism, allowing you to focus on other user features.

<Tip>
  **SEARCH**

  * Search for a token and its information by its **symbol, name or mint address**.
  * Comma-separate to search for multiple.
  * Limit to 100 mint addresses in query.
  * Default to 20 mints in response when searching via symbol or name.
</Tip>

```js theme={null}
const searchResponse = await (
  await fetch(`https://api.jup.ag/tokens/v2/search?query=So11111111111111111111111111111111111111112`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Query by Tag

The Tokens API V2 provides an endpoint to query by tags. This is useful to help users distinguish between verified vs non-verified or specific groups of tokens like liquid-staked tokens (LSTs).

<Tip>
  **TAGS**

  * Only `lst` or `verified` tag.
  * Note that this will return the entire array of existing mints that belongs to the tag.
</Tip>

```js theme={null}
const tagResponse = await (
  await fetch(`https://api.jup.ag/tokens/v2/tag?query=verified`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Get Category

The Tokens API V2 provides an endpoint to get mints and their mint information by categories. These categories are useful for identifying tokens in specific trading scenarios, providing users with more information to trade with.

<Tip>
  **CATEGORY**

  * Only `toporganicscore`, `toptraded` or `toptrending` category.
  * Added query by interval for more accuracy, using `5m`, `1h`, `6h`, `24h`.
  * The result filters out generic top tokens like SOL, USDC, etc (since those tokens are likely always top of the categories).
  * Default to 50 mints in response (use `limit` to increase or decrease number of results).
</Tip>

```js theme={null}
const categoryResponse = await (
  await fetch(`https://api.jup.ag/tokens/v2/toporganicscore/5m?limit=100`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Get Recent

The Tokens API V2 provides an endpoint to get mints and their mint information by their recency. This is helpful to display to users a list of tokens that just had their first pool created, providing more information to trade with.

<Tip>
  **RECENT**

  * Do note that the definition of RECENT is the **token's first pool creation time** (and not token's mint/creation timestamp).
  * Default to 30 mints in response.
</Tip>

```js theme={null}
const recentResponse = await (
  await fetch(`https://api.jup.ag/tokens/v2/recent`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Example Response

All endpoints will return an array of mints, along with their information.

**Successful example response:**

```js expandable theme={null}
[
  {
    id: 'So11111111111111111111111111111111111111112',
    name: 'Wrapped SOL',
    symbol: 'SOL',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    decimals: 9,
    circSupply: 531207433.3986673,
    totalSupply: 603724547.3627878,
    tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    firstPool: {
      id: '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
      createdAt: '2021-03-29T10:05:48Z'
    },
    holderCount: 2342610,
    audit: {
      mintAuthorityDisabled: true,
      freezeAuthorityDisabled: true,
      topHoldersPercentage: 1.2422471238911812
    },
    organicScore: 98.92390784896082,
    organicScoreLabel: 'high',
    isVerified: true,
    cexes: [
      'Binance', 'Bybit',
      'OKX',     'Upbit',
      'Bitget',  'Kraken',
      'KuCoin',  'MEXC',
      'Gate.io'
    ],
    tags: [ 'community', 'strict', 'verified' ],
    fdv: 87824499429.22047,
    mcap: 77275352037.79674,
    usdPrice: 145.47114211747515,
    priceBlockId: 349038717,
    liquidity: 89970631.83880953,
    stats5m: {
      priceChange: 0.021175445311831707,
      liquidityChange: -0.01230267453174984,
      volumeChange: 4.855149318222242,
      buyVolume: 14644327.188370818,
      sellVolume: 14743625.023908526,
      buyOrganicVolume: 269570.2345543641,
      sellOrganicVolume: 204114.37436445671,
      numBuys: 49281,
      numSells: 54483,
      numTraders: 18155,
      numOrganicBuyers: 981,
      numNetBuyers: 3503
    },
    stats1h: {
      priceChange: -0.145099593531635,
      liquidityChange: -0.13450589635262783,
      volumeChange: -15.928930753985316,
      buyVolume: 171520842.22567528,
      sellVolume: 174057197.5207193,
      buyOrganicVolume: 3099405.8562825476,
      sellOrganicVolume: 2975660.0383528043,
      numBuys: 586069,
      numSells: 649275,
      numTraders: 78145,
      numOrganicBuyers: 2716,
      numNetBuyers: 14442
    },
    stats6h: {
      priceChange: 0.3790495974473589,
      liquidityChange: 0.1659230330014905,
      volumeChange: 14.571340846647542,
      buyVolume: 1084625651.9256022,
      sellVolume: 1094488293.656417,
      buyOrganicVolume: 31145072.655369382,
      sellOrganicVolume: 31647431.25353508,
      numBuys: 3789847,
      numSells: 4363909,
      numTraders: 272131,
      numOrganicBuyers: 10849,
      numNetBuyers: 37155
    },
    stats24h: {
      priceChange: 1.5076363979360274,
      liquidityChange: 2.417364079880319,
      volumeChange: -2.1516094834673254,
      buyVolume: 4273248565.256824,
      sellVolume: 4306065610.69747,
      buyOrganicVolume: 109007133.8196669,
      sellOrganicVolume: 118085567.17983335,
      numBuys: 15125444,
      numSells: 17582713,
      numTraders: 754618,
      numOrganicBuyers: 28590,
      numNetBuyers: 80961
    },
    updatedAt: '2025-06-25T05:02:21.034234634Z'
  }
]
```


# Best Practices
Source: https://dev.jup.ag/docs/trigger/best-practices

Guidelines for trigger order minimum amounts, price validation, slippage settings, and token compatibility.

| Item                                                                                                  | Recommendation                                                                                                                                                                                                                                                                                                                                                                                |
| :---------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The program will accept any value to create an order.                                                 | On jup.ag, our frontend enforces a minimum of 5 USD per order to be created, this will ensure our keepers can accommodate for no loss in transaction fees coverage. However, programmatically, if you do not enforce this, the user can still create an order.                                                                                                                                |
| The program does not check the price or rate of the order, and the keeper will execute as instructed. | On our frontend, when user attempts to set the rate to buy above market price, we provide warnings and disable the execution if above 5%. If the order is created with such rates, the keeper will execute as instructed. For example, if user sets to Sell 1000 USDC to Buy 1 SOL at the rate of 1000 SOL/USDC, the keeper will execute as instructed and the additional funds will be lost. |
| Tokens with transfer tax extension are disabled.                                                      | Our frontend informs the user if the token has transfer tax.                                                                                                                                                                                                                                                                                                                                  |
| Token2022 tokens with transfer tax extension are disabled.                                            | Our frontend informs the user if the token has transfer tax.                                                                                                                                                                                                                                                                                                                                  |
| Trigger orders with slippage.                                                                         | By nature, trigger orders execute with 0 slippage. However, you can add slippage to the order to ensure the order is filled but at the cost of slippage.                                                                                                                                                                                                                                      |


# Cancel Order
Source: https://dev.jup.ag/docs/trigger/cancel-order

Cancel an open trigger order and reclaim unfilled tokens.

The `POST /trigger/v1/cancelOrder` endpoint cancels an open trigger order and returns any unfilled tokens to the maker. Use `/cancelOrders` to cancel multiple orders in batched transactions. You can retrieve order accounts to cancel via the `/getTriggerOrders` endpoint.

If you want to cancel order(s), you need to do these steps:

1. Get a list of the order accounts you want to cancel via `/getTriggerOrders` endpoint.
2. Use the list of order accounts to make a post request to the `/cancelOrder` endpoint to get the transaction to cancel one or multiple orders.
3. Sign then send the transaction to the network either via `/execute` endpoint or by yourself.

<Note>
  **GET TRIGGER ORDERS**

  [Refer to the `/getTriggerOrders` section](/docs/trigger/get-trigger-orders) to prepare the list of order accounts you want to cancel.
</Note>

<Info>
  **INFO**

  To cancel multiple orders, you can use the [`/cancelOrders` endpoint](#cancel-orders) to pass in a list of order accounts and it will build the transaction for multiple cancellations.
</Info>

## Cancel Order

```js theme={null}
const cancelOrderResponse = await (
    await fetch('https://api.jup.ag/trigger/v1/cancelOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            maker: "jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3",
            computeUnitPrice: "auto",
            order: "3g2jF8txqXPp6GUStwtXMrWydeYWxU4qoBA8UDLoTnK7",
        })
    })
).json();
```

## Cancel Order Response

**Success Example Response**

```json theme={null}
{
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAA......QYHAwUIX4Ht8Agx34Q=",
  "requestId": "370100dd-1a85-421b-9278-27f0961ae5f4",
}
```

**Failed Example Response**

```json theme={null}
{
  "error": "no matching orders found",
  "code": 400
}
```

## Cancel Orders

<Warning>
  **WARNING**

  If no orders are specified, the API will return the transaction to cancel **ALL** open orders, batched in groups of 5 orders.
</Warning>

<Tip>
  **TIP**

  Orders are batched in groups of 5, if you have 6 orders to cancel, you will receive 2 transactions.

  Do note that you will receive a list of transactions, so you will need to access each transaction in it to sign and send individually.

  If using `/execute` endpoint, you should pass in the same `requestId` for the different transactions.
</Tip>

```js theme={null}
const cancelOrdersResponse = await (
    await fetch('https://api.jup.ag/trigger/v1/cancelOrders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            maker: "jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3",
            computeUnitPrice: "auto",
            orders: [
                "6fe8ByaiFHisjnYnH5qdpyiNtkn89mMBQUemRkVmKhro",
                "9jwzPKHxcrSozdrTYzPnTqy7psRvNGxaYUAiiyxwZKjj"
            ]
        })
    })
).json();
```

## Cancel Orders Response

**Success Example Response**

```json theme={null}
{
  "transactions": [
    "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA......DHfhA0JAAAJBQ0ODwsNCF+B7fAIMd+EDQkAAAMCDQ4PCw0IX4Ht8Agx34Q=",
    "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA......a8lAwQABQLAqAAABAAJAy48AAAAAAAABQkAAAIBBQYHAwUIX4Ht8Agx34Q="
  ],
  "requestId": "370100dd-1a85-421b-9278-27f0961ae5f4",
}
```


# Create Order
Source: https://dev.jup.ag/docs/trigger/create-order

Create a new trigger (limit) order specifying the token pair, amounts, and target price.

The `POST /trigger/v1/createOrder` endpoint builds a transaction for a new limit order. You must provide `inputMint`, `outputMint`, `maker`, `payer`, `makingAmount`, and `takingAmount`. The endpoint returns a base64-encoded transaction that you sign and send to the network (either directly or via the `/execute` endpoint).

<Warning>
  **NEW PATHS**

  The `/limit/v2` path will be deprecated soon, please update your API calls to use the `/trigger/v1` path immediately.

  When updating to the new path, please refer to the documentation as there are some breaking changes.

  * `/execute` endpoint is introduced.
  * `/createOrder` endpoint now includes an additional `requestId` parameter to be used with the `/execute` endpoint.
  * `/cancelOrder` endpoint only builds the transaction for 1 order, while `/cancelOrders` endpoint builds the transaction for multiple orders.
  * The `tx` field in the responses are now `transaction` or `transactions`.
  * `/getTriggerOrders` endpoint is introduced to get either active or historical orders (based on the query parameters) in a new format.
</Warning>

## Create Order

This is a POST request to `/createOrder` endpoint, where you pass in the necessary parameters and our backend will create the transaction for you to sign and send to the network seamlessly.

<Tip>
  **OPTIONAL PARAMETERS**

  Do note that there are a few optional parameters that you can use, such as:

  * Adding slippage to the order: This corresponds to the "Ultra" mode on jup.ag frontend. Higher slippage increases execution success rate but may result in less favorable prices. Omitting this parameter (or setting it to 0) corresponds to "Exact" mode. [Learn more about UI modes vs API implementation](/docs/trigger#faq).
  * Setting an expiry date on the order.
  * Adding fees through our referral program, please ensure that your `feeAccount` has the necessary `referralTokenAccount`s of the output mint of the limit order for it to work, you can learn more about creating them dynamically in the [Add Fees To Swap](/docs/swap/add-fees-to-swap#for-trigger-api-integrator-fee) guide. (Note that the fees are transferred only after the trigger order has been executed.)
</Tip>

**Create a POST request to the `/createOrder` endpoint.**

```js theme={null}
const createOrderResponse = await (
    await fetch('https://api.jup.ag/trigger/v1/createOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            inputMint: inputMint.toString(),
            outputMint: outputMint.toString(),
            maker: "jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3",
            payer: "jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3",
            params: {
                makingAmount: "1000000",
                takingAmount: "300000",
                // slippageBps: "", // Optional, by nature, trigger orders execute with 0 slippage
                // expiredAt: "", // In unix seconds (e.g. Date.now()/1_000) or optional
                // feeBps: "", // Requires referral account or optional
            },
            computeUnitPrice: "auto",
            // feeAccount: "", // Optional but if specified it is the referral token account of the output mint
            // wrapAndUnwrapSol: true, // Default true or optional
        })
    })
).json();

console.log(createOrderResponse);
```

Now that you have the order transaction, you can sign and send to the network. There are 2 methods, after signing the transaction, you can either send it to the network yourself or use the Trigger API's `/execute` endpoint to do it for you.

<CardGroup>
  <Card title="Let's execute the order" href="/docs/trigger/execute-order" icon="arrow-right" />
</CardGroup>

## Create Order Response

**Success Example Response**

```json theme={null}
{
  "order": "CFG9Bmppz7eZbna96UizACJPYT3UgVgps3KkMNNo6P4k",
  "transaction": "AQAAAAAAAAAAAAAAAAAAAAAA......AgAKCAkBAQsPAAADBAEMCwcKCQkIBg0LIoVuSq9wn/WfdskdmHlfUulAQg8AAAAAAICpAwAAAAAAAAAJAwEAAAEJAA==",
  "requestId": "370100dd-1a85-421b-9278-27f0961ae5f4"
}
```

**Failed Example Response**

```json theme={null}
{
  "error": "invalid create order request",
  "cause": "input mint making amount must be at least 5 USD, received: 2",
  "code": 400
}
```


# Execute Order
Source: https://dev.jup.ag/docs/trigger/execute-order

Submit a signed trigger order transaction for on-chain execution.

After getting the order transaction, you can sign and send to the network yourself or use the Trigger API's `/execute` endpoint to do it for you.

## Sign Transaction

Using the Solana `web3.js` v1 library, you can sign the transaction as follows:

```js theme={null}
// ... GET /order's response

// Extract the transaction from the order response
const transactionBase64 = orderResponse.tx

// Deserialize the transaction
const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));

// Sign the transaction
transaction.sign([wallet]);

// Serialize the transaction to base64 format
const signedTransaction = Buffer.from(transaction.serialize()).toString('base64');
```

## Execute Order

By making a post request to the `/execute` endpoint, Jupiter executes the order transaction on behalf of you/your users. This includes handling of transaction handling, priority fees, RPC connection, etc.

```js theme={null}
const executeResponse = await (
    await fetch('https://api.jup.ag/trigger/v1/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            signedTransaction: signedTransaction,
            requestId: "370100dd-1a85-421b-9278-27f0961ae5f4",
        }),
    })
).json();
```

## Execute Order Response

After making the post request to the `/execute` endpoint, you will receive a response with the status of the order.

**Example response of successful order:**

```json theme={null}
{
  "signature": "...",
  "status": "Success"
}
```

**Example response of failed order:**

```json theme={null}
{
  "error": "custom program error code: 1",
  "code": 500,
  "signature": "...",
  "status": "Failed"
}
```

## Send Transaction Yourself

If you want to handle the transaction, you can sign and send the transaction to the network yourself.

```js expandable theme={null}
const transactionBase64 = createOrderResponse.transaction
const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));

transaction.sign([wallet]);

const transactionBinary = transaction.serialize();

const blockhashInfo = await connection.getLatestBlockhashAndContext({ commitment: "finalized" });

const signature = await connection.sendRawTransaction(transactionBinary, {
    maxRetries: 1,
    skipPreflight: true
});

const confirmation = await connection.confirmTransaction({
signature,
blockhash: blockhashInfo.value.blockhash,
lastValidBlockHeight: blockhashInfo.value.lastValidBlockHeight,
}, "finalized");

if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}\n\nhttps://solscan.io/tx/${signature}`);
} else console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
```


# Get Trigger Orders
Source: https://dev.jup.ag/docs/trigger/get-trigger-orders

Query active and historical trigger orders by wallet, status, or token pair.

This is a GET request to `/getTriggerOrders` endpoint.

The response is paginated for every 10 orders and you can view different pages using the `page` parameter. The `hasMoreData` boolean will indicate if you have more data in the next page.

<Warning>
  **CHANGE OF RESPONSE FORMAT**

  The `/getTriggerOrders` endpoint does not provide the same data format as the old `orderHistory` or `openOrders` endpoint.
</Warning>

## Active Orders

To get the active orders, you can pass in the `orderStatus` parameter as `active`.

<Tip>
  You can optionally pass in the input and output token mint addresses to filter the open orders.
</Tip>

```js theme={null}
const openOrdersResponse = await (
    await fetch(
        'https://api.jup.ag/trigger/v1/getTriggerOrders?user=jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3&orderStatus=active',
        {
            headers: {
                'x-api-key': 'your-api-key',
            },
        }
    )
).json();
```

## Order History

To get the order history, you can pass in the `orderStatus` parameter as `history`.

```js theme={null}
const orderHistoryResponse = await (
    await fetch(
        'https://api.jup.ag/trigger/v1/getTriggerOrders?user=ErJKdNoarixqGGQTHbBtvHtg2nkcCqcKtYjGbVKUxY7D&orderStatus=history',
        {
            headers: {
                'x-api-key': 'your-api-key',
            },
        }
    )
).json();
```


# Trigger (Limit Orders) API Overview
Source: https://dev.jup.ag/docs/trigger/index

Create limit orders that execute automatically when the target price is reached. Supports any token pair, custom fees, and order expiry.

The Jupiter Trigger API enables you to create limit orders on Solana, allowing users to set target prices for token swaps that execute automatically when market conditions are met.

The Trigger API is ideal for:

* DeFi applications that want to offer users more advanced trading options
* Wallets looking to expand their trading features
* Automated systems that need to execute at specific price points

## Features

| Feature                    | Description                                                                                              |
| :------------------------- | :------------------------------------------------------------------------------------------------------- |
| **Custom integrator fees** | Integrators can choose to charge their own custom fees (on top of Jupiter's fees).                       |
| **Any token pair**         | Create trigger orders between any token pairs supported on Metis Routing Engine.                         |
| **Best execution**         | Orders are executed through Metis Routing Engine to get the best possible price across all DEXes.        |
| **Price monitoring**       | Our infrastructure continuously monitors prices to execute trigger orders as soon as conditions are met. |
| **Order expiry**           | Trigger orders can be set to expire after a certain period of time.                                      |
| **Slippage addition**      | Add slippage to the target price, ideal for users who want to prioritize success rate over price.        |

## Getting Started with Trigger API

1. [**Create Order**](/docs/trigger/create-order): Create a new trigger order with your desired parameters.
2. [**Execute Order**](/docs/trigger/execute-order): Execute a trigger order.
3. [**Cancel Order**](/docs/trigger/cancel-order): Cancel an existing trigger order.
4. [**Get Trigger Orders**](/docs/trigger/get-trigger-orders): Retrieve active/historical trigger orders for a specific wallet address
5. [**Best Practices**](/docs/trigger/best-practices): Best practices for using Trigger API.

## FAQ

<AccordionGroup>
  <Accordion title="What is the fee for using Trigger API?">
    Trigger API takes 0.03% for stable pairs and 0.1% for every other pairs.
  </Accordion>

  <Accordion title="Can integrators take fees using Trigger API?">
    Yes, integrators can take fees on top of Jupiter's fees.
  </Accordion>

  <Accordion title="How do jup.ag UI modes translate to the Trigger API?">
    When using trigger orders on the jup.ag frontend, you'll see two execution modes:

    | jup.ag UI Mode | API Implementation            | Description                                                                                                                                                                                                              |
    | :------------- | :---------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | **Exact**      | `slippageBps: 0` (default)    | Orders execute with 0 slippage for precise price execution <br /> <br /> By default, trigger orders execute with 0 slippage (you can omit the `slippageBps` parameter)                                                   |
    | **Ultra**      | `slippageBps: <custom_value>` | Orders execute with custom slippage for higher success rates On the jup.ag UI, Ultra denotes that Jupiter sets the slippage for the user, however, in API implementation, you will need to evaluate and set it yourself. |
  </Accordion>
</AccordionGroup>


# Add Integrator Fees
Source: https://dev.jup.ag/docs/ultra/add-fees-to-ultra

Add custom integrator fees to Ultra Swap using the Referral Program.

<Note>
  If you are unfamiliar with [Ultra Swap Fees](/docs/ultra/fees), please refer to the doc.
</Note>

## Key Points

The Jupiter Ultra Swap API allows you to add integrator fees to the orders.

**Key points summary:** Fees require Referral Program accounts, Jupiter takes 20% of your integrator fees, Ultra decides which mint to take fees in (based on a priority list), you must create referralTokenAccount for each expected feeMint, and fees enforce routing to Iris only.

<AccordionGroup>
  <Accordion title="Requires specific Referral Program Accounts">
    The Ultra Swap Integrator Fees are governed by the [Referral Program](/tool-kits/referral-program).

    It is required to create a valid **referral account** and it's **referral token accounts** for the specific token mints to collect fees in. These accounts are initalized under the [**Jupiter Ultra Referral Project**](https://solscan.io/account/DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc).

    Refer to the rest of the guide for more details on the set up.
  </Accordion>

  <Accordion title="Fee split when adding fees">
    If you plan to take 100bps, Jupiter will take 20bps for the fee split (there will be no Ultra base fee).

    | Type                  | Fee                                     |
    | :-------------------- | :-------------------------------------- |
    | Ultra default fees    | 5 to 10 bps                             |
    | Added integrator fees | Ultra takes 20% of your integrator fees |
  </Accordion>

  <Accordion title="Ultra decides which mint to take fees in">
    In the `/order` response, you will see the `feeMint` field which is the token mint we will collect the fees in for that particular order.

    Since Jupiter will always dictate which token mint to collect the fees in, you must ensure that you have the valid referral token account created for the specific fee mint.

    <Info>
      The `feeMint` is based on a priority list, you can refer to the [Ultra Fees](/docs/ultra/fees) doc for more details.

      | inputMint | outputMint | feeMint | Reason                                         |
      | --------- | ---------- | ------- | ---------------------------------------------- |
      | SOL       | USDC       | SOL     | SOL is of highest priority                     |
      | USDC      | SOL        | SOL     | SOL is of highest priority, regardless of side |
      | MEME      | USDC       | USDC    | Stablecoin (USDC) has higher priority          |
    </Info>

    <Warning>
      If the `referralTokenAccount` for the `feeMint` is not initialized, the order will still return and can be executed without your fees. This is to ensure your user still receives a quote to proceed with the swap.

      For example, if the `feeMint` is `SOL`, but the `referralTokenAccount` for `SOL` is not initialized, the order will still return but will be executed without your fees.

      You can refer to if `feeBps` tallies with what you specified in `referralFee`, in this case, the `feeBps` will default to Jupiter Ultra's default fees.
    </Warning>
  </Accordion>

  <Accordion title="Check the feeBps field">
    You can configure `referralFee` to be between 50bps to 255bps. The `/order` response will show the total fee in `feeBps` field which should be exactly what you specified in `referralFee`.

    <Warning>
      If the `referralTokenAccount` for the `feeMint` is not initialized, the order will still return and can be executed without your fees. This is to ensure your user still receives a quote to proceed with the swap.

      For example, if the `feeMint` is `SOL`, but the `referralTokenAccount` for `SOL` is not initialized, the order will still return but will be executed without your fees.

      You can refer to if `feeBps` tallies with what you specified in `referralFee`, in this case, the `feeBps` will default to Jupiter Ultra's default fees.
    </Warning>
  </Accordion>

  <Accordion title="Token support">
    You can now take fees in SPL or Token2022 tokens. As long as you have the referral token account initialized before calling `/order`, and the `feeMint` is one of the token mints you have initialized for, your fees will apply.

    | Only initialized for this token mint | feeMint | Are your fees applied? |
    | :----------------------------------- | :------ | :--------------------- |
    | SOL                                  | SOL     | Yes                    |
    | USDC                                 | JupSOL  | No                     |
    | XYZ                                  | USDC    | No                     |
  </Accordion>

  <Accordion title="Enforces routing to Iris and other DEX aggregator routes">
    When integrator fees are being added, it defaults routing to Iris and other DEX aggregator routes.

    JupiterZ does not support integrator fees currently.
  </Accordion>
</AccordionGroup>

## Step-by-step

<Steps>
  <Step>
    Install additional dependencies or if you prefer, you can use the [Referral Dashboard](https://referral.jup.ag/), a simple interface to create referral accounts.
  </Step>

  <Step>
    Create `referralAccount`.
  </Step>

  <Step>
    Create `referralTokenAccount` for each token mint.
  </Step>

  <Step>
    Add `referralAccount` and `referralFee` to Ultra Swap `/order` endpoint.
  </Step>

  <Step>
    Sign and send the transaction via Ultra Swap `/execute` endpoint.
  </Step>

  <Step>
    Verify transaction and fees.
  </Step>
</Steps>

<Accordion title="Full Code Example">
  ```js theme={null}
  import { ReferralProvider } from "@jup-ag/referral-sdk";
  import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, sendAndConfirmRawTransaction } from "@solana/web3.js";
  import fs from 'fs';

  const connection = new Connection("https://api.mainnet-beta.solana.com");
  const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
  const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

  const provider = new ReferralProvider(connection);
  const projectPubKey = new PublicKey('DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc');

  async function initReferralAccount() {
    const transaction = await provider.initializeReferralAccountWithName({
      payerPubKey: wallet.publicKey,
      partnerPubKey: wallet.publicKey,
      projectPubKey: projectPubKey,
      name: "insert-name-here",
    });

    const referralAccount = await connection.getAccountInfo(
      transaction.referralAccountPubKey,
    );

    if (!referralAccount) {
      const signature = await sendAndConfirmTransaction(connection, transaction.tx, [wallet]);
      console.log('signature:', `https://solscan.io/tx/${signature}`);
      console.log('created referralAccountPubkey:', transaction.referralAccountPubKey.toBase58());
    } else {
      console.log(
        `referralAccount ${transaction.referralAccountPubKey.toBase58()} already exists`,
      );
    }
  }

  async function initReferralTokenAccount() {
    const mint = new PublicKey("So11111111111111111111111111111111111111112"); // the token mint you want to collect fees in

    const transaction = await provider.initializeReferralTokenAccountV2({
      payerPubKey: wallet.publicKey,
      referralAccountPubKey: new PublicKey("insert-referral-account-pubkey-here"), // you get this from the initReferralAccount function
      mint,
    });

      const referralTokenAccount = await connection.getAccountInfo(
        transaction.tokenAccount,
      );

      if (!referralTokenAccount) {
        const signature = await sendAndConfirmTransaction(connection, transaction.tx, [wallet]);
        console.log('signature:', `https://solscan.io/tx/${signature}`);
        console.log('created referralTokenAccountPubKey:', transaction.tokenAccount.toBase58());
        console.log('mint:', mint.toBase58());
      } else {
        console.log(
          `referralTokenAccount ${transaction.tokenAccount.toBase58()} for mint ${mint.toBase58()} already exists`,
        );
      }
  }

  async function claimAllTokens() {
    const transactions = await provider.claimAllV2({
      payerPubKey: wallet.publicKey,
      referralAccountPubKey: new PublicKey("insert-referral-account-pubkey-here"),
    })

    // Send each claim transaction one by one.
    for (const transaction of transactions) {
      transaction.sign([wallet]);

      const signature = await sendAndConfirmRawTransaction(connection, transaction.serialize(), [wallet]);
      console.log('signature:', `https://solscan.io/tx/${signature}`);
    }
  }

  // initReferralAccount(); // you should only run this once
  // initReferralTokenAccount();
  // claimAllTokens();
  ```
</Accordion>

### Dependencies

```bash theme={null}
npm install @jup-ag/referral-sdk
npm install @solana/web3.js@1 # Using v1 of web3.js instead of v2
```

<Accordion title="RPC Connection and Wallet Setup">
  **Set up RPC Connection**

  <Info>
    Solana provides a [default RPC endpoint](https://solana.com/docs/core/clusters). However, as your application grows, we recommend you to always use your own or provision a 3rd party provider’s RPC endpoint such as [Helius](https://helius.dev/) or [Triton](https://triton.one/).
  </Info>

  ```bash theme={null}
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  ```

  **Set up Development Wallet**

  <Info>
    You can paste in your private key for testing but this is not recommended for production.

    * Either use your private key in the project directly, you can do it via a `.env` file.
    * Or set up your private key in the [Solana CLI](https://solana.com/docs/intro/installation#create-wallet).
  </Info>

  <CodeGroup>
    ```javascript Store private key in .env theme={null}
    // In your .env file
    PRIVATE_KEY=""

    // In your index.js (or any file that needs the private key)
    import { Keypair } from '@solana/web3.js';
    import dotenv from 'dotenv';
    require('dotenv').config();

    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || '')));
    ```

    ```javascript Store private key in Solana CLI theme={null}
    import { Keypair } from '@solana/web3.js';
    import fs from 'fs';

    const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
    const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    ```
  </CodeGroup>
</Accordion>

### Create `referralAccount`

* You should only need to create the referral account once.
* After this step, you need to [create the referral token accounts for each token mint](#create-referraltokenaccount).

```js expandable theme={null}
import { ReferralProvider } from "@jup-ag/referral-sdk";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
const provider = new ReferralProvider(connection);
const projectPubKey = new PublicKey('DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc'); // Jupiter Ultra Referral Project

async function initReferralAccount() {
  const transaction = await provider.initializeReferralAccountWithName({
    payerPubKey: wallet.publicKey,
    partnerPubKey: wallet.publicKey,
    projectPubKey: projectPubKey,
    name: "insert-name-here",
  });

  const referralAccount = await connection.getAccountInfo(
    transaction.referralAccountPubKey,
  );

  if (!referralAccount) {
    const signature = await sendAndConfirmTransaction(connection, transaction.tx, [wallet]);
    console.log('signature:', `https://solscan.io/tx/${signature}`);
    console.log('created referralAccountPubkey:', transaction.referralAccountPubKey.toBase58());
  } else {
    console.log(
      `referralAccount ${transaction.referralAccountPubKey.toBase58()} already exists`,
    );
  }
}
```

### Create `referralTokenAccount`

* You need to [create the `referralAccount` first](#create-referralaccount).
* You need to create a `referralTokenAccount` for each token mint you want to collect fees in.
* We don't recommend creating a token account for **every** token mint, as it costs rent and most tokens might not be valuable, instead created token accounts for top mints to begin with (you can always add more later).

```js expandable theme={null}
import { ReferralProvider } from "@jup-ag/referral-sdk";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
const provider = new ReferralProvider(connection);

async function initReferralTokenAccount() {
  const mint = new PublicKey("So11111111111111111111111111111111111111112"); // the token mint you want to collect fees in

  const transaction = await provider.initializeReferralTokenAccountV2({
    payerPubKey: wallet.publicKey,
    referralAccountPubKey: new PublicKey("insert-referral-account-pubkey-here"),
    mint,
  });

    const referralTokenAccount = await connection.getAccountInfo(
      transaction.tokenAccount,
    );

    if (!referralTokenAccount) {
      const signature = await sendAndConfirmTransaction(connection, transaction.tx, [wallet]);
      console.log('signature:', `https://solscan.io/tx/${signature}`);
      console.log('created referralTokenAccountPubKey:', transaction.tokenAccount.toBase58());
      console.log('mint:', mint.toBase58());
    } else {
      console.log(
        `referralTokenAccount ${transaction.tokenAccount.toBase58()} for mint ${mint.toBase58()} already exists`,
      );
    }
}
```

### Usage in Ultra Swap

* After creating the necessary accounts, you can now add the `referralAccount` and `referralFee` to the Ultra Swap `/order` endpoint.
* From the order response, you should see the `feeMint` field, which is the token mint we will collect the fees in for that particular order.
* From the order response, you should see the `feeBps` field, which is the total fee in bps, which should be exactly what you specified in `referralFee`.
* Then, you can sign and send the transaction via the Ultra Swap `/execute` endpoint.

<Warning>
  If the `referralTokenAccount` for the `feeMint` is not initialized, the order will still return and can be executed without your fees. This is to ensure your user still receives a quote to proceed with the swap.

  For example, if the `feeMint` is `SOL`, but the `referralTokenAccount` for `SOL` is not initialized, the order will still return but will be executed without your fees.

  You can refer to if `feeBps` tallies with what you specified in `referralFee`, in this case, the `feeBps` will default to Jupiter Ultra's default fees.
</Warning>

```js expandable theme={null}
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import fs from 'fs';

const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));

const orderResponse = await (
  await fetch(
    'https://api.jup.ag/ultra/v1/order?' +
    'inputMint=So11111111111111111111111111111111111111112&' +
    'outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&' +
    'amount=100000000&' +
    'taker=jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3&' +
    'referralAccount=&' + // insert referral account public key here
    'referralFee=50', // insert referral fee in basis points (bps)
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();

console.log(JSON.stringify(orderResponse, null, 2));

const transactionBase64 = orderResponse.transaction // Extract the transaction from the order response
const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64')); // Deserialize the transaction
transaction.sign([wallet]); // Sign the transaction
const signedTransaction = Buffer.from(transaction.serialize()).toString('base64'); // Serialize the transaction to base64 format

const executeResponse = await (
    await fetch('https://api.jup.ag/ultra/v1/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            signedTransaction: signedTransaction,
            requestId: orderResponse.requestId,
        }),
    })
).json();

if (executeResponse.status === "Success") {
    console.log('Swap successful:', JSON.stringify(executeResponse, null, 2));
    console.log(`https://solscan.io/tx/${executeResponse.signature}`);
} else {
    console.error('Swap failed:', JSON.stringify(executeResponse, null, 2));
    console.log(`https://solscan.io/tx/${executeResponse.signature}`);
}
```

## Claim All Fees

* The `claimAllV2` method will return a list of transactions to claim all fees and are batched by 5 claims for each transaction.
* The code signs and sends the transactions one by one - you can also Jito Bundle to send multiple at once, if preferred.
* When claiming fees, the transaction will include the transfer of the fees to both your referral account and Jupiter's (20% of your integrator fees).

```js expandable theme={null}
import { ReferralProvider } from "@jup-ag/referral-sdk";
import { Connection, Keypair, PublicKey, sendAndConfirmRawTransaction } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
const provider = new ReferralProvider(connection);

async function claimAllTokens() {
  const transactions = await provider.claimAllV2({
    payerPubKey: wallet.publicKey,
    referralAccountPubKey: new PublicKey("insert-referral-account-pubkey-here"),
  })

  // Send each claim transaction one by one.
  for (const transaction of transactions) {
    transaction.sign([wallet]);

    const signature = await sendAndConfirmRawTransaction(connection, transaction.serialize(), [wallet]);
    console.log('signature:', `https://solscan.io/tx/${signature}`);
  }
}
```


# Add Integrator Payer
Source: https://dev.jup.ag/docs/ultra/add-payer

Pay network fees and rent on behalf of your users through the Ultra Swap API.

The `payer` parameter lets integrators cover all network fees and rent for their users, removing the gasless requirements (no minimum trade size, no SOL balance check). It must be used with `referralAccount` and `referralFee`, and enforces Iris-only routing. The integrator backend must co-sign the transaction before submitting to `/execute`.

<Note>
  If you are unfamiliar with [Ultra Swap's Gasless Support mechanisms](/docs/ultra/gasless), please refer to the doc.
</Note>

## Key Points

The Jupiter Ultra Swap API allows you to pay for networks fees and rent on behalf of your users. This feature further reduces onboarding friction as the integrator can now ensure gasless is enforced without requiring any additional requirements in Ultra's Gasless Support like taker has to have \< 0.01 SOL, minimum trade size or having to use the user's swap amount.

| Aspect                                | Description                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Required with referral parameters** | When the `payer` parameter is passed in, it is expected to be used with referral parameters such as `referralAccount` and `referralFee`.<br /><br />It is assumed that if the integrator is using their own gas payer for users, they will need to recoup the costs using referral fees.                                                                                             |
| **Integrator payer takes precedent**  | When the `payer` parameter is passed in, it **always** takes precedent over Ultra's Gasless Support mechanism.                                                                                                                                                                                                                                                                       |
| **No minimum trade size requirement** | It does not require a minimum trade size.                                                                                                                                                                                                                                                                                                                                            |
| **ATA rent handling**                 | **Temporary WSOL TA**: At the end of the swap, the WSOL TA will be closed and only the rent amount refunded to payer.<br /><br />**Non-WSOL TA**: The TA will not be closed, since it is highly likely used for the output amount of the swap. However, [integrator may use `closeAuthority` to control the close authority of the TA, different rules may apply](#close-authority). |
| **Enforces routing to Iris only**     | When the `payer` parameter is passed in, it will default routing to only Iris.                                                                                                                                                                                                                                                                                                       |
| **Requires backend signing**          | Integrator is required to proxy the request to their backend in order to sign the transaction (partially signed by user) before sending to `/execute`                                                                                                                                                                                                                                |

## Payer

To use the `payer` parameter, you need to pass in the following parameters:

* `payer`: The public key of the account that will be used to pay for the network fees, priority fees/tips and rents.
* `closeAuthority`: Optional. Defaults to `taker` if not used. The public key of the account that will be the close authority of the token accounts created during the swap (apart from WSOL token account). It only applies to taker's token accounts and not the `receiver`'s if any.

However, as mentioned above, to use `payer`, it is expected to be used with referral parameters such as `referralAccount` and `referralFee` because it is assumed that the integrator will need to recoup the costs using referral fees.

* `referralAccount`: The public key of the referral account that is collecting the fees.
* `referralFee`: The fee bps that will be collected from the swap.
* [Refer to Add Fees to Ultra Swap guide](/docs/ultra/add-fees-to-ultra) for more details on how to set up.

```js Get Order theme={null}
const orderResponse = await (
    await fetch(
        'https://api.jup.ag/ultra/v1/order' +
        '?inputMint=So11111111111111111111111111111111111111112' +
        '&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' +
        '&amount=100000000' +
        '&taker=<pass-in-taker-account>' +
        '&referralAccount=<pass-in-referral-account>' +
        '&referralFee=100' +
        '&payer=jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3' +
        '&closeAuthority=<pass-in-taker-account>', // dependent on how you want to handle taker's ATA
        {
            headers: {
                'x-api-key': 'your-api-key',
            },
        }
    )
  ).json();
```

## Close Authority

When using `payer` parameter, you may optionally use `closeAuthority` parameter, but only use when necessary/intentional and is typically set to `payer` to gain the close authority.

When token accounts are created for the output swap amount, the rent of the token accounts are essentially being given away, in order to prevent a loss or abuse of the integrator gas payer, there are a few ways to handle it.

1. You can charge sufficient fees to ensure that it can cover the amount used by the payer.
2. You can set yourself as the close authority of the token account such that you have the authority to close the account and be the recipient of the rent.

<Warning>
  If the taker's token account never reaches zero amount, it means that you are unable to close the token account, causing your SOL to be "stuck".
</Warning>

**Usage of `closeAuthority` parameter**:

* If `closeAuthority` is not provided, we will default to `taker`.
* If `closeAuthority` is provided and is different from `taker`, we will add the instruction to set the new `closeAuthority`.

Refer to [Solana Docs](https://solana.com/docs/tokens/basics/create-token-account) for more details on the close authority.


# Execute Order
Source: https://dev.jup.ag/docs/ultra/execute-order

Submit a signed Ultra Swap transaction for execution and receive the swap result.

After signing the transaction from `/order`, submit it to `POST /ultra/v1/execute` with the `signedTransaction` and `requestId`. Jupiter broadcasts the transaction via its proprietary engine and returns the swap status.

## Sign Transaction

Using the Solana `web3.js@1` library, you can sign the transaction as follows:

For wallet setup details, see [Environment Setup](/get-started/environment-setup).

<Accordion title="Set up dependencies and wallet for signing">
  **Set up dependencies for signing**

  ```bash theme={null}
  npm install @solana/web3.js@1
  ```

  **Set up Development Wallet**

  <Info>
    You can paste in your private key for testing but this is not recommended for production.

    * Either use your private key in the project directly, you can do it via a `.env` file.
    * Or set up your private key in the [Solana CLI](https://solana.com/docs/intro/installation#create-wallet).
  </Info>

  <CodeGroup>
    ```javascript Store private key in .env theme={null}
    // In your .env file
    PRIVATE_KEY=""

    // In your index.js (or any file that needs the private key)
    import { Keypair } from '@solana/web3.js';
    import dotenv from 'dotenv';
    require('dotenv').config();

    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || '')));
    ```

    ```javascript Store private key in Solana CLI theme={null}
    import { Keypair } from '@solana/web3.js';
    import fs from 'fs';

    const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
    const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    ```
  </CodeGroup>
</Accordion>

Deserialize, sign, and re-serialize the transaction:

```js Sign Transaction theme={null}
import { VersionedTransaction } from '@solana/web3.js';

// ... Get Order's response

// Extract the transaction from the order response
const transactionBase64 = orderResponse.transaction

// Deserialize, sign and serialize the transaction
const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
transaction.sign([wallet]);
const signedTransaction = Buffer.from(transaction.serialize()).toString('base64');
```

## Execute Order

By making a post request to the `/execute` endpoint, Jupiter executes the swap transaction on behalf of you/your users through our own proprietary transaction sending infrastructure. This already includes handling of slippage, priority fees, transaction landing and more.

To make a post request to execute a swap order, you need to pass in the required parameters,:

* `signedTransaction`: The signed and serialized base64 encodedtransaction [like above](#sign-transaction)
* `requestId`: The order response's request ID [from Get Order](/docs/ultra/get-order)

Submit the signed transaction to the execute endpoint:

```js Execute Order theme={null}
const executeResponse = await (
    await fetch('https://api.jup.ag/ultra/v1/execute', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'your-api-key',
        },
        body: JSON.stringify({
            signedTransaction: signedTransaction,
            requestId: orderResponse.requestId,
        }),
    })
).json();
```

## Transaction Status Polling

After our transaction sending service has submitted your swap, we will actively poll for your transaction status as part of the `/execute` endpoint. You will receive a response with the status of the swap.

<Tip>
  * You can submit with the same `signedTransaction` and `requestId` for **up to 2 minutes regardless of state**, to poll for the transaction status.
  * The transaction will not double execute since it has the same signature.
  * If connection got dropped, you can try again with the same `signedTransaction` and `requestId` to poll for the status of the swap.
  * If there is no status, the order likely expired (did not get processed onchain and failed), but reach out to us if cases like this happen.
</Tip>

Check the execute response status:

```js Transaction Status Polling theme={null}
if (executeResponse.status === "Success") {
    console.log('Swap successful:', JSON.stringify(executeResponse, null, 2));
    console.log(`https://solscan.io/tx/${executeResponse.signature}`);
} else {
    console.error('Swap failed:', JSON.stringify(executeResponse, null, 2));
    console.log(`https://solscan.io/tx/${executeResponse.signature}`);
}
```


# Fees
Source: https://dev.jup.ag/docs/ultra/fees

Fee structure for Ultra Swap transactions and how integrator fees work.

The Jupiter Ultra Swap has 8-10x lower fees than market average, with only 5 to 10 bps of the swap amount as a fee.

## Key Points

| Aspect              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| **Default fees**    | 5 to 10 bps of the swap amount                                             |
| **Integrator fees** | Ultra takes 20% of your integrator fees                                    |
| **Token support**   | SPL and Token2022 tokens                                                   |
| **Fee mint**        | Fee mint is determined by Ultra based on a [priority list](#priority-list) |

### Fees Overview

| Token Type                                                       | Fee (bps) |
| ---------------------------------------------------------------- | --------- |
| Buying Jupiter-related tokens:<br />SOL/Stable -> JUP/JLP/jupSOL | 0         |
| Pegged Assets (LST-LST, Stable-Stable)                           | 0         |
| SOL-Stable                                                       | 2         |
| LST-Stable                                                       | 5         |
| Everything else                                                  | 10        |
| New Tokens (within 24 hours token age)                           | 50        |

### Priority List

When requesting for an order, Ultra will decide which mint to take fees in based on a priority list. The list consists of different categories of tokens.

1. SOL - Solana!
2. Stablecoins - USDC, USDT, etc
3. Liquid Staked Tokens (LSTs) - JupSOL, etc
4. Bluechips - Typically large market cap tokens
5. Others - Other tokens that do not fall into the above categories

<Note>
  You can use the `/order` endpoint to check for the `feeMint` and `feeBps` field directly.

  Or you can use the `/fees` endpoint to check the fees and category given the input and output mint.

  ```bash theme={null}
  curl -X GET 'https://api.jup.ag/ultra/v1/fees?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112' \
    -H 'x-api-key: your-api-key'
  ```
</Note>

### Integrator Fees

To add integrator fees to Ultra Swaps, you will be required to set up referral accounts and token accounts for the specific token mints you want to collect fees in.

Refer to the [Add Integrator Fees](/docs/ultra/add-fees-to-ultra) guide for more details on how to set up.


# Gasless Support
Source: https://dev.jup.ag/docs/ultra/gasless

Gasless swap mechanisms that let users trade without holding SOL for transaction fees.

The Jupiter Ultra Swap includes **2 different gasless mechanisms** that allow users to
execute swaps without having to pay for network fees, priority fees/tips or rent in SOL. This
feature reduces onboarding friction and supports a smoother user experience where end-users
don't need to hold SOL just to trade tokens.

## Quick Overview

| Gasless Mechanism              | Coverage                                                                               | Requirements & Notes                                                                                                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ultra<br />Gasless Support** | - Base network fee<br />- Priority fee/tips<br />- ATA rent<br />- Other accounts rent | - Taker has less than 0.01 SOL<br />- Minimum trade size of \~10 USD<br />- Gas is taken from swap amount which increases swap fee<br />- Does not work with referral/payer params<br />- Does not work with manual mode params |
| **JupiterZ<br />(RFQ)**        | - Base network fee<br />- Priority fee/tips                                            | - Always gasless for network/prio fees (paid by MM)<br />- ATA rent NOT covered: user must have enough SOL<br />- No minimum trade size<br />- Only applies if a market maker provides a route                                  |
| **Other Routers**              | -                                                                                      | -                                                                                                                                                                                                                               |

## Types of Gas

1. Base network transaction fee
2. Associated Token Account (ATA) rent
3. Priority fee (or tips, etc)
4. Other accounts rent (some DEX may require additional accounts opened per taker (e.g. Pumpfun))

## Types of Gasless Mechanism

<Note>
  Refer to [Payer](/docs/ultra/add-payer) section for more details and usage on the Integrator Gas Payer.
</Note>

<Tabs>
  <Tab title="Jupiter Ultra Gasless Support">
    1. **When does it apply?**
       * Gasless Support only kicks in for Iris router.
       * Requires taker to have less than 0.01 SOL.
       * Minimum trade size of 10 USD is required, but this is dynamic as priority fees/tips can vary based on the current market conditions.

    2. **What does it cover?**
       * Base network transaction fee
       * Priority fee/tips
       * Associated token account rent
       * Other accounts rent

    3. **How does it work?**
       * It calculates the required SOL amount to cover the cost of gasless support, and increases the swap fee to cover the cost, this means the taker will recieve lesser output tokens. You can use the `feeBps` field to identify the increased fee.
       * It adds a secondary signer to the transaction to pay to be the gas payer which is Jupiter Ultra's self gas payer.

    4. **What are the limitations?**

       * It only works for default Ultra transactions
       * It does not work when passing in integrator parameters like `referralAccount`, `referralFee`, `payer`, etc.
       * It does not work when passing in manual mode parameters like `slippageBps`, `priorityFeeLamports`, `excludeRouters`, etc.

       <img alt="Gasless Support Mechanism" />
  </Tab>

  <Tab title="Jupiter Z (RFQ) Gasless">
    1. **When does it apply?**
       * JupiterZ is our RFQ engine, it is gasless by default.
       * No minimum trade size required but dependent on if MM provides a quote.

    2. **What does it cover?**
       * Base network transaction fee
       * Priority fee (or tips, etc)
       * **Does not cover for associated token account rent**.
       * It also means the taker will have to pay for the rent themselves, and if they do not have sufficient SOL for rent, JupiterZ will not be routed.

    3. **How does it work?**
       * As long as the JupiterZ (or the market makers) provide a quote for your request, the transaction will be gasless.
       * It adds a secondary signer to the transaction to pay to be the gas payer - which is the market maker.

    4. **What are the limitations?**

       * It only works for default Ultra transactions
       * It does not work when passing in integrator parameters like `referralAccount`, `referralFee`, `payer`, etc.
       * It does not work when passing in manual mode parameters like `slippageBps`, `priorityFeeLamports`, `excludeRouters`, etc.
       * If taker does not have sufficient SOL for rent, JupiterZ will not be routed.

       <img alt="JupiterZ Gasless Mechanism" />
  </Tab>

  <Tab title="Integrator Gas Payer">
    1. **When does it apply?**
       * Integrator Gas Payer works only when integrator passes in `referralAccount` and `referralFee`, together with `payer` and `closeAuthority`.
       * Regardless of how much SOL the taker has, the payer will be the fee payer.
       * Applying these parameters will default routing to only Iris.

    2. **What does it cover?**
       * The `payer` address will be the fee payer of the entire transaction:
         * Base network transaction fee
         * Priority fee/tips
         * Associated token account rent
         * Other account rents

    3. **How does it work?**
       * The transaction returned will require both taker and payer signature before submitting to `/execute`.
       * The associated token account rent such as:
         * Temporary WSOL ATA will be covered by payer and will be returned to payer in the same transaction.
         * Any other ATAs will be covered by payer, but not returned to payer in the same transaction, since it is likely the ATA holds the tokens post-swap.
       * The `closeAuthority` address will be decided by you, refer to [Payer](/docs/ultra/add-payer) for more details.
       * It adds a secondary signer to the transaction to pay to be the gas payer - which is the integrator.

    4. **What are the limitations?**

       * Passing in `payer` parameters will default routing to only Iris.

       <img alt="Integrator Gas Payer Mechanism" />
  </Tab>
</Tabs>

## Scenario Matrix

| **Scenario**                         | **Ultra<br />Gasless Support**                                                               | **JupiterZ<br />(Assuming if quoted)** |
| ------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Taker has SOL & ATA**              | Taker pays gas                                                                               | MM pays gas                            |
| **Taker has SOL, no ATA**            | Taker pays gas & ATA rent                                                                    | MM pays gas, taker pays ATA rent       |
| **No SOL, has ATA**                  | - Gas taken from swap amount<br />- Min \$10 swap                                            | MM pays gas                            |
| **No SOL, no ATA**                   | - Gas & rent from swap amount<br />- Min \$10 swap                                           | Not supported (no ATA funding)         |
| **No SOL, has ATA,<br />Small swap** | Quote shown, but cannot swap<br />[`errorCode=3`](/docs/ultra/response#order-response-codes) | MM pays gas                            |
| **No SOL, no ATA,<br />Small swap**  | Quote shown, but cannot swap<br />[`errorCode=3`](/docs/ultra/response#order-response-codes) | Not supported (no ATA funding)         |


# Get Holdings
Source: https://dev.jup.ag/docs/ultra/get-holdings

Retrieve detailed token holdings and balances for a wallet address.

The `/ultra/v1/holdings/{address}` endpoint returns all token holdings for a wallet, including token account details (amount, frozen status, ATA flag, decimals). The top-level response contains the native SOL balance. For SOL-only queries, use `/holdings/{address}/native`.

Fetch token holdings for a wallet:

```js theme={null}
const holdingsResponse = await (
  await fetch(`https://api.jup.ag/ultra/v1/holdings/3X2LFoTQecbpqCR7G5tL1kczqBKurjKPHhKSZrJ4wgWc`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();

console.log(JSON.stringify(holdingsResponse, null, 2));
```

## Holdings Response

The holdings response will return the following:

* A list of token holdings for the user's wallet address.
* Token account information for each token holding.
* Note that the top level response outside of `tokens` is the native SOL balance.

:::tip
For tokens with more than thousands of token holdings, the response may be slow - depending on the number of token holdings, the response time may vary.

If you only need the native SOL balance, you can use `/holdings/{address}/native` to get the native SOL balance.
:::

**Successful example response:**

```json theme={null}
{
    "amount": "1000000000",
    "uiAmount": 1,
    "uiAmountString": "1",
    "tokens": {
        "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v": [
            {
                "account": "tokenaccountaddress",
                "amount": "1000000000",
                "uiAmount": 1,
                "uiAmountString": "1",
                "isFrozen": false,
                "isAssociatedTokenAccount": true,
                "decimals": 9,
                "programId": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
            }
        ]
    }
}
```

**Failed example response:**

```json theme={null}
{
  "error": "Invalid address"
}
```


# Get Order
Source: https://dev.jup.ag/docs/ultra/get-order

Request a swap quote and unsigned transaction from the Ultra Swap API.

To get an Ultra Swap order, you need to pass in the required parameters such as:

| Parameter         | Description                                                                                                                             |
| :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------- |
| `inputMint`       | The input token mint address                                                                                                            |
| `outputMint`      | The output token mint address                                                                                                           |
| `amount`          | The amount of input token to swap, in native token units (before decimals)                                                              |
| `taker`           | The user's wallet address (**Note:** If the `taker` is not provided, there will still be an Order Response with no `transaction` field) |
| `referralAccount` | The referral account address - refer to the [Add Fees To Ultra Swap](/docs/ultra/add-fees-to-ultra) guide for the step by step process  |
| `referralFee`     | The referral fee in basis points (bps)                                                                                                  |

Fetch a swap order for 1 SOL to USDC:

```js Get Order theme={null}
const orderResponse = await (
  await fetch(
    'https://api.jup.ag/ultra/v1/order' +
    '?inputMint=So11111111111111111111111111111111111111112' +
    '&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' +
    '&amount=100000000' +
    '&taker=jdocuPgEAjMfihABsPgKEvYtsmMzjUHeq9LX4Hvs7f3',
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Order Response

In the order response, you will receive a number of fields that are important to note of, such as the `swapType`, `slippageBps`, etc.

<Note>
  Refer to [Response](/docs/ultra/response) section for example responses.
  Refer to [API Reference](/api-reference/ultra) section for the full response fields.
</Note>

The main fields you should need:

* `transaction`: The base64 encoded transaction that you need to sign before submitting to the network.
* `requestId`: The request ID of the order to be used in the `Execute Order` endpoint.

Now, you are able to get a swap order, next steps is to make a post request to the `Execute Order` endpoint. [Let's go](/docs/ultra/execute-order)!


# Get Shield
Source: https://dev.jup.ag/docs/ultra/get-shield

Check token security warnings including freeze authority, mint authority, and organic activity signals.

The `/ultra/v1/shield` endpoint returns security warnings for one or more token mint addresses. Warnings include freeze authority, mint authority, unverified status, low organic activity, and new listing alerts. Use this to inform users before they trade.

This is useful when integrating with Jupiter Ultra Swap or any other APIs, allowing you or your user to be informed of any potential malicious mints before conducting your transaction.

Check shield warnings for multiple mints:

```js theme={null}
const shieldResponse = await (
  await fetch(`https://api.jup.ag/ultra/v1/shield?mints=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v,someTokenAddressForEducationalPurposes`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Shield Response

The shield response will return a list of objects, containing the token information and warnings of the mints passed in.

Do note that this is subject to changes, and we will be adding more warnings and improving the accuracy of the warnings over time.

For the full list of potential warnings, refer to the [Shield API Reference](/api-reference/ultra/shield).

**Successful example response:**

```json expandable theme={null}
{
  "warnings": {
    "someTokenAddressForEducationalPurposes": [
      {
        "type": "NOT_VERIFIED",
        "message": "This token is not verified, make sure the mint address is correct before trading",
        "severity": "info"
      },
      {
        "type": "LOW_ORGANIC_ACTIVITY",
        "message": "This token has low organic activity",
        "severity": "info"
      },
      {
        "type": "NEW_LISTING",
        "message": "This token is newly listed",
        "severity": "info"
      }
    ],
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": [
      {
        "type": "HAS_FREEZE_AUTHORITY",
        "message": "The authority's owner has the ability to freeze your token account, preventing you from further trading",
        "severity": "warning"
      },
      {
        "type": "HAS_MINT_AUTHORITY",
        "message": "The authority's owner has the ability to mint more tokens",
        "severity": "info"
      }
    ],
    "So11111111111111111111111111111111111111112": []
  }
}
```


# Ultra Swap API Quick Start
Source: https://dev.jup.ag/docs/ultra/get-started

Quick start guide to the Ultra Swap API: get an order, sign it, and execute.

Ultra Swap uses a two-step flow: first call `GET /ultra/v1/order` to receive a base64-encoded unsigned transaction, then sign it and submit via `POST /ultra/v1/execute`. This page lists all Ultra endpoints and guides.

## Overview

| Step | Endpoint                                       | Description                                                                                                        |
| :--- | :--------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| 1    | [**Get Order**](/docs/ultra/get-order)         | Request for a quote and swap transaction.                                                                          |
| 2    | [**Execute Order**](/docs/ultra/execute-order) | Sign and execute the swap transaction.                                                                             |
| -    | [**Search Token**](/docs/ultra/search-token)   | Search for a token by its symbol, name or mint address.                                                            |
| -    | [**Get Holdings**](/docs/ultra/get-holdings)   | Request for token balances of an account.                                                                          |
| -    | [**Get Shield**](/docs/ultra/get-shield)       | Enhanced security feature to provide critical token information contributing to better informed trading decisions. |
| -    | [**API Reference**](/api-reference/ultra)      | Reference for the Ultra Swap API endpoints.                                                                        |

## Guides

| Guide                                                       | Description                                                                     |
| :---------------------------------------------------------- | :------------------------------------------------------------------------------ |
| [**Gasless Support**](/docs/ultra/gasless)                  | Important notes of gasless mechanisms.                                          |
| [**Fees**](/docs/ultra/fees)                                | Breakdown of fees involved.                                                     |
| [**Manual Mode**](/docs/ultra/manual-mode)                  | Control Ultra Swap API parameters like slippage or priority fee settings.       |
| [**Add Fees to Ultra Swap**](/docs/ultra/add-fees-to-ultra) | Add custom integrator fees to your Ultra Swap transaction.                      |
| [**Add Integrator Payer**](/docs/ultra/add-payer)           | Add integrator payer to pay for networks fees and rent on behalf of your users. |
| [**Plugin Integration**](/docs/ultra/plugin-integration)    | Walkthrough on how to integrate Ultra Swap API with Jupiter Plugin.             |

## FAQ

**Frequently asked questions:** Integrator fees are 5–10 bps (you keep 80%), Ultra transactions cannot be modified, and rate limits scale dynamically with swap volume.

<AccordionGroup>
  <Accordion title="Can I add custom integrator fees to Ultra Swap API?">
    * **Integrator without custom fees**: Do note that when your users swap using Ultra Swap, we take 5 to 10 bps of the swap amount as a fee.
    * **Integrator with custom fees**: If you are an integrator, you can add custom integrator fees via Ultra Swap API and Jupiter will take 20% of the integrator fees. Please refer to the [Add Fees To Ultra Swap](/docs/ultra/add-fees-to-ultra) guide for more information.
  </Accordion>

  <Accordion title="Can I modify Ultra Swap transactions?">
    * No, you cannot modify Ultra Swap transactions.
    * Ultra Swap is intended to use as is, without any modifications.
  </Accordion>

  <Accordion title="What is the rate limit for Ultra Swap API?">
    * Dynamic Rate Limits are now applied to Ultra Swap API.

      * No Pro plans or payment needed.
      * Simply generate the universal API Key via [Portal](https://portal.jup.ag)
      * Rate limits scale together with your swap volume.
      * [Read more about Ultra Swap API Dynamic Rate Limit](/portal/rate-limit).
  </Accordion>
</AccordionGroup>


# Ultra Swap API Overview
Source: https://dev.jup.ag/docs/ultra/index

Jupiter's flagship swap API: RPC-less, gasless, with automatic slippage optimization and sub-second transaction landing. Start here for most swap integrations.

Ultra Swap is the most advanced yet developer-friendly solution for building trading applications on Solana. Ultra Swap is designed to be the only solution you'll ever need for creating exceptional trading experiences.

## Quick Launch

**Quick launch options:** [Ultra Swap API guide](/docs/ultra/get-started) | [Plugin (drop-in UI)](/tool-kits/plugin)

<CardGroup>
  <Card title="Ultra Swap API" icon="code" href="/docs/ultra/get-started">
    RPC-less architecture and Jupiter handles all trading optimizations for you.
  </Card>

  <Card title="Plugin" icon="puzzle-piece" href="/tool-kits/plugin">
    Easiest way to integrate full end-to-end Ultra Swap interface.
  </Card>
</CardGroup>

## Features

<Callout icon="book-open">[Read our latest blog on Ultra V3](/blog/ultra-v3).</Callout>

Key features at a glance: Juno liquidity engine (multi-source aggregation with self-learning), best executed price (predictive execution + slippage-aware routing), sub-second transaction landing via Jupiter Beam, Real-Time Slippage Estimator (RTSE), automatic gasless support, and sub-2s API latency.

<AccordionGroup>
  <Accordion title="Juno Liquidity Engine">
    Ultra Swap utilizes the latest [Juno Liquidity Engine](/docs/routing) which aggregates across multiple liquidity sources, including Jupiter's proprietary routing engines: improved versions of Iris and JupiterZ, and third-party liquidity sources, for the best possible price.

    It also includes self-learning capabilities (to detect and sideline low-quality liquidity sources) which creates a competitive environment for all liquidity sources to continously optimize their performance and price.
  </Accordion>

  <Accordion title="Best Executed Price">
    Ultra Swap guarantees the best executed price through several key innovations:

    * **Predictive Execution**: Ultra simulates and compares executed prices (not just quoted prices) before actually sending a transaction, dynamically selecting the route with the least slippage for real user outcomes.
    * **Ultra Signaling**: Ultra provides signaling to Proprietary AMMs to help them distinguish Ultra user flow, incentivizing them to quote tighter spreads and better prices.
    * **Slippage-Aware Routing**: Automatically prioritizes and selects routes that minimize realized slippage, protecting users from misleading "best quotes" that deliver poor executed results.

    For detailed examples and results, see [our Ultra V3 blog post](/blog/ultra-v3#maximising-executed-price).
  </Accordion>

  <Accordion title="Sub-second Transaction Landing & MEV Protection">
    Ultra is now using our new in-house transaction-landing engine, Jupiter Beam, which allows us to send transactions via our own infrastructure: designed to make every trade faster, more private, and more precise.

    * Leverage our own validator stake and dedicated R\&D efforts.
    * Complete transaction privacy until on-chain execution.
    * Eliminate the risk of artificial delays and front-running, ensuring faster and more secure execution for our users.

    Results:

    * Landing Latency: Improved by 50-66% compared to our previous approach that relied on multiple providers
      * Lands in 0–1 block (\~50–400ms)
      * Compared to the 1–3 blocks (\~400ms–1.2s) previously.
    * MEV Protection: Routing transactions through our own infrastructure provides:
      * Complete transaction privacy until on-chain execution.
      * Reduce frontrunning exposure - transactions are invisible to public mempool scanners.
      * Reduce risk of sandwich attack vectors - [see our blog post on Ultra's swap volume to value extracted ratio](/blog/ultra-v3#mev-protection).
  </Accordion>

  <Accordion title="Real Time Slippage Estimator">
    Building on top of our previous versions of slippage estimation/optimization engines, we have developed a new Real Time Slippage Estimator (RTSE), that is able to intelligently estimate the best possible slippage to use at the time of execution, balancing between trade success and price protection.

    RTSE uses a variety of heuristics, algorithms and monitoring to ensure the best user experience:

    * Heuristics: Token categories, historical and real-time slippage data, and more.
      * Uses token categories to intelligently estimate slippage for different token types.
      * Automatic prioritization of slippage-protected routes over purely price-optimized routes.
      * Increased volatility sensitivity for tokens with high historical volatility patterns.
    * Algorithms: Exponential Moving Average (EMA) on slippage data, and more.
    * Monitoring: Real-time monitoring of failure rates to ensure reactiveness to increase slippage when necessary.
  </Accordion>

  <Accordion title="Gasless">
    Ultra Swap provides different gasless mechanisms for different scenarios.

    * Gasless via Jupiter Z (RFQ): All swaps routed via Jupiter Z are gasless, as the market maker is the fee payer for the transaction.
    * Gasless via Gasless Support: Depending on the tokens and trade sizes of your swap, Ultra Swap will automatically determine if it can provide gasless support to your swap by helping you pay for the transaction fee of your swap - you can identify this via the secondary signer in the transaction.
  </Accordion>

  <Accordion title="API Latency">
    95% of all swaps are executed under 2 seconds via our proprietary transaction sending engine.

    | Endpoint    | Description                                                                                           | Latency (P50 Average)                    |
    | :---------- | :---------------------------------------------------------------------------------------------------- | :--------------------------------------- |
    | `/order`    | Aggregating across multiple liquidity sources and selecting the best price.                           | 300ms                                    |
    | `/execute`  | Broadcasting the transaction to the network and polling for the status and result of the transaction. | Roundtrip<br />Iris: 700ms; JupiterZ: 2s |
    | `/holdings` | Retrieving the user's balances.                                                                       | 70ms                                     |
    | `/shield`   | Enhanced token security feature to provide critical token information.                                | 150ms                                    |
    | `/search`   | Searching for a token by its symbol, name or mint address.                                            | 15ms                                     |
  </Accordion>
</AccordionGroup>

The following table summarizes Ultra's core capabilities:

| Feature                     | Description                                                                                                                                                                                              |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Best Trading Experience** | Ultra Swap is the best trading experience in crypto, it handles all the complexities and headaches such as slippage protection, transaction landing and more.                                            |
| **RPC-less**                | You do not need to maintain your own RPC for blockchain actions such as send transactions, get token information, or get user balances - we handle everything for you.                                   |
| **API Coverage**            | Ultra Swap covers all the necessary features for you to build your application, including the features mentioned below and useful information such as user wallet balances, token information, and more. |
| **Integrator Fee**          | Ultra Swap allows you to add custom integrator fees to your transactions, on top of Jupiter's fees. Refer to the [Add Fees To Ultra Swap](/docs/ultra/add-fees-to-ultra) guide for more information.     |
| **Developer Support**       | Get help from our [developer support in Discord](https://discord.gg/jup).                                                                                                                                |
| **World Class Support**     | If you ever face any issues or need help when using Ultra Swap, our support team is here to assist you 24/7. Read more about [Ultra Swap Customer Support](/resources/support#customer-support).         |

Use Ultra if you want managed execution without infrastructure overhead. Use Metis if you need CPI, custom instructions, or full transaction control.

## Ultra vs Metis Matrix

| Question                             | Ultra             | Metis                         |
| ------------------------------------ | ----------------- | ----------------------------- |
| Can I use this for standard swap UX? | ✅ Yes—recommended | ✅ Yes—requires infrastructure |
| Can I use this for CPI?              | ❌ No              | ✅ Yes                         |
| Can I add custom instructions?       | ❌ No              | ✅ Yes                         |
| Do I need my own RPC?                | ❌ No              | ✅ Yes—required                |
| Is gasless supported?                | ✅ Yes—automatic   | ⚠️ Build yourself             |
| Who handles user support?            | Jupiter           | You                           |
| Do I get automatic optimizations?    | ✅ Yes—continuous  | ❌ No—build yourself           |
| What's the integration timeline?     | Hours             | Months                        |
| Infrastructure maintenance?          | ❌ None—managed    | ✅ Full—self-managed           |

**Choose Ultra API if you:**

* Want to focus on product differentiation rather than infrastructure
* Value battle-tested execution quality out of the box
* Need gasless swaps without building infrastructure
* Prefer operational/technical and customer support
* Want to iterate quickly on user experience
* Don't need CPI or custom transaction composition

**Choose Metis API if you:**

* Need CPI (Cross Program Invocation) capabilities
* Require custom instructions in transactions
* Want full control over fee monetization
* Have existing RPC/execution infrastructure to leverage
* Are building execution infrastructure as competitive advantage
* Need transaction-level flexibility an opinionated engine can't provide

***

The following table provides a comprehensive comparison between Ultra Swap API and Metis Swap API to help you choose the right solution for your needs:

| Category          | Aspect                           | Ultra API                                                                                                                                                           | Metis API                                                                                                                                                       |
| ----------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Architecture**  | **Design Philosophy**            | End-to-end execution engine with integrated components                                                                                                              | Routing primitive requiring custom execution infrastructure                                                                                                     |
|                   | **Configuration Philosophy**     | Optimized defaults refined by millions of swaps                                                                                                                     | Complete flexibility to build your own strategies                                                                                                               |
|                   | **Primary Use Case**             | Teams wanting immediate, optimized swap execution                                                                                                                   | Teams needing CPI, custom instructions, or infrastructure control                                                                                               |
|                   | **Complexity**                   | Opinionated, streamlined integration                                                                                                                                | Flexible, requires extensive custom development                                                                                                                 |
| **Routing**       | **Routing Engine**               | Meta-aggregator combining:<br />• Iris (enhanced Metis with self-learning)<br />• DFlow<br />• OKX<br />• JupiterZ (RFQ with 20+ market makers)                     | Single, proven routing engine for on-chain liquidity                                                                                                            |
|                   | **RFQ Access**                   | Built-in JupiterZ RFQ with 20+ market makers                                                                                                                        | Not supported                                                                                                                                                   |
|                   | **Liquidity Sources**            | Aggregates across multiple DEXes, PropAMMs, RFQ's MMs                                                                                                               | Direct access to Solana's on-chain liquidity                                                                                                                    |
|                   | **Iris Features**                | • Ultra Signaling for tighter PropAMM quotes<br />• Predictive Execution<br />• Just-In-Time Market Revival<br />• Self-learning route optimization<br />• And more | Not applicable                                                                                                                                                  |
|                   | **Continuous Improvement**       | Automatic improvements deployed from millions of swaps                                                                                                              | Stable routing engine, you build improvements                                                                                                                   |
| **Execution**     | **Transaction Flow**             | Get order → Sign → Submit to execute endpoint                                                                                                                       | Get quote → Build transaction → Send via your infrastructure                                                                                                    |
|                   | **Transaction Sending**          | Jupiter Beam proprietary engine with network of transaction senders                                                                                                 | You build and maintain your own RPC pipeline                                                                                                                    |
|                   | **Landing Performance**          | 50-400ms average via Jupiter Beam                                                                                                                                   | Varies based on your priority fee optimization                                                                                                                  |
|                   | **Transaction Polling**          | Built-in status polling with intelligent error handling                                                                                                             | You implement polling logic and parse on-chain errors                                                                                                           |
|                   | **End-to-End Execution Latency** | P95 \< 1000ms (400-600ms average), includes polling                                                                                                                 | Entirely dependent on your infrastructure quality                                                                                                               |
|                   | **Quote Latency**                | P95 \< 900ms (100-200ms average)<br />*Higher due to simulations and optimizations*                                                                                 | P95 \< 500ms (100-200ms average)<br />*Raw routing data*                                                                                                        |
|                   | **RPC Requirements**             | None—Jupiter provisions all infrastructure                                                                                                                          | You provision and pay for RPC access                                                                                                                            |
|                   | **MEV Protection**               | Industry-lowest MEV attack rate ([sandwiched.me](https://sandwiched.me))                                                                                            | Dependent on your infrastructure choices                                                                                                                        |
| **Configuration** | **Slippage Optimization**        | RTSE (Real-Time Slippage Estimator) applying heuristics and real-time adjustments using token categories, historical and real-time data                             | Manual configuration based on your strategy                                                                                                                     |
|                   | **Priority Fee Management**      | Automatic estimation and optimization using quality RPC and network data                                                                                            | You build custom fee estimation logic                                                                                                                           |
|                   | **Manual Mode**                  | Available for user-facing trading experiences<br />*Not recommended as default integration*                                                                         | Full manual control always                                                                                                                                      |
| **Gasless**       | **Ultra Gasless Support (Iris)** | Automatic when user has trade value but insufficient SOL<br />Jupiter pays: tx fee, priority fee, token account rent                                                | Not supported                                                                                                                                                   |
|                   | **JupiterZ Gasless**             | Market makers cover tx and priority fees<br />*(Not token account rent)*                                                                                            | Not applicable                                                                                                                                                  |
|                   | **Integrator as Payer**          | Supported (Iris quotes only, all gas covered)                                                                                                                       | Supported with full control over implementation                                                                                                                 |
| **Customization** | **Transaction Customization**    | Opinionated—no custom instructions, no CPI, no instruction modification                                                                                             | Full flexibility—add instructions, use for CPI, compose as needed                                                                                               |
| **Operations**    | **Customer Support**             | Jupiter provides direct support to your users via official channels                                                                                                 | Minimal technical support—you handle user-facing support                                                                                                        |
|                   | **Rate Limits**                  | Dynamic based on executed volume<br />Base quota can be increased on request                                                                                        | Fixed tiers via [portal.jup.ag](https://portal.jup.ag), no overages                                                                                             |
|                   | **Incident Response**            | P0 direct contact available, monitored business chats                                                                                                               | [status.jup.ag](https://status.jup.ag) updates, monitored chats by severity                                                                                     |
|                   | **Monitoring & Observability**   | Same infrastructure as jup.ag—24/7 monitoring, end-to-end logging                                                                                                   | Self-service status page—you log and monitor your own infrastructure                                                                                            |
|                   | **Infrastructure Maintenance**   | Fully managed by Jupiter                                                                                                                                            | You build and maintain all infrastructure                                                                                                                       |
| **Fees**          | **Fees Involved**                | 5-10 bps swap fee                                                                                                                                                   | Portal fees to increase rate limits                                                                                                                             |
| **Best For**      | **Ideal Use Cases**              | • Standard swap UX<br />• Quick time to market<br />• Product differentiation focus<br />• Inherited optimization<br />• Operational support needs                  | • CPI integration<br />• Custom instructions<br />• Novel transaction compositions<br />• Infrastructure as competitive advantage<br />• Full execution control |
|                   | **Team Profile**                 | Teams focusing on product, not infrastructure                                                                                                                       | Teams with infrastructure expertise and resources                                                                                                               |
|                   | **Strategic Trade-off**          | Customization flexibility → Immediate performance + reduced overhead                                                                                                | Immediate optimization → Freedom to build proprietary infrastructure                                                                                            |
| **Technical**     | **Shared Infrastructure**        | Same infrastructure powering jup.ag core product                                                                                                                    | Independent integration                                                                                                                                         |
|                   | **Automatic Improvements**       | Continuous optimizations deployed automatically                                                                                                                     | Stable API, you build improvements                                                                                                                              |
|                   | **Data Sources**                 | Learns from millions of swaps across jup.ag and API integrations                                                                                                    | You collect and analyze your own data                                                                                                                           |
|                   | **Integration Complexity**       | Get order → Sign → Execute (3 steps)                                                                                                                                | Get quote → Build → Send → Poll (multiple steps + infrastructure)                                                                                               |
|                   | **Infrastructure Investment**    | Zero—fully managed                                                                                                                                                  | 3-6 months development + ongoing DevOps                                                                                                                         |


# Manual Mode
Source: https://dev.jup.ag/docs/ultra/manual-mode

Use manual mode to control Ultra API parameters like slippage or priority fee settings.

Manual mode lets you override Ultra's automatic slippage, priority fee, and broadcast settings. It is intended for user-facing trading UIs (like jup.ag's manual mode) or personal use — not as a default integration. Transactions with manual overrides fall outside Jupiter's supported execution model.

Ultra is a production-grade execution engine that we run as our core product. The default behavior reflects years of operational tuning, and continuous optimization with data gathered from network conditions, execution outcomes and real-world feedback.

Contrastingly, manual mode parameters exist to allow explicit control over execution behavior in **user-facing manual trading experiences** (e.g. similar to the jup.ag frontend), or for **personal, self-directed usage** where the operator intentionally manages execution trade-offs.

***

## When to use manual mode

* You are an integrator looking to mirror a manual trading UX like jup.ag's manual mode (e.g. slippage, transaction prioritization strategy).
* You are an individual looking to customize your Ultra swaps and intentionally manage execution trade-offs.

<Warning>
  Manual mode should NOT be used as a default interface.
</Warning>

***

## Why refrain from using manual mode

For most integrations, using Ultra as-is provides significant benefits, as seen directly on our own frontend at jup.ag:

* Proven higher and more consistent success rates
* Adaptive and optimized execution tuned with real-world feedback, execution outcomes
* Full observability, debugging, and customer support

When manual parameters are set:

* Execution behavior deviates from supported defaults
* Outcomes depend on user-selected trade-offs
* We cannot reliably reproduce or debug failures

As a result, transactions executed with manual overrides fall outside our supported execution model, and we are unable to provide full debugging assistance or customer support for issues arising from these configurations.

<Warning>
  Manual mode is not guaranteed stable or supported API usage. It may be subject to changes as Ultra evolves.
</Warning>

***

## Recommended approach

If your goal is to provide a **reliable, production‑ready execution experience**, the recommended approach is:

* Use Ultra with its default behavior
* Only if absolutely necessary, use and treat manual mode as an *advanced, opt‑in feature*
* Avoid building core execution logic around manual overrides

By doing so, you benefit directly from the same execution system, optimizations, and ongoing improvements that power our own products.

***

## Manual mode parameters

The following parameters are documented for reference only. They are optional, and should be used with caution.

```json theme={null}
    {
      "in": "query",
      "name": "slippageBps",
      "schema": {
        "type": "number",
        "minimum": 0,
        "maximum": 10000
      },
      "required": false
    },
    {
      "in": "query",
      "name": "broadcastFeeType",
      "schema": {
        "type": "string",
        "enum": [
          "maxCap",
          "exactFee"
        ]
      },
      "required": false
    },
    {
      "in": "query",
      "name": "priorityFeeLamports",
      "schema": {
        "type": "number",
        "exclusiveMinimum": 0
      },
      "required": false
    },
    {
      "in": "query",
      "name": "jitoTipLamports",
      "schema": {
        "type": "number",
        "minimum": 1000
      },
      "required": false
    },
```

***

## Using manual mode parameters with integrator parameters

We allow manual mode parameters to be used with integrator parameters, such as `slippageBps` with `payer` / `referral`. There are some pointers to take note of:

<Card>
  **`slippageBps` causes `payer` account being drained**

  If you allow taker to set slippage and you provide gasless via `payer` at the same time, there is a possibility where taker sets `slippageBps=0` which may result in high failure rates - however, these transactions are still submitted on-chain and the default network fee for processing will still apply - making the `payer` account susceptible to be drained.
</Card>

<Card>
  **Priority fee parameters causes `payer` account being drained**

  If you allow taker to set priority fee parameters and you provide gasless via `payer` at the same time, there is a possibility where taker sets `high-priority-fees` which may cause the `payer` account to overspend on gas fee.
</Card>


# Integrate Jupiter Plugin
Source: https://dev.jup.ag/docs/ultra/plugin-integration

Seamlessly integrate end-to-end Ultra Swap functionality into any application with just a few lines of code.

Jupiter Plugin is an open-source, lightweight, plug-and-play version of Jupiter Ultra Swap, allowing you to bring the exact jup.ag swap experience to any application.

Try out the [Plugin Playground](https://plugin.jup.ag/) to experience the entire suite of customizations.

To view the open-source code, visit the [GitHub repository](https://github.com/jup-ag/plugin).

<Frame>
  <a href="https://plugin.jup.ag/">
    <img alt="Plugin Playground" />
  </a>
</Frame>

<Note>
  **QUICK START**

  To quick start your integration, check out the [Next.js](/tool-kits/plugin/nextjs-app-example), [React](/tool-kits/plugin/react-app-example) or [HTML](/tool-kits/plugin/html-app-example) app examples.

  Refer to [Customization](/tool-kits/plugin/customization) and [FAQ](/tool-kits/plugin/faq) for more information.
</Note>

## Key Features

* **Seamless Integration**: Embed Jupiter's swap functionality directly into your application without redirects.
* **Multiple Display Options**: Choose between integrated, widget, or modal display modes.
* **Customizable Options**: Configure the swap form to match your application's needs.
* **RPC-less**: Integrate Plugin without any RPCs, Ultra handles transaction sending, wallet balances and token information.
* **Ultra Mode**: Access to all features of Ultra Mode, read more about it in the [Ultra Swap API docs](/docs/ultra/).

## Getting Started

When integrating Plugin, there are a few integration methods to think about, and choose the one that best fits your application's architecture and requirements.

### Integration Methods

* **Using Window Object** - Simplest way to add and initialize Plugin.
* [**Using NPM Package**](https://www.npmjs.com/package/@jup-ag/plugin) - Install via `npm install @jup-ag/plugin` and initialize as a module (will require you to maintain its dependencies).

### Wallet Integration

* **Wallet Standard Support**: For applications without existing wallet provider, Plugin will provide a wallet adapter and connection - powered by [Unified Wallet Kit](/tool-kits/wallet-kit/).
* **Passthrough Wallet**: For applications with existing wallet provider(s), set `enableWalletPassthrough=true` with context, and Plugin will allow the application to pass through the existing wallet provider's connection to Plugin.

### Adding Fees to plugin

* **Referral Account**: You can create a referral account via [scripts](/docs/ultra/add-fees-to-ultra) or [Referral Dashboard](https://referral.jup.ag/).
* **Referral Fee**: You can set the referral fee and account in the `formProps` interface when you initialize the Plugin.

### Quick Start Guides

In the next sections, we'll walk you through the steps to integrate Jupiter Plugin into different types of web applications from scratch.

**Quick start guides:** [Next.js](/tool-kits/plugin/nextjs-app-example) | [React](/tool-kits/plugin/react-app-example) | [HTML](/tool-kits/plugin/html-app-example)

<CardGroup>
  <Card href="/tool-kits/plugin/nextjs-app-example" icon="N" title="Next.js" />

  <Card href="/tool-kits/plugin/react-app-example" icon="react" title="React" />

  <Card href="/tool-kits/plugin/html-app-example" icon="html5" title="HTML" />
</CardGroup>

By integrating Jupiter Plugin into your application, you can seamlessly integrate a fully functional swap interface into your application with minimal effort, while staying at the forefront of Solana DeFi innovation.


# Rate Limit
Source: https://dev.jup.ag/docs/ultra/rate-limit

The Ultra Swap API uses a unique rate limiting mechanism that scales with your executed swap volume over time.

Ultra Swap uses dynamic rate limiting that scales with your executed swap volume. The base quota is 50 requests per 10-second sliding window, and additional quota is added based on your rolling 24-hour volume from `/execute`. A free API key from [portal.jup.ag](https://portal.jup.ag) is required.

## Overview

| Property                | Dynamic                                      |
| :---------------------- | :------------------------------------------- |
| **Base URL**            | `https://api.jup.ag/ultra/`                  |
| **Cost**                | Free to use, but Ultra Swap incurs swap fees |
| **API Key**             | Required                                     |
| **Requests Per Minute** | Base Quota + Added Quota                     |

## API Key Rules

The Ultra Swap API requires an API key to be used and can be generated via [Portal](https://portal.jup.ag).

* It is required to be used for the Dynamic Rate Limit.
* The API Key is free to generate and is universal, the API Key will work for all APIs.
* Upgrading to a Pro plan only applies to other APIs, does not work with Ultra Swap API.

<Card title="Read about Portal Rate Limits for full details" href="/portal/rate-limit" icon="book-open" />

## How Dynamic Rate Limit Works

Every **10 minutes**

* The system aggregates your swap volume from `/execute` on Ultra Swap for **the current rolling day** (volume of (current timestamp - 1 day) up to present).
* After which, the Added Quota will update, which will be added on top of the Base Quota.

| Swap Volume | Requests Per Period       | Sliding Window Period |
| :---------- | :------------------------ | :-------------------- |
| \$0         | 50 Base + 0 Added = 50    | 10 seconds            |
| \$10,000    | 50 Base + 1 Added = 51    | 10 seconds            |
| \$100,000   | 50 Base + 11 Added = 61   | 10 seconds            |
| \$1,000,000 | 50 Base + 115 Added = 165 | 10 seconds            |

<Warning>
  The formula is subject to changes as we experiment with the Dynamic Rate Limit system.

  If you find that the rate limit is too restrictive, please reach out to us in [Discord](https://discord.gg/jup).
</Warning>

## Managing Rate Limits

If you receive a 429 response, you should:

1. Implement exponential backoff in your retry logic
2. Wait for sliding window to allow for more requests
3. **Scale your Ultra Swap usage** to unlock higher limits or reach out to us in [Discord](https://discord.gg/jup).

<Warning>
  Bursting beyond your allocation may result in **temporary 429s/rate limits**, even after the refill period. Avoid aggressive retry patterns.
</Warning>


# Response
Source: https://dev.jup.ag/docs/ultra/response

Response schemas and error codes for Ultra Swap API endpoints.

## Order Response

<Tabs>
  <Tab title="Success" icon="face-smile">
    <CodeGroup>
      ```json Iris theme={null}
      {
          "mode": "ultra",
          "inAmount": "100000000",
          "outAmount": "461208958",
          "otherAmountThreshold": "460024271",
          "swapMode": "ExactIn",
          "slippageBps": 26,
          "priceImpactPct": "-0.0001311599520149334",
          "routePlan": [
              {
              "swapInfo": {
                  "ammKey": "HTvjzsfX3yU6BUodCjZ5vZkUrAxMDTrBs3CJaq43ashR",
                  "label": "MeteoraDLMM",
                  "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                  "outputMint": "So11111111111111111111111111111111111111112",
                  "inAmount": "52000000",
                  "outAmount": "239879552",
                  "feeAmount": "0",
                  "feeMint": "11111111111111111111111111111111"
              },
              "percent": 52,
              "bps": 5200
              }
          ],
          "feeMint": "So11111111111111111111111111111111111111112",
          "feeBps": 2,
          "taker": "taker-address",
          "gasless": false,
          "signatureFeeLamports": 5000,
          "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAEB+r/6dWfRh5QZq1pS2FU/a5CQmMX/HcgLK4+zaeSlI5cZdTk+KNaH68Jj2ISScdmgdJ/88PKxKtXPavfMK2A5TFvQBO6cleTQsKnQWYpDA5PurAceVrkoCVPKJSGBw6LARo6wTdxxXRAzu6pCAqBH8SnExvClVC1O8bT5gyQxm5oAwZGb+UhFzL/7K26csOb57yM5bvF9xJrLEObOkAAAAAEedVb8jHAbu50xW7OaBUH/bGy3qP0jlECsc2iVrwTjwbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpeE6XgwQiPQTdYGYpJIn7N9ynBymyDkUCCC1aA3Klx+cFBAAFAjh+AQAEAAkD75JsAAAAAAAFBQEAFAYQCZPxe2T0hK52/wUhAAIBEhQGBgURBQcWCggLCQwCAQAGFRcADQECDw4DFQYTLrtk+swxxK8UAOH1BQAAAAAbtn0bAAAAABoAAgAAAAIAAABDUBQAAlYB/8ASAAIGAwEAAAEJAym/lQcqT78E33F1k+c4vMwhJygVwkcagNn59VWw1IQlASAFEwAoAhdSojJcrqzlDmuUV2ZVdk3ihN14mZpQMxrnUJS463C7xAUxLhQVMAItL7MrMZDyYzurr+hCn5YjvrvmsR9/EdfdhYUISn5ODzRsA8vPzAHO",
          "prioritizationFeeLamports": 696237,
          "rentFeeLamports": 0,
          "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "outputMint": "So11111111111111111111111111111111111111112",
          "swapType": "aggregator",
          "router": "iris",
          "requestId": "019974a8-5fbb-7395-9355-9ebf8f844884",
          "inUsdValue": 99.96761068334662,
          "outUsdValue": 99.95449893632635,
          "priceImpact": -0.013115995201493341,
          "swapUsdValue": 99.96761068334662,
          "totalTime": 359
      }
      ```

      ```json JupiterZ (RFQ) theme={null}
      {
          "mode": "ultra",
          "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "outputMint": "So11111111111111111111111111111111111111112",
          "inAmount": "100000000",
          "outAmount": "460250418",
          "otherAmountThreshold": "460250418",
          "swapMode": "ExactIn",
          "slippageBps": 0,
          "priceImpactPct": "-0.00018881197024002837",
          "routePlan": [
              {
              "swapInfo": {
                  "ammKey": "CDg3bPoM21fSXEzrXWHWyJR33JHX6xaYboq5p7s4uo48",
                  "label": "JupiterZ",
                  "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                  "outputMint": "So11111111111111111111111111111111111111112",
                  "inAmount": "100000000",
                  "outAmount": "460250418",
                  "feeAmount": "0",
                  "feeMint": "11111111111111111111111111111111"
              },
              "percent": 100,
              "bps": 10000
              }
          ],
          "feeBps": 2,
          "transaction": "AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAIABgymr6yEAmkOIXpp3AcyvWL/QB2KoDZDEZAXeMYvfP7cver/6dWfRh5QZq1pS2FU/a5CQmMX/HcgLK4+zaeSlI5cDiUHiMuOTEfv/7RvoyR8p3lT/6Mq87vOJ1wZbQZg8PAPZvgVNXGQR4l/GibNBPjRJtllQ2kqGDcrpjCUaFKkdTAkgVB1V0ZN+ftspt1cSBk+wVMQVrs4JNQFQwBgW9GZb0ATunJXk0LCp0FmKQwOT7qwHHla5KAlTyiUhgcOiwEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMGRm/lIRcy/+ytunLDm+e8jOW7xfcSayxDmzpAAAAABpuIV/6rgYT7aH9jRhjANdrEOdwa6ztVmKDwAAAAAAEG3fbh12Whk9nL4UbO63msHLSF7V9bN5E6jPWFfv8AqUpYSftyo7vpH9xbDmpX9jxaHLRbIGem7Qys02OVyKECxvp6877brTo9ZfNqq8l0MbG75MLS9uDkfKYCA0UvXWGJKbAQWdHOsOJGn5YdWJhd2PXDdDG9WzYvCihrfITlwwMHAAkDDRoAAAAAAAAHAAUC4JAAAAoMAQAFAwoCCwkICQYEI6hgt6NcCiigAOH1BQAAAAAy3W4bAAAAACoW0mgAAAAAAgAAAA==",
          "gasless": true,
          "signatureFeeLamports": 0,
          "prioritizationFeeLamports": 0,
          "rentFeeLamports": 0,
          "requestId": "ff63982b-9140-9b0e-e525-44f7246a79b2",
          "swapType": "rfq",
          "router": "jupiterz",
          "quoteId": "5852f88e-525b-5400-ab97-abe5e409ebfd",
          "maker": "CDg3bPoM21fSXEzrXWHWyJR33JHX6xaYboq5p7s4uo48",
          "taker": "taker-address",
          "expireAt": "1758598698",
          "platformFee": {
              "amount": "92050",
              "feeBps": 2
          },
          "inUsdValue": 99.97072758461792,
          "outUsdValue": 99.95185191457634,
          "priceImpact": -0.018881197024002837,
          "swapUsdValue": 99.97072758461792,
          "totalTime": 489
      }
      ```
    </CodeGroup>
  </Tab>

  <Tab title="Failed" icon="face-frown-slight">
    In cases where it fails to find a quote, the response will be as follows.

    ```json 400 Response Code theme={null}
    {
        "error": "Failed to get quotes"
    }
    ```
  </Tab>
</Tabs>

### Order Response Codes

In cases where a quote is available but the swap simulation fails, there are error codes that can be returned.

| `errorCode` | `errorMessage`                      | Description                                                              |
| :---------- | :---------------------------------- | :----------------------------------------------------------------------- |
| 1           | Insufficient funds                  | Does not have sufficient swap amount                                     |
| 2           | Top up `${solAmount}` SOL for gas   | Does not have sufficient SOL for gas fees                                |
| 3           | Minimum `${swapAmount}` for gasless | Does not have sufficient trade size to be applicable for Gasless Support |

## Execute Response

<Tabs>
  <Tab title="Success" icon="face-smile">
    Use the `signature` field to view the transaction in an explorer.

    ```json theme={null}
    {
        "status": "Success",
        "signature": "transaction-signature",
        "slot": "323598314",
        "code": 0,
        "inputAmountResult": "9995000",
        "outputAmountResult": "1274698",
        "swapEvents": [
            {
            "inputMint": "So11111111111111111111111111111111111111112",
            "inputAmount": "9995000",
            "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "outputAmount": "1274698"
            }
        ]
    }
    ```
  </Tab>

  <Tab title="Failed" icon="face-frown-slight">
    Here are some example cases of the execute response when it fails.

    ```json Ultra Endpoint Codes theme={null}
    {
        "code": -1,
        "error": "Order not found, it might have expired"
    }
    ```

    ```json Aggregator Swap Type Codes theme={null}
    {
        "status": "Failed",
        "slot": "0",
        "signature": "transaction-signature",
        "code": -1005,
        "error": "Transaction expired"
    }
    ```

    ```json RFQ Swap Type Codes theme={null}
    {
        "status": "Failed",
        "slot": "0",
        "code": -2005,
        "error": "Internal error",
    }
    ```

    In cases where the routes are of aggregator types like Iris and has been submitted to the network, but failed to land due to program related errors, the response will be as follows.

    Only Jupiter V6 Aggregator Program Codes are parsed with description, for other DEX program codes, the error message can be `custom program error: #<code>`.

    ```json Program Related Codes theme={null}
    {
        "status": "Failed",
        "signature": "transaction-signature",
        "slot": "368661931",
        "code": 6001,
        "error": "Slippage tolerance exceeded",
        "totalInputAmount": "1000000",
        "totalOutputAmount": "4647512",
        "inputAmountResult": "1000000",
        "outputAmountResult": "4648441",
        "swapEvents": [
            {
            "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "inputAmount": "50000",
            "outputMint": "So11111111111111111111111111111111111111112",
            "outputAmount": "232423"
            },
            {
            "inputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            "inputAmount": "950000",
            "outputMint": "So11111111111111111111111111111111111111112",
            "outputAmount": "4416018"
            }
        ]
    }
    ```
  </Tab>
</Tabs>

### Execute Response Codes

| Code | Description                | Debugging                                                                                                                    |
| :--- | :------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| 0    | Success                    | -                                                                                                                            |
| -1   | Missing cached order       | `requestId` not found in cache, likely expired or not found                                                                  |
| -2   | Invalid signed transaction | `signedTransaction` is invalid, likely failed to sign the transaction correctly                                              |
| -3   | Invalid message bytes      | `signedTransaction` is invalid, likely due to incorrect usage like modification of `transaction` field in the order response |
| -4   | Missing request id         | `requestId` is not found in the request to `/execute`                                                                        |
| -5   | Missing signed transaction | `signedTransaction` is not found in the request to `/execute`                                                                |

### Aggregator Swap Type Codes

| Code  | Description                  | Debugging                                                      |
| :---- | :--------------------------- | :------------------------------------------------------------- |
| -1000 | Failed to land               | Transaction failed to land on the network                      |
| -1001 | Unknown error                | Please try again, if it persists please reach out in Discord   |
| -1002 | Invalid transaction          | Please try again, if it persists please reach out in Discord   |
| -1003 | Transaction not fully signed | Failed to sign the transaction correctly                       |
| -1004 | Invalid block height         | The block height is invalid                                    |
| -1005 | Expired                      | The submitted transaction has been attempted but has expired   |
| -1006 | Timed out                    | The submitted transaction has been attempted but has timed out |
| -1007 | Gasless unsupported wallet   | The wallet is not supported for gasless                        |

### RFQ Swap Type Codes

| Code  | Description     | Debugging                                                            |
| :---- | :-------------- | :------------------------------------------------------------------- |
| -2000 | Failed to land  | Please try again, if it persists please reach out in Discord         |
| -2001 | Unknown error   | Please try again, if it persists please reach out in Discord         |
| -2002 | Invalid payload | Please try again, if it persists please reach out in Discord         |
| -2003 | Quote expired   | User did not respond in time or RFQ provider did not execute in time |
| -2004 | Swap rejected   | User or RFQ provider rejected the swap                               |
| -2005 | Internal error  | Please try again, if it persists please reach out in Discord         |

### Program Related Codes

For Jupiter V6 Aggregator Program Codes, the error message will be parsed with description.

<Card title="IDL" href="https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4#programIdl" icon="file-lines">
  For the full and most up to date list of Jupiter V6 Aggregator Program Codes, you can refer to the IDL on an explorer.
</Card>

<Info>
  If you need help identifying the other DEX program codes, please reach out in Discord.
</Info>

## Best Practices

It is important to understand the error codes to provide a better experience for your users, helping them make an informed decision or follow up step to help their transaction succeed.

<Info>
  See [https://jup.ag/](https://jup.ag/) as a reference to understand how we handle errors on the UI.
</Info>

| Example Error                | Best Practice                                                                                                |
| :--------------------------- | :----------------------------------------------------------------------------------------------------------- |
| Slippage exceeding threshold | Show the user the current slippage tolerance and the incurred slippage                                       |
| Insufficient funds           | Disable swap widget but still provide quote visibility                                                       |
| Non Jupiter Program Errors   | Allow the user to retry with a new route by requoting and/or exclude the specific DEX from the quote request |


# Search Token
Source: https://dev.jup.ag/docs/ultra/search-token

Search for tokens by symbol, name, or mint address through the Ultra Swap API.

The Ultra Swap API provides an endpoint to search tokens in the background for you and returns you the search results, along with the mint information.

This is useful in most user applications, as users need to choose which tokens they want to swap. This also provides a seamless developer experience as integrating this allows us to handle and abstract the token search mechanism, allowing you to focus on other user features.

<Info>
  **SEARCH**

  * Search for a token and its information by its **symbol, name or mint address**.
  * Comma-separate to search for multiple.
  * Limit to 100 mint addresses in query.
  * Default to 20 mints in response when searching via symbol or name.
</Info>

Search for a token by mint address:

```js theme={null}
const searchResponse = await (
  await fetch(`https://api.jup.ag/ultra/v1/search?query=So11111111111111111111111111111111111111112`,
    {
      headers: {
        'x-api-key': 'your-api-key',
      },
    }
  )
).json();
```

## Search Response

The search response will return an array of mints, along with their information.

<Tip>
  **USEFUL MINT INFORMATION**

  * Token Metadata like name, symbol, icon to display token information to users
  * [Organic Score](/docs/tokens/organic-score), Holder count, Market cap, etc can be useful to help make a better trading decision
  * And much more!

  Do note that the response is subject to changes as we continue to improve.

  Refer to [Ultra Swap API Reference](/api-reference/ultra/search) for full schema.
</Tip>


# Development Basics
Source: https://dev.jup.ag/get-started/development-basics

Learn the basics of Solana and Jupiter development, including interacting with Solana programs and accounts, building transactions, and sending transactions to the network.

Solana uses an account-based architecture where data are stored in accounts. However, Solana keeps Programs (also known as smart contracts on other blockchains) and Accounts distinct.

<Tip>
  **Where are the Jupiter Programs deployed?**

  Jupiter is built on Solana MAINNET only!
</Tip>

In order to mutate the data in Accounts, you will need to send transactions to the network which execute Instructions defined by Programs.

* [Programs](https://solana.com/docs/core/programs) on Solana are executable code deployed on-chain. They are designed to execute instructions, process transactions and interact with accounts.
* [Instructions](https://solana.com/docs/core/transactions#instruction) on Solana are defined by the Program, similar to API endpoints exposed by a program.
* [Accounts](https://solana.com/docs/core/accounts) store data and are mutable, meaning they can be updated by the program who interacts with them.
* [Transactions](https://solana.com/docs/core/transactions#transaction) is what we send to interact with the network which can include one or more instructions to execute what is needed.

## Interacting with Solana

The Solana Web3.js and Rust client libraries serve as essential interfaces for interacting with Solana in JavaScript/TypeScript and Rust environments, respectively. They abstract complex interactions with the network, providing easier and more accessible functions for developers building on Solana. Here’s an overview of what each library offers and some of the most common functions they simplify:

1. Connecting to the network via RPC (Remote Procedure Call) endpoints
2. Building Transactions
3. Interfacing with Solana Programs and Accounts

<Info>
  Explore the rich features and detailed documentation of these libraries in the official Solana Developer Documentation: [Web3.js](https://solana.com/docs/clients/javascript) and [Rust client](https://solana.com/docs/clients/rust)
</Info>

## Interacting with Jupiter

For example, to use the Jupiter Swap Aggregator Program, there are a few ways to do it:

| Method                                                             | Description                                                                                                                                                                                                                                            |
| :----------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ultra Swap API](/docs/ultra)                                      | Simply call the order endpoint to get a quote, sign then submit the transaction to the execute endpoint, we handle the rest for you, no RPCs needed!                                                                                                   |
| Flash Fill method                                                  | If you are building your own on-chain program, an alternative method from CPI, using Versioned Transaction and Address Lookup Tables, thus reducing the size of each account (used to be a limitation of using CPI method).                            |
| [Cross Program Invocation (CPI)](https://solana.com/docs/core/cpi) | CPI method is now recommended. As of January 2025, Jupiter Swap via CPI is recommended for most users. [The `Loosen CPI restriction` feature has been deployed on Solana, you can read more here](https://github.com/solana-labs/solana/issues/26641). |

## Building Transactions

Before you send a transaction to the network, you will need to build the transaction that defines the instructions to execute and accounts to read/write to. It can be complex to handle this yourself when building with Jupiter, you can [read more about it here](https://solana.com/docs/core/transactions).

<Tip>
  However, good news! The [Ultra Swap API](/docs/ultra) handles everything for you!

  1. You get an order response with the encoded transaction.
  2. You sign the transaction and submit to execute.
  3. We handle the transaction sending and the rest for you.
</Tip>

## Sending Transactions

Transactions on Solana can only be sent to the network through an RPC (Remote Procedure Call) endpoint. The Solana network operates with a client-server model where RPC nodes handle transactions and interact with the validators of the blockchain. We recommend using 3rd party RPC providers like [Triton](https://triton.one/) or [Helius](https://helius.dev/) for production applications.

There are a few key points to note when sending transactions to the Solana network.

1. Solana transaction base fee
2. Priority fee
3. Compute units
4. Transaction broadcasting methods
5. Slippage (100% slippage will probably always work but also mean you can possibly get the worst outcome, so we need to find the balance between success optimizations and best output price)

<Tip>
  By using [Ultra Swap API](/docs/ultra), we will optimize all of these for you!

  * No additional params from you.
  * No RPCs required from you.
  * Simply let us handle and optimize it for you.
</Tip>

## About these factors

### What is Priority Fee

Transactions submitted to the blockchain are prioritized based on a fee-bidding process. The higher the priority fee, the higher your transaction will be placed in the execution queue.

<Note>
  **Overpaying Priority Fee**

  It is important to note that overpaying for priority fee can be detrimental in the long run. If transactions continuously outbid each other, the overall fees required to process across the network will increase over time.
</Note>

**Priority Fee** is an optional fee you can pay additionally to improve the chance of landing your transactions faster.

* Priority Fee = **Compute Budget \* Compute Unit Price**
* This is excluding the base transaction fee (5,000 lamports or 0.000005 SOL) that you always need to pay.
* You not only need to outbid other transactions trying to be included in the block, but also outbid those trying to write to the same account.

| Terminologies       |                                                                                 |
| :------------------ | :------------------------------------------------------------------------------ |
| Global Priority Fee | The Priority Fee estimation across the entire network.                          |
| Local Fee Market    | The Priority Fee estimation when modifying a writable account (or hot account). |
| Priority Fee        | Compute Budget \* Compute Unit Price                                            |
| Compute Budget      | How much compute unit the transaction is supposed to consume                    |
| Compute Unit Price  | Micro lamports per compute unit the transaction will use                        |

When querying the micro-lamport per compute unit for a particular program or account, it will contain both the Global and Local Fee markets.

### What is Compute Unit

Compute Unit (CU) is a standardized metric for evaluating how much "work" or "resource" is required by the transaction to execute. Different operations on Solana has varying amounts of CUs. In order to keep the blockchain efficient yet fast, each transaction, the Solana runtime has an absolute max compute unit limit of 1.4 million CU and sets a default requested max limit of 200k CU per instruction.

<Tip>
  **Set Custom Compute Unit Limit**

  A transaction can request a more specific and optimal compute unit limit by including a single `SetComputeUnitLimit` instruction. Either a higher or lower limit. But it may never request higher than the absolute max limit per transaction.
</Tip>

However, we must note that higher CU also means higher Priority Fee it might need to help prioritize it.

### What are some transaction broadcasting methods

1. Typical RPCs
2. RPCs with SWQoS
3. Jito RPC

### What is Slippage

A percentage or bps threshold the user specify and if the actual executed output is less than quoted output by the percentage/bps, the transaction will fail.

It is more like a safeguard but the tighter threshold you go, the harder it can become to land the transaction as markets can move rapidly.


# Environment Setup
Source: https://dev.jup.ag/get-started/environment-setup

Install required libraries, configure an RPC connection, and set up a development wallet.

<Info>
  **ABOUT THE DOCUMENTATION**

  In the documentation, we are using the Solana `web3.js` library to set up connection, sign transactions, etc.
</Info>

## Useful Libraries

**JavaScript Libraries**

* `@solana/web3.js`
* `@solana/spl-token`

## Useful Scripts

**Set up RPC Connection**

<Info>
  Solana provides a [default RPC endpoint](https://solana.com/docs/core/clusters). However, as your application grows, we recommend you to always use your own or provision a 3rd party provider’s RPC endpoint such as [Helius](https://helius.dev/) or [Triton](https://triton.one/).
</Info>

```bash theme={null}
const connection = new Connection('https://api.mainnet-beta.solana.com');
```

**Set up Development Wallet**

<Info>
  You can paste in your private key for testing but this is not recommended for production.

  * Either use your private key in the project directly, you can do it via a `.env` file.
  * Or set up your private key in the [Solana CLI](https://solana.com/docs/intro/installation#create-wallet).
</Info>

<CodeGroup>
  ```javascript Store private key in .env theme={null}
  // In your .env file
  PRIVATE_KEY=""

  // In your index.js (or any file that needs the private key)
  import { Keypair } from '@solana/web3.js';
  import dotenv from 'dotenv';
  require('dotenv').config();

  const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY || '')));
  ```

  ```javascript Store private key in Solana CLI theme={null}
  import { Keypair } from '@solana/web3.js';
  import fs from 'fs';

  const privateKeyArray = JSON.parse(fs.readFileSync('/Path/to/.config/solana/id.json', 'utf8').trim());
  const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
  ```
</CodeGroup>


# Get Started
Source: https://dev.jup.ag/get-started/index

Get started instantly to build a swap widget using Jupiter's three core liquidity APIs: Swap for quote and execution, Tokens V2 for discovery, and Price V3 for reference.

Jupiter provides three core liquidity APIs that work together to power complete trading experiences. This guide shows you how to combine them to build a swap widget.

<Tip>
  Using AI tools or building with LLMs? Use our [llms.txt](/llms.txt) index for a structured map of the docs, and see [AI Workflow](/resources/ai-workflow) for how to leverage Jupiter docs in AI-assisted workflows.
</Tip>

## Why These APIs

<CardGroup>
  <Card title="No RPC Required" icon="server">
    Our APIs handle all blockchain interactions for you.
  </Card>

  <Card title="No API Key Required" icon="key">
    Start building immediately. API keys are optional (for higher rate limits via [Portal](https://portal.jup.ag)).
  </Card>

  <Card title="No Upfront Payments" icon="credit-card">
    Use via our free and public endpoints.
  </Card>
</CardGroup>

## The Three APIs

| API            | Base URL                            | Purpose                                                                |
| :------------- | :---------------------------------- | :--------------------------------------------------------------------- |
| **Ultra Swap** | `https://lite-api.jup.ag/ultra/v1`  | Swap execution - get quotes and execute transactions using your wallet |
| **Tokens V2**  | `https://lite-api.jup.ag/tokens/v2` | Token discovery - search and get token metadata                        |
| **Price V3**   | `https://lite-api.jup.ag/price/v3`  | Pricing - get USD prices for any token                                 |

## Common Token Addresses

| Token | Mint Address                                   | Decimals |
| :---- | :--------------------------------------------- | :------- |
| SOL   | `So11111111111111111111111111111111111111112`  | 9        |
| USDC  | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6        |

## Dependencies

For signing and executing swap transactions, install `@solana/web3.js` version 1.x:

```bash theme={null}
npm install @solana/web3.js@1 bs58
```

<Note>
  This guide uses `@solana/web3.js` **v1**. Version 2 has a different API for transaction handling.
</Note>

<Tip>
  Building a frontend? Use [Jupiter Wallet Kit](/tool-kits/wallet-kit) for easy wallet connectivity across 20+ Solana wallets.
</Tip>

***

## 1. Token Discovery

Search for tokens by symbol, name, or mint address using the Tokens V2 API.

```
GET https://lite-api.jup.ag/tokens/v2/search?query={searchTerm}
```

```javascript theme={null}
async function searchTokens(query) {
  const response = await fetch(
    `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(query)}`
  );
  return response.json();
}

// Example
const tokens = await searchTokens('usdc');
console.log(tokens[0]); // { id, name, symbol, icon, decimals, usdPrice, ... }
```

<Accordion title="Example Response">
  ```bash theme={null}
  curl --request GET \
    --url 'https://lite-api.jup.ag/tokens/v2/search?query=JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' \
  ```

  ```json expandable theme={null}
  [
    {
      "id": "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
      "name": "Jupiter",
      "symbol": "JUP",
      "icon": "https://static.jup.ag/jup/icon.png",
      "decimals": 6,
      "twitter": "https://twitter.com/JupiterExchange",
      "website": "https://jup.ag",
      "dev": "JUPhop9E8ZfdJ5FNHhxQt4uAih822Vs4QpqsWcewFbq",
      "circSupply": 3243891294.88,
      "totalSupply": 6863982812.191499,
      "tokenProgram": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      "firstPool": {
        "id": "2pspvjWWaf3dNgt3jsgSzFCNvMGPb7t8FrEYvLGjvcCe",
        "createdAt": "2024-01-29T17:33:29Z"
      },
      "holderCount": 863626,
      "audit": {
        "mintAuthorityDisabled": true,
        "freezeAuthorityDisabled": true,
        "topHoldersPercentage": 15.598836011643503,
        "devMints": 1
      },
      "organicScore": 93.70008826827798,
      "organicScoreLabel": "high",
      "ctLikes": 397,
      "smartCtLikes": 177,
      "isVerified": true,
      "tags": [
        "birdeye-trending",
        "community",
        "moonshot-verified",
        "strict",
        "verified"
      ],
      "createdAt": "2024-06-07T10:56:42.584Z",
      "fdv": 1295436289.723886,
      "mcap": 612218098.1926562,
      "usdPrice": 0.18872953577666163,
      "priceBlockId": 398168601,
      "liquidity": 3254134.0851675714,
      "stats5m": {
        "priceChange": 0.0691969260910124,
        "holderChange": -0.004978759223730387,
        "liquidityChange": 0.02070855283903766,
        "volumeChange": -41.51635943714493,
        "buyVolume": 2270.977598883256,
        "sellVolume": 2478.787204926521,
        "buyOrganicVolume": 28.559384829973588,
        "sellOrganicVolume": 1096.398129121432,
        "numBuys": 106,
        "numSells": 109,
        "numTraders": 90,
        "numOrganicBuyers": 5,
        "numNetBuyers": 10
      },
      "stats1h": {
        "priceChange": 0.8963569095373793,
        "holderChange": -0.006946969153141303,
        "liquidityChange": -0.05742533895109799,
        "volumeChange": 20.224060261481398,
        "buyVolume": 202057.32343858018,
        "sellVolume": 130910.04513282242,
        "buyOrganicVolume": 1960.702323688371,
        "sellOrganicVolume": 4982.587060762151,
        "numBuys": 2909,
        "numSells": 2625,
        "numTraders": 532,
        "numOrganicBuyers": 28,
        "numNetBuyers": 84
      },
      "stats6h": {
        "priceChange": 0.806881917998056,
        "holderChange": -0.012156562633505107,
        "liquidityChange": -1.0655669333935223,
        "volumeChange": -39.39506877948361,
        "buyVolume": 891754.7845159877,
        "sellVolume": 784178.1759400497,
        "buyOrganicVolume": 24167.93357749837,
        "sellOrganicVolume": 76699.82817775776,
        "numBuys": 15506,
        "numSells": 14778,
        "numTraders": 2137,
        "numOrganicBuyers": 80,
        "numNetBuyers": 364
      },
      "stats24h": {
        "priceChange": -1.8984104107182198,
        "holderChange": -0.03622940971526925,
        "liquidityChange": 3.1091858514428834,
        "volumeChange": -28.058201035408803,
        "buyVolume": 4387366.5045432765,
        "sellVolume": 3863094.110430575,
        "buyOrganicVolume": 209341.30678184459,
        "sellOrganicVolume": 460153.90469366894,
        "numBuys": 57708,
        "numSells": 55589,
        "numTraders": 6871,
        "numOrganicBuyers": 297,
        "numNetBuyers": 1254
      },
      "stats7d": {
        "priceChange": -10.154560928102246
      },
      "stats30d": {
        "priceChange": -19.827864392815485
      },
      "fees": 30.154901056001673,
      "updatedAt": "2026-02-05T06:41:33.565118194Z"
    }
  ]
  ```
</Accordion>

<Info>
  **Other useful endpoints:**

  * `GET /tag?query=verified` - Get all verified tokens
  * `GET /toptrending/1h` - Get trending tokens
  * `GET /recent` - Get recently listed tokens

  See [Tokens V2 API Reference](/api-reference/tokens/v2) for full response schema and all endpoints.
</Info>

***

## 2. Price Fetching

Get USD prices for tokens using the Price V3 API.

```
GET https://lite-api.jup.ag/price/v3?ids={mint1,mint2,...}
```

```javascript theme={null}
async function getPrices(mints) {
  const ids = mints.join(',');
  const response = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`);
  return response.json();
}

// Example
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const prices = await getPrices([SOL, USDC]);
console.log(prices[SOL]?.usdPrice);
console.log(prices[USDC]?.usdPrice);
```

<Accordion title="Example Response">
  ```bash theme={null}
  curl --request GET \
    --url 'https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' \
  ```

  ```json expandable theme={null}
  {
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": {
      "createdAt": "2024-06-05T08:55:25.527Z",
      "liquidity": 553293282.885745,
      "usdPrice": 0.999703698400303,
      "blockId": 398169360,
      "decimals": 6,
      "priceChange24h": 0.00805935613443642
    },
    "So11111111111111111111111111111111111111112": {
      "createdAt": "2024-06-05T08:55:25.527Z",
      "liquidity": 417389086.2293,
      "usdPrice": 90.2300739643588,
      "blockId": 398169359,
      "decimals": 9,
      "priceChange24h": -8.41905976959318
    }
  }
  ```
</Accordion>

<Info>See [Price V3 API Reference](/api-reference/price/v3) for full response schema.</Info>

***

## 3. Swap Execution

Execute swaps using the Ultra Swap API with a simple flow:

1. Get order
2. Sign
3. Execute

### Get a Quote (No Wallet Needed)

```
GET https://lite-api.jup.ag/ultra/v1/order?inputMint={}&outputMint={}&amount={}
```

```javascript theme={null}
async function getQuote(inputMint, outputMint, amount) {
  const params = new URLSearchParams({ inputMint, outputMint, amount: amount.toString() });
  const response = await fetch(`https://lite-api.jup.ag/ultra/v1/order?${params}`);
  return response.json();
}

// Example: Quote for 0.01 SOL -> USDC
const quote = await getQuote(
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  0.01 * 1_000_000_000 // Amount to swap: 0.01 SOL (expressed in lamports, where 1 SOL = 1,000,000,000 lamports)
);
console.log(`${quote.inAmount} -> ${quote.outAmount}`);
```

<Accordion title="Example Response">
  ```bash theme={null}
  curl --request GET \
    --url 'https://lite-api.jup.ag/ultra/v1/order?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=10000000' \
  ```

  ```json expandable theme={null}
  {
    "swapType": "aggregator",
    "inAmount": "10000000",
    "outAmount": "896516",
    "otherAmountThreshold": "896516",
    "swapMode": "ExactIn",
    "slippageBps": 0,
    "priceImpactPct": "-0.0006953032312137218",
    "routePlan": [
      {
        "percent": 100,
        "bps": 10000,
        "usdValue": 0.896317433732353,
        "swapInfo": {
          "ammKey": "CKc2gypi1feWLboi7PWRgNTCi6NWhkYaGU4v6rhnZDDJ",
          "label": "BisonFi",
          "inputMint": "So11111111111111111111111111111111111111112",
          "outputMint": "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
          "inAmount": "10000000",
          "outAmount": "897075"
        }
      },
      {
        "percent": 100,
        "bps": 10000,
        "usdValue": 0.896317433732353,
        "swapInfo": {
          "ammKey": "G94idxkpL1yrzz1Gv7sdh136dQ4N77KqvntyBLQAXyHu",
          "label": "Stabble Stable Swap",
          "inputMint": "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
          "outputMint": "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
          "inAmount": "897075",
          "outAmount": "896769"
        }
      },
      {
        "percent": 100,
        "bps": 10000,
        "usdValue": 0.896317433732353,
        "swapInfo": {
          "ammKey": "2o4369ha3bENAhJDan8mdRNJjNo6qQ9P5KhUS4QZUVgi",
          "label": "AlphaQ",
          "inputMint": "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH",
          "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "inAmount": "896769",
          "outAmount": "896695"
        }
      }
    ],
    "feeMint": "So11111111111111111111111111111111111111112",
    "feeBps": 2,
    "platformFee": {
      "feeBps": 2,
      "feeMint": "So11111111111111111111111111111111111111112"
    },
    "signatureFeeLamports": 0,
    "signatureFeePayer": null,
    "prioritizationFeeLamports": 0,
    "prioritizationFeePayer": null,
    "rentFeeLamports": 0,
    "rentFeePayer": null,
    "transaction": null,
    "gasless": false,
    "taker": null,
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "router": "iris",
    "requestId": "019c2c8f-640c-779e-bedb-8b5231bb822d",
    "inUsdValue": 0.896941079763321,
    "outUsdValue": 0.896317433732353,
    "swapUsdValue": 0.896317433732353,
    "priceImpact": -0.0695303231213722,
    "mode": "ultra",
    "totalTime": 192
  }
  ```
</Accordion>

### Execute a Swap (Wallet Required)

Add the `taker` parameter to get a signable transaction, then sign and submit it.

```javascript theme={null}
import { VersionedTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

async function executeSwap(inputMint, outputMint, amount, wallet) {
  const walletAddress = wallet.publicKey.toBase58();

  // 1. Get order with transaction
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    taker: walletAddress,
  });
  const order = await fetch(`https://lite-api.jup.ag/ultra/v1/order?${params}`).then(r => r.json());

  if (order.errorCode) throw new Error(order.errorMessage);

  // 2. Sign transaction
  const tx = VersionedTransaction.deserialize(Buffer.from(order.transaction, 'base64'));
  tx.sign([wallet]);
  const signedTx = Buffer.from(tx.serialize()).toString('base64');

  // 3. Submit to execute endpoint
  const result = await fetch('https://lite-api.jup.ag/ultra/v1/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction: signedTx, requestId: order.requestId }),
  }).then(r => r.json());

  return result;
}

// Example
const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
const result = await executeSwap(
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  10000000,
  wallet
);

if (result.status === 'Success') {
  console.log(`Swap successful: ${JSON.stringify(result, null, 2)}`);
} else {
  console.error(`Swap failed: ${JSON.stringify(result, null, 2)}`);
}
```

<Accordion title="Example Response">
  ```bash Get quote with taker theme={null}
  curl --request GET \
    --url 'https://lite-api.jup.ag/ultra/v1/order?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=10000000&taker=<takerAddress>' \
  ```

  ```json expandable theme={null}
  {
    "swapType": "aggregator",
    "inAmount": "10000000",
    "outAmount": "899038",
    "otherAmountThreshold": "896079",
    "swapMode": "ExactIn",
    "slippageBps": 34,
    "priceImpactPct": "0.00014199853479733988",
    "routePlan": [
      {
        "percent": 100,
        "bps": 10000,
        "usdValue": 0.898772147475964,
        "swapInfo": {
          "ammKey": "CNC5TaeNQEoSPfQKZ7GgfM4R8WYAJRKRSHFCHkf2H7ko",
          "label": "Aquifer",
          "inputMint": "So11111111111111111111111111111111111111112",
          "outputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
          "inAmount": "10000000",
          "outAmount": "900836"
        }
      },
      {
        "percent": 100,
        "bps": 10000,
        "usdValue": 0.898772147475964,
        "swapInfo": {
          "ammKey": "Pi9nzTjPxD8DsRfRBGfKYzmefJoJM8TcXu2jyaQjSHm",
          "label": "AlphaQ",
          "inputMint": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
          "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          "inAmount": "900836",
          "outAmount": "899316"
        }
      }
    ],
    "feeMint": "So11111111111111111111111111111111111111112",
    "feeBps": 2,
    "platformFee": {
      "feeBps": 2,
      "feeMint": "So11111111111111111111111111111111111111112"
    },
    "taker": "takerAddress",
    "gasless": false,
    "signatureFeeLamports": 5000,
    "signatureFeePayer": "takerAddress",
    "prioritizationFeeLamports": 5430,
    "prioritizationFeePayer": "takerAddress",
    "rentFeeLamports": 0,
    "rentFeePayer": "takerAddress",
    "transaction": "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAFC4YR20D+54htxFQ2bC0qfXLam23ZYIpI+7fA2zhGD3nON8hLG3d38b9HH3IkjaUQdG9cF40kO3hx28YXMylj8uhb/uZhG24W3P+aJ/zSWSCIsehf3YAzOSmPh1TV30Ipo4SDDlg+ml46crsvOOdxVpk3d5x8J1aTfyOPHit7eiyYhtWfPgeJJbk/OEPgfJ5LHxDDhjdC/6XbIhitzqc3IiEM/lYBOPzoCtJvqP0yxZmjcMdMwzTW8CRoM5Non0xeTQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwZGb+UhFzL/7K26csOb57yM5bvF9xJrLEObOkAAAADa3bZMjlYUsVEBNt6LmsOxgXaRSJHQ1gO4aTdN2Wi7GAR51VvyMcBu7nTFbs5oFQf9sbLeo/SOUQKxzaJWvBOPBt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKl8W63+nScizyapq4fTCDOwcsw8E6q6WfVWFKAQihdOIAYHAAUCpF8DAAcACQPuXwAAAAAAAAYCAAEMAgAAAHC0twAAAAAACQUBABoKBgmT8Xtk9ISudv8JLRYAAQ4PBRoYCgoXCQ4VHhYKBBwKDhoTDAgUAgMLDRsWHRAEDxIREhERCh4JGS7RmFOTfP7Y6QyAlpgAAAAAAEG4DQAAAAAAIgACAAAAAgAAAGAQJwABaAEQJwECCgMBAAABCQMnGPEHmohRnOv3vOPzPU9mvJdqmRgKYRDLQ5AH3IXj/gO+ub0DbsLFKb+VBypPvwTfcXWT5zi8zCEnKBXCRxqA2fn1VbDUhCUCJDUFDwAoARfiTz4qllcehnay2i5IVBAMTSdPPOjIS+Dc4oaPyRqp7QMBBAYEApwAAw==",
    "inputMint": "So11111111111111111111111111111111111111112",
    "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "router": "iris",
    "requestId": "019c2c91-96a8-713e-bd53-9969874cdb87",
    "inUsdValue": 0.898644541267801,
    "outUsdValue": 0.898772147475964,
    "swapUsdValue": 0.898772147475964,
    "priceImpact": 0.014199853479734,
    "mode": "ultra",
    "totalTime": 175
  }
  ```

  ```bash Execute after signing transaction theme={null}
  curl --request POST \
    --url 'https://lite-api.jup.ag/ultra/v1/execute' \
    --header 'Content-Type: application/json' \
    --data '{"signedTransaction": "signedTransaction", "requestId": "requestId"}' \
  ```

  ````json expandable theme={null}
  </Accordion>
  ```json expandable
  {
    "signature": "signature",
    "status": "Success"
  }
  ````
</Accordion>

<Warning>Never hardcode private keys. Use environment variables or secure key management.</Warning>

### Frontend: Using Wallet Adapter

For browser-based apps, use a wallet adapter (e.g., Jupiter Wallet Extension) instead of a Keypair:

```javascript theme={null}
import { VersionedTransaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

async function executeSwapWithWalletAdapter(inputMint, outputMint, amount, wallet) {
  // wallet comes from useWallet() hook
  const walletAddress = wallet.publicKey.toBase58();

  // 1. Get order with transaction
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    taker: walletAddress,
  });
  const order = await fetch(`https://lite-api.jup.ag/ultra/v1/order?${params}`).then(r => r.json());

  if (order.errorCode) throw new Error(order.errorMessage);

  // 2. Sign transaction using wallet adapter
  // ...

  // 3. Submit to execute endpoint
  const result = await fetch('https://lite-api.jup.ag/ultra/v1/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction: signedTxBase64, requestId: order.requestId }),
  }).then(r => r.json());

  return result;
}

// Usage in a React component
function SwapButton() {
  const wallet = useWallet();

  const handleSwap = async () => {
    if (!wallet.connected) return;
    const result = await executeSwapWithWalletAdapter(
      'So11111111111111111111111111111111111111112',
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      10000000,
      wallet
    );
    console.log(result);
  };

  return <button onClick={handleSwap}>Swap</button>;
}
```

<Info>
  Need to set up wallet connectivity? See [Jupiter Wallet Kit](/tool-kits/wallet-kit) for a plug-and-play solution supporting 20+ wallets.
</Info>

<Info>See [Ultra Swap API Reference](/api-reference/ultra) for full response schemas, error codes, and additional parameters.</Info>

***

## 4. All Functions Together

Here are all the standalone functions you need. Each function is self-contained and can be used independently.

```javascript expandable theme={null}
import { VersionedTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// ============================================================
// CONFIGURATION
// ============================================================

const API = {
  TOKENS: 'https://lite-api.jup.ag/tokens/v2',
  PRICE: 'https://lite-api.jup.ag/price/v3',
  ULTRA: 'https://lite-api.jup.ag/ultra/v1',
};

const TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

// ============================================================
// TOKEN DISCOVERY (Tokens V2 API)
// ============================================================

async function searchTokens(query) {
  const response = await fetch(`${API.TOKENS}/search?query=${encodeURIComponent(query)}`);
  return response.json();
}

async function getVerifiedTokens() {
  const response = await fetch(`${API.TOKENS}/tag?query=verified`);
  return response.json();
}

async function getTrendingTokens(interval = '1h') {
  const response = await fetch(`${API.TOKENS}/toptrending/${interval}`);
  return response.json();
}

// ============================================================
// PRICE FETCHING (Price V3 API)
// ============================================================

async function getPrices(mints) {
  const ids = Array.isArray(mints) ? mints.join(',') : mints;
  const response = await fetch(`${API.PRICE}?ids=${ids}`);
  return response.json();
}

// ============================================================
// SWAP EXECUTION (Ultra API)
// ============================================================

async function getQuote(inputMint, outputMint, amount) {
  const params = new URLSearchParams({ inputMint, outputMint, amount: amount.toString() });
  const response = await fetch(`${API.ULTRA}/order?${params}`);
  return response.json();
}

async function executeSwap(inputMint, outputMint, amount, wallet) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    taker: wallet.publicKey.toBase58(),
  });

  // Get order
  const order = await fetch(`${API.ULTRA}/order?${params}`).then(r => r.json());
  if (order.errorCode) throw new Error(order.errorMessage);

  // Sign
  const tx = VersionedTransaction.deserialize(Buffer.from(order.transaction, 'base64'));
  tx.sign([wallet]);
  const signedTx = Buffer.from(tx.serialize()).toString('base64');

  // Execute
  const result = await fetch(`${API.ULTRA}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedTransaction: signedTx, requestId: order.requestId }),
  }).then(r => r.json());

  return {
    success: result.status === 'Success',
    signature: result.signature,
    explorerUrl: result.signature ? `https://solscan.io/tx/${result.signature}` : null,
    error: result.error,
  };
}

// ============================================================
// USER DATA (Ultra API)
// ============================================================

async function getHoldings(walletAddress) {
  const response = await fetch(`${API.ULTRA}/holdings/${walletAddress}`);
  return response.json();
}

async function getTokenWarnings(mints) {
  const mintList = Array.isArray(mints) ? mints.join(',') : mints;
  const response = await fetch(`${API.ULTRA}/shield?mints=${mintList}`);
  return response.json();
}

// ============================================================
// USAGE
// ============================================================

// Search tokens
const tokens = await searchTokens('bonk');

// Get prices
const prices = await getPrices([TOKENS.SOL, TOKENS.USDC]);

// Get quote (no wallet)
const quote = await getQuote(TOKENS.SOL, TOKENS.USDC, 10000000);

// Execute swap (with wallet)
const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
const result = await executeSwap(TOKENS.SOL, TOKENS.USDC, 10000000, wallet);
console.log(result.success ? result.explorerUrl : result.error);
```

### Function Reference

| Function                                     | API       | Description                            |
| :------------------------------------------- | :-------- | :------------------------------------- |
| `searchTokens(query)`                        | Tokens V2 | Search tokens by name, symbol, or mint |
| `getVerifiedTokens()`                        | Tokens V2 | Get all verified tokens                |
| `getTrendingTokens(interval)`                | Tokens V2 | Get trending tokens                    |
| `getPrices(mints)`                           | Price V3  | Get USD prices for tokens              |
| `getQuote(input, output, amount)`            | Ultra     | Get swap quote (no wallet needed)      |
| `executeSwap(input, output, amount, wallet)` | Ultra     | Execute a swap                         |
| `getHoldings(walletAddress)`                 | Ultra     | Get wallet token balances              |
| `getTokenWarnings(mints)`                    | Ultra     | Get security warnings for tokens       |

***

## Test with curl

```bash theme={null}
# Search tokens
curl "https://lite-api.jup.ag/tokens/v2/search?query=SOL" | jq

# Get price
curl "https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112" | jq

# Get quote
curl "https://lite-api.jup.ag/ultra/v1/order?inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=10000000" | jq
```

***

## Next Steps

<Card title="API Reference">
  <Card title="Ultra Swap" icon="bolt" href="/api-reference/ultra">
    Full API docs with all parameters, response schemas, and error codes.
  </Card>

  <Card title="Tokens V2" icon="coins" href="/api-reference/tokens/v2">
    All token discovery endpoints and response formats.
  </Card>

  <Card title="Price V3" icon="dollar-sign" href="/api-reference/price/v3">
    Price API details and confidence levels.
  </Card>
</Card>

<Card title="Tool Kits">
  <Card title="Jupiter Plugin" icon="puzzle-piece" href="/tool-kits/plugin">
    Drop-in swap UI if you don't want to build your own.
  </Card>

  <Card title="Jupiter Wallet Kit" icon="wallet" href="/tool-kits/wallet-kit">
    Unified wallet adapter for 20+ Solana wallets.
  </Card>
</Card>

<Card title="AI & LLM">
  <Card title="llms.txt" icon="file" href="/llms.txt">
    Structured index of APIs and guides for AI tools and LLM agents.
  </Card>

  <Card title="AI Workflow" icon="robot" href="/resources/ai-workflow">
    How to use Jupiter docs effectively with AI-assisted development.
  </Card>
</Card>


# Overview
Source: https://dev.jup.ag/get-started/overview

Overview of all Jupiter developer resources, documentation, and APIs. Explore product guides, API references, integration toolkits, and platform capabilities for building and scaling on Jupiter.

## Quick Start

### Build Your Own Trading Application

1. [Core Liquidity APIs Guide](/get-started) - Combine Ultra Swap, Tokens, and Price APIs to build a swap widget
2. [Plugin Integration](/tool-kits/plugin) - Add swap functionality in minutes - yes, as easy as that

### Connect with Jupiter Mobile and Wallet Extension

1. [Mobile Adapter](/tool-kits/wallet-kit/jupiter-mobile-adapter) - Connect with Jupiter's mobile ecosystem
2. [Wallet Kit](/tool-kits/wallet-kit) - Comprehensive wallet integration solution

### Learn the Basics

1. [Environment Setup](/get-started/environment-setup) - Set up your development environment
2. [Development Basics](/get-started/development-basics) - Quick summary of Solana and Jupiter fundamentals

## Product Suite

Jupiter offers a comprehensive suite of products to power every aspect of your application.

### Core

<Card title="Ultra Swap" icon="bolt">
  Ultra is **Jupiter's Flagship Trading Solution**, the most advanced yet developer-friendly solution for building trading applications on Solana.

  <CardGroup>
    <Card title="Ultra Swap API" icon="code" href="/docs/ultra">
      RPC-less architecture and Jupiter handles all trading optimizations for you.
    </Card>

    <Card title="Plugin" icon="puzzle-piece" href="/tool-kits/plugin">
      Easiest way to integrate full end-to-end Ultra Swap interface.
    </Card>
  </CardGroup>
</Card>

<CardGroup>
  <Card title="Tokens" icon="coin" href="/docs/tokens">
    Comprehensive token information
  </Card>

  <Card title="Price" icon="dollar-sign" href="/docs/price">
    Heuristics-based token pricing
  </Card>
</CardGroup>

### More

<CardGroup>
  <Card title="Lend" icon="piggy-bank" href="/docs/lend">
    Earn, borrow and multiply
  </Card>

  <Card title="Prediction Market" icon="check-to-slot" href="/docs/prediction">
    Predict events
  </Card>

  <Card title="Perpetuals" icon="chart-line" href="/docs/perps">
    Leverage trading
  </Card>

  <Card title="Trigger" icon="bullseye" href="/docs/trigger">
    Limit orders
  </Card>

  <Card title="Recurring" icon="clock-rotate-left" href="/docs/recurring">
    Dollar-cost averaging
  </Card>

  <Card title="Send" icon="paper-plane" href="/docs/send">
    Seamless token transfers
  </Card>

  <Card title="Studio" icon="building-columns" href="/docs/studio">
    Token and LP creation
  </Card>

  <Card title="Lock" icon="lock" href="/docs/lock">
    Token vesting
  </Card>
</CardGroup>

## Programs

All of Jupiter's programs are deployed on the Solana Mainnet only.

<Card title="Core Programs" icon="microchip">
  | Program                        | Address                                                                                                                   |
  | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
  | **Jupiter Swap**               | [`JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`](https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4)   |
  | **Jupiter Referral**           | [`REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3`](https://solscan.io/account/REFER4ZgmyYx9c6He5XfaTMiGfdLwRnkV4RPp9t9iF3)   |
  | **Jupiter Perpetuals**         | [`PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu`](https://solscan.io/account/PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu)   |
  | **Jupiter Doves**              | [`DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e`](https://solscan.io/account/DoVEsk76QybCEHQGzkvYPWLQu9gzNoZZZt3TPiL597e)   |
  | **Jupiter Lend Earn**          | [`jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9`](https://solscan.io/account/jup3YeL8QhtSx1e253b2FDvsMNC87fDrgQZivbrndc9)   |
  | **Jupiter Lend Borrow**        | [`jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi`](https://solscan.io/account/jupr81YtYssSyPt8jbnGuiWon5f6x9TcDEFxYe3Bdzi)   |
  | **Jupiter Lend Earn Rewards**  | [`jup7TthsMgcR9Y3L277b8Eo9uboVSmu1utkuXHNUKar`](https://solscan.io/account/jup7TthsMgcR9Y3L277b8Eo9uboVSmu1utkuXHNUKar)   |
  | **Jupiter Lend Liquidity**     | [`jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC`](https://solscan.io/account/jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC)   |
  | **Jupiter Lend Borrow Oracle** | [`jupnw4B6Eqs7ft6rxpzYLJZYSnrpRgPcr589n5Kv4oc`](https://solscan.io/account/jupnw4B6Eqs7ft6rxpzYLJZYSnrpRgPcr589n5Kv4oc)   |
  | **Jupiter Limit Order V2**     | [`j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X`](https://solscan.io/account/j1o2qRpjcyUwEvwtcfhEQefh773ZgjxcVRry7LDqg5X)   |
  | **Jupiter DCA**                | [`DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M`](https://solscan.io/account/DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M) |
  | **Jupiter Lock**               | [`LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn`](https://solscan.io/account/LocpQgucEQHbqNABEYvBvwoxCPsSbG91A1QaQhQQqjn)   |
  | **Jupiter Governance**         | [`GovaE4iu227srtG2s3tZzB4RmWBzw8sTwrCLZz7kN7rY`](https://solscan.io/account/GovaE4iu227srtG2s3tZzB4RmWBzw8sTwrCLZz7kN7rY) |
  | **Jupiter Voter**              | [`voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj`](https://solscan.io/account/voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj)   |
</Card>


# Build with Jupiter
Source: https://dev.jup.ag/index

Build with the most comprehensive set of APIs, tool kits and technical deep dives across Jupiter's full product suite, from Ultra Swap, Lend, Perps and beyond.

<script />

<div>
  <div />

  <div>
    <div>
      <div>Welcome to Jupiter Developers Platform!</div>
      <div>Build with Jupiter</div>

      <div>
        <div>
          <div>500+</div>
          <div>Integrations</div>
          <div>Trusted by leading protocols</div>
        </div>

        <div>
          <div>\$2T+</div>
          <div>Volume</div>
          <div>Loved by millions of users</div>
        </div>

        <div>
          <div>#1</div>
          <div>Superapp</div>
          <div>Leading DeFi on Solana</div>
        </div>
      </div>
    </div>

    <div>
      <a href="/get-started">
        Get Started

        <svg>
          <path />
        </svg>
      </a>
    </div>
  </div>

  <div>
    <div />
  </div>

  <div>
    <div>Start with Ultra Swap</div>
    <div>Integrate the perfect swap experience into your application</div>

    <div>
      <div>
        <CardGroup>
          <Card title="Why Ultra Swap?">
            <div>
              <div>
                <div />

                <div>The most comprehensive liquidity aggregation, from launchpads, traditional DEXes to the top marketmakers via RFQ.</div>
              </div>

              <div>
                <div />

                <div><a href="https://sandwiched.me/sandwiches">Best performing MEV mitigation<svg><path /></svg></a> with superior trade execution.</div>
              </div>

              <div>
                <div />

                <div>Optimized slippage & priority fee estimations for best price execution.</div>
              </div>

              <div>
                <div />

                <div>Access our optimised RPC stack, transaction sending & polling through a single clientside API call.</div>
              </div>

              <div>
                <div />

                <div>Zero transaction infrastructure required from you.</div>
              </div>
            </div>
          </Card>

          <Card title="Ultra Swap API" icon="bolt" href="/docs/ultra">
            Integrate Ultra Swap via API for full customization and control over the swap experience.
          </Card>

          <Card title="Plugin" icon="rocket-launch" href="/tool-kits/plugin">
            Easiest and most seamless way to embed the full end-to-end Ultra Swap functionality into any website.
          </Card>
        </CardGroup>

        <div>
          <JupiterPluginModalTrigger>
            Try Plugin Live
          </JupiterPluginModalTrigger>
        </div>
      </div>

      <div>
        <div>
          <div>
            <div>
              <div>Try Jupiter Plugin Live</div>
              <div>Experience the full swap functionality embedded directly in our docs</div>
            </div>

            <div>
              <JupiterPluginIntegrated />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div>
    <div />
  </div>

  <div>
    <div>Developer Suite</div>
    <div>Build with Jupiter's comprehensive DeFi and tech stack</div>

    <Card title="Core" icon="diamonds-4">
      Create your own DeFi superapp with Jupiter's core products.

      <Columns>
        <Card title="Ultra Swap" icon="bolt" href="/docs/ultra">
          All-in-one swap solution
        </Card>

        <Card title="Tokens" icon="coin" href="/docs/tokens">
          Comprehensive token information
        </Card>

        <Card title="Price" icon="dollar-sign" href="/docs/price">
          Heuristics-based token pricing
        </Card>

        <Card title="More" icon="arrow-right" href="/get-started#more">
          More APIs
        </Card>
      </Columns>
    </Card>

    <CardGroup>
      <Card title="Tool Kits" icon="toolbox">
        Supercharge your integration by using our easy-to-use tool kits.

        <Columns>
          <Card title="Plugin" href="/tool-kits/plugin" icon="rocket-launch">
            Few lines of code to integrate full end-to-end Ultra Swap.
          </Card>

          <Card title="Wallet Kit" href="/tool-kits/wallet-kit" icon="wallet">
            Swiss army knife adapter for seamless wallet connectivity.
          </Card>

          <Card title="Jupiter Mobile Adapter" href="/tool-kits/wallet-kit/jupiter-mobile-adapter" icon="mobile">
            Onboard Jupiter Mobile users to connect to your website.
          </Card>

          <Card title="Referral Program" href="/tool-kits/referral-program" icon="percent">
            Utilize together with Ultra Swap to earn integrator fees.
          </Card>
        </Columns>
      </Card>

      <Card title="Routing" icon="split">
        Provide your liquidity capabilities into Jupiter's routing engines.

        <Columns>
          <Card title="For DEXes" href="/docs/routing/dex-integration" icon="split">
            Integrate your DEX into Jupiter's Iris routing engine.
          </Card>

          <Card title="For MMs" href="/docs/routing/rfq-integration" icon="arrow-right">
            Integrate your MM into JupiterZ (RFQ) routing engine.
          </Card>
        </Columns>
      </Card>
    </CardGroup>
  </div>

  <div>
    <div />
  </div>

  <div>
    <div>Expansive Ecosystem</div>
    <div>Explore our ecosystem of protocols utilizing Jupiter</div>

    <div>
      <div>
        <div>Integrators</div>
        <div>Protocols powered by Jupiter</div>
      </div>

      <div>
        <div>Routing</div>
        <div>Liquidity venues integrated into Iris</div>
      </div>
    </div>
  </div>

  <div>
    <div />
  </div>

  <div>
    <div>Build Together</div>
    <div>We're here to help you build with Jupiter.</div>

    <CardGroup>
      <Card title="Support" icon="people-group" href="/resources/support">
        Get support our developer community.
      </Card>

      <Card title="Updates" icon="triangle-exclamation" href="/updates">
        Refer to the latest developer updates.
      </Card>

      <Card title="Status" icon="signal" href="https://status.jup.ag">
        Check the status of our services.
      </Card>
    </CardGroup>
  </div>
</div>


# Guidelines
Source: https://dev.jup.ag/legal/index

Important legal documentation and guidelines that governs the use of our services and platform. Please review these documents carefully.

## Legal

* **[SDK & API License Agreement](/legal/sdk-api-license-agreement)** - Governs the use of Jupiter's SDK and API.
* **[Terms of Use](/legal/terms-of-use)** - General terms and conditions for using Jupiter's platform and services.
* **[Privacy Policy](/legal/privacy-policy)** - How Jupiter handles user data and privacy protection.

## Support

If you have questions about any of our legal documents or need clarification on specific terms, please don't hesitate to reach out to us.

* For legal inquiries, contact us at: [legal@jup.ag](mailto:legal@jup.ag)
* For customer and developer support, refer to the [Support](/resources/support) page for more information.

## Labelling

When integrating with Jupiter products, you are advised to correctly label the APIs used.

<Warning>
  **For Swap**

  | API Used                          | Required Label |
  | --------------------------------- | -------------- |
  | Ultra Swap API                    | Ultra          |
  | Metis Swap API                    | Metis          |
  | Self-Hosted Metis Swap API binary | Metis          |
</Warning>


# Privacy Policy
Source: https://dev.jup.ag/legal/privacy-policy

Privacy Policy for Jupiter

<Card title="Privacy Policy File" href="https://github.com/jup-ag/docs/tree/main/static/files/legal" icon="link" />

Jupiter, accessible at: [https://jup.ag](https://jup.ag), one of its main priorities is the privacy of participants who are visitors of [https://jup.ag](https://jup.ag) and its dApps .

Jupiter does it best to collect as minimum Personal Data as possible. This Privacy Policy document contains types of data that are collected, used, and recorded by Jupiter.

The Jupiter Interface backed by Block Raccoon S.A., a company incorporated in Panama, which is the controller for your Personal Data within the scope of this Privacy Policy. Jupiter decides “why” and “how” your Personal Data is processed in connection with the Interface. If you have additional questions or require more information about this Privacy Policy, do not hesitate to contact `privacy@jup.ag`.

This Privacy Policy applies only to the Interface activities and is valid for participants who are visitors to the Interface with regards to the Personal Data that they share and/or which is collected within Jupiter Interface. This Privacy Policy is not applicable to any Personal Data collected offline or via channels other than the Interface. Please read this Privacy Policy carefully to understand our policies and practices regarding your data and how it will be treated by the Interface.

IF YOU DO NOT HAVE THE RIGHT, POWER AND AUTHORITY TO ACT ON BEHALF OF AND BIND THE BUSINESS, ORGANIZATION, OR OTHER ENTITY YOU REPRESENT, PLEASE DO NOT ACCESS OR OTHERWISE USE THE INTERFACE. IF YOU ARE INTERESTED IN HOW WE USE COOKIES AND YOU CAN CHANGE YOUR COOKIE CHOICE, PLEASE SEE SECTION 5 “COOKIES AND AUTOMATICALLY-COLLECTED DATA”

### 1. Changes to this Agreement

If our data processing practices change, we will update this Privacy Policy accordingly to let you know of them upfront and give you a possibility to either provide your consent, object to a particular processing, or undertake other action you are entitled to under the Regulation. Please keep track of any changes we may introduce to this Privacy Policy. Your continued access to and use of the Interface constitutes your awareness of all amendments made to this Privacy Policy as of the date of your accessing and use of the Interface. Therefore, we encourage you to review this Privacy Policy regularly as you shall be bound by it. If, for some reason, you are not satisfied with our personal data processing practices, your immediate recourse is to stop using the Interface. You do not have to inform us of this decision unless you intend to exercise some of the data protection rights stipulated by GDPR and defined below in this Privacy Policy.

### 2. Eligibility

Age. By accessing our using the Interface, you represent and warrant that you are at least eighteen (18) years of age. If you are under the age of eighteen (18), you may not, under any circumstances or for any reason, use the Interface. Please report to us any instances involving the use of the Interface by individuals under the age of 18, should they come to your knowledge.

### 3. Applicability

This Privacy Policy applies to all your interactions with us via the Interface and your interactions with us in connection therewith.

Below are the categories of our processors used on the Interface due to an internal data processing roadmap providing a brief grasp of our data processing activities with regard to each piece of the Personal Data we may collect through the Interface, as well as your place in every data processing event. It can be requested at `[privacy@jup.ag]`. Below are the categories of our processors which can access and process your Personal Data through the Interface:

1. Technical maintenance vendors;
2. Project and team management vendors;
3. Communication vendors;
4. Analytics, statistics, performance, marketing vendors.

### 4. Data processing in connection with the interface

**Types of Data Collected**

To the maximum extent possible, Jupiter tries to collect as minimum Personal Data from you as possible. Personal Data we collect:

* IP address, MAC address, log files, domain server, data related to usage, performance, website security, traffic patterns, location information, browser and device information – only when you are using the Interface;
* Wallet addresses (public blockchain addresses), transaction, and balance information (blockchain data) that is accessible when interacting with the Interface; We use public Blockchain addresses to identify a user’s journey through our product. We group and analyze these user journeys collectively in order to improve our product user experience. We do not use this data for any purpose at an individual user level. The legal basis for this processing is our legitimate interests, such as monitoring and improving the Interface, the proper protection of the Interface against risks, and partly the contract performance basis to provide you the Interface. Note that we are not responsible for your use of any of the blockchain and your data processed in these decentralized and permissionless networks;
* Log Files. Jupiter follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and this kind of Personal Data may also be collected as a part of hosting services' analytics. The data collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These kinds of data may be linked to data that is personally identifiable. The purpose of the data collection and processing is for analyzing trends, administering the website, tracking users' movement on the website, and gathering demographic information;

Jupiter may also engage third-parties advertising platforms that are triggered only when their technical features (so-called “pixels”) are enabled through the Interface. The mentioned third-parties advertising platforms may collect Personal Data of Interface's visitors only with the purpose to optimize their advertising possibilities through their platforms, target you with their advertisements, and possibly share your data with other advertising platforms and agencies for further use. Jupiter may engage with the mentioned Personal Data of Interfaces visitors.

In no event, are we going to ask you to share your private keys or wallet seed. Never trust anyone or any website that asks you to enter your private keys or wallet seed.

**How and Why we use your Personal Data**

We may use your Personal Data listed above only for:

* Our internal and operational purposes, when: ensuring security, identifying irregular website behavior, preventing fraudulent activity, and improving security at all possible levels;
* Assessing and improving the performance of the Interface;
* Analyzing our website visitors’ actions to improve our Interface (section “Cookies and Automatically Collected Data”);
* Analyzing the Interface behavior, including via: Google Analytics (please refer to Google's Analytics Policy for more information);
* Find and prevent fraud.

To clear any doubts, we may use Personal Data described above or any other Personal Data:

* on the basis of contract performance or necessity to enter into a contract (where the Personal Data is required for us to perform our undertakings and obligations in accordance with a contract we are entering into when you use our services, or where we are at the negotiations phase);
* on the basis of our or our processors’ legitimate interests to protect the Interface, prevent any malicious and harmful activities to the Interface, maintain our technical systems healthily and secure, improve services and products by using aggregate statistics;
* to respond to legal requests of authorities, provide information upon court orders and judgments, or if we have a good-faith belief that such disclosure is necessary in order to comply with official investigations or legal proceedings initiated by governmental and/or law enforcement officials, or private parties, including but not limited to: in response to subpoenas, search warrants or court orders, and including other similar statutory obligations we or our processors are subjected to;
* on the basis of your consent; and
* on other legal bases set forth in the personal data protection laws.

**Disclosure of Data**

In continuation of legal bases for collecting and processing the Personal Data, We may disclose any Personal Data about you:

* in connection with a merger, division, restructuring, or other association change; or
* to our subsidiaries or affiliates (if any) only if necessary for operational purposes. If we must disclose any of your Personal Data in order to comply with official investigations or legal proceedings initiated by governmental and/or law enforcement officials, we may not be able to ensure that such recipients of your Personal Data will maintain the privacy or security of your Personal Data.

**Data Retention Period**

Jupiter maintains Personal Data exclusively within the time needed to follow prescribed herein legal purposes. When we no longer need Personal Data, the limitation period for storage of such Personal Data has expired, you have withdrawn your consent or objected to our or our processors’ legitimate interests, we securely delete or destroy it unless the statutory requirements we, our processors or other controllers are subjected to stipulate otherwise. Aggregated data, which cannot directly identify a device/browser (or individual) and is used for purposes of reporting and analysis, is maintained for as long as commercially necessary till you object to the processing of such data or withdraw your consent.

Sometimes legal requirements oblige us to retain certain data, for specific purposes, for an extended period of time. Reasons we might retain some data for longer periods of time include:

* Security, fraud & abuse prevention;
* Financial monitoring and record-keeping;
* Complying with legal or regulatory requirements;
* Ensuring the continuity of your interaction with the Interface.

**Your Inquiries**

You may contact us by email at the following email address: `[privacy@jup.ag]`; We use the data that you provide in an email to us, which you may give voluntarily, only in order to answer your question or to reply to your email in the best possible manner.

### 5. Cookies and Automatically Collected Data

As you navigate through and interact with our Interface, we may ask your consent to use cookies, which are small files placed on the hard drive/browser of your computer or mobile device, and web beacons, which are small electronic files located on pages of the Interface, to collect certain information about devices you use, browsing actions, and patterns.

The data automatically collected from cookies and web beacons may include information about your web browser (such as browser type and browser language) and details of your visits to the Interface, including traffic data, location data and logs, page views, length of visit, and website navigation paths as well as information about your device and internet connection, including your IP address and how you interact with the Interface. We collect this data in order to help us improve the Interface and interaction with it.

The information we collect automatically may also include statistical and performance information arising from your use of the Interface. This type of data will only be used by us in an aggregated and pseudonymized manner.

You can choose to disable cookies through your individual browser options. To get more detailed information about cookie management with specific web browsers, please find it on the browsers' respective websites:

* For Google Chrome browser please refer to these instructions: [https://support.google.com/accounts/answer/32050?co=GENIE.Platform%3DDesktop\&hl=en](https://support.google.com/accounts/answer/32050?co=GENIE.Platform%3DDesktop\&hl=en);
* For Firefox browser please look up here: [https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox](https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox)
* For Safari browser please visit: [https://support.apple.com/ru-ru/guide/safari/sfri11471/mac](https://support.apple.com/ru-ru/guide/safari/sfri11471/mac)
* For Internet Explorer browser please refer to: [https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d](https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d)

### 6. Your rights under GDPR

Under certain circumstances, you may have a number of privacy rights concerning the use, storage, and processing of your Personal Data (e.g., the right to delete your data). Here is a list of privacy rights:

* right to be informed - we are publishing this Privacy Policy to keep you informed as to what we do with your Personal Data. You can ask us for Personal Data regarding you that we keep at any time. This information concerns, among other things, the data categories we process, for what purposes we process them, the origin of the data if we did not acquire them directly from you and, if applicable, the recipients to who we have sent your data.
* right of access – You may ask us whether we process your Personal Data and you have the right to request a copy of the data we hold about you.
* right of rectification – You have the right to correct inaccurate or incomplete data about you.
* right to be forgotten – You can ask for the Personal Data that we hold about you to be erased from our system and we will comply with this request unless we have a legitimate reason, legal requirement, and other statutory basis not to do so. Even if we can delete (erase) the Personal Data subject to our active (ongoing) processing activities and cease its processing, we will nevertheless retain this particular Personal Data in our backup and archive storages to fulfill our statutory and other requirements.
* right to restriction of processing – where certain conditions apply, you can ask us to ‘block’ the processing of your Personal Data.
* right to data portability – You have the right to have the data we hold about you transferred to another organization and to receive Personal Data in a structured, commonly used format. Please apply to: `[privacy@jup.ag]` to find out whether we currently support the provision of the portable file containing Personal Data we process about you.
* right to object - You can object to the processing of your data by applying to: `[privacy@jup.ag]` at any time for reasons that arise from your special situation provided the data processing is based on our legitimate interest or that of a third party, or where we carry out profiling, use machine learning or automated decision-making algorithms. In this case, we will no longer process your Personal Data. The latter does not apply if we are able to prove there are compelling, defensible reasons for the processing that outweigh your interests or we require your data to assert, exercise, or defend legal claims.
* right to withdraw consent - withdraw the consent you gave us with regard to the processing of your Personal Data for certain purposes.
* right to complain - we take your rights very seriously. However, if you are of the opinion that we have not dealt with your complaints adequately, you have the right to submit a complaint to the data privacy protection authorities responsible. You can send your complaints to the EEA supervisory authority of your country of residence.

Please email: `[privacy@jup.ag]` with any questions about exercising any of the above rights. If You wish to learn more about the GDPR and Your rights, the Information Commissioner’s Office website is a reliable source.

### 7. Privacy of children

Our Interface is not directed to collect any data from people under the age of 18. We do not knowingly allow anyone under 18 years old to submit any data to our Interface. If you believe your child may have provided us with their data, you can contact us using the information in this Policy and we will delete the data from our Interface.

### 8. Transfer of Personal Data

Transfers to third countries shall be made subject to appropriate safeguards, namely Standard Contractual Clauses adopted by the supervisory authority and approved by the Commission. Copy of the foregoing appropriate safeguards may be obtained by you upon a prior written request sent. We may instruct you on further steps to be taken with the purpose of obtaining such a copy, including your obligation to assume confidentiality commitments in connection with being disclosed the Jupiter proprietary and personal information of third parties as well as terms of their relationships with Jupiter.

Keep in mind that the use of the Interface based on public blockchains is intended to immutably record transactions across wide networks of computer systems. Many blockchains are open to forensic analysis which can lead to deanonymization and the unintentional revelation of Personal Data, in particular when blockchain data is combined with other data. Because blockchains are decentralized or third-party networks that are not controlled or operated by us, we are not able to erase, modify, or alter Personal Data from such networks.

### 9. Data Integrity & Security of Processing

We take data security very seriously. We work hard to protect the Personal Data you provide us from loss, misuse, or unauthorized access. We utilize a variety of safeguards such as encryption, digital and physical access controls, non-disclosure agreements, and other technical and organizational measures to protect the Personal Data submitted to us, both during transmission and once it is at rest.

Please note that no electronic transmission, storage, or processing of Personal Data can be entirely secure. We cannot guarantee that the security measures we have in place to safeguard Personal Data will never be defeated or fail, or that those measures will always be sufficient or effective. Therefore, although we are committed to protecting your privacy, we do not promise, and you should not expect that your Personal Data will always remain private or secure.

### 10. Supervisory authority oversight

If you are a data subject whose data we process, you may also have the right to lodge a complaint with a data protection regulator in one or more of the European Union member states. Here you can find a list of data protection authorities in Europe: ​​[https://edpb.europa.eu/about-edpb/about-edpb/members\_en](https://edpb.europa.eu/about-edpb/about-edpb/members_en)


# SDK & API License Agreement
Source: https://dev.jup.ag/legal/sdk-api-license-agreement

Jupiter API & SDK License Agreement

<Card title="SDK & API License Agreement File" href="https://github.com/jup-ag/docs/tree/main/static/files/legal" icon="link" />

**IMPORTANT**: This Jupiter API & SDK License Agreement ("Agreement") govern your access and use of the Jupiter Application Programming Interface ("API") and a Software Development Kit ("SDK") available through [https://portal.jup.ag](https://portal.jup.ag) (collectively the "Service"). If you do not agree to be bound by the terms and conditions of this Agreement, do not use the Service.

This Agreement is effective as of the date you first access, download, copy or otherwise use the API or SDK ("Effective Date"), and constitutes the entire agreement between you and us. This Agreement shall continue until terminated either by us or by you. Even after termination of this Agreement, certain provisions will survive, as discussed herein.

This Agreement also incorporates Jupiter's [Terms of Service](/legal/terms-of-use) and [Privacy Policy](/legal/privacy-policy) which terms shall also govern your use of the Service. Our Privacy Policy, in particular explains how, to the extent that we do, your data may be collected. In the event of any conflict between this Agreement and the Terms of Service or Privacy Policy, the provisions of this Agreement shall prevail.

YOU ARE ENTERING A LEGALLY BINDING CONTRACT: BY COPYING, DOWNLOADING, OR OTHERWISE USING THE JUPITER API OR SDK YOU ARE EXPRESSLY AGREEING TO BE BOUND BY ALL TERMS OF THIS AGREEMENT. IF YOU DO NOT AGREE TO ALL OF THE TERMS OF THIS AGREEMENT, YOU ARE NOT AUTHORIZED TO COPY, DOWNLOAD, INSTALL OR OTHERWISE USE THE JUPITER API or SDK.

The API and SDK are protected by copyright laws and international copyright treaties, as well as other intellectual property laws and treaties. The API and SDK is licensed to you, and its use is subject to the terms of this Agreement.

**1. Definitions​**

1.1 **"Application Programming Interfaces"** or **"API"** or **"Jupiter API"** means the back-end smart routing algorithm which facilitates the user's efficient swapping of digital assets at a variety of third party trading venues, which may include object code, software libraries, software tools, sample source code, published specifications and Documentation. Jupiter API shall include any future, updated or otherwise modified version(s) thereof furnished by Jupiter (in its sole discretion) to Licensee.

1.2 **"Software Development Kit"** or **"SDK"** or **"Jupiter SDK"** means the ancillary tools and resources that allow the user to utilise or integrate the API. Jupiter SDK shall include any future, updated or otherwise modified version(s) thereof furnished by Jupiter (in its sole discretion) to Licensee.

1.3 **"Documentation"** includes, but is not limited to programmer guides, manuals, materials, and information appropriate or necessary for use in connection with the API, and in particular shall include the Integrator Guidelines available at [https://dev.jup.ag/legal](https://dev.jup.ag/legal).

**2. Grant of License​**

2.1 Subject to the terms of this Agreement, Jupiter hereby grants Licensee a limited, non-exclusive, fee-bearing, non-transferable, non-sublicensable licence to use the API or SDK during the term of this Agreement solely for the purpose of Licensee's internal development efforts to develop products or services integrating the API and/or SDK in any manner, including without limitation for any informational, comparison, or testing purpose (the **Licensee's Product**).

2.2 Licensee shall have no right to distribute, license (whether or not through multiple tiers) or otherwise transfer the API or SDK to any third party.

2.3 There are several formulations and versions of the API routing engine, which comprise either (a) the Jupiter Ultra Swap API, and (b) the Metis Swap API. Notwithstanding any of the provisions herein, where the Licensee uses the API or SDK (including without limitation for any informational, comparison, or testing purpose), you unconditionally and irrevocably undertake to correctly and accurately display prominently/label/name/characterise the specific API used, which must be made visible to end users of the Licensee’s Product. For illustrative purposes, if the Licensee uses Jupiter Ultra Swap, it would be mandatory to prominently state “Jupiter Ultra”; if the Licensee uses anything available API other than Jupiter Ultra Swap, it would be mandatory to prominently state “Metis”. The Licensee accepts that it is misleading and unethical to wrongly display/label/name/characterise the API and any output of the API as “Jupiter” simpliciter or otherwise suggest it is the same product as the service available at [https://jup.ag/](https://jup.ag/), or represent that another API routing engine is utilised. Without prejudice to clause 11 below, in the event of your breach of this clause 2.3, you agree to indemnify us to the extent any loss or damages are suffered by, as a result of, or in connection with, your breach of this clause 2.3, including but not limited to pure and/or consequential economic loss.

2.4 In case of potential other API or SDK use that is not prescribed by this Agreement, please write to [info@jup.ag](mailto:info@jup.ag) to seek written consent.

2.5 Representations. Both Parties to this Agreement are duly organized and validly existing in good standing with all requisite power and authority to enter into this Agreement and conduct its business as is now being conducted. The Licensee is not identified on, or engages in any transactions with any party listed on, any sanctions list maintained by the U.S. Department of the Treasury’s Office of Foreign Asset Control (“OFAC”).

2.6 By providing access to the API and the SDK, Jupiter is solely providing a back-end technical service to the Licensee which allows the Licensee to provide swap-related services to end users of the Licensee's products or services. Jupiter is not a party to any agreement for swap-related services between the Licensee, its end users, any counterparty or trading venue where swaps are performed, nor any trustee, custodian, bailee, manager, administrator or service provider in respect of any digital asset or otherwise.

2.7 Independent Contractor Relationship. The relationship between the Parties is that of independent contractors. Nothing in this Agreement shall be construed to create anything like the relationship of an employer and employee, joint venture, partnership, or joint association.

**3. Other Rights and Limitations​**

3.1 Copies. Licensee may copy the API or SDK only as necessary for the purpose of the licence hereunder.

3.2 Except as expressly authorised under this Agreement or by Jupiter in writing, the Licensee agrees it shall not (and shall not permit or authorise any other person to):

a. use the API or SDK in any manner that is not expressly authorised by this Agreement;

b. use the API or SDK or develop or use the Licensee's Product (i) for any illegal, unauthorised or otherwise improper purposes or (ii) in any manner which would violate this Agreement or the Documentation, breach any laws, regulations, rules or orders (including those relating to virtual assets, intellectual property, data privacy, data transfer, international communications or the export of technical or personal data) or violate the rights of third parties (including rights of privacy or publicity);

c. remove any legal, copyright, trademark or other proprietary rights notices contained in or on materials it receives or is given access to pursuant to this Agreement, including the API, the SDK and the Documentation;

d. sell, lease, share, transfer or sublicense the API, SDK or any content obtained through the API, directly or indirectly, to any third party;

e. use the API or SDK in a manner that, as determined by Jupiter in its sole discretion, exceeds reasonable request volume, constitutes excessive or abusive usage, or otherwise fails to comply or is inconsistent with any part of the Documentation;

f. access the API or SDK for competitive analysis or disseminate performance information (including uptime, response time and/or benchmarks) relating to the API;

g. use the API in conjunction with, or combine content from the API with, content obtained through scraping or any other means outside the API;

h. (i) interfere with, disrupt, degrade, impair, overburden or compromise the integrity of the API, Jupiter's systems or any networks connected to the API or Jupiter's systems (including by probing, scanning or testing their vulnerability), (ii) disobey any requirements, procedures, policies or regulations of networks connected to the API or Jupiter's systems, (iii) attempt to gain unauthorised access to the API, Jupiter's systems or any information not permitted by this Agreement or circumvent any access or usage limits imposed by Jupiter or (iv) transmit through the Licensee's Product or the use of the API or SDK any (A) content that is illegal, tortious, defamatory, vulgar, obscene, racist, ethnically insensitive, or invasive of another person's privacy, (B) content that promotes illegal or harmful activity, or gambling or adult content, (C) viruses, worms, defects, Trojan horses, or any other malicious programs or code or items of a destructive nature or (D) materials that could harm minors in any way;

i. copy, adapt, reformat, reverse-engineer, disassemble, decompile, download, translate or otherwise modify or create derivative works of the API, the SDK or the Documentation, Jupiter's website, or any of Jupiter's other content, products or services, through automated or other means;

j. interfere with Jupiter's business practices or the way in which it licenses or distributes the API or SDK;

k. make any representations, warranties or commitments (i) regarding the API or SDK or (ii) on behalf of Jupiter; or

l. take any action that would subject the API or SDK to any third-party terms, including without limitation any open source software licence terms.

3.3 Without prejudice of the generality of the foregoing, where the Licensee's Product is competitive (whether wholly or partially) with the API or the Service, Jupiter shall have the right to access the Licensee's Product and/or request the Licensee for information regarding the Licensee's Product. Jupiter shall be granted a non-exclusive, royalty-free, non-transferable, non-sublicensable licence to use the Licensee's Product (including without limitation any application programming interface, software development kit, logos, brand information, technical information or data or information in connection with any aspect of the Licensee's Product) for any purpose.

3.4 Third Party Software. Licensee acknowledges that effective utilization of the API and SDK may require the use of a development tool, compiler and other software and technology of third parties ("Third Party Software"). Licensee is solely responsible for procuring such Third-Party Software and technology and the necessary licenses for the use thereof. Jupiter makes no representation or warranty concerning Third Party Software and shall have no obligation or liability with respect to Third Party Software.

3.5 No right is granted to Licensee to sublicense its rights hereunder. All rights not expressly granted are reserved by Jupiter and, except as expressly set forth herein, no license is granted by Jupiter under this Agreement directly, by implication, estoppel or otherwise, under any patent, copyright, trade secret or trademark or other intellectual property rights of Jupiter. Nothing herein shall be deemed to authorize Licensee to use Jupiter\`s trademarks or trade names in Licensee's advertising, marketing, promotional, sales or related materials. Jupiter reserves all rights not otherwise expressly granted in this Agreement.

3.6 No assertion by Licensee. Licensee agrees not to assert any patent rights related to the API/SDK or applications developed using the API/SDK against Jupiter, Jupiter's participants, or other licensees of the API/SDK for making, using, selling, offering for sale, or importing any products or technology developed using the API/SDK.

3.7 Jupiter may from time to time provide updates or upgrades to the API or SDK. Any such updates and upgrades will be performed according to Jupiter's then-current operational policies, which may include automatic updating or upgrading of API or SDK currently in use at that time. Where the Licensee fails to accept such updates or upgrades, Jupiter shall be entitled to withhold access to the API, SDK and/or Service, and the same shall not constitute any breach of the terms of this Agreement.

**4. Intellectual Property and proprietary rights**

4.1 As between Jupiter and Licensee, Jupiter and/or its licensors shall own and retain all proprietary rights, including all patent, copyright, trade secret, trademark and other intellectual property rights, in and to the API and SDK and any corrections, bug fixes, enhancements, updates, improvements, or modifications thereto and (to the extent such rights accrue to the Licensee), the Licensee hereby irrevocably transfers, conveys and assigns to Jupiter all of its right, title, and interest therein.

4.2 Jupiter shall have the exclusive right to apply for or register any patents, mask work rights, copyrights, and such other proprietary protections with respect thereto.

4.3 The Licensee acknowledges that the license granted under this Agreement does not provide Licensee with title or ownership to the API or SDK, but only a right of limited use under the terms and conditions of this Agreement.

4.4 The Parties acknowledge that Jupiter does not store, send, or receive digital assets. Digital assets exist only by virtue of the ownership record maintained on the relevant blockchain network. Any creation or transfer of title that might occur in respect of any digital asset occurs on the relevant blockchain network (on the relevant contractual terms applicable to such creation and/or transfer) and is performed by the Licensee's Product, and Jupiter does not have any role or responsibility in such transactions. Jupiter cannot guarantee that the Licensee's Product, or any party can effect the transfer of such title or right to any digital asset. Accordingly, Jupiter cannot provide any guarantee, warranty or assurance regarding the authenticity, uniqueness, originality, quality, marketability, legality or value of any digital assets utilised in connection with the API and the Services.

**5. No Obligation to Support​**

5.1 Subject to payment of fees as described herein, Jupiter would issue to the Licensee certain unique API keys, tokens, passwords and/or other credentials (collectively, **"Keys"**), for accessing the API and/or SDK and managing the Licensee's access to the API. The Licensee may only access the API with the Keys issued to the Licensee by Jupiter. The Licensee acknowledges that access to the API may not always be available. The Licensee may not sell, transfer, sublicense or otherwise disclose its Keys to any other party or use them for any other purpose other than that expressly permitted by Jupiter. The Licensee is responsible for maintaining the secrecy and security of the Keys. The Licensee is fully responsible for all activities that occur using the Keys, regardless of whether such activities are undertaken by the Licensee or a third party. The Licensee is responsible for maintaining up-to-date and accurate information (including a current email address and other required contact information) for the Licensee's access to the API and SDK. Jupiter may discontinue the Licensee's access to the API and SDK if such contact information is not up-to-date and/or the Licensee does not respond to communications directed to such coordinates.

5.2 Jupiter makes no guarantees with respect to the performance, availability or uptime of the API or the SDK. Jupiter may conduct maintenance on or stop providing any of the API or the SDK at any time with or without written notice to the Licensee. In addition, Jupiter may change the method of access to the API, SDK and Documentation at any time.

5.3 Jupiter does not guarantee any support for the API or SDK under this Agreement. Nothing herein shall be construed to require Jupiter to provide consultations, support services or updates, upgrades, bug fixes or modifications to the API or SDK. In the event of degradation or instability of Jupiter's system or an emergency, Jupiter may, in its sole discretion, suspend access to the API and/or SDK.

5.4 Jupiter reserves the right to change the method of access to the API or SDK at any time to ensure the safety and security of its environment. In the event of degradation or instability of Jupiter\`s systems or in an emergency, you acknowledge and agree that Jupiter may, in its sole and absolute discretion, temporarily suspend your access to the API or SDK in order to minimize threats to and protect the operational stability and security of the Jupiter system.

**6. Fees & Payment​**

6.1 Jupiter shall charge a subscription fee for usage of the Jupiter API and/or SDK. This may be a fixed fee, infrastructure fee and/or a variable fee based on revenue earned by the Licensee in respect of the Licensee's Product.

6.2 The details of the level of fees charged shall be notified to you via the API portal at [https://portal.jup.ag](https://portal.jup.ag). By accessing, downloading, copying or otherwise using the API or SDK, you shall be deemed to have consented to said fees.

6.3 The Fees may be reviewed by Jupiter at any time commencing from three (3) months after the Effective Date. Any updated fees shall be notified to you via the API portal and your continued usage of the API or SDK shall be deemed consent to such updated fees.

**7. Licensee's Obligations**

7.1 The Licensee agrees to report to Jupiter any errors or difficulties discovered related to the API or SDK, and the characteristic conditions and symptoms of such errors and difficulties.

7.2 The Licensee shall perform such sanity testing, cybersecurity testing or other technical checks in respect of the API or SDK as may be reasonably requested by Licensor from time to time.

7.3 The Licensee shall ensure that the offering/provision of the Licensee's Product complies with all applicable laws and regulations, including without limitation all consumer protection, Know Your Customer (KYC) or Anti-money Laundering (AML) due diligence laws, sanctions, anti-money laundering or terrorist financing laws, securities laws, payment provider laws, or virtual assets regulations. Without prejudice to the generality of the foregoing, the Licensee shall (a) obtain and maintain in force (or as applicable procure the obtaining and maintenance in force of) all necessary licenses, permissions, authorisations, consents and permits which may be necessary or desirable for the offering/provision of the Licensee's Product and (b) perform transaction screening and monitoring of all digital wallets interacting with the Client's Product, including blocking of sanctioned, blacklisted, prohibited, restricted, flagged, illicit, suspicious or crime-associated digital wallets, in accordance with prevailing best market practice. The Licensee shall be solely responsible for any failure to comply with the foregoing.

7.4 The Licensee acknowledges and agrees that all reporting, information gathering and other obligations under applicable Know Your Customer (KYC) or Anti-money Laundering (AML) due diligence laws, sanctions, anti-money laundering or terrorist financing laws, securities laws, payment provider laws, or virtual assets regulations with respect to the Licensee's end-users are the responsibility of the Licensee; and Jupiter shall not be responsible or have any liability for any of the foregoing. The Licensee agrees to provide such information to Jupiter if reasonably requested by Jupiter.

7.5 Without prejudice to the foregoing, upon written request from Jupiter, the Licensee shall use all efforts to block any specific digital wallet or address from accessing the Licensee's Product and/or the API integration.

7.6 The Licensee agrees to immediately notify Jupiter if (i) the Licensee becomes aware of any security event, including any cybersecurity breach, attack or economic exploit relating to the Licensee's Product or (ii) the Licensee's Product, API, SDK or the Service becomes subject to any legal or regulatory investigation or action.

7.7 The Licensee shall be responsible for all customer service for all its products and services (including the Licensee's Product).

**8. Confidentiality​ and Publicity**

8.1 The API and SDK contains valuable proprietary information and trade secrets of Jupiter and its suppliers that remain the property of Jupiter. You shall protect the confidentiality of, and avoid disclosure and unauthorized use of, the API or SDK.

8.2 Without prejudice to the generality of the foregoing, you agree not to disparage Jupiter, any of its affiliates, or any of their directors, shareholders, employees, servants, contractors, or agents in any manner, or otherwise make any false, misleading or negative statements to any party about Jupiter or any of its affiliates, the Service (or any output of the Service), or any other product(s) or service(s) of Jupiter or any of its affiliates.

8.3 Jupiter may disclose and publicise the existence of the business relationship between Jupiter and you on its website and in promotional and marketing materials without requiring any further consent from you.

8.4 Subject to clause 2.3 above, you shall ensure that the Licensee's Product shall prominently display to end users of such product or service the message "Powered by Jupiter".

**9. No Warranty​**

9.1 The API, SDK, and Documentation are provided "AS-IS" without any warranty whatsoever. To the full extent allowed by law, the foregoing warranties and remedies are exclusive and are in lieu of all other warranties, terms, or conditions, express or implied, either in fact or by operation of law, statutory or otherwise, including warranties, terms, or conditions of merchantability, fitness for a particular purpose, satisfactory quality, correspondence with description, and non-infringement, all of which are expressly disclaimed.

9.2 No advice or information, whether oral or written, obtained by you from Jupiter or through or from the API/SDK shall create any warranty not expressly stated in this agreement. Jupiter does not warrant that the API, SDK and Documentation are suitable for Licensee's use, that the API, SDK or Documentation are without defect or error, that operation will be uninterrupted, or that defects will be corrected. Further, Jupiter makes no warranty regarding the results of the use of the API, SDK, and Documentation.

**10. Limitation of Liability​**

JUPITER WILL NOT BE LIABLE FOR ANY DAMAGES OF ANY KIND ARISING OUT OF OR RELATING TO THE USE OR THE INABILITY TO USE THE API, SDK AND ITS USE OR THE INABILITY TO USE WITH ANY THIRD PARTY SOFTWARE, ITS CONTENT OR FUNCTIONALITY, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF BUSINESS PROFITS OR REVENUE; BUSINESS INTERRUPTION OR WORK STOPPAGE; COMPUTER FAILURE OR MALFUNCTION; LOSS OF BUSINESS INFORMATION, DATA OR DATA USE; LOSS OF GOODWILL; DAMAGES CAUSED BY OR RELATED TO ERRORS, OMISSIONS, INTERRUPTIONS, DEFECTS, DELAY IN OPERATION OR TRANSMISSION, COMPUTER VIRUS, FAILURE TO CONNECT, NETWORK CHARGES, AND ALL OTHER DIRECT, INDIRECT, SPECIAL, INCIDENTAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES EVEN IF JUPITER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION OF INCIDENTAL OR CONSEQUENTIAL DAMAGES, SO THE ABOVE EXCLUSIONS OR LIMITATIONS MAY NOT APPLY TO YOU. NOTWITHSTANDING THE FOREGOING, JUPITER TOTAL LIABILITY TO LICENSEE FOR ALL LOSSES, DAMAGES, CAUSES OF ACTION, INCLUDING BUT NOT LIMITED TO THOSE BASED ON CONTRACT, TORT, OR OTHERWISE, ARISING OUT OF YOUR USE OF THE API/SDK AND/OR INTELLECTUAL PROPERTY ON THIS TECHNOLOGY PLATFORM OR API/SDK, OR ANY OTHER PROVISION OF THIS AGREEMENT, SHALL NOT EXCEED THE AMOUNT OF 100 USD. THE FOREGOING LIMITATIONS, EXCLUSIONS, AND DISCLAIMERS SHALL APPLY TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, EVEN IF ANY REMEDY FAILS ITS ESSENTIAL PURPOSE.

**11. Indemnity​**

You agree to indemnify and hold harmless Jupiter and its contributors, subsidiaries, affiliates, officers, agents, Intellectual Property service providers, co-branders, customers, suppliers or other partners, and employees, from any loss, claim or demand, including reasonable attorneys' fees, made by any third party due to or arising out of your negligence, error, omissions, or failure to perform relating to your use of the API/SDK, your connection to the API, or your violation of the Agreement.

**12. Disclaimers**

12.1 UNLESS SEPARATELY STATED IN A WRITTEN EXPRESS LIMITED WARRANTY, THE API AND SDK PROVIDED BY JUPITER IS PROVIDED "AS IS" AND ON AN "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND FROM JUPITER, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT POSSIBLE PURSUANT TO APPLICABLE LAW, JUPITER DISCLAIMS ALL WARRANTIES EXPRESS, IMPLIED, OR STATUTORY, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, SATISFACTORY QUALITY OR WORKMANSHIP LIKE EFFORT, FITNESS FOR A PARTICULAR PURPOSE, RELIABILITY OR AVAILABILITY, ACCURACY, LACK OF VIRUSES, QUIET ENJOYMENT, NON- INFRINGEMENT OF THIRD-PARTY RIGHTS OR OTHER VIOLATIONS OF RIGHTS. SOME JURISDICTIONS DO NOT ALLOW EXCLUSIONS OR LIMITATIONS OF IMPLIED WARRANTIES, SO THE ABOVE EXCLUSIONS OR LIMITATIONS MAY NOT APPLY TO YOU. NO ADVICE OR INFORMATION, WHETHER ORAL OR WRITTEN, OBTAINED BY YOU FROM JUPITER OR ITS AFFILIATES SHALL BE DEEMED TO ALTER THIS DISCLAIMER BY JUPITER OF WARRANTY REGARDING THE API OR SDK OR THE AGREEMENT, OR TO CREATE ANY WARRANTY OF ANY SORT FROM JUPITER.

12.2 NEITHER JUPITER NOR THE API PROVIDES ANY DIGITAL ASSET EXCHANGE OR PORTFOLIO/FUND MANAGEMENT SERVICE. WHERE THE LICENSEE OR ANY END USER OF THE LICENSEE'S PRODUCT MAKES THE DECISION TO TRANSACT UTILISING THE API OR THE SERVICE, THEN SUCH DECISIONS AND TRANSACTIONS AND ANY CONSEQUENCES FLOWING THEREFROM ARE SUCH TRANSACTING PARTY'S SOLE RESPONSIBILITY.

12.3 THE API FUNCTIONS SOLELY AS A BACK-END SUPPORTING TECHNICAL SERVICE FOR A SMART ROUTING ALGORITHM FOR DIGITAL ASSET SWAPS ONLY; IN NO CIRCUMSTANCES SHALL JUPITER, THE API OR THE SDK BE CONSTRUED AS A DIGITAL ASSET EXCHANGE, BROKER, DEALER, FUND MANAGER, FINANCIAL INSTITUTION, EXCHANGE, CUSTODIAN, ROBO-ADVISOR, INTERMEDIARY, OR CREDITOR.

12.4 THE API DOES NOT FACILITATE OR ARRANGE DIGITAL ASSET TRANSACTIONS BETWEEN COUNTERPARTIES, INCLUDING WITH RESPECT TO ANY TRANSACTIONS THAT OCCUR IN CONNECTION WITH ANY DECENTRALISED EXCHANGE, LIQUIDITY POOL OR OTHER CENTRALISED OR DECENTALISED FINANCE PRODUCT / FACILITY, WHICH TRANSACTIONS OCCUR ON SUCH PLATFORM, PROTOCOL AND/OR THE RELEVANT BLOCKCHAIN NETWORK. JUPITER IS NOT A COUNTERPARTY TO ANY DIGITAL ASSET TRANSACTION FACILITATED BY THE API OR THE LICENSEE'S PRODUCT.

12.5 There may be various vulnerabilities, failures or abnormal behaviour of software relating to digital assets (e.g., token contract, wallet, smart contract), or relating to the relevant blockchain network, and Jupiter cannot be responsible for any losses in connection with the same, including without limitation any losses in connection with (i) user error, such as forgotten passwords or incorrectly construed smart contracts or other transactions, (ii) server failure or data loss, (iii) corrupted wallet files, or (iv) unauthorised access or activities by third parties, including but not limited to the use of viruses, phishing, brute-forcing or other means of attack against the API or SDK, the relevant blockchain network, or the Licensee's or any end user's digital wallet.

12.6 Jupiter disclaims any responsibility for any disclosure of information or any other practices of any third-party API provider. Jupiter expressly disclaims any warranty regarding whether your personal information is captured by any third-party API provider or the use to which such personal information may be put by such third-party API provider.

**13. Term and Termination​**

13.1 The effective date of this Agreement is the start of use of the API or SDK by the Licensee. There shall be a minimum term of 30 days for usage of the API to be paid for in advance (or such other minimum term as notified to you via the API portal at [https://portal.jup.ag](https://portal.jup.ag)).

13.2 This Agreement will terminate automatically if you fail to comply with any of the terms and conditions of this Agreement and you will be liable to Jupiter and its suppliers for damages or losses caused by your non-compliance. The waiver by Jupiter of a specific breach or default shall not constitute the waiver of any subsequent breach or default.

13.3 Either party shall have the right to terminate the Agreement (for any reason), by written notice to the other party and refunding a pro-rata portion of any unutilised fee paid (in the case of termination by Jupiter). For the purpose of the Licensee's service of notice, it may contact [legal@jup.ag](mailto:legal@jup.ag).

13.4 Upon termination of this Agreement, Licensee will immediately cease using the API and the SDK, and Licensee agrees to destroy all adaptations or copies of the API, SDK, and Documentation or return them to Jupiter upon the termination of this License.

13.5 Jupiter shall have the right to review/audit your use of the API or SDK in conjunction with this Agreement, and you will provide reasonable assistance for this purpose.

13.6 The rights of Jupiter and your obligations contained in this Agreement survive any expiration or termination of this Agreement.

**14. Applicable Law; Arbitration​**

14.1 Licensee and Jupiter agree to arbitrate any dispute arising from this Agreement, except for disputes in which either party seeks equitable and other relief for the alleged unlawful use of copyrights, trademarks, trade names, logos, trade secrets or patents. ARBITRATION PREVENTS LICENSEE FROM SUING IN COURT OR FROM HAVING A JURY TRIAL.

14.2 Licensee and Jupiter agree to notify each other in writing of any dispute within thirty (30) days of when it arises. Notice to Jupiter shall be sent to [legal@jup.ag](mailto:legal@jup.ag).

14.3 The Licensee and Jupiter shall cooperate in good faith to resolve any dispute, controversy or claim arising out of, relating to, or in connection with this Agreement, including with respect to the formation, applicability, breach, termination, validity or enforceability thereof (a "Dispute") shall be settled in accordance with the laws of Panama. The parties undertake to carry out any award without delay and waive their right to any form of recourse insofar as such waiver can validly be made. Judgment upon the award may be entered by any court having jurisdiction thereof or having jurisdiction over the relevant party or its assets. Jupiter and the Licensee will each pay their respective attorneys' fees and expenses. Any dispute arising out of or related to this Agreement is personal to the Licensee and Jupiter and will not be brought as a class arbitration, class action, or any other type of representative proceeding. There will be no class arbitration or arbitration in which a person attempts to resolve a dispute as a representative of another person or group of persons. Further, a dispute cannot be brought as a class or other type of representative action, whether within or outside of arbitration, or on behalf of any other person or group of persons.

14.4 Any dispute between the parties will be governed by this Agreement and the laws of Panama, without giving effect to any conflict of laws principles that may provide for the application of the law of another jurisdiction. Whether the dispute is heard in arbitration or in court, Licensee and Jupiter will not commence against the other a class action, class arbitration or representative action or proceeding.

**15. Changes to this Agreement​**

We may amend any portion of this Agreement at any time by posting the revised version of this Agreement on [https://portal.jup.ag](https://portal.jup.ag) with an updated revision date. The changes will become effective and shall be deemed accepted by you, the first time you use or access the SDK or API after the initial posting of the revised Agreement and shall apply on a going-forward basis with respect to your use of the SDK and/or API. In the event that you do not agree with any such modification, your sole and exclusive remedy is to terminate your use of the SDK and/or API.

**16. Miscellaneous​**

16.1 Assignment. Licensee may not assign this Agreement or any interest or rights granted hereunder to any third party without the prior written consent of Jupiter. A change of control or reorganization of Licensee pursuant to a merger, sale of assets or stock shall be deemed to be an assignment under this Agreement. This Agreement shall terminate immediately upon the occurrence of any prohibited assignment.

16.2 Waiver. No failure by either party to exercise or enforce any of its rights under this Agreement will act as a waiver of such rights and no waiver of a breach in a particular situation shall be held to be a waiver of any other or subsequent breach.

16.3 Severability. If any provision of this Agreement is found invalid or unenforceable, that provision will be enforced to the maximum extent possible and the other provisions of this Agreement will remain in force.

16.4 Entire agreement. This Agreement represents the complete agreement concerning the API, SDK and oral amendments are void. If any provision of this Agreement is held to be unenforceable, such provision shall be reformed only to the extent necessary to make it enforceable.

16.5 Neither Party hereto shall be responsible for any failure to perform its obligations under this Agreement if such failure is caused by acts of God, war, strikes, revolutions, lack or failure of transportation facilities, laws or governmental regulations or other causes that are beyond the reasonable control of such Party. Obligations hereunder, however, shall in no event be excused but shall be suspended only until the cessation of any cause of such failure.

16.6 By installing, copying, or otherwise using this API or SDK, you acknowledge that you have read, understand and agree to be bound by the terms and conditions indicated above.


# Terms of Use
Source: https://dev.jup.ag/legal/terms-of-use

Jupiter Terms of Use

<Card title="Terms of Use File" href="https://github.com/jup-ag/docs/tree/main/static/files/legal" icon="link" />

**Jupiter**, [https://jup.ag](https://jup.ag), a website-hosted user interface (the "Interface") made available by Block Raccoon S.A.

The Interface is a visual representation of Jupiter protocol (the "Protocol") which comprises open source software deployed in a permissionless manner by Block Raccoon S.A. The Interface provides an interface which allows users to view and administer their interactions with the Protocol.

These Terms of Use and any terms and conditions incorporated herein by reference (collectively, the "Terms") govern your access to and use of the Interface. You must read the Terms carefully.

To make these Terms easier to read:

* Block Raccoon S.A.is referred to as "Jupiter", "we", "us", "our" or "the Company".
* "You", "your" and "user(s)" refers to anybody who accesses or uses, in any way, the Interface. If you are accessing or using the Interface on behalf of a company (such as your employer) or other legal entity, you represent and warrant that you have the authority to bind that entity to these Terms and, in that case, "you", "your" or "user(s)" will refer to that entity.

By accessing, browsing, or otherwise using the Interface, or by acknowledging agreement to the Terms on the Interface, you agree that you have read, understood, and accepted all of the Terms and our Privacy Policy (the "Privacy Policy"), which is incorporated by reference into the Terms.

IMPORTANT NOTE REGARDING ARBITRATION: WHEN YOU AGREE TO THESE TERMS BY USING OR ACCESSING THE INTERFACE, YOU ARE AGREEING TO RESOLVE ANY DISPUTE BETWEEN YOU AND JUPITER THROUGH BINDING, INDIVIDUAL ARBITRATION RATHER THAN IN COURT. AND YOU AGREE TO A CLASS ACTION WAIVER, BOTH OF WHICH IMPACT YOUR RIGHTS AS TO HOW DISPUTES ARE RESOLVED.

If you come up with any further questions, please, dont be shy and feel free to contact us at `legal@jup.ag`.

### 1. Eligibility

*General*. You may not use the Interface if you are otherwise barred from using the Interface under applicable law.

*Legality*. You are solely responsible for adhering to all laws and regulations applicable to you and your use or access to the Interface. Your use of the Interface is prohibited by and otherwise violate or facilitate the violation of any applicable laws or regulations, or contribute to or facilitate any illegal activity.

The Interface and each of the Company's services does not constitute, and may not be used for the purposes of, an offer or solicitation to anyone in any jurisdiction in which such offer or solicitation is not authorised, or to any person to whom it is unlawful to make such an offer or solicitation.

By using or accessing the Interface, you represent to us that you are not subject to sanctions or otherwise designated on any list of prohibited or restricted parties or excluded or denied persons, including but not limited to the lists maintained by the United Nations Security Council, the European Union or its Member States, or any other government authority.

We make no representations or warranties that the information, products, or services provided through our Interface, are appropriate for access or use in other jurisdictions. You are not permitted to access or use our Interface in any jurisdiction or country if it would be contrary to the law or regulation of that jurisdiction or if it would subject us to the laws of, or any registration requirement with, such jurisdiction. We reserve the right to limit the availability of our Interface to any person, geographic area, or jurisdiction, at any time and at our sole and absolute discretion.

*Prohibited Localities*. Jupiter does not interact with digital wallets located in, established in, or a resident of the United States, the Republic of China, Singapore, Myanmar (Burma), Cote D'Ivoire (Ivory Coast), Cuba, Crimea and Sevastopol, Democratic Republic of Congo, Iran, Iraq, Libya, Mali, Nicaragua, Democratic People’s Republic of Korea (North Korea), Somalia, Sudan, Syria, Yemen, Zimbabwe or any other state, country or region that is subject to sanctions enforced by the United States, the United Kingdom or the European Union. You must not use any software or networking techniques, including use of a Virtual Private Network (VPN) to modify your internet protocol address or otherwise circumvent or attempt to circumvent this prohibition.

*Non-Circumvention*. You agree not to access the Interface using any technology for the purposes of circumventing these Terms.

### 2. Compliance Obligations

The Interface may not be available or appropriate for use in all jurisdictions. By accessing or using the Interface, you agree that you are solely and entirely responsible for compliance with all laws and regulations that may apply to you. You further agree that we have no obligation to inform you of any potential liabilities or violations of law or regulation that may arise in connection with your access and use of the Interface and that we are not liable in any respect for any failure by you to comply with any applicable laws or regulations.

### 3. Access to the Interface

We reserve the right to disable access to the Interface at any time in the event of any breach of the Terms, including without limitation, if we, in our sole discretion, believe that you, at any time, fail to satisfy the eligibility requirements set forth in the Terms. Further, we reserve the right to limit or restrict access to the Interface by any person or entity, or within any geographic area or legal jurisdiction, at any time and at our sole discretion. We will not be liable to you for any losses or damages you may suffer as a result of or in connection with the Interface being inaccessible to you at any time or for any reason.

The Interface and the Protocol may rely on or utilise a variety of external third party services or software, including without limitation oracles, decentralised cloud storage services, analytics tools, hence the Interface or the Protocol may be adversely affected by any number of risks related to these third party services/software. These may include technical interruptions, network congestion/failure, security vulnerabilities, cyberattacks, or malicious activity. Access to the Interface or the Protocol may become degraded or unavailable during times of significant volatility or volume. This could result in the inability to interact with third-party services for periods of time and may also lead to support response time delays. The Company cannot guarantee that the Interface or the Protocol will be available without interruption and neither does it guarantee that requests to interact with third-party services will be successful. You agree that you shall not hold the Company responsible for any losses which occur due to any of the foregoing.

### 4. Your Use of Interface

By using or accessing the Interface, you represent and warrant that you understand that there are inherent risks associated with virtual currency, and the underlying technologies including, without limitation, cryptography and blockchain, and you agree that Jupiter is not responsible for any losses or damages associated with these risks. You specifically acknowledge and agree that the Interface facilitates your interaction with decentralized networks and technology and, as such, we have no control over any blockchain or virtual currencies and cannot and do not ensure that any of your interactions will be confirmed on the relevant blockchain and do not have the ability to effectuate any cancellation or modification requests regarding any of your interactions.

Without limiting the foregoing, you specifically understand and hereby represent your acknowledgment of the following:

* The pricing information data provided through the Interface does not represent an offer, a solicitation of an offer, or any advice regarding, or recommendation to enter into, a transaction with the Interface.
* The Interface does not act as an agent for any of the users.
* The Interface does not own or control any of the underlying software through which blockchain networks are formed, and therefore is not responsible for them and their operation.
* You are solely responsible for reporting and paying any taxes applicable to your use of the Interface.
* Although it is intended to provide accurate and timely information on the Interface, the Interface or relevant tools may not always be entirely accurate, complete, or current and may also include technical inaccuracies or typographical errors. Accordingly, you should verify all information before relying on it, and all decisions based on information contained on the Interface or relevant tools are your sole responsibility.

In order to allow other users to have a full and positive experience of using the Interface you agree that you will not use the Interface in a manner that:

* Breaches the Terms;
* Infringes on or violates any copyright, trademark, service mark, patent, right of publicity, right of privacy, or other proprietary or intellectual property rights under the law;
* Seeks to interfere with or compromise the integrity, security, or proper functioning of any computer, server, network, personal device, or other information technology system, including, but not limited to, the deployment of viruses and denial of service attacks;
* Attempts, in any manner, to obtain the private key, password, account, or other security information from any other user, including such information about the digital wallet;
* Decompiles, reverse engineer, or otherwise attempt to obtain the source code or underlying ideas or information of or relating to the Interface;
* Seeks to defraud us or any other person or entity, including, but not limited to, providing any false, inaccurate, or misleading information in order to unlawfully obtain the property of another;
* Violates any applicable law, rule, or regulation concerning the integrity of trading markets, including, but not limited to, the manipulative tactics commonly known as spoofing and wash trading;
* Violates any applicable law, rule, or regulation of the United States or another relevant jurisdiction, including, but not limited to, the restrictions and regulatory requirements imposed by U.S. law;
* Disguises or interferes in any way with the IP address of the computer you are using to access or use the Interface or that otherwise prevents us from correctly identifying the IP address of the computer you are using to access the Interface;
* Transmits, exchanges, or is otherwise supported by the direct or indirect proceeds of criminal or fraudulent activity;
* Contributes to or facilitates any of the foregoing activities.

As it has been already stated, we only provide you with the relevant interface and software and neither has control over your interactions with the blockchain nor encourages you to perform any. Any interaction performed by you via the Interface remains your sole responsibility.

All information provided in connection with your access and use of the Interface is for informational purposes only and should not be construed as professional advice. You should not take, or refrain from taking, any action based on any information contained in the Interface or any other information that we make available at any time, including, without limitation, blog posts, articles, links to third-party content, news feeds, tutorials, tweets, and videos. Before you make any financial, legal, or other decisions involving the Interface, you should seek independent professional advice from an individual who is licensed and qualified in the area for which such advice would be appropriate.

The Terms are not intended to, and do not, create or impose any fiduciary duties on us. To the fullest extent permitted by law, you acknowledge and agree that we owe no fiduciary duties or liabilities to you or any other party and that to the extent any such duties or liabilities may exist at law or in equity, those duties and liabilities are hereby irrevocably disclaimed, waived, and eliminated. You further agree that the only duties and obligations that we owe you are those set forth expressly in the Terms.

You understand that smart contract protocols such as the Protocol simply comprise a set of autonomous blockchain-based smart contracts deployed on the relevant blockchain network, operated directly by users calling functions on it (which allows them to interact with other users in a multi-party peer-to-peer manner). There is no further control by or interaction with the original entity which had deployed the smart contract, which entity solely functions as a provider of technical tools for users, and is not offering any sort of securities product or regulated service nor does it hold any user assets on custody. Any rewards earned by user interactions arise solely out of their involvement in the protocol by taking on the risk of interacting with other users and the ecosystem.

### 5. Non-custodial nature of Interface and Protocol

The Interface and Protocol are non-custodial in nature, therefore neither holds or controls your digital assets. Any digital assets which you may acquire through the usage of the Interface or the Protocol will be held and administered solely by you through your selected electronic wallet, and we shall have no access to or responsibility in regard to such electronic wallet or digital asset held therein. It is solely your responsibility to select the wallet service provider to use, and your use of such electronic wallet will be subject to the governing terms of use or privacy policy of the provider of such wallet. We neither own nor control your selected electronic wallet service, the relevant blockchain network, or any other third party site, product, or service that you might access, visit, or use for the purpose of enabling you to utilise the Interface or the Protocol. We will not be liable for the acts or omissions of any such third parties, nor will we be liable for any damage that you may suffer as a result of your transactions or any other interaction with any such third parties.

We will not create any hosted wallet for you or otherwise custody digital assets on your behalf, and it is your sole responsibility to maintain the security of your selected electronic wallet. You hereby irrevocably waive, release and discharge all claims, whether known or unknown to you, against us, our affiliates and their respective shareholders, members, directors, officers, employees, agents and representatives related to your use of any wallet software, associated loss of digital assets, transaction failures, or any other defects that arise in the course of your use of your electronic wallet, including any losses that may obtain as a result of any failure of the Interface or the Protocol.

Neither the Company, the Interface nor the Protocol provides any digital asset exchange or portfolio/fund management services. If you choose to engage in transactions with other users via the Interface or the Protocol, then such decisions and transactions and any consequences flowing therefrom are your sole responsibility. In no event shall the Company, its affiliates or their respective directors or employees be responsible or liable to you or anyone else, directly or indirectly, for any damage or loss arising from or relating to any interaction or continued interaction with the Interface or the Protocol or in reliance on any information provided on the Interface (including, without limitation, directly or indirectly resulting from errors in, omissions of or alterations to any such information).

"Know Your Customer" and "Anti-Money Laundering" checks We reserve the right to conduct "Know Your Customer" and "Anti-Money Laundering" checks on you if deemed necessary by us (at our sole discretion) or such checks become required under applicable laws in any jurisdiction. Upon our request, you shall immediately provide us with information and documents that we, in our sole discretion, deem necessary or appropriate to conduct "Know Your Customer" and "Anti-Money Laundering" checks. Such documents may include, but are not limited to, passports, driver's licenses, utility bills, photographs of associated individuals, government identification cards or sworn statements before notaries or other equivalent professionals. Notwithstanding anything herein, we may, in its sole discretion, refuse to provide access to the Interface to you until such requested information is provided, or in the event that, based on information available to us, you are suspected of using the Interface or the Protocol in connection with any money laundering, terrorism financing, or any other illegal activity. In addition, we shall be entitled to use any possible efforts for preventing money laundering, terrorism financing or any other illegal activity, including without limitation blocking of your access to the Interface or the Protocol, or providing your information to any regulatory authority.

### 6. Disclaimers

You understand and agree that the Interface enables access to an online, decentralized, and autonomous protocol and environment, and associated decentralized networks, that are not controlled by Jupiter. We do not have access to your private key and cannot initiate an interaction with your virtual currency or otherwise access your virtual currency. We are not responsible for any activities that you engage in when using your wallet, or the Interface.

Jupiter cannot and does not represent or guarantee that any of the information available through the Interface is accurate, reliable, current, complete or appropriate for your needs. The information displayed through the Interface including information about prices is provided by third parties and/or calculated for informational purposes. Your use of any third-party scripts, indicators, ideas, and other content is at your sole risk.

You expressly understand and agree that your use of the Interface is at your sole risk. We make and expressly disclaim all representations and warranties, express, implied or statutory, and with respect to the Interface and the code proprietary or open-source, we specifically do not represent and warrant and expressly disclaim any representation or warranty, express, implied or statutory, including without limitation, any representations or warranties of title, non-infringement, merchantability, usage, security, suitability or fitness for any particular purpose, or as to the workmanship or technical coding thereof, or the absence of any defects therein, whether latent or patent. We do not represent or warrant that the Interface, code, and any related information are accurate, complete, reliable, current, or error-free. The Interface is provided on an "as is" and "as available" basis, without warranties of any kind, either express or implied, including, without limitation, implied warranties of merchantability, fitness for a particular purpose, or non-infringement.

You acknowledge that no advice, information, or statement that we make should be treated as creating any warranty concerning the Interface. We do not endorse, guarantee, or assume responsibility for any advertisements, offers, or statements made by third parties concerning the Interface. You acknowledge that Jupiter is not responsible for transferring, safeguarding, or maintaining your private keys or any virtual currency associated therewith. If you lose, mishandle, or have stolen associated virtual currency private keys, you acknowledge that you may not be able to recover associated virtual currency and that Jupiter is not responsible for such loss. You acknowledge that Jupiter is not responsible for any loss, damage, or liability arising from your failure to comply with the terms hereunder.

By accessing and using the Interface, you represent that you understand (a) the Interface facilitates access to the Protocol, the use of which has many inherent risks, and (b) the cryptographic and blockchain-based systems have inherent risks to which you are exposed when using the Interface. You further represent that you have a working knowledge of the usage and intricacies of blockchain-based digital assets, including, without limitation, SPL token standard available on the Solana blockchain. You further understand that the markets for these blockchain-based digital assets are highly volatile due to factors that include, but are not limited to, adoption, speculation, technology, security, and regulation. You acknowledge that the cost and speed of transacting with blockchain-based systems, such as Solana, are variable and may increase or decrease, respectively, drastically at any time. You hereby acknowledge and agree that we are not responsible for any of these variables or risks associated with the Protocol and cannot be held liable for any resulting losses that you experience while accessing or using the Interface. Accordingly, you understand and agree to assume full responsibility for all of the risks of accessing and using the Interface to interact with the Protocol.

The Interface may contain references or links to third-party resources, including, but not limited to, information, materials, products, or services, that we do not own or control. In addition, third parties may offer promotions related to your access and use of the Interface. We do not endorse or assume any responsibility for any such resources or promotions. If you access any such resources or participate in any such promotions, you do so at your own risk, and you understand that the Terms do not apply to your dealings or relationships with any third parties. You expressly relieve us of any and all liability arising from your use of any such resources or participation in any such promotions.

### 7. Intellectual Proprietary Rights

We own all intellectual property and other rights in the Interface and its contents, including, but not limited to, software, text, images, trademarks, service marks, copyrights, patents, and designs. Unless expressly authorized by us, you may not copy, modify, adapt, rent, license, sell, publish, distribute, or otherwise permit any third party to access or use the Interface or any of its contents. Accessing or using the Interface does not constitute a grant to you of any proprietary intellectual property or other rights in the Interface or its contents.

You will retain ownership of all intellectual property and other rights in any information and materials you submit through the Interface. However, by uploading such information or materials, you grant us a worldwide, royalty-free, irrevocable license to use, copy, distribute, publish and send this data in any manner in accordance with applicable laws and regulations.

You may choose to submit comments, bug reports, ideas, or other feedback about the Interface, including, without limitation, about how to improve the Interface (collectively, "Feedback"). By submitting any Feedback, you agree that we are free to use such Feedback at our discretion and without additional compensation to you, and to disclose such Feedback to third parties (whether on a non-confidential basis or otherwise). If necessary under applicable law, then you hereby grant us a perpetual, irrevocable, non-exclusive, transferable, worldwide license under all rights necessary for us to incorporate and use your Feedback for any purpose.

If (i) you satisfy all of the eligibility requirements set forth in the Terms, and (ii) your access to and use of the Interface complies with the Terms, you hereby are granted a single, personal, limited license to access and use the Interface. This license is non-exclusive, non-transferable, and freely revocable by us at any time without notice or cause in our sole discretion. Use of the Interface for any purpose not expressly permitted by the Terms is strictly prohibited.

In the event that you utilise any intellectual property in any manner which infringes on the rights of any party (including by unauthorised incorporation of the same in any project, protocol, code or any digital token), the Company reserves the sole discretion to effectuate the takedown of any such project, protocol, code or any digital token (or underlying intellectual property) at any time, without notice, compensation or payment to you. In addition, and without prejudice to the Company's other remedies under this Agreement, you shall indemnify the Company and its officers, directors, employees, contractors, agents, affiliates, and subsidiaries from and against all claims, damages, obligations, losses, liabilities, costs, and expenses arising from your aforesaid infringement of intellectual rights.

### 8. Indemnification

You agree to hold harmless, release, defend, and indemnify us and our officers, directors, employees, contractors, agents, affiliates, and subsidiaries from and against all claims, damages, obligations, losses, liabilities, costs, and expenses arising from (a) your access to and use of the Interface; (b) your violation of these Terms, the right of any third party, or any other applicable law, rule, or regulation; and (c) any other party’s access and use of the Interface with your assistance or using any device or account that you own or control.

### 9. Limitation of Liability

Under no circumstances shall we or any of our officers, directors, employees, contractors, agents, affiliates, or subsidiaries be liable to you for any indirect, punitive, incidental, special, consequential, or exemplary damages, including (but not limited to) damages for loss of profits, goodwill, use, data, or other intangible property, arising out of or relating to any access to or use of the Interface, nor will we be responsible for any damage, loss, or injury resulting from hacking, tampering, or other unauthorized access to or use of the Interface, or from any access to or use of any information obtained by any unauthorized access to or use of the Interface. We assume no liability or responsibility for any: (a) errors, mistakes, or inaccuracies of content; (b) personal injury or property damage, of any nature whatsoever, resulting from any access to or use of the Interface; (c) unauthorized access to or use of any secure server or database in our control or the use of any information or data stored therein; (d) interruption or cessation of function related to the Interface; (e) bugs, viruses, trojan horses, or the like that may be transmitted to or through the Interface; (f) errors or omissions in, or loss or damage incurred as a result of, the use of any content made available through the Interface; and (g) the defamatory, offensive, or illegal conduct of any third party. Under no circumstances shall we or any of our officers, directors, employees, contractors, agents, affiliates, or subsidiaries be liable to you for any claims, proceedings, liabilities, obligations, damages, losses, or costs in an amount exceeding the greater of (i) the amount you paid to us in exchange for access to and use of the Interface, or (ii) \$100.00. This limitation of liability applies regardless of whether the alleged liability is based on contract, tort, negligence, strict liability, or any other basis, and even if we have been advised of the possibility of such liability. Some jurisdictions do not allow the exclusion of certain warranties or the limitation or exclusion of certain liabilities and damages. Accordingly, some of the disclaimers and limitations set forth in the Terms may not apply to you. This limitation of liability shall apply to the fullest extent permitted by law.

### 10. Arbitration and Class Action Waiver​

*Binding Arbitration*. Except for disputes in which either party seeks to bring an individual action in small claims court or seeks injunctive or other equitable relief for the alleged unlawful use of copyrights, trademarks, trade names, logos, trade secrets or patents, you and the Jupiter: (a) waive the right to have any and all disputes or claims arising from these Terms, your use or access to the Interface or any other disputes with the Jupiter *(collectively, "Disputes")* resolved in a court; and (b) waive any right to a jury trial. Instead, you and the Jupiter agree to arbitrate Disputes that are not resolved informally (as described below) through binding arbitration (i.e. the referral of a Dispute to one or more persons charged with reviewing the Dispute and making a final and binding determination to resolve it) instead of having the Dispute decided by a judge or jury in court).

*No Class Arbitrations, Class Actions or Representative Actions*. You and Jupiter agree that any dispute is personal to you and Jupiter and that any such dispute will be resolved solely through individual arbitration and will not be brought as a class arbitration, class action, or any other type of representative proceeding. Neither party agrees to class arbitration or to an arbitration in which an individual attempts to resolve a dispute as a representative of another individual or group of individuals. Further, you and the Jupiter agree that a dispute cannot be brought as a class, or other types of representative action, whether within or outside of arbitration, or on behalf of any other individual or group of individuals.

*Process*. You and the Jupiter agree that each will notify the other, in writing, of any Dispute within thirty (30) days of when it arises so that the parties can attempt, in good faith, to resolve the Dispute informally. Notice to Jupiter shall be provided by sending an email to [legal@jup.ag](mailto:legal@jup.ag). Your notice must include (1) your name, postal address, and email address; (2) a description of the nature or basis of the Dispute; and (3) the specific action that you are seeking. If you and the Jupiter cannot resolve the Dispute within thirty (30) days of the Jupiter receiving the notice, either you or Jupiter may, as appropriate pursuant to this Section 12, commence an arbitration proceeding. You and Jupiter agree that any arbitration or claim must be commenced or filed within one (1) year after the Dispute arose; otherwise, you and the Jupiter agree that the claim is permanently barred (which means that you will no longer have the right to assert a claim regarding the Dispute).

*Choice of Law*. These Terms are governed by and will be construed under the laws of Panama, without regard to principles of conflict of laws, govern the Terms and any Dispute between you and us. Any Dispute under these Terms shall be finally settled by Binding Arbitration (as defined below). Any unresolved Dispute arising out of or in connection with these Terms shall be referred to and finally resolved by arbitration under the rules of the London Court of International Arbitration (LCIA), which rules are deemed to be incorporated by reference into this Section 12 to the extent they are consistent with it. Any dispute arising from or relating to the subject matter of these Terms shall be finally settled in London, United Kingdom, in English, in accordance with the LCIA Arbitration Rules. Unless we agree otherwise, the arbitrator may not consolidate your claims with those of any other party. Any judgment on the award rendered by the arbitrator may be entered in any court of competent jurisdiction, to the extent a court therein would be deemed to be a court of competent jurisdiction other than any court located in the United States of America. You further agree that the Interface shall be deemed to be based solely in Panama and that, although the Interface may be available in other jurisdictions, its availability does not give rise to general or specific personal jurisdiction in any forum outside Panama.

*Authority of Arbitrator*. As limited by these Terms and applicable arbitration rules, the arbitrator will have: (a) the exclusive authority and jurisdiction to make all procedural and substantive decisions regarding a Dispute; and (b) the authority to grant any remedy that would otherwise be available in court. The arbitrator may only conduct an individual arbitration and may not consolidate more than one individual s claims, preside over any type of class or representative proceeding or preside over any proceeding involving more than one individual.

### 11. Miscellaneous

*Changes*. We may amend any portion of these Terms at any time by posting the revised version of these Terms with an updated revision date. The changes will become effective and shall be deemed accepted by you, the first time you use or access the Interface after the initial posting of the revised Terms and shall apply on a going-forward basis with respect to your use of the Interface including any transactions initiated after the posting date. In the event that you do not agree with any such modification, your sole and exclusive remedy are to terminate your use of the Interface.

*Entire Agreement*. These Terms (and any additional terms, rules, and conditions of participation that may be posted on the website of Jupiter) including the Privacy Policy constitute the entire agreement with respect to the Interface and supersedes any prior agreements, oral or written.

*Privacy Policy*. The Privacy Policy describes the ways we collect, use, store and disclose your personal information. You agree to the collection, use, storage, and disclosure of your data in accordance with the Privacy Policy.

*Severability*. If any provision of these Terms shall be determined to be invalid or unenforceable under any rule, law, or regulation of any local, state, or federal government agency, such provision will be changed and interpreted to accomplish the objectives of the provision to the greatest extent possible under any applicable law and the validity or enforceability of any other provision of these Terms shall not be affected. If such construction is not possible, the invalid or unenforceable portion will be severed from these Terms but the rest of these Terms will remain in full force and effect.

*Survival*. Upon termination of these Terms for any reason, all rights and obligations of the parties that by their nature are continuing will survive such termination.

*English language*. Notwithstanding any other provision of these Terms, any translation of these Terms is provided for your convenience. The meanings of terms, conditions, and representations herein are subject to their definitions and interpretations in the English language. In the event of conflict or ambiguity between the English language version and translated versions of these terms, the English language version shall prevail. You acknowledge that you have read and understood the English language version of these Terms.

If you have any questions, claims, complaints, or suggestions, please, contact us at `legal@jup.ag`.


# FAQ
Source: https://dev.jup.ag/portal/faq

Frequently asked questions about Jupiter Portal: tier differences, API key usage, payment, upgrades, and using Pro and Ultra together.

<Tip>
  For more detailed explanation, please read [API Setup](/portal/setup) and [API Rate Limit](/portal/rate-limit) docs as well.
</Tip>

<AccordionGroup>
  <Accordion title="Does Free or Ultra tier need payment?">
    * No, you do not need to pay for Free or Ultra.
    * For both, you will need to log in first to generate an API Key and use it with `api.jup.ag`.
  </Accordion>

  <Accordion title="Does Pro tier have any advantages from Free or Ultra?">
    * By purchasing a Pro tier, you are only accessing higher rate limits with no differences in usage, data freshness and latency.
    * Though, Pro tier covers all endpoints, excluding Ultra Swap API. While Ultra Swap API has its own rate limit system.
  </Accordion>

  <Accordion title="Can I use the same API key for all endpoints?">
    * Yes, API keys are universal across both Fixed Rate Limit and Dynamic Rate Limit system.
    * For example, if you have purchased the pro tier, you can still use the same API Key for Ultra Swap API.
  </Accordion>

  <Accordion title="Does the API Key apply immediately?">
    * No, it will take 2-5 minutes for it to be reflected.
  </Accordion>

  <Accordion title="What happens if I upgrade/downgrade my tier?">
    * You can only upgrade/downgrade your Pro tier.
    * The amount payable is pro-rated.
    * Upgrade happens immediately, but it is still required to be reflected.
    * Downgrade will happen at the end of the billing period if you are to renew the tier.

    Refer to [Payment Method](/portal/payment) for more details.
  </Accordion>

  <Accordion title="Can I use both Pro and Ultra endpoints together?">
    * Yes. You can maintain a Pro subscription for all other API routes while integrating Ultra endpoints separately.
    * Do note that purchasing a Pro tier, does not apply its rate limits to Ultra Swap API.
  </Accordion>
</AccordionGroup>

#### For more support

* Please reach out to us.
* If you have increasing demand and growth in your app, and need custom rate limits or payment options beyond the provided in Portal.
* If you require higher base quota for Ultra tier to bootstrap your product.
* If you have questions or need support on Portal, [open a ticket](https://support.jup.ag/hc/en-us/requests/new?ticket_form_id=18069133114012\&tf_18541841140892=api_or_developer_support).
* Join the [Telegram channel](https://t.me/jup_dev) or [Discord channel](https://discord.com/channels/897540204506775583/1115543693005430854) to subscribe to updates.


# Latency
Source: https://dev.jup.ag/portal/latency

Jupiter API latency characteristics: distributed AWS gateway regions, factors affecting response times, and optimization tips for collocating servers.

## Overview

Jupiter API operates through a distributed API gateway infrastructure to provide optimal performance across different geographic regions. The APIs are exclusively HTTP-based, with self-hosted API binary protocols no longer supported.

**Key Factors Affecting Latency:**

* **Geographic Location**: Latency varies significantly based on your server's proximity to Jupiter's API gateways
* **Network Conditions**: Internet routing and congestion can impact response times
* **Request Complexity**: Different endpoints have different processing requirements

## API Gateway Latency

There are no significant differences or no penalty/benefits between the different tiers.

## Regional Distribution

Jupiter's API gateway is distributed across multiple AWS regions.

### Supported AWS Regions

| AWS Region Code  | Location    | Recommended For          |
| :--------------- | :---------- | :----------------------- |
| `us-east-1`      | N. Virginia | North America East Coast |
| `us-east-2`      | Ohio        | North America Central    |
| `eu-central-1`   | Frankfurt   | Central Europe           |
| `eu-west-1`      | Ireland     | Western Europe           |
| `ap-southeast-1` | Singapore   | Southeast Asia           |
| `ap-northeast-1` | Tokyo       | Northeast Asia           |

## Latency Optimization Tips

### Server Collocation

**Recommended**: Deploy your servers in the same AWS regions as Jupiter's API gateways for optimal performance.

### Request Simplification

* Simplify your API requests to reduce processing time
* Avoid unnecessary parameters or complex queries
* Use the most direct endpoint for your use case

## Troubleshooting High Latency

If you're experiencing higher than expected latency:

1. **Check your server location** - Ensure you're in a supported AWS region.
2. **Monitor network conditions** - Check for routing issues or congestion.
3. **Log your requests** - Monitor request timing to identify where latency bottlenecks occur. Log both request initiation and response times to pinpoint whether delays are from network transit, API processing, or client-side handling.

## Support

If you need further assistance, please reach out to us in [Discord](https://discord.gg/jup).

* Share your request logs and ensure they include latency breakdowns.
* Provide details about your server setup and network configuration.
* Log response header's CloudFront request ID to help us identify the request.


# Migrate from Lite API
Source: https://dev.jup.ag/portal/migrate-from-lite-api

Migrate from the deprecated lite-api.jup.ag to api.jup.ag with a free API key.

## Overview

<Info>
  **Update:** The deprecation of `lite-api.jup.ag` has been postponed for a few months while we implement a new pricing structure. The migration will still happen, but there is no immediate deadline. We recommend migrating at your convenience to benefit from the new API features.
</Info>

This guide will help you migrate from `lite-api.jup.ag` to `api.jup.ag`. The migration is straightforward - only the base URL and API key requirement changes.

## What Changed?

We will be stopping support for API requests with no API key, hence you are required to migrate to `api.jup.ag` and use with an API key.

| Before (Deprecated)           | After (Current)                        |
| ----------------------------- | -------------------------------------- |
| `https://lite-api.jup.ag/...` | `https://api.jup.ag/...`               |
| No API key required           | API key required (free tier available) |
| Free tier                     | Free tier (with API key)               |

## Migration Steps

### Step 1: Generate API Key

1. Visit [portal.jup.ag](https://portal.jup.ag)
2. Connect via email
3. Generate an API key (free tier available)
4. Copy your API key

<Tip>
  The free tier provides 60 requests per minute.
</Tip>

### Step 2: Update Your Base URL

Replace all instances of `lite-api.jup.ag` with `api.jup.ag`:

```diff theme={null}
- const baseUrl = 'https://lite-api.jup.ag';
+ const baseUrl = 'https://api.jup.ag';
```

### Step 3: Add API Key Header

To use your API key, pass in via header as `x-api-key`:

<CodeGroup>
  ```js JS/TS wrap theme={null}
  // Before (deprecated)
  const response = await fetch('https://lite-api.jup.ag/ultra/v1/order?...');

  // After (current)
  const response = await fetch('https://api.jup.ag/ultra/v1/order?...', {
    headers: {
      'x-api-key': 'your-api-key-here',
    },
  });
  ```

  ```python Python wrap theme={null}
  # Before (deprecated)
  response = requests.get('https://lite-api.jup.ag/ultra/v1/order?...')

  # After (current)
  response = requests.get(
      'https://api.jup.ag/ultra/v1/order?...', 
      headers={'x-api-key': 'your-api-key-here'}
  )
  ```

  ```curl curl wrap theme={null}
  # Before (deprecated)
  curl -X GET 'https://lite-api.jup.ag/ultra/v1/order?...'

  # After (current)
  curl -X GET 'https://api.jup.ag/ultra/v1/order?...' \
      -H 'x-api-key: your-api-key-here'
  ```
</CodeGroup>

## Migration Checklist

* [ ] Generate API key from [portal.jup.ag](https://portal.jup.ag)
* [ ] Update all `lite-api.jup.ag` URLs to `api.jup.ag`
* [ ] Add `x-api-key` header to all API requests
* [ ] Test API calls with new endpoint
* [ ] Update environment variables/config files
* [ ] Update documentation/comments in code

## Endpoint Mapping

All endpoints remain the same, only the base URL changes:

| Service       | Old Endpoint                       | New Endpoint                  |
| ------------- | ---------------------------------- | ----------------------------- |
| Ultra API     | `lite-api.jup.ag/ultra/v1/...`     | `api.jup.ag/ultra/v1/...`     |
| Swap API      | `lite-api.jup.ag/swap/v1/...`      | `api.jup.ag/swap/v1/...`      |
| Price API     | `lite-api.jup.ag/price/v2/...`     | `api.jup.ag/price/v2/...`     |
| Tokens API    | `lite-api.jup.ag/tokens/v1/...`    | `api.jup.ag/tokens/v1/...`    |
| Trigger API   | `lite-api.jup.ag/trigger/v1/...`   | `api.jup.ag/trigger/v1/...`   |
| Recurring API | `lite-api.jup.ag/recurring/v1/...` | `api.jup.ag/recurring/v1/...` |
| Send API      | `lite-api.jup.ag/send/v1/...`      | `api.jup.ag/send/v1/...`      |
| Studio API    | `lite-api.jup.ag/studio/v1/...`    | `api.jup.ag/studio/v1/...`    |
| Lend API      | `lite-api.jup.ag/lend/v1/...`      | `api.jup.ag/lend/v1/...`      |

## Common Issues

<AccordionGroup>
  <Accordion title="401 Unauthorized">
    **Problem**: Getting 401 errors after migration\
    **Solution**: Make sure you are including the `x-api-key` header in all requests.
  </Accordion>

  <Accordion title="Rate Limit Errors">
    **Problem**: Hitting rate limits\
    **Solution**: Free tier provides 60 requests per minute. Consider upgrading to Pro tier for higher limits. Refer to [Rate Limit](/portal/rate-limit) for more details.
  </Accordion>
</AccordionGroup>

## Need Help?

* [API Key Setup Guide](/portal/setup)
* [Rate Limits](/portal/rate-limit)
* [FAQ](/portal/faq)
* [Support](/resources/support)


# Payment Methods
Source: https://dev.jup.ag/portal/payment

Payment methods for Jupiter Portal

## Overview

* **Free and Ultra tier**: No payment required.
* **Pro tier**: Tiered pricing.

<Note>
  **Important Note**

  The payment methods provided on Portal only applies to the **PRO PLAN**.

  For Free and Ultra tiers, you can generate an API key and use the API directly without any payment on Portal.
</Note>

## Payment Method

To pay for higher rate limits on Pro plan, you can choose either of the payment methods via the Portal UI, we currently support 2 payment methods:

* Crypto - USDC on Solana via Helio
* Credit card - USD via CoinFlow

### Crypto

| Property                       | Details                                                                                                                                                                                                                                                       |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Payment**                    | The payment is done in Solana USDC only.                                                                                                                                                                                                                      |
| **Cadence**                    | The payment is currently done on a monthly basis, which means you will need to revisit Portal and manually renew each month.                                                                                                                                  |
| **Expiry**                     | 7 days before the plan expires, you will see the state change in the dashboard's table and receive an automated email as a reminder to renew. Upon expiry, your key will remain valid for a grace period but will be disabled (but not deleted) when it ends. |
| **Renewal**                    | If you choose to "Renew", the plan will be renewed to the same plan as the previous month. To change plan, you can upgrade/downgrade your plan at any time and cost will be pro-rated.                                                                        |
| **Fee**                        | Jupiter incurs the payment service fees.                                                                                                                                                                                                                      |
| **Changing of payment method** | From Crypto to Credit Card:<br />1. Wait for plan to expire<br />2. Pay using the credit card payment method.                                                                                                                                                 |

### Credit Card

| Property                       | Details                                                                                                                                                                                                                                                                                                                                            |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Payment**                    | The payment is done in USD only.                                                                                                                                                                                                                                                                                                                   |
| **Cadence**                    | The subscription is automatically renewed and funds deducted on a monthly basis.                                                                                                                                                                                                                                                                   |
| **Fee**                        | User incurs the credit card payment service fees at 3.4% of the payment amount + \$0.25.                                                                                                                                                                                                                                                           |
| **Changing of cards**          | For security, changing of cards require a few extra steps and cannot be done in the middle of the subscription.<br />1. Cancel current plan<br />2. Wait for plan to expire<br />3. Resubscribe a plan with the new card.                                                                                                                          |
| **Upgrading of plans**         | You can upgrade your plan at any time.<br />- The cost of the new plan will be charged immediately, while the pro-rated unused cost of the previous plan will be refunded.<br />- The subscription date will be updated to the date of the upgrade.<br />- Do note that the refund will be processed at least 1-2 business days after the upgrade. |
| **Downgrading of plans**       | You can downgrade by cancelling your plan and subscribing to a lower plan after expiry.                                                                                                                                                                                                                                                            |
| **Cancellation of plans**      | No refund will be given for unused days and the Pro plan will continue until the expected expiry date.                                                                                                                                                                                                                                             |
| **Changing of payment method** | From Credit Card to Crypto:<br />1. Cancel current plan so it does not automatically renew<br />2. Wait for plan to expire<br />3. Pay using the crypto payment method.                                                                                                                                                                            |
| **Other Caveats**              | - Registered card address must be the billing address.<br />- No usage of disposable cards as payments are made for a recurring subscription plan.                                                                                                                                                                                                 |


# Rate Limit
Source: https://dev.jup.ag/portal/rate-limit

Rate limiting for Jupiter APIs: Fixed Rate Limits for Free and Pro tiers, and Dynamic Rate Limits for Ultra.

## Overview

<Card title="Fixed Rate Limit">
  Applies To: Free & Pro Tiers

  * Public & documented Jupiter APIs are free to use via the free tier.
  * Purchasing a Pro plan only increases your rate limit.
  * Free and Pro tiers have the same usage data freshness and latency.
</Card>

<Card title="Dynamic Rate Limit">
  Applies To: Ultra Swap API (Ultra Tier)

  * Ultra Swap API uses a unique dynamic rate limit system.
  * [Read more about Dynamic Rate Limit](/portal/rate-limit#dynamic-rate-limit).
</Card>

## Rate Limit Rules

API Keys are universal across both Fixed Rate Limit and Dynamic Rate Limit system.

* You can use the same API Key for all endpoints.
  * For example, if you have purchased the pro tier, you can still use the same API Key for Ultra Swap API.
* Rate limits apply on a per account basis, not to individual API keys.
  * Generating more than 1 API key does not increase your rate limits, since they are depleting the same rate limit.

***

## Fixed Rate Limit

The Fixed Rate Limit system applies to the Free and Pro plans (does not include Ultra Swap API), using the sliding window method to enforce request quotas.

| Property                | Free                  | Pro                           |
| :---------------------- | :-------------------- | :---------------------------- |
| **Base URL**            | `https://api.jup.ag/` | `https://api.jup.ag/`         |
| **Cost**                | Free                  | Paid per month, based on tier |
| **API Key**             | Required              | Required                      |
| **Requests Per Minute** | 60                    | Based on tier                 |
| **Window**              | 60 seconds            | 10 seconds                    |

**Rate Limit**

Rate limits are defined over 10-second windows (except free tier at 60-second window). For example, if your tier allows 100 requests per 10 seconds, any more within that window will receive a 429 response, regardless of how few you used in the previous window.

| Tier    | Est. Requests per Minute | Requests Per Period | Sliding Window Period |
| :------ | :----------------------- | :------------------ | :-------------------- |
| Free    | 60                       | 60                  | 60 seconds            |
| Pro I   | \~600                    | 100                 | 10 seconds            |
| Pro II  | \~3,000                  | 500                 | 10 seconds            |
| Pro III | \~6,000                  | 1,000               | 10 seconds            |
| Pro IV  | \~30,000                 | 5,000               | 10 seconds            |

Requests are distributed to each bucket:

1. **Price API Bucket** – dedicated for `/price/v3/` only - separate from Default Bucket.
2. **Studio API Bucket** – dedicated for `/studio/` only - separate from Default Bucket.
   * Free: 100 requests per 5 minutes
   * Pro: 10 requests per 10 seconds (for all tiers)
3. **Default Bucket** – used for all APIs except the Price API and Studio API.

<Info>
  * Each bucket enforces its own sliding window independently.
  * For example, Pro II = 500 per 10 seconds to the Default Bucket and 500 per 10 seconds to the Price API Bucket.
  * Free users do not have a separate Price API Bucket — all requests are counted against the Default Bucket.
</Info>

## Dynamic Rate Limit

<Note>
  Dynamic Rate Limit is currently in BETA.

  * The rate limit is subject to changes as we experiment with the Dynamic Rate Limit system.
  * If you find that the rate limit is too restrictive, please reach out to us in [Discord](https://discord.gg/jup).
</Note>

The [**Ultra Swap API**](/docs/ultra) uses a unique rate limiting mechanism that scales with your **executed swap volume** over time.

| Property                | Dynamic                                 |
| :---------------------- | :-------------------------------------- |
| **Base URL**            | `https://api.jup.ag/ultra/`             |
| **Cost**                | Free to use, but Ultra incurs swap fees |
| **API Key**             | Required                                |
| **Requests Per Minute** | Base Quota + Added Quota                |

### How Dynamic Rate Limit Works

Every **10 minutes**

* The system aggregates your swap volume from `/execute` on Ultra for **the current rolling day** (volume of (current timestamp - 1 day) up to present).
* After which, the Added Quota will update, which will be added on top of the Base Quota.

| Swap Volume | Requests Per Period       | Sliding Window Period |
| :---------- | :------------------------ | :-------------------- |
| \$0         | 50 Base + 0 Added = 50    | 10 seconds            |
| \$10,000    | 50 Base + 1 Added = 51    | 10 seconds            |
| \$100,000   | 50 Base + 11 Added = 61   | 10 seconds            |
| \$1,000,000 | 50 Base + 115 Added = 165 | 10 seconds            |

## Managing Rate Limits

If you receive a 429 response, you should:

1. Implement exponential backoff in your retry logic
2. Wait for sliding window to allow for more requests
3. **Upgrade your tier (Pro)** or **scale your Ultra usage** to unlock higher limits.

<Warning>
  **CAUTION**

  Bursting beyond your allocation may result in **temporary 429s/rate limits**, even after the refill period. Avoid aggressive retry patterns.
</Warning>


# Response Codes
Source: https://dev.jup.ag/portal/responses

Response codes for Jupiter APIs

<Tip>
  **Help Us Debug**

  If you face any issues, please provide clear and concise description of the error/issue.

  Additionally, **logging the response headers** will be helpful for us to identify your requests.
</Tip>

<Note>
  **Product Specific Error Codes**

  For product-level response codes, please refer to each product pages for more information.
</Note>

| Common Codes | Description           | Debug                                                                                       |
| :----------- | :-------------------- | :------------------------------------------------------------------------------------------ |
| 200          | Good                  | Success!                                                                                    |
| 400          | Bad Request           | Likely a problem with the request, check the request parameters, syntax, etc.               |
| 401          | Unauthorized          | Likely a problem with the API key, check if the API key is correct.                         |
| 404          | Not Found             | Likely a broken or invalid endpoint.                                                        |
| 429          | Rate Limited          | You are being rate limited. Either slow down requests, reduce bursts, or upgrade your plan. |
| 500          | Internal Server Error | Please reach out in [Discord](https://discord.gg/jup).                                      |
| 502          | Bad Gateway           | Please reach out in [Discord](https://discord.gg/jup).                                      |
| 503          | Service Unavailable   | Please reach out in [Discord](https://discord.gg/jup).                                      |
| 504          | Gateway Timeout       | Please reach out in [Discord](https://discord.gg/jup).                                      |


# Setting Up API Key
Source: https://dev.jup.ag/portal/setup

Generate a free API key at portal.jup.ag with Free, Pro, and Ultra tier options.

<Note>
  To use your API key, pass in via header as `x-api-key`.
</Note>

| Tier  | Rate Limit Model                                    | Base URL                    | API Key  |
| ----- | --------------------------------------------------- | --------------------------- | -------- |
| Free  | Fixed Rate Limit                                    | `https://api.jup.ag/`       | Required |
| Pro   | Fixed Tiered Rate Limits (1 RPS to 500 RPS plans)   | `https://api.jup.ag/`       | Required |
| Ultra | Dynamic Rate Limits (based on executed swap volume) | `https://api.jup.ag/ultra/` | Required |

<Steps>
  <Step>
    Open Portal at [https://portal.jup.ag/](https://portal.jup.ag/)
  </Step>

  <Step>
    Connect via email
  </Step>

  <Step>
    <Card title="Free" icon="1">
      You are just starting out and want to try Jupiter via API.

      1. Generate an API key
      2. Use the API key with the base URL `https://api.jup.ag/`
    </Card>

    <Card title="Pro" icon="2">
      Both small projects and large enterprises can utilize this with the tiered rate limits.

      1. Choose a plan (1 RPS to 500 RPS plans)
      2. Pay via **Helio (USDC on Solana manual renewal)**
      3. Or via **Coinflow (credit card subscription)**

      * Refer to [Payment Method](/portal/payment) for more details
    </Card>

    <Card title="Ultra" icon="3">
      For all types of projects, Ultra Swap API uses a Dynamic Rate Limit model that scales with your swap executions.

      1. Generate an API key
      2. Use the API key with the base URL `https://api.jup.ag/ultra/`

      <Tip>
        [Using Ultra Swap API comes with many benefits](/docs/ultra) where Jupiter handles the entire end-to-end execution without the need of an RPC from you.
      </Tip>
    </Card>
  </Step>
</Steps>


# AI Workflow
Source: https://dev.jup.ag/resources/ai-workflow

How to use Jupiter docs with AI tools

The Jupiter documentation is optimized for AI-assisted development through our [`llms.txt` file](https://dev.jup.ag/llms.txt) or [`llms-full.txt` file](https://dev.jup.ag/llms-full.txt), which provides a structured index of all our APIs, guides, and resources. This page shows you how to leverage AI tools effectively when building with Jupiter.

## llms.txt

<Card title="llms.txt" href="https://dev.jup.ag/llms.txt" icon="file">
  Open the llms.txt for Jupiter docs
</Card>

A typical `llms.txt` file is a plain Markdown file with:

* The **site title** as an H1 heading.
* **Sections** for each major area of the docs, with links and short descriptions for each page.

Example structure:

```mdx theme={null}
# Jupiter

## Docs

- [Build with Jupiter](https://dev.jup.ag/index.md)
- [Get Started](https://dev.jup.ag/get-started/index.md): Welcome to Jupiter’s Developer Docs. Whether you’re building your own DeFi superapp or integrating a swap into an existing application, we provide the tools and infrastructure you need to succeed.
- [Overview](https://dev.jup.ag/docs/ultra/index.md): Overview of Ultra Swap and its features.
- [API Reference](https://dev.jup.ag/api-reference/index.md): Overview of Jupiter API Reference
- [Jupiter Tool Kits](https://dev.jup.ag/tool-kits/index.md): Powerful developer tools and SDKs that help you integrate Jupiter products into your applications with minimal effort.
- [About Routing](https://dev.jup.ag/docs/routing/index.md): The types of routing engines used in Jupiter's Swap product
- [Updates](https://dev.jup.ag/updates/index.md): API Announcements and Changes
```

This structured approach allows LLMs to efficiently process your documentation at a high level and locate relevant content for user queries, improving the accuracy and speed of AI-assisted documentation searches.

## llms-full.txt

In addition to `llms.txt`, Jupiter also provides a [`llms-full.txt`](https://dev.jup.ag/llms-full.txt) file. While `llms.txt` offers a concise, high-level index of the documentation, `llms-full.txt` contains the entire documentation site as context for AI tools - including every line description and code examples.

<Card title="llms-full.txt" href="https://dev.jup.ag/llms-full.txt" icon="file">
  Open the llms-full.txt for Jupiter docs
</Card>

* **For LLMs and AI tools** that require a complete, granular map of the documentation for deep indexing or advanced search.
* **For developers** who want to see every available page and resource in one place.
* **For building custom AI workflows** that benefit from the most detailed documentation context.

## Markdown Export

Any documentation page can be accessed as raw markdown for AI tools. There are two methods:

**Method 1: Append `.md` to the URL**

```bash theme={null}
curl https://dev.jup.ag/docs/ultra.md
curl https://dev.jup.ag/docs/ultra/get-started.md
```

**Method 2: Use the `Accept` header**

```bash theme={null}
curl -H "Accept: text/markdown" https://dev.jup.ag/docs/ultra
```

Both methods return the page content as `text/markdown`, making it easy for AI agents to consume documentation programmatically.

## Claude Code MCP

Claude Code MCP connects Claude to developer tools via the Model Context Protocol (MCP). Adding the Jupiter Docs MCP enables Claude to query our docs and OpenAPI in-context, prefill API requests, scaffold sample calls, and debug errors against the real specification. This reduces context switching, speeds up integrations, and turns natural‑language prompts into executable workflows directly in your editor.

```bash theme={null}
claude mcp add --scope user --transport http jupiter https://dev.jup.ag/mcp
```


# Audits
Source: https://dev.jup.ag/resources/audits

Formal audit reports for Jupiter programs

Jupiter protocols are audited by reputable security firms to ensure the highest level of security and reliability. The following section provides the audits of Jupiter's protocols.

## Jupiter Swap

* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/swap-v6-offside-october-2025.pdf">Offside Labs: October 2025</a> (v6)
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/swap-v6-offside-april-2024.pdf">Offside Labs: April 2024</a> (v6)
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/swap-v3-sec3.pdf">Sec3</a> (v3)

## Jupiter Perpetuals

* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/perpetual-offside.pdf">Offside Labs</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/perpetual-ottersec.pdf">OtterSec</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/perpetual-sec3.pdf">Sec3</a>

## Jupiter Lend

* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lend-ottersec-2.pdf">OtterSec Report 2: November 12 - November 20, 2025</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lend-ottersec.pdf">OtterSec Report: August 20 - November 1, 2025</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lend-oracle-and-flashloan-offside.pdf">Offside Labs - Oracle and Flashloan Report: Oct 13 - Oct 19, 2025</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lend-vault-mixbytes.pdf">Mixbytes - Vault Report: July 28 - October 14, 2025</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lend-vault-offside.pdf">Offside Labs - Vault Report: July 23 - August 4, 2025</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lend-liquidity-offside.pdf">Offside Labs - Liquidity Report: July 10 - July 18, 2025</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lend-zenith.pdf">Zenith Report: June 24 - July 31, 2025</a>

## Jupiter Limit Order

* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/limit-v2-offside.pdf">Offside Labs</a> (v2)

## Jupiter Lock

* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lock-ottersec.pdf">OtterSec</a>
* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/lock-sec3.pdf">Sec3</a>

## Jupiter DAO

* <a href="https://github.com/jup-ag/docs/tree/main/static/files/audits/dao-offside.pdf">Offside Labs</a>


# Brand Kit
Source: https://dev.jup.ag/resources/brand-kit

Logos, labelling guidelines, and brand assets for Jupiter integrations.

## Jupiter Brand Kit

<Card title="Download Jupiter Brand Kit" href="https://github.com/jup-ag/docs/tree/main/static/files/brand-kit" icon="download" />

## Labelling

When integrating with Jupiter products, you are advised to correctly label the APIs used.

<Warning>
  **For Swap**

  | API Used                          | Required Label |
  | --------------------------------- | -------------- |
  | Ultra Swap API                    | Ultra          |
  | Metis Swap API                    | Metis          |
  | Self-Hosted Metis Swap API binary | Metis          |
</Warning>


# References
Source: https://dev.jup.ag/resources/references

Links and references to Jupiter's GitHub repositories.

* [https://github.com/jup-ag/docs](https://github.com/jup-ag/docs)
* [https://github.com/jup-ag](https://github.com/jup-ag)
* [https://github.com/TeamRaccoons](https://github.com/TeamRaccoons)


# Stats
Source: https://dev.jup.ag/resources/stats

Jupiter product metrics, revenue, and usage statistics on Dune.

<Card title="Jupiter Stats" href="https://dune.com/jupiter/jupiter-the-solana-superapp" icon="chart-line">
  Take a look at Jupiter's statistics across our products, metrics, revenue and more.
</Card>


# Support
Source: https://dev.jup.ag/resources/support

Technical and customer support platforms for Jupiter

## Developer Updates

For breaking changes and updates, please use these various channels:

<Columns>
  <Card href="https://discord.com/channels/897540204506775583/1115543693005430854" icon="discord">
    Discord
  </Card>

  <Card href="https://t.me/jup_dev" icon="telegram">
    Telegram
  </Card>
</Columns>

***

## Developer Support

Jupiter provides developer tools and resources to help you integrate with Jupiter. There are currently 2 ways to get technical support:

<Columns>
  <Card href="https://discord.com/channels/897540204506775583/910250162402779146" icon="discord">
    Discord Dev Support
  </Card>

  <Card href="https://support.jup.ag/hc/en-us/requests/new?ticket_form_id=18069133114012&tf_18541841140892=api_or_developer_support" icon="message">
    Portal Enquiry
  </Card>
</Columns>

<Warning>
  **WARNING**

  Please use the Discord channel for your technical questions, as it is a public channel, more people can help you and it promotes discovery/discussion.

  If you open a ticket via the link that **does not relate** to Portal Enquiries, we will redirect you to the Discord channel.
</Warning>

***

## Customer Support

The Jupiter UI contains multiple safeguards, warnings and default settings to guide our users to trade safer. However, when you integrate with Jupiter, we cannot control these elements despite sharing best practices, hence, Jupiter is not liable for any losses incurred on your UI/platform.

The only exception is for Jupiter Ultra Swap API, where you can use our ticketing system to provide support to your users.

<Warning>
  **WARNING**

  We are still in the process of finalizing the Ultra Swap API customer support process.

  Reach out to [us](https://t.me/Yankee0x) to discuss what is the best way to support your users.
</Warning>


# Jupiter Tool Kits
Source: https://dev.jup.ag/tool-kits/index

Powerful developer tools and SDKs that help you integrate Jupiter products into your applications with minimal effort.

## Overview

Jupiter Tool Kits are a comprehensive collection of developer tools designed to accelerate your integration with Jupiter's ecosystem.

<CardGroup>
  <Card title="Developer First" icon="code">
    Pre-built components and SDKs designed for rapid development and seamless integration.
  </Card>

  <Card title="Open Source" icon="github">
    Inspect and contribute to all of our tools and resources to build on top of Jupiter.
  </Card>
</CardGroup>

## Tool Kits

### Quick Launch

<Card title="Jupiter Plugin" icon="puzzle-piece" href="/tool-kits/plugin">
  Embed full end-to-end Ultra Swap widget in just a few lines of code.

  **Key Features:**

  * Pre-built Ultra Swap API and widget
  * Wallet adapter handling
  * Multiple display modes (integrated, widget, modal)
  * Customizable themes and styling
  * Mobile responsive
</Card>

<Card title="Jupiter Wallet Kit" icon="wallet" href="/tool-kits/wallet-kit">
  Swiss army knife wallet adapter that simplifies wallet connectivity across all Solana wallets.

  **Key Features:**

  * Unified interface with simplified wallet management
  * Built-in event handling and error handling
  * Support for all wallet standard and most Solana wallets.
  * Including Jupiter Wallet Extension and Jupiter Mobile Adapter.

  <CardGroup>
    <Card title="Jupiter Wallet Extension" icon="puzzle-piece" href="/tool-kits/wallet-kit/jupiter-wallet-extension" />

    <Card title="Jupiter Mobile Adapter" icon="mobile" href="/tool-kits/wallet-kit/jupiter-mobile-adapter" />
  </CardGroup>
</Card>

### Integrator Fee

<Card title="Referral Program" icon="handshake" href="/tool-kits/referral-program">
  Monetize your integration by earning fees on user trades.

  **Key Features:**

  * Transparent on-chain revenue sharing
  * Easy setup and tracking
  * [Enables Ultra Swap API to earn fees](/docs/ultra/add-fees-to-ultra)
</Card>

### Community Built Tool Kits

<CardGroup>
  <Card title="Jupiverse Kit" icon="rocket" href="https://jupiversekit.xyz/">
    Ready-to-use React components for building with Jupiter Plugin and Wallet Kit.
  </Card>

  <Card title="DevRel Examples" icon="github" href="https://github.com/Jupiter-DevRel">
    Comprehensive collection of scripts and examples to build with Solana and Jupiter.
  </Card>
</CardGroup>

## Developer Support

<CardGroup>
  <Card title="Discord Community" icon="discord" href="https://discord.gg/jup">
    Join thousands of developers building with Jupiter. Get help, share ideas, and collaborate.
  </Card>

  <Card title="GitHub" icon="github" href="https://github.com/jup-ag">
    Contribute to our open-source tools, report issues, and submit feature requests.
  </Card>

  <Card title="Documentation" icon="book" href="https://github.com/jup-ag/docs">
    Contribute to our developer documentation and share your knowledge with the community.
  </Card>
</CardGroup>

## How to Contribute

We welcome contributions from developers of all skill levels! Here's how you can help:

<Tabs>
  <Tab title="Developers">
    * **Submit Pull Requests**: Improve existing tools or add new features
    * **Report Issues**: Help us identify and fix bugs
    * **Create Examples**: Share integration examples with the community
    * **Write Documentation**: Help improve our guides and tutorials
  </Tab>

  <Tab title="Non-Technical">
    * **Join Discord**: Share ideas and provide feedback on developer experience
    * **Test Tools**: Help us identify usability issues and improvement opportunities
    * **Spread the Word**: Share Jupiter Tool Kits with other developers
    * **Community Support**: Help other developers in our Discord community
  </Tab>
</Tabs>


# Customizing Plugin
Source: https://dev.jup.ag/tool-kits/plugin/customization

Learn how to customize Jupiter Plugin's appearance and behavior.

<Info>
  Try out the [Plugin Playground](https://plugin.jup.ag/) to experience the full swap features and see the different customization options with code snippets.

  For the full customization options, you can refer to the [repository](https://github.com/jup-ag/plugin/blob/main/src/types/index.d.ts).
</Info>

If you are using TypeScript, you can use the type declaration file to get the full type definitions for the Plugin.

<Accordion title="Full TypeScript Declaration">
  ```js theme={null}
    declare global {
      interface Window {
          Jupiter: JupiterPlugin;
      }
  }

  export type WidgetPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  export type WidgetSize = 'sm' | 'default';
  export type SwapMode = "ExactInOrOut" | "ExactIn" | "ExactOut";
  export type DEFAULT_EXPLORER = 'Solana Explorer' | 'Solscan' | 'Solana Beach' | 'SolanaFM';

  export interface FormProps {
      swapMode?: SwapMode;
      initialAmount?: string;
      initialInputMint?: string;
      initialOutputMint?: string;
      fixedAmount?: boolean;
      fixedMint?: string;
      referralAccount?: string;
      referralFee?: number;
  }

  export interface IInit {
      localStoragePrefix?: string;
      formProps?: FormProps;
      defaultExplorer?: DEFAULT_EXPLORER;
      autoConnect?: boolean;
      displayMode?: 'modal' | 'integrated' | 'widget';
      integratedTargetId?: string;
      widgetStyle?: {
          position?: WidgetPosition;
          size?: WidgetSize;
      };
      containerStyles?: CSSProperties;
      containerClassName?: string;
      enableWalletPassthrough?: boolean;
      passthroughWalletContextState?: WalletContextState;
      onRequestConnectWallet?: () => void | Promise<void>;
      onSwapError?: ({
          error,
          quoteResponseMeta,
      }: {
          error?: TransactionError;
          quoteResponseMeta: QuoteResponse | null;
      }) => void;
      onSuccess?: ({
          txid,
          swapResult,
          quoteResponseMeta,
      }: {
          txid: string;
          swapResult: SwapResult;
          quoteResponseMeta: QuoteResponse | null;
      }) => void;
      onFormUpdate?: (form: IForm) => void;
      onScreenUpdate?: (screen: IScreen) => void;
  }

  export interface JupiterPlugin {
      _instance: JSX.Element | null;
      init: (props: IInit) => void;
      resume: () => void;
      close: () => void;
      root: Root | null;
      enableWalletPassthrough: boolean;
      onRequestConnectWallet: IInit['onRequestConnectWallet'];
      store: ReturnType<typeof createStore>;
      syncProps: (props: { passthroughWalletContextState?: IInit['passthroughWalletContextState'] }) => void;
      onSwapError: IInit['onSwapError'];
      onSuccess: IInit['onSuccess'];
      onFormUpdate: IInit['onFormUpdate'];
      onScreenUpdate: IInit['onScreenUpdate'];
      localStoragePrefix: string;
  }

  export { };
  ```
</Accordion>

## Display Modes

Jupiter Plugin offers three distinct display modes to suit different use cases:

### 1. Integrated Mode

The integrated mode embeds the swap form directly into your application's layout. This is ideal for creating a seamless swap experience within your dApp.

```js theme={null}
{
  displayMode: "integrated";
  integratedTargetId: string; // Required: ID of the container element
  containerStyles?: {
    width?: string;
    height?: string;
    borderRadius?: string;
    overflow?: string;
  };
  containerClassName?: string;
}
```

### 2. Widget Mode

The widget mode creates a floating swap form that can be positioned in different corners of the screen. Perfect for quick access to swaps without taking up too much space.

```js theme={null}
{
  displayMode: "widget";
  widgetStyle?: {
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    size?: "sm" | "default";
  };
}
```

### 3. Modal Mode

The modal mode displays the swap form in a popup overlay. This is useful when you want to keep the swap form hidden until needed.

```js theme={null}
{
  displayMode: "modal";
}
```

## Form Props Configuration

The `formProps` object allows you to customize the initial state and behavior of the swap form! This can be useful for use cases like fixed token swaps for memecoin communities or fixed amount payments.

```js theme={null}
{
  displayMode: "modal";
  formProps?: {
    swapMode?: SwapMode; // Set the swap mode to "ExactIn", "ExactOut", or default to "ExactInOrOut"

    initialAmount?: string; // Pre-fill the swap amount (e.g. "100")
    initialInputMint?: string; // Pre-select the input token by its mint address
    initialOutputMint?: string; // Pre-select the output token by its mint address

    fixedAmount?: boolean; // When true, users cannot change the swap amount
    fixedMint?: string; // Lock one side of the swap to a specific token by its mint address

    referralAccount?: string; // Set the referral account for the swap
    referralFee?: number; // Set the referral fee for the swap
  }
}
```

## Wallet Integration

Jupiter Plugin supports third-party wallet integration through the `enableWalletPassthrough` prop. This allows your application to pass through an existing wallet provider's connection in your application to Plugin. If you do not have an existing wallet provider, Plugin will provide a wallet adapter and connection - powered by [Unified Wallet Kit](/tool-kits/wallet-kit/).

```js theme={null}
{
  // When true, wallet connection are handled by your dApp,
  // and use `syncProps()` to syncronise wallet state with Plugin.
  enableWalletPassthrough?: boolean;

    // Optional, if wallet state is ready, 
  // you can pass it in here, or just use `syncProps()`
  passthroughWalletContextState?: WalletContextState;

  // When enableWalletPassthrough is true, this allows Plugin
  // to callback your app's wallet connection flow
  onRequestConnectWallet?: () => void | Promise<void>;
}
```

## Event Handling

Jupiter Plugin provides event handlers to track swap operations:

```js theme={null}
{
  onSuccess: ({ txid, swapResult, quoteResponseMeta }) => {
    // Handle successful swap
    console.log("Swap successful:", txid);
  };
  onSwapError: ({ error, quoteResponseMeta }) => {
    // Handle swap errors
    console.error("Swap failed:", error);
  }
}
```

## Branding

Jupiter Plugin supports branding through the `branding` prop. This allows you to customize the Plugin's logo and name to include your own branding.

```js theme={null}
{
  branding?: {
    logoUri?: string;
    name?: string;
  };
}
```

## Color Theme

Jupiter Plugin supports a simplified way to customize the color theme. This allows you to match the appearance of the Plugin to your brand.

```js theme={null}
/* In your global CSS file */
:root {
  --jupiter-plugin-primary: 199, 242, 132;
  --jupiter-plugin-background: 0, 0, 0;
  --jupiter-plugin-primaryText: 232, 249, 255;
  --jupiter-plugin-warning: 251, 191, 36;
  --jupiter-plugin-interactive: 33, 42, 54;
  --jupiter-plugin-module: 16, 23, 31;
}
```

## Examples

### Fixed SOL Swap

```js theme={null}
window.Jupiter.init({
  displayMode: "integrated";
  integratedTargetId: "jupiter-plugin";
  formProps: {
    initialInputMint: "So11111111111111111111111111111111111111112"; // SOL
    initialOutputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC
    fixedMint: "So11111111111111111111111111111111111111112";
  };
});
```

### Payment Integration

```js theme={null}
window.Jupiter.init({
  displayMode: "modal";
  formProps: {
    swapMode: "ExactOut";
    initialAmount: "10";
    fixedAmount: true;
    initialOutputMint: "YOUR_TOKEN_MINT";
    fixedMint: "YOUR_TOKEN_MINT";
  };
});
```

### Floating Widget

```js theme={null}
window.Jupiter.init({
  displayMode: "widget";
  widgetStyle: {
    position: "bottom-right";
    size: "sm";
  };
});
```


# FAQ
Source: https://dev.jup.ag/tool-kits/plugin/faq

Frequently asked questions about Jupiter Plugin

Common questions and answers about Jupiter Plugin, including how to request features, add referral fees, fix integrated mode layout issues, and follow best practices for responsive design, user experience, and security.

<AccordionGroup>
  <Accordion title="How do I feature request or get support?">
    * For feature requests, please open an issue on the [GitHub repository](https://github.com/jup-ag/plugin/issues) and tag us on Discord.
    * For support, please join the [Discord server](https://discord.gg/jup) and get help in the developer channels.
  </Accordion>

  <Accordion title="How do I add fees to Plugin?">
    * **Creating Referral Account and Token Accounts**: You can create via [scripts](/docs/ultra/add-fees-to-ultra) or [Referral Dashboard](https://referral.jup.ag).
    * **Adding to FormProps**: You can set the referral account and fee in the [`formProps` interface](/tool-kits/plugin/customization#form-props-configuration) when you initialize the Plugin.
  </Accordion>

  <Accordion title="Integrated Mode: Token Search Modal Collapses Plugin">
    * Ensure you establish a fixed height for the swap form container under `containerStyles`

    ```js theme={null}
    {
       displayMode: "integrated",
       integratedTargetId: "jupiter-plugin",
       containerStyles: {
          height: "500px",
       },
    }
    ```
  </Accordion>
</AccordionGroup>

## Best Practices for Customization

<AccordionGroup>
  <Accordion title="Responsive Design">
    * Use percentage-based widths for container styles
    * Test on different screen sizes
    * Consider mobile-first design
  </Accordion>

  <Accordion title="User Experience">
    * Position widgets in easily accessible locations
    * Consider fixed token pairs for specific use cases
    * Implement proper error handling and prompts
  </Accordion>

  <Accordion title="Security">
    * Use environment variables for sensitive data
    * Implement proper error boundaries
    * Validate user inputs
  </Accordion>
</AccordionGroup>


# HTML App Example
Source: https://dev.jup.ag/tool-kits/plugin/html-app-example

Step-by-step guide to integrate Jupiter Plugin into a plain HTML application.

This guide walks through integrating Jupiter Plugin into a plain HTML application from scratch. You will add the plugin script tag, initialize with `window.Jupiter.init()`, and serve the page with http-server.

## Prerequisites

Before you begin, make sure you have the following installed on your system.

**Node.js and npm**: Download and install from [nodejs.org](https://nodejs.org) **http-server**: Download and install [http-server from npm](https://www.npmjs.com/package/http-server)

## Step 1: Create a New HTML Project

Head to your preferred directory and create a new folder for your project:

```bash theme={null}
mkdir plugin-democd
plugin-demotouch
index.html
```

## Step 2: Add the Plugin Script

Add the Plugin script to your project:

```bash expandable theme={null}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jupiter Plugin Demo</title>
    <script src="https://plugin.jup.ag/plugin-v1.js" data-preload defer></script>
    <style>
        .container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Jupiter Plugin Demo</h1>
        <div id="jupiter-plugin"></div>
    </div>

    <script>
        window.onload = function() {
            window.Jupiter.init({
                displayMode: "widget",
                integratedTargetId: "jupiter-plugin",
            });
        };
    </script>
</body>
</html>
```

## Step 3: Run the Project

Run the project using `http-server`:

```bash theme={null}
http-server
```

There you have it! You've successfully integrated Jupiter Plugin into your HTML application.

* Please test the swap functionality and check the transaction.
* If you require more customizations, check out the [Plugin Playground](https://plugin.jup.ag) or the [Customization](/tool-kits/plugin/customization) documentation.
* If you have any questions or issues, please refer to the [FAQ](/tool-kits/plugin/faq) or contact us on [Discord](https://discord.gg/jup).


# Integrate Jupiter Plugin
Source: https://dev.jup.ag/tool-kits/plugin/index

Seamlessly integrate end-to-end Ultra Swap functionality into any application with just a few lines of code.

Jupiter Plugin is an open-source, lightweight, plug-and-play version of Jupiter Ultra Swap, allowing you to bring the exact jup.ag swap experience to any application.

Try out the [Plugin Playground](https://plugin.jup.ag/) to experience the entire suite of customizations.

To view the open-source code, visit the [GitHub repository](https://github.com/jup-ag/plugin).

<Frame>
  <a href="https://plugin.jup.ag/">
    <img alt="Plugin Playground" />
  </a>
</Frame>

<Note>
  **QUICK START**

  To quick start your integration, check out the [Next.js](/tool-kits/plugin/nextjs-app-example), [React](/tool-kits/plugin/react-app-example) or [HTML](/tool-kits/plugin/html-app-example) app examples.

  Refer to [Customization](/tool-kits/plugin/customization) and [FAQ](/tool-kits/plugin/faq) for more information.
</Note>

## Key Features

* **Seamless Integration**: Embed Jupiter's swap functionality directly into your application without redirects.
* **Multiple Display Options**: Choose between integrated, widget, or modal display modes.
* **Customizable Options**: Configure the swap form to match your application's needs.
* **RPC-less**: Integrate Plugin without any RPCs, Ultra handles transaction sending, wallet balances and token information.
* **Ultra Mode**: Access to all features of Ultra Mode, read more about it in the [Ultra Swap API docs](/docs/ultra/).

## Getting Started

When integrating Plugin, there are a few integration methods to think about, and choose the one that best fits your application's architecture and requirements.

### Integration Methods

* **Using Window Object** - Simplest way to add and initialize Plugin.
* [**Using NPM Package**](https://www.npmjs.com/package/@jup-ag/plugin) - Install via `npm install @jup-ag/plugin` and initialize as a module (will require you to maintain its dependencies).

### Wallet Integration

* **Wallet Standard Support**: For applications without existing wallet provider, Plugin will provide a wallet adapter and connection - powered by [Unified Wallet Kit](/tool-kits/wallet-kit/).
* **Passthrough Wallet**: For applications with existing wallet provider(s), set `enableWalletPassthrough=true` with context, and Plugin will allow the application to pass through the existing wallet provider's connection to Plugin.

### Adding Fees to plugin

* **Referral Account**: You can create a referral account via [scripts](/docs/ultra/add-fees-to-ultra) or [Referral Dashboard](https://referral.jup.ag/).
* **Referral Fee**: You can set the referral fee and account in the `formProps` interface when you initialize the Plugin.

### Quick Start Guides

In the next sections, we'll walk you through the steps to integrate Jupiter Plugin into different types of web applications from scratch.

<CardGroup>
  <Card href="/tool-kits/plugin/nextjs-app-example" icon="N" title="Next.js" />

  <Card href="/tool-kits/plugin/react-app-example" icon="react" title="React" />

  <Card href="/tool-kits/plugin/html-app-example" icon="html5" title="HTML" />
</CardGroup>

By integrating Jupiter Plugin into your application, you can seamlessly integrate a fully functional swap interface into your application with minimal effort, while staying at the forefront of Solana DeFi innovation.


# Next.js App Example
Source: https://dev.jup.ag/tool-kits/plugin/nextjs-app-example

Step-by-step guide to integrate Jupiter Plugin into a Next.js application.

This guide walks through integrating Jupiter Plugin into a Next.js application from scratch. It covers both App Router and Pages Router setups, TypeScript declarations, and two initialization methods: the window object approach and the `@jup-ag/plugin` npm package.

## Prerequisites

Before you begin, make sure you have the following installed on your system.

**Node.js and npm**: Download and install from [nodejs.org](https://nodejs.org)

## Step 1: Create a New Next.js Project

Head to your preferred directory and create a new Next.js project using `create-next-app` with TypeScript template (you can use other templates or methods to start your project too):

```bash theme={null}
npx create-next-app@latest plugin-demo --typescript
cd plugin-demo
npm run dev
```

## Step 2: Add TypeScript Support

Create a type declaration file `plugin.d.ts` in your project's `/src/types` folder:

```js theme={null}
declare global {
  interface Window {
    Jupiter: JupiterPlugin;
  }
};
export {};
```

<Accordion title="Full TypeScript Declaration">
  ```js theme={null}
   declare global {
      interface Window {
          Jupiter: JupiterPlugin;
      }
  }

  export type WidgetPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  export type WidgetSize = 'sm' | 'default';
  export type SwapMode = "ExactInOrOut" | "ExactIn" | "ExactOut";
  export type DEFAULT_EXPLORER = 'Solana Explorer' | 'Solscan' | 'Solana Beach' | 'SolanaFM';

  export interface FormProps {
      swapMode?: SwapMode;
      initialAmount?: string;
      initialInputMint?: string;
      initialOutputMint?: string;
      fixedAmount?: boolean;
      fixedMint?: string;
      referralAccount?: string;
      referralFee?: number;
  }

  export interface IInit {
      localStoragePrefix?: string;
      formProps?: FormProps;
      defaultExplorer?: DEFAULT_EXPLORER;
      autoConnect?: boolean;
      displayMode?: 'modal' | 'integrated' | 'widget';
      integratedTargetId?: string;
      widgetStyle?: {
          position?: WidgetPosition;
          size?: WidgetSize;
      };
      containerStyles?: CSSProperties;
      containerClassName?: string;
      enableWalletPassthrough?: boolean;
      passthroughWalletContextState?: WalletContextState;
      onRequestConnectWallet?: () => void | Promise<void>;
      onSwapError?: ({
          error,
          quoteResponseMeta,
      }: {
          error?: TransactionError;
          quoteResponseMeta: QuoteResponse | null;
      }) => void;
      onSuccess?: ({
          txid,
          swapResult,
          quoteResponseMeta,
      }: {
          txid: string;
          swapResult: SwapResult;
          quoteResponseMeta: QuoteResponse | null;
      }) => void;
      onFormUpdate?: (form: IForm) => void;
      onScreenUpdate?: (screen: IScreen) => void;
  }

  export interface JupiterPlugin {
      _instance: JSX.Element | null;
      init: (props: IInit) => void;
      resume: () => void;
      close: () => void;
      root: Root | null;
      enableWalletPassthrough: boolean;
      onRequestConnectWallet: IInit['onRequestConnectWallet'];
      store: ReturnType<typeof createStore>;
      syncProps: (props: { passthroughWalletContextState?: IInit['passthroughWalletContextState'] }) => void;
      onSwapError: IInit['onSwapError'];
      onSuccess: IInit['onSuccess'];
      onFormUpdate: IInit['onFormUpdate'];
      onScreenUpdate: IInit['onScreenUpdate'];
      localStoragePrefix: string;
  }

  export { };
  ```
</Accordion>

## Step 3: Embed the Plugin Script

For Next.js applications, you can add the script in two ways:

### Using App Router (Next.js 13+)

In your `app/layout.tsx`:

```js theme={null}
import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://plugin.jup.ag/plugin-v1.js"
          strategy="beforeInteractive"
          data-preload
          defer
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Using Pages Router

In your `pages/_app.tsx`:

```js theme={null}
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Script from "next/script";

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Script
        src="https://plugin.jup.ag/plugin-v1.js"
        strategy="beforeInteractive"
        data-preload
        defer
      />
      <Component {...pageProps} />
    </>
  );
}
```

## Step 4: Initialize Plugin

There are two ways to initialize Jupiter Plugin in a Next.js application:

### Method 1: Using Window Object

Create a new component for the plugin at `components/plugin.tsx`:

```js theme={null}
"use client";

import React, { useEffect } from "react";

export default function PluginComponent() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.Jupiter.init({
        displayMode: "widget",
        integratedTargetId: "jupiter-plugin",
      });
    }
  }, []);

  return (
    <div>
      <h1>Jupiter Plugin Demo</h1>
      <div
        id="jupiter-plugin"
      />
    </div>
  );
}
```

### Method 2: Using @jup-ag/plugin Package

<Warning>
  **WARNING**

  Do note that using this method will require you to maintain its dependencies.
</Warning>

<Steps>
  <Step>
    Install the package:

    ```bash theme={null}
    npm install @jup-ag/plugin
    ```
  </Step>

  <Step>
    Create a new component for the plugin at `components/plugin.tsx`:

    ```js theme={null}
    "use client";

    import React, { useEffect } from "react";
    import "@jup-ag/plugin/css";

    export default function PluginComponent() {
      useEffect(() => {
        import("@jup-ag/plugin").then((mod) => {
          const { init } = mod;
          init({
            displayMode: "widget",
            integratedTargetId: "jupiter-plugin",
          });
        });
      }, []);

      return (
        <div>
          <h1>Jupiter Plugin Demo</h1>
          <div id="jupiter-plugin" />
        </div>
      );
    }
    ```
  </Step>
</Steps>

## Step 5: Add the Plugin Component to Your Page

In your `app/page.tsx` (or `pages/index.tsx` if you're using Pages Router):

```js theme={null}
import PluginComponent from '@/components/plugin';

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <PluginComponent />
    </div>
  );
}
```

There you have it! You've successfully integrated Jupiter Plugin into your Next.js application.

* Please test the swap functionality and check the transaction.
* If you require more customizations, check out the [Plugin Playground](https://plugin.jup.ag) or the [Customization](/tool-kits/plugin/customization) documentation.
* If you have any questions or issues, please refer to the [FAQ](/tool-kits/plugin/faq) or contact us on [Discord](https://discord.gg/jup).


# React App Example
Source: https://dev.jup.ag/tool-kits/plugin/react-app-example

Step-by-step guide to integrate Jupiter Plugin into a React application.

This guide walks through integrating Jupiter Plugin into a React application from scratch. It covers TypeScript declarations, embedding the plugin script, and two initialization methods: the window object approach and the `@jup-ag/plugin` npm package.

## Prerequisites

Before you begin, make sure you have the following installed on your system.

**Node.js and npm**: Download and install from [nodejs.org](https://nodejs.org)

## Step 1: Create a New React Project

Head to your preferred directory and create a new React project using `create-react-app` with TypeScript template (you can use other templates or methods to start your project too):

```bash theme={null}
npx create-react-app plugin-demo --template typescript
cd plugin-demo
npm start
```

## Step 2: Add TypeScript Support

Create a type declaration file `plugin.d.ts` in your project's `/src/types` folder:

```bash theme={null}
declare global {
  interface Window {
    Jupiter: JupiterPlugin;
  }
};
export {};
```

<Accordion title="Full TypeScript Declaration">
  ```bash theme={null}
  declare global {
    interface Window {
        Jupiter: JupiterPlugin;
    }
  }

  export type WidgetPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  export type WidgetSize = 'sm' | 'default';
  export type SwapMode = "ExactInOrOut" | "ExactIn" | "ExactOut";
  export type DEFAULT_EXPLORER = 'Solana Explorer' | 'Solscan' | 'Solana Beach' | 'SolanaFM';

  export interface FormProps {
    swapMode?: SwapMode;
    initialAmount?: string;
    initialInputMint?: string;
    initialOutputMint?: string;
    fixedAmount?: boolean;
    fixedMint?: string;
    referralAccount?: string;
    referralFee?: number;
  }

  export interface IInit {
    localStoragePrefix?: string;
    formProps?: FormProps;
    defaultExplorer?: DEFAULT_EXPLORER;
    autoConnect?: boolean;
    displayMode?: 'modal' | 'integrated' | 'widget';
    integratedTargetId?: string;
    widgetStyle?: {
        position?: WidgetPosition;
        size?: WidgetSize;
    };
    containerStyles?: CSSProperties;
    containerClassName?: string;
    enableWalletPassthrough?: boolean;
    passthroughWalletContextState?: WalletContextState;
    onRequestConnectWallet?: () => void | Promise<void>;
    onSwapError?: ({
        error,
        quoteResponseMeta,
    }: {
        error?: TransactionError;
        quoteResponseMeta: QuoteResponse | null;
    }) => void;
    onSuccess?: ({
        txid,
        swapResult,
        quoteResponseMeta,
    }: {
        txid: string;
        swapResult: SwapResult;
        quoteResponseMeta: QuoteResponse | null;
    }) => void;
    onFormUpdate?: (form: IForm) => void;
    onScreenUpdate?: (screen: IScreen) => void;
  }

  export interface JupiterPlugin {
    _instance: JSX.Element | null;
    init: (props: IInit) => void;
    resume: () => void;
    close: () => void;
    root: Root | null;
    enableWalletPassthrough: boolean;
    onRequestConnectWallet: IInit['onRequestConnectWallet'];
    store: ReturnType<typeof createStore>;
    syncProps: (props: { passthroughWalletContextState?: IInit['passthroughWalletContextState'] }) => void;
    onSwapError: IInit['onSwapError'];
    onSuccess: IInit['onSuccess'];
    onFormUpdate: IInit['onFormUpdate'];
    onScreenUpdate: IInit['onScreenUpdate'];
    localStoragePrefix: string;
  }

  export { };
  ```
</Accordion>

## Step 3: Embed the Plugin Script

In your `/public/index.html`, add the Jupiter Plugin script:

```bash theme={null}
<head>
  <script src="https://plugin.jup.ag/plugin-v1.js" data-preload defer></script>
</head>
```

## Step 4: Initialize Plugin

There are two ways to initialize Jupiter Plugin in a React application:

### Method 1: Using Window Object

In your `/src/App.tsx`, use the following code to initialize the plugin.

```bash theme={null}
import React, { useEffect } from 'react';
import './App.css';
import './types/plugin.d';

export default function App() {
  useEffect(() => {
    // Initialize plugin
    window.Jupiter.init({
      displayMode: "widget",
      integratedTargetId: "jupiter-plugin",
    });
  }, []);

  return (
    <div className="App">
      <h1>Jupiter Plugin Demo</h1>
      <div id="jupiter-plugin" />
    </div>
  );
}
```

### Method 2: Using @jup-ag/plugin Package

<Warning>
  **WARNING**

  Do note that using this method will require you to maintain its dependencies.
</Warning>

<Steps>
  <Step>
    Install the package:

    ```bash theme={null}
    npm install @jup-ag/plugin
    ```
  </Step>

  <Step>
    Initialize the plugin:

    ```bash theme={null}
    import React, { useEffect } from "react";
    import "@jup-ag/plugin/css";
    import "./App.css";
    import "./types/plugin.d";

    export default function App() {
      useEffect(() => {
        import("@jup-ag/plugin").then((mod) => {
          const { init } = mod;
          init({
            displayMode: "widget",
            integratedTargetId: "jupiter-plugin",
          });
        });
      }, []);

      return (
        <div>
          <h1>Jupiter Plugin Demo</h1>
          <div id="jupiter-plugin" />
        </div>
      );
    }
    ```
  </Step>
</Steps>

There you have it! You've successfully integrated Jupiter Plugin into your Next.js application.

* Please test the swap functionality and check the transaction.
* If you require more customizations, check out the [Plugin Playground](https://plugin.jup.ag) or the [Customization](/tool-kits/plugin/customization) documentation.
* If you have any questions or issues, please refer to the [FAQ](/tool-kits/plugin/faq) or contact us on [Discord](https://discord.gg/jup).


# Referral Program
Source: https://dev.jup.ag/tool-kits/referral-program

Earn on-chain fees from user trades through the open-source Jupiter Referral Program.

The Referral Program is an open-source on-chain program that lets developers earn fees through Jupiter API integrations. It supports Ultra Swap API, Swap API, Trigger API, and Plugin. Any Solana program can also integrate the Referral Program to share revenue with its own integrators.

<Note>
  **REFERRAL PROGRAM SOURCE CODE**

  [Open Source Repository](https://github.com/TeamRaccoons/referral): To understand and make use of the referral program better.
</Note>

## Jupiter API Integrators

The Jupiter Programs use the Referral Program to allow developers to earn fees when integrating with Jupiter. Below are some resources to help you quickly get started. There are a different ways to setup such as via the Jupiter Referral Dashboard or using the provided scripts.

* [Jupiter Referral Dashboard](https://referral.jup.ag/): To view and manage your referral accounts used with Jupiter APIs.
* [Add Fees to Ultra Swap API](/docs/ultra/add-fees-to-ultra): To add fees to your Ultra Swap API integration.
* [Add Fees to Swap and Trigger API](/docs/swap/add-fees-to-swap): To add fees to your Swap and Trigger API integration.
* [Add Fees to Jupiter Plugin](/tool-kits/plugin#adding-fees-to-plugin): To add fees to your Plugin integration.

## Other Program Integrators

### Project Usage

If you have a project/product that runs a program on the Solana blockchain, you can integrate the Referral Program to allow/share revenue with the integrators of your program.

Similar to how Jupiter Programs uses the Referral Program to help developers earn fees and/or share the revenue with Jupiter. For example, Jupiter Ultra uses the Jupiter Swap program which relies on the Referral Program.

* Create a `Project` by calling `initialize_project` with your chosen `base` key and a project `name` (`base` key refers to a key identifier of your project).
* Set a `default_share_bps` to share the fees with your referrers (or integrators).
* An example of a `Project` account: [Jupiter Ultra Project](https://solscan.io/account/DkiqsTrw1u1bYFumumC7sCG2S8K25qc2vemJFHyW2wJc)

### Referrer Usage

If you are a referrer such as a developer or integrator of a project that runs a program on the Solana blockchain, you can create the necessary accounts via the Referral Program to earn fees.

* The program must be integrated with the Referral Program.
* Create a `Referral` account by calling `initialize_referral_account` with the correct `Project` account, the `Referral` account, and your own `Partner` account (`Partner` account is the admin of this referral account).
* Create the necessary `Referral` token accounts for the `Referral` account to receive fees in.


# Integrate Wallet Kit
Source: https://dev.jup.ag/tool-kits/wallet-kit/index

Integrate Jupiter Wallet Kit into your application to simplify wallet connectivity across all Solana wallets, all in a unified wallet interface

The Jupiter Wallet Kit is an open-source, Swiss Army Knife wallet adapter designed to streamline your development on Solana by eliminating redundancies and providing wallet adapter building blocks in a simple, plug-and-play package. This allows developers to focus on what matters most: building innovative features for your users.

## Overview

<Card title="Jupiter Wallet Kit Features" icon="list-check">
  * Creating a wallet notification system.
  * Managing wallet states (connected, disconnected, etc).
  * Implementing a mobile-friendly wallet connector.
  * Support for 20+ wallet adapters via a unified interface.
  * Support for all wallets built with [Solana's Wallet Standard](https://github.com/anza-xyz/wallet-standard).
  * Support for [Jupiter Wallet Extension](/tool-kits/wallet-kit/jupiter-wallet-extension).
  * Support for [Jupiter Mobile Adapter QR code login](/tool-kits/wallet-kit/jupiter-mobile-adapter).
</Card>

<CardGroup>
  <Card title="Wallet Kit Playground" href="https://unified.jup.ag/" icon="arrow-pointer">
    To play with different settings,features and styling.
  </Card>

  <Card title="Open Source Repo" href="https://github.com/TeamRaccoons/Unified-Wallet-Kit" icon="github">
    To understand and make use of the wallet adapter better.
  </Card>

  <Card title="Quick Examples" href="https://github.com/TeamRaccoons/Unified-Wallet-Kit/tree/main/src/components/examples" icon="code">
    To reference code snippets and examples.
  </Card>
</CardGroup>

## Technical Features

| Feature                       | Description                                                                                                          |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| **Compact Bundle**            | Main ESM bundle is a lightweight 94KB (20KB gzipped).                                                                |
| **Built-in Support**          | Comes with Wallet Standard and Mobile Wallet Adapter support.                                                        |
| **Abstracted Wallet Adapter** | Use the Bring Your Own Wallet (BYOW) approach to select custom and legacy wallets.                                   |
| **Mobile Responsive**         | Designed to be mobile-first.                                                                                         |
| **Smart Notification System** | Integrates seamlessly with your existing notification system or can be used independently.                           |
| **Internationalization**      | Supports multiple languages including English, Chinese, Vietnamese, French, Japanese, Bahasa Indonesia, and Russian. |
| **Theming Options**           | Choose from light, dark, and Jupiter modes, with more customization options coming soon.                             |
| **New User Onboarding**       | Simplifies the onboarding process for new users.                                                                     |


# Jupiter Mobile Adapter
Source: https://dev.jup.ag/tool-kits/wallet-kit/jupiter-mobile-adapter

Integrate Jupiter Mobile QR code login into your app with WalletConnect support.

The Jupiter Mobile Adapter lets users connect to your application by scanning a QR code with Jupiter Mobile. It uses the `@jup-ag/jup-mobile-adapter` package and Reown's AppKit for WalletConnect integration. This guide covers installation, Reown project ID setup, and adding the adapter to Wallet Kit.

<Note>
  The Jupiter Mobile Adapter allows you to integrate Jupiter Mobile login functionality into your app! By allowing Jupiter Mobile users to simply use the app to scan a QR code to login, they can utilize their wallets on Jupiter Mobile across any platform.
</Note>

## Overview

<Steps>
  <Step>
    Install [@jup-ag/jup-mobile-adapter](https://www.npmjs.com/package/@jup-ag/jup-mobile-adapter)
  </Step>

  <Step>
    Use `useWrappedReownAdapter` (Prerequisite to create an app id on [https://dashboard.reown.com/](https://dashboard.reown.com/))
  </Step>

  <Step>
    Add the `jupiterAdapter` to wallets
  </Step>
</Steps>

## Prerequisite

Building on top of the example in [Jupiter Wallet Extension example](/tool-kits/wallet-kit/jupiter-wallet-extension), we will pass in the Jupiter Mobile Adapter (which uses Reown's AppKit).

## Step 1: Install dependency

You will need to install the following dependency:

```bash theme={null}
npm i @jup-ag/jup-mobile-adapter
```

<Card title="Download Jupiter Mobile">
  <CardGroup>
    <Card title="iOS" icon="apple" href="https://apps.apple.com/us/app/jupiter-mobile/id6484069059" />

    <Card title="Android" icon="android" href="https://play.google.com/store/apps/details?id=ag.jup.jupiter.android" />

    <Card title="Web" icon="globe" href="https://jup.ag/mobile" />
  </CardGroup>
</Card>

## Step 2: Get Reown project ID

You need to input the project ID on from your [Reown's dashboard](https://dashboard.reown.com/), before you can use the Jupiter Mobile Adapter. This project ID is required for the AppKit integration that powers the mobile wallet connection functionality.

To get your project ID:

1. Visit [https://dashboard.reown.com/](https://dashboard.reown.com/)
2. Sign up or log in to your account
3. Create a new project
4. Copy the project ID from your project settings (should be in the navbar)

## Step 3: Add Jupiter Mobile Adapter to wallets

In your `/src/app/page.tsx` file, add the Jupiter Mobile Adapter as a wallet.

```js expandable theme={null}
"use client";

import { Adapter, UnifiedWalletButton, UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import { useWrappedReownAdapter } from '@jup-ag/jup-mobile-adapter';
import { WalletNotification } from "../components/WalletNotification";
import { useMemo } from "react";

export default function Home() {
  // Initialize Jupiter Mobile Adapter with WalletConnect/Reown configuration
  // This adapter enables mobile wallet connections through WalletConnect protocol
  const { jupiterAdapter } = useWrappedReownAdapter({
    appKitOptions: {
      metadata: {
        name: 'Jupiter Wallet Kit Demo',
        description: `This is a Jupiter Wallet Kit Demo with Jupiter Mobile Adapter`,
        url: 'https://localhost:3000',
        icons: ['https://jup.ag/favicon.ico'],
      },
      projectId: '', // Get your project id from https://dashboard.reown.com/
      features: {
        analytics: false,
        socials: ['google', 'x', 'apple'],
        email: false,
      },
      // Disable built-in wallet list to use only Jupiter Mobile Adapter
      enableWallets: false,
    },
  });
  
  // Configure wallet adapters for the UnifiedWalletProvider
  // This memoized array includes the Jupiter Mobile Adapter and filters out any invalid adapters
  // The filter ensures each adapter has required properties (name and icon) before being used
  const wallets: Adapter[] = useMemo(() => {
      return [
        jupiterAdapter, // Jupiter Mobile Adapter with WalletConnect integration
      ].filter((item) => item && item.name && item.icon) as Adapter[];
  }, []);

  return (
    <UnifiedWalletProvider
      wallets={wallets}
      config={{
        autoConnect: false,
        env: "mainnet-beta",
        metadata: {
          name: "Jupiter Wallet Kit Demo",
          description: "A demo application showcasing the Jupiter Wallet Kit",
          url: "https://localhost:3000",
          iconUrls: ["https://jup.ag/favicon.ico"],
        },
        notificationCallback: WalletNotification,
        walletlistExplanation: {
          href: "https://dev.jup.ag/tool-kits/wallet-kit",
        },
        theme: "dark",
        lang: "en",
      }}
    >
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Jupiter Mobile Adapter Demo
            </h1>
            <p className="text-gray-300 mb-8">
              Connect your Solana wallet to get started
            </p>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <UnifiedWalletButton />
          </div>
                    
          <div className="text-sm text-gray-400">
            <p>Powered by Jupiter Wallet Kit</p>
          </div>
        </div>
      </div>
    </UnifiedWalletProvider>
  );
};
```

There you have it! You've successfully integrated Jupiter Wallet Kit into your Next.js application and able to connect the Jupiter Mobile Adapter!

* Please test the wallet functionality and build into your own application.
* If you require more customizations, check out the [Wallet Kit Playground](https://wallet-kit.jup.ag) or [Github repo](https://github.com/TeamRaccoons/Unified-Wallet-Kit).
* If you have any questions or issues, please reach out to us in [Discord](https://discord.gg/jup).


# Jupiter Wallet Extension
Source: https://dev.jup.ag/tool-kits/wallet-kit/jupiter-wallet-extension

Step-by-step guide to integrate Jupiter Wallet Extension into a Next.js application.

This guide walks through integrating Jupiter Wallet Extension into a Next.js application using the `@jup-ag/wallet-adapter` package. It covers setting up UnifiedWalletProvider, creating wallet notifications, and detecting the Jupiter Wallet Extension browser addon.

## Prerequisites

Before you begin, make sure you have the following installed on your system. This is what we will be using in this example.

**Node.js and npm**: Download and install from [nodejs.org](https://nodejs.org)

## Step 1: Create a new project

Head to your preferred directory and create a new project using `create-next-app` with TypeScript template (you can use other templates or methods to start your project too):

```bash theme={null}
npx create-next-app@latest wallet-kit-demo --typescript
cd wallet-kit-demo
npm run dev
```

## Step 2: Install dependency

```bash theme={null}
npm i @jup-ag/wallet-adapter
```

<Card title="Download Jupiter Wallet Extension" href="https://chromewebstore.google.com/detail/iledlaeogohbilgbfhmbgkgmpplbfboh" icon="wallet" />

## Step 3: Add notification functionality

In `/src/components`, create a new file `WalletNotification.tsx` with the following content:

In this example, we will use a simple browser notification system to handle the wallet connection events.

```typescript expandable theme={null}
"use client";

interface IWalletNotification {
  publicKey?: string;
  shortAddress?: string;
  walletName?: string;
  metadata?: {
    name: string;
    url: string;
    icon: string;
    supportedTransactionVersions?: any;
  };
}

// Simple notification component - you can replace this with your preferred notification library
const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  // For demo purposes, we'll use browser notifications
  // In a real app, you'd want to use a proper notification library like react-hot-toast
  console.log(`[${type.toUpperCase()}] ${message}`);
  
  // Simple visual feedback
  if (typeof window !== 'undefined') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 9999;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }
};

export const WalletNotification = {
  onConnect: ({ shortAddress, walletName }: IWalletNotification) => {
    showNotification(`Connected to ${walletName} (${shortAddress})`, 'success');
  },
  onConnecting: ({ walletName }: IWalletNotification) => {
    showNotification(`Connecting to ${walletName}...`, 'info');
  },
  onDisconnect: ({ walletName }: IWalletNotification) => {
    showNotification(`Disconnected from ${walletName}`, 'info');
  },
  onError: ({ walletName }: IWalletNotification) => {
    showNotification(`Failed to connect to ${walletName}`, 'error');
  },
  onNotInstalled: ({ walletName }: IWalletNotification) => {
    showNotification(`${walletName} is not installed`, 'error');
  },
};

export default WalletNotification;
```

## Step 4: Wrap your app in the Wallet Kit

In `/src/app/page.tsx`, wrap your app with `<UnifiedWalletProvider />`.

This example code covers the base usage of the wallet kit which allows all wallets in your browser to be detected and used. If you have downloaded the [Jupiter Wallet Extension](https://chromewebstore.google.com/detail/iledlaeogohbilgbfhmbgkgmpplbfboh) <Icon icon="download" />, you should be able to see and connect to it.

```typescript expandable theme={null}
"use client";

import { Adapter, UnifiedWalletButton, UnifiedWalletProvider } from "@jup-ag/wallet-adapter";
import { WalletNotification } from "../components/WalletNotification";

export default function Home() {
  // You can add specific wallet adapters here if needed
  // For now, we'll rely on the Unified Wallet Kit's built-in wallet discovery
  const wallets: Adapter[] = [];

  return (
    <UnifiedWalletProvider
      wallets={wallets}
      config={{
        autoConnect: false,
        env: "mainnet-beta",
        metadata: {
          name: "Jupiter Wallet Kit Demo",
          description: "A demo application showcasing the Jupiter Wallet Kit",
          url: "https://localhost:3000",
          iconUrls: ["https://jup.ag/favicon.ico"],
        },
        notificationCallback: WalletNotification,
        walletlistExplanation: {
          href: "https://dev.jup.ag/tool-kits/wallet-kit",
        },
        theme: "dark",
        lang: "en",
      }}
    >
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">
              Jupiter Wallet Extension Demo
            </h1>
            <p className="text-gray-300 mb-8">
              Connect your Solana wallet to get started
            </p>
          </div>
          
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <UnifiedWalletButton />
          </div>
                          
          <div className="text-sm text-gray-400">
            <p>Powered by Jupiter Wallet Kit</p>
          </div>
        </div>
      </div>
    </UnifiedWalletProvider>
  );
}
```

There you have it! You've successfully integrated Jupiter Wallet Kit into your Next.js application and able to connect the Jupiter Wallet Extension!

* Please test the wallet functionality and build into your own application.
* If you require more customizations, check out the [Wallet Kit Playground](https://wallet-kit.jup.ag) or [Github repo](https://github.com/TeamRaccoons/Unified-Wallet-Kit).
* If you have any questions or issues, please reach out to us in [Discord](https://discord.gg/jup).


# Updates
Source: https://dev.jup.ag/updates/index

Latest announcements and breaking changes across Jupiter APIs.

<Card title="Stay Updated">
  Follow our various announcements channels to stay up to date with recent updates and announcements.

  <Columns>
    <Card href="https://discord.com/channels/897540204506775583/1115543693005430854" icon="discord">
      Discord
    </Card>

    <Card href="https://t.me/jup_dev" icon="telegram">
      Telegram
    </Card>
  </Columns>
</Card>

***

<Update label="November 2025" description="">
  ## Deprecate Lite API URL

  <Info>
    **Update (February 2026):** The deprecation has been postponed for a few months while we implement a new pricing structure. There is no immediate deadline, but we recommend migrating at your convenience.
  </Info>

  * We'll be deprecating the Lite API URL `lite-api.jup.ag`.
  * ~~This will take effect on 31st January 2026.~~ Postponed - new date TBA.
  * Please migrate to the API URL `api.jup.ag`.
  * The paths remain unchanged, only domain/hostname changes.
  * Generate an API key for free at [https://portal.jup.ag](https://portal.jup.ag).

  **Action Required**

  * **For free users**: Migrate to `api.jup.ag` **and use with an API key**.
  * **For paid users**: No action is required.
  * **For Ultra users**: If you are using `lite-api.jup.ag/ultra`, please migrate to `api.jup.ag/ultra` and use with an API key.

  <Card title="Migration Guide" href="/portal/migrate-from-lite-api" icon="arrow-right" />

  ***

  ## Metis Binary Migration

  <Card title="Read about the migration and release" href="/blog/metis-v7" icon="book" />

  <Card title="Refer to documentation" href="https://metis.builders" icon="code" />

  * [Tweet announcement](https://x.com/jupiterexchange/status/1990479870502031424?s=46)

  **Breaking Changes**

  * Migrated self-hosted binary to [https://metis.builders](https://metis.builders)
  * Renamed to `Metis Binary`
  * Requires a `BINARY_KEY` or `--binary-key` to authenticate the usage of the binary
  * Refer to [Binary Key](https://metis.builders/docs/binary-key) for more details

  ***

  ### Ultra API

  ### Deprecate `ctLikes` and `smartCtLikes` response field in search endpoint

  * We'll be deprecating the `ctLikes` and `smartCtLikes` response field in the search endpoints.
  * This will take effect next week and it affects the search endpoints in Ultra API.
  * If you are using the field for any purpose, please move off and stop using it.

  ***

  ### Tokens API

  ### Deprecate `ctLikes` and `smartCtLikes` response field in search endpoint

  * We'll be deprecating the `ctLikes` and `smartCtLikes` response field in the search endpoints.
  * This will take effect next week and it affects the search endpoints in Tokens API.
  * If you are using the field for any purpose, please move off and stop using it.

  ***

  ## Metis Swap API

  ### `routePlan[].percent` may return null

  * The `routePlan[].percent` field in the Metis Swap API quote response may return `null` - due to an an upgrade on the routing algorithm.
  * Please update your code to handle null values for this field.
  * This change will affect `instructionVersion=V2` only and has taken effect.
  * [npm package version 6.0.47](https://www.npmjs.com/package/@jup-ag/api/v/6.0.47)
    has been released with the latest schema.

  ### Deprecate `feeAmount` and `feeMint` fields in `SwapInfo`

  * We will be deprecating the `feeAmount` and `feeMint` fields from the `routePlan[].swapInfo` schema in a quote response.
  * Since `outAmount` already factor in these fees.
  * These fees are related to each AMM's own fee, not to any Jupiter or platform fees you may add.
  * To smooth the migration, we will just show `0` for `feeAmount` and the input mint as the `feeMint`.
  * Refer to [`SwapInfo` API Reference](/api-reference/swap/quote#response-route-plan-swap-info) for more details.
  * [npm package version 6.0.47](https://www.npmjs.com/package/@jup-ag/api/v/6.0.47)
    has been released with the latest schema.

  ### `nativeDestinationAccount`

  * We've added a new parameter to the Metis Swap API that lets you send native SOL
    directly to any account.
  * This is similar to `destinationTokenAccount`, but instead of receiving
    WSOL in a token account, you receive native SOL in a regular account.
  * Refer to [`nativeDestinationAccount` API Reference](/api-reference/swap/swap#body-native-destination-account)
    for more details.
  * [npm package version 6.0.46](https://www.npmjs.com/package/@jup-ag/api/v/6.0.46)
    has been released with the latest schema.
</Update>

<Update label="October 2025" description="">
  ## Ultra V3

  We're excited to introduce Ultra V3, featuring major improvements on quoting
  and swap execution for the Ultra Swap API.

  * [Read the full technical deep dive in the Jupiter Developers Blog](/blog/ultra-v3).

  * **Improved Routers in Meta Aggregation**: Granular splitting of 0.01%; and began usage
    of Golden-section and Brent's method for routing algorithms.

  * **Ultra Signaling for Tighter Prop AMM Quotes**: Ultra signals to Prop AMMs, allowing
    them to confidently provide tighter quotes by distinguishing Ultra trades as "non-toxic"
    order flow from other "toxic" order flow - 3 bps tighter (50% better) quotes for our Ultra
    users compared to other platforms.

  * **Predictive Execution to Simulate Executable Price & Potential Slippage**: Simulates routes
    on-chain to verify executable price versus quote and predict potential slippage to select the
    route with the least overall incurred slippage at the time of execution.

  * **Jupiter Beam: Sub-Second Transaction Landing & MEV Protection**: Transaction sending
    infrastructure helps reduce landing time by 50-66% compared to traditional methods and
    significantly reduces MEV opportunities by 34x.

  * **Real-Time Slippage Estimator (RTSE) Optimizations**: Automatically prioritize
    slippage-protected routes over purely price-optimized routes and increase volatility
    sensitivity for tokens with high historical volatility patterns.

  * **Gasless Support Coverage**: Expanded gasless support coverage to Token2022 tokens,
    memecoin-to-memecoin swaps (when liquidity permits), and reduced minimum trade size to \~\$10 USD.

  * **Just-In-Time Market Revival**: Dynamically re-indexes markets to enable tradability for all tokens.

  * **Reduce Pre-Graduation Quote Latency**: Optimized pre-graduated bonding curve markets routing logic
    by skipping multi-route aggregation to improve quote latency from 200ms to 10ms - a 90% improvement.

  * **[Try Ultra Swap API](/docs/ultra)**: Ultra V3 features are live in the Ultra Swap API V1, try it and let us know your feedback!

  ***

  ## Jupiter Aggregator V6 Program Update

  * 4 new instruction types are introduced:
    * `route_v2`
    * `exact_out_route_v2`
    * `shared_accounts_route_v2`
    * `shared_accounts_exact_out_route_v2`
  * You can find the details in the latest IDL: [Solscan](https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4#programIdl).
  * V1 instructions will continue to be valid and usable.
  * This enables:
    * Collect fees when the swap pair consists of a Token2022 mint.
    * Set fee beyond the previous cap of 255 bps.

  ## Integrator Fee

  **Ultra Swap API**

  * Integrator fee for Ultra now supports Token2022 tokens.
  * No additional parameters are required, simply create Token2022 referral token accounts for your referral account.
  * You can find the details in the [Add Fees To Ultra Swap](/docs/ultra/add-fees-to-ultra) guide.

  **Metis Swap API**

  * Integrator fee for Metis Swap now supports Token2022 tokens.
  * New [`instructionVersion` parameter](/api-reference/swap/quote#parameter-instruction-version) is introduced to the Metis Swap API's Quote endpoint to support the new instruction types.
  * To collect fees in Token2022 tokens, create Token2022 token accounts and pass in via `feeAccount`.
  * You can find the details in the [Add Fees To Swap](/docs/swap/add-fees-to-swap) guide.
</Update>

***

<Update label="August 2025" description="">
  ## Sunsetting Legacy Endpoints

  We’re sunsetting several legacy endpoints over the next few weeks by gradually reducing access/rate limits. Please migrate to the latest versions ASAP.

  <Danger>
    **Action Required**

    * Old Quote API V6: `http://quote-api.jup.ag/v6/`
    * Old Tokens API: `http://tokens.jup.ag`
    * Old Price API: `http://price.jup.ag`
    * Tokens V1: `http://lite-api.jup.ag/tokens/v1`
    * Price V2: `http://lite-api.jup.ag/price/v2`
  </Danger>
</Update>

***

<Update label="June 2025" description="">
  ## Deprecation of Price API V2 and Tokens API V1

  [**Price API upgrades to V3**](/docs/price/v3) to support more reliable and timely pricing data - derived by the last swap price (across all transactions) and a set of heuristics to ensure the accuracy of the price and eliminate any outliers.

  [**Tokens API upgrades to V2**](/docs/tokens/v2) to support an easier and reliable usage with new data addition such as [Organic Score](/docs/tokens/organic-score), more trading categories like toporganicscore, and more.

  <Danger>
    **Action Required**

    * If you are using **Price API V2** and **Tokens API V1**
    * Please migrate to their new versions respectively
    * The older versions will be deprecated by 30 September 2025
  </Danger>
</Update>

***

<Update label="March 2025" description="">
  ## API Gateway: Improvements

  **Improved API Gateway!**

  For those that have been using the new hostnames at `api.jup.ag/**`, we have made improvements to the infrastructure

  * Reduced latency in responses and much more consistent now
  * Infrastructure costs reduction (will help us look into reducing costs of the plans with higher rate limits)

  **Dual endpoint moving forward.**

  We will be deploying 2 different endpoints, 1 for free usage and 1 for plans with higher rate limits via [https://portal.jup.ag/](https://portal.jup.ag/)

  * `api.jup.ag` will serve only pro/paid users
  * `lite-api.jup.ag` will be the endpoint to provide free usage

  <Danger>
    **Action Required (Free plan)**

    * Migrate to `lite-api.jup.ag` **BY 1 MAY 2025**
    * The paths remain unchanged, only domain/hostname changes
    * The same rate limits still apply
    * You do not need an API Key to use the APIs for free
    * If you are still on `api.jup.ag` without an API key, you will get a 401 response

    **NO Action Required (Pro plan)**

    * Your usage on `api.jup.ag` remains unchanged
    * You can only use `api.jup.ag` with an API Key
  </Danger>
</Update>

***

<Update label="March 2025" description="">
  ## Trigger API: New Hostname and Breaking Changes

  * The `/limit/v2` path will be deprecated soon, please update your API calls to use the `/trigger/v1` path immediately.
  * `/execute` endpoint is introduced.
  * `/createOrder` endpoint now includes an additional `requestId` parameter to be used with the `/execute` endpoint.
  * `/cancelOrder` endpoint only builds the transaction for 1 order, while `/cancelOrders` endpoint builds the transaction for multiple orders.
  * The `tx` field in the responses are now `transaction` or `transactions`.
  * `/getTriggerOrders` endpoint is introduces a new format to get either active or historical orders (based on the query parameters).
  * [Please refer to the documentation for usage](/docs/trigger/create-order).

  <Accordion title="Path Changes">
    | Old Paths                                         | New Paths                                              |
    | :------------------------------------------------ | :----------------------------------------------------- |
    | `/limit/v2/createOrder`                           | `/trigger/v1/createOrder`                              |
    | `/limit/v2/executeOrder`                          | `/trigger/v1/executeOrder`                             |
    | `/limit/v2/cancelOrder`                           | `/trigger/v1/cancelOrder`   `/trigger/v1/cancelOrders` |
    | `/limit/v2/openOrders`   `/limit/v2/orderHistory` | `/trigger/v1/getTriggerOrders`                         |
  </Accordion>
</Update>

***

<Update label="January 2025" description="">
  ## API Gateway: New Hostnames and API Keys

  * API will now be served through new hostnames.
  * API will now be served through API keys.
  * API Keys will be distributed via [https://portal.jup.ag](https://portal.jup.ag) (Refer to [API Setup](/portal/setup) to get started).
  * Old hostnames will be slowly phased out.
  * Old hostnames during this period will have reduced rate limits to facilitate migration to the new API.

  | <span>Service Types</span> | <span>Description</span>                                 |
  | :------------------------- | :------------------------------------------------------- |
  | Free with no API key       | Decreased rate limits to only accommodate for testing.   |
  | Paid plan with API key     | Fixed rate limits, self served through an API dashboard. |

  <Accordion title="Hostname Changes">
    | Old Hostnames                             | New Hostnames                                 |
    | :---------------------------------------- | :-------------------------------------------- |
    | `quote-api.jup.ag/v6/quote`               | `lite-api.jup.ag/swap/v1/quote`               |
    | `quote-api.jup.ag/v6/swap`                | `lite-api.jup.ag/swap/v1/swap`                |
    | `quote-api.jup.ag/v6/swap-instructions`   | `lite-api.jup.ag/swap/v1/swap-instructions`   |
    | `quote-api.jup.ag/v6/program-id-to-label` | `lite-api.jup.ag/swap/v1/program-id-to-label` |
    | `price.jup.ag/v6`                         | `lite-api.jup.ag/price/v2`                    |
    | `tokens.jup.ag/token/:mint`               | `lite-api.jup.ag/tokens/v1/token/:mint`       |
    | `tokens.jup.ag/tokens?tags=:tags`         | `lite-api.jup.ag/tokens/v1/tagged/:tag`       |
    | `tokens.jup.ag/tokens_with_markets`       | `lite-api.jup.ag/tokens/v1/mints/tradable`    |
  </Accordion>
</Update>


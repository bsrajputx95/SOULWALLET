# SoulWallet Backend API

## Endpoints

### Authentication
- `POST /register` - Create account
- `POST /login` - Authenticate user
- `GET /me` - Get user profile

### Wallet
- `POST /wallet/link` - Link Solana wallet
- `GET /wallet/balances` - Fetch portfolio

### Transactions
- `POST /transactions/prepare-send` - Create unsigned tx
- `POST /transactions/broadcast` - Broadcast signed tx
- `GET /transactions/history` - Transaction history

### Copy Trading
- `POST /copy-trade/config` - Configure copy trading
- `GET /copy-trade/queue` - Pending trades
- `POST /copy-trade/execute/:id` - Execute trade
- `GET /copy-trade/positions` - Open positions
- `POST /copy-trade/close/:id` - Close position
- `DELETE /copy-trade/config` - Stop copying

### Webhooks
- `POST /webhooks/helius` - Helius transaction webhook

## Deployment

Railway auto-deploys on push. Migrations run via `npx prisma migrate deploy` in start command.

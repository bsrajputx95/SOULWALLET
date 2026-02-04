# SoulWallet - Solana Wallet with Copy Trading

## Features
- Non-custodial Solana wallet (keys never leave device)
- Jupiter-powered token swaps
- Copy trading with SL/TP automation
- Real-time portfolio tracking

## Setup

### Frontend
```bash
npm install
cp .env.example .env
# Add your Helius API key to .env
npm start
```

### Backend
```bash
cd soulwallet-backend
npm install
cp .env.example .env
# Configure DATABASE_URL, JWT_SECRET, HELIUS_RPC_URL
npx prisma migrate deploy
npm run dev
```

## Environment Variables

See `.env.example` for required variables.

## Security Notes
- Private keys encrypted with PIN (XOR for beta, upgrade to AES-256 for production)
- All transactions signed client-side
- Backend only stores public keys

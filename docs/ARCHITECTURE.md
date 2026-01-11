# SoulWallet Architecture

## System Overview

```mermaid
graph TD
    subgraph Client Layer
        A[Mobile App<br/>Expo/React Native]
        B[Web Client<br/>React]
    end
    
    subgraph API Gateway
        C[Fastify Server<br/>tRPC Adaptor]
        D[Rate Limiter]
        E[Auth Middleware]
    end
    
    subgraph Business Logic
        F[Auth Service]
        G[Wallet Service]
        H[Copy Trading Service]
        I[Market Data Service]
        J[Social Service]
    end
    
    subgraph Data Layer
        K[(PostgreSQL)]
        L[(Redis Cache)]
        M[RabbitMQ]
    end
    
    subgraph External Services
        N[Solana RPC]
        O[Jupiter API]
        P[Helius WebSocket]
        Q[Jito Bundle Service]
    end
    
    A --> C
    B --> C
    C --> D --> E
    E --> F & G & H & I & J
    F & G & H --> K
    F & G --> L
    H --> M
    G --> N
    G --> O
    H --> P
    G --> Q
```

---

## Service Dependencies

```mermaid
classDiagram
    class JupiterSwap {
        +getQuote()
        +executeSwap()
        +getPrice()
    }
    
    class RpcManager {
        +getConnection()
        +withFailover()
    }
    
    class FeeManager {
        +getOptimalPriorityFeeLamports()
    }
    
    class TransactionSimulator {
        +simulate()
    }
    
    class JitoService {
        +sendBundle()
    }
    
    class CopyTradingService {
        +startCopying()
        +stopCopying()
    }
    
    class WalletService {
        +getBalance()
        +getTokens()
    }
    
    class CustodialWallet {
        +createWallet()
        +signTransaction()
    }
    
    JupiterSwap --> RpcManager
    JupiterSwap --> FeeManager
    JupiterSwap --> TransactionSimulator
    JupiterSwap --> JitoService
    CopyTradingService --> JupiterSwap
    CopyTradingService --> WalletService
    WalletService --> CustodialWallet
```

---

## Dependency Injection Container

SoulWallet uses **tsyringe** for dependency injection, enabling testability and loose coupling.

### DI Architecture

```mermaid
graph TD
    subgraph DI Container
        Container[setupContainer]
    end
    
    subgraph Core Services - No Dependencies
        RpcManager[RpcManager]
        FeeManager[FeeManager]
        JitoService[JitoService]
        QueueManager[QueueManager]
    end
    
    subgraph Services with Dependencies
        TransactionSimulator[TransactionSimulator]
        JupiterSwap[JupiterSwap]
        CustodialWallet[CustodialWalletService]
        ProfitSharing[ProfitSharing]
    end
    
    subgraph Factories
        KeyManagementService[KeyManagementService]
    end
    
    Container -->|registerSingleton| RpcManager
    Container -->|registerSingleton| FeeManager
    Container -->|registerSingleton| JitoService
    Container -->|registerSingleton| QueueManager
    Container -->|registerSingleton| TransactionSimulator
    Container -->|registerSingleton| JupiterSwap
    Container -->|registerSingleton| CustodialWallet
    Container -->|registerSingleton| ProfitSharing
    Container -->|useFactory| KeyManagementService
    
    TransactionSimulator -->|@inject| RpcManager
    
    JupiterSwap -->|@inject| RpcManager
    JupiterSwap -->|@inject| FeeManager
    JupiterSwap -->|@inject| TransactionSimulator
    JupiterSwap -->|@inject| JitoService
    
    CustodialWallet -->|@inject| RpcManager
    CustodialWallet -->|@inject| KeyManagementService
    
    ProfitSharing -->|@inject| RpcManager
    ProfitSharing -->|@inject| JupiterSwap
    ProfitSharing -->|@inject| CustodialWallet
```

### Registered Services

| Token | Class | Dependencies |
|-------|-------|--------------|
| `RpcManager` | RpcManager | None |
| `FeeManager` | FeeManager | None |
| `QueueManager` | QueueManager | None |
| `JitoService` | JitoService | None |
| `TransactionSimulator` | TransactionSimulator | RpcManager |
| `JupiterSwap` | JupiterSwap | RpcManager, FeeManager, TransactionSimulator, JitoService |
| `CustodialWallet` | CustodialWalletService | RpcManager, KeyManagementService |
| `ProfitSharing` | ProfitSharing | RpcManager, JupiterSwap, CustodialWallet |
| `KeyManagementService` | (factory) | None |

### Usage

```typescript
// In services - constructor injection
@injectable()
export class JupiterSwap {
  constructor(
    @inject('RpcManager') private readonly rpcManager: RpcManager,
    @inject('FeeManager') private readonly feeManager: FeeManager,
  ) {}
}

// In routers - resolve from container
import { container } from '../lib/di/container';
const jupiterSwap = container.resolve<JupiterSwap>('JupiterSwap');
```

---

## Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Fastify
    participant RateLimit
    participant Auth
    participant tRPC
    participant Service
    participant Database
    
    Client->>Fastify: POST /api/v1/trpc/swap.execute
    Fastify->>RateLimit: Check Rate Limit
    RateLimit-->>Fastify: OK
    Fastify->>Auth: Verify JWT
    Auth-->>Fastify: User Context
    Fastify->>tRPC: Route to Procedure
    tRPC->>Service: Execute Business Logic
    Service->>Database: Query/Update
    Database-->>Service: Result
    Service-->>tRPC: Response
    tRPC-->>Client: JSON Response
```

---

## Data Flow: Copy Trading

```mermaid
flowchart LR
    subgraph Detection
        A[Helius WebSocket] --> B[Transaction Monitor]
    end
    
    subgraph Processing
        B --> C[RabbitMQ]
        C --> D[Execution Queue]
        D --> E[Copy Trade Executor]
    end
    
    subgraph Execution
        E --> F[Jupiter Swap]
        F --> G[Jito Bundle]
        G --> H[Solana Network]
    end
    
    subgraph Monitoring
        I[Price Monitor] --> J{SL/TP Check}
        J -->|Triggered| E
    end
```

---

## Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| **Fastify** | HTTP Server | `src/server/fastify.ts` |
| **tRPC** | Type-safe API | `src/server/trpc.ts` |
| **Prisma** | ORM/Database | `prisma/schema.prisma` |
| **Bull** | Job Queues | `src/lib/services/executionQueue.ts` |
| **Redis** | Cache/Sessions | `src/lib/redis.ts` |
| **RabbitMQ** | Pub/Sub | `src/lib/services/messageQueue.ts` |

---

## Routers (17 total)

| Router | Endpoints | Purpose |
|--------|-----------|---------|
| `auth` | login, signup, logout | Authentication |
| `wallet` | getBalance, send, receive | Wallet operations |
| `swap` | executeSwap, getQuote | Token swaps |
| `copyTrading` | start, stop, positions | Copy trading |
| `social` | posts, follows, likes | Social features |
| `webhook` | register, list, delete | Webhook integrations |

---

## Security Layers

1. **Rate Limiting** - Per-IP and per-user limits via Redis
2. **JWT Auth** - Access + refresh token rotation
3. **CSRF Protection** - Double-submit cookie pattern
4. **Input Validation** - Zod schemas on all tRPC procedures
5. **Encryption** - AES-256-GCM for sensitive data at rest

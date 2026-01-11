# API Versioning Strategy

SoulWallet API uses URL-based versioning under `/api/v1/` prefix for all endpoints.

## Current Version: v1

### Endpoint Structure

```
/api/v1/trpc/[router].[procedure]
```

**Examples:**
- `POST /api/v1/trpc/auth.login`
- `GET /api/v1/trpc/wallet.getBalance`
- `POST /api/v1/trpc/swap.executeSwap`

### Version Detection

| Method | Format | Priority |
|--------|--------|----------|
| URL Prefix | `/api/v1/...` | Primary |
| Header | `X-API-Version: v1` | Fallback |

---

## Legacy Endpoint Redirect

> [!WARNING]
> The legacy `/api/trpc/*` endpoint is **deprecated** and will be removed on 2026-07-01.

Legacy requests are automatically redirected with a **301 Permanent Redirect**:

```
GET /api/trpc/auth.login → 301 → /api/v1/trpc/auth.login
```

### Deprecation Headers

All redirected responses include:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Deprecated` | `true` | Indicates deprecated endpoint |
| `X-Sunset-Date` | `2026-07-01` | Removal date |
| `X-Replacement` | `/api/v1/trpc/...` | New endpoint path |
| `Deprecation` | `true` | Standard deprecation header |
| `Link` | `<path>; rel="successor-version"` | RFC 8288 link |

### Migration

Update all API clients from:
```javascript
// Old (deprecated)
fetch('/api/trpc/auth.login', { ... })

// New (recommended)
fetch('/api/v1/trpc/auth.login', { ... })
```

---

## Breaking Changes Policy

1. **Semantic versioning** - Major version bump (v1 → v2) for breaking changes
2. **6-month deprecation period** before removing old versions
3. **Deprecation warnings** in response headers (`X-Deprecated: true`)

---

## API Documentation

| Endpoint | Description |
|----------|-------------|
| `/api/docs` | Swagger UI interactive documentation |
| `/api/openapi.json` | OpenAPI 3.0 specification |

---

## Rate Limits by Version

| Version | Default Limit | Burst |
|---------|--------------|-------|
| v1 | 100 req/min | 200 |
| Legacy | 50 req/min | 100 |

Pending items

- No code fixes pending from the audit.
- Operational steps:
  - Set `CSRF_ENABLED=true` in production and confirm client sends `x-csrf-token`.
  - Ensure `REDIS_URL` is configured in production for rate limiting and locks.
  - Provide `HELIUS_API_KEY` and RPC/WS URLs in production env.
  - Run final E2E smoke tests and deployment checklist.
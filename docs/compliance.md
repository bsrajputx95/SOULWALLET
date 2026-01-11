# Compliance Guide (V1)

## GDPR Compliance

### Right to Access (Article 15)
- Users request a data export from the in-app Privacy & Data screen.
- Backend: `compliance.requestDataExport` creates a `DataExportRequest`.
- Processing: export jobs run asynchronously and update request status.
- Delivery: when complete, the request contains a downloadable `fileUrl` and `expiresAt`.

#### Export Workflow Details
| Step | Action | Timing |
|------|--------|--------|
| 1 | User initiates export via Privacy & Data screen | Immediate |
| 2 | `DataExportRequest` record created with `PENDING` status | Immediate |
| 3 | Background job processes export (cron: `*/30 * * * *`) | Within 30 min |
| 4 | Data compiled into JSON/ZIP format | Processing |
| 5 | File uploaded to secure storage with signed URL | Completion |
| 6 | User notified, `fileUrl` available | Immediate |
| 7 | File auto-expires and is deleted | 7 days |

### Right to Erasure (Article 17)
- Users request account deletion from the in-app Privacy & Data screen.
- Backend: `compliance.requestDataDeletion` creates a `DataDeletionRequest`.
- Processing: a **30-day grace period** applies before processing.

#### Deletion Grace Period & Workflow
| Step | Action | Timing |
|------|--------|--------|
| 1 | User initiates deletion request | Immediate |
| 2 | `DataDeletionRequest` created with `PENDING` status | Immediate |
| 3 | Confirmation email sent to user | Immediate |
| 4 | User can cancel within grace period | 0-30 days |
| 5 | Deletion cron runs (`0 2 * * *` - daily at 2 AM UTC) | Daily |
| 6 | After 30 days, all PII is anonymized/deleted | Day 30 |
| 7 | Audit log retained (anonymized) per legal requirements | Permanent |

#### Data Retention Periods
| Data Type | Retention | Justification |
|-----------|-----------|---------------|
| User PII (name, email) | Until deletion request + 30d grace | GDPR Article 17 |
| Transaction records | 7 years | Financial regulations (AML) |
| Audit logs | 7 years (anonymized) | Legal compliance |
| Session data | 30 days after expiry | Security analysis |
| Login attempts | 90 days | Security monitoring |
| Consent records | Indefinite | Proof of consent |

### Consent Management (Article 7)
- Consent is logged via `compliance.logConsent` using a version string and granted flag.
- Consent records are stored in `ConsentLog` and are displayed in the Privacy & Data screen.

#### Consent Versioning
| Version | Description | Effective Date |
|---------|-------------|----------------|
| `tos-v1.0` | Initial Terms of Service | Launch |
| `privacy-v1.0` | Initial Privacy Policy | Launch |

**Versioning Rules:**
- Major version bump (v1 → v2): Requires re-consent from all users
- Minor version bump (v1.0 → v1.1): Notification only, no re-consent required
- Consent records link user to specific version at time of acceptance
- Historical consent versions are immutable and auditable

## KYC / AML

### KYC Tiers
| Tier | Limits | Requirements |
|------|--------|--------------|
| **Tier 0** (Unverified) | $1,000/day, $5,000/month | Email verification only |
| **Tier 1** (Basic) | $10,000/day, $50,000/month | Government ID + Selfie |
| **Tier 2** (Enhanced) | $100,000/day, $500,000/month | Address verification + Source of funds |
| **Tier 3** (Institutional) | Unlimited | Full due diligence + Ongoing monitoring |

### KYC Submission Flow
1. Users submit identity information via `compliance.submitKYC`
2. Documents uploaded to secure storage (encrypted at rest)
3. Status available via `compliance.getKYCStatus`
4. Webhook notifications on status change

### Admin Review Flow
1. Pending KYC submissions queued for admin review
2. Admins access via `/api/admin/kyc/pending` endpoint
3. Review actions: `APPROVE`, `REJECT`, `REQUEST_INFO`
4. Rejection requires reason code (for user communication)
5. All decisions logged with admin ID and timestamp

### AML Monitoring
- Transaction monitoring against OFAC SDN list
- Suspicious activity detection (unusual patterns)
- SAR (Suspicious Activity Report) generation capability
- IP-based velocity checks

## Geo-Blocking

### Blocked Countries
- Blocked regions are defined by ISO 3166-1 alpha-2 codes in `constants/geoBlocked.json`.
- Current blocked countries include OFAC-sanctioned regions (e.g., KP, IR, CU, SY, etc.)

### Review Cadence
| Review Type | Frequency | Trigger |
|-------------|-----------|---------|
| Scheduled Review | Quarterly | Calendar |
| OFAC/FATF Updates | Within 7 days | Regulatory change |
| Incident-Driven | Immediate | Security event |

### Enforcement
- Requests to auth endpoints are geo-checked using IP geolocation
- Implemented at two levels:
  1. **Fastify level**: Global `onRequest` hook for `/api/trpc/auth.*` paths
  2. **tRPC level**: Router-specific checks in auth mutations
- IP geolocation uses `ipapi.co` with Redis caching (24-hour TTL)
- If the geo lookup fails, the system **fails open** for availability

### Disabling Geo-Blocking (Non-Production)
Set `GEO_BLOCKING_ENABLED=false` in environment variables for development/staging.

## Audit Procedures

### Audit Log Integrity
- Financial audit logs are designed to be verifiable via hash chain integrity checks
- Each log entry contains:
  - `id`: Unique identifier
  - `timestamp`: ISO 8601 timestamp
  - `action`: Action performed
  - `userId`: Actor (anonymized after deletion)
  - `previousHash`: Hash of previous entry
  - `currentHash`: SHA-256 hash of current entry + previous hash
- Integrity verification available via compliance endpoints for authorized users/admins

### Integrity Verification
```bash
# Verify audit log integrity (admin only)
curl -X POST /api/admin/audit/verify \
  -H "Authorization: Bearer <admin-token>"
```

### Log Access Controls
| Role | Access Level |
|------|-------------|
| User | Own logs only (via Privacy & Data screen) |
| Support | Read-only, redacted PII |
| Admin | Full access, unredacted |
| Auditor | Full access, read-only, export capability |

## Deployment Checklist

### Pre-Launch Compliance Verification
- [ ] GDPR data export/deletion flows tested end-to-end
- [ ] Consent versioning configured with initial versions
- [ ] KYC provider integrated and tested
- [ ] Geo-blocked countries list reviewed against current OFAC/FATF
- [ ] Audit log integrity verification passing
- [ ] Data retention policies implemented in cleanup cron
- [ ] Privacy policy and ToS documents published
- [ ] Cookie consent banner implemented (if web version)
- [ ] DPA (Data Processing Agreement) templates ready

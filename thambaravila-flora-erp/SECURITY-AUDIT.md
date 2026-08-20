# Security Audit - Thambaravila Flora ERP Track 1

## Security Checklist Status

### ✅ Phase 1 - Foundation & Authentication

- [x] **Argon2id password hashing**
  - Variant: argon2id (hybrid mode)
  - Memory cost: 64 MB
  - Time cost: 3 iterations
  - Parallelism: 4 threads
  - Implementation: `lib/auth/password.ts`

- [x] **TOTP 2FA required for login**
  - Algorithm: SHA1
  - Digits: 6
  - Period: 30 seconds
  - Time drift tolerance: ±30 seconds (window=1)
  - QR code generation for easy setup
  - Manual entry supported
  - Disable requires password re-authentication
  - Implementation: `lib/auth/totp.ts`

- [x] **RBAC enforced server-side on every endpoint**
  - Permission checking: `userHasPermission()` queries database
  - Middleware enforcement: `withPermission()`, `withRole()`, `withAuth()`
  - No client-side bypass possible
  - IT/Admin restrictions enforced (cannot create Owner users, no financial data access)
  - Implementation: `lib/auth/permissions.ts`, `lib/auth/middleware.ts`

- [x] **Audit log append-only, covers all sensitive actions**
  - All auth events logged (login, logout, 2FA, password changes)
  - All permission-denied attempts logged
  - All payment confirmations logged
  - Role and user management changes logged
  - DELETE endpoint returns 403
  - Implementation: `lib/auth/audit.ts`, `app/api/audit-logs/route.ts`

- [x] **Rate limiting + lockout on login**
  - Max failed attempts: 5
  - Lockout duration: 30 minutes
  - Email-based rate limiting: 15-minute window
  - Implementation: `lib/auth/rate-limit.ts`

- [x] **Session management with short-lived tokens**
  - JWT session strategy
  - Session lifetime: 8 hours
  - Password re-authentication for sensitive operations
  - 2FA verification required for all sessions
  - Implementation: `lib/auth/config.ts`

### ✅ Phase 4 - Payment Automation

- [x] **Payment confirmation Accountant-only**
  - Server-side permission check: `PermissionName.RECORD_PAYMENT_STATUS`
  - Middleware enforcement: `withPermission()`
  - Sales Manager role CANNOT access `/api/payments/confirm`
  - Business rule enforced at API layer, not just UI
  - Implementation: `app/api/payments/confirm/route.ts`

- [x] **Payment status pipeline enforced**
  - Only payment confirmation advances enquiry status
  - Status transitions: NEW → ADVANCE_DUE → ADVANCE_PAID → FLOWER_PAYMENT_DUE → FLOWER_PAID → FINAL_PAYMENT_DUE → COMPLETED
  - Auto-calculated due dates based on configurable rules
  - Implementation: `lib/payment/payment-workflow.ts`, `lib/payment/deadline-engine.ts`

- [x] **Background job security**
  - Jobs run in isolated worker process
  - Manual trigger requires Owner/IT permission
  - Audit logs for all notifications sent
  - Implementation: `lib/queue/payment-notifications.ts`

### ⚠️ Production Requirements (Not Yet Configured)

- [ ] **TLS/HTTPS only**
  - Configure reverse proxy (nginx, Caddy)
  - Obtain SSL certificate (Let's Encrypt)
  - Redirect HTTP → HTTPS
  - Set `NEXTAUTH_URL` to https://

- [ ] **HSTS enabled**
  - Add header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - Configure in reverse proxy or Next.js middleware

- [ ] **Encrypted database backups**
  - Set up automated daily backups
  - Encrypt backups with GPG or similar
  - Store off-site (separate physical location)
  - Test restore procedure regularly

### 🔍 Additional Security Considerations

#### Financial Data Separation

**Current Implementation:**
- IT/Admin role has no permissions for financial operations
- Middleware blocks access to financial endpoints
- Audit logs track unauthorized access attempts

**Limitation:**
- IT/Admin can still modify codebase to bypass restrictions
- Database access is not physically separated

**For Stricter Separation (Optional):**
1. Separate database instance for financial data
2. Separate service accounts (Accountant/Owner only)
3. Network-level access controls
4. Database-level user permissions (PostgreSQL roles)

**Decision Point:** Current setup trusts IT staff as configured. Evaluate based on organizational security requirements.

#### Owner Role Protection

- Owner role cannot be edited (`canBeEdited: false`)
- Owner role is system role (`isSystem: true`)
- IT/Admin cannot create additional Owner users
- Owner account should use strong password + 2FA
- Consider HSM or hardware key for Owner account in high-security environments

#### API Security

- **No API keys exposed in client code** ✅
- **NEXTAUTH_SECRET kept secure** ✅ (environment variable)
- **Database credentials not in codebase** ✅ (environment variable)
- **No sensitive data in logs** ✅ (password hashes never logged)

#### Input Validation

- Email format validated ✅
- Password strength enforced ✅
- Decimal amounts validated ✅
- Date formats validated ✅
- SQL injection prevented by Prisma ORM ✅

#### Session Security

- Session hijacking protection: short lifetime (8 hours)
- Session fixation protection: new session on login
- CSRF protection: SameSite cookies (configured in NextAuth)
- XSS protection: Next.js auto-escapes output

---

## Known Security Limitations

### 1. Email-Based Rate Limiting (In-Memory)

**Issue:** Email rate limiting uses in-memory Map, not persistent storage.

**Impact:** Rate limits reset on server restart.

**Mitigation Options:**
- Move to Redis-backed storage
- Accept limitation (low risk for internal ERP)

**Current Status:** Accepted for Track 1. User lockout (database-backed) still works.

### 2. TOTP Backup Codes Not Implemented

**Issue:** No backup codes for 2FA recovery if phone lost.

**Impact:** User lockout if authenticator app unavailable.

**Mitigation Options:**
- Implement backup codes (function exists: `generateBackupCodes()`)
- Owner can disable 2FA for locked-out users
- Store backup codes securely, hash like passwords

**Current Status:** Owner can disable 2FA as emergency recovery.

### 3. No Email Verification

**Issue:** Email addresses not verified during account creation.

**Impact:** User could register with someone else's email.

**Mitigation:** This is an internal ERP. Users created by Owner/IT, not self-service.

**Current Status:** Accepted. Not required for internal use.

### 4. Notification Delivery Placeholder

**Issue:** Notifications logged to audit table, not sent via email/SMS.

**Impact:** Users don't receive real-time alerts.

**To Implement:**
- Integrate email service (SendGrid, AWS SES, Postmark)
- Add SMS provider for critical alerts
- Build in-app notification UI

**Current Status:** Infrastructure ready. Delivery mechanism is Track 2 scope.

---

## Security Testing Performed

### Automated Tests

✅ **Phase 1 RBAC Testing** (`npm run test:phase1`)
- 40+ permission checks across 6 roles
- Positive and negative test cases
- Owner/IT/Accountant/Sales/Coordinator/Social Media roles verified

✅ **Phase 4 Payment Testing** (`npm run test:phase4`)
- Payment stage auto-generation
- Payment confirmation workflow
- Status pipeline (NEW → COMPLETED)
- Accountant-only enforcement
- Deadline notification logic

### Manual Testing Checklist

- [ ] Log in as each role, verify dashboard permissions
- [ ] Attempt to access forbidden endpoints (expect 403)
- [ ] Test account lockout (5 failed attempts)
- [ ] Enable 2FA, verify required on next login
- [ ] Accountant confirms payment, verify status advances
- [ ] Sales Manager attempts payment confirmation (should fail)
- [ ] View audit logs as Owner
- [ ] Attempt to delete audit log (should fail with 403)

---

## Incident Response Plan

### Account Compromise

1. **Immediate Actions:**
   - Lock affected user account (set `isActive: false`)
   - Review audit logs for suspicious activity
   - Force password reset
   - Invalidate all sessions (regenerate `NEXTAUTH_SECRET`)

2. **Investigation:**
   - Check `AuditLog` for unauthorized access attempts
   - Review payment confirmations for fraudulent entries
   - Verify no role escalations occurred

3. **Recovery:**
   - Reset compromised user's password
   - Re-enable 2FA
   - Notify user of compromise

### Data Breach

1. **Containment:**
   - Identify compromised data
   - Revoke access to affected systems
   - Preserve audit logs for forensics

2. **Assessment:**
   - Determine scope (customer data, financial records, etc.)
   - Review audit trail for breach timeline
   - Identify entry point

3. **Notification:**
   - Inform affected customers
   - Document incident per data protection requirements
   - Report to authorities if required

### Unauthorized Payment

1. **Detection:**
   - Audit log shows payment confirmation by non-Accountant
   - Payment amount doesn't match expected value
   - Customer reports unauthorized charge

2. **Verification:**
   - Check `PaymentStage.paidConfirmedBy` field
   - Review audit log for `payment_confirmed` action
   - Verify user had required permission at time

3. **Remediation:**
   - Use `reversePaymentConfirmation()` function
   - Correct financial records
   - Investigate permission bypass method

---

## Security Contact

For security issues related to this codebase:

1. **Internal Issues:** Contact system Owner
2. **Critical Vulnerabilities:** Document in audit log, escalate immediately
3. **Security Updates:** Review dependencies monthly (`npm audit`)

---

## Compliance Notes

### Data Protection

- **Customer PII:** Names, phone numbers, email addresses stored
- **Financial Data:** Payment amounts, transaction dates
- **Retention:** No automatic deletion implemented
- **Access Control:** RBAC enforced

### Audit Requirements

- **Audit Trail:** Complete, append-only, timestamped
- **Retention:** Indefinite (no purging)
- **Access:** Owner and IT/Admin can view
- **Integrity:** Cannot be modified or deleted

---

## Security Maintenance

### Regular Tasks

**Weekly:**
- Review audit logs for anomalies
- Check for failed login attempts

**Monthly:**
- Run `npm audit` for dependency vulnerabilities
- Review user accounts, disable inactive users
- Verify backup restoration works

**Quarterly:**
- Rotate `NEXTAUTH_SECRET`
- Review and update permission matrix
- Security training for staff

**Annually:**
- Full security audit by external party
- Penetration testing
- Disaster recovery drill

---

## Conclusion

Track 1 security implementation is **production-ready for internal use** with noted limitations. The system provides strong authentication, granular access control, and comprehensive audit logging. Financial data separation relies on permission enforcement rather than physical isolation.

**Recommended before production deployment:**
1. Enable HTTPS/TLS
2. Set up encrypted backups
3. Implement email notification delivery
4. Consider financial data separation based on threat model
5. Complete manual testing checklist
6. Train users on 2FA setup and security best practices

**Last Updated:** 2026-07-20
**Next Review:** Before production deployment

# Thambaravila Flora ERP - Track 1: Security & Payment-Logic Core

Internal ERP system for wedding floristry and event decor management.

## Track 1 Status: Phase 1 (Foundation/Auth/RBAC) ✅

This implementation covers:
- ✅ Next.js 14+ with TypeScript and App Router
- ✅ PostgreSQL with Prisma ORM
- ✅ Authentication with Argon2id password hashing
- ✅ TOTP 2FA (Google Authenticator/Authy compatible)
- ✅ Role-Based Access Control (RBAC) with permission middleware
- ✅ Rate limiting and account lockout
- ✅ Append-only audit logging
- ✅ Session management with 8-hour JWT lifetime

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Redis (for Phase 4 - BullMQ background jobs)

## Setup Instructions

### 1. Install Dependencies

```bash
cd thambaravila-flora-erp
npm install
```

### 2. Configure Environment

Create `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/thambaravila_flora_erp?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secure-random-secret-here"
REDIS_URL="redis://localhost:6379"
NODE_ENV="development"
```

Generate a secure `NEXTAUTH_SECRET`:
```bash
openssl rand -base64 32
```

### 3. Set Up Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with roles, permissions, and default Owner user
npm run prisma:seed
```

### 4. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

### 5. Default Credentials

```
Email: owner@thambaravila-flora.com
Password: Admin@123
```

⚠️ **Change this password immediately in production!**

## Database Schema

### Core Security Models

- **User**: User accounts with Argon2id hashed passwords, TOTP secrets, lockout tracking
- **Role**: System and custom roles (Owner, IT/Admin, Accountant, Sales Manager, etc.)
- **Permission**: Granular permissions (view_financial_dashboard, record_payment_status, etc.)
- **RolePermission**: Many-to-many mapping of roles to permissions
- **AuditLog**: Append-only audit trail (cannot be deleted)

### Business Models

- **Customer**: Customer records with unique IDs (TF-2026-0043 format)
- **Enquiry**: Event enquiries with status pipeline
- **PaymentStage**: Payment stages (ADVANCE, FLOWER, FINAL) with deadlines
- **PaymentDeadlineRule**: Configurable payment deadline rules

## RBAC Permission Matrix

| Permission | Owner | IT/Admin | Accountant | Sales Mgr | Coordinator | Social Media |
|------------|-------|----------|------------|-----------|-------------|--------------|
| view_financial_dashboard | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| record_payment_status | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| create_edit_enquiries | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| view_customer_full_history | ✅ | ✅ | Financial only | ✅ | Event only | ❌ |
| manage_users_roles | ✅ | Except Owner | ❌ | ❌ | ❌ | ❌ |

**Critical Security Rules:**
- Payment confirmation can ONLY be done by Accountant role
- IT/Admin has NO access to financial data (tables, dashboards, reports)
- Owner role cannot be edited or removed
- All permission checks are enforced server-side

## Security Features

### 1. Authentication
- Argon2id password hashing (64MB memory, 3 iterations, 4 threads)
- TOTP 2FA with QR code setup
- Password strength requirements (8+ chars, uppercase, lowercase, number, special char)

### 2. Rate Limiting & Lockout
- Max 5 failed login attempts
- 30-minute account lockout
- Email-based rate limiting (15-minute window)

### 3. Session Management
- 8-hour JWT session lifetime
- Password re-authentication for sensitive operations
- 2FA verification required for all sessions

### 4. Audit Logging
- All auth events (login, logout, password changes)
- All permission-sensitive operations
- User and role management changes
- Payment confirmations and modifications
- Append-only (cannot be deleted)

## API Routes

### Authentication
- `POST /api/auth/signin` - Sign in with credentials
- `POST /api/auth/signout` - Sign out
- `POST /api/auth/totp/setup` - Initiate 2FA setup
- `POST /api/auth/totp/enable` - Enable 2FA after verification
- `POST /api/auth/totp/disable` - Disable 2FA (requires password)

### Users (requires manage_users permission)
- `GET /api/users` - List all users
- `POST /api/users/create` - Create new user

### Permissions
- `GET /api/permissions/me` - Get current user's permissions

### Audit Logs (Owner/IT only)
- `GET /api/audit-logs` - View audit logs

## Middleware Usage

### Protect routes with authentication:
```typescript
import { withAuth } from '@/lib/auth/middleware';

export const GET = withAuth(async (request, context) => {
  // context.userId is available
  // User is authenticated
});
```

### Protect routes with specific permission:
```typescript
import { withPermission } from '@/lib/auth/middleware';
import { PermissionName } from '@/lib/auth/permissions';

export const POST = withPermission(
  PermissionName.RECORD_PAYMENT_STATUS,
  async (request, context) => {
    // User has permission
  }
);
```

### Protect routes with role:
```typescript
import { withRole } from '@/lib/auth/middleware';
import { RoleName } from '@/lib/auth/permissions';

export const GET = withRole(
  [RoleName.OWNER, RoleName.ACCOUNTANT],
  async (request, context) => {
    // User has required role
  }
);
```

## Development Tools

```bash
# Generate Prisma Client after schema changes
npm run prisma:generate

# Create new migration
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Re-seed database
npm run prisma:seed
```

## Testing Phase 1

Run the automated test script to create test users and verify RBAC:

```bash
npm run test:phase1
```

This script will:
1. Create test users for each role (IT/Admin, Accountant, Sales Manager, Wedding Coordinator, Social Media Manager)
2. Verify permission matrix per section 3.2
3. Test audit log system
4. Verify rate limiting configuration
5. Test 2FA system
6. Display test credentials

### Manual Testing Checklist

After running the automated tests:

1. **Login Testing**
   - [ ] Log in as each role with provided credentials
   - [ ] Verify dashboard shows correct permissions for each role
   - [ ] Test account lockout (5 failed attempts, 30-minute lockout)

2. **2FA Testing**
   - [ ] Enable 2FA for a test user at `/settings/2fa`
   - [ ] Scan QR code with Google Authenticator or Authy
   - [ ] Log out and log back in with 2FA code
   - [ ] Test 2FA disable (requires password re-authentication)

3. **RBAC Testing**
   - [ ] IT/Admin cannot access `/api/users` endpoint with Owner users
   - [ ] Sales Manager cannot access financial endpoints
   - [ ] Accountant can record payments but not create enquiries
   - [ ] Social Media Manager has minimal permissions

4. **Audit Log Testing**
   - [ ] Log in as Owner or IT/Admin
   - [ ] View audit logs (test endpoint or build UI)
   - [ ] Verify all login attempts are logged
   - [ ] Verify permission denied attempts are logged

## Testing Phase 4 (Payment Automation)

Run the automated test script to verify payment workflow:

```bash
npm run test:phase4
```

This script will:
1. Test payment stage auto-generation with calculated due dates
2. Verify payment confirmation workflow and status pipeline
3. Confirm Accountant-only enforcement (Sales cannot confirm payments)
4. Test deadline notification logic
5. Verify payment summary calculations

### Manual Testing Phase 4

After running automated tests:

1. **Start Redis**
   ```bash
   # Option 1: Local Redis
   redis-server
   
   # Option 2: Docker
   docker run -p 6379:6379 redis
   ```

2. **Start Background Workers**
   ```bash
   npm run workers
   ```
   This starts the BullMQ worker that processes payment deadline checks daily at 8:00 AM.

3. **Test Payment Workflow**
   - [ ] Create enquiry via API: `POST /api/enquiries/create`
   - [ ] Verify 3 payment stages created automatically
   - [ ] Log in as Accountant, confirm ADVANCE payment
   - [ ] Verify enquiry status advances to `FLOWER_PAYMENT_DUE`
   - [ ] Confirm remaining payments, verify status → `COMPLETED`
   - [ ] Attempt payment confirmation as Sales Manager (should fail with 403)

4. **Test Deadline Notifications**
   - [ ] Create enquiry with event date within 5 days
   - [ ] Manually trigger deadline check: `POST /api/jobs/trigger-deadline-check` (Owner/IT only)
   - [ ] Verify payment status updated to `DUE_SOON` or `OVERDUE`
   - [ ] Check audit logs for notification entries

### Phase 4 Architecture

**Payment Stage Generation:**
- ADVANCE: 30% of quote, due 5 days from enquiry
- FLOWER: 40% of quote, due 14 days before event
- FINAL: 30% of quote, due 3 days before event

**Status Pipeline:**
```
NEW → ADVANCE_DUE → ADVANCE_PAID → FLOWER_PAYMENT_DUE → 
FLOWER_PAID → FINAL_PAYMENT_DUE → COMPLETED
```

**Background Jobs:**
- Daily check at 8:00 AM
- Updates payment statuses (PENDING → DUE_SOON → OVERDUE)
- Sends notifications to Sales Manager, Accountant, Owner
- Notifications logged in audit_logs table

## Security Checklist

- [x] Argon2id password hashing
- [x] TOTP 2FA required for login
- [x] RBAC enforced server-side on every endpoint
- [x] Audit log append-only, covers all sensitive actions
- [x] Rate limiting + lockout on login
- [x] Session management with short-lived tokens
- [ ] TLS/HTTPS only (configure in production)
- [ ] HSTS enabled (configure in production)
- [ ] Encrypted backups (set up separately)

## Production Deployment Checklist

Before deploying to production:

### Security Configuration

- [ ] Change default Owner password
- [ ] Generate new `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- [ ] Enable HTTPS/TLS (configure reverse proxy)
- [ ] Enable HSTS headers
- [ ] Set up encrypted database backups
- [ ] Configure Redis with password authentication
- [ ] Review and update all environment variables
- [ ] Set `NODE_ENV=production`

### Infrastructure Setup

- [ ] PostgreSQL database (production instance)
- [ ] Redis server (for BullMQ)
- [ ] Separate process/container for workers (`npm run workers`)
- [ ] Reverse proxy (nginx/Caddy) with SSL
- [ ] Monitoring and alerting system
- [ ] Log aggregation (for audit logs)

### Testing & Validation

- [ ] Run `npm run test:phase1` - all tests pass
- [ ] Run `npm run test:phase4` - all tests pass
- [ ] Complete manual testing checklists
- [ ] Test backup restoration procedure
- [ ] Load testing (if applicable)
- [ ] Security penetration testing

### User Training

- [ ] Train users on 2FA setup (Google Authenticator/Authy)
- [ ] Document payment confirmation workflow for Accountants
- [ ] Security best practices training
- [ ] Incident reporting procedures

### Documentation

- [ ] Review SECURITY-AUDIT.md
- [ ] Document custom roles and permissions
- [ ] API documentation for integrations
- [ ] Disaster recovery procedures
- [ ] User access management procedures

## Track 1 Status: COMPLETE ✅

**Phase 1 (Foundation/Auth/RBAC):** ✅ Complete and tested
- Argon2id password hashing
- TOTP 2FA system
- RBAC with server-side enforcement
- Rate limiting and account lockout
- Append-only audit logging
- Session management

**Phase 4 (Payment Automation):** ✅ Complete and tested
- PaymentDeadlineRule engine
- Automatic payment stage generation
- Payment confirmation workflow (Accountant-only)
- BullMQ background jobs
- Payment deadline notifications
- Status pipeline automation

## Next: Track 2 (Routine CRUD/UI/Dashboards)

Switch to Haiku 4.5 for Track 2 implementation:
- Customer management UI
- Enquiry management
- Event scheduling
- Sales targets and analytics
- Social media campaign tracking
- Internal chat system
- Reporting dashboards
- Print functionality

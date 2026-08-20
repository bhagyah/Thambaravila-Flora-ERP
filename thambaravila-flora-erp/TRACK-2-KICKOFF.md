# 🚀 Track 2 Kickoff: Routine Modules & Dashboards

**Project:** Thambaravila Flora ERP  
**Track:** 2 of 2 (Routine Modules & Dashboards)  
**Model:** Claude Haiku 4.5  
**Status:** 🟢 READY TO BUILD  
**Date:** 2026-07-20

---

## Prerequisites: Track 1 Complete ✅

Track 1 is fully built and tested:
- ✅ Authentication (Argon2id + TOTP 2FA)
- ✅ RBAC (6 roles, 13 permissions, middleware enforcement)
- ✅ Audit logging (append-only, no deletion)
- ✅ Payment automation (deadline engine, accountant-only confirmation)
- ✅ Background jobs (BullMQ + Redis for notifications)

**Database:** SQLite (`prisma/dev.db`) - 6 roles, 13 permissions, default Owner user  
**Default Login:** `owner@thambaravila-flora.com` / `Admin@123`  
**App:** Running at http://localhost:3000

---

## What Track 2 Builds: 8 Phases

### Phase 2: Customer + Enquiry Core
- Customer creation/edit UI (auto-generates `customer_id` like TF-2026-0043)
- Enquiry creation form (event date, type, quote, source)
- Enquiry read-only status view
- Customer detail page (history: enquiries, payments, events)
- Role-aware views (e.g., Coordinator sees events only, not financials)

### Phase 3: Accountant Module (UI Layer)
- **Dues dashboard:** Upcoming/overdue payments, filterable by stage type
- **Financial dashboard:** Cash flow, balance, revenue, receivables (Accountant + Owner only)
- **Balance sheet/Reports:** PDF generation (monthly P&L, receivables)
- **Accountant targets:** Weekly/monthly collections target vs actual
- **Payment confirmation form:** Calls Track 1 API (enforces Accountant-only at API layer)

### Phase 4: Sales Module
- **Targets dashboard:** Weekly/monthly target vs achieved, progress bars + trend
- **Sales pattern stats:** Segment by event_type, source, season; conversion rates, time-to-close, seasonality flags
- Ready for simple forecast model once 12+ months of data exists

### Phase 5: Owner + IT Dashboards
- **Owner dashboard:** Full rollup visibility (respects RBAC by design)
- **Insight/alert engine:** Rules-based (not AI): flags like "Advance payments 9 days late this month" or "6 events in 3 weeks, no vendors confirmed"
- **IT/Admin dashboard:** User management, audit log view, system config (payment rules, notifications, printer)

### Phase 6: Coordinator + Social Media + Chat
- **Wedding Coordinator:** Event calendar, checklist (venue, vendors, flowers, delivery), linked to `Enquiry.event_date`
- **Social Media Manager:** Content calendar, campaign tracker, lead-capture form (creates `Customer`+`Enquiry` with `source=social`)
- **Internal chat:** Role-to-role and 1:1 threads (Socket.IO or Pusher), text + attachments + read receipts

### Phase 7: Polish & Integrations
- **PWA:** Installable on mobile, responsive (single-column cards <768px, horizontal scrolling tables)
- **Worked-hours tracking:** Clock-in/out UI, weekly summary for IT/Owner
- **LAN printer:** Browser print (`window.print()` + print CSS) first; Node + `node-printer` service only if needed
- **Audit log UI:** Read-only view of Track 1 audit logs

### Extra Features (Beyond v1)
- **Approval workflows:** Large discounts need Owner sign-off
- **Vendor management:** Suppliers, payment tracking (what you owe)
- **Inventory linkage:** Stock auto-depletes on event fulfillment
- **Customer portal:** Customers check payment status (optional, later)

---

## Critical Rule for Track 2

**NEVER let Track 2 code write directly to:**
- `PaymentStage.amount_paid`
- Bypass RBAC middleware

**Every screen must call existing permission-checked API routes from Track 1.** If a task needs a new financial write path, build that piece on Sonnet 4.5 first, then come back here for the UI.

---

## Database Schema: Ready to Extend

All core tables exist (created by Track 1):
- `users`, `roles`, `permissions`, `role_permissions`, `audit_logs`
- `customers`, `enquiries`, `payment_stages`, `payment_deadline_rules`
- `sales_targets`, `events`, `social_campaigns`, `chat_messages`, `work_sessions`

**For Phase 3 Accountant Module:** Need to add `Expense` table (simple CRUD for outgoing payments). Flag to Sonnet for later if needed.

---

## How to Run

```bash
# 1. Database is already set up
# 2. Dev server is running at http://localhost:3000

# 3. Login with:
#    Email: owner@thambaravila-flora.com
#    Password: Admin@123

# 4. To start development:
npm run dev

# 5. To view database (if needed):
npx prisma studio
```

---

## Decisions Needed Before Phase 5

**Confirm with stakeholder:**

1. **Multi-currency?**
   - LKR only, or USD for destination weddings?

2. **Customer-facing portal?**
   - In v1 scope or later?

3. **Financial data separation?**
   - Current: UI-layer permission checks (good for internal ERP)
   - Stricter: DB-level separation needed? (requires Track 1 update on Sonnet)

---

## API Routes Already Built (Call These)

Do NOT create new financial write paths. Use existing Track 1 routes:

### Auth
- `POST /api/auth/signin` - Login
- `POST /api/auth/totp/setup` - Setup 2FA
- `POST /api/auth/totp/verify` - Verify TOTP
- `POST /api/auth/totp/enable` - Enable 2FA
- `POST /api/auth/totp/disable` - Disable 2FA

### Users & Permissions
- `GET /api/users` - List users
- `POST /api/users/create` - Create user
- `GET /api/permissions/me` - Get current user's permissions

### Enquiries (Sales)
- `POST /api/enquiries/create` - Create enquiry (auto-creates payment stages)
- `GET /api/enquiries` - List enquiries

### Payments (Accountant)
- `POST /api/payments/confirm` - Confirm payment (Accountant-only enforced)
- `GET /api/payments/summary/[enquiryId]` - Payment summary

### Audit
- `GET /api/audit-logs` - View audit logs

### Jobs (Owner/IT)
- `POST /api/jobs/trigger-deadline-check` - Manually trigger payment check

---

## Tech Stack

- **Frontend:** React 19, Next.js 15 (App Router)
- **Database:** SQLite (dev) → PostgreSQL (prod)
- **Auth:** NextAuth.js + Argon2id + TOTP
- **Styling:** Tailwind CSS
- **Tables/Charts:** Consider: TanStack Table (React Query), Recharts, or similar
- **PDF:** @react-pdf/renderer or Puppeteer
- **Chat (Phase 6):** Socket.IO or Pusher
- **Printing:** Browser print first (`window.print()`), Node printer service if needed

---

## Getting Started: Phase 2 Task Breakdown

1. **Customer form component**
   - Input: name, phone, email, address, source (select)
   - Auto-generate: `customer_id` (TF-YYYY-NNNN format)
   - Route: `POST /api/customers/create`

2. **Enquiry form component**
   - Select customer, event date, event type, quote amount, source
   - Calls: `POST /api/enquiries/create` (auto-creates 3 payment stages)
   - Redirect to customer detail page

3. **Customer detail page**
   - Show: customer info, enquiries list, payments, event timeline
   - Permission-aware (Coordinator sees events only, Accountant sees payments, Owner sees all)

4. **Status view**
   - Read-only display of `Enquiry.status` (automation handled by Track 1)

---

## Success Criteria for Track 2

- [ ] All 8 phases implemented
- [ ] No new financial write paths created
- [ ] All calls use Track 1 permission-checked APIs
- [ ] Role-based UI rendering (views change per role)
- [ ] Responsive design (PWA, mobile-first)
- [ ] Audit log entries for all user actions
- [ ] Manual testing checklist passed

---

## Next Steps

1. **This message completes:** Database setup + dev server running + Track 2 ready
2. **Switch to Claude Haiku 4.5** for everything in this file (routine CRUD/UI/dashboards)
3. **Start Phase 2:** Customer + Enquiry core
4. **Reference:** Track 1 completion document (`TRACK-1-COMPLETE.md`) + SECURITY-AUDIT.md for what's already built

---

## Contact & Support

- Track 1 security questions: See `SECURITY-AUDIT.md`
- API details: See `README.md`
- Permission matrix: Track 1 spec, Section 3.2

---

**🎉 Ready to build Phases 2–8!**

Switch to Haiku 4.5 and start with Phase 2: Customer + Enquiry Core.


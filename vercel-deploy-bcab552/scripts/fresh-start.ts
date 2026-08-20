/**
 * scripts/fresh-start.ts
 * Wipes all transactional/operational data for a clean start.
 * KEEPS: Roles, Users, Permissions, Venues, Vendors, Geofences, Config tables.
 * CLEARS: Notifications, Chat, Leaves, Attendance, Audit logs, Work sessions,
 *         Expenses, Historical Income, Bookings, Customers, Leads, Events,
 *         Payment stages, Vendor payments, Discount approvals, Sales targets, Campaigns.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║         Thambaravila Flora ERP — Fresh Start Wipe        ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  // Order matters — delete child tables before parents (FK constraints)

  // 1. Financial / operational data
  const incomes    = await prisma.historicalIncome.deleteMany({});
  const expenses   = await prisma.expense.deleteMany({});
  const discounts  = await prisma.discountApproval.deleteMany({});
  const vendorPays = await prisma.vendorPayment.deleteMany({});
  const stages     = await prisma.paymentStage.deleteMany({});

  // 2. Bookings / Events / Leads / Customers
  const events     = await prisma.event.deleteMany({});
  const bookings   = await prisma.booking.deleteMany({});
  const leads      = await prisma.lead.deleteMany({});
  const customers  = await prisma.customer.deleteMany({});

  // 3. HR / Attendance / Leave
  const overrides  = await prisma.workSessionOverride.deleteMany({});
  const attempts   = await prisma.attendanceAttemptLog.deleteMany({});
  const sessions   = await prisma.workSession.deleteMany({});
  const leaves     = await prisma.leaveRequest.deleteMany({});

  // 4. Comms / Notifications / Audit
  const chats      = await prisma.chatMessage.deleteMany({});
  const notifs     = await prisma.notification.deleteMany({});
  const audits     = await prisma.auditLog.deleteMany({});

  // 5. Marketing / Targets
  const campaigns  = await prisma.socialCampaign.deleteMany({});
  const targets    = await prisma.salesTarget.deleteMany({});

  console.log('── Financial ──────────────────────────────────────────────');
  console.log(`  ✅ Historical income records  : ${incomes.count}`);
  console.log(`  ✅ Expenses                   : ${expenses.count}`);
  console.log(`  ✅ Discount approvals         : ${discounts.count}`);
  console.log(`  ✅ Vendor payments            : ${vendorPays.count}`);
  console.log(`  ✅ Payment stages             : ${stages.count}`);

  console.log('\n── Business Data ──────────────────────────────────────────');
  console.log(`  ✅ Events                     : ${events.count}`);
  console.log(`  ✅ Bookings                   : ${bookings.count}`);
  console.log(`  ✅ Leads                      : ${leads.count}`);
  console.log(`  ✅ Customers                  : ${customers.count}`);

  console.log('\n── HR / Attendance ────────────────────────────────────────');
  console.log(`  ✅ Work session overrides     : ${overrides.count}`);
  console.log(`  ✅ Attendance attempt logs    : ${attempts.count}`);
  console.log(`  ✅ Work sessions              : ${sessions.count}`);
  console.log(`  ✅ Leave requests             : ${leaves.count}`);

  console.log('\n── Comms / Audit ──────────────────────────────────────────');
  console.log(`  ✅ Chat messages              : ${chats.count}`);
  console.log(`  ✅ Notifications              : ${notifs.count}`);
  console.log(`  ✅ Audit logs                 : ${audits.count}`);

  console.log('\n── Marketing / Targets ────────────────────────────────────');
  console.log(`  ✅ Social campaigns           : ${campaigns.count}`);
  console.log(`  ✅ Sales targets              : ${targets.count}`);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  KEPT INTACT (structure & config):                       ║');
  console.log('║  ✔ Roles  ✔ Users  ✔ Permissions  ✔ Venues              ║');
  console.log('║  ✔ Vendors  ✔ Geofences  ✔ Work Schedule  ✔ Target Cfg  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n🎉 System is fully clean and ready for live use.\n');
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

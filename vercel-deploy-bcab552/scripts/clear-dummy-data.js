const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting cleanup of all dummy operational data...');

  // 1. Delete dependent transactional records
  const stages = await prisma.paymentStage.deleteMany({});
  console.log(`- Cleared ${stages.count} payment_stages`);

  const discounts = await prisma.discountApproval.deleteMany({});
  console.log(`- Cleared ${discounts.count} discount_approvals`);

  const events = await prisma.event.deleteMany({});
  console.log(`- Cleared ${events.count} events`);

  const vendorPayments = await prisma.vendorPayment.deleteMany({});
  console.log(`- Cleared ${vendorPayments.count} vendor_payments`);

  // 2. Delete Bookings
  const bookings = await prisma.booking.deleteMany({});
  console.log(`- Cleared ${bookings.count} bookings`);

  // 3. Delete Leads
  const leads = await prisma.lead.deleteMany({});
  console.log(`- Cleared ${leads.count} leads`);

  // 4. Delete Customers
  const customers = await prisma.customer.deleteMany({});
  console.log(`- Cleared ${customers.count} customers`);

  // 5. Delete Expenses
  const expenses = await prisma.expense.deleteMany({});
  console.log(`- Cleared ${expenses.count} expenses`);

  // 6. Delete Notifications, Audit Logs & Chat Messages
  const notifications = await prisma.notification.deleteMany({});
  console.log(`- Cleared ${notifications.count} notifications`);

  const auditLogs = await prisma.auditLog.deleteMany({});
  console.log(`- Cleared ${auditLogs.count} audit_logs`);

  const chat = await prisma.chatMessage.deleteMany({});
  console.log(`- Cleared ${chat.count} chat_messages`);

  const campaigns = await prisma.socialCampaign.deleteMany({});
  console.log(`- Cleared ${campaigns.count} social_campaigns`);

  const targets = await prisma.salesTarget.deleteMany({});
  console.log(`- Cleared ${targets.count} sales_targets`);

  console.log('\n✨ ALL DUMMY OPERATIONAL DATA HAS BEEN SUCCESSFULLY CLEANED! ✨');
  console.log('System is completely clean and ready for real operational data insertion.');
}

main()
  .catch((e) => {
    console.error('❌ Error clearing dummy data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

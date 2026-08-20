/**
 * scripts/clear-imported-data.ts
 * Removes all legacy-imported expenses and historical income records.
 * Leaves all live system data (bookings, payments, customers, etc.) intact.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🧹 Clearing imported legacy data...\n');

  const incomes = await prisma.historicalIncome.deleteMany({});
  const expenses = await prisma.expense.deleteMany({});

  console.log(`✅ Deleted ${incomes.count} historical income record(s)`);
  console.log(`✅ Deleted ${expenses.count} expense record(s)`);
  console.log('\n🎉 Database is clean. Ready for live use.\n');
}

main()
  .catch((e) => { console.error('Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

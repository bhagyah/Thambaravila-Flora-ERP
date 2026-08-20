import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { role: true },
  });
  console.log('--- ALL USERS ---');
  users.forEach((u) => {
    console.log(`ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Role: ${u.role.name}`);
  });

  const bookings = await prisma.booking.findMany({
    include: {
      salesExec: { include: { role: true } },
      customer: true,
    },
  });
  console.log('\n--- ALL BOOKINGS ---');
  bookings.forEach((b) => {
    console.log(`Booking ID: ${b.id}`);
    console.log(`salesExecId: ${b.salesExecId}`);
    console.log(`salesExec Name: ${b.salesExec?.name} | Email: ${b.salesExec?.email}`);
    console.log(`customer.assignedSalesManagerId: ${b.customer.assignedSalesManagerId}`);
  });
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

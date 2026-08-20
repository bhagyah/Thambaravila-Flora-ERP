import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const bookings = await prisma.booking.findMany({
    include: {
      customer: true,
      deletionRequests: true,
    },
  });
  console.log('Total bookings in DB:', bookings.length);
  console.log(JSON.stringify(bookings, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

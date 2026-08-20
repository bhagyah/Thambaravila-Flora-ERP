import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.booking.updateMany({
    data: { bookingStatus: 'INQUIRY' },
  });
  console.log(`✅ Set ${result.count} booking(s) to Step 1: INQUIRY (Initial Meeting & Consultation)`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

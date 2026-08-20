import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Mark all existing sample notifications as read in the database template
  const result = await prisma.notification.updateMany({
    data: { isRead: true },
  });
  console.log(`✅ Marked ${result.count} existing notification(s) as read in dev.db template.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

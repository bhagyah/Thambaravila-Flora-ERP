import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking user accounts in dev.db...');

  // Reset all failed attempts & locks
  await prisma.user.updateMany({
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      isActive: true,
    },
  });

  const users = await prisma.user.findMany({
    include: { role: true },
  });

  console.log(`Found ${users.length} users in database:`);

  for (const u of users) {
    const isPassOk = await verifyPassword(u.passwordHash, u.role.name === 'Owner' ? 'Admin@123' : `${u.role.name.split(' ')[0]}@123`);
    console.log(`- ${u.email} (${u.role.name}) | Active: ${u.isActive} | PassCheck: ${isPassOk}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

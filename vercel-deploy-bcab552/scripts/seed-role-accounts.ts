import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating default user accounts for all 6 roles with Argon2id...');

  const accounts = [
    { email: 'owner@thambaravila-flora.com', name: 'System Owner', roleName: 'Owner', pass: 'Admin@123' },
    { email: 'sales@thambaravila-flora.com', name: 'Samantha Sales', roleName: 'Sales Manager', pass: 'Sales@123' },
    { email: 'accountant@thambaravila-flora.com', name: 'Arthur Accountant', roleName: 'Accountant', pass: 'Accountant@123' },
    { email: 'coordinator@thambaravila-flora.com', name: 'Clara Coordinator', roleName: 'Wedding Coordinator', pass: 'Coordinator@123' },
    { email: 'social@thambaravila-flora.com', name: 'Sofia Social', roleName: 'Social Media Manager', pass: 'Social@123' },
    { email: 'it@thambaravila-flora.com', name: 'Ian IT Admin', roleName: 'IT/Admin', pass: 'ITAdmin@123' },
  ];

  for (const acc of accounts) {
    const role = await prisma.role.findUnique({ where: { name: acc.roleName } });
    if (!role) {
      console.log(`⚠️ Role ${acc.roleName} not found, skipping`);
      continue;
    }

    const passwordHash = await hashPassword(acc.pass);
    await prisma.user.upsert({
      where: { email: acc.email },
      update: { passwordHash, isActive: true, failedAttempts: 0, lockedUntil: null },
      create: {
        email: acc.email,
        name: acc.name,
        passwordHash,
        roleId: role.id,
        isActive: true,
      },
    });
    console.log(`✅ Ready: ${acc.email} (${acc.roleName}) -> Password: ${acc.pass}`);
  }

  console.log('🎉 All 6 role accounts updated with Argon2id hashes and ready!');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

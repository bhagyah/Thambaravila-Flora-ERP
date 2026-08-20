import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Floral Designer role & user account...');

  // 1. Role
  const role = await prisma.role.upsert({
    where: { name: 'Floral Designer' },
    update: { description: 'Floral concept design, stem recipe calculations, & production specs' },
    create: {
      name: 'Floral Designer',
      description: 'Floral concept design, stem recipe calculations, & production specs',
      isSystem: false,
      canBeEdited: true,
    },
  });

  // 2. User
  const email = 'designer@thambaravila-flora.com';
  const pass = 'Designer@123';
  const name = 'Deshan Designer';
  const passwordHash = await hashPassword(pass);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true, roleId: role.id, failedAttempts: 0, lockedUntil: null },
    create: {
      email,
      name,
      passwordHash,
      roleId: role.id,
      isActive: true,
    },
  });

  console.log(`✅ Floral Designer Account Ready:`);
  console.log(`   Email:    ${user.email}`);
  console.log(`   Role:     ${role.name}`);
  console.log(`   Password: ${pass}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding designer:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

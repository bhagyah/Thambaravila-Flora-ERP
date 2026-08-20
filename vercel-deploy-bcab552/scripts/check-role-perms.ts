import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const roles = await prisma.role.findMany({
    include: { rolePermissions: { include: { permission: true } } }
  });
  console.log('--- DB ROLES & PERMISSIONS ---');
  for (const r of roles) {
    console.log(`Role: ${r.name} (${r.rolePermissions.length} permissions)`);
    for (const rp of r.rolePermissions) {
      console.log(`  - ${rp.permission.name}`);
    }
  }
}
main().finally(() => prisma.$disconnect());

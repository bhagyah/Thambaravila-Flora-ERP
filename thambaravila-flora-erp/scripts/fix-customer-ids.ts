import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany();
  let count = 0;
  for (let i = 0; i < customers.length; i++) {
    const c = customers[i];
    if (!c.customerId || c.customerId === '-') {
      const formatted = 'TF-2026-' + String(i + 1).padStart(4, '0');
      await prisma.customer.update({
        where: { id: c.id },
        data: { customerId: formatted },
      });
      count++;
    }
  }
  console.log(`✅ Formatted and assigned Customer IDs to ${count} customer(s).`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testCreateCustomer() {
  console.log('--- Testing Create Customer ---');

  const year = new Date().getFullYear();
  const lastCustomer = await prisma.customer.findFirst({
    where: { customerId: { startsWith: `TF-${year}-` } },
    orderBy: { customerId: 'desc' },
    select: { customerId: true },
  });

  let nextNumber = 1;
  if (lastCustomer && lastCustomer.customerId) {
    const match = lastCustomer.customerId.match(/TF-\d{4}-(\d+)/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const formattedNumber = nextNumber.toString().padStart(4, '0');
  const customerId = `TF-${year}-${formattedNumber}`;
  console.log('Generated customerId:', customerId);

  const payload = {
    customerId,
    name: 'Bhagya Hirushan',
    phone: '+94761094968',
    email: '22ug1-0938@sltc.ac.lk',
    address: 'Tharanga,Hettiyawala,Kirinda,Puhulwella,Matara',
    source: 'SOCIAL' as const,
    nicNumber: '992246200V',
    dateOfBirth: new Date('1999-08-11'),
    gender: 'Male',
    socialHandle: 'bhagyah99',
  };

  try {
    const created = await prisma.customer.create({ data: payload });
    console.log('Successfully created customer:', created);
  } catch (err: any) {
    console.error('FAILED TO CREATE CUSTOMER:', err);
  }
}

testCreateCustomer()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

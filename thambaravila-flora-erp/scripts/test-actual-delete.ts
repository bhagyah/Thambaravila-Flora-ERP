import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testDelete() {
  const bookingId = 'B-001';
  console.log('--- Testing Delete for Booking B-001 ---');

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: true },
  });

  if (!booking) {
    console.log('Booking B-001 not found.');
    return;
  }

  const customerId = booking.customerId;
  console.log(`Found Booking B-001 with customerId: ${customerId} (${booking.customer.name})`);

  try {
    // Delete sub-records
    console.log('Deleting payment stages...');
    await prisma.paymentStage.deleteMany({ where: { bookingId } });

    console.log('Deleting discount approvals...');
    await prisma.discountApproval.deleteMany({ where: { bookingId } });

    console.log('Deleting events...');
    await prisma.event.deleteMany({ where: { bookingId } });

    console.log('Deleting deletion requests...');
    await prisma.bookingDeletionRequest.deleteMany({ where: { bookingId } });

    console.log('Deleting booking...');
    await prisma.booking.delete({ where: { id: bookingId } });
    console.log('Booking B-001 deleted successfully!');

    console.log('Checking remaining bookings for customer...');
    const remainingBookings = await prisma.booking.count({ where: { customerId } });
    console.log(`Remaining bookings for customer ${customerId}: ${remainingBookings}`);

    if (remainingBookings === 0) {
      console.log('Deleting customer leads...');
      await prisma.lead.deleteMany({ where: { customerId } });

      console.log('Deleting customer record...');
      await prisma.customer.delete({ where: { id: customerId } });
      console.log('Customer deleted successfully!');
    }
  } catch (err: any) {
    console.error('Error during deletion:', err);
  }
}

testDelete()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

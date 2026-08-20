import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({ where: { email: 'sales@thambaravila-flora.com' } });
  const booking = await prisma.booking.findUnique({ where: { id: 'B-001' } });

  if (!user || !booking) {
    console.log('User or booking missing:', { user: !!user, booking: !!booking });
    return;
  }

  try {
    const existingPending = await prisma.bookingDeletionRequest.findFirst({
      where: { bookingId: booking.id, status: 'PENDING' },
    });
    console.log('Existing pending:', existingPending);

    const deletionRequest = await prisma.bookingDeletionRequest.create({
      data: {
        bookingId: booking.id,
        requestedById: user.id,
        customerName: 'Bhagya Hirushan',
        reason: 'Client requested cancellation',
        status: 'PENDING',
      },
    });
    console.log('Successfully created deletion request:', deletionRequest);
  } catch (err: any) {
    console.error('Error creating deletion request:', err);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

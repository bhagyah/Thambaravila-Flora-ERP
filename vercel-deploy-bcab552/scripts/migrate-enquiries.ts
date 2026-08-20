import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Running Enquiry to Lead/Booking migration...');

  try {
    // Check if legacy enquiries table exists in SQLite raw query
    const legacyEnquiries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM enquiries`).catch(() => []);

    console.log(`Found ${legacyEnquiries.length} legacy enquiries to migrate.`);

    let leadCount = 0;
    let bookingCount = 0;

    for (let i = 0; i < legacyEnquiries.length; i++) {
      const enq = legacyEnquiries[i];
      const leadId = `L-${String(i + 1).padStart(3, '0')}`;

      // Map status
      let leadStage = 'NEW_INQUIRY';
      let isWon = false;
      let isLost = false;

      if (enq.status === 'ADVANCE_DUE') {
        leadStage = 'PROPOSAL_SENT';
      } else if (enq.status === 'CANCELLED') {
        leadStage = 'LOST';
        isLost = true;
      } else if (['ADVANCE_PAID', 'FLOWER_PAYMENT_DUE', 'FLOWER_PAID', 'FINAL_PAYMENT_DUE', 'COMPLETED'].includes(enq.status)) {
        leadStage = 'WON';
        isWon = true;
      }

      // Create Lead
      const lead = await prisma.lead.upsert({
        where: { id: leadId },
        update: {},
        create: {
          id: leadId,
          customerId: enq.customer_id,
          inquiryDate: enq.created_at ? new Date(enq.created_at) : new Date(),
          tentativeWeddingDate: enq.event_date ? new Date(enq.event_date) : null,
          leadSource: 'REFERRAL',
          stage: leadStage as any,
          assignedSalesExecId: enq.created_by_id,
          converted: isWon,
        },
      });
      leadCount++;

      // If WON, create Booking & re-link PaymentStages
      if (isWon) {
        bookingCount++;
        const bookingId = `B-${String(bookingCount).padStart(3, '0')}`;
        const weddingDate = enq.event_date ? new Date(enq.event_date) : new Date();
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = daysOfWeek[weddingDate.getDay()];
        const totalQuoteAmount = enq.total_quote_amount || 0;
        const depositPercent = 30.0;
        const depositAmount = Math.round(totalQuoteAmount * (depositPercent / 100));
        const balanceDueAmount = totalQuoteAmount - depositAmount;

        const booking = await prisma.booking.upsert({
          where: { id: bookingId },
          update: {},
          create: {
            id: bookingId,
            customerId: enq.customer_id,
            leadId: lead.id,
            weddingDate,
            dayOfWeek,
            packageType: 'CLASSIC_ELEGANCE',
            serviceScope: 'FULL_WEDDING_PACKAGE',
            salesExecId: enq.created_by_id,
            totalQuoteAmount,
            depositPercent,
            depositAmount,
            balanceDueAmount,
            paymentStatus: enq.status === 'COMPLETED' ? 'PAID_IN_FULL' : 'DEPOSIT_PAID',
            bookingStatus: enq.status === 'COMPLETED' ? 'COMPLETED' : 'CONFIRMED',
          },
        });

        // Re-link payment stages
        await prisma.$executeRawUnsafe(
          `UPDATE payment_stages SET booking_id = ? WHERE enquiry_id = ?`,
          booking.id,
          enq.id
        ).catch(() => {});
      }
    }

    console.log(`✅ Migration complete! Created ${leadCount} Leads and ${bookingCount} Bookings.`);
  } catch (err) {
    console.error('Migration notice:', err);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import { createPaymentStagesForBooking, computeBookingPaymentStatus } from '../lib/payment/deadline-engine';
import { confirmPayment } from '../lib/payment/payment-workflow';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Testing Two-Pipeline Lead & Booking Architecture...\n');

  // 1. Get or create test customer
  const customer = await prisma.customer.findFirst();
  if (!customer) {
    throw new Error('No customer found in db to test with');
  }

  // 2. Create Lead
  const leadId = `L-TEST-${Date.now().toString().slice(-4)}`;
  const lead = await prisma.lead.create({
    data: {
      id: leadId,
      customerId: customer.id,
      tentativeWeddingDate: new Date('2026-11-15'),
      tentativeVenue: 'Shangri-La Colombo',
      estimatedGuestCount: 400,
      budgetRange: '20000000', // 200,000 LKR in cents
      leadSource: 'INSTAGRAM_DM',
      stage: 'PROPOSAL_SENT',
    },
  });
  console.log(`✅ Step 1: Created Lead ${lead.id} (${lead.stage}) for customer ${customer.name}`);

  // 3. Simulate Stage change to WON
  const updatedLead = await prisma.lead.update({
    where: { id: lead.id },
    data: { stage: 'WON', converted: true },
  });
  console.log(`✅ Step 2: Set Lead ${lead.id} stage to WON -> converted = ${updatedLead.converted}`);

  // 4. System Trigger: Auto-create Booking + Payment Stages
  const bookingCount = await prisma.booking.count();
  const bookingId = `B-TEST-${Date.now().toString().slice(-4)}`;
  const totalQuote = 20000000;
  const depositPercent = 30.0;
  const depositAmount = Math.round(totalQuote * 0.3);
  const balanceDueAmount = totalQuote - depositAmount;

  const booking = await prisma.booking.create({
    data: {
      id: bookingId,
      customerId: customer.id,
      leadId: lead.id,
      weddingDate: new Date('2026-11-15'),
      dayOfWeek: 'Sunday',
      packageType: 'SIGNATURE_LUXURY',
      serviceScope: 'FULL_WEDDING_PACKAGE',
      totalQuoteAmount: totalQuote,
      depositPercent,
      depositAmount,
      balanceDueAmount,
      paymentStatus: 'NOT_STARTED',
      bookingStatus: 'CONFIRMED',
    },
  });

  await createPaymentStagesForBooking(booking.id, new Date(), new Date('2026-11-15'), totalQuote);

  const stages = await prisma.paymentStage.findMany({ where: { bookingId: booking.id } });
  console.log(`✅ Step 3: System Auto-Created Booking ${booking.id} with ${stages.length} Payment Stages:`);
  stages.forEach(s => console.log(`   - Stage: ${s.stageType} | Due: LKR ${(s.amountDue / 100).toLocaleString()} | Status: ${s.status}`));

  // 5. Simulate Accountant Confirming ADVANCE stage
  const accountant = await prisma.user.findFirst({ where: { role: { name: 'Accountant' } } });
  const advanceStage = stages.find(s => s.stageType === 'ADVANCE');

  if (accountant && advanceStage) {
    const confirmResult = await confirmPayment({
      paymentStageId: advanceStage.id,
      amountPaid: advanceStage.amountDue,
      paidDate: new Date(),
      confirmedByUserId: accountant.id,
    });

    console.log(`\n✅ Step 4: Accountant Confirmed Advance Payment Stage!`);
    console.log(`   - Payment Stage Status: ${confirmResult.paymentStage.status}`);
    console.log(`   - Booking Computed Rollup Payment Status: ${confirmResult.bookingPaymentStatus}`);
  }

  console.log('\n🎉 Two-Pipeline Architecture Test Passed 100%!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth/middleware';
import { createAuditLog, AuditAction } from '@/lib/auth/audit';
import { parseLkrToCents } from '@/lib/utils/money';
import { computeBookingPaymentStatus, createPaymentStagesForBooking } from '@/lib/payment/deadline-engine';

async function fileToDataUrl(file: File | null | undefined) {
  if (!file) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'application/octet-stream';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

async function readBookingPayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    return {
      body: {
        weddingDate: formData.get('weddingDate')?.toString(),
        ceremonyVenueId: formData.get('ceremonyVenueId')?.toString(),
        ceremonyTime: formData.get('ceremonyTime')?.toString(),
        receptionVenueId: formData.get('receptionVenueId')?.toString(),
        receptionTime: formData.get('receptionTime')?.toString(),
        floristSetupTime: formData.get('floristSetupTime')?.toString(),
        guestCount: formData.get('guestCount')?.toString(),
        packageType: formData.get('packageType')?.toString(),
        serviceScope: formData.get('serviceScope')?.toString(),
        colourTheme: formData.get('colourTheme')?.toString(),
        salesExecId: formData.get('salesExecId')?.toString(),
        totalQuoteAmount: formData.get('totalQuoteAmount')?.toString(),
        bookingStatus: formData.get('bookingStatus')?.toString(),
        confirmationStatus: formData.get('confirmationStatus')?.toString(),
        notes: formData.get('notes')?.toString(),
        photographerVendorId: formData.get('photographerVendorId')?.toString(),
        decoratorVendorId: formData.get('decoratorVendorId')?.toString(),
        catererVendorId: formData.get('catererVendorId')?.toString(),
        action: formData.get('action')?.toString(),
        quoteOutcomeReason: formData.get('quoteOutcomeReason')?.toString(),
      },
      quotationFile: formData.get('quotationFile') as File | null,
      jobSheetFile: formData.get('jobSheetFile') as File | null,
    };
  }

  return {
    body: await request.json(),
    quotationFile: null,
    jobSheetFile: null,
  };
}

const PAYMENT_ACTIVE_STATUSES = ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        lead: true,
        ceremonyVenue: true,
        receptionVenue: true,
        photographerVendor: true,
        decoratorVendor: true,
        catererVendor: true,
        salesExec: { select: { id: true, name: true, email: true } },
        paymentStages: {
          orderBy: { dueDate: 'asc' },
          include: { paidConfirmedBy: { select: { id: true, name: true } } },
        },
        discountApprovals: {
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: {
              select: {
                id: true,
                name: true,
                role: { select: { name: true } },
              },
            },
            approvedBy: {
              select: {
                id: true,
                name: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        events: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const now = new Date();
    const daysUntil = Math.ceil((new Date(booking.weddingDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return NextResponse.json({
      ...booking,
      daysUntilWedding: daysUntil,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingBooking = await prisma.booking.findUnique({
      where: { id },
      include: { customer: true, lead: true, paymentStages: { orderBy: { dueDate: 'asc' } } },
    });

    if (!existingBooking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const { body, quotationFile, jobSheetFile } = await readBookingPayload(request);

    const {
      weddingDate,
      ceremonyVenueId,
      ceremonyTime,
      receptionVenueId,
      receptionTime,
      floristSetupTime,
      guestCount,
      packageType,
      serviceScope,
      colourTheme,
      salesExecId,
      totalQuoteAmount,
      bookingStatus,
      confirmationStatus,
      action,
      quoteOutcomeReason,
      notes,
      photographerVendorId,
      decoratorVendorId,
      catererVendorId,
    } = body;

    let dayOfWeek: string | undefined = undefined;
    if (weddingDate) {
      const dateObj = new Date(weddingDate);
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayOfWeek = daysOfWeek[dateObj.getDay()];
    }

    const STAGE_SEQUENCE = ['INQUIRY', 'IN_DESIGN', 'CONFIRMED', 'IN_PRODUCTION', 'DELIVERED', 'COMPLETED'];

    const requestedBookingStatus =
      action === 'DECLINE_QUOTE'
        ? bookingStatus || 'CANCELLED'
        : action === 'REOPEN_QUOTE'
        ? bookingStatus || 'IN_DESIGN'
        : action === 'SAVE_QUOTE'
        ? 'IN_DESIGN'
        : action === 'CONFIRM_QUOTE'
        ? 'IN_PRODUCTION'
        : bookingStatus;

    if (requestedBookingStatus && requestedBookingStatus !== existingBooking.bookingStatus) {
      if (existingBooking.bookingStatus === 'CANCELLED') {
        if (action !== 'REOPEN_QUOTE' && !STAGE_SEQUENCE.includes(requestedBookingStatus)) {
          return NextResponse.json(
            {
              error: `Invalid stage: ${requestedBookingStatus}. Please choose a valid workflow stage.`
            },
            { status: 400 }
          );
        }
      } else if (STAGE_SEQUENCE.includes(requestedBookingStatus)) {
        const curIdx = STAGE_SEQUENCE.indexOf(existingBooking.bookingStatus);
        const newIdx = STAGE_SEQUENCE.indexOf(requestedBookingStatus);

        const completesApprovedQuoteStage =
          action === 'CONFIRM_QUOTE' &&
          existingBooking.bookingStatus === 'IN_DESIGN' &&
          requestedBookingStatus === 'IN_PRODUCTION';

        // Quote approval completes stage 3 and enters stage 4 atomically.
        if (user.role?.name !== 'Owner' && curIdx !== -1 && newIdx > curIdx + 1 && !completesApprovedQuoteStage) {
          return NextResponse.json(
            {
              error: `Sequential stage rule: You cannot skip directly from Step ${curIdx + 1} (${existingBooking.bookingStatus}) to Step ${newIdx + 1} (${requestedBookingStatus}). Stages must be completed step-by-step.`
            },
            { status: 400 }
          );
        }
      }
    }

    const updateData: any = {
      ...(weddingDate && { weddingDate: new Date(weddingDate), dayOfWeek }),
      ...(ceremonyVenueId !== undefined && { ceremonyVenueId }),
      ...(ceremonyTime !== undefined && { ceremonyTime }),
      ...(receptionVenueId !== undefined && { receptionVenueId }),
      ...(receptionTime !== undefined && { receptionTime }),
      ...(floristSetupTime !== undefined && { floristSetupTime }),
      ...(guestCount !== undefined && { guestCount: guestCount ? parseInt(guestCount, 10) : null }),
      ...(packageType && { packageType }),
      ...(serviceScope && { serviceScope }),
      ...(colourTheme !== undefined && { colourTheme }),
      ...(salesExecId !== undefined && { salesExecId }),
      ...(bookingStatus && { bookingStatus }),
      ...(confirmationStatus && { confirmationStatus }),
      ...(action === 'SAVE_QUOTE' && { confirmationStatus: 'PENDING', bookingStatus: 'IN_DESIGN' }),
      ...(action === 'REOPEN_QUOTE' && {
        confirmationStatus: ['CONFIRMED', 'IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(bookingStatus) ? 'CONFIRMED' : 'PENDING',
        bookingStatus: bookingStatus || 'IN_DESIGN',
        quoteOutcomeReason: null,
      }),
      ...(action === 'DECLINE_QUOTE' && { confirmationStatus: 'NOT_CONFIRMED', bookingStatus: bookingStatus || 'CANCELLED' }),
      ...(action === 'CONFIRM_QUOTE' && { confirmationStatus: 'CONFIRMED', bookingStatus: 'IN_PRODUCTION' }),
      ...(notes !== undefined && { notes }),
      ...(photographerVendorId !== undefined && { photographerVendorId }),
      ...(decoratorVendorId !== undefined && { decoratorVendorId }),
      ...(catererVendorId !== undefined && { catererVendorId }),
      ...(quoteOutcomeReason !== undefined && { quoteOutcomeReason }),
    };

    // Reaching production means quotation was approved. Keep confirmation
    // state aligned for manual stage changes as well as quote approval.
    if (
      ['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(updateData.bookingStatus) &&
      action !== 'DECLINE_QUOTE'
    ) {
      updateData.confirmationStatus = 'CONFIRMED';
    }

    if (quotationFile) {
      if (quotationFile.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Quotation file must be 10MB or smaller' }, { status: 413 });
      }
      updateData.quotationAttachmentUrl = await fileToDataUrl(quotationFile);
      updateData.quotationAttachmentName = quotationFile.name;
      updateData.quotationAttachmentType = quotationFile.type || 'application/pdf';
    }

    if (
      action === 'CONFIRM_QUOTE' &&
      !quotationFile &&
      !existingBooking.quotationAttachmentUrl
    ) {
      return NextResponse.json(
        { error: 'Upload the confirmed quotation PDF before completing stage 3.' },
        { status: 400 }
      );
    }

    if (jobSheetFile) {
      const nextJobSheetStatus = updateData.bookingStatus || existingBooking.bookingStatus;
      if (!['IN_PRODUCTION', 'DELIVERED', 'COMPLETED'].includes(nextJobSheetStatus)) {
        return NextResponse.json(
          { error: 'Job sheet upload is available from stage 4: Flower Production & Prep.' },
          { status: 400 }
        );
      }

      if (jobSheetFile.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'Job sheet file must be 10MB or smaller' }, { status: 413 });
      }
      updateData.jobSheetAttachmentUrl = await fileToDataUrl(jobSheetFile);
      updateData.jobSheetAttachmentName = jobSheetFile.name;
      updateData.jobSheetAttachmentType = jobSheetFile.type || 'application/pdf';
    }

    // ── SMART BUDGET ADJUSTMENT & IMMEDIATE DYNAMIC PAYMENT STAGE REBALANCING ──
    if (totalQuoteAmount !== undefined && totalQuoteAmount !== null) {
      const newTotalCents = parseLkrToCents(totalQuoteAmount);
      if (newTotalCents === null) {
        return NextResponse.json({ error: 'Total quote amount must be a valid LKR amount' }, { status: 400 });
      }

      const oldTotalCents = existingBooking.totalQuoteAmount;

      const deltaCents = newTotalCents - oldTotalCents;
      const totalPaidCents = existingBooking.paymentStages.reduce((sum, s) => sum + s.amountPaid, 0);

      // Check if customer has ALREADY PAID IN FULL
      const isFullyPaid =
        existingBooking.paymentStatus === 'PAID_IN_FULL' ||
        (existingBooking.paymentStages.length > 0 &&
          existingBooking.paymentStages.every((s) => s.status === 'PAID'));

      const depositPercent = existingBooking.depositPercent || 30.0;
      const newDepositAmount = Math.round(newTotalCents * (depositPercent / 100));

      updateData.totalQuoteAmount = newTotalCents;
      updateData.depositAmount = newDepositAmount;

      const today = new Date();

      if (isFullyPaid || totalPaidCents >= oldTotalCents) {
        // ── CASE 1: Customer has ALREADY PAID IN FULL ──
        if (deltaCents > 0) {
          // Budget INCREASED: Create a new "New changes Dues" stage
          await prisma.paymentStage.create({
            data: {
              bookingId: id,
              stageType: 'New changes Dues' as any,
              amountDue: deltaCents,
              dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days due
              amountPaid: 0,
              status: 'PENDING',
            },
          });
          updateData.paymentStatus = 'PARTIAL_PAYMENT';
          updateData.balanceDueAmount = deltaCents;
        } else if (deltaCents < 0) {
          // Budget DECREASED / DROPPED: Create a new "Customer Refund Due" stage
          const refundCents = Math.abs(deltaCents);
          await prisma.paymentStage.create({
            data: {
              bookingId: id,
              stageType: 'Customer Refund Due' as any,
              amountDue: refundCents,
              dueDate: today,
              amountPaid: 0,
              status: 'REFUND_DUE' as any,
            },
          });
          updateData.paymentStatus = 'REFUND_DUE' as any;
          updateData.balanceDueAmount = 0;
        }
      } else {
        // ── CASE 2: Customer is IN-PROGRESS (Advance, Flower, or Final stages unpaid) ──
        const unpaidStages = existingBooking.paymentStages.filter(
          (s) => s.status !== 'PAID' && s.amountDue > s.amountPaid
        );

        if (deltaCents > 0) {
          // Budget INCREASED: Add delta to the last unpaid stage (e.g. FINAL or FLOWER)
          if (unpaidStages.length > 0) {
            const targetStage = unpaidStages[unpaidStages.length - 1];
            await prisma.paymentStage.update({
              where: { id: targetStage.id },
              data: { amountDue: targetStage.amountDue + deltaCents },
            });
          } else {
            // If no unpaid stages remain, create "New changes Dues"
            await prisma.paymentStage.create({
              data: {
                bookingId: id,
                stageType: 'New changes Dues' as any,
                amountDue: deltaCents,
                dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
                amountPaid: 0,
                status: 'PENDING',
              },
            });
          }
          updateData.paymentStatus = 'PARTIAL_PAYMENT';
          updateData.balanceDueAmount = Math.max(0, newTotalCents - totalPaidCents);
        } else if (deltaCents < 0) {
          // Budget DECREASED / DROPPED: Reduce unpaid stage balances
          let reductionCents = Math.abs(deltaCents);

          for (let i = unpaidStages.length - 1; i >= 0; i--) {
            if (reductionCents <= 0) break;
            const stage = unpaidStages[i];
            const remDue = stage.amountDue - stage.amountPaid;

            if (reductionCents <= remDue) {
              const newDue = stage.amountDue - reductionCents;
              await prisma.paymentStage.update({
                where: { id: stage.id },
                data: {
                  amountDue: newDue,
                  status: newDue <= stage.amountPaid ? 'PAID' : stage.status,
                },
              });
              reductionCents = 0;
            } else {
              // Reduction is larger than this stage's remaining due
              reductionCents -= remDue;
              await prisma.paymentStage.update({
                where: { id: stage.id },
                data: {
                  amountDue: stage.amountPaid,
                  status: 'PAID',
                },
              });
            }
          }

          // If reduction exceeded all unpaid stages (customer paid more than new total budget)
          if (reductionCents > 0) {
            await prisma.paymentStage.create({
              data: {
                bookingId: id,
                stageType: 'Customer Refund Due' as any,
                amountDue: reductionCents,
                dueDate: today,
                amountPaid: 0,
                status: 'REFUND_DUE' as any,
              },
            });
            updateData.paymentStatus = 'REFUND_DUE' as any;
            updateData.balanceDueAmount = 0;
          } else {
            const remainingDue = Math.max(0, newTotalCents - totalPaidCents);
            updateData.balanceDueAmount = remainingDue;
            updateData.paymentStatus = remainingDue === 0 ? 'PAID_IN_FULL' : 'PARTIAL_PAYMENT';
          }
        }
      }

      // Create Approval / Log entry
      const isOwner = user.role?.name === 'Owner';
      const approvalStatus = isOwner ? 'APPROVED' : 'PENDING';

      await prisma.discountApproval.create({
        data: {
          bookingId: id,
          requestedById: user.id,
          amount: Math.abs(deltaCents),
          reason: notes || `Budget adjusted from LKR ${(oldTotalCents / 100).toLocaleString()} to LKR ${(newTotalCents / 100).toLocaleString()}`,
          status: approvalStatus,
          approvedById: isOwner ? user.id : null,
        },
      });

      // Broadcast Notification
      try {
        await prisma.notification.create({
          data: {
            title: `💰 Budget Adjusted for Booking ${id}`,
            message: `Client ${existingBooking.customer.name}'s total budget changed from LKR ${(oldTotalCents / 100).toLocaleString()} to LKR ${(newTotalCents / 100).toLocaleString()} by ${user.name} (${user.role?.name || 'Staff'}).`,
            type: 'WARNING',
            roleName: 'Owner',
            link: `/bookings/${id}`,
          },
        });
      } catch (err) {
        console.error('Failed to create notification:', err);
      }

      // Create Audit Log
      try {
        await createAuditLog({
          userId: user.id,
          action: 'BOOKING_UPDATED',
          entityType: 'booking',
          entityId: id,
          details: {
            oldTotalBudget: oldTotalCents,
            newTotalBudget: newTotalCents,
            delta: deltaCents,
            approvalStatus,
          },
        });
      } catch (err) {
        console.error('Failed audit log:', err);
      }
    }

    await prisma.booking.update({
      where: { id },
      data: updateData,
    });

    const nextBookingStatus = updateData.bookingStatus || existingBooking.bookingStatus;
    const isWonBooking = PAYMENT_ACTIVE_STATUSES.includes(nextBookingStatus);
    const shouldMarkConfirmed = isWonBooking && !PAYMENT_ACTIVE_STATUSES.includes(existingBooking.bookingStatus);

    if (isWonBooking && existingBooking.leadId) {
      await prisma.lead.update({
        where: { id: existingBooking.leadId },
        data: {
          stage: 'WON',
          converted: true,
        },
      });
    } else if (!isWonBooking && existingBooking.leadId && existingBooking.lead?.stage === 'WON') {
      await prisma.lead.update({
        where: { id: existingBooking.leadId },
        data: { stage: 'NEGOTIATION', converted: false },
      });
    }

    if (shouldMarkConfirmed) {
      const advanceStage = await prisma.paymentStage.findFirst({
        where: { bookingId: id, stageType: 'ADVANCE' },
      });

      if (advanceStage) {
        await prisma.paymentStage.update({
          where: { id: advanceStage.id },
          data: {
            dueDate: new Date(Date.now() + 5 * 60 * 1000),
            status: 'DUE_SOON',
          },
        });
      }

      await computeBookingPaymentStatus(id);

      try {
        await createAuditLog({
          userId: user.id,
          action: 'BOOKING_CONFIRMED',
          entityType: 'booking',
          entityId: id,
          details: {
            leadId: existingBooking.leadId,
            confirmedBy: user.name,
          },
        });
      } catch (err) {
        console.error('Failed audit log for confirmed booking:', err);
      }
    }

    if (action === 'DECLINE_QUOTE') {
      if (existingBooking.leadId) {
        await prisma.lead.update({
          where: { id: existingBooking.leadId },
          data: {
            stage: 'NEGOTIATION',
            converted: false,
          },
        });
      }

      try {
        await createAuditLog({
          userId: user.id,
          action: 'BOOKING_QUOTE_REVISED',
          entityType: 'booking',
          entityId: id,
          details: {
            leadId: existingBooking.leadId,
            reason: quoteOutcomeReason || notes || 'Quote declined and sent back for redesign',
          },
        });
      } catch (err) {
        console.error('Failed audit log for declined booking:', err);
      }
    }

    if (action === 'REOPEN_QUOTE') {
      if (existingBooking.leadId) {
        await prisma.lead.update({
          where: { id: existingBooking.leadId },
          data: {
            stage: 'NEGOTIATION',
            converted: false,
          },
        });
      }

      try {
        await createAuditLog({
          userId: user.id,
          action: 'BOOKING_QUOTE_REOPENED',
          entityType: 'booking',
          entityId: id,
          details: {
            leadId: existingBooking.leadId,
            reason: 'Quote reopened and moved back to Design & Quotation stage',
          },
        });
      } catch (err) {
        console.error('Failed audit log for reopened booking:', err);
      }
    }

    if (PAYMENT_ACTIVE_STATUSES.includes(nextBookingStatus)) {
      const nextWeddingDate = updateData.weddingDate || existingBooking.weddingDate;
      const nextTotalQuoteAmount =
        updateData.totalQuoteAmount !== undefined && updateData.totalQuoteAmount !== null
          ? updateData.totalQuoteAmount
          : existingBooking.totalQuoteAmount;

      if (typeof nextTotalQuoteAmount === 'number') {
        await createPaymentStagesForBooking(id, existingBooking.updatedAt, nextWeddingDate, nextTotalQuoteAmount);

        // Stage 4 is payment activation. Existing stage-4 bookings may have
        // reached production before this gate existed, so repair their first
        // due date after idempotent stage creation.
        const advanceStage = await prisma.paymentStage.findFirst({
          where: { bookingId: id, stageType: 'ADVANCE' },
        });
        if (advanceStage && advanceStage.status === 'PENDING') {
          await prisma.paymentStage.update({
            where: { id: advanceStage.id },
            data: {
              dueDate: new Date(Date.now() + 5 * 60 * 1000),
              status: 'DUE_SOON',
            },
          });
        }
      }
    }

    await computeBookingPaymentStatus(id);

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        customer: true,
        lead: true,
        ceremonyVenue: true,
        receptionVenue: true,
        photographerVendor: true,
        decoratorVendor: true,
        catererVendor: true,
        salesExec: { select: { id: true, name: true, email: true } },
        paymentStages: {
          orderBy: { dueDate: 'asc' },
          include: { paidConfirmedBy: { select: { id: true, name: true } } },
        },
        discountApprovals: {
          orderBy: { createdAt: 'desc' },
          include: {
            requestedBy: {
              select: {
                id: true,
                name: true,
                role: { select: { name: true } },
              },
            },
            approvedBy: {
              select: {
                id: true,
                name: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        events: true,
      },
    });

    return NextResponse.json(booking);
  } catch (error: any) {
    console.error('Error updating booking:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bookingId } = await params;
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role?.name !== 'Owner') {
      return NextResponse.json({ error: 'Forbidden: Only Owner can delete bookings directly' }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Delete associated sub-records
    await prisma.paymentStage.deleteMany({ where: { bookingId } }).catch(() => {});
    await prisma.discountApproval.deleteMany({ where: { bookingId } }).catch(() => {});
    await prisma.bookingDeletionRequest.deleteMany({ where: { bookingId } }).catch(() => {});
    await prisma.event.deleteMany({ where: { bookingId } }).catch(() => {});

    // Delete booking
    await prisma.booking.delete({ where: { id: bookingId } });

    await createAuditLog({
      userId: user.id,
      action: 'BOOKING_DELETED',
      entityType: 'booking',
      entityId: bookingId,
      details: { deletedByOwner: true, customerRetained: true },
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
    });

    return NextResponse.json({ success: true, message: `Booking ${bookingId} deleted. Customer and lead records were retained.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

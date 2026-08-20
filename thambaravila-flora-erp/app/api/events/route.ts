import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const events = await prisma.event.findMany({
      include: { booking: { include: { customer: true } } },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, bookingId, title, date, venue, coordinatorId, coordinatorName, status, checklistJson, eventId } = body;

    if (action === 'CREATE') {
      if (!bookingId || !title || !date) {
        return NextResponse.json({ error: 'Missing bookingId, title, or date' }, { status: 400 });
      }

      const defaultChecklist = JSON.stringify([
        { id: '1', task: 'Venue Confirmed', done: false },
        { id: '2', task: 'Vendor Confirmed', done: false },
        { id: '3', task: 'Flower Order Placed', done: false },
        { id: '4', task: 'Delivery Scheduled', done: false },
      ]);

      const event = await prisma.event.create({
        data: {
          bookingId,
          title,
          date: new Date(date),
          venue,
          coordinatorId: coordinatorId || session.user.id,
          coordinatorName: coordinatorName || session.user.name,
          checklistJson: checklistJson || defaultChecklist,
        },
      });

      return NextResponse.json({ event }, { status: 201 });
    }

    if (action === 'UPDATE_CHECKLIST') {
      if (!eventId || !checklistJson) {
        return NextResponse.json({ error: 'Missing eventId or checklistJson' }, { status: 400 });
      }

      const event = await prisma.event.update({
        where: { id: eventId },
        data: {
          checklistJson,
          status: status || undefined,
        },
      });

      return NextResponse.json({ event });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error creating/updating event:', error);
    return NextResponse.json({ error: 'Failed to process event request' }, { status: 500 });
  }
}

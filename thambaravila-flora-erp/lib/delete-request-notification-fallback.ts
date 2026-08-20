import { prisma } from '@/lib/prisma';

type SessionLike = {
  user?: {
    id?: string | null;
    role?: { name?: string | null } | null;
  } | null;
} | null;

type RequesterInfo = {
  name: string;
  role: { name: string };
};

function ownerNotificationScope(ownerUserId?: string | null) {
  return [
    ...(ownerUserId ? [{ userId: ownerUserId }] : []),
    { roleName: 'Owner' },
  ];
}

function parseRequester(message: string): RequesterInfo | undefined {
  const match = message.match(/^(.+?)\s+\((.+?)\)\s+requested deletion/i);
  if (!match) return undefined;
  return { name: match[1], role: { name: match[2] } };
}

function parseReason(message: string) {
  return message.match(/Reason:\s*"([^"]*)"/i)?.[1] || 'Owner approval requested';
}

function parseDeletedCustomerTitle(title: string) {
  const match = title.match(/^Customer Deleted:\s+(.+?)\s+\(([^()]+)\)$/i);
  if (!match) return null;
  return {
    customerName: match[1],
    publicCustomerId: match[2],
  };
}

export async function getCustomerDeletionRequestsFromNotifications(session: SessionLike) {
  if (session?.user?.role?.name !== 'Owner') return [];

  const notifications = await prisma.notification.findMany({
    where: {
      type: 'URGENT',
      title: { contains: 'Customer Deletion' },
      OR: ownerNotificationScope(session.user?.id),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }).catch(() => []);

  const requests: any[] = [];
  const seenCustomerIds = new Set<string>();

  for (const notification of notifications) {
    const parsed = notification.message.match(/Customer\s+(.+?)\s+\(([^()]+)\)\.\s*Reason:/i);
    if (!parsed) continue;

    const customerName = parsed[1];
    const publicCustomerId = parsed[2];
    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { id: publicCustomerId },
          { customerId: publicCustomerId },
          { name: customerName },
        ],
      },
      select: {
        id: true,
        customerId: true,
        name: true,
        phone: true,
        email: true,
      },
    }).catch(() => null);

    if (!customer || seenCustomerIds.has(customer.id)) continue;
    seenCustomerIds.add(customer.id);

    requests.push({
      id: customer.id,
      customerId: customer.id,
      customerName: customer.name || customerName,
      reason: parseReason(notification.message),
      status: 'PENDING',
      createdAt: notification.createdAt,
      customer,
      requestedBy: parseRequester(notification.message),
      fromNotificationFallback: true,
    });
  }

  return requests;
}

export async function getBookingDeletionRequestsFromNotifications(session: SessionLike) {
  if (session?.user?.role?.name !== 'Owner') return [];

  const notifications = await prisma.notification.findMany({
    where: {
      type: 'URGENT',
      title: { contains: 'Booking Deletion' },
      OR: ownerNotificationScope(session.user?.id),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }).catch(() => []);

  const requests: any[] = [];
  const seenBookingIds = new Set<string>();

  for (const notification of notifications) {
    const parsed = notification.message.match(/Booking\s+([A-Za-z0-9_-]+)\.\s*Reason:/i);
    if (!parsed) continue;

    const bookingId = parsed[1];
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        weddingDate: true,
        totalQuoteAmount: true,
        customer: { select: { name: true, phone: true } },
      },
    }).catch(() => null);

    if (!booking || seenBookingIds.has(booking.id)) continue;
    seenBookingIds.add(booking.id);

    requests.push({
      id: booking.id,
      bookingId: booking.id,
      customerName: booking.customer?.name || 'Client',
      reason: parseReason(notification.message),
      status: 'PENDING',
      createdAt: notification.createdAt,
      booking,
      requestedBy: parseRequester(notification.message),
      fromNotificationFallback: true,
    });
  }

  return requests;
}

export async function markCustomerDeletionNotificationsResolved(
  ownerUserId: string | null | undefined,
  customerId: string,
  publicCustomerId: string | null | undefined,
  decision: 'APPROVED' | 'REJECTED'
) {
  const containsId = publicCustomerId || customerId;
  await prisma.notification.updateMany({
    where: {
      type: 'URGENT',
      title: { contains: 'Customer Deletion' },
      message: { contains: containsId },
      OR: ownerNotificationScope(ownerUserId),
    },
    data: {
      type: decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
      isRead: true,
    },
  }).catch(() => {});
}

export async function markBookingDeletionNotificationsResolved(
  ownerUserId: string | null | undefined,
  bookingId: string,
  decision: 'APPROVED' | 'REJECTED'
) {
  await prisma.notification.updateMany({
    where: {
      type: 'URGENT',
      title: { contains: 'Booking Deletion' },
      message: { contains: bookingId },
      OR: ownerNotificationScope(ownerUserId),
    },
    data: {
      type: decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
      isRead: true,
    },
  }).catch(() => {});
}

export async function createCustomerDeletedMarkerNotification(
  customerName: string,
  publicCustomerId: string,
  approvedByName: string
) {
  return prisma.notification.create({
    data: {
      title: `Customer Deleted: ${customerName} (${publicCustomerId})`,
      message: `${approvedByName} approved permanent deletion of Customer ${customerName} (${publicCustomerId}).`,
      type: 'SUCCESS',
      roleName: 'ALL',
      link: '/customers',
    },
  }).catch(() => null);
}

export async function getDeletedCustomerPublicIds() {
  const notifications = await prisma.notification.findMany({
    where: {
      type: 'SUCCESS',
      title: { startsWith: 'Customer Deleted:' },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { title: true },
  }).catch(() => []);

  const deletedIds = new Set<string>();
  for (const notification of notifications) {
    const parsed = parseDeletedCustomerTitle(notification.title);
    if (parsed?.publicCustomerId) {
      deletedIds.add(parsed.publicCustomerId);
    }
  }

  return deletedIds;
}

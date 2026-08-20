import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createActivityLog } from '@/lib/activity-log';
import { getClientIp } from '@/lib/auth/middleware';

// GET /api/notifications - Get unread & recent notifications
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const roleName = session.user.role?.name || '';

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { roleName },
          { roleName: 'ALL' },
          { userId: null, roleName: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST /api/notifications - Create notification
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, message, type, roleName, userId, link } = body;

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type: type || 'INFO',
        roleName: roleName || 'ALL',
        userId: userId || null,
        link: link || null,
      },
    });

    await createActivityLog({
      actorUserId: session.user.id,
      actorName: session.user.name,
      actorEmail: session.user.email,
      actorRole: session.user.role?.name || 'Staff',
      action: 'NOTIFICATION_CREATED',
      category: 'COMMUNICATION',
      entityType: 'notification',
      entityId: notification.id,
      summary: `Notification created for ${userId || roleName || 'ALL'}`,
      changedData: { title, type: type || 'INFO', roleName: roleName || 'ALL', userId: userId || null, link: link || null },
      httpMethod: 'POST',
      route: '/api/notifications',
      statusCode: 201,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent'),
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      const userId = session.user.id;
      const roleName = session.user.role?.name || '';

      await prisma.notification.updateMany({
        where: {
          OR: [
            { userId },
            { roleName },
            { roleName: 'ALL' },
            { userId: null, roleName: null },
          ],
          isRead: false,
        },
        data: { isRead: true },
      });
      await createActivityLog({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorEmail: session.user.email,
        actorRole: session.user.role?.name || 'Staff',
        action: 'NOTIFICATIONS_MARKED_READ',
        category: 'USER_ACTIVITY',
        entityType: 'notification',
        summary: 'All visible notifications marked read',
        changedData: { markAllRead: true },
        httpMethod: 'PATCH',
        route: '/api/notifications',
        statusCode: 200,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
      await createActivityLog({
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorEmail: session.user.email,
        actorRole: session.user.role?.name || 'Staff',
        action: 'NOTIFICATION_MARKED_READ',
        category: 'USER_ACTIVITY',
        entityType: 'notification',
        entityId: notificationId,
        changedData: { isRead: true },
        httpMethod: 'PATCH',
        route: '/api/notifications',
        statusCode: 200,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

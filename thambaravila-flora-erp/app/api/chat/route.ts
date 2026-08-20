import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createActivityLog } from '@/lib/activity-log';
import { getClientIp } from '@/lib/auth/middleware';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel') || 'general';
  const recipientId = searchParams.get('recipientId');

  const userId = session.user.id;
  const userRole = session.user.role?.name || 'Staff';
  const isOwnerOrIT = userRole === 'Owner' || userRole === 'IT/Admin';

  try {
    let whereClause: any = { channel };

    // Strict Role-Based Visibility Rules
    if (channel === 'direct') {
      if (recipientId) {
        // Direct conversation between session user and recipientId
        whereClause = {
          channel: 'direct',
          OR: [
            { senderId: userId, recipientId: recipientId },
            { senderId: recipientId, recipientId: userId },
          ],
        };
      } else {
        // All direct messages involving session user
        whereClause = {
          channel: 'direct',
          OR: [
            { senderId: userId },
            { recipientId: userId },
          ],
        };
      }
    } else if (channel === 'sales' && !isOwnerOrIT && userRole !== 'Sales Manager') {
      return NextResponse.json({ messages: [] });
    } else if (channel === 'accountant' && !isOwnerOrIT && userRole !== 'Accountant') {
      return NextResponse.json({ messages: [] });
    } else if (channel === 'coordinator' && !isOwnerOrIT && userRole !== 'Wedding Coordinator') {
      return NextResponse.json({ messages: [] });
    }

    const messages = await prisma.chatMessage.findMany({
      where: whereClause,
      orderBy: { sentAt: 'asc' },
      take: 100,
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { content, channel, recipientId, recipientName, attachmentUrl } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    const senderName = session.user.name || 'Team Member';
    const channelName = channel || 'general';
    const cleanContent = content.trim();

    const message = await prisma.chatMessage.create({
      data: {
        senderId: session.user.id,
        senderName,
        recipientId: recipientId || null,
        recipientName: recipientName || null,
        channel: channelName,
        content: cleanContent,
        attachmentUrl: attachmentUrl || null,
      },
    });

    // Create targeted notification
    const textSnippet = cleanContent.length > 60 ? cleanContent.substring(0, 60) + '...' : cleanContent;

    if (recipientId) {
      // Direct message notification sent specifically to recipient user
      await prisma.notification.create({
        data: {
          userId: recipientId,
          title: `💬 Private Message from ${senderName}`,
          message: `"${textSnippet}"`,
          type: 'INFO',
          link: '/chat',
        },
      });
    } else {
      // Role channel notification
      let targetRole = 'ALL';
      if (channelName === 'sales') targetRole = 'Sales Manager';
      else if (channelName === 'accountant') targetRole = 'Accountant';
      else if (channelName === 'coordinator') targetRole = 'Wedding Coordinator';

      await prisma.notification.create({
        data: {
          title: `💬 New Message in #${channelName}`,
          message: `${senderName}: "${textSnippet}"`,
          type: 'INFO',
          roleName: targetRole,
          link: '/chat',
        },
      });
    }

    await createActivityLog({
      actorUserId: session.user.id,
      actorName: senderName,
      actorEmail: session.user.email,
      actorRole: session.user.role?.name || 'Staff',
      action: 'CHAT_MESSAGE_SENT',
      category: 'COMMUNICATION',
      entityType: 'chat_message',
      entityId: message.id,
      summary: `Message sent to ${recipientName || `#${channelName}`}`,
      changedData: { channel: channelName, recipientId: recipientId || null, hasAttachment: Boolean(attachmentUrl) },
      httpMethod: 'POST',
      route: '/api/chat',
      statusCode: 201,
      ipAddress: getClientIp(req as any),
      userAgent: req.headers.get('user-agent'),
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error('Error sending chat message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

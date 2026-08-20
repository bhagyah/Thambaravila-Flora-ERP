import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/auth/audit';
import { requiresTwoFactor } from '@/lib/auth/two-factor-policy';

// GET /api/profile - Get current user profile + team list if Owner/IT
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const roleName = user.role.name;
    const isOwnerOrIT = roleName === 'Owner' || roleName === 'IT/Admin';

    let teamMembers: any[] = [];
    if (isOwnerOrIT) {
      teamMembers = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          idNumber: true,
          phone: true,
          avatarUrl: true,
          isActive: true,
          lastLogin: true,
          role: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    return NextResponse.json({
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        idNumber: user.idNumber || 'TF-EMP-00' + user.id.slice(-3).toUpperCase(),
        phone: user.phone || '+94 77 123 4567',
        avatarUrl: user.avatarUrl || '🌱',
        bgImageUrl: user.bgImageUrl || null,
        roleName: user.role.name,
        requires2FA: requiresTwoFactor(user.role.name, user.totpSecretEncrypted || user.totpSecret),
        createdAt: user.createdAt,
      },
      teamMembers,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PATCH /api/profile - Update current user's profile
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, idNumber, phone, avatarUrl, bgImageUrl, targetUserId } = body;

    // Check if updating another user (only allowed for Owner or IT)
    const currentUserRole = session.user.role.name;
    const isOwnerOrIT = currentUserRole === 'Owner' || currentUserRole === 'IT/Admin';

    const userIdToUpdate = (targetUserId && isOwnerOrIT) ? targetUserId : session.user.id;

    const updatedUser = await prisma.user.update({
      where: { id: userIdToUpdate },
      data: {
        ...(name && { name }),
        ...(idNumber !== undefined && { idNumber }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(bgImageUrl !== undefined && { bgImageUrl: bgImageUrl || null }),
      },
      include: { role: true },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'user',
      entityId: userIdToUpdate,
      details: { name, idNumber, phone, avatarUrl, bgImageUrl: bgImageUrl ? 'custom_image_set' : 'cleared' },
    });

    return NextResponse.json({
      profile: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        idNumber: updatedUser.idNumber,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
        bgImageUrl: updatedUser.bgImageUrl,
        roleName: updatedUser.role.name,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

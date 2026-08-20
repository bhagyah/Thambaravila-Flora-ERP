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
    let allRoles: any[] = [];
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

      allRoles = await prisma.role.findMany({
        select: { id: true, name: true, bgImageUrl: true, bgContrast: true },
        orderBy: { name: 'asc' },
      });
    }

    const effectiveBgImageUrl = user.role.bgImageUrl || user.bgImageUrl || null;
    const effectiveBgContrast = user.role.bgContrast ?? user.bgContrast ?? 65;

    return NextResponse.json({
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        idNumber: user.idNumber || 'TF-EMP-00' + user.id.slice(-3).toUpperCase(),
        phone: user.phone || '+94 77 123 4567',
        avatarUrl: user.avatarUrl || '🌱',
        bgImageUrl: effectiveBgImageUrl,
        bgContrast: effectiveBgContrast,
        roleBgImageUrl: user.role.bgImageUrl || null,
        userBgImageUrl: user.bgImageUrl || null,
        roleId: user.role.id,
        roleName: user.role.name,
        requires2FA: requiresTwoFactor(user.role.name, user.totpSecretEncrypted || user.totpSecret),
        createdAt: user.createdAt,
      },
      teamMembers,
      allRoles,
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
    const { name, idNumber, phone, avatarUrl, bgImageUrl, bgContrast, targetUserId, targetRoleId } = body;

    // Check if updating another user or role (only allowed for Owner or IT)
    const currentUserRole = session.user.role.name;
    const isOwnerOrIT = currentUserRole === 'Owner' || currentUserRole === 'IT/Admin';

    const userIdToUpdate = (targetUserId && isOwnerOrIT) ? targetUserId : session.user.id;

    const userBefore = await prisma.user.findUnique({
      where: { id: userIdToUpdate },
      include: { role: true },
    });

    if (!userBefore) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 1. Update user fields
    const updatedUser = await prisma.user.update({
      where: { id: userIdToUpdate },
      data: {
        ...(name && { name }),
        ...(idNumber !== undefined && { idNumber }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(bgImageUrl !== undefined && { bgImageUrl: bgImageUrl || null }),
        ...(bgContrast !== undefined && { bgContrast: Number(bgContrast) }),
      },
      include: { role: true },
    });

    // 2. Update role-wise background & contrast for this role (or targeted role if Owner/IT)
    const roleIdToUpdate = (targetRoleId && isOwnerOrIT) ? targetRoleId : userBefore.roleId;
    if (roleIdToUpdate) {
      const roleUpdateData: any = {};
      if (bgImageUrl !== undefined) roleUpdateData.bgImageUrl = bgImageUrl || null;
      if (bgContrast !== undefined) roleUpdateData.bgContrast = Number(bgContrast);

      if (Object.keys(roleUpdateData).length > 0) {
        await prisma.role.update({
          where: { id: roleIdToUpdate },
          data: roleUpdateData,
        });
      }
    }

    const reloadedRole = await prisma.role.findUnique({
      where: { id: updatedUser.roleId },
    });

    await createAuditLog({
      userId: session.user.id,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'user',
      entityId: userIdToUpdate,
      details: {
        name,
        idNumber,
        phone,
        avatarUrl,
        bgImageUrl: bgImageUrl ? 'custom_image_set' : 'cleared',
        bgContrast,
        roleName: userBefore.role.name,
      },
    });

    const effectiveBg = reloadedRole?.bgImageUrl || updatedUser.bgImageUrl || null;
    const effectiveContrast = reloadedRole?.bgContrast ?? updatedUser.bgContrast ?? 65;

    return NextResponse.json({
      profile: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        idNumber: updatedUser.idNumber,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatarUrl,
        bgImageUrl: effectiveBg,
        bgContrast: effectiveContrast,
        roleBgImageUrl: reloadedRole?.bgImageUrl || null,
        roleId: updatedUser.role.id,
        roleName: updatedUser.role.name,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}

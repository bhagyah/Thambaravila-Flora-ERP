import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/auth/middleware';
import { RoleName } from '@/lib/auth/permissions';
import { prisma } from '@/lib/prisma';
import { createDatabaseSnapshot } from '@/lib/security/database-backup';
import { createActivityLog } from '@/lib/activity-log';

async function listBackups() {
  const backups = await prisma.systemBackup.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      checksum: true,
      sizeBytes: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json({ backups });
}

async function createBackup(_request: NextRequest, context: { session: any; userId: string }) {
  try {
    const snapshot = await createDatabaseSnapshot();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = await prisma.systemBackup.create({
      data: {
        createdById: context.userId,
        fileName: `thambaravila-flora-${stamp}.tfbackup`,
        encryptedData: snapshot.encryptedData,
        checksum: snapshot.checksum,
        sizeBytes: snapshot.sizeBytes,
      },
      select: { id: true, fileName: true, checksum: true, sizeBytes: true, createdAt: true },
    });

    await createActivityLog({
      actorUserId: context.userId,
      actorName: context.session.user.name,
      actorEmail: context.session.user.email,
      actorRole: context.session.user.role.name,
      action: 'DATABASE_BACKUP_CREATED',
      category: 'SECURITY',
      entityType: 'system_backup',
      entityId: backup.id,
      summary: `Encrypted database backup created (${snapshot.tableCount} tables)`,
      route: '/api/admin/backups',
      httpMethod: 'POST',
    });
    return NextResponse.json({ backup }, { status: 201 });
  } catch (error) {
    console.error('Database backup failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Backup failed' }, { status: 500 });
  }
}

export const GET = withRole([RoleName.OWNER, RoleName.IT_ADMIN], listBackups);
export const POST = withRole([RoleName.OWNER, RoleName.IT_ADMIN], createBackup);

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { validateDatabaseSnapshot } from '@/lib/security/database-backup';
import { restoreWithRecoveryBackup } from '@/lib/security/database-restore';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !['Owner', 'IT/Admin'].includes(session.user.role.name)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const body = await request.json();
  if (body.confirmation !== 'RESTORE DATABASE' || !body.password) {
    return NextResponse.json({ error: 'Password and exact confirmation are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
    return NextResponse.json({ error: 'Password re-authentication failed' }, { status: 401 });
  }

  const { id } = await params;
  const backup = await prisma.systemBackup.findUnique({ where: { id } });
  if (!backup) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });

  try {
    await validateDatabaseSnapshot(backup.encryptedData, backup.checksum);
    const result = await restoreWithRecoveryBackup({
      encryptedData: backup.encryptedData,
      checksum: backup.checksum,
      sourceFileName: backup.fileName,
      sourceBackupId: backup.id,
      sourceSizeBytes: backup.sizeBytes,
      actor: {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role.name,
      },
      route: `/api/admin/backups/${id}/restore`,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Database restore failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Restore failed' }, { status: 500 });
  }
}

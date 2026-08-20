import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { parseAndValidateDownloadArtifact } from '@/lib/security/database-backup';
import { restoreWithRecoveryBackup } from '@/lib/security/database-restore';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !['Owner', 'IT/Admin'].includes(session.user.role.name)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const password = String(formData.get('password') || '');
    const confirmation = String(formData.get('confirmation') || '');

    if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.tfbackup')) {
      return NextResponse.json({ error: 'Select a valid .tfbackup file' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Backup file is empty or exceeds the 4 MB local restore limit' }, { status: 400 });
    }
    if (!password || confirmation !== 'RESTORE DATABASE') {
      return NextResponse.json({ error: 'Password and exact confirmation are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      return NextResponse.json({ error: 'Password re-authentication failed' }, { status: 401 });
    }

    const parsed = await parseAndValidateDownloadArtifact(await file.text());
    const result = await restoreWithRecoveryBackup({
      encryptedData: parsed.artifact.encryptedData,
      checksum: parsed.artifact.checksum,
      sourceFileName: file.name,
      sourceSizeBytes: parsed.sizeBytes,
      actor: {
        userId: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role.name,
      },
      route: '/api/admin/backups/local/restore',
      importLocalArtifact: true,
    });

    return NextResponse.json({ success: true, validation: { tableCount: parsed.tableCount, rowCount: parsed.rowCount }, ...result });
  } catch (error) {
    console.error('Local database restore failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Local restore failed' }, { status: 500 });
  }
}

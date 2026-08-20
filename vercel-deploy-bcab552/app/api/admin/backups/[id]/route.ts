import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { createDownloadArtifact } from '@/lib/security/database-backup';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !['Owner', 'IT/Admin'].includes(session.user.role.name)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { id } = await params;
  const backup = await prisma.systemBackup.findUnique({ where: { id } });
  if (!backup) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });

  return new NextResponse(createDownloadArtifact(backup), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${backup.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}

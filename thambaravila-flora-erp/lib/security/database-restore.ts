import { prisma } from '@/lib/prisma';
import { createActivityLog } from '@/lib/activity-log';
import { createDatabaseSnapshot, restoreDatabaseSnapshot } from './database-backup';

type RestoreActor = {
  userId: string;
  name?: string | null;
  email?: string | null;
  role: string;
};

export async function restoreWithRecoveryBackup(input: {
  encryptedData: string;
  checksum: string;
  sourceFileName: string;
  sourceBackupId?: string;
  sourceSizeBytes?: number;
  actor: RestoreActor;
  route: string;
  importLocalArtifact?: boolean;
}) {
  const recovery = await createDatabaseSnapshot();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const recoveryBackup = await prisma.systemBackup.create({
    data: {
      createdById: input.actor.userId,
      fileName: `pre-restore-recovery-${stamp}.tfbackup`,
      encryptedData: recovery.encryptedData,
      checksum: recovery.checksum,
      sizeBytes: recovery.sizeBytes,
    },
  });

  let sourceBackupId = input.sourceBackupId;
  if (input.importLocalArtifact) {
    const imported = await prisma.systemBackup.create({
      data: {
        createdById: input.actor.userId,
        fileName: input.sourceFileName.replace(/[^a-zA-Z0-9._-]/g, '_'),
        encryptedData: input.encryptedData,
        checksum: input.checksum,
        sizeBytes: input.sourceSizeBytes || Buffer.byteLength(input.encryptedData, 'utf8'),
      },
    });
    sourceBackupId = imported.id;
  }

  const restored = await restoreDatabaseSnapshot(input.encryptedData, input.checksum);
  await createActivityLog({
    actorUserId: input.actor.userId,
    actorName: input.actor.name || undefined,
    actorEmail: input.actor.email || null,
    actorRole: input.actor.role,
    action: input.importLocalArtifact ? 'DATABASE_LOCAL_BACKUP_RESTORED' : 'DATABASE_BACKUP_RESTORED',
    category: 'SECURITY',
    entityType: 'system_backup',
    entityId: sourceBackupId || null,
    summary: `Database restored from ${input.sourceFileName} (${restored.tableCount} tables, ${restored.rowCount} rows). Pre-restore recovery backup: ${recoveryBackup.fileName}`,
    route: input.route,
    httpMethod: 'POST',
    metadata: { recoveryBackupId: recoveryBackup.id, recoveryBackupFileName: recoveryBackup.fileName },
  });

  return { restored, recoveryBackup: { id: recoveryBackup.id, fileName: recoveryBackup.fileName }, sourceBackupId };
}

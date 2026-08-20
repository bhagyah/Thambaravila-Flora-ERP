import { prisma } from '../lib/prisma';
import {
  createDatabaseSnapshot,
  createDownloadArtifact,
  parseAndValidateDownloadArtifact,
} from '../lib/security/database-backup';
import { restoreWithRecoveryBackup } from '../lib/security/database-restore';

async function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  const schemaName = new URL(process.env.DATABASE_URL || 'postgresql://invalid').searchParams.get('schema') || '';
  const schema = await prisma.$queryRawUnsafe<Array<{ schema: string }>>(
    'SELECT table_schema AS schema FROM information_schema.tables WHERE table_schema = $1 LIMIT 1',
    schemaName
  );
  await assert(
    schemaName.startsWith('restore_test_') && schema[0]?.schema === schemaName,
    `Refusing restore test outside isolated restore_test_ schema (found: ${schema[0]?.schema || 'none'}, URL schema: ${schemaName || 'none'})`
  );

  const role = await prisma.role.create({
    data: { name: 'Restore Test Owner', description: 'Original snapshot value', isSystem: true },
  });
  const user = await prisma.user.create({
    data: {
      email: 'restore-test@example.invalid',
      name: 'Restore Test User',
      passwordHash: 'not-used-in-isolated-regression',
      roleId: role.id,
    },
  });

  const snapshot = await createDatabaseSnapshot();
  const stored = await prisma.systemBackup.create({
    data: {
      createdById: user.id,
      fileName: 'restore-test-stored.tfbackup',
      encryptedData: snapshot.encryptedData,
      checksum: snapshot.checksum,
      sizeBytes: snapshot.sizeBytes,
    },
  });

  const artifact = createDownloadArtifact({ ...stored, createdAt: stored.createdAt });
  const parsed = await parseAndValidateDownloadArtifact(artifact);
  await assert(parsed.tableCount === snapshot.tableCount, 'Local artifact table validation mismatch');

  await prisma.role.update({ where: { id: role.id }, data: { description: 'Changed after backup' } });
  const storedResult = await restoreWithRecoveryBackup({
    encryptedData: snapshot.encryptedData,
    checksum: snapshot.checksum,
    sourceFileName: stored.fileName,
    sourceBackupId: stored.id,
    sourceSizeBytes: stored.sizeBytes,
    actor: { userId: user.id, name: user.name, email: user.email, role: role.name },
    route: '/isolated-test/stored',
  });
  const restoredStoredRole = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
  await assert(restoredStoredRole.description === 'Original snapshot value', 'Stored restore did not restore original data');
  await assert(Boolean(await prisma.systemBackup.findUnique({ where: { id: storedResult.recoveryBackup.id } })), 'Stored restore lost recovery backup');

  await prisma.role.update({ where: { id: role.id }, data: { description: 'Changed before local restore' } });
  const localResult = await restoreWithRecoveryBackup({
    encryptedData: parsed.artifact.encryptedData,
    checksum: parsed.artifact.checksum,
    sourceFileName: 'uploaded-local.tfbackup',
    sourceSizeBytes: parsed.sizeBytes,
    actor: { userId: user.id, name: user.name, email: user.email, role: role.name },
    route: '/isolated-test/local',
    importLocalArtifact: true,
  });
  const restoredLocalRole = await prisma.role.findUniqueOrThrow({ where: { id: role.id } });
  await assert(restoredLocalRole.description === 'Original snapshot value', 'Local restore did not restore original data');
  await assert(Boolean(await prisma.systemBackup.findUnique({ where: { id: localResult.sourceBackupId } })), 'Local restore did not retain imported backup');
  await assert(Boolean(await prisma.systemBackup.findUnique({ where: { id: localResult.recoveryBackup.id } })), 'Local restore lost recovery backup');

  console.log(JSON.stringify({
    schema: schemaName,
    storedRestoreRows: storedResult.restored.rowCount,
    localRestoreRows: localResult.restored.rowCount,
    backupHistoryCount: await prisma.systemBackup.count(),
    passed: true,
  }));
}

main().finally(() => prisma.$disconnect());

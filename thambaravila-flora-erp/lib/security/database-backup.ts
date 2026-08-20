import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decryptBackup, encryptBackup, sha256 } from './encryption';

const FORMAT_VERSION = 1;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const BACKUP_FORMAT = 'thambaravila-flora-encrypted-backup';

type TableRow = Record<string, unknown>;
type BackupPayload = {
  version: number;
  createdAt: string;
  tables: Array<{ name: string; rows: TableRow[] }>;
};

export type BackupArtifact = {
  format: typeof BACKUP_FORMAT;
  version: number;
  fileName: string;
  createdAt: string;
  checksum: string;
  encryptedData: string;
};

type TableNameRow = { table_name: string };
type ForeignKeyRow = { child_table: string; parent_table: string };

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function configuredSchema(): string {
  try {
    const schema = new URL(process.env.DATABASE_URL || '').searchParams.get('schema') || 'public';
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(schema)) throw new Error('Invalid database schema name');
    return schema;
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid database schema name') throw error;
    return 'public';
  }
}

function quoteTable(tableName: string): string {
  return `${quoteIdentifier(configuredSchema())}.${quoteIdentifier(tableName)}`;
}

function jsonStringify(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
}

async function getTableNames(): Promise<string[]> {
  const schema = configuredSchema();
  const rows = await prisma.$queryRaw<TableNameRow[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schema} AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  return rows.map((row) => row.table_name);
}

async function orderTablesByDependencies(tableNames: string[]): Promise<string[]> {
  const tableSet = new Set(tableNames);
  const schema = configuredSchema();
  const foreignKeys = await prisma.$queryRaw<ForeignKeyRow[]>`
    SELECT
      child.relname AS child_table,
      parent.relname AS parent_table
    FROM pg_constraint constraint_row
    JOIN pg_class child ON child.oid = constraint_row.conrelid
    JOIN pg_class parent ON parent.oid = constraint_row.confrelid
    JOIN pg_namespace namespace_row ON namespace_row.oid = child.relnamespace
    WHERE constraint_row.contype = 'f' AND namespace_row.nspname = ${schema}
  `;

  const dependencies = new Map(tableNames.map((name) => [name, new Set<string>()]));
  for (const key of foreignKeys) {
    if (tableSet.has(key.child_table) && tableSet.has(key.parent_table) && key.child_table !== key.parent_table) {
      dependencies.get(key.child_table)?.add(key.parent_table);
    }
  }

  const ordered: string[] = [];
  const remaining = new Set(tableNames);
  while (remaining.size) {
    const ready = [...remaining].filter((name) =>
      [...(dependencies.get(name) || [])].every((dependency) => !remaining.has(dependency))
    );
    if (!ready.length) {
      ordered.push(...[...remaining].sort());
      break;
    }
    ready.sort().forEach((name) => {
      ordered.push(name);
      remaining.delete(name);
    });
  }
  return ordered;
}

export async function createDatabaseSnapshot(): Promise<{
  encryptedData: string;
  checksum: string;
  sizeBytes: number;
  tableCount: number;
}> {
  const tableNames = await orderTablesByDependencies(
    (await getTableNames()).filter((name) => name !== 'system_backups')
  );
  const tables: BackupPayload['tables'] = [];

  for (const tableName of tableNames) {
    const rows = await prisma.$queryRawUnsafe<TableRow[]>(
      `SELECT * FROM ${quoteTable(tableName)}`
    );
    tables.push({ name: tableName, rows });
  }

  const serialized = jsonStringify({
    version: FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    tables,
  } satisfies BackupPayload);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');
  if (sizeBytes > MAX_BACKUP_BYTES) {
    throw new Error('Database backup exceeds the 25 MB application backup limit');
  }

  return {
    encryptedData: encryptBackup(serialized),
    checksum: sha256(serialized),
    sizeBytes,
    tableCount: tables.length,
  };
}

export function createDownloadArtifact(backup: {
  fileName: string;
  checksum: string;
  encryptedData: string;
  createdAt: Date;
}): string {
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: FORMAT_VERSION,
    fileName: backup.fileName,
    createdAt: backup.createdAt.toISOString(),
    checksum: backup.checksum,
    encryptedData: backup.encryptedData,
  });
}

function readBackupPayload(encryptedData: string, expectedChecksum: string): {
  serialized: string;
  payload: BackupPayload;
} {
  const serialized = decryptBackup(encryptedData);
  if (sha256(serialized) !== expectedChecksum) throw new Error('Backup checksum validation failed');
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BACKUP_BYTES) {
    throw new Error('Database backup exceeds the 25 MB application backup limit');
  }

  const payload = JSON.parse(serialized) as BackupPayload;
  if (payload.version !== FORMAT_VERSION || !Array.isArray(payload.tables)) {
    throw new Error('Unsupported backup format');
  }
  if (payload.tables.some((table) => !table || typeof table.name !== 'string' || !Array.isArray(table.rows))) {
    throw new Error('Backup table data is invalid');
  }
  if (new Set(payload.tables.map((table) => table.name)).size !== payload.tables.length) {
    throw new Error('Backup contains duplicate tables');
  }
  return { serialized, payload };
}

async function validateBackupTables(payload: BackupPayload) {
  const currentTables = new Set(await getTableNames());
  const backupTables = payload.tables.map((table) => table.name);
  if (backupTables.some((name) => !currentTables.has(name) || name === 'system_backups')) {
    throw new Error('Backup contains an unknown or protected table');
  }
}

export async function validateDatabaseSnapshot(encryptedData: string, expectedChecksum: string): Promise<{
  tableCount: number;
  rowCount: number;
  sizeBytes: number;
}> {
  const { serialized, payload } = readBackupPayload(encryptedData, expectedChecksum);
  await validateBackupTables(payload);
  return {
    tableCount: payload.tables.length,
    rowCount: payload.tables.reduce((sum, table) => sum + table.rows.length, 0),
    sizeBytes: Buffer.byteLength(serialized, 'utf8'),
  };
}

export async function parseAndValidateDownloadArtifact(content: string): Promise<{
  artifact: BackupArtifact;
  tableCount: number;
  rowCount: number;
  sizeBytes: number;
}> {
  if (Buffer.byteLength(content, 'utf8') > MAX_BACKUP_BYTES + 1024 * 1024) {
    throw new Error('Backup file is too large');
  }

  let artifact: BackupArtifact;
  try {
    artifact = JSON.parse(content) as BackupArtifact;
  } catch {
    throw new Error('Backup file is not valid JSON');
  }

  if (
    artifact?.format !== BACKUP_FORMAT ||
    artifact.version !== FORMAT_VERSION ||
    typeof artifact.fileName !== 'string' ||
    !artifact.fileName.toLowerCase().endsWith('.tfbackup') ||
    !/^[a-f0-9]{64}$/i.test(artifact.checksum || '') ||
    typeof artifact.encryptedData !== 'string' ||
    !artifact.encryptedData.startsWith('v1.') ||
    Number.isNaN(new Date(artifact.createdAt).getTime())
  ) {
    throw new Error('Unsupported or invalid backup file');
  }

  const validation = await validateDatabaseSnapshot(artifact.encryptedData, artifact.checksum);
  return { artifact, ...validation };
}

export async function restoreDatabaseSnapshot(encryptedData: string, expectedChecksum: string): Promise<{
  tableCount: number;
  rowCount: number;
}> {
  const { payload } = readBackupPayload(encryptedData, expectedChecksum);
  await validateBackupTables(payload);

  const currentTables = new Set(await getTableNames());
  const retainedBackups = await prisma.systemBackup.findMany();

  const truncateTables = [...currentTables].map(quoteTable).join(', ');
  let rowCount = 0;
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`TRUNCATE TABLE ${truncateTables} CASCADE`);
    for (const table of payload.tables) {
      if (!Array.isArray(table.rows) || table.rows.length === 0) continue;
      await transaction.$executeRawUnsafe(
        `INSERT INTO ${quoteTable(table.name)} SELECT * FROM json_populate_recordset(NULL::${quoteTable(table.name)}, $1::json)`,
        jsonStringify(table.rows)
      );
      rowCount += table.rows.length;
    }

    if (retainedBackups.length) {
      const restoredUserIds = new Set((await transaction.user.findMany({ select: { id: true } })).map((user) => user.id));
      await transaction.systemBackup.createMany({
        data: retainedBackups.map((backup) => ({
          id: backup.id,
          createdById: backup.createdById && restoredUserIds.has(backup.createdById) ? backup.createdById : null,
          fileName: backup.fileName,
          encryptedData: backup.encryptedData,
          checksum: backup.checksum,
          sizeBytes: backup.sizeBytes,
          createdAt: backup.createdAt,
        })),
        skipDuplicates: true,
      });
    }
  }, { maxWait: 10000, timeout: 120000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { tableCount: payload.tables.length, rowCount };
}

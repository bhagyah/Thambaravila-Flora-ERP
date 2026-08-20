import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const VERSION = 'v1';

function resolveKey(envName: 'APP_ENCRYPTION_KEY' | 'BACKUP_ENCRYPTION_KEY'): Buffer {
  const raw = process.env[envName] || (envName === 'BACKUP_ENCRYPTION_KEY' ? process.env.APP_ENCRYPTION_KEY : undefined);

  if (raw) {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length !== 32) {
      throw new Error(`${envName} must be a base64-encoded 32-byte key`);
    }
    return decoded;
  }

  if (process.env.NODE_ENV !== 'production' && process.env.NEXTAUTH_SECRET) {
    return createHash('sha256').update(process.env.NEXTAUTH_SECRET).digest();
  }

  throw new Error(`${envName} is required`);
}

function encrypt(value: string, keyName: 'APP_ENCRYPTION_KEY' | 'BACKUP_ENCRYPTION_KEY'): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', resolveKey(keyName), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decrypt(value: string, keyName: 'APP_ENCRYPTION_KEY' | 'BACKUP_ENCRYPTION_KEY'): string {
  const [version, ivPart, tagPart, ciphertextPart] = value.split('.');
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error('Unsupported encrypted payload');
  }

  const decipher = createDecipheriv('aes-256-gcm', resolveKey(keyName), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function encryptText(value: string): string {
  return encrypt(value, 'APP_ENCRYPTION_KEY');
}

export function decryptText(value: string): string {
  return decrypt(value, 'APP_ENCRYPTION_KEY');
}

export function encryptBackup(value: string): string {
  return encrypt(value, 'BACKUP_ENCRYPTION_KEY');
}

export function decryptBackup(value: string): string {
  return decrypt(value, 'BACKUP_ENCRYPTION_KEY');
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

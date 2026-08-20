import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')];
    })
);

for (const name of ['APP_ENCRYPTION_KEY', 'BACKUP_ENCRYPTION_KEY']) {
  const value = env[name];
  if (!value || Buffer.from(value, 'base64').length !== 32) {
    throw new Error(`${name} is not a valid 32-byte base64 key`);
  }
  const result = spawnSync(
    process.platform === 'win32' ? 'cmd.exe' : 'npx',
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npx vercel env add ' + name + ' production --force --yes --sensitive']
      : ['vercel', 'env', 'add', name, 'production', '--force', '--yes', '--sensitive'],
    { input: value, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.error?.message || `Failed to set ${name}\n`);
    process.exit(result.status || 1);
  }
  process.stdout.write(`${name} updated\n`);
}

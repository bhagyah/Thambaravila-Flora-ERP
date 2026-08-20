import Database from 'better-sqlite3';
import path from 'path';
import { verifyPassword } from '../lib/auth/password';

const db = new Database(path.join(process.cwd(), 'prisma', 'dev.db'));

async function debug() {
  const emails = [
    'owner@thambaravila-flora.com',
    'sales@thambaravila-flora.com',
    'accountant@thambaravila-flora.com',
    'social@thambaravila-flora.com',
    'coordinator@thambaravila-flora.com',
    'it@thambaravila-flora.com'
  ];

  for (const email of emails) {
    const stmt = db.prepare(`
      SELECT u.id, u.email, u.name, u.password_hash, u.totp_secret, u.is_active, 
             u.failed_attempts, u.locked_until, u.role_id,
             r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `);
    const user = stmt.get(email) as any;
    if (!user) {
      console.log(`❌ User NOT FOUND in db: ${email}`);
      continue;
    }

    const testPasses = ['Sales@123', 'Admin@123', 'Accountant@123', 'Social@123', 'Coordinator@123', 'ITAdmin@123'];
    let matchedPass = null;
    for (const p of testPasses) {
      if (await verifyPassword(user.password_hash, p)) {
        matchedPass = p;
        break;
      }
    }

    console.log(`User: ${email} | Role: ${user.role_name} | PasswordHash: ${user.password_hash.substring(0, 30)}... | MatchedPass: ${matchedPass}`);
  }
}

debug().catch(console.error);

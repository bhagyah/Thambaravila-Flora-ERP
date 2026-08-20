import http from 'http';

async function testLogin(email: string, pass: string) {
  // First fetch CSRF token
  const csrfRes = await fetch('http://localhost:3000/api/auth/csrf');
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const cookies = csrfRes.headers.get('set-cookie') || '';

  // Now post credentials
  const params = new URLSearchParams({
    email,
    password: pass,
    csrfToken,
    json: 'true',
  });

  const res = await fetch('http://localhost:3000/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookies,
    },
    body: params.toString(),
  });

  const body = await res.text();
  console.log(`Email: ${email} | Status: ${res.status} | Body: ${body.substring(0, 100)}`);
}

async function main() {
  console.log('🧪 Testing NextAuth Login API endpoint for all 6 roles...\n');
  const accounts = [
    { email: 'owner@thambaravila-flora.com', pass: 'Admin@123' },
    { email: 'sales@thambaravila-flora.com', pass: 'Sales@123' },
    { email: 'accountant@thambaravila-flora.com', pass: 'Accountant@123' },
    { email: 'social@thambaravila-flora.com', pass: 'Social@123' },
    { email: 'coordinator@thambaravila-flora.com', pass: 'Coordinator@123' },
    { email: 'it@thambaravila-flora.com', pass: 'ITAdmin@123' },
  ];

  for (const acc of accounts) {
    await testLogin(acc.email, acc.pass);
  }
}

main().catch(console.error);

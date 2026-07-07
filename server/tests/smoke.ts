import 'dotenv/config';

async function run() {
  const loginUrl = 'http://localhost:3001/api/auth/login';
  const leaveTypesUrl = 'http://localhost:3001/api/leave-types';
  const leaveRequestsUrl = 'http://localhost:3001/api/leave-requests';

  console.log('--- API Smoke Test ---');

  // 1. Login
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }

  const loginData = (await loginRes.json()) as { token: string };
  console.log('Login successful! Token starts with:', loginData.token.substring(0, 15));

  // 2. Get Leave Types
  const ltRes = await fetch(leaveTypesUrl, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });

  if (!ltRes.ok) {
    console.error('Get Leave Types failed:', await ltRes.text());
    process.exit(1);
  }

  const leaveTypes = (await ltRes.json()) as Array<{ id: string; name: string }>;
  console.log('Leave Types:', leaveTypes);

  // 3. Get Leave Requests
  const lrRes = await fetch(leaveRequestsUrl, {
    headers: { Authorization: `Bearer ${loginData.token}` },
  });

  if (!lrRes.ok) {
    console.error('Get Leave Requests failed:', await lrRes.text());
    process.exit(1);
  }

  const leaveRequests = (await lrRes.json()) as any[];
  console.log('Leave Requests count:', leaveRequests.length);

  // 4. Login as non-Admin (Employee) and attempt to POST /api/users
  console.log('\nTesting RBAC guard (Non-Admin POST /api/users)...');
  const empLoginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'emp1@example.com', password: 'password123' }),
  });

  if (!empLoginRes.ok) {
    console.error('Employee Login failed:', await empLoginRes.text());
    process.exit(1);
  }

  const empLoginData = (await empLoginRes.json()) as { token: string };
  
  const postUserRes = await fetch('http://localhost:3001/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${empLoginData.token}`,
    },
    body: JSON.stringify({
      name: 'Hacker',
      email: 'hacker@example.com',
      password: 'password123',
      role: 'Employee',
    }),
  });

  console.log('POST /api/users status code for Employee:', postUserRes.status);
  if (postUserRes.status !== 403) {
    console.error(`FAIL: Expected 403, got ${postUserRes.status}`);
    process.exit(1);
  }
  console.log('✅ PASS: Employee got 403 Forbidden when trying to create a user.');

  console.log('\nSmoke test passed successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Smoke test error:', err);
  process.exit(1);
});

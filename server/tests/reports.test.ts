import 'dotenv/config';

async function run() {
  const loginUrl = 'http://localhost:3001/api/auth/login';
  const summaryUrl = 'http://localhost:3001/api/reports/leave-summary';
  const balanceUrl = 'http://localhost:3001/api/reports/leave-balance';
  const calendarUrl = 'http://localhost:3001/api/reports/leave-calendar';
  const exportUrl = 'http://localhost:3001/api/reports/export';

  console.log('--- Reports API Verification ---');

  // 1. Login as Admin
  const adminLoginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
  });
  if (!adminLoginRes.ok) {
    console.error('Admin Login failed:', await adminLoginRes.text());
    process.exit(1);
  }
  const adminToken = ((await adminLoginRes.json()) as { token: string }).token;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // 2. Login as Manager (manager1@example.com)
  const managerLoginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'manager1@example.com', password: 'password123' }),
  });
  if (!managerLoginRes.ok) {
    console.error('Manager Login failed:', await managerLoginRes.text());
    process.exit(1);
  }
  const managerToken = ((await managerLoginRes.json()) as { token: string }).token;
  const managerHeaders = { Authorization: `Bearer ${managerToken}` };

  // 3. Login as Employee (emp1@example.com)
  const employeeLoginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'emp1@example.com', password: 'password123' }),
  });
  if (!employeeLoginRes.ok) {
    console.error('Employee Login failed:', await employeeLoginRes.text());
    process.exit(1);
  }
  const employeeToken = ((await employeeLoginRes.json()) as { token: string }).token;
  const employeeHeaders = { Authorization: `Bearer ${employeeToken}` };

  // --- Test Admin Authorization for Summary, Balance, Export ---
  console.log('\n[Admin Tests]');
  
  const summaryRes = await fetch(summaryUrl, { headers: adminHeaders });
  console.log('GET /leave-summary (Admin):', summaryRes.status);
  if (summaryRes.status !== 200) {
    console.error('Failed to get leave summary');
    process.exit(1);
  }
  console.log('Summary data:', await summaryRes.json());

  const balanceRes = await fetch(balanceUrl, { headers: adminHeaders });
  console.log('GET /leave-balance (Admin):', balanceRes.status);
  if (balanceRes.status !== 200) {
    console.error('Failed to get leave balance');
    process.exit(1);
  }
  console.log('Balance count:', ((await balanceRes.json()) as any[]).length);

  const calendarRes = await fetch(calendarUrl, { headers: adminHeaders });
  console.log('GET /leave-calendar (Admin):', calendarRes.status);
  if (calendarRes.status !== 200) {
    console.error('Failed to get leave calendar');
    process.exit(1);
  }
  console.log('Calendar count:', ((await calendarRes.json()) as any[]).length);

  const exportRes = await fetch(`${exportUrl}?type=summary&format=csv`, { headers: adminHeaders });
  console.log('GET /export?type=summary&format=csv (Admin):', exportRes.status);
  if (exportRes.status !== 200) {
    console.error('Failed to export summary CSV');
    process.exit(1);
  }
  console.log('Export CSV header:\n', (await exportRes.text()).split('\n')[0]);

  // --- Test Manager Access ---
  console.log('\n[Manager Tests]');

  const managerSummaryRes = await fetch(summaryUrl, { headers: managerHeaders });
  console.log('GET /leave-summary (Manager):', managerSummaryRes.status);
  if (managerSummaryRes.status !== 403) {
    console.error('Expected 403 for Manager on /leave-summary');
    process.exit(1);
  }

  const managerCalendarRes = await fetch(calendarUrl, { headers: managerHeaders });
  console.log('GET /leave-calendar (Manager):', managerCalendarRes.status);
  if (managerCalendarRes.status !== 200) {
    console.error('Expected 200 for Manager on /leave-calendar');
    process.exit(1);
  }

  // --- Test Employee Access ---
  console.log('\n[Employee Tests]');

  const employeeSummaryRes = await fetch(summaryUrl, { headers: employeeHeaders });
  console.log('GET /leave-summary (Employee):', employeeSummaryRes.status);
  if (employeeSummaryRes.status !== 403) {
    console.error('Expected 403 for Employee on /leave-summary');
    process.exit(1);
  }

  const employeeCalendarRes = await fetch(calendarUrl, { headers: employeeHeaders });
  console.log('GET /leave-calendar (Employee):', employeeCalendarRes.status);
  if (employeeCalendarRes.status !== 403) {
    console.error('Expected 403 for Employee on /leave-calendar');
    process.exit(1);
  }

  console.log('\n🎉 Reports API verification passed successfully!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});

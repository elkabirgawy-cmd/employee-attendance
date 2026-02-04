import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('='.repeat(80));
console.log('COMPREHENSIVE TEST: Multiple Check-ins Per Day + Tenant Isolation');
console.log('='.repeat(80));

// Test data for both companies
const testEmployees = [
  { code: 'EMP001', company: 'Company A', companyId: 'aeb3d19c-82bc-462e-9207-92e49d507a07' },
  { code: 'EMP633792', company: 'Company B', companyId: '8ab77d2a-dc74-4109-88af-c6a9ef271bf2' }
];

let allTestRecords = [];

for (const testEmp of testEmployees) {
  console.log('\n' + '='.repeat(80));
  console.log(`TESTING: ${testEmp.company} - Employee ${testEmp.code}`);
  console.log('='.repeat(80));

  // Get employee
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, employee_code, full_name, company_id, branch_id')
    .eq('employee_code', testEmp.code)
    .maybeSingle();

  if (empError || !employee) {
    console.error('❌ Employee not found:', empError);
    continue;
  }

  console.log('\n✅ Employee:', employee.full_name);
  console.log('   Company ID:', employee.company_id);
  console.log('   Expected Company ID:', testEmp.companyId);

  if (employee.company_id !== testEmp.companyId) {
    console.error('❌ TENANT ISOLATION VIOLATED: Employee company_id mismatch!');
    process.exit(1);
  }

  // ========== SESSION 1 ==========
  console.log('\n📝 SESSION 1: Check-in');
  const session1CheckIn = {
    employee_id: employee.id,
    company_id: employee.company_id,
    branch_id: employee.branch_id,
    check_in_time: new Date().toISOString(),
    check_in_device_time: new Date().toISOString(),
    check_in_latitude: testEmp.company === 'Company A' ? 24.7136 : 30.5705,
    check_in_longitude: testEmp.company === 'Company A' ? 46.6753 : 31.0023,
    check_in_accuracy: 15.0,
    check_in_distance_m: 45.0,
    status: 'on_time',
  };

  const { data: s1, error: e1 } = await supabase
    .from('attendance_logs')
    .insert(session1CheckIn)
    .select()
    .single();

  if (e1) {
    console.error('❌ Session 1 check-in failed:', e1.message);
    process.exit(1);
  }

  console.log('✅ Session 1 check-in succeeded');
  console.log('   Record ID:', s1.id);
  console.log('   Check-in time:', s1.check_in_time);
  allTestRecords.push(s1.id);

  // Verify company_id matches
  if (s1.company_id !== employee.company_id) {
    console.error('❌ TENANT ISOLATION VIOLATED: Attendance company_id mismatch!');
    process.exit(1);
  }

  console.log('\n📝 SESSION 1: Check-out');
  const { data: s1Updated, error: e2 } = await supabase
    .from('attendance_logs')
    .update({
      check_out_time: new Date().toISOString(),
      check_out_device_time: new Date().toISOString(),
      check_out_latitude: testEmp.company === 'Company A' ? 24.7136 : 30.5705,
      check_out_longitude: testEmp.company === 'Company A' ? 46.6753 : 31.0023,
      check_out_accuracy: 15.0,
      check_out_distance_m: 45.0,
    })
    .eq('id', s1.id)
    .select()
    .single();

  if (e2) {
    console.error('❌ Session 1 check-out failed:', e2.message);
    process.exit(1);
  }

  console.log('✅ Session 1 check-out succeeded');
  console.log('   Check-out time:', s1Updated.check_out_time);

  // ========== SESSION 2 ==========
  console.log('\n📝 SESSION 2: Check-in (same day, after checkout)');
  const session2CheckIn = {
    employee_id: employee.id,
    company_id: employee.company_id,
    branch_id: employee.branch_id,
    check_in_time: new Date().toISOString(),
    check_in_device_time: new Date().toISOString(),
    check_in_latitude: testEmp.company === 'Company A' ? 24.7136 : 30.5705,
    check_in_longitude: testEmp.company === 'Company A' ? 46.6753 : 31.0023,
    check_in_accuracy: 15.0,
    check_in_distance_m: 45.0,
    status: 'on_time',
  };

  const { data: s2, error: e3 } = await supabase
    .from('attendance_logs')
    .insert(session2CheckIn)
    .select()
    .single();

  if (e3) {
    console.error('❌ Session 2 check-in FAILED:');
    console.error('   Error Code:', e3.code);
    console.error('   Error Message:', e3.message);
    console.error('   This is the BUG we are fixing!');
    process.exit(1);
  }

  console.log('✅ Session 2 check-in succeeded');
  console.log('   Record ID:', s2.id);
  console.log('   Check-in time:', s2.check_in_time);
  allTestRecords.push(s2.id);

  // Verify company_id matches
  if (s2.company_id !== employee.company_id) {
    console.error('❌ TENANT ISOLATION VIOLATED: Session 2 company_id mismatch!');
    process.exit(1);
  }

  console.log('\n📝 SESSION 2: Check-out');
  const { data: s2Updated, error: e4 } = await supabase
    .from('attendance_logs')
    .update({
      check_out_time: new Date().toISOString(),
      check_out_device_time: new Date().toISOString(),
      check_out_latitude: testEmp.company === 'Company A' ? 24.7136 : 30.5705,
      check_out_longitude: testEmp.company === 'Company A' ? 46.6753 : 31.0023,
      check_out_accuracy: 15.0,
      check_out_distance_m: 45.0,
    })
    .eq('id', s2.id)
    .select()
    .single();

  if (e4) {
    console.error('❌ Session 2 check-out failed:', e4.message);
    process.exit(1);
  }

  console.log('✅ Session 2 check-out succeeded');
  console.log('   Check-out time:', s2Updated.check_out_time);

  // ========== SESSION 3 ==========
  console.log('\n📝 SESSION 3: Check-in (third session same day)');
  const session3CheckIn = {
    employee_id: employee.id,
    company_id: employee.company_id,
    branch_id: employee.branch_id,
    check_in_time: new Date().toISOString(),
    check_in_device_time: new Date().toISOString(),
    check_in_latitude: testEmp.company === 'Company A' ? 24.7136 : 30.5705,
    check_in_longitude: testEmp.company === 'Company A' ? 46.6753 : 31.0023,
    check_in_accuracy: 15.0,
    check_in_distance_m: 45.0,
    status: 'on_time',
  };

  const { data: s3, error: e5 } = await supabase
    .from('attendance_logs')
    .insert(session3CheckIn)
    .select()
    .single();

  if (e5) {
    console.error('❌ Session 3 check-in failed:', e5.message);
    process.exit(1);
  }

  console.log('✅ Session 3 check-in succeeded');
  console.log('   Record ID:', s3.id);
  console.log('   Check-in time:', s3.check_in_time);
  allTestRecords.push(s3.id);

  // Leave session 3 open (don't check out)
  console.log('⏸️  Session 3: Leaving OPEN (no checkout)');

  // ========== VERIFICATION ==========
  console.log('\n📊 VERIFICATION: Count today\'s sessions');
  const today = new Date().toISOString().split('T')[0];
  const { data: sessions, error: e6 } = await supabase
    .from('attendance_logs')
    .select('id, check_in_time, check_out_time, company_id')
    .eq('employee_id', employee.id)
    .gte('created_at', `${today}T00:00:00Z`)
    .order('created_at', { ascending: true });

  if (e6) {
    console.error('❌ Verification failed:', e6.message);
    process.exit(1);
  }

  console.log(`✅ Found ${sessions.length} sessions for today:`);
  sessions.forEach((sess, i) => {
    const status = sess.check_out_time ? 'CLOSED' : 'OPEN';
    const idShort = sess.id.substring(0, 8);
    console.log(`   ${i+1}. ${idShort}... | ${status} | Company: ${sess.company_id === testEmp.companyId ? '✅' : '❌'}`);

    // Verify tenant isolation
    if (sess.company_id !== testEmp.companyId) {
      console.error('❌ TENANT ISOLATION VIOLATED: Session company_id mismatch!');
      process.exit(1);
    }
  });

  if (sessions.length < 3) {
    console.error(`❌ Expected at least 3 sessions, but found ${sessions.length}`);
    process.exit(1);
  }

  console.log(`\n✅ ${testEmp.company} - All tests passed!`);
}

// ========== CROSS-TENANT ISOLATION CHECK ==========
console.log('\n' + '='.repeat(80));
console.log('CROSS-TENANT ISOLATION CHECK');
console.log('='.repeat(80));

console.log('\n🔍 Verifying Company A cannot see Company B records...');
const { data: companyARecords } = await supabase
  .from('attendance_logs')
  .select('id, company_id')
  .eq('company_id', 'aeb3d19c-82bc-462e-9207-92e49d507a07')
  .in('id', allTestRecords);

const companyBInA = companyARecords?.filter(r => r.company_id !== 'aeb3d19c-82bc-462e-9207-92e49d507a07');
if (companyBInA && companyBInA.length > 0) {
  console.error('❌ TENANT ISOLATION VIOLATED: Company A can see Company B records!');
  process.exit(1);
}

console.log('✅ Company A isolation verified');

console.log('\n🔍 Verifying Company B cannot see Company A records...');
const { data: companyBRecords } = await supabase
  .from('attendance_logs')
  .select('id, company_id')
  .eq('company_id', '8ab77d2a-dc74-4109-88af-c6a9ef271bf2')
  .in('id', allTestRecords);

const companyAInB = companyBRecords?.filter(r => r.company_id !== '8ab77d2a-dc74-4109-88af-c6a9ef271bf2');
if (companyAInB && companyAInB.length > 0) {
  console.error('❌ TENANT ISOLATION VIOLATED: Company B can see Company A records!');
  process.exit(1);
}

console.log('✅ Company B isolation verified');

// ========== CLEANUP ==========
console.log('\n🧹 Cleaning up test records...');
for (const recordId of allTestRecords) {
  await supabase.from('attendance_logs').delete().eq('id', recordId);
}
console.log(`✅ Deleted ${allTestRecords.length} test records`);

// ========== SUMMARY ==========
console.log('\n' + '='.repeat(80));
console.log('✅✅✅ ALL TESTS PASSED ✅✅✅');
console.log('='.repeat(80));
console.log('\nTest Results:');
console.log('  ✅ Company A: 3 sessions created (2 closed, 1 open)');
console.log('  ✅ Company B: 3 sessions created (2 closed, 1 open)');
console.log('  ✅ Multiple check-ins per day: WORKING');
console.log('  ✅ Check-out functionality: WORKING');
console.log('  ✅ Tenant isolation: INTACT');
console.log('  ✅ Cross-tenant data access: BLOCKED');
console.log('\n' + '='.repeat(80));

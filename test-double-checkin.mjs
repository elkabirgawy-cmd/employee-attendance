import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('='.repeat(70));
console.log('TESTING: Double Check-in on Same Day (Company A - EMP001)');
console.log('='.repeat(70));

const { data: employee, error: empError } = await supabase
  .from('employees')
  .select('id, employee_code, full_name, company_id, branch_id')
  .eq('employee_code', 'EMP001')
  .maybeSingle();

if (empError || !employee) {
  console.error('Employee not found:', empError);
  process.exit(1);
}

console.log('\nEmployee found:', employee.full_name);
console.log('Employee ID:', employee.id);
console.log('Company ID:', employee.company_id);

console.log('\nSTEP 1: First Check-in');
const checkinData1 = {
  employee_id: employee.id,
  company_id: employee.company_id,
  branch_id: employee.branch_id,
  check_in_time: new Date().toISOString(),
  check_in_device_time: new Date().toISOString(),
  check_in_latitude: 24.7136,
  check_in_longitude: 46.6753,
  check_in_accuracy: 15.0,
  check_in_distance_m: 45.0,
  status: 'on_time',
};

const { data: session1, error: err1 } = await supabase
  .from('attendance_logs')
  .insert(checkinData1)
  .select()
  .single();

if (err1) {
  console.error('First check-in failed:', err1);
  process.exit(1);
}

console.log('First check-in succeeded');
console.log('Session 1 ID:', session1.id);

console.log('\nSTEP 2: Check-out');
const { data: session1Updated, error: err2 } = await supabase
  .from('attendance_logs')
  .update({
    check_out_time: new Date().toISOString(),
    check_out_device_time: new Date().toISOString(),
    check_out_latitude: 24.7136,
    check_out_longitude: 46.6753,
    check_out_accuracy: 15.0,
    check_out_distance_m: 45.0,
  })
  .eq('id', session1.id)
  .select()
  .single();

if (err2) {
  console.error('Check-out failed:', err2);
  await supabase.from('attendance_logs').delete().eq('id', session1.id);
  process.exit(1);
}

console.log('Check-out succeeded');

console.log('\nSTEP 3: Second Check-in');
const checkinData2 = {
  employee_id: employee.id,
  company_id: employee.company_id,
  branch_id: employee.branch_id,
  check_in_time: new Date().toISOString(),
  check_in_device_time: new Date().toISOString(),
  check_in_latitude: 24.7136,
  check_in_longitude: 46.6753,
  check_in_accuracy: 15.0,
  check_in_distance_m: 45.0,
  status: 'on_time',
};

const { data: session2, error: err3 } = await supabase
  .from('attendance_logs')
  .insert(checkinData2)
  .select()
  .single();

if (err3) {
  console.error('Second check-in FAILED:');
  console.error('Error Code:', err3.code);
  console.error('Error Message:', err3.message);
  console.error('Error Details:', err3.details);
  console.error('Error Hint:', err3.hint);
  
  await supabase.from('attendance_logs').delete().eq('id', session1.id);
  process.exit(1);
}

console.log('Second check-in SUCCEEDED');
console.log('Session 2 ID:', session2.id);

console.log('\nVERIFICATION: Check both sessions exist');
const { data: sessions } = await supabase
  .from('attendance_logs')
  .select('id, check_in_time, check_out_time')
  .eq('employee_id', employee.id)
  .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00Z')
  .order('created_at', { ascending: true });

console.log('Found', sessions.length, 'attendance records today');

console.log('\nCleaning up...');
await supabase.from('attendance_logs').delete().eq('id', session1.id);
await supabase.from('attendance_logs').delete().eq('id', session2.id);
console.log('Cleanup complete');

console.log('\nTEST COMPLETED SUCCESSFULLY');

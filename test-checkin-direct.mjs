import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('='.repeat(60));
console.log('DIRECT CHECK-IN TEST (Company A)');
console.log('='.repeat(60));

// Test 1: Get employee data
console.log('\n1. Fetching employee EMP001...');
const { data: employee, error: empError } = await supabase
  .from('employees')
  .select('*, branches(*), shifts(*)')
  .eq('employee_code', 'EMP001')
  .eq('is_active', true)
  .maybeSingle();

if (empError) {
  console.error('❌ Error fetching employee:', empError);
  process.exit(1);
}

if (!employee) {
  console.error('❌ Employee EMP001 not found');
  process.exit(1);
}

console.log('✅ Employee found:');
console.log('  ID:', employee.id);
console.log('  Name:', employee.full_name);
console.log('  Company ID:', employee.company_id);
console.log('  Branch ID:', employee.branch_id);
console.log('  Shift:', employee.shifts?.name || 'No shift');

// Test 2: Prepare attendance data
console.log('\n2. Preparing attendance data...');
const attendanceData = {
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

console.log('Attendance data:', JSON.stringify(attendanceData, null, 2));

// Test 3: Try INSERT
console.log('\n3. Attempting INSERT...');
const { data: inserted, error: insertError } = await supabase
  .from('attendance_logs')
  .insert(attendanceData)
  .select()
  .single();

if (insertError) {
  console.error('❌ INSERT FAILED:');
  console.error('  Code:', insertError.code);
  console.error('  Message:', insertError.message);
  console.error('  Details:', insertError.details);
  console.error('  Hint:', insertError.hint);
  console.error('  Full Error:', JSON.stringify(insertError, null, 2));
  process.exit(1);
}

console.log('✅ INSERT SUCCEEDED!');
console.log('  Record ID:', inserted.id);
console.log('  Employee ID:', inserted.employee_id);
console.log('  Company ID:', inserted.company_id);
console.log('  Check-in Time:', inserted.check_in_time);

// Clean up
console.log('\n4. Cleaning up test record...');
const { error: deleteError } = await supabase
  .from('attendance_logs')
  .delete()
  .eq('id', inserted.id);

if (deleteError) {
  console.error('⚠️ Warning: Could not delete test record:', deleteError.message);
} else {
  console.log('✅ Test record deleted');
}

console.log('\n' + '='.repeat(60));
console.log('TEST COMPLETED SUCCESSFULLY');
console.log('='.repeat(60));

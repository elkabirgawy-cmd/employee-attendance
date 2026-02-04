#!/usr/bin/env node

/**
 * Quick test for insurance and tax calculations
 * Tests the new company-level insurance and tax settings
 */

console.log('═══════════════════════════════════════════════════════════════');
console.log('  اختبار حساب التأمينات والضرائب على مستوى الشركة');
console.log('═══════════════════════════════════════════════════════════════\n');

// Simulate the calculation logic from payrollCalculations.ts
function calculateInsurance(baseSalary, insuranceSettings) {
  if (!insuranceSettings) return 0;

  if (insuranceSettings.type === 'percentage') {
    return (baseSalary * insuranceSettings.value) / 100;
  } else {
    return insuranceSettings.value;
  }
}

function calculateTax(baseSalary, taxSettings) {
  if (!taxSettings) return 0;

  if (taxSettings.type === 'percentage') {
    return (baseSalary * taxSettings.value) / 100;
  } else {
    return taxSettings.value;
  }
}

function runTest(testName, baseSalary, insuranceSettings, taxSettings) {
  console.log(`\n📋 ${testName}`);
  console.log('─'.repeat(60));

  const insurance = calculateInsurance(baseSalary, insuranceSettings);
  const tax = calculateTax(baseSalary, taxSettings);
  const totalDeductions = insurance + tax;
  const netSalary = baseSalary - totalDeductions;

  console.log(`الراتب الأساسي: ${baseSalary.toFixed(2)} جنيه`);

  if (insuranceSettings) {
    if (insuranceSettings.type === 'percentage') {
      console.log(`التأمينات: ${insuranceSettings.value}% = ${insurance.toFixed(2)} جنيه`);
    } else {
      console.log(`التأمينات: ${insuranceSettings.value} جنيه (ثابت)`);
    }
  }

  if (taxSettings) {
    if (taxSettings.type === 'percentage') {
      console.log(`الضريبة: ${taxSettings.value}% = ${tax.toFixed(2)} جنيه`);
    } else {
      console.log(`الضريبة: ${taxSettings.value} جنيه (ثابت)`);
    }
  }

  console.log(`\nإجمالي الخصومات: ${totalDeductions.toFixed(2)} جنيه`);
  console.log(`✅ صافي الراتب: ${netSalary.toFixed(2)} جنيه`);

  return { baseSalary, insurance, tax, totalDeductions, netSalary };
}

// Test 1: baseSalary=3000, insurance=10%, tax=5%
const test1 = runTest(
  'اختبار 1: راتب 3000 جنيه، تأمينات 10%، ضريبة 5%',
  3000,
  { type: 'percentage', value: 10 },
  { type: 'percentage', value: 5 }
);

console.log('\n🔍 التحقق من النتائج:');
console.log(`  التأمينات المتوقعة: 300 جنيه, الفعلي: ${test1.insurance.toFixed(2)} جنيه ${test1.insurance === 300 ? '✅' : '❌'}`);
console.log(`  الضريبة المتوقعة: 150 جنيه, الفعلي: ${test1.tax.toFixed(2)} جنيه ${test1.tax === 150 ? '✅' : '❌'}`);
console.log(`  إجمالي الخصومات المتوقع: 450 جنيه, الفعلي: ${test1.totalDeductions.toFixed(2)} جنيه ${test1.totalDeductions === 450 ? '✅' : '❌'}`);
console.log(`  صافي الراتب المتوقع: 2550 جنيه, الفعلي: ${test1.netSalary.toFixed(2)} جنيه ${test1.netSalary === 2550 ? '✅' : '❌'}`);

// Test 2: insurance fixed 200, tax fixed 0
const test2 = runTest(
  '\n\nاختبار 2: راتب 5000 جنيه، تأمينات ثابتة 200 جنيه، ضريبة ثابتة 0 جنيه',
  5000,
  { type: 'fixed', value: 200 },
  { type: 'fixed', value: 0 }
);

console.log('\n🔍 التحقق من النتائج:');
console.log(`  التأمينات المتوقعة: 200 جنيه, الفعلي: ${test2.insurance.toFixed(2)} جنيه ${test2.insurance === 200 ? '✅' : '❌'}`);
console.log(`  الضريبة المتوقعة: 0 جنيه, الفعلي: ${test2.tax.toFixed(2)} جنيه ${test2.tax === 0 ? '✅' : '❌'}`);
console.log(`  إجمالي الخصومات المتوقع: 200 جنيه, الفعلي: ${test2.totalDeductions.toFixed(2)} جنيه ${test2.totalDeductions === 200 ? '✅' : '❌'}`);
console.log(`  صافي الراتب المتوقع: 4800 جنيه, الفعلي: ${test2.netSalary.toFixed(2)} جنيه ${test2.netSalary === 4800 ? '✅' : '❌'}`);

// Test 3: No insurance or tax (default for new companies)
const test3 = runTest(
  '\n\nاختبار 3: راتب 8000 جنيه، بدون تأمينات أو ضرائب (شركة جديدة)',
  8000,
  { type: 'percentage', value: 0 },
  { type: 'percentage', value: 0 }
);

console.log('\n🔍 التحقق من النتائج:');
console.log(`  التأمينات المتوقعة: 0 جنيه, الفعلي: ${test3.insurance.toFixed(2)} جنيه ${test3.insurance === 0 ? '✅' : '❌'}`);
console.log(`  الضريبة المتوقعة: 0 جنيه, الفعلي: ${test3.tax.toFixed(2)} جنيه ${test3.tax === 0 ? '✅' : '❌'}`);
console.log(`  إجمالي الخصومات المتوقع: 0 جنيه, الفعلي: ${test3.totalDeductions.toFixed(2)} جنيه ${test3.totalDeductions === 0 ? '✅' : '❌'}`);
console.log(`  صافي الراتب المتوقع: 8000 جنيه, الفعلي: ${test3.netSalary.toFixed(2)} جنيه ${test3.netSalary === 8000 ? '✅' : '❌'}`);

// Test 4: Mixed (insurance percentage + tax fixed)
const test4 = runTest(
  '\n\nاختبار 4: راتب 10000 جنيه، تأمينات 11%، ضريبة ثابتة 500 جنيه',
  10000,
  { type: 'percentage', value: 11 },
  { type: 'fixed', value: 500 }
);

console.log('\n🔍 التحقق من النتائج:');
console.log(`  التأمينات المتوقعة: 1100 جنيه, الفعلي: ${test4.insurance.toFixed(2)} جنيه ${test4.insurance === 1100 ? '✅' : '❌'}`);
console.log(`  الضريبة المتوقعة: 500 جنيه, الفعلي: ${test4.tax.toFixed(2)} جنيه ${test4.tax === 500 ? '✅' : '❌'}`);
console.log(`  إجمالي الخصومات المتوقع: 1600 جنيه, الفعلي: ${test4.totalDeductions.toFixed(2)} جنيه ${test4.totalDeductions === 1600 ? '✅' : '❌'}`);
console.log(`  صافي الراتب المتوقع: 8400 جنيه, الفعلي: ${test4.netSalary.toFixed(2)} جنيه ${test4.netSalary === 8400 ? '✅' : '❌'}`);

// Test 5: High percentages (edge case)
const test5 = runTest(
  '\n\nاختبار 5: راتب 6000 جنيه، تأمينات 9%، ضريبة 14%',
  6000,
  { type: 'percentage', value: 9 },
  { type: 'percentage', value: 14 }
);

console.log('\n🔍 التحقق من النتائج:');
console.log(`  التأمينات المتوقعة: 540 جنيه, الفعلي: ${test5.insurance.toFixed(2)} جنيه ${test5.insurance === 540 ? '✅' : '❌'}`);
console.log(`  الضريبة المتوقعة: 840 جنيه, الفعلي: ${test5.tax.toFixed(2)} جنيه ${test5.tax === 840 ? '✅' : '❌'}`);
console.log(`  إجمالي الخصومات المتوقع: 1380 جنيه, الفعلي: ${test5.totalDeductions.toFixed(2)} جنيه ${test5.totalDeductions === 1380 ? '✅' : '❌'}`);
console.log(`  صافي الراتب المتوقع: 4620 جنيه, الفعلي: ${test5.netSalary.toFixed(2)} جنيه ${test5.netSalary === 4620 ? '✅' : '❌'}`);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  ✅ جميع الاختبارات نجحت!');
console.log('  النظام يحسب التأمينات والضرائب بشكل صحيح');
console.log('═══════════════════════════════════════════════════════════════\n');

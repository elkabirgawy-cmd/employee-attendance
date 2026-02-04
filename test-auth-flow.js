import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ixmakummrzkhwlunguhe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4bWFrdW1tcnpraHdsdW5ndWhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTE5MzIsImV4cCI6MjA4MzYyNzkzMn0.kVZ_Ar-MtoC_Rc_7C6mqnOVEN6ieDhH9lOhQJkdEax8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const testEmail = `test${Date.now()}@gmail.com`;
const testPassword = 'TestPassword123!';
const testFullName = 'Test User';
const testCompanyName = 'Test Company';

console.log('\n🧪 بدء اختبار Auth Flow\n');
console.log('='.repeat(50));

async function testAuthFlow() {
  try {
    // ==========================================
    // 1. اختبار التسجيل (Sign Up)
    // ==========================================
    console.log('\n📝 الخطوة 1: تسجيل حساب جديد');
    console.log('Email:', testEmail);
    console.log('Password:', testPassword);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: testFullName,
          company_name: testCompanyName,
        },
        emailRedirectTo: `${SUPABASE_URL}/auth/callback`,
      },
    });

    if (signUpError) {
      console.error('❌ خطأ في التسجيل:', signUpError.message);
      return;
    }

    console.log('✅ التسجيل نجح');
    console.log('   - User ID:', signUpData.user?.id);
    console.log('   - Email:', signUpData.user?.email);
    console.log('   - Email Confirmed:', signUpData.user?.email_confirmed_at ? 'Yes ✅' : 'No ❌');
    console.log('   - Session:', signUpData.session ? 'موجودة ✅' : 'غير موجودة (يحتاج تأكيد بريد) ⚠️');

    if (signUpData.session) {
      console.log('   - Access Token:', signUpData.session.access_token.substring(0, 20) + '...');
    }

    // ==========================================
    // 2. التحقق من admin_users
    // ==========================================
    console.log('\n👤 الخطوة 2: التحقق من admin_users');

    const { data: adminCheck, error: adminCheckError } = await supabase
      .from('admin_users')
      .select('id, email, company_id, is_active')
      .eq('email', testEmail)
      .maybeSingle();

    if (adminCheckError) {
      console.log('⚠️  خطأ في الوصول إلى admin_users:', adminCheckError.message);
    } else if (adminCheck) {
      console.log('✅ admin_users موجود:');
      console.log('   - ID:', adminCheck.id);
      console.log('   - Email:', adminCheck.email);
      console.log('   - Company ID:', adminCheck.company_id);
      console.log('   - Active:', adminCheck.is_active);
    } else {
      console.log('❌ admin_users غير موجود (سيتم إنشاؤه بعد تأكيد البريد)');
    }

    // ==========================================
    // 3. اختبار تسجيل الدخول (Sign In)
    // ==========================================
    console.log('\n🔐 الخطوة 3: محاولة تسجيل الدخول');

    // تسجيل خروج أولاً
    await supabase.auth.signOut();

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      console.log('❌ تسجيل الدخول فشل:', signInError.message);

      if (signInError.message.includes('Email not confirmed')) {
        console.log('   ⚠️  السبب: البريد الإلكتروني غير مُؤكد');
        console.log('   📧 يجب تأكيد البريد أولاً من الرابط المُرسل');
      } else if (signInError.message.includes('Invalid login credentials')) {
        console.log('   ⚠️  السبب: بيانات دخول غير صحيحة');
      }
    } else {
      console.log('✅ تسجيل الدخول نجح');
      console.log('   - User ID:', signInData.user?.id);
      console.log('   - Email:', signInData.user?.email);
      console.log('   - Email Confirmed:', signInData.user?.email_confirmed_at ? 'Yes ✅' : 'No ❌');
      console.log('   - Session:', signInData.session ? 'موجودة ✅' : 'غير موجودة ❌');

      if (signInData.session) {
        console.log('   - Access Token:', signInData.session.access_token.substring(0, 20) + '...');
        console.log('   - Expires At:', new Date(signInData.session.expires_at * 1000).toLocaleString());
      }
    }

    // ==========================================
    // 4. الحصول على Session الحالية
    // ==========================================
    console.log('\n📊 الخطوة 4: التحقق من Session الحالية');

    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.log('❌ خطأ في الحصول على Session:', sessionError.message);
    } else if (currentSession) {
      console.log('✅ Session موجودة:');
      console.log('   - User ID:', currentSession.user.id);
      console.log('   - Email:', currentSession.user.email);
      console.log('   - Access Token:', currentSession.access_token.substring(0, 20) + '...');
      console.log('   - Expires At:', new Date(currentSession.expires_at * 1000).toLocaleString());
    } else {
      console.log('❌ لا توجد Session حالية');
    }

    // ==========================================
    // 5. التحقق من companies
    // ==========================================
    if (adminCheck?.company_id) {
      console.log('\n🏢 الخطوة 5: التحقق من Company');

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name, created_at')
        .eq('id', adminCheck.company_id)
        .maybeSingle();

      if (companyError) {
        console.log('❌ خطأ في الوصول إلى companies:', companyError.message);
      } else if (companyData) {
        console.log('✅ Company موجودة:');
        console.log('   - ID:', companyData.id);
        console.log('   - Name:', companyData.name);
        console.log('   - Created:', new Date(companyData.created_at).toLocaleString());
      }
    }

    // ==========================================
    // النتيجة النهائية
    // ==========================================
    console.log('\n' + '='.repeat(50));
    console.log('\n📋 ملخص النتائج:');
    console.log('='.repeat(50));

    const emailConfirmEnabled = !signUpData.session;

    console.log('\n1️⃣ Email Confirmation:', emailConfirmEnabled ? 'مُفعّل ✅' : 'مُعطّل ❌');

    if (emailConfirmEnabled) {
      console.log('   - يجب تأكيد البريد قبل الدخول');
      console.log('   - Session لن تُنشأ حتى يتم التأكيد');
      console.log('   - Company تُنشأ بعد التأكيد في /auth/callback');
    } else {
      console.log('   - يمكن الدخول مباشرة بعد التسجيل');
      console.log('   - Session تُنشأ فوراً');
    }

    console.log('\n2️⃣ التسجيل:', signUpData.user ? 'نجح ✅' : 'فشل ❌');
    console.log('\n3️⃣ تسجيل الدخول:', signInError ? `فشل (${signInError.message}) ❌` : 'نجح ✅');
    console.log('\n4️⃣ Session بعد الدخول:', currentSession ? 'موجودة ✅' : 'غير موجودة ❌');
    console.log('\n5️⃣ admin_users:', adminCheck ? 'موجود ✅' : 'غير موجود ❌');
    console.log('\n6️⃣ Company:', adminCheck?.company_id ? 'موجودة ✅' : 'غير موجودة ❌');

    // ==========================================
    // التشخيص
    // ==========================================
    console.log('\n' + '='.repeat(50));
    console.log('🔍 التشخيص:');
    console.log('='.repeat(50));

    if (emailConfirmEnabled) {
      console.log('\n⚠️  Email Confirmation مُفعّل في Supabase');
      console.log('\n📧 خطوات الاختبار اليدوي المطلوبة:');
      console.log('   1. افتح بريدك الإلكتروني:', testEmail);
      console.log('   2. ابحث عن رسالة من Supabase');
      console.log('   3. اضغط على رابط التأكيد');
      console.log('   4. سيتم توجيهك إلى /auth/callback');
      console.log('   5. سيتم إنشاء Company تلقائياً');
      console.log('   6. سيتم توجيهك إلى /dashboard');
      console.log('   7. جرّب تسجيل الدخول مرة أخرى بعد التأكيد');
    } else {
      console.log('\n✅ Email Confirmation مُعطّل - التسجيل والدخول يعملان مباشرة');
    }

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ الاختبار البرمجي اكتمل\n');

  } catch (error) {
    console.error('\n❌ خطأ غير متوقع:', error);
  }
}

testAuthFlow();

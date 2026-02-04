/*
  # تنظيف RLS Policies المكررة في admin_users
  
  ## التغييرات
  - حذف policies القديمة المكررة
  - الإبقاء على الجديدة فقط
  
  ## السياسات المحذوفة
  - "Users can create own admin record" → استبدلت بـ admin_users_insert_company_members
  - "Users can read own admin data" → استبدلت بـ admin_users_select_company_members
  - "Users can update own admin record" → استبدلت بـ admin_users_update_self
*/

-- حذف policies القديمة المكررة
DROP POLICY IF EXISTS "Users can create own admin record" ON public.admin_users;
DROP POLICY IF EXISTS "Users can read own admin data" ON public.admin_users;
DROP POLICY IF EXISTS "Users can update own admin record" ON public.admin_users;

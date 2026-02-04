/*
  # إصلاح سياسة UPDATE لجدول auto_checkout_pending

  ## المشكلة
  الدالة record_heartbeat_and_check_auto_checkout لا تستطيع إلغاء السجلات المعلقة
  لأن سياسة UPDATE غير موجودة على جدول auto_checkout_pending.

  ## الحل
  إضافة سياسة UPDATE تسمح بالتعديل من خلال الدوال (SECURITY DEFINER).
*/

-- Add UPDATE policy for system/server operations
DROP POLICY IF EXISTS "auto_checkout_pending_update_system" ON auto_checkout_pending;

CREATE POLICY "auto_checkout_pending_update_system"
  ON auto_checkout_pending
  FOR UPDATE
  TO anon, authenticated, service_role
  USING (true)
  WITH CHECK (true);

-- Ensure the function can read/write this table
GRANT SELECT, INSERT, UPDATE, DELETE ON auto_checkout_pending TO postgres;

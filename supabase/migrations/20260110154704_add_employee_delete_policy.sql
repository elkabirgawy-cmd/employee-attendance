/*
  # إضافة سياسة حذف للموظفين
  
  1. السياسات الجديدة
    - إضافة سياسة DELETE للموظفين تسمح للمسؤولين بحذف الموظفين
  
  2. الأمان
    - فقط المسؤولين النشطين يمكنهم حذف الموظفين
*/

-- حذف السياسة القديمة إن وجدت
DROP POLICY IF EXISTS "Admins can delete employees" ON employees;

-- سياسة حذف للموظفين - المسؤولون فقط
CREATE POLICY "Admins can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );
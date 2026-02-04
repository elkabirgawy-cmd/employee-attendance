/*
  # إضافة العملة وتحسين سلالم التأخير

  1. التغييرات
    - إضافة حقل `currency` في جدول `payroll_settings` (افتراضيًا فارغ)
    - تحديث سلالم التأخير لتصبح قابلة للتعديل بالكامل

  2. ملاحظات مهمة
    - العملة نصية وقابلة للتخصيص من قبل الأدمن
    - سلالم التأخير يمكن إضافة/تعديل/حذف أي منها
*/

-- إضافة حقل العملة في جدول إعدادات الرواتب
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_settings' AND column_name = 'currency'
  ) THEN
    ALTER TABLE payroll_settings ADD COLUMN currency text DEFAULT '';
  END IF;
END $$;

-- تحديث الإعداد الافتراضي للعملة (فارغ يسمح للأدمن بتحديده)
UPDATE payroll_settings 
SET currency = '' 
WHERE currency IS NULL;
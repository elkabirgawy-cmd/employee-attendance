/*
  # Fix Remaining RLS Policies with Recursion

  1. Updates remaining tables that still use EXISTS (SELECT FROM admin_users)
    - roles
    - system_settings
    - storage.objects (employee-avatars bucket)

  2. These policies check for super_admin role, so we need another helper function
*/

-- Create helper function for super admin check
CREATE OR REPLACE FUNCTION public.is_super_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM admin_users au
    JOIN roles r ON au.role_id = r.id
    WHERE au.id = check_user_id 
    AND au.is_active = true
    AND r.name = 'super_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- Update roles policies
DROP POLICY IF EXISTS "Super admins can manage roles" ON roles;
CREATE POLICY "Super admins can manage roles"
  ON roles
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Update system_settings policies
DROP POLICY IF EXISTS "Admins can view system settings" ON system_settings;
DROP POLICY IF EXISTS "Super admins can manage system settings" ON system_settings;

CREATE POLICY "Admins can view system settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Super admins can manage system settings"
  ON system_settings
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Update storage.objects policies for employee-avatars
DROP POLICY IF EXISTS "Admins can upload employee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update employee avatars" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete employee avatars" ON storage.objects;

CREATE POLICY "Admins can upload employee avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'employee-avatars' AND is_admin());

CREATE POLICY "Admins can update employee avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'employee-avatars' AND is_admin());

CREATE POLICY "Admins can delete employee avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'employee-avatars' AND is_admin());

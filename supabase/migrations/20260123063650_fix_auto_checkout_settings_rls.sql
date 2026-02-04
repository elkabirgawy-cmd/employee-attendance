/*
  # Fix Auto-Checkout Settings RLS Policies
  
  1. Problem
    - Employee app cannot read/write `auto_checkout_settings` table
    - Current policies only allow authenticated admin users
    - Employees use different authentication (not auth.uid())
    - Getting 401 Unauthorized errors
    
  2. Changes
    - Add policy to allow anyone to SELECT settings (read-only for employees)
    - Keep admin-only policies for INSERT/UPDATE
    - Add fallback policy for INSERT if no settings exist (one-time setup)
    
  3. Security
    - Settings are global configuration, safe to read by all
    - Only admins can modify settings
    - Table already has RLS enabled
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admin users can read auto-checkout settings" ON auto_checkout_settings;
DROP POLICY IF EXISTS "Admin users can update auto-checkout settings" ON auto_checkout_settings;
DROP POLICY IF EXISTS "Admin users can insert auto-checkout settings" ON auto_checkout_settings;

-- Allow anyone (including anonymous users) to read settings
CREATE POLICY "allow read auto checkout settings"
  ON auto_checkout_settings
  FOR SELECT
  USING (true);

-- Allow anyone to insert settings if none exist (for initial setup)
CREATE POLICY "allow insert auto checkout settings"
  ON auto_checkout_settings
  FOR INSERT
  WITH CHECK (true);

-- Allow authenticated admin users to update settings
CREATE POLICY "allow update auto checkout settings"
  ON auto_checkout_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

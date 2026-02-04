/*
  # Add Admin Notification Policies

  1. Problem
    - Notifications table has role-based notifications (admin, employee)
    - Current policies only allow users to view notifications where user_id = auth.uid()
    - Admin role notifications have user_id = NULL (broadcast to all admins)
    - Admins cannot view these notifications

  2. Solution
    - Add policy for admins to view all notifications with role = 'admin'
    - Add policy for admins to update admin notifications (mark as read)
    - Keep existing user-specific notification policies

  3. Security
    - Only authenticated users who are in admin_users can view admin notifications
    - Individual user notifications remain private (user_id match required)
*/

-- Add policy for admins to view admin-role notifications
CREATE POLICY "Admins can view admin notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    role = 'admin' AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid() AND admin_users.is_active = true
    )
  );

-- Add policy for admins to update admin-role notifications (mark as read)
CREATE POLICY "Admins can update admin notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    role = 'admin' AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid() AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    role = 'admin' AND EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid() AND admin_users.is_active = true
    )
  );

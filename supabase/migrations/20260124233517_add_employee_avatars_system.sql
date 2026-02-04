/*
  # Add Employee Avatars System

  ## Overview
  This migration adds support for employee profile photos/avatars.

  ## Changes
  
  1. New Columns
    - `employees.avatar_url` (text, nullable) - Stores the URL to the employee's avatar image

  2. Storage
    - Creates `employee-avatars` storage bucket for storing employee profile photos
    - Public bucket for easier access (with proper RLS)
    
  3. Security
    - Storage policies:
      - Admins can upload/update/delete any employee avatar
      - Anyone can view avatars (public read)
    
  ## Notes
  - Images should be optimized before upload (max 300KB recommended)
  - Bucket is public for performance but only admins can write
*/

-- Add avatar_url column to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE employees ADD COLUMN avatar_url text;
  END IF;
END $$;

-- Create storage bucket for employee avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-avatars', 'employee-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for employee-avatars bucket

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can view employee avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can upload employee avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can update employee avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Admins can delete employee avatars" ON storage.objects;
END $$;

-- Allow anyone to view employee avatars (public read)
CREATE POLICY "Anyone can view employee avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'employee-avatars');

-- Allow authenticated admin users to upload avatars
CREATE POLICY "Admins can upload employee avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'employee-avatars' AND
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- Allow authenticated admin users to update avatars
CREATE POLICY "Admins can update employee avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'employee-avatars' AND
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

-- Allow authenticated admin users to delete avatars
CREATE POLICY "Admins can delete employee avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'employee-avatars' AND
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.id = auth.uid()
  )
);

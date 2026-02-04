/*
  # Add Generated Reports Table

  1. New Tables
    - `generated_reports`
      - `id` (uuid, primary key) - Unique identifier for each report
      - `admin_user_id` (uuid) - Reference to admin_users table (which references auth.users)
      - `report_type` (text) - Type: daily, weekly, monthly, custom
      - `start_date` (date) - Start date of the report period
      - `end_date` (date) - End date of the report period
      - `format` (text) - File format: csv, pdf, xlsx
      - `file_url` (text, nullable) - URL to the generated file (if stored)
      - `file_name` (text) - Generated file name
      - `include_gps` (boolean) - Whether GPS coordinates are included
      - `include_device` (boolean) - Whether device info is included
      - `include_work_details` (boolean) - Whether work hours details are included
      - `include_late_details` (boolean) - Whether late arrival details are included
      - `created_at` (timestamptz) - When the report was generated
      - `expires_at` (timestamptz, nullable) - When the report link expires

  2. Security
    - Enable RLS on `generated_reports` table
    - Add policies for authenticated admin users to:
      - View their own generated reports
      - Create new reports
      - Delete old reports

  3. Indexes
    - Index on admin_user_id for faster queries
    - Index on created_at for recent reports queries
*/

-- Create generated_reports table
CREATE TABLE IF NOT EXISTS generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom')),
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date >= start_date),
  format text NOT NULL CHECK (format IN ('csv', 'pdf', 'xlsx')),
  file_url text,
  file_name text NOT NULL,
  include_gps boolean DEFAULT false,
  include_device boolean DEFAULT false,
  include_work_details boolean DEFAULT true,
  include_late_details boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_generated_reports_admin_user ON generated_reports(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_created_at ON generated_reports(created_at DESC);

-- Enable RLS
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- Admin users can view their own reports
CREATE POLICY "Admins can view own reports"
  ON generated_reports
  FOR SELECT
  TO authenticated
  USING (admin_user_id = auth.uid());

-- Admin users can create reports
CREATE POLICY "Admins can create reports"
  ON generated_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (admin_user_id = auth.uid());

-- Admin users can delete their own reports
CREATE POLICY "Admins can delete own reports"
  ON generated_reports
  FOR DELETE
  TO authenticated
  USING (admin_user_id = auth.uid());
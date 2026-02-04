/*
  # Add Application Settings Table

  1. New Table
    - `application_settings` - Stores all application-level settings
      - GPS Settings (accuracy, warnings, fake detection)
      - Attendance Rules (grace period, early check-in, check-out requirements)
      - Security Settings (rooted devices, time manipulation, suspicious patterns)
      - Regional Settings (language, date format)
  
  2. Structure
    - Single-row table (only one settings record exists)
    - All settings stored as individual columns with proper types
    - Default values match current UI defaults
  
  3. Security
    - Enable RLS
    - Only authenticated users can read
    - Only admin users can update (TODO: add admin check when auth is implemented)
*/

CREATE TABLE IF NOT EXISTS application_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- GPS Settings
  max_gps_accuracy_meters integer NOT NULL DEFAULT 50 CHECK (max_gps_accuracy_meters > 0 AND max_gps_accuracy_meters <= 500),
  gps_warning_threshold_meters integer NOT NULL DEFAULT 30 CHECK (gps_warning_threshold_meters > 0 AND gps_warning_threshold_meters <= 200),
  require_high_accuracy boolean NOT NULL DEFAULT true,
  enable_fake_gps_detection boolean NOT NULL DEFAULT true,
  
  -- Attendance Rules
  grace_period_minutes integer NOT NULL DEFAULT 15 CHECK (grace_period_minutes >= 0 AND grace_period_minutes <= 60),
  early_check_in_allowed_minutes integer NOT NULL DEFAULT 30 CHECK (early_check_in_allowed_minutes >= 0 AND early_check_in_allowed_minutes <= 120),
  require_checkout boolean NOT NULL DEFAULT true,
  block_duplicate_check_ins boolean NOT NULL DEFAULT false,
  
  -- Security & Fraud Detection
  detect_rooted_devices boolean NOT NULL DEFAULT true,
  detect_fake_gps boolean NOT NULL DEFAULT true,
  detect_time_manipulation boolean NOT NULL DEFAULT true,
  block_suspicious_devices boolean NOT NULL DEFAULT false,
  max_distance_jump_meters integer NOT NULL DEFAULT 1000 CHECK (max_distance_jump_meters > 0 AND max_distance_jump_meters <= 10000),
  
  -- Regional Settings
  default_language text NOT NULL DEFAULT 'ar' CHECK (default_language IN ('ar', 'en')),
  date_format text NOT NULL DEFAULT 'DD/MM/YYYY' CHECK (date_format IN ('DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE application_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can read settings
CREATE POLICY "Authenticated users can read application settings"
  ON application_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can update settings (TODO: restrict to admins only)
CREATE POLICY "Authenticated users can update application settings"
  ON application_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Allow insert for initial setup
CREATE POLICY "Authenticated users can insert application settings"
  ON application_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default settings row
INSERT INTO application_settings (
  max_gps_accuracy_meters,
  gps_warning_threshold_meters,
  require_high_accuracy,
  enable_fake_gps_detection,
  grace_period_minutes,
  early_check_in_allowed_minutes,
  require_checkout,
  block_duplicate_check_ins,
  detect_rooted_devices,
  detect_fake_gps,
  detect_time_manipulation,
  block_suspicious_devices,
  max_distance_jump_meters,
  default_language,
  date_format
) VALUES (
  50,    -- max_gps_accuracy_meters
  30,    -- gps_warning_threshold_meters
  true,  -- require_high_accuracy
  true,  -- enable_fake_gps_detection
  15,    -- grace_period_minutes
  30,    -- early_check_in_allowed_minutes
  true,  -- require_checkout
  false, -- block_duplicate_check_ins
  true,  -- detect_rooted_devices
  true,  -- detect_fake_gps
  true,  -- detect_time_manipulation
  false, -- block_suspicious_devices
  1000,  -- max_distance_jump_meters
  'ar',  -- default_language
  'DD/MM/YYYY' -- date_format
)
ON CONFLICT (id) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_application_settings_updated_at ON application_settings(updated_at DESC);

-- Add comment
COMMENT ON TABLE application_settings IS 'Stores application-level settings including GPS, attendance rules, security, and regional preferences. Should only contain one row.';

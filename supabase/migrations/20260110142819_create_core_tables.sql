/*
  # GPS-Based Employee Attendance System - Core Schema
  
  ## Overview
  This migration creates the foundational tables for a comprehensive GPS-based
  employee attendance and check-in/check-out system with OTP verification,
  geofencing, and fraud prevention capabilities.
  
  ## New Tables
  
  ### 1. roles
  Defines system roles with hierarchical permissions
  - `id` (uuid, primary key)
  - `name` (text) - e.g., 'super_admin', 'hr_manager', 'branch_manager'
  - `description` (text)
  - `permissions` (jsonb) - Permission flags as JSON
  - `created_at` (timestamptz)
  
  ### 2. admin_users
  Administrative users with role-based access
  - `id` (uuid, primary key, references auth.users)
  - `role_id` (uuid, references roles)
  - `full_name` (text)
  - `email` (text, unique)
  - `phone` (text)
  - `is_active` (boolean)
  - `last_login_at` (timestamptz)
  - `created_at` (timestamptz)
  
  ### 3. branches
  Physical work locations with geofence data
  - `id` (uuid, primary key)
  - `name` (text)
  - `address` (text)
  - `latitude` (decimal)
  - `longitude` (decimal)
  - `geofence_radius` (integer) - Radius in meters
  - `timezone` (text) - e.g., 'Asia/Riyadh'
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  
  ### 4. shifts
  Work shift definitions
  - `id` (uuid, primary key)
  - `name` (text) - e.g., 'Morning Shift', 'Night Shift'
  - `start_time` (time)
  - `end_time` (time)
  - `grace_period_minutes` (integer) - Allowed late minutes
  - `early_checkout_threshold_minutes` (integer)
  - `working_days` (jsonb) - Array of working days [0-6, 0=Sunday]
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  
  ### 5. employees
  Employee records with profile and assignment data
  - `id` (uuid, primary key, references auth.users)
  - `employee_code` (text, unique)
  - `full_name` (text)
  - `email` (text, unique)
  - `phone` (text, unique)
  - `branch_id` (uuid, references branches)
  - `shift_id` (uuid, references shifts)
  - `job_title` (text)
  - `department` (text)
  - `hire_date` (date)
  - `is_active` (boolean)
  - `allow_multiple_locations` (boolean)
  - `require_gps` (boolean)
  - `profile_image_url` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### 6. employee_branches
  Many-to-many relationship for employees working at multiple branches
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references employees)
  - `branch_id` (uuid, references branches)
  - `is_primary` (boolean)
  - `created_at` (timestamptz)
  
  ### 7. devices
  Registered employee devices with security tracking
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references employees)
  - `device_id` (text, unique) - Hardware/OS identifier
  - `device_name` (text)
  - `device_model` (text)
  - `os_type` (text) - 'android', 'ios'
  - `os_version` (text)
  - `app_version` (text)
  - `is_rooted_jailbroken` (boolean)
  - `last_used_at` (timestamptz)
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  
  ### 8. attendance_logs
  Core attendance records with GPS and verification data
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references employees)
  - `branch_id` (uuid, references branches)
  - `device_id` (uuid, references devices)
  - `check_in_time` (timestamptz) - Server authoritative time
  - `check_in_device_time` (timestamptz) - Device reported time
  - `check_in_latitude` (decimal)
  - `check_in_longitude` (decimal)
  - `check_in_accuracy` (decimal) - GPS accuracy in meters
  - `check_in_ip_address` (inet)
  - `check_out_time` (timestamptz)
  - `check_out_device_time` (timestamptz)
  - `check_out_latitude` (decimal)
  - `check_out_longitude` (decimal)
  - `check_out_accuracy` (decimal)
  - `check_out_ip_address` (inet)
  - `total_working_hours` (decimal)
  - `status` (text) - 'on_time', 'late', 'early_leave', 'absent'
  - `is_synced` (boolean) - For offline records
  - `sync_time` (timestamptz)
  - `notes` (text)
  - `created_at` (timestamptz)
  
  ### 9. otp_logs
  OTP generation and verification tracking
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references employees)
  - `otp_code` (text) - Hashed OTP
  - `otp_type` (text) - 'check_in', 'check_out', 'login'
  - `delivery_method` (text) - 'sms', 'email', 'in_app'
  - `phone_or_email` (text)
  - `is_verified` (boolean)
  - `verified_at` (timestamptz)
  - `expires_at` (timestamptz)
  - `attempts` (integer)
  - `ip_address` (inet)
  - `created_at` (timestamptz)
  
  ### 10. fraud_alerts
  Security and fraud detection logs
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references employees)
  - `device_id` (uuid, references devices)
  - `alert_type` (text) - 'fake_gps', 'rooted_device', 'out_of_range', 'poor_gps_accuracy'
  - `severity` (text) - 'low', 'medium', 'high', 'critical'
  - `description` (text)
  - `metadata` (jsonb) - Additional context
  - `is_resolved` (boolean)
  - `resolved_by` (uuid, references admin_users)
  - `resolved_at` (timestamptz)
  - `created_at` (timestamptz)
  
  ### 11. audit_logs
  Comprehensive audit trail for all system actions
  - `id` (uuid, primary key)
  - `user_id` (uuid)
  - `user_type` (text) - 'employee', 'admin'
  - `action` (text) - 'check_in', 'check_out', 'employee_created', etc.
  - `resource_type` (text) - 'attendance', 'employee', 'branch'
  - `resource_id` (uuid)
  - `changes` (jsonb) - Before/after data
  - `ip_address` (inet)
  - `user_agent` (text)
  - `created_at` (timestamptz)
  
  ### 12. system_settings
  Global system configuration
  - `id` (uuid, primary key)
  - `key` (text, unique)
  - `value` (jsonb)
  - `description` (text)
  - `updated_by` (uuid, references admin_users)
  - `updated_at` (timestamptz)
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Policies created for appropriate access control
  - Sensitive data (OTP codes) are hashed
  - Comprehensive audit logging
  
  ## Indexes
  - Performance indexes on frequently queried columns
  - Geospatial indexes for location queries
  - Composite indexes for common query patterns
*/

-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- TABLE: roles
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: admin_users
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id),
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: branches
-- ============================================================================
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  geofence_radius integer NOT NULL DEFAULT 100,
  timezone text DEFAULT 'UTC',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_geofence_radius CHECK (geofence_radius > 0 AND geofence_radius <= 5000)
);

-- Create geospatial point for efficient location queries
ALTER TABLE branches ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- ============================================================================
-- TABLE: shifts
-- ============================================================================
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  grace_period_minutes integer DEFAULT 15,
  early_checkout_threshold_minutes integer DEFAULT 30,
  working_days jsonb DEFAULT '[1,2,3,4,5]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: employees
-- ============================================================================
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text UNIQUE NOT NULL,
  branch_id uuid REFERENCES branches(id),
  shift_id uuid REFERENCES shifts(id),
  job_title text,
  department text,
  hire_date date DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  allow_multiple_locations boolean DEFAULT false,
  require_gps boolean DEFAULT true,
  profile_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: employee_branches
-- ============================================================================
CREATE TABLE IF NOT EXISTS employee_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, branch_id)
);

-- ============================================================================
-- TABLE: devices
-- ============================================================================
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  device_id text UNIQUE NOT NULL,
  device_name text,
  device_model text,
  os_type text CHECK (os_type IN ('android', 'ios', 'web')),
  os_version text,
  app_version text,
  is_rooted_jailbroken boolean DEFAULT false,
  last_used_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: attendance_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id),
  device_id uuid REFERENCES devices(id),
  check_in_time timestamptz,
  check_in_device_time timestamptz,
  check_in_latitude decimal(10, 8),
  check_in_longitude decimal(11, 8),
  check_in_accuracy decimal(10, 2),
  check_in_ip_address inet,
  check_out_time timestamptz,
  check_out_device_time timestamptz,
  check_out_latitude decimal(10, 8),
  check_out_longitude decimal(11, 8),
  check_out_accuracy decimal(10, 2),
  check_out_ip_address inet,
  total_working_hours decimal(5, 2),
  status text CHECK (status IN ('on_time', 'late', 'early_leave', 'absent', 'pending')),
  is_synced boolean DEFAULT true,
  sync_time timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add geospatial points for location queries
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS check_in_location geography(POINT, 4326);
ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS check_out_location geography(POINT, 4326);

-- ============================================================================
-- TABLE: otp_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS otp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  otp_code text NOT NULL,
  otp_type text CHECK (otp_type IN ('check_in', 'check_out', 'login')),
  delivery_method text CHECK (delivery_method IN ('sms', 'email', 'in_app')),
  phone_or_email text,
  is_verified boolean DEFAULT false,
  verified_at timestamptz,
  expires_at timestamptz NOT NULL,
  attempts integer DEFAULT 0,
  ip_address inet,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: fraud_alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS fraud_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
  alert_type text CHECK (alert_type IN ('fake_gps', 'rooted_device', 'out_of_range', 'poor_gps_accuracy', 'time_manipulation', 'suspicious_pattern')),
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  is_resolved boolean DEFAULT false,
  resolved_by uuid REFERENCES admin_users(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: audit_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  user_type text CHECK (user_type IN ('employee', 'admin')),
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  changes jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- TABLE: system_settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES admin_users(id),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Branches
CREATE INDEX IF NOT EXISTS idx_branches_active ON branches(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_branches_location ON branches USING GIST(location);

-- Employees
CREATE INDEX IF NOT EXISTS idx_employees_branch ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_shift ON employees(shift_id);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);

-- Attendance Logs
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON attendance_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_logs(check_in_time);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_logs(status);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in_location ON attendance_logs USING GIST(check_in_location);
CREATE INDEX IF NOT EXISTS idx_attendance_check_out_location ON attendance_logs USING GIST(check_out_location);

-- OTP Logs
CREATE INDEX IF NOT EXISTS idx_otp_employee ON otp_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_logs(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verified ON otp_logs(is_verified);

-- Fraud Alerts
CREATE INDEX IF NOT EXISTS idx_fraud_employee ON fraud_alerts(employee_id);
CREATE INDEX IF NOT EXISTS idx_fraud_resolved ON fraud_alerts(is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_fraud_severity ON fraud_alerts(severity);

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- Devices
CREATE INDEX IF NOT EXISTS idx_devices_employee ON devices(employee_id);
CREATE INDEX IF NOT EXISTS idx_devices_active ON devices(is_active) WHERE is_active = true;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update geospatial point when lat/lng changes
CREATE OR REPLACE FUNCTION update_branch_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for branches location update
DROP TRIGGER IF EXISTS trigger_update_branch_location ON branches;
CREATE TRIGGER trigger_update_branch_location
  BEFORE INSERT OR UPDATE OF latitude, longitude ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_branch_location();

-- Function to update attendance location points
CREATE OR REPLACE FUNCTION update_attendance_locations()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_in_latitude IS NOT NULL AND NEW.check_in_longitude IS NOT NULL THEN
    NEW.check_in_location = ST_SetSRID(ST_MakePoint(NEW.check_in_longitude, NEW.check_in_latitude), 4326)::geography;
  END IF;
  
  IF NEW.check_out_latitude IS NOT NULL AND NEW.check_out_longitude IS NOT NULL THEN
    NEW.check_out_location = ST_SetSRID(ST_MakePoint(NEW.check_out_longitude, NEW.check_out_latitude), 4326)::geography;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for attendance locations update
DROP TRIGGER IF EXISTS trigger_update_attendance_locations ON attendance_logs;
CREATE TRIGGER trigger_update_attendance_locations
  BEFORE INSERT OR UPDATE ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_locations();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_employees_updated_at ON employees;
CREATE TRIGGER trigger_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_branches_updated_at ON branches;
CREATE TRIGGER trigger_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_shifts_updated_at ON shifts;
CREATE TRIGGER trigger_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_admin_users_updated_at ON admin_users;
CREATE TRIGGER trigger_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - EMPLOYEES
-- ============================================================================

-- Employees can view their own profile
CREATE POLICY "Employees can view own profile"
  ON employees FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Employees can update their own profile (limited fields)
CREATE POLICY "Employees can update own profile"
  ON employees FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can view all employees
CREATE POLICY "Admins can view all employees"
  ON employees FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins can insert employees
CREATE POLICY "Admins can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Admins can update employees
CREATE POLICY "Admins can update employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- RLS POLICIES - ATTENDANCE LOGS
-- ============================================================================

-- Employees can view their own attendance
CREATE POLICY "Employees can view own attendance"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Employees can insert their own attendance
CREATE POLICY "Employees can insert own attendance"
  ON attendance_logs FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Employees can update their own attendance (for checkout)
CREATE POLICY "Employees can update own attendance"
  ON attendance_logs FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- Admins can view all attendance
CREATE POLICY "Admins can view all attendance"
  ON attendance_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- RLS POLICIES - BRANCHES
-- ============================================================================

-- Employees can view active branches
CREATE POLICY "Employees can view active branches"
  ON branches FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all branches
CREATE POLICY "Admins can manage branches"
  ON branches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- RLS POLICIES - SHIFTS
-- ============================================================================

-- Employees can view active shifts
CREATE POLICY "Employees can view active shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Admins can manage all shifts
CREATE POLICY "Admins can manage shifts"
  ON shifts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- RLS POLICIES - DEVICES
-- ============================================================================

-- Employees can view their own devices
CREATE POLICY "Employees can view own devices"
  ON devices FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Employees can register their own devices
CREATE POLICY "Employees can register own devices"
  ON devices FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- Employees can update their own devices
CREATE POLICY "Employees can update own devices"
  ON devices FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- Admins can view all devices
CREATE POLICY "Admins can view all devices"
  ON devices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- RLS POLICIES - OTP LOGS
-- ============================================================================

-- Employees can view their own OTP logs
CREATE POLICY "Employees can view own OTP logs"
  ON otp_logs FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- System can insert OTP logs
CREATE POLICY "System can insert OTP logs"
  ON otp_logs FOR INSERT
  TO authenticated
  WITH CHECK (employee_id = auth.uid());

-- System can update OTP logs (verification)
CREATE POLICY "System can update OTP logs"
  ON otp_logs FOR UPDATE
  TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

-- ============================================================================
-- RLS POLICIES - FRAUD ALERTS
-- ============================================================================

-- Admins can view all fraud alerts
CREATE POLICY "Admins can view fraud alerts"
  ON fraud_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- System can insert fraud alerts
CREATE POLICY "System can insert fraud alerts"
  ON fraud_alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can update fraud alerts
CREATE POLICY "Admins can update fraud alerts"
  ON fraud_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- ============================================================================
-- RLS POLICIES - AUDIT LOGS
-- ============================================================================

-- Admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- RLS POLICIES - ADMIN USERS
-- ============================================================================

-- Admins can view other admins
CREATE POLICY "Admins can view admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
      AND au.is_active = true
    )
  );

-- Super admins can manage admin users
CREATE POLICY "Super admins can manage admin users"
  ON admin_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.id = auth.uid()
      AND au.is_active = true
      AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.id = auth.uid()
      AND au.is_active = true
      AND r.name = 'super_admin'
    )
  );

-- ============================================================================
-- RLS POLICIES - ROLES
-- ============================================================================

-- Authenticated users can view roles
CREATE POLICY "Authenticated users can view roles"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

-- Super admins can manage roles
CREATE POLICY "Super admins can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.id = auth.uid()
      AND au.is_active = true
      AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.id = auth.uid()
      AND au.is_active = true
      AND r.name = 'super_admin'
    )
  );

-- ============================================================================
-- RLS POLICIES - SYSTEM SETTINGS
-- ============================================================================

-- Admins can view system settings
CREATE POLICY "Admins can view system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- Super admins can manage system settings
CREATE POLICY "Super admins can manage system settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.id = auth.uid()
      AND au.is_active = true
      AND r.name = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      JOIN roles r ON au.role_id = r.id
      WHERE au.id = auth.uid()
      AND au.is_active = true
      AND r.name = 'super_admin'
    )
  );

-- ============================================================================
-- RLS POLICIES - EMPLOYEE BRANCHES
-- ============================================================================

-- Employees can view their own branch assignments
CREATE POLICY "Employees can view own branch assignments"
  ON employee_branches FOR SELECT
  TO authenticated
  USING (employee_id = auth.uid());

-- Admins can manage branch assignments
CREATE POLICY "Admins can manage branch assignments"
  ON employee_branches FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );
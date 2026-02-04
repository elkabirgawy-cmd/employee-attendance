/*
  # Seed Initial Data
  
  ## Overview
  Populates the database with essential initial data including roles,
  system settings, and default configurations.
  
  ## Data Inserted
  
  ### 1. Roles
  - Super Admin (full system access)
  - HR Manager (employee and attendance management)
  - Branch Manager (branch-specific management)
  - Viewer (read-only access)
  
  ### 2. System Settings
  - OTP configuration
  - GPS accuracy thresholds
  - Fraud detection settings
  - Default working hours
  
  ## Notes
  - All data uses IF NOT EXISTS patterns to be idempotent
  - Default passwords should be changed on first login
  - Settings can be modified via admin panel
*/

-- ============================================================================
-- SEED: Roles
-- ============================================================================

INSERT INTO roles (name, description, permissions)
VALUES
  (
    'super_admin',
    'Super Administrator with full system access',
    '{
      "employees": {"create": true, "read": true, "update": true, "delete": true},
      "branches": {"create": true, "read": true, "update": true, "delete": true},
      "shifts": {"create": true, "read": true, "update": true, "delete": true},
      "attendance": {"create": true, "read": true, "update": true, "delete": true},
      "reports": {"create": true, "read": true, "export": true},
      "settings": {"read": true, "update": true},
      "admins": {"create": true, "read": true, "update": true, "delete": true},
      "audit_logs": {"read": true}
    }'::jsonb
  ),
  (
    'hr_manager',
    'HR Manager with employee and attendance management access',
    '{
      "employees": {"create": true, "read": true, "update": true, "delete": false},
      "branches": {"create": false, "read": true, "update": false, "delete": false},
      "shifts": {"create": true, "read": true, "update": true, "delete": false},
      "attendance": {"create": false, "read": true, "update": true, "delete": false},
      "reports": {"create": true, "read": true, "export": true},
      "settings": {"read": true, "update": false},
      "admins": {"create": false, "read": true, "update": false, "delete": false},
      "audit_logs": {"read": true}
    }'::jsonb
  ),
  (
    'branch_manager',
    'Branch Manager with branch-specific access',
    '{
      "employees": {"create": false, "read": true, "update": false, "delete": false},
      "branches": {"create": false, "read": true, "update": false, "delete": false},
      "shifts": {"create": false, "read": true, "update": false, "delete": false},
      "attendance": {"create": false, "read": true, "update": false, "delete": false},
      "reports": {"create": true, "read": true, "export": true},
      "settings": {"read": true, "update": false},
      "admins": {"create": false, "read": false, "update": false, "delete": false},
      "audit_logs": {"read": false}
    }'::jsonb
  ),
  (
    'viewer',
    'Read-only access to reports and attendance',
    '{
      "employees": {"create": false, "read": true, "update": false, "delete": false},
      "branches": {"create": false, "read": true, "update": false, "delete": false},
      "shifts": {"create": false, "read": true, "update": false, "delete": false},
      "attendance": {"create": false, "read": true, "update": false, "delete": false},
      "reports": {"create": false, "read": true, "export": false},
      "settings": {"read": false, "update": false},
      "admins": {"create": false, "read": false, "update": false, "delete": false},
      "audit_logs": {"read": false}
    }'::jsonb
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED: System Settings
-- ============================================================================

INSERT INTO system_settings (key, value, description)
VALUES
  (
    'otp_settings',
    '{
      "length": 6,
      "expiry_minutes": 5,
      "max_attempts": 3,
      "delivery_method": "sms",
      "fallback_method": "email",
      "rate_limit_per_hour": 5
    }'::jsonb,
    'OTP generation and verification settings'
  ),
  (
    'gps_settings',
    '{
      "max_accuracy_meters": 50,
      "min_accuracy_meters": 5,
      "warning_accuracy_meters": 30,
      "enable_fake_gps_detection": true,
      "require_high_accuracy": true
    }'::jsonb,
    'GPS accuracy and validation thresholds'
  ),
  (
    'fraud_detection',
    '{
      "detect_rooted_devices": true,
      "detect_fake_gps": true,
      "detect_time_manipulation": true,
      "block_suspicious_devices": false,
      "alert_on_poor_gps": true,
      "max_distance_jump_meters": 1000,
      "min_time_between_actions_seconds": 60
    }'::jsonb,
    'Fraud detection and prevention settings'
  ),
  (
    'working_hours',
    '{
      "standard_hours_per_day": 8,
      "standard_hours_per_week": 40,
      "overtime_threshold_hours": 8,
      "break_time_minutes": 60,
      "minimum_shift_duration_hours": 4
    }'::jsonb,
    'Standard working hours configuration'
  ),
  (
    'attendance_rules',
    '{
      "allow_early_checkin_minutes": 30,
      "allow_late_checkin_minutes": 15,
      "require_checkout": true,
      "auto_checkout_after_hours": 12,
      "block_duplicate_checkin": true,
      "allow_manual_adjustments": true
    }'::jsonb,
    'Attendance rules and validations'
  ),
  (
    'notification_settings',
    '{
      "notify_on_late_arrival": true,
      "notify_on_early_leave": true,
      "notify_on_absence": true,
      "notify_on_fraud_alert": true,
      "admin_email": "admin@company.com",
      "sms_provider": "twilio"
    }'::jsonb,
    'Notification preferences for admins and employees'
  ),
  (
    'report_settings',
    '{
      "export_formats": ["excel", "pdf", "csv"],
      "include_gps_coordinates": true,
      "include_device_info": true,
      "default_date_range_days": 30,
      "max_export_records": 10000
    }'::jsonb,
    'Report generation and export settings'
  ),
  (
    'app_settings',
    '{
      "app_name": "GPS Attendance System",
      "default_language": "ar",
      "supported_languages": ["ar", "en"],
      "force_update_version": "1.0.0",
      "maintenance_mode": false,
      "support_email": "support@company.com",
      "support_phone": "+966500000000"
    }'::jsonb,
    'General application settings'
  )
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- SEED: Default Shift (Example)
-- ============================================================================

INSERT INTO shifts (name, start_time, end_time, grace_period_minutes, early_checkout_threshold_minutes, working_days)
VALUES
  (
    'Default Day Shift',
    '08:00:00',
    '17:00:00',
    15,
    30,
    '[1,2,3,4,5]'::jsonb
  ),
  (
    'Morning Shift',
    '06:00:00',
    '14:00:00',
    10,
    30,
    '[1,2,3,4,5]'::jsonb
  ),
  (
    'Evening Shift',
    '14:00:00',
    '22:00:00',
    10,
    30,
    '[1,2,3,4,5]'::jsonb
  ),
  (
    'Night Shift',
    '22:00:00',
    '06:00:00',
    15,
    30,
    '[1,2,3,4,5]'::jsonb
  )
ON CONFLICT DO NOTHING;
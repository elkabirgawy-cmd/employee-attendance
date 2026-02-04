/*
  # Add Timezone Policy Settings

  1. New Settings
    - `timezone_mode` - 'auto_gps' or 'fixed'
      - auto_gps: Use GPS-resolved timezone per session
      - fixed: Use admin-specified timezone for all operations
    - `fixed_timezone` - IANA timezone (e.g., 'Asia/Riyadh')
      - Only used when timezone_mode = 'fixed'

  2. Changes
    - Insert timezone_mode setting with default 'auto_gps'
    - Insert fixed_timezone setting with default 'Asia/Riyadh'
    - These settings control how the system handles timezones

  3. Behavior
    - auto_gps: System uses GPS-resolved timezone, falls back to cached/default only on failure
    - fixed: System uses the fixed_timezone for all displays and calculations
*/

-- Insert timezone_mode setting (default: auto_gps)
INSERT INTO system_settings (key, value, description)
VALUES (
  'timezone_mode',
  '"auto_gps"'::jsonb,
  'Timezone policy: "auto_gps" (GPS-based) or "fixed" (admin-specified)'
)
ON CONFLICT (key) DO NOTHING;

-- Insert fixed_timezone setting (default: Asia/Riyadh)
INSERT INTO system_settings (key, value, description)
VALUES (
  'fixed_timezone',
  '"Asia/Riyadh"'::jsonb,
  'Fixed timezone used when timezone_mode is "fixed"'
)
ON CONFLICT (key) DO NOTHING;

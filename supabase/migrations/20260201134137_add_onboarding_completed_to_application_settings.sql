/*
  # Add Onboarding Completion Tracking

  1. Changes
    - Add `onboarding_completed_at` timestamp to `application_settings` table
    - This field tracks when a company completed the onboarding process (created branch + employee)
    - Scoped by company_id, ensuring per-company isolation
    
  2. Behavior
    - NULL = onboarding not completed (show banner)
    - NOT NULL = onboarding completed (hide banner permanently)
    - Auto-set when company reaches Step 3 (branch + employee exist)
    
  3. Purpose
    - Replace localStorage-based dismissal with persistent DB flag
    - Ensure onboarding completion persists across devices, browsers, and sessions
    - Works for both existing and new companies
*/

-- Add onboarding_completed_at column to application_settings
ALTER TABLE application_settings
ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_application_settings_onboarding_completed
ON application_settings(company_id, onboarding_completed_at);

-- Add comment
COMMENT ON COLUMN application_settings.onboarding_completed_at IS 'Timestamp when the company completed initial onboarding (created first branch and employee). NULL means onboarding not completed yet.';

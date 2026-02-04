/*
  # Server-Side Auto Checkout System

  ## Overview
  This migration adds server-side auto checkout tables to handle auto checkout enforcement
  with proper recovery and cancellation tracking.

  ## New Tables

  ### 1. `auto_checkout_pending`
  Tracks pending auto checkout operations that will be executed by server
  - `id` (uuid, primary key)
  - `employee_id` (uuid, references employees)
  - `attendance_log_id` (uuid, references attendance_logs)
  - `reason` (text) - Why auto checkout started: 'GPS_BLOCKED' or 'OUTSIDE_BRANCH'
  - `ends_at` (timestamptz) - When the auto checkout should execute
  - `status` (text) - Current status: 'PENDING', 'CANCELLED', or 'DONE'
  - `created_at` (timestamptz) - When the pending entry was created
  - `cancelled_at` (timestamptz) - When it was cancelled (if applicable)
  - `done_at` (timestamptz) - When checkout was executed (if applicable)
  - `cancel_reason` (text) - Why it was cancelled: 'RECOVERED', 'RECOVERED_BEFORE_EXEC', etc.

  ### 2. `employee_location_heartbeat`
  Tracks employee location health in real-time for final gate checks
  - `employee_id` (uuid, primary key)
  - `attendance_log_id` (uuid) - Current attendance log
  - `last_seen_at` (timestamptz) - Last heartbeat timestamp
  - `in_branch` (boolean) - Is employee inside branch
  - `gps_ok` (boolean) - Is GPS working properly
  - `reason` (text) - Current warning reason if any

  ## Security
  - RLS enabled on both tables
  - Anon access allowed (edge functions handle authentication)
  - Service role can perform all operations (for server-side execution)

  ## Indexes
  - Index on pending status and ends_at for efficient scheduled job queries
  - Index on heartbeat employee_id and attendance_log_id for quick lookups
*/

-- Create auto_checkout_pending table
CREATE TABLE IF NOT EXISTS auto_checkout_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_log_id uuid NOT NULL REFERENCES attendance_logs(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('GPS_BLOCKED', 'OUTSIDE_BRANCH')),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CANCELLED', 'DONE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  done_at timestamptz,
  cancel_reason text,
  CONSTRAINT valid_cancelled_at CHECK (
    (status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR
    (status != 'CANCELLED' AND cancelled_at IS NULL)
  ),
  CONSTRAINT valid_done_at CHECK (
    (status = 'DONE' AND done_at IS NOT NULL) OR
    (status != 'DONE' AND done_at IS NULL)
  )
);

-- Create employee_location_heartbeat table
CREATE TABLE IF NOT EXISTS employee_location_heartbeat (
  employee_id uuid PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  attendance_log_id uuid REFERENCES attendance_logs(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  in_branch boolean NOT NULL DEFAULT false,
  gps_ok boolean NOT NULL DEFAULT false,
  reason text
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_auto_checkout_pending_status_ends_at 
  ON auto_checkout_pending(status, ends_at) 
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_auto_checkout_pending_employee 
  ON auto_checkout_pending(employee_id, attendance_log_id);

CREATE INDEX IF NOT EXISTS idx_employee_location_heartbeat_log 
  ON employee_location_heartbeat(attendance_log_id);

-- Enable RLS
ALTER TABLE auto_checkout_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_location_heartbeat ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auto_checkout_pending
-- Allow anon access (edge functions handle authentication)
CREATE POLICY "Allow anon access for auto checkout pending"
  ON auto_checkout_pending
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for employee_location_heartbeat
-- Allow anon access (edge functions handle authentication)
CREATE POLICY "Allow anon access for employee heartbeat"
  ON employee_location_heartbeat
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
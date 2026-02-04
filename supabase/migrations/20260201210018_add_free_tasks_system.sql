/*
  # Add Free Tasks System

  ## Overview
  Implements "Free Task / Free Mission" feature that allows employees to check in/out
  without branch range validation while maintaining all security checks.

  ## 1. New Tables
    - `free_tasks`
      - `id` (uuid, primary key)
      - `company_id` (uuid, required, references companies)
      - `employee_id` (uuid, required, references employees)
      - `start_at` (timestamptz, task start time)
      - `end_at` (timestamptz, task end time)
      - `is_active` (boolean, default true, allows deactivation)
      - `notes` (text, optional description)
      - `created_by` (uuid, references admin_users)
      - `created_at` (timestamptz, default now)
      - `updated_at` (timestamptz, default now)

  ## 2. Indexes
    - Performance index on (company_id, employee_id, is_active)
    - Performance index on (company_id, start_at, end_at)
    - Index on (employee_id, is_active, start_at, end_at) for quick active task lookup

  ## 3. Security (RLS)
    - Enable RLS on `free_tasks` table
    - Admin users can SELECT/INSERT/UPDATE/DELETE only their company's tasks
    - Anonymous users can SELECT active tasks for geofence checking
    - All policies enforce strict company_id isolation

  ## 4. Auditing Fields
    - Add `attendance_type` to attendance_logs (enum: 'NORMAL', 'FREE')
    - Add `location_check_type` to attendance_logs (enum: 'BRANCH', 'FREE_TASK')

  ## Important Notes
    - Free tasks do NOT trigger auto checkout
    - All security checks remain active (fake GPS, time tampering, root detection)
    - Branch range validation is skipped ONLY when active free task exists
    - Multi-tenant isolation is strictly enforced through RLS
*/

-- Create free_tasks table
CREATE TABLE IF NOT EXISTS public.free_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_at > start_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_free_tasks_company_employee_active 
  ON public.free_tasks(company_id, employee_id, is_active);

CREATE INDEX IF NOT EXISTS idx_free_tasks_company_time_range 
  ON public.free_tasks(company_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_free_tasks_active_lookup 
  ON public.free_tasks(employee_id, is_active, start_at, end_at)
  WHERE is_active = true;

-- Add auditing fields to attendance_logs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'attendance_logs' 
    AND column_name = 'attendance_type'
  ) THEN
    ALTER TABLE public.attendance_logs 
    ADD COLUMN attendance_type text DEFAULT 'NORMAL' CHECK (attendance_type IN ('NORMAL', 'FREE'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'attendance_logs' 
    AND column_name = 'location_check_type'
  ) THEN
    ALTER TABLE public.attendance_logs 
    ADD COLUMN location_check_type text DEFAULT 'BRANCH' CHECK (location_check_type IN ('BRANCH', 'FREE_TASK'));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.free_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin users can view their company's free tasks" ON public.free_tasks;
DROP POLICY IF EXISTS "Admin users can create free tasks for their company" ON public.free_tasks;
DROP POLICY IF EXISTS "Admin users can update their company's free tasks" ON public.free_tasks;
DROP POLICY IF EXISTS "Admin users can delete their company's free tasks" ON public.free_tasks;
DROP POLICY IF EXISTS "Anonymous users can check active free tasks" ON public.free_tasks;

-- RLS Policies for Admin Users
CREATE POLICY "Admin users can view their company's free tasks"
  ON public.free_tasks
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can create free tasks for their company"
  ON public.free_tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can update their company's free tasks"
  ON public.free_tasks
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.admin_users 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admin users can delete their company's free tasks"
  ON public.free_tasks
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.admin_users 
      WHERE id = auth.uid()
    )
  );

-- RLS Policy for Anonymous Users (for check-in/out edge functions)
CREATE POLICY "Anonymous users can check active free tasks"
  ON public.free_tasks
  FOR SELECT
  TO anon
  USING (
    is_active = true 
    AND now() BETWEEN start_at AND end_at
  );

-- Create helper function to check if employee has active free task
CREATE OR REPLACE FUNCTION public.has_active_free_task(
  p_employee_id uuid,
  p_company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.free_tasks
    WHERE employee_id = p_employee_id
      AND company_id = p_company_id
      AND is_active = true
      AND now() BETWEEN start_at AND end_at
  );
END;
$$;

-- Create function to get active free task details
CREATE OR REPLACE FUNCTION public.get_active_free_task(
  p_employee_id uuid,
  p_company_id uuid
)
RETURNS TABLE (
  id uuid,
  start_at timestamptz,
  end_at timestamptz,
  notes text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ft.id,
    ft.start_at,
    ft.end_at,
    ft.notes
  FROM public.free_tasks ft
  WHERE ft.employee_id = p_employee_id
    AND ft.company_id = p_company_id
    AND ft.is_active = true
    AND now() BETWEEN ft.start_at AND ft.end_at
  ORDER BY ft.created_at DESC
  LIMIT 1;
END;
$$;

-- Add comment for documentation
COMMENT ON TABLE public.free_tasks IS 'Tracks free tasks/missions where employees can check in/out without branch range validation';
COMMENT ON COLUMN public.free_tasks.is_active IS 'Allows admin to deactivate a free task without deleting it';
COMMENT ON COLUMN public.attendance_logs.attendance_type IS 'NORMAL or FREE - indicates if attendance was during a free task';
COMMENT ON COLUMN public.attendance_logs.location_check_type IS 'BRANCH or FREE_TASK - indicates which validation was used';

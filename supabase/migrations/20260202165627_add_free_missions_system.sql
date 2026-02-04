/*
  # Add Free Missions System

  1. New Table
    - `free_missions` - Allows employees to work outside their assigned branch
      - `id` (uuid, primary key)
      - `company_id` (uuid, not null) - Multi-tenant isolation
      - `employee_id` (uuid, not null) - FK to employees
      - `date` (date, not null) - Mission date
      - `mode` (text) - 'free' (no geofence) or 'pinned' (specific location)
      - `pinned_lat` (double precision, nullable) - Latitude for pinned mode
      - `pinned_lng` (double precision, nullable) - Longitude for pinned mode
      - `radius_m` (int, nullable) - Geofence radius in meters for pinned mode
      - `status` (text) - 'active', 'ended', 'cancelled'
      - `created_at` (timestamptz) - When mission was created
      - `created_by` (uuid, nullable) - Admin who created the mission
      - `ended_at` (timestamptz, nullable) - When mission ended
      - `notes` (text, nullable) - Additional notes

  2. Security
    - Enable RLS
    - Admins can manage missions in their company
    - Anon can SELECT for employee check-in validation (via edge function)

  3. Indexes
    - Fast lookups by company + employee + date
    - Admin queries by company + date + status
*/

-- Create free_missions table
CREATE TABLE IF NOT EXISTS public.free_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  mode text NOT NULL CHECK (mode IN ('free', 'pinned')),
  pinned_lat double precision,
  pinned_lng double precision,
  radius_m integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ended_at timestamptz,
  notes text
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_free_missions_company_employee_date
  ON public.free_missions(company_id, employee_id, date);

CREATE INDEX IF NOT EXISTS idx_free_missions_company_date_status
  ON public.free_missions(company_id, date, status);

CREATE INDEX IF NOT EXISTS idx_free_missions_employee_date_status
  ON public.free_missions(employee_id, date, status);

-- Enable RLS
ALTER TABLE public.free_missions ENABLE ROW LEVEL SECURITY;

-- Admin policies (auth.uid() = admin_users.id which is FK to auth.users)
CREATE POLICY "Admins can view free missions in their company"
  ON public.free_missions
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can create free missions in their company"
  ON public.free_missions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can update free missions in their company"
  ON public.free_missions
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete free missions in their company"
  ON public.free_missions
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM public.admin_users
      WHERE id = auth.uid()
    )
  );

-- Allow anonymous access for employee check-in validation
-- Edge function will use this to check if employee has active mission
CREATE POLICY "Allow anon to read free missions for check-in validation"
  ON public.free_missions
  FOR SELECT
  TO anon
  USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.free_missions TO authenticated;
GRANT SELECT ON public.free_missions TO anon;

-- Add comment
COMMENT ON TABLE public.free_missions IS 'Free missions allow employees to check in/out outside their assigned branch with flexible geofence rules';

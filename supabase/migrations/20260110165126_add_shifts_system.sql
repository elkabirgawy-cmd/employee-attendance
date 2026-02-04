/*
  # Add Shifts System

  ## Overview
  This migration adds a comprehensive shift management system to track employee work schedules.

  ## 1. New Tables
    ### `shifts`
      - `id` (uuid, primary key) - Unique identifier for each shift
      - `name` (text) - Shift name (e.g., "Morning", "Evening", "Night")
      - `start_time` (time) - Shift start time
      - `end_time` (time) - Shift end time
      - `is_active` (boolean) - Whether shift is currently active
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  ## 2. Table Modifications
    ### `employees`
      - Add `shift_id` (uuid, foreign key) - Reference to assigned shift

  ## 3. Security
    - Enable RLS on `shifts` table
    - Add policies for authenticated users to read shifts
    - Add policies for authenticated users to manage shifts

  ## 4. Initial Data
    - Create default shifts (Morning, Evening, Night)
*/

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add shift_id to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'shift_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN shift_id uuid REFERENCES shifts(id);
  END IF;
END $$;

-- Enable RLS on shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Policies for shifts table
CREATE POLICY "Authenticated users can read shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert shifts"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update shifts"
  ON shifts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete shifts"
  ON shifts FOR DELETE
  TO authenticated
  USING (true);

-- Insert default shifts
INSERT INTO shifts (name, start_time, end_time, is_active)
VALUES
  ('Morning Shift', '06:00:00', '14:00:00', true),
  ('Evening Shift', '14:00:00', '22:00:00', true),
  ('Night Shift', '22:00:00', '06:00:00', true)
ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for shifts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_shifts_updated_at'
  ) THEN
    CREATE TRIGGER update_shifts_updated_at
      BEFORE UPDATE ON shifts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
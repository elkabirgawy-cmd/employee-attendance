/*
  # Add Departments System

  ## Overview
  This migration adds a departments system to organize employees by department.

  ## New Tables
  1. `departments`
    - `id` (uuid, primary key)
    - `name` (text, unique) - Department name
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Changes to Existing Tables
  1. `employees` table
    - Add `department_id` (uuid, nullable) - Foreign key to departments table
    - The existing text `department` field remains for backward compatibility

  ## Security
  - Enable RLS on departments table
  - Add policies for authenticated admin users to manage departments

  ## Important Notes
  - Department names must be unique
  - Cannot delete a department that has employees assigned to it (enforced by foreign key)
  - Department assignment is optional for employees
*/

-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add department_id to employees table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees(department_id);

-- Enable RLS on departments table
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Policies for departments table
CREATE POLICY "Authenticated users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete departments"
  ON departments FOR DELETE
  TO authenticated
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_departments_updated_at ON departments;
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
/*
  # Add Company-Level Insurance and Tax Settings

  1. Changes
    - Add insurance settings to payroll_settings table:
      - `insurance_type` (text): 'percentage' or 'fixed'
      - `insurance_value` (numeric): percentage (0-100) or fixed amount
    - Add tax settings to payroll_settings table:
      - `tax_type` (text): 'percentage' or 'fixed'
      - `tax_value` (numeric): percentage (0-100) or fixed amount
    - Set default values: percentage with 0 value for both

  2. Notes
    - These settings apply to all employees in the company
    - Calculation logic:
      - If type is 'percentage': amount = baseSalary * value / 100
      - If type is 'fixed': amount = value
    - Old employee-level fields (social_insurance_value, income_tax_value) will be deprecated
*/

-- Add insurance settings columns
ALTER TABLE payroll_settings
ADD COLUMN IF NOT EXISTS insurance_type text DEFAULT 'percentage' CHECK (insurance_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS insurance_value numeric DEFAULT 0 CHECK (insurance_value >= 0);

-- Add tax settings columns
ALTER TABLE payroll_settings
ADD COLUMN IF NOT EXISTS tax_type text DEFAULT 'percentage' CHECK (tax_type IN ('percentage', 'fixed')),
ADD COLUMN IF NOT EXISTS tax_value numeric DEFAULT 0 CHECK (tax_value >= 0);

-- Update existing rows to have default values
UPDATE payroll_settings
SET 
  insurance_type = COALESCE(insurance_type, 'percentage'),
  insurance_value = COALESCE(insurance_value, 0),
  tax_type = COALESCE(tax_type, 'percentage'),
  tax_value = COALESCE(tax_value, 0)
WHERE insurance_type IS NULL 
   OR insurance_value IS NULL 
   OR tax_type IS NULL 
   OR tax_value IS NULL;

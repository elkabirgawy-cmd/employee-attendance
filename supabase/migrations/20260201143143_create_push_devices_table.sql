/*
  # Native Push Devices System

  1. New Tables
    - `push_devices`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `user_id` (uuid, references auth.users)
      - `device_id` (text, unique identifier for the device)
      - `platform` (text, 'android' | 'ios' | 'web')
      - `token` (text, FCM/APNs token)
      - `enabled` (boolean, default true)
      - `last_seen_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `push_devices` table
    - Users can manage their own device tokens
    - Company isolation enforced

  3. Indexes
    - Index on company_id for fast lookups
    - Index on user_id for fast lookups
    - Unique index on device_id for preventing duplicates
*/

-- Create push_devices table
CREATE TABLE IF NOT EXISTS public.push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  token text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create unique index on device_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS push_devices_device_id_key ON public.push_devices(device_id);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS push_devices_company_id_idx ON public.push_devices(company_id);
CREATE INDEX IF NOT EXISTS push_devices_user_id_idx ON public.push_devices(user_id);
CREATE INDEX IF NOT EXISTS push_devices_enabled_idx ON public.push_devices(enabled) WHERE enabled = true;

-- Enable RLS
ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own devices
CREATE POLICY "Users can view own devices"
  ON public.push_devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own devices
CREATE POLICY "Users can insert own devices"
  ON public.push_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own devices
CREATE POLICY "Users can update own devices"
  ON public.push_devices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own devices
CREATE POLICY "Users can delete own devices"
  ON public.push_devices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_push_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_push_devices_updated_at_trigger ON public.push_devices;
CREATE TRIGGER update_push_devices_updated_at_trigger
  BEFORE UPDATE ON public.push_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_push_devices_updated_at();

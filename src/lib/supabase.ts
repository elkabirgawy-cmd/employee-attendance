import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Log Supabase configuration for debugging (server logs only)
console.log('[SUPABASE CONFIG]', {
  url: supabaseUrl,
  anonKeyLast6: supabaseAnonKey.slice(-6),
  timestamp: new Date().toISOString()
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          employee_code: string;
          full_name: string;
          email: string;
          phone: string;
          branch_id: string | null;
          shift_id: string | null;
          job_title: string | null;
          department: string | null;
          hire_date: string;
          is_active: boolean;
          allow_multiple_locations: boolean;
          require_gps: boolean;
          profile_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      branches: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          geofence_radius: number;
          timezone: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      attendance_logs: {
        Row: {
          id: string;
          employee_id: string;
          branch_id: string | null;
          device_id: string | null;
          check_in_time: string | null;
          check_in_device_time: string | null;
          check_in_latitude: number | null;
          check_in_longitude: number | null;
          check_in_accuracy: number | null;
          check_in_ip_address: string | null;
          check_out_time: string | null;
          check_out_device_time: string | null;
          check_out_latitude: number | null;
          check_out_longitude: number | null;
          check_out_accuracy: number | null;
          check_out_ip_address: string | null;
          total_working_hours: number | null;
          status: string | null;
          is_synced: boolean;
          sync_time: string | null;
          notes: string | null;
          created_at: string;
        };
      };
    };
  };
};

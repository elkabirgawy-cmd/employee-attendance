/**
 * Shared service for absent employees to ensure count and list use EXACTLY the same query
 */

import { supabase } from '../lib/supabase';

export interface AbsentEmployee {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  branch_name: string;
  shift_name: string;
  shift_start_time: string;
  minutes_late: number;
}

export interface AbsentEmployeesResult {
  count: number;
  employees: AbsentEmployee[];
  error: string | null;
}

/**
 * Get absent employees for today - single source of truth
 * This function is used by BOTH the dashboard card count AND the modal list
 * to ensure they always show the same data.
 */
export async function getAbsentEmployeesToday(
  companyId: string,
  date?: string
): Promise<AbsentEmployeesResult> {
  if (!companyId) {
    return {
      count: 0,
      employees: [],
      error: 'Company ID is required'
    };
  }

  const today = date || new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabase.rpc('get_absent_employees_list', {
      p_day: today,
      p_company_id: companyId
    });

    if (error) {
      console.error('[absentEmployeesService] Error fetching absent employees:', {
        companyId,
        date: today,
        error: error.message,
        details: error.details,
        hint: error.hint
      });

      return {
        count: 0,
        employees: [],
        error: error.message
      };
    }

    const employees = data || [];

    // Admin-only debug logging when data is fetched
    if (process.env.NODE_ENV === 'development') {
      console.log('[absentEmployeesService] Fetched absent employees:', {
        companyId,
        date: today,
        startOfDayISO: `${today}T00:00:00Z`,
        endOfDayISO: `${today}T23:59:59Z`,
        returnedCount: employees.length,
        firstThreeEmployeeIds: employees.slice(0, 3).map((e: AbsentEmployee) => e.employee_id),
        allEmployeeIds: employees.map((e: AbsentEmployee) => e.employee_id)
      });
    }

    return {
      count: employees.length,
      employees,
      error: null
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[absentEmployeesService] Exception fetching absent employees:', {
      companyId,
      date: today,
      error: errorMessage
    });

    return {
      count: 0,
      employees: [],
      error: errorMessage
    };
  }
}

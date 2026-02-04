import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface OnboardingProgress {
  step: 1 | 2 | 3;
  progressPct: number;
  branchesCount: number;
  employeesCount: number;
  completed: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

export function useOnboardingProgress(companyId: string | null): OnboardingProgress {
  const [branchesCount, setBranchesCount] = useState(0);
  const [employeesCount, setEmployeesCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCounts = async () => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    try {
      const [branchesResult, employeesResult, settingsResult] = await Promise.all([
        supabase
          .from('branches')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId),
        supabase
          .from('employees')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId),
        supabase
          .from('application_settings')
          .select('onboarding_completed_at')
          .eq('company_id', companyId)
          .maybeSingle()
      ]);

      const branchCount = branchesResult.count || 0;
      const employeeCount = employeesResult.count || 0;
      const isCompleted = settingsResult.data?.onboarding_completed_at != null;

      setBranchesCount(branchCount);
      setEmployeesCount(employeeCount);
      setCompleted(isCompleted);

      if (!isCompleted && branchCount > 0 && employeeCount > 0) {
        await markAsCompleted();
      }
    } catch (error) {
      console.error('Error fetching onboarding counts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsCompleted = async () => {
    if (!companyId) return;

    try {
      const { error } = await supabase
        .from('application_settings')
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq('company_id', companyId);

      if (error) throw error;

      setCompleted(true);
    } catch (error) {
      console.error('Error marking onboarding as completed:', error);
    }
  };

  useEffect(() => {
    if (!companyId) return;

    fetchCounts();

    const branchesChannel = supabase
      .channel(`branches_count_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branches',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    const employeesChannel = supabase
      .channel(`employees_count_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employees',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          fetchCounts();
        }
      )
      .subscribe();

    return () => {
      branchesChannel.unsubscribe();
      employeesChannel.unsubscribe();
    };
  }, [companyId]);

  let step: 1 | 2 | 3;
  let progressPct: number;

  if (branchesCount === 0) {
    step = 1;
    progressPct = 0;
  } else if (employeesCount === 0) {
    step = 2;
    progressPct = 33;
  } else {
    step = 3;
    progressPct = 100;
  }

  return {
    step,
    progressPct,
    branchesCount,
    employeesCount,
    completed,
    isLoading,
    refetch: fetchCounts
  };
}

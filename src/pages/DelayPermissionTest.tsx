import { useState } from 'react';
import { supabase } from '../lib/supabase';

interface TestResult {
  step: string;
  ok: boolean;
  error?: string;
  details?: any;
}

export default function DelayPermissionTest() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  async function runE2ETest() {
    setRunning(true);
    setResults([]);
    const testResults: TestResult[] = [];

    async function addResult(step: string, ok: boolean, error?: string, details?: any) {
      const result = { step, ok, error, details };
      testResults.push(result);
      setResults([...testResults]);

      await supabase.from('delay_permission_debug_logs').insert({
        step,
        ok,
        error_message: error || null,
        user_id: details?.user_id || null,
        company_id: details?.company_id || null,
        employee_id: details?.employee_id || null,
        details
      });
    }

    try {
      // Step 1: Check session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        await addResult('Get Session', false, sessionError?.message || 'No session found');

        // Try refresh
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !refreshedSession) {
          await addResult('Refresh Session', false, refreshError?.message || 'Refresh failed');
          setRunning(false);
          return;
        }

        await addResult('Refresh Session', true, undefined, { user_id: refreshedSession.user.id });
      } else {
        await addResult('Get Session', true, undefined, { user_id: session.user.id });
      }

      // Step 2: Get current session (after refresh if needed)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        await addResult('Final Session Check', false, 'No session after refresh');
        setRunning(false);
        return;
      }

      const userId = currentSession.user.id;
      await addResult('Extract User ID', true, undefined, { user_id: userId });

      // Step 3: Get employee by user_id
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id, company_id, full_name, user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (empError || !employee) {
        await addResult('Get Employee by user_id', false, empError?.message || 'Employee not found', { user_id: userId });
        setRunning(false);
        return;
      }

      await addResult('Get Employee', true, undefined, {
        user_id: userId,
        employee_id: employee.id,
        company_id: employee.company_id
      });

      // Step 4: INSERT delay permission
      const testDate = new Date().toISOString().split('T')[0];
      const insertPayload = {
        company_id: employee.company_id,
        employee_id: employee.id,
        date: testDate,
        start_time: '09:00',
        end_time: '09:30',
        minutes: 30,
        reason: 'E2E Test - ' + new Date().toISOString(),
        status: 'pending',
        is_test: true
      };

      const { data: inserted, error: insertError } = await supabase
        .from('delay_permissions')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        await addResult('INSERT delay_permission', false, insertError.message, {
          user_id: userId,
          employee_id: employee.id,
          company_id: employee.company_id,
          payload: insertPayload,
          error_code: insertError.code
        });
        setRunning(false);
        return;
      }

      await addResult('INSERT delay_permission', true, undefined, {
        id: inserted.id,
        user_id: userId,
        employee_id: employee.id,
        company_id: employee.company_id
      });

      // Step 5: SELECT to verify
      const { data: verified, error: selectError } = await supabase
        .from('delay_permissions')
        .select('*')
        .eq('id', inserted.id)
        .single();

      if (selectError) {
        await addResult('SELECT verify', false, selectError.message);
      } else {
        await addResult('SELECT verify', true, undefined, { id: verified.id });
      }

      // Step 6: DELETE test record
      const { error: deleteError } = await supabase
        .from('delay_permissions')
        .delete()
        .eq('id', inserted.id);

      if (deleteError) {
        await addResult('DELETE cleanup', false, deleteError.message);
      } else {
        await addResult('DELETE cleanup', true);
      }

      // Step 7: Environment info
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'unknown';

      await addResult('Environment Info', true, undefined, {
        supabase_url: supabaseUrl,
        project_ref: projectRef
      });

    } catch (error: any) {
      await addResult('Unexpected Error', false, error.message);
    }

    setRunning(false);
  }

  const allPassed = results.length > 0 && results.every(r => r.ok);
  const anyFailed = results.some(r => !r.ok);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Delay Permission E2E Test</h1>

      <button
        onClick={runE2ETest}
        disabled={running}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: running ? '#ccc' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: running ? 'not-allowed' : 'pointer',
          marginBottom: '20px'
        }}
      >
        {running ? 'Running...' : 'Run E2E Test'}
      </button>

      {results.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            padding: '16px',
            backgroundColor: allPassed ? '#10b981' : anyFailed ? '#ef4444' : '#f3f4f6',
            color: allPassed || anyFailed ? 'white' : 'black',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            {allPassed ? '✅ ALL TESTS PASSED' : anyFailed ? '❌ SOME TESTS FAILED' : 'Running...'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {results.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: '16px',
                  backgroundColor: result.ok ? '#ecfdf5' : '#fef2f2',
                  border: `2px solid ${result.ok ? '#10b981' : '#ef4444'}`,
                  borderRadius: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{result.ok ? '✅' : '❌'}</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{result.step}</span>
                </div>

                {result.error && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#fee2e2',
                    borderRadius: '4px',
                    marginTop: '8px',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}>
                    <strong>Error:</strong> {result.error}
                  </div>
                )}

                {result.details && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '14px', color: '#6b7280' }}>
                      Details
                    </summary>
                    <pre style={{
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

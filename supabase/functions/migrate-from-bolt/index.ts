import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MigrationStats {
  table: string;
  rows: number;
  status: 'success' | 'error';
  message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Get source database URL from Supabase secrets
    const sourceDatabaseUrl = Deno.env.get('SOURCE_DATABASE_URL');
    if (!sourceDatabaseUrl) {
      throw new Error('SOURCE_DATABASE_URL secret not configured');
    }

    // Get destination database URL (current Supabase project)
    const destDatabaseUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!destDatabaseUrl) {
      throw new Error('SUPABASE_DB_URL not available');
    }

    console.log('Connecting to source database...');
    const sourceDb = postgres(sourceDatabaseUrl, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10
    });

    console.log('Connecting to destination database...');
    const destDb = postgres(destDatabaseUrl, {
      ssl: 'require',
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10
    });

    const stats: MigrationStats[] = [];

    // Migration order based on foreign key dependencies
    const migrationOrder = [
      'admin_users',
      'branches',
      'shifts',
      'employees',
      'activation_codes',
      'employee_logins',
      'attendance_logs',
      'auto_checkout_settings',
      'time_sync_logs',
      'auto_checkout_pending',
      'generated_reports',
      'payroll_records',
      'leave_types',
      'leave_requests',
      'leave_balances',
      'timezone_detection_logs',
      'timezone_policy_settings',
      'push_notification_tokens',
      'push_notifications',
      'application_settings',
      'device_approvals',
      'fraud_alerts'
    ];

    for (const tableName of migrationOrder) {
      try {
        console.log(`\nMigrating table: ${tableName}`);

        // Check if table exists in source
        const tableExists = await sourceDb`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ${tableName}
          )
        `;

        if (!tableExists[0].exists) {
          console.log(`Table ${tableName} does not exist in source, skipping`);
          stats.push({
            table: tableName,
            rows: 0,
            status: 'success',
            message: 'Table does not exist in source'
          });
          continue;
        }

        // Fetch all data from source
        const sourceData = await sourceDb`
          SELECT * FROM ${sourceDb(tableName)}
        `;

        if (sourceData.length === 0) {
          console.log(`Table ${tableName} is empty, skipping`);
          stats.push({
            table: tableName,
            rows: 0,
            status: 'success',
            message: 'Table is empty'
          });
          continue;
        }

        // Get column names from first row
        const columns = Object.keys(sourceData[0]);

        // Disable triggers temporarily for this table
        await destDb`ALTER TABLE ${destDb(tableName)} DISABLE TRIGGER ALL`;

        let insertedCount = 0;

        // Insert data in batches of 100
        const batchSize = 100;
        for (let i = 0; i < sourceData.length; i += batchSize) {
          const batch = sourceData.slice(i, i + batchSize);

          // Build insert query with ON CONFLICT handling
          for (const row of batch) {
            try {
              // Convert row to values array matching column order
              const values = columns.map(col => row[col]);

              // Build the insert statement
              const columnsStr = columns.join(', ');
              const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(', ');

              // Determine conflict target (primary key)
              let conflictTarget = 'id';
              if (tableName === 'admin_users' || tableName === 'employee_logins') {
                conflictTarget = 'id';
              }

              await destDb.unsafe(`
                INSERT INTO ${tableName} (${columnsStr})
                VALUES (${placeholders})
                ON CONFLICT (${conflictTarget})
                DO UPDATE SET ${columns.map(col => `${col} = EXCLUDED.${col}`).join(', ')}
              `, values);

              insertedCount++;
            } catch (error) {
              console.error(`Error inserting row in ${tableName}:`, error);
              // Continue with next row
            }
          }
        }

        // Re-enable triggers
        await destDb`ALTER TABLE ${destDb(tableName)} ENABLE TRIGGER ALL`;

        // Update sequences for tables with id columns
        if (columns.includes('id')) {
          try {
            await destDb.unsafe(`
              SELECT setval(
                pg_get_serial_sequence('${tableName}', 'id'),
                COALESCE((SELECT MAX(id) FROM ${tableName}), 1),
                true
              )
            `);
          } catch (error) {
            console.log(`Could not update sequence for ${tableName}:`, error);
          }
        }

        stats.push({
          table: tableName,
          rows: insertedCount,
          status: 'success',
          message: `Migrated ${insertedCount} rows`
        });

        console.log(`✓ Completed ${tableName}: ${insertedCount} rows`);

      } catch (error) {
        console.error(`✗ Error migrating ${tableName}:`, error);
        stats.push({
          table: tableName,
          rows: 0,
          status: 'error',
          message: error.message
        });
      }
    }

    // Close connections
    await sourceDb.end();
    await destDb.end();

    const totalRows = stats.reduce((sum, s) => sum + s.rows, 0);
    const successCount = stats.filter(s => s.status === 'success').length;
    const errorCount = stats.filter(s => s.status === 'error').length;

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          totalTables: migrationOrder.length,
          successfulTables: successCount,
          failedTables: errorCount,
          totalRowsMigrated: totalRows
        },
        details: stats
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Migration failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

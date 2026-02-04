# Bolt to Supabase Migration Guide
## Server-Side Automated Migration (No Local Commands Required)

This guide provides a **ONE-CLICK SERVER-SIDE MIGRATION** from your Bolt-managed PostgreSQL database to your own Supabase project.

---

## Prerequisites

You need:
1. ✅ **New Supabase project created** (with empty database or schema already applied)
2. ✅ **Bolt PostgreSQL connection string** (from Bolt dashboard)
3. ✅ **Supabase Service Role Key** (from your new project)

---

## Step 1: Gather Required Credentials

### A) Get Bolt Database Connection String

From your Bolt project dashboard, locate the PostgreSQL connection string. It looks like:
```
postgresql://user:password@host:5432/database?sslmode=require
```

Or in URL format:
```
postgres://user:password@host.supabase.co:5432/postgres
```

### B) Get Your New Supabase Credentials

From your Supabase Dashboard → Settings:

1. **Project URL**: Settings → API
   ```
   https://YOUR_PROJECT_REF.supabase.co
   ```

2. **Anon Key**: Settings → API → Project API keys → `anon` `public`
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Service Role Key**: Settings → API → Project API keys → `service_role` (⚠️ Keep secret!)
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

4. **Database Connection String**: Settings → Database → Connection string → Transaction mode
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

---

## Step 2: Configure Supabase Secrets (Secure Storage)

**IMPORTANT**: Never put service role keys or database credentials in your client code or .env files that go to the browser.

### Set the Source Database URL as a Supabase Secret

In your Supabase Dashboard:

1. Go to **Settings** → **Edge Functions** → **Secrets**
2. Click **Add new secret**
3. Name: `SOURCE_DATABASE_URL`
4. Value: Paste your Bolt PostgreSQL connection string
5. Click **Save**

Example value:
```
postgresql://user:password@bolt-db-host.com:5432/your_database?sslmode=require
```

**Note**: The destination database URL (`SUPABASE_DB_URL`) is automatically available in Edge Functions.

---

## Step 3: Apply Schema to New Supabase Project

Before migrating data, ensure your new Supabase database has the same schema.

### Option A: Use Bolt's Built-in Deploy Feature

If Bolt can deploy directly to Supabase:
1. In Bolt, link your new Supabase project credentials
2. Deploy/push the schema

### Option B: Manual Schema Application (Via Supabase Dashboard)

1. Go to your Supabase Dashboard → **SQL Editor**
2. Run each migration file from `supabase/migrations/` in order (by timestamp):
   - Start with `20260110142819_create_core_tables.sql`
   - Run each subsequent migration file
   - End with the most recent migration

**Total**: 44 migration files to run sequentially.

**Tip**: You can concatenate all migration files into one large SQL script and run it once.

---

## Step 4: Run the Migration Edge Function

### Method 1: Via Supabase Dashboard (Easiest)

1. Go to **Edge Functions** tab in your Supabase Dashboard
2. Find the function: `migrate-from-bolt`
3. Click **Invoke Function**
4. Method: POST
5. Body: `{}`
6. Click **Run**

**Expected Time**: 2-5 minutes depending on data size

### Method 2: Via API Call (Using Postman/Thunder Client/Curl)

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/migrate-from-bolt' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

Replace:
- `YOUR_PROJECT_REF` with your actual project reference
- `YOUR_SERVICE_ROLE_KEY` with your service role key

### Method 3: Create a Simple HTML Page (One-Click)

Create a file `migrate.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Database Migration</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
    button { background: #10b981; color: white; border: none; padding: 15px 30px;
             font-size: 18px; border-radius: 8px; cursor: pointer; }
    button:hover { background: #059669; }
    button:disabled { background: #9ca3af; cursor: not-allowed; }
    pre { background: #f3f4f6; padding: 15px; border-radius: 8px; overflow-x: auto; }
    .success { color: #10b981; }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <h1>🚀 Bolt to Supabase Migration</h1>

  <div>
    <label>Supabase Project URL:</label><br>
    <input type="text" id="projectUrl" placeholder="https://xxxxx.supabase.co" style="width: 100%; padding: 8px; margin: 10px 0;">
  </div>

  <div>
    <label>Service Role Key:</label><br>
    <input type="password" id="serviceKey" placeholder="eyJhbGc..." style="width: 100%; padding: 8px; margin: 10px 0;">
  </div>

  <button id="migrateBtn" onclick="runMigration()">Start Migration</button>

  <div id="status" style="margin-top: 20px;"></div>
  <pre id="result" style="margin-top: 20px; display: none;"></pre>

  <script>
    async function runMigration() {
      const btn = document.getElementById('migrateBtn');
      const status = document.getElementById('status');
      const result = document.getElementById('result');
      const projectUrl = document.getElementById('projectUrl').value.trim();
      const serviceKey = document.getElementById('serviceKey').value.trim();

      if (!projectUrl || !serviceKey) {
        alert('Please fill in both fields');
        return;
      }

      btn.disabled = true;
      status.innerHTML = '⏳ Migration in progress... This may take 2-5 minutes...';
      result.style.display = 'none';

      try {
        const response = await fetch(`${projectUrl}/functions/v1/migrate-from-bolt`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (data.success) {
          status.innerHTML = `<span class="success">✅ Migration Completed Successfully!</span>`;
          result.textContent = JSON.stringify(data, null, 2);
          result.style.display = 'block';
        } else {
          status.innerHTML = `<span class="error">❌ Migration Failed</span>`;
          result.textContent = JSON.stringify(data, null, 2);
          result.style.display = 'block';
        }
      } catch (error) {
        status.innerHTML = `<span class="error">❌ Error: ${error.message}</span>`;
      } finally {
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>
```

Open this HTML file in your browser, enter your credentials, and click "Start Migration".

---

## Step 5: Verification Queries

After migration completes, run these SQL queries in your Supabase SQL Editor to verify:

### A) Row Count Verification

```sql
-- Count rows in all tables
SELECT
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### B) Verify Core Tables

```sql
-- Check admin users
SELECT COUNT(*) as admin_count FROM admin_users;

-- Check employees
SELECT COUNT(*) as employee_count FROM employees;

-- Check branches
SELECT COUNT(*) as branch_count FROM branches;

-- Check attendance logs
SELECT COUNT(*) as attendance_count FROM attendance_logs;

-- Check shifts
SELECT COUNT(*) as shift_count FROM shifts;
```

### C) Verify Foreign Key Constraints

```sql
-- List all foreign key constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
```

### D) Verify Indexes

```sql
-- List all indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### E) Verify RLS Policies

```sql
-- List all RLS policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

### F) Verify Database Functions

```sql
-- List all custom functions
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY function_name;
```

### G) Verify Triggers

```sql
-- List all triggers
SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation AS event,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

---

## Step 6: Update Application Configuration

After successful migration, update your application's `.env` file:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_new_anon_key
```

Replace with your new Supabase project credentials from Step 1B.

---

## Step 7: Deploy Edge Functions

Your application uses 12 Edge Functions. Deploy them to your new Supabase project:

### Via Supabase Dashboard

1. Go to **Edge Functions** tab
2. For each function, click **Deploy new function**
3. Upload the function code from `supabase/functions/[function-name]/index.ts`

**Functions to deploy**:
- `employee-activate`
- `employee-check-in`
- `employee-check-out`
- `employee-heartbeat`
- `employee-login`
- `employee-send-otp`
- `employee-verify-otp`
- `generate-report`
- `process-auto-checkout`
- `resolve-timezone`
- `send-push`
- `auto-checkout-enforcement`

---

## Step 8: Final Testing

Test critical application flows:

1. ✅ **Admin Login**: Can admin users log in?
2. ✅ **Employee Check-in**: Can employees check in?
3. ✅ **Employee Check-out**: Can employees check out?
4. ✅ **Reports**: Can you generate attendance reports?
5. ✅ **Leave Requests**: Can employees request leave?
6. ✅ **Payroll**: Can you view payroll records?

---

## Troubleshooting

### Issue: "SOURCE_DATABASE_URL secret not configured"

**Solution**: Make sure you added the `SOURCE_DATABASE_URL` secret in Supabase Dashboard → Settings → Edge Functions → Secrets.

### Issue: Migration times out

**Solution**:
- The Edge Function has a 10-minute timeout
- If your database is very large, consider breaking it into smaller batches
- Contact me to create a batch migration version

### Issue: "Permission denied" errors

**Solution**:
- Ensure you're using the **Service Role Key**, not the Anon Key
- Check that RLS policies are configured correctly in the new database

### Issue: Some tables have 0 rows after migration

**Solution**:
- Check the migration function response for specific table errors
- Some tables might be empty in the source database
- Verify the table exists in both source and destination

### Issue: Duplicate key violations

**Solution**:
- The migration uses `ON CONFLICT DO UPDATE` to handle duplicates
- If this fails, ensure primary key constraints are properly defined
- Check that sequences are updated correctly

---

## Migration Summary Checklist

- [ ] Gathered Bolt PostgreSQL connection string
- [ ] Created new Supabase project
- [ ] Added `SOURCE_DATABASE_URL` secret in Supabase
- [ ] Applied schema to new Supabase project (44 migrations)
- [ ] Ran migration Edge Function
- [ ] Verified row counts match
- [ ] Verified constraints and indexes
- [ ] Verified RLS policies
- [ ] Updated `.env` with new Supabase credentials
- [ ] Deployed all 12 Edge Functions
- [ ] Tested admin login
- [ ] Tested employee check-in/out
- [ ] Tested reports generation

---

## What Gets Migrated

✅ **Schema** (via migrations):
- All 22 tables with exact column definitions
- Primary keys, foreign keys, unique constraints
- Indexes for performance
- Check constraints and defaults
- RLS policies for security
- Database functions and triggers
- Sequences and auto-increment settings

✅ **Data** (via Edge Function):
- All rows from all tables
- Proper dependency order (foreign keys)
- Handles conflicts with upsert logic
- Updates sequences to match max IDs

✅ **Edge Functions**:
- All 12 serverless functions
- Shared utility code
- Function configurations

---

## Security Notes

🔒 **Service Role Key**:
- NEVER expose in client-side code
- NEVER commit to Git
- NEVER share publicly
- Only use server-side (Edge Functions, backend)

🔒 **SOURCE_DATABASE_URL**:
- Stored securely in Supabase Secrets
- Not accessible from client
- Only available in Edge Function runtime

🔒 **Connection Strings**:
- Always use SSL mode (`?sslmode=require`)
- Use connection pooling for production
- Rotate passwords periodically

---

## Cost Considerations

- Edge Function execution: ~2-5 minutes (well within free tier)
- Database operations: Billed per compute hour (minimal for migration)
- No additional costs for one-time migration

---

## Support

If you encounter issues:
1. Check the migration function response for detailed error messages
2. Run the verification queries to identify missing data
3. Check Supabase Edge Function logs for errors
4. Review foreign key dependencies if inserts fail

---

## Next Steps After Migration

1. ✅ Test all application features thoroughly
2. ✅ Set up database backups in Supabase Dashboard
3. ✅ Configure database connection pooling if needed
4. ✅ Monitor database performance
5. ✅ Decommission Bolt database once fully migrated

---

**You now have full ownership of your database! 🎉**

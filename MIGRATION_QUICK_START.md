# 🚀 Quick Start: Bolt to Supabase Migration

## ONE-CLICK Migration in 5 Minutes

### What You Need

1. **Bolt PostgreSQL Connection String**
   - Example: `postgresql://user:password@host:5432/database?sslmode=require`

2. **New Supabase Project** (already created)
   - Project URL: `https://xxxxx.supabase.co`
   - Service Role Key: `eyJhbGc...` (from Settings → API)

---

## 3-Step Migration Process

### ✅ Step 1: Add Secret to Supabase (2 minutes)

1. Open your **Supabase Dashboard**
2. Go to **Settings** → **Edge Functions** → **Secrets**
3. Click **Add new secret**
4. Set:
   - **Name**: `SOURCE_DATABASE_URL`
   - **Value**: Your Bolt PostgreSQL connection string
5. Click **Save**

---

### ✅ Step 2: Apply Schema (5 minutes)

**Option A - Via Bolt:**
- Link your new Supabase credentials in Bolt
- Deploy the schema

**Option B - Via Supabase SQL Editor:**
1. Go to **SQL Editor** in Supabase Dashboard
2. Copy ALL migration files from `supabase/migrations/`
3. Paste and run them in order

---

### ✅ Step 3: Run Migration (2 minutes)

**Open the migration tool:**
- Double-click `migrate-one-click.html` in your browser

**Fill in the form:**
- Supabase Project URL: `https://xxxxx.supabase.co`
- Service Role Key: Your `service_role` key

**Click "Start Migration"**

⏳ Wait 2-5 minutes for completion

---

## Verification (1 minute)

After migration, run this in **SQL Editor**:

```sql
SELECT
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Compare row counts with your Bolt database.

---

## Update App Configuration (1 minute)

Edit `.env` file:

```env
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_new_anon_key
```

---

## Deploy Edge Functions (Optional - 10 minutes)

If using Edge Functions, deploy via Supabase Dashboard:

**Functions to deploy:**
- employee-activate
- employee-check-in
- employee-check-out
- employee-login
- employee-send-otp
- employee-verify-otp
- generate-report
- process-auto-checkout
- send-push
- auto-checkout-enforcement

---

## Troubleshooting

### "SOURCE_DATABASE_URL not configured"
→ Make sure you added the secret in Step 1

### "Permission denied"
→ Use **Service Role Key**, not Anon Key

### Migration times out
→ Your database might be very large. Contact support for batch migration.

---

## Full Documentation

For detailed instructions, see: `BOLT_TO_SUPABASE_MIGRATION.md`

---

## Support

- Check Edge Function logs in Supabase Dashboard
- Review migration response for table-specific errors
- Verify schema was applied before data migration

---

**Total Time: ~10-15 minutes** ⚡

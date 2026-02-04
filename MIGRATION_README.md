# 🚀 Bolt to Supabase Migration Package

## What This Is

A complete **server-side migration solution** that transfers your Bolt PostgreSQL database to your own Supabase project **WITHOUT any local commands or CLI tools**.

## 📁 Files Included

### 🎯 Quick Start
- **`MIGRATION_QUICK_START.md`** - 5-minute setup guide
- **`migrate-one-click.html`** - Browser-based migration tool (RECOMMENDED)

### 📖 Comprehensive Guides
- **`BOLT_TO_SUPABASE_MIGRATION.md`** - Complete technical documentation
- **`MIGRATION_VERIFICATION.sql`** - Post-migration verification queries

### ⚙️ Server Components
- **`supabase/functions/migrate-from-bolt/`** - Edge Function (already deployed)

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Add Database Secret

1. Open **Supabase Dashboard** → Settings → Edge Functions → Secrets
2. Add new secret:
   - Name: `SOURCE_DATABASE_URL`
   - Value: Your Bolt PostgreSQL connection string

### Step 2: Apply Schema

In Supabase Dashboard → SQL Editor, run all files from `supabase/migrations/` in order.

### Step 3: Run Migration

1. Open **`migrate-one-click.html`** in your browser
2. Enter:
   - Your Supabase Project URL
   - Your Service Role Key
3. Click **Start Migration**
4. Wait 2-5 minutes

### Step 4: Verify

In SQL Editor, run queries from **`MIGRATION_VERIFICATION.sql`**

### Step 5: Update App

Edit `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_new_anon_key
```

---

## 📋 What Gets Migrated

✅ **All Tables** (22 tables)
- admin_users
- employees
- branches
- shifts
- attendance_logs
- leave_requests
- payroll_records
- And 15 more...

✅ **All Data**
- Every row from every table
- Maintains relationships
- Handles foreign keys
- Updates sequences

✅ **Schema Components**
- Primary keys
- Foreign keys
- Unique constraints
- Indexes
- RLS policies
- Triggers
- Functions

---

## 🔒 Security

- Service Role Key stays server-side only
- Source database URL stored in Supabase Secrets
- No client-side exposure of sensitive credentials
- SSL-encrypted connections

---

## 🆘 Need Help?

### Common Issues

**"SOURCE_DATABASE_URL not configured"**
→ Add the secret in Supabase Dashboard

**"Permission denied"**
→ Use Service Role Key, not Anon Key

**Migration times out**
→ Contact support for batch migration

### Support Resources

1. Check Edge Function logs in Supabase Dashboard
2. Review `BOLT_TO_SUPABASE_MIGRATION.md` for detailed troubleshooting
3. Run `MIGRATION_VERIFICATION.sql` to identify issues

---

## ⏱️ Timeline

- **Setup**: 2 minutes
- **Schema application**: 5 minutes
- **Data migration**: 2-5 minutes
- **Verification**: 1 minute
- **Total**: ~10-15 minutes

---

## ✅ Post-Migration Checklist

- [ ] All tables have correct row counts
- [ ] No orphaned records
- [ ] All foreign keys intact
- [ ] RLS policies active
- [ ] Sequences updated
- [ ] App connects to new database
- [ ] Admin can login
- [ ] Employees can check in/out
- [ ] Reports generate correctly

---

## 📞 What to Do Next

1. ✅ Test all critical application features
2. ✅ Set up automated backups in Supabase
3. ✅ Configure connection pooling (if needed)
4. ✅ Monitor database performance
5. ✅ Decommission Bolt database once verified

---

## 🎉 You Now Own Your Database!

Your data is now fully under your control in your own Supabase project.

**Start Here**: Open `migrate-one-click.html` in your browser.

**Questions?** Read `BOLT_TO_SUPABASE_MIGRATION.md` for complete documentation.

# Branch Debug Panel - Hidden by Default

**Date:** 2026-02-01
**Change:** Hide debug panel from employee screens
**Implementation:** CSS display:none with localStorage toggle

---

## Change Summary

The Branch Debug Panel is now **hidden by default** on employee screens. Only developers can enable it using a localStorage flag.

---

## Why This Change?

**Before:**
- ❌ Debug panel visible to all employees
- ❌ Technical information exposed to non-technical users
- ❌ Cluttered employee UI

**After:**
- ✅ Debug panel hidden by default
- ✅ Clean employee UI
- ✅ Developers can still access for troubleshooting
- ✅ No logic changes - all diagnostics still run

---

## How It Works

### For Employees (Default)
- Panel is hidden (`display: none`)
- All diagnostic logic still runs in background
- Console logs still available
- No visual clutter

### For Developers (Opt-in)
Enable the panel in browser console:
```javascript
localStorage.setItem('show_debug_panel', 'true')
// Then refresh the page
```

Disable the panel:
```javascript
localStorage.removeItem('show_debug_panel')
// Then refresh the page
```

---

## Technical Implementation

### File Modified
`src/components/BranchDebugPanel.tsx`

### Change Made
```typescript
// Hidden by default - developers can enable with: localStorage.setItem('show_debug_panel', 'true')
const isDebugEnabled = typeof window !== 'undefined' && localStorage.getItem('show_debug_panel') === 'true';

return (
  <div className="fixed bottom-4 right-4 z-50" style={{ display: isDebugEnabled ? 'block' : 'none' }}>
    {/* Panel content */}
  </div>
);
```

**Method:** Inline CSS style with conditional display
**Check:** localStorage flag `show_debug_panel`
**Default:** `none` (hidden)
**When enabled:** `block` (visible)

---

## What Still Works

All diagnostic functionality remains active:

| Feature | Status | Notes |
|---------|--------|-------|
| **Hard-coded no-cache fetch** | ✅ Active | Always runs |
| **Data integrity assertions** | ✅ Active | Always runs |
| **Console logging** | ✅ Active | Always available |
| **Realtime updates** | ✅ Active | Always runs |
| **GPS validation** | ✅ Active | Always runs |
| **Debug panel UI** | ⚠️ Hidden | Only visible when enabled |

**Result:** All diagnostics run, but UI is hidden by default.

---

## Testing

### Test: Default State (Hidden)
```bash
# 1. Clear localStorage
localStorage.removeItem('show_debug_panel')

# 2. Refresh page
# 3. Login as employee

# Expected: NO debug panel visible
# Expected: Console logs still present
```

### Test: Enabled State (Visible)
```bash
# 1. Set localStorage flag
localStorage.setItem('show_debug_panel', 'true')

# 2. Refresh page
# 3. Login as employee

# Expected: Debug panel visible in bottom-right
# Expected: All data populated
# Expected: Console logs present
```

### Test: Toggle
```bash
# 1. Enable panel
localStorage.setItem('show_debug_panel', 'true')
# Refresh - panel visible

# 2. Disable panel
localStorage.removeItem('show_debug_panel')
# Refresh - panel hidden

# Expected: Toggle works correctly
```

---

## Developer Guide

### When to Use Debug Panel

Use the debug panel for:
- 🔍 Troubleshooting branch location issues
- 🔍 Verifying data integrity
- 🔍 Checking GPS validation
- 🔍 Monitoring realtime updates
- 🔍 Investigating employee context

### How to Enable

**Option 1: Browser Console**
```javascript
localStorage.setItem('show_debug_panel', 'true')
location.reload()
```

**Option 2: Bookmarklet**
```javascript
javascript:localStorage.setItem('show_debug_panel','true');location.reload();
```

**Option 3: URL Parameter (Future Enhancement)**
```
?debug=true
```
*Note: Not currently implemented*

### How to Disable

```javascript
localStorage.removeItem('show_debug_panel')
location.reload()
```

---

## Production Impact

| Aspect | Impact |
|--------|--------|
| **Performance** | ✅ None - same logic runs |
| **Bundle size** | ✅ No change |
| **Memory** | ✅ No change |
| **Network** | ✅ No change |
| **Employee UX** | ✅ Improved - cleaner UI |
| **Developer UX** | ✅ Same - can enable anytime |
| **Security** | ✅ Improved - less info exposed |

---

## Rollback

If needed, revert to always-visible:

```typescript
// Remove the conditional display
return (
  <div className="fixed bottom-4 right-4 z-50">
    {/* Panel content */}
  </div>
);
```

Or always show for testing:
```typescript
const isDebugEnabled = true; // Force always visible
```

---

## Future Enhancements

### 1. URL Parameter Support
```typescript
const urlParams = new URLSearchParams(window.location.search);
const debugParam = urlParams.get('debug') === 'true';
const isDebugEnabled = debugParam || localStorage.getItem('show_debug_panel') === 'true';
```

### 2. Admin Setting
```typescript
// Allow admins to enable debug for specific employees
const { data: settings } = await supabase
  .from('employee_settings')
  .select('debug_enabled')
  .eq('employee_id', employeeId)
  .single();

const isDebugEnabled = settings?.debug_enabled || localStorage.getItem('show_debug_panel') === 'true';
```

### 3. Keyboard Shortcut
```typescript
// Press Ctrl+Shift+D to toggle
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      const current = localStorage.getItem('show_debug_panel') === 'true';
      localStorage.setItem('show_debug_panel', (!current).toString());
      location.reload();
    }
  };
  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

---

## Documentation Updated

Updated files:
- ✅ `BRANCH_DIAGNOSTIC_SYSTEM.md` - Added visibility section
- ✅ `BRANCH_DIAGNOSTIC_SYSTEM.md` - Updated test steps
- ✅ `BRANCH_DIAGNOSTIC_SYSTEM.md` - Updated troubleshooting guide
- ✅ `BRANCH_DEBUG_PANEL_VISIBILITY.md` - This document

---

## Summary

**What Changed:**
- Debug panel hidden by default via CSS `display:none`
- localStorage flag `show_debug_panel` controls visibility
- Developers can enable with one console command

**What Didn't Change:**
- All diagnostic logic still runs
- All console logs still present
- All data integrity checks active
- All assertions still enforced

**Result:**
- ✅ Clean employee UI
- ✅ Accessible developer diagnostics
- ✅ No performance impact
- ✅ Production ready

---

*Implemented by: System*
*Date: 2026-02-01*
*Type: Frontend visibility change*
*Impact: UI only - no logic changes*

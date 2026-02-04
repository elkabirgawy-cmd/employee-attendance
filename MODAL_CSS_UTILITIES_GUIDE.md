# Modal CSS Utilities Guide

## Overview
Reusable CSS utility classes for building consistent, responsive modals without horizontal scroll.

---

## Utility Classes Reference

### 1. Modal Container (`.modal-container`)

**Purpose:** Outer wrapper for modal overlays

**Usage:**
```tsx
<div className="modal-container">
  {/* Modal content here */}
</div>
```

**Properties:**
- `position: fixed; inset: 0;` - Full screen overlay
- `display: flex; align-items: center; justify-content: center;` - Center content
- `z-index: 50` - Above other content
- `background-color: rgba(0, 0, 0, 0.5)` - Semi-transparent backdrop
- `overflow-y: auto` - Vertical scrolling when needed
- `padding: 0.75rem` (mobile), `1rem` (sm+) - Responsive padding
- `box-sizing: border-box` - Include padding in width

---

### 2. Modal Content (`.modal-content`)

**Purpose:** Inner container for modal body

**Usage:**
```tsx
<div className="modal-content">
  {/* Header, form, footer */}
</div>
```

**Properties:**
- `background-color: white` - White background
- `border-radius: 1rem` - Rounded corners
- `display: flex; flex-direction: column` - Vertical layout
- `overflow: hidden` - Clip overflow content
- `width: 100%` - Full width of container
- `max-width: 32rem` - Cap at 512px
- `max-height: 90vh` - Prevent viewport overflow
- `box-sizing: border-box` - Include padding in width

---

### 3. Input Wrapper (`.input-wrapper`)

**Purpose:** Container for input fields and labels

**Usage:**
```tsx
<div className="input-wrapper">
  <label>Field Label</label>
  <input className="compactField" />
</div>
```

**Properties:**
- `width: 100%` - Full width
- `min-width: 0` - Allow shrinking
- `box-sizing: border-box` - Proper box model

---

### 4. Date/Time Grid (`.date-time-grid`)

**Purpose:** Responsive grid for date/time field pairs

**Usage:**
```tsx
<div className="date-time-grid">
  <div className="input-wrapper">
    <label>From</label>
    <input type="time" className="compactField" />
  </div>
  <div className="input-wrapper">
    <label>To</label>
    <input type="time" className="compactField" />
  </div>
</div>
```

**Properties:**
- `display: grid` - Grid layout
- `gap: 0.5rem` - 8px spacing between columns
- `width: 100%` - Full width
- `grid-template-columns: 1fr` - Single column on mobile (< 400px)
- `grid-template-columns: repeat(2, 1fr)` - Two columns on larger screens (≥ 400px)
- `box-sizing: border-box` - Proper box model

**Responsive Behavior:**
```
< 400px:  [Field A]
          [Field B]

≥ 400px:  [Field A] [Field B]
```

---

### 5. Compact Field (`.compactField`)

**Purpose:** Standardized input/select styling

**Usage:**
```tsx
<input type="text" className="compactField rounded-xl focus:ring-blue-500" />
<input type="date" className="compactField rounded-xl focus:ring-blue-500" />
<input type="time" className="compactField rounded-xl focus:ring-blue-500" />
<select className="compactField rounded-xl focus:ring-blue-500">
  <option>Choice 1</option>
</select>
```

**Properties:**
- `width: 100%` - Full width
- `height: 2.75rem` (44px) - Touch-friendly height
- `padding: 0 0.75rem` (12px) - Horizontal padding
- `font-size: 0.875rem` (14px) - Readable text size
- `border: 1px solid #d1d5db` - Gray border
- `border-radius: 10px` - Rounded corners
- `background-color: white` - White background
- `min-width: 0` - Allow shrinking
- `box-sizing: border-box` - Include padding in width
- `focus:outline-none focus:ring-2` - Focus indicator

**Additional Notes:**
- Date inputs have special styling to ensure consistent height across browsers
- Combine with Tailwind utilities: `rounded-xl`, `focus:ring-blue-500`, etc.

---

### 6. Compact Textarea (`.compactTextarea`)

**Purpose:** Standardized textarea styling

**Usage:**
```tsx
<textarea
  className="compactTextarea rounded-xl focus:ring-blue-500"
  rows={3}
  placeholder="Enter text..."
/>
```

**Properties:**
- `width: 100%` - Full width
- `height: 4.5rem` (72px) - Default height for 3 rows
- `padding: 0.5rem 0.75rem` - Vertical and horizontal padding
- `font-size: 0.875rem` (14px) - Readable text size
- `border: 1px solid #d1d5db` - Gray border
- `border-radius: 10px` - Rounded corners
- `background-color: white` - White background
- `resize: none` - Disable manual resizing
- `focus:outline-none focus:ring-2` - Focus indicator

---

## Complete Modal Example

```tsx
export default function MyModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-container" dir="rtl">
      <div className="modal-content">
        {/* Header */}
        <div className="px-4 py-3 border-b">
          <h2 className="text-xl font-bold">Modal Title</h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <form className="space-y-2">
            {/* Single Field */}
            <div className="input-wrapper">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Date *
              </label>
              <input
                type="date"
                className="compactField rounded-xl focus:ring-blue-500"
                required
              />
            </div>

            {/* Two Column Fields */}
            <div className="date-time-grid">
              <div className="input-wrapper">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  From *
                </label>
                <input
                  type="time"
                  className="compactField rounded-xl focus:ring-blue-500"
                  required
                />
              </div>
              <div className="input-wrapper">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  To *
                </label>
                <input
                  type="time"
                  className="compactField rounded-xl focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Select Field */}
            <div className="input-wrapper">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Type *
              </label>
              <select className="compactField rounded-xl focus:ring-blue-500" required>
                <option value="">Choose...</option>
                <option value="1">Option 1</option>
                <option value="2">Option 2</option>
              </select>
            </div>

            {/* Textarea */}
            <div className="input-wrapper">
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Reason *
              </label>
              <textarea
                className="compactTextarea rounded-xl focus:ring-blue-500"
                rows={3}
                placeholder="Enter reason..."
                required
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button className="h-11 bg-blue-600 text-white rounded-xl font-semibold">
              Submit
            </button>
            <button
              onClick={onClose}
              className="h-11 px-5 border border-gray-300 rounded-xl font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Key Benefits

✅ **No Horizontal Scroll:** Properly sized containers prevent overflow
✅ **Consistent Heights:** All inputs are 44px tall (touch-friendly)
✅ **Responsive:** Automatically adapts to screen size
✅ **RTL Support:** Works seamlessly with `dir="rtl"`
✅ **Mobile-First:** Optimized for small screens first
✅ **Maintainable:** Single source of truth for modal styling
✅ **Accessible:** Meets touch target size requirements

---

## Customization

### Change Input Height:
```css
.compactField {
  @apply h-12;  /* 48px instead of 44px */
}
```

### Change Grid Breakpoint:
```css
@media (min-width: 480px) {  /* 480px instead of 400px */
  .date-time-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

### Change Border Radius:
```tsx
<input className="compactField rounded-2xl" />  {/* More rounded */}
<input className="compactField rounded-lg" />   {/* Less rounded */}
```

---

## Browser-Specific Notes

### Safari (iOS):
- Date/time inputs have special webkit styling disabled
- `-webkit-appearance: none` ensures consistent appearance
- Calendar picker icon preserved and clickable

### Chrome/Edge:
- Native date/time pickers work seamlessly
- Focus ring styling consistent across inputs

### Firefox:
- Date/time inputs render properly with consistent height
- Border-box sizing ensures proper width calculation

---

## Troubleshooting

### Issue: Horizontal scroll still appears
**Solution:** Ensure all parent containers have `box-sizing: border-box` and no fixed pixel widths

### Issue: Fields don't align properly
**Solution:** Use `.input-wrapper` class and ensure no custom margins/padding on inputs

### Issue: Grid doesn't stack on mobile
**Solution:** Check that `xs` breakpoint is defined in `tailwind.config.js`

### Issue: Date inputs have different height
**Solution:** Ensure `.compactField[type="date"]` CSS is applied correctly

---

## Performance Tips

1. Reuse utility classes instead of creating inline styles
2. Avoid deep nesting of grid layouts
3. Use `will-change: transform` sparingly for animations
4. Minimize custom CSS overrides

---

## Accessibility Checklist

- [ ] All inputs have associated labels
- [ ] Touch targets are at least 44x44px
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA standards
- [ ] Form can be navigated via keyboard
- [ ] Error messages are announced to screen readers

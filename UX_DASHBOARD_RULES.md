# UX Dashboard System - Phase 1 Rules

## 1. Global Dashboard Structure
Every admin page MUST adhere to the following structure:
- **Root Component**: `AdminPageShell`
  - Handles responsive padding, RTL support, and page titles.
- **Top Actions**: `AdminToolbar`
  - Container for search, filters, and primary page actions.
  - Mobile behavior: Stacks vertically or becomes sticky (future).
- **Content Container**: `AdminCard`
  - Used for all major content sections (tables, lists, forms).
- **Flow**: Header → Toolbar/Actions → Stats (optional) → Content → Empty State.

## 2. Card Behavior Standard
All dashboard cards (`AdminCard`, `AdminStatCard`) must share:
- **Visuals**: white background, `rounded-xl`, `border-slate-200`, `shadow-sm`.
- **Hover**: Subtle lift on interactive cards (`hover:shadow-md`).
- **Interaction**: 
  - Clicking a stat card MUST navigate or open details.
  - Primary action: One distinct primary button per card context.

## 3. Interaction Rules
- **Feedback**:
  - Loading: Use `AdminSkeleton` (no raw spinners for page content).
  - Empty: Use `AdminEmptyState` with clear title and description.
- **Filters**:
  - Should be resettable.
  - Inputs should use `adminTheme.input` styles.

## 4. Typography & Visuals
- **Numbers**: Use `AnimatedNumber` (Inter/tabular nums) matching the Dashboard clock style.
- **Titles**: `text-2xl font-bold text-slate-800` (handled by Shell).
- **Section Headers**: `text-lg font-semibold text-slate-800`.
- **Status Colors**:
  - **Success**: Green (`text-green-700`, `bg-green-50`)
  - **Warning**: Amber/Orange (`text-amber-700`, `bg-amber-50`)
  - **Danger**: Red (`text-red-700`, `bg-red-50`)
  - **Neutral**: Slate (`text-slate-600`, `bg-slate-100`)

## 5. Mobile vs Desktop
- **Responsive**:
  - Grids: `grid-cols-1` (mobile) → `md:grid-cols-2` → `lg:grid-cols-4`.
  - Tables: Horizontal scroll wrapper on mobile.
  - Modals: Full width/bottom sheet style preference on mobile (standard centered modal currently).

## Compliance Checklist
- [ ] Page uses `AdminPageShell`.
- [ ] Primary content wrapped in `AdminCard`.
- [ ] Stats use `AdminStatCard` with `AnimatedNumber`.
- [ ] Status indicators use unified color tokens.

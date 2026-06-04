# Session — 2026-06-05 — Phase 2 Features

**Commit:** `d1a3132`
**Branch:** master
**Files changed:** 28 (2631 insertions, 259 deletions)

---

## What Was Built

### 1. Stock Adjustment Module

**Problem:** No way to correct stock for damage, returns, write-offs, or found items.

**Solution:**
- Supabase migration: `stock_adjustments` table with columns: `id`, `product_id`, `type`, `quantity_change`, `reason`, `notes`, `created_by`, `created_at`
- Server actions: `createStockAdjustment` (validates non-zero qty, blocks negative stock, atomically updates `products.current_stock`), `getStockAdjustments`
- 5 adjustment types: `damage` | `return` | `correction` | `write_off` | `found`
- UI: `/stock-adjustments` list with type badges + signed qty; `/stock-adjustments/new` form with product search, type selector, quantity preview showing projected stock
- Sidebar nav link added after "Supplier Invoices"

**Key files:**
- `actions/stock-adjustments.ts` (NEW)
- `components/stock-adjustments/StockAdjustmentForm.tsx` (NEW)
- `app/(dashboard)/stock-adjustments/page.tsx` (NEW)
- `app/(dashboard)/stock-adjustments/new/page.tsx` (NEW)
- `components/layout/Sidebar.tsx` (modified)

---

### 2. Customer Credit Tracking

**Problem:** No way to track credit limits or outstanding balances per customer.

**Solution:**
- Supabase migration: `credit_limit NUMERIC(12,2) DEFAULT 0` on `customers` table
- `getCustomerCreditSummary` action: live outstanding = sum of (grand_total - amount_paid) for `status='pending'` invoices
- Credit limit field in CustomerForm (step 500, 0 = cash-only)
- Customer detail page: "Credit Account" card with limit / outstanding / available + color-coded progress bar (green <80%, amber 80-99%, red ≥100%)
- Billing checkout: warning banner when credit payment amount exceeds available credit
- `'credit'` added to `payment_method` union type

**Key files:**
- `actions/customers.ts` (modified — `getCustomerCreditSummary`, `credit_limit` in create/update)
- `actions/invoices.ts` (modified — `'credit'` in payment_method)
- `components/customers/CustomerForm.tsx` (modified)
- `app/(dashboard)/customers/[id]/page.tsx` (modified)
- `components/billing/CheckoutForm.tsx` (modified)
- `app/(dashboard)/billing/checkout/page.tsx` (modified)

---

### 3. User Management

**Problem:** No way to manage user roles or deactivate accounts from the app.

**Solution:**
- Supabase migration: `profiles` table (`id`, `name`, `email`, `role: admin|staff`, `is_active`, `created_at`) + `handle_new_user` trigger auto-creates profile on auth signup + RLS + backfill existing users as admin
- `lib/get-user-role.ts`: `getUserRole()` and `requireAdmin()` utilities
- Server actions in `actions/users.ts`:
  - `getProfiles()` — list all profiles
  - `updateUserRole(userId, role)` — with last-admin guard
  - `setUserActive(userId, isActive)` — with self-deactivation guard + last-active-admin guard
- `UserList` component: role select (disabled for self), activate/deactivate toggle
- `/settings/users` page: admin-only, redirects staff to `/dashboard`
- Settings page shows "User Management" card only to admins
- Sidebar filters User Management link by admin role

**Key files:**
- `lib/get-user-role.ts` (NEW)
- `actions/users.ts` (NEW)
- `components/settings/UserList.tsx` (NEW)
- `app/(dashboard)/settings/users/page.tsx` (NEW)
- `app/(dashboard)/settings/page.tsx` (modified)
- `components/layout/Sidebar.tsx` (modified)

---

## Bug Fixes

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Webpack `TypeError: Cannot read properties of undefined (reading 'call')` on quotations tab | Stale `.next` cache — `QuotationRowActions.tsx` not compiled | `Remove-Item -Recurse -Force .next && npm run dev` |
| `setUserActive` missing last-admin guard | Found in security review | Added active-admin count check before deactivating |
| `QuotationForm.tsx` TypeScript error | `Customer` type gained `credit_limit` but inline ghost object didn't | Added `credit_limit: 0` to ghost object |
| `'credit'` not in `CreateInvoiceData` | Missing union member | Added `'credit'` to `payment_method` union |

---

## Supabase Migrations Applied

| Migration Name | SQL |
|---------------|-----|
| `stock_adjustments_table` | Creates `stock_adjustments` table with indexes |
| `add_credit_limit_to_customers` | `ALTER TABLE customers ADD COLUMN credit_limit NUMERIC(12,2) DEFAULT 0` |
| `create_profiles_table` | Creates `profiles` table + `handle_new_user` trigger + RLS + backfill |

---

## Type Changes (`types/database.ts`)

```typescript
// Added
type StockAdjustmentType = 'damage' | 'return' | 'correction' | 'write_off' | 'found'

interface StockAdjustment {
  id: string
  product_id: string
  type: StockAdjustmentType
  quantity_change: number
  reason: string
  notes?: string | null
  created_by?: string | null
  created_at: string
  products?: Pick<Product, 'id' | 'name' | 'sku' | 'current_stock'>
}

// Modified
interface Customer {
  // ...existing fields...
  credit_limit: number   // ADDED
}

interface Profile {
  id: string
  name: string
  email: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

type UserRole = 'admin' | 'staff'
```

---

## Test Checklist

- [ ] Stock Adjustments: go to `/stock-adjustments/new`, pick product, pick type, enter qty, submit → verify `current_stock` updates on product
- [ ] Stock Adjustment blocks negative: try damage > current stock → should error
- [ ] Customer Credit: create customer with credit_limit=10000, go to detail page → credit card appears
- [ ] Customer Credit: create pending invoice → outstanding balance shows in credit card
- [ ] Billing Credit Warning: checkout with credit payment > available credit → warning banner shows
- [ ] User Management: admin goes to `/settings/users` → sees list with role selects
- [ ] User Management: try to demote last admin → error "Cannot remove the last admin."
- [ ] User Management: staff goes to `/settings/users` → redirected to `/dashboard`
- [ ] Settings page: admin sees "User Management" card, staff does not

---

## Dev Server Restart

Must clear Next.js cache after these changes:

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

# Session — 2026-06-05 — Phase 3A Features

**Commits:** `d5a5c03` → `feaaa36` (+ earlier foundation commits)
**Branch:** master
**TypeScript:** Zero errors

---

## What Was Built

### 1. Sales Returns / Credit Notes

**DB:** `sales_returns` + `sales_return_items` tables + `next_return_no()` RPC (RET-000001 format) + RLS

**Server actions** (`actions/sales-returns.ts`):
- `createSalesReturn` — validates qty (can't exceed original, can't re-return already-returned), restores stock, restores serial status to 'returned', inserts return record
- `getReturnableItems` — returns items with max returnable qty computed
- `getSalesReturns` / `getSalesReturn`

**UI:**
- `ReturnForm` component — checkbox item select, qty input per item, refund method (6 options), reason + notes
- `/invoices/[id]/return` — loads returnable items, blocked if all returned or cancelled
- `/returns` — list page with return no, invoice ref, reason, refund method, amount
- `/returns/[id]` — return detail / credit note view
- `↩ Return` button on invoice detail page (amber badge, hidden for cancelled invoices)
- **Returns** nav link in sidebar (RotateCcw icon)

**Types added:** `ReturnRefundMethod`, `SalesReturnItem`, `SalesReturn`

---

### 2. Low Stock Alerts

**No DB migration needed** — `low_stock_alert` already existed on products table.

**Server action** (`getLowStockProducts`):
- Fetches active products where `low_stock_alert > 0`, filters JS-side where `current_stock < low_stock_alert`

**UI:**
- `LowStockWidget` — async server component with amber styling, shows up to 8 items + "View all" link, "Restock" link per item → stock-in new page, renders nothing when no low-stock items
- Added to dashboard (between stat cards and due-invoices table)
- Products page: filter tabs "All Products (N)" | "⚠ Low Stock (N)" — filters `displayProducts` passed to `ProductsTable`

---

### 3. Dashboard Revenue Chart

**recharts** installed (v2.x).

**Server action** (`getDashboardRevenueChart(days=30)`):
- Pre-fills all days with 0 so chart has no gaps
- Returns `DailyRevenuePoint[]` — `{ date: 'DD Mon', revenue, invoices }`

**UI:**
- `RevenueChart` client component — recharts `AreaChart` with dark gradient fill, custom tooltip
- `formatINR` helper: ₹10K, ₹1.5L format on Y-axis
- Shows "No invoices in last N days" when all revenue = 0
- Added to dashboard page (above LowStockWidget)

---

### 4. Customer Account Statement

**Server action** (`getCustomerStatement(customerId)`):
- Fetches all non-cancelled invoices + all payments for those invoices
- Sorts chronologically, computes running balance (invoice = debit, payment = credit)
- Returns `CustomerStatement` with `transactions[]`, `total_invoiced`, `total_paid`, `closing_balance`

**UI:**
- `/customers/[id]/statement` — ledger table with color-coded debits (red) / credits (green) / balance
- Three summary cards: Total Invoiced / Total Paid / Balance Due
- `StatementExportButton` — Excel export via `xlsx` library
- **Statement** button added to customer detail page header

---

### 5. Purchase Orders

**DB:** `purchase_orders` + `purchase_order_items` tables + `next_po_no()` RPC (PO-000001 format) + `update_po_timestamp()` trigger + RLS

**Server actions** (`actions/purchase-orders.ts`):
- `createPurchaseOrder` — validates supplier name, items, generates PO number
- `getPurchaseOrders` / `getPurchaseOrder`
- `updatePOStatus` — guards: cannot change received PO, cannot reactivate cancelled
- `receivePurchaseOrder` — creates `supplier_invoices` record + `stock_in` records per item + updates product stock + marks PO received

**Types added:** `POStatus`, `PurchaseOrderItem`, `PurchaseOrder`

**UI:**
- `POForm` — supplier select (from existing suppliers) + inline supplier name + expected date + notes + line items (product select auto-fills name/sku/cost_price)
- `PODetailActions` — context-aware action buttons: "Mark as Sent" (draft only), "Receive PO" (shows inline form for supplier invoice no + date), "Cancel PO"
- `/purchase-orders` list with status badges (draft/sent/received/cancelled)
- `/purchase-orders/new` — renders POForm
- `/purchase-orders/[id]` — detail with line items + PODetailActions
- **Purchase Orders** nav link in sidebar (ClipboardCheck icon)

---

## Files Modified (key)

| File | Change |
|------|--------|
| `actions/invoices.ts` | Added `getDashboardRevenueChart` + `DailyRevenuePoint` |
| `actions/products.ts` | Added `getLowStockProducts` |
| `actions/customers.ts` | Added `getCustomerStatement`, `StatementTransaction`, `CustomerStatement` |
| `app/(dashboard)/dashboard/page.tsx` | Added RevenueChart + LowStockWidget |
| `app/(dashboard)/products/page.tsx` | Added filter tabs + `isLowStockFilter` + `displayProducts` |
| `app/(dashboard)/customers/[id]/page.tsx` | Added Statement button |
| `app/(dashboard)/invoices/[id]/page.tsx` | Added ↩ Return button |
| `components/layout/Sidebar.tsx` | Added Returns + Purchase Orders nav links |
| `types/database.ts` | Added `ReturnRefundMethod`, `POStatus`, `SalesReturnItem`, `SalesReturn`, `PurchaseOrderItem`, `PurchaseOrder` |
| `lib/invoice-number.ts` | Added `formatReturnNo`, `formatPONo` |

## New Files

- `actions/sales-returns.ts`
- `actions/purchase-orders.ts`
- `components/sales-returns/ReturnForm.tsx`
- `components/dashboard/LowStockWidget.tsx`
- `components/dashboard/RevenueChart.tsx`
- `components/customers/StatementExportButton.tsx`
- `components/purchase-orders/POForm.tsx`
- `components/purchase-orders/PODetailActions.tsx`
- `app/(dashboard)/returns/page.tsx` + `[id]/page.tsx`
- `app/(dashboard)/invoices/[id]/return/page.tsx`
- `app/(dashboard)/customers/[id]/statement/page.tsx`
- `app/(dashboard)/purchase-orders/page.tsx` + `new/page.tsx` + `[id]/page.tsx`

---

## Security Notes

- All mutations require `supabase.auth.getUser()` check
- Sales returns: server-side qty validation (can't over-return, can't re-return)
- Cannot return against cancelled invoice
- PO status transitions guarded server-side
- Cannot receive already-received or cancelled PO
- RLS enabled on all new tables

---

## Dev Server Restart

```powershell
Remove-Item -Recurse -Force .next
npm run dev
```

## Test Checklist

- [ ] Sales Return: create invoice → open detail → ↩ Return → select item → submit → stock restored
- [ ] Sales Return: try returning more than original qty → error
- [ ] Sales Return: try returning item already fully returned → 0 returnable items shown
- [ ] Low Stock: set product `low_stock_alert=5`, stock=2 → amber widget on dashboard
- [ ] Low Stock: Products page ⚠ Low Stock tab shows filtered list
- [ ] Revenue Chart: visible on dashboard with 30-day trend
- [ ] Customer Statement: open customer → Statement → ledger with running balance
- [ ] Customer Statement: Export Excel → downloads .xlsx
- [ ] Purchase Order: New PO → create → detail shows draft status
- [ ] Purchase Order: Mark Sent → status changes
- [ ] Purchase Order: Receive PO → enter invoice no + date → stock updated
- [ ] Purchase Order: Check Stock-In page → new supplier invoice appears

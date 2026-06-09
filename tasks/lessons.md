# DS POS — Lessons Learned

## Lesson 1: base-ui Dialog has no `asChild` prop
**Date:** 2026-06-03
**Context:** `components/ui/dialog.tsx` uses `@base-ui/react`, NOT shadcn/ui.
**Mistake to avoid:** Never use `asChild` on `DialogTrigger`. Use `render={<Button />}` pattern instead.
**Rule:** Always check `components/ui/dialog.tsx` to confirm it's base-ui before writing Dialog code.

## Lesson 2: Always check action signatures before calling
**Date:** 2026-06-03
**Context:** `getProducts` and `getStockIns` have specific argument shapes.
**Rule:** Subagents must read the action file before calling it. Never assume `{ status: 'active' }` works without verifying.

## Lesson 3: User prefers subagent-driven development, no prompting
**Date:** 2026-06-03
**Context:** User explicitly said "dont ask me again always use subagent-driven approach"
**Rule:** For any multi-task plan, immediately use subagent-driven-development. No execution mode question needed.

## Lesson 4: PAT tokens must go in ~/.claude.json not .env.local
**Date:** 2026-06-03
**Context:** Supabase MCP PAT was accidentally put in .env.local
**Rule:** MCP tokens in `~/.claude.json` only. Never commit to repo. Never in `.env.local`.

## Lesson 6: Phase 3B complete — what was built (2026-06-05)
**Date:** 2026-06-05
**Context:** Full Phase 3B shipped across 6 plans, 31 commits, 0 TS errors.
**What exists now:**
- Plan 0: GST mixed billing — `is_taxable` on products/invoice_items, CartSummary new footer, PDF updated
- Plan 1: Expenses tracker — `/expenses`, categories, dashboard widget
- Plan 2: Supplier ledger — `/suppliers/[id]/ledger`, AP aging `/reports/payables`, Excel export
- Plan 3: Customer AR — `/reports/receivables`, credit limit block in billing, WhatsApp reminders
- Plan 4: Financial reports — P&L, margins, day-end, DateRangeFilter component
- Plan 5: Operations — `useBarcodeScanner` hook, thermal receipt 80mm, batch label print
**DB migrations applied:** 008 (is_taxable), 009 (expenses), 010 (supplier_ledger), 011 (customer_credit)
**Next phase:** TBD

## Lesson 7: Supabase join returns array OR object — always cast through unknown
**Date:** 2026-06-05
**Context:** `expense_categories` join on expenses returned `{name:string}|{name:string}[]` — TypeScript TS2352 error.
**Rule:** When Supabase returns a joined table, cast: `(row.joined_table as unknown as {field: string} | null)?.field`. Never assume singular join is always an object.

## Lesson 8: Session limit on subagents — check git log before re-dispatching
**Date:** 2026-06-05
**Context:** Plan 2 subagent hit session limit mid-task. Dispatching replacement without checking git log would duplicate work.
**Rule:** Before re-dispatching after session limit: run `git log --oneline -15` first. Only dispatch work not already committed.

## Lesson 5: Cygwin bash pipe error in Claude Code hooks is NOT fixable from config
**Date:** 2026-06-05
**Context:** User's Windows system has Cygwin bash at `/usr/bin/bash`. Claude Code uses this to run plugin hooks. Cygwin bash fails with `printf: write error: Permission denied` at startup due to Electron/Node.js subprocess pipe incompatibility.
**What was tried:** Removing duplicate hooks, changing node paths (Windows backslash → bash forward-slash), moving hooks from plugin.json to settings.json, removing plugin.json hooks entirely.
**Root cause:** Cygwin bash stdout pipe is incompatible with Claude Code's Electron subprocess pipe handles on Windows. Error happens BEFORE hook code runs — in bash's own initialization. Hook commands themselves work fine when tested directly.
**Rule:** Do NOT spend more than 2 attempts fixing `/usr/bin/bash: line 1: printf: write error: Permission denied`. It is a system-level Cygwin incompatibility. Error is non-blocking — caveman mode still activates. Tell user immediately: "This is a Cygwin/Electron pipe incompatibility, cannot be fixed from config. It is cosmetic only."

## Lesson 9: PROJECT STATUS — Feature Complete as of 2026-06-07
**ALL primary objectives from CLAUDE.md are DONE. Do not tell user features are missing.**

### Completed Features (verified via git log)
- Inventory management — products, categories, stock tracking
- Barcode scan IN/OUT — `useBarcodeScanner` hook, USB keyboard-wedge
- GST billing — CGST/SGST (Telangana) + IGST (other states), is_taxable per item
- Split invoices — Tax Invoice + Bill of Supply linked via `order_group_id`
- Invoice PDF — multi-page, GST breakdown, ORDER BALANCE SUMMARY for split orders
- WhatsApp + email invoice sharing
- Barcode label printing — batch multi-select print
- Thermal receipt — 80mm print layout
- Quotations — create, send, convert to invoice
- Sales Returns — full GST-aware, stock restore, serial restore, `total_returns` tracked
- Customer refund tracking — `customer_refunds` table (migration 014), RecordCustomerRefundButton
- Partial payments — `invoice_payments` table, RecordPaymentDialog, running balance
- Reports — P&L, margins, day-end closing, AR aging, AP aging
- Tally XML export + GSTR-1 export
- Offline billing — PWA, Service Worker, Dexie.js IndexedDB, invoice queue
- Expenses tracker — categories, CRUD, dashboard widget
- Supplier ledger — ledger per supplier, payables aging, Excel export
- Customer AR — receivables aging, credit limit, WhatsApp reminders
- Customer account statement — full ledger PDF printable
- Purchase Orders — PO creation and tracking
- Stock Adjustments — add/remove stock with reason
- User Management — roles and permissions
- Supplier invoice bulk import — 3-step import UI
- Store Loans — inter-store lending tracker (migration 012)
- Dashboard — revenue chart, low stock widget, store loans widget, customizable widgets

### DB Migrations Applied to Production
001 initial_schema, 002 stock_in_trigger, 003 invoice_sequence, 004 supplier_invoices,
006 invoice_payments, 007 quotation_sequence, 008 gst_config (is_taxable),
009 expenses, 010 supplier_ledger, 011 customer_credit, 012 store_loans,
013 split_invoices, 014 customer_refunds

### Split Order Architecture (2026-06-07)
- `order_group_id` UUID links Tax Invoice + Bill of Supply pair
- Group balance = (TI.grand_total + BOS.grand_total) - (TI.amount_paid + BOS.amount_paid) - (TI.total_returns + BOS.total_returns)
- Positive = Balance Due (red), Negative = Refund Due (green), Zero = Settled
- Per-invoice Due suppressed for split orders — group balance is authoritative
- `customer_refunds` table tracks when store physically refunds customer cash

## Lesson 10: Supabase admin.createUser() fails with UUID-format passwords
**Date:** 2026-06-09
**Error:** `unexpected_failure | status=500 | code=unexpected_failure` from `adminClient.auth.admin.createUser()`
**Root cause:** `${randomUUID()}-${randomUUID()}` as password triggers Supabase internal failure. UUID-format passwords (all lowercase hex + hyphens) are rejected internally — likely fails Supabase password strength/entropy check even via admin API.
**What was tried (wrong paths):**
- Dropped `on_auth_user_created` trigger → didn't fix it
- Removed `user_metadata` → didn't fix it
- Lowercased email → didn't fix it
**What fixed it:** Changed password to `randomBytes(24).toString('base64') + 'Aa1!'`
**Debugging method that found it:** Build a debug API route that tests the EXACT function call parameter-by-parameter in isolation:
```typescript
// Test A: fixed password → OK
// Test B: UUID password → FAIL ← isolated the bug
// Test C: randomBytes password → OK ← confirmed fix
```
**Rule:** For `unexpected_failure` from Supabase auth admin API:
1. Build debug endpoint that clones the EXACT call with each parameter tested in isolation
2. Never use UUID strings as passwords — use `randomBytes(24).toString('base64') + 'Aa1!'`
3. Don't chase triggers/metadata/email before isolating the password variable

## Lesson 11: invoices.created_by FK must reference auth.users, not public.users
**Date:** 2026-06-10
**Error:** `createInvoice` server action fails silently in production. Next.js strips real error message → generic "An error occurred in the Server Components render" shown as Sonner toast.
**Root cause:** Migration 001 created `invoices.created_by REFERENCES public.users(id)` and `stock_history.created_by REFERENCES public.users(id)`. But admin user may have been created in Supabase BEFORE migration 001 ran → admin exists in `auth.users` + `profiles` but NOT in `public.users`. FK violation on invoice insert.
**What fixed it:** Run this SQL to fix FK constraints + backfill missing users:
```sql
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_created_by_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.stock_history DROP CONSTRAINT IF EXISTS stock_history_created_by_fkey;
ALTER TABLE public.stock_history ADD CONSTRAINT stock_history_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.stock_in DROP CONSTRAINT IF EXISTS stock_in_created_by_fkey;
ALTER TABLE public.stock_in ADD CONSTRAINT stock_in_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

INSERT INTO public.users (id, email, name, role)
SELECT au.id, au.email, COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)), 'staff'
FROM auth.users au LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL ON CONFLICT (id) DO NOTHING;
```
**Rule:** Any `created_by` column that stores `auth.uid()` must reference `auth.users(id)`, NOT `public.users(id)`. Public.users is an auxiliary mirror — it can lag. Auth.users is the source of truth for authentication.
**Debugging note:** Production Next.js strips real server action errors. When user sees generic error on button click, check Vercel logs OR temporarily add `console.error(err)` in server action + check Vercel Function logs to see actual DB error.

### What Is Actually Remaining (if any)
- Bug fixes and QA as discovered in real use
- Any NEW features the user requests beyond original spec
- Do NOT re-build anything listed above — it already exists

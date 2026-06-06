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

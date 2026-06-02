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

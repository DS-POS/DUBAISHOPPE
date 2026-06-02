# DS POS — Claude Instructions

## Response Style
Keep responses concise, under 500 words unless asked for full code.

Workflow Orchestration

1. Plan Mode Default
Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
If something goes sideways, STOP and re-plan immediately - don't keep pushing
Use plan mode for verification steps, not just building
Write detailed specs upfront to reduce ambiguity
2. Subagent Strategy
Use subagents liberally to keep main context window clean
Offload research, exploration, and parallel analysis to subagents
For complex problems, throw more compute at it via subagents
One task per subagent for focused execution
3. Self-Improvement Loop
After ANY correction from the user: update tasks/lessons.md with the pattern
Write rules for yourself that prevent the same mistake
Ruthlessly iterate on these lessons until mistake rate drops
Review lessons at session start for relevant project
4. Verification Before Done
Never mark a task complete without proving it works
Diff behavior between main and your changes when relevant
Ask yourself: "Would a staff engineer approve this?"
Run tests, check logs, demonstrate correctness
5. Demand Elegance (Balanced)
For non-trivial changes: pause and ask "is there a more elegant way?"
If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
Skip this for simple, obvious fixes - don't over-engineer
Challenge your own work before presenting it
6. Autonomous Bug Fixing
When given a bug report: just fix it. Don't ask for hand-holding
Point at logs, errors, failing tests - then resolve them
Zero context switching required from the user
Go fix failing CI tests without being told how
Task Management
Plan First: Write plan to tasks/todo.md with checkable items
Verify Plan: Check in before starting implementation
Track Progress: Mark items complete as you go
Explain Changes: High-level summary at each step
Document Results: Add review section to tasks/todo.md
Capture Lessons: Update tasks/lessons.md after corrections
Core Principles
Simplicity First: Make every change as simple as possible. Impact minimal code.
No Laziness: Find root causes. No temporary fixes. Senior developer standards.
Minimal Impact: Changes should only touch what's necessary. Avoid introducing bugs.

# CLAUDE.md — DS POS

## Project Name

DS POS

## Project Type

Production-grade POS system for a professional camera and equipment store.

This is NOT a prototype or demo project.

The system must be production-ready, scalable, maintainable, and optimized for real-world retail operations.

---

# PRIMARY OBJECTIVE

Build a modern POS system with:

* Inventory management
* Barcode scan IN / scan OUT
* GST billing
* Invoice PDF generation
* WhatsApp invoice sharing
* Email invoice sharing
* Barcode label printing
* Reports & exports
* Tally XML export
* Offline billing support (PWA)

---

# CURRENT STATUS

## Current Active Phase

Phase 1D — Billing + GST invoice + PDF + share

### Completed

* Task 1A — Foundation
* Task 1B — Inventory
* Task 1C — Stock In + serial tracking

### Pending

* Task 1D — Billing module

Always continue from latest incomplete task.

Never restart completed work.

---

# DEVELOPMENT RULES

## CRITICAL RULES

### 1. NEVER BREAK EXISTING FEATURES

Before editing:

* inspect related files
* verify dependencies
* preserve working functionality

### 2. BUILD REAL FEATURES ONLY

No mock data.
No fake buttons.
No placeholder business logic.

Every feature must work end-to-end.

### 3. ALWAYS USE TYPESCRIPT

No plain JavaScript.

### 4. STRICTLY FOLLOW APP ROUTER

Use:

* Next.js 14 App Router
* Server Actions
* Route groups
* Protected layouts

### 5. MOBILE RESPONSIVE REQUIRED

POS must work on:

* Desktop
* Tablet
* Mobile browser

### 6. OPTIMIZE FOR SPEED

POS software must prioritize:

* fast rendering
* minimal clicks
* keyboard workflows
* barcode workflows

Avoid heavy animations.

---

# REQUIRED SKILL PRIORITY

Use these skills in this order when appropriate:

## Core Workflow

* subagent-driven-development
* writing-plans
* executing-plans
* verification-before-completion
* systematic-debugging
* test-driven-development
* finishing-a-development-branch

## UI/UX

* ui-ux-pro-max
* frontend-design

## Memory / Context

* learn-codebase
* mem-search
* smart-explore
* knowledge-agent
* timeline-report

## Code Quality

* code-review
* simplify
* security-review
* verify

## Caveman Workflow

* cavecrew
* caveman
* caveman-review
* caveman-commit

---

# MCP TOOLS AVAILABLE

## Connected MCPs

* Supabase MCP
* Playwright MCP
* Figma MCP

Use them actively.

---

# SUPABASE RULES

## ALWAYS USE

* Supabase Auth
* Supabase PostgreSQL
* Row Level Security where required

## DATABASE RULES

* Never hardcode IDs
* Use UUIDs
* Use proper foreign keys
* Use migrations

## STORAGE RULES

Use Supabase Storage for:

* product images
* invoice PDFs
* exports if needed

---

# PLAYWRIGHT RULES

After major UI or billing changes:

1. Launch app
2. Test complete workflow
3. Verify no console errors
4. Verify responsive layouts
5. Verify billing calculations

Always validate:

* stock deduction
* GST calculations
* invoice generation
* barcode workflow

---

# FIGMA RULES

When designing new modules:

* use ui-ux-pro-max
* create professional POS layouts
* maintain design consistency

Design language:

* modern retail POS
* navy + slate + blue CTA
* clean grids
* large touch targets
* keyboard-first UX

---

# CODING STANDARDS

## FILE STRUCTURE

Keep structure clean and scalable.

Use:

* reusable components
* modular actions
* typed utilities

## COMPONENT RULES

Prefer:

* server components where possible
* client components only when needed

## FORM RULES

Use:

* react-hook-form
* zod validation

## UI RULES

Use:

* shadcn/ui
* Tailwind CSS
* consistent spacing
* proper loading states
* empty states
* error states

---

# BILLING RULES

## MUST SUPPORT

* barcode scan workflow
* keyboard navigation
* quantity shortcuts
* serial number selection
* GST auto calculation

## STOCK RULES

* block invoice if insufficient stock
* deduct stock only after successful invoice save

## SERIAL RULES

* required products must select serial
* mark serial sold after invoice

---

# GST RULES

Store State:
Telangana

Logic:

* Telangana customer → CGST + SGST
* Other states → IGST

GST calculations must be accurate per line item.

Never use approximations.

---

# INVOICE RULES

Invoice format:
INV-000001

Requirements:

* unique
* sequential
* server-generated
* never editable

---

# OFFLINE MODE RULES

Use:

* PWA
* IndexedDB
* Dexie.js
* Service Workers

Offline billing must:

* continue working
* queue invoices
* sync automatically later

---

# REPORT RULES

All reports must support:

* Excel export
* CSV export

Tally exports must generate:

* valid XML
* accountant-friendly structure

---

# TALLY XML RULES

Do NOT implement live Tally sync yet.

Only implement:

* XML export
* ledger mapping
* export logs

Exports must support:

* sales vouchers
* purchase vouchers
* stock masters
* ledger masters

---

# SECURITY RULES

Never expose:

* service role keys
* private env variables

Validate:

* all server actions
* all mutations
* all auth checks

---

# GIT RULES

Before major changes:

* create clean commits
* keep commits modular
* descriptive commit messages

Use:

* caveman-commit
* caveman-review

---

# TASK EXECUTION FORMAT

For every task:

1. Analyze requirement
2. Explore codebase
3. Create implementation plan
4. Implement safely
5. Verify functionality
6. Run Playwright tests
7. Run lint/typecheck
8. Summarize changes

Never skip verification.

---

# REQUIRED COMMANDS BEFORE COMPLETION

Always run before task completion:

```bash
npm run lint
npm run typecheck
npm run build
```

Then:

* verify no errors
* verify app still runs

---

# CURRENT PRIORITY TASK

Continue Task 1D:

Build:

* billing screen
* GST calculation
* invoice creation
* invoice PDF
* WhatsApp sharing
* email invoice
* stock deduction logic
* serial number billing logic

Do not move to next phase until Task 1D is fully verified.

---

# PROJECT PHILOSOPHY

This software must feel like:

* modern
* fast
* reliable
* professional

Prioritize:

* business logic
* stability
* usability

over:

* flashy animations
* unnecessary complexity

This is a real business POS system.

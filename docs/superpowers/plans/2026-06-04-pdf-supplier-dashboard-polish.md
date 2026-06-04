# PDF Logo Fix + Supplier & Dashboard Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix logo loading in PDF, redesign PDF layout with proper dividers, apply warm neutral palette to Supplier pages, and lighten Dashboard stat cards.

**Architecture:** Four independent tasks — each touches isolated files. PDF task fixes the logo path (file is `DUBAI LOGO BR.png` not `logo.png`) and restructures the header/footer layout using `@react-pdf/renderer`. Supplier and Dashboard tasks apply Tailwind class swaps only — no logic changes.

**Tech Stack:** Next.js 14 App Router, `@react-pdf/renderer`, Tailwind CSS, shadcn/ui

**Color palette (warm neutral):**
- `#9A8472` — Warm Taupe (primary)
- `#7A6558` — Hover
- `#5C4A3A` — Dark
- `#C8B39A` — Sandy Beige (borders/accents)
- `#E0D1B8` — Oatmeal (light border)
- `#F6F0E6` — Light bg (table headers, badges)
- `#FAF7F2` — Ivory (page bg)
- `#EFE3CE` — Vanilla Cream (card bg)

---

## File Map

| File | Change |
|------|--------|
| `components/invoices/InvoicePDF.tsx` | Fix logo path + redesign header/footer with dividers |
| `public/invoice-mockup.html` | Update mockup to match new PDF layout |
| `components/suppliers/SupplierList.tsx` | Table header bg, row hover, button colors |
| `app/(dashboard)/suppliers/[id]/page.tsx` | Stat card colors, table header/hover, icon bg |
| `app/(dashboard)/dashboard/page.tsx` | Stat card bg/icon colors → warm neutral palette |

---

## Task 1: Fix PDF Logo Path + Header Divider Layout

**Root cause:** Logo file in `public/` is named `DUBAI LOGO BR.png` (with spaces), but code references `logo.png`. Also header needs: logo | vertical divider | store details layout, and bottom border strip with email/phone/name separated by dividers.

**Files:**
- Modify: `components/invoices/InvoicePDF.tsx`

- [ ] **Step 1: Fix logo filename**

In `components/invoices/InvoicePDF.tsx`, change line:
```ts
const _logoPath = path.join(process.cwd(), 'public', 'logo.png')
```
to:
```ts
const _logoPath = path.join(process.cwd(), 'public', 'DUBAI LOGO BR.png')
```

- [ ] **Step 2: Redesign header — logo + vertical divider + store details**

Replace the entire `s = StyleSheet.create({...})` block and JSX header section.

New styles to add inside `StyleSheet.create`:
```ts
  // Header layout
  logoImg: { width: 60, height: 60, objectFit: 'contain' },
  headerDividerV: { width: 1, backgroundColor: '#C8B39A', marginHorizontal: 12, alignSelf: 'stretch' },
  // Bottom border strip
  borderBottom: {
    backgroundColor: '#FAF7F2',
    borderTopWidth: 1.5,
    borderTopColor: '#C8B39A',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  borderBottomText: { fontSize: 7.5, color: '#5C4A3A', fontFamily: 'Helvetica-Bold' },
  borderBottomSep: { fontSize: 7.5, color: '#C8B39A', marginHorizontal: 6 },
```

Remove old `borderBottom` style. Update old `logo` style to `logoImg`.

- [ ] **Step 3: New header JSX**

Replace the `{/* Header */}` View block with:
```tsx
{/* Header */}
<View style={s.header}>
  <View style={s.logoBlock}>
    <Image src={LOGO_SRC} style={s.logoImg} />
    <View style={s.headerDividerV} />
    <View>
      <Text style={s.storeName}>{STORE.name}</Text>
      <Text style={s.storeTagline}>A Professional Camera Store</Text>
      <Text style={s.storeDetail}>{STORE.address}</Text>
      <Text style={s.storeDetail}>{STORE.city}</Text>
      <Text style={s.storeDetail}>Ph: {STORE.phone}</Text>
      <Text style={s.storeDetail}>Email: {STORE.email}</Text>
      <View style={s.gstnBadge}>
        <Text style={s.gstnText}>GSTIN: {STORE.gstin} | State: {STORE.state} ({STORE.state_code})</Text>
      </View>
    </View>
  </View>
  <View>
    <Text style={s.invoiceTitle}>TAX INVOICE</Text>
    <Text style={s.invoiceDetail}>Invoice No: {invoice.invoice_no}</Text>
    <Text style={s.invoiceDetail}>Date: {new Date(invoice.created_at).toLocaleDateString('en-IN')}</Text>
    <Text style={s.invoiceDetail}>Payment: {invoice.payment_method?.toUpperCase()}</Text>
  </View>
</View>
```

- [ ] **Step 4: New bottom border JSX**

Replace `{/* Bottom border */}` with:
```tsx
{/* Bottom border */}
<View style={s.borderBottom}>
  <Text style={s.borderBottomText}>{STORE.email}</Text>
  <Text style={s.borderBottomSep}>|</Text>
  <Text style={s.borderBottomText}>{STORE.phone}</Text>
  <Text style={s.borderBottomSep}>|</Text>
  <Text style={s.borderBottomText}>{STORE.name} — GSTIN: {STORE.gstin}</Text>
</View>
```

- [ ] **Step 5: Add dividers between PDF sections**

Add a horizontal divider between Bill To and the items table. Ensure `s.divider` and `s.greenDivider` are defined:
```ts
divider: { borderBottomWidth: 0.5, borderBottomColor: '#E0D1B8', marginVertical: 8 },
greenDivider: { borderBottomWidth: 1, borderBottomColor: '#C8B39A', marginVertical: 10 },
```

- [ ] **Step 6: Run typecheck**

```bash
npx tsc --noEmit
```
Expected: no output (zero errors)

- [ ] **Step 7: Test PDF in browser**

Start dev server, open any invoice, click PDF. Verify:
- Logo visible on left side of header
- Vertical line divider between logo and store details
- Store name, address, phone, email, GSTIN all present
- Bottom strip shows: email | phone | store name + GSTIN
- No green anywhere

---

## Task 2: Update Invoice Mockup HTML

**Files:**
- Modify: `public/invoice-mockup.html`

- [ ] **Step 1: Fix logo src**

Change `<img src="/logo.png"` to `<img src="/DUBAI LOGO BR.png"` in the mockup.

- [ ] **Step 2: Add vertical divider between logo and store details**

Wrap logo + store text in flex row with a `<div class="vdivider"></div>` between them.

Add CSS:
```css
.vdivider { width: 1px; background: #C8B39A; margin: 0 14px; align-self: stretch; }
```

- [ ] **Step 3: Update bottom border to light strip**

```css
.border-bottom {
  background: #FAF7F2;
  border-top: 1.5px solid #C8B39A;
  margin-top: auto;
  padding: 7px 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
}
.border-bottom span.label { font-size: 8px; color: #5C4A3A; font-weight: 700; }
.border-bottom span.sep { font-size: 8px; color: #C8B39A; margin: 0 8px; }
```

HTML:
```html
<div class="border-bottom">
  <span class="label">Dubaishoppe_hyd@yahoo.com</span>
  <span class="sep">|</span>
  <span class="label">+91 9885878645 / +91 9866141485</span>
  <span class="sep">|</span>
  <span class="label">DUBAI SHOPPE — GSTIN: 36ALBPM0907C1ZO</span>
</div>
```

---

## Task 3: Supplier List — Warm Neutral Palette + Hover Effects

**Files:**
- Modify: `components/suppliers/SupplierList.tsx`
- Modify: `app/(dashboard)/suppliers/[id]/page.tsx`

### SupplierList.tsx

- [ ] **Step 1: Table header background**

Change `thead` class from `bg-muted/50 border-b border-border` to:
```
bg-[#F6F0E6] border-b border-[#E0D1B8]
```

Change `th` text color from `text-muted-foreground` to `text-[#5C4A3A]`.

- [ ] **Step 2: Row hover + alternating bg**

Change even rows from `bg-background` to `bg-[#FAF7F2]`.
Change odd rows from `bg-muted/20` to `bg-[#F6F0E6]/40`.

Add hover to `<tr>`:
```
hover:bg-[#EFE3CE]/60 transition-colors cursor-pointer
```

- [ ] **Step 3: View/Edit/Delete link colors**

```tsx
// View
className="text-xs text-[#9A8472] hover:text-[#5C4A3A] font-semibold transition-colors"

// Edit
className="text-xs text-slate-500 hover:text-[#9A8472] transition-colors"

// Delete
className="text-xs text-red-500 hover:text-red-700 transition-colors"
```

- [ ] **Step 4: Add Supplier button — warm taupe**

Change `<Button>` for "Add Supplier" to:
```tsx
<Button className="bg-[#9A8472] hover:bg-[#7A6558] text-white">
  <PlusIcon className="size-4 mr-2" />
  Add Supplier
</Button>
```

### suppliers/[id]/page.tsx

- [ ] **Step 5: Stat card icon backgrounds**

Change `bg-slate-100` icon wrappers to `bg-[#F6F0E6]`.
Change icon colors from `text-slate-500` to `text-[#9A8472]`.

- [ ] **Step 6: Invoice table header**

Change `thead` from `bg-slate-50 border-b border-slate-100` to:
```
bg-[#F6F0E6] border-b border-[#E0D1B8]
```
Change `th` text from `text-slate-500` to `text-[#5C4A3A]`.

- [ ] **Step 7: Invoice table row hover**

Change `hover:bg-slate-50/70` to `hover:bg-[#EFE3CE]/50`.

- [ ] **Step 8: Amount Due stat card color**

The amount due text currently uses `text-emerald-600` for zero. Change to:
```tsx
className={`text-2xl font-black mt-1 ${totalDue > 0 ? 'text-red-600' : 'text-[#9A8472]'}`}
```

---

## Task 4: Dashboard — Light Warm Neutral Stat Cards

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

The current stat cards use random colors (cyan, lime, rose, purple, zinc). Replace all with warm neutral shades from the palette.

- [ ] **Step 1: Today's Sales card**

```tsx
// Before:
<div className="bg-cyan-50 rounded-2xl p-6 ring-1 ring-black/[0.06] shadow-sm">
  <div className="inline-flex items-center justify-center bg-cyan-100 text-cyan-700 rounded-xl p-2 mb-3">
// After:
<div className="bg-[#FAF7F2] rounded-2xl p-6 ring-1 ring-[#E0D1B8] shadow-sm">
  <div className="inline-flex items-center justify-center bg-[#F6F0E6] text-[#9A8472] rounded-xl p-2 mb-3">
```
Change link: `text-cyan-700` → `text-[#9A8472]`

- [ ] **Step 2: Total Revenue card**

```tsx
// Before: bg-lime-50, bg-lime-100, text-lime-700
// After:
<div className="bg-[#F6F0E6] rounded-2xl p-6 ring-1 ring-[#E0D1B8] shadow-sm">
  <div className="inline-flex items-center justify-center bg-[#EFE3CE] text-[#7A6558] rounded-xl p-2 mb-3">
```
Change link: `text-lime-700` → `text-[#7A6558]`

- [ ] **Step 3: Due from Customers card (keep red — it's a warning)**

Keep `bg-rose-50`, `bg-rose-100`, `text-rose-600` — red for dues is semantic and correct. Do not change.

- [ ] **Step 4: Due to Suppliers card**

```tsx
// Before: bg-purple-50, bg-purple-100, text-purple-600/700
// After:
<div className="bg-[#EFE3CE] rounded-2xl p-6 ring-1 ring-[#C8B39A] shadow-sm">
  <div className="inline-flex items-center justify-center bg-[#E0D1B8] text-[#5C4A3A] rounded-xl p-2 mb-3">
```
Change link: `text-purple-700` → `text-[#5C4A3A]`

- [ ] **Step 5: Total Invoices card**

```tsx
// Before: bg-zinc-50, bg-zinc-200, text-zinc-600
// After:
<div className="bg-white rounded-2xl p-6 ring-1 ring-[#E0D1B8] shadow-sm">
  <div className="inline-flex items-center justify-center bg-[#F6F0E6] text-[#9A8472] rounded-xl p-2 mb-3">
```
Change link: `text-zinc-600` → `text-[#9A8472]`

- [ ] **Step 6: Table headers in dashboard**

Any `bg-slate-50/80` table headers → `bg-[#F6F0E6]/80`.
Any `divide-slate-100` → `divide-[#E0D1B8]`.

- [ ] **Step 7: Run typecheck**

```bash
npx tsc --noEmit
```
Expected: no output

---

## Self-Review

**Spec coverage:**
- ✅ Logo fix — Task 1 (path `DUBAI LOGO BR.png`)
- ✅ Logo left side with divider — Task 1 Step 3
- ✅ Bottom border light, black text, email|divider|phone — Task 1 Step 4 + Task 2 Step 3
- ✅ Dividers everywhere in PDF — Task 1 Steps 2/5
- ✅ Supplier table colors + hover — Task 3
- ✅ Dashboard light colors — Task 4
- ✅ Mockup HTML updated — Task 2

**Placeholder scan:** None found — all steps have exact code.

**Type consistency:** No new types introduced. All changes are Tailwind/style only except logo path fix.

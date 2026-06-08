# Operations Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three hardware/print improvements: (1) USB barcode scanner auto-focus on billing page, (2) 80mm thermal receipt printing, (3) batch label printing with multi-select.

**Architecture:** Barcode scanner uses keyboard-wedge mode (scanner sends keystrokes) — a global keydown listener on the billing page captures rapid keystrokes ending with Enter and treats it as a barcode scan. Thermal receipt: print-optimized CSS `@media print` stylesheet renders a 80mm receipt. Batch labels: checkbox multi-select on Labels page feeds existing label layout into a print sheet.

**Tech Stack:** Next.js 14 App Router, TypeScript, browser Print API (no new libraries)

---

## File Map

| File | Change |
|------|--------|
| `components/billing/BarcodeScanner.tsx` | CREATE — global barcode scanner hook |
| `components/billing/BillingForm.tsx` | Modify — use barcode scanner hook |
| `app/(dashboard)/billing/page.tsx` | Modify — ensure products with barcode field available |
| `components/invoice/ThermalReceipt.tsx` | CREATE — 80mm thermal receipt component |
| `app/(dashboard)/invoices/[id]/page.tsx` | Modify — add Print Receipt button |
| `app/(dashboard)/labels/page.tsx` | Modify — add multi-select + batch print |
| `public/thermal-print.css` | CREATE — 80mm thermal print CSS |

---

### Task 1: Barcode Scanner Hook

**Files:**
- Create: `components/billing/BarcodeScanner.tsx`

- [ ] **Step 1: Create useBarcodeScanner hook**

USB barcode scanners work in "keyboard wedge" mode: they type characters very fast then send Enter. We detect this by measuring inter-keystroke timing.

```typescript
// components/billing/BarcodeScanner.tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'

const SCAN_THRESHOLD_MS = 50  // keystrokes faster than this = scanner, not human

interface UseBarcodeScanner {
  onScan: (barcode: string) => void
  enabled: boolean
}

export function useBarcodeScanner({ onScan, enabled }: UseBarcodeScanner) {
  const buffer = useRef<string>('')
  const lastKeyTime = useRef<number>(0)
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept when typing in an input/textarea
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (!enabled) return

    const now = Date.now()
    const delta = now - lastKeyTime.current
    lastKeyTime.current = now

    if (e.key === 'Enter') {
      const code = buffer.current.trim()
      buffer.current = ''
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
      if (code.length >= 4) {  // valid barcode length
        onScan(code)
      }
      return
    }

    // If gap between keystrokes > threshold, this is human typing — clear buffer
    if (delta > 500 && buffer.current.length > 0) {
      buffer.current = ''
    }

    if (e.key.length === 1) {
      buffer.current += e.key
    }

    // Auto-clear buffer after 200ms of no input (handles scanners without Enter)
    if (bufferTimer.current) clearTimeout(bufferTimer.current)
    bufferTimer.current = setTimeout(() => {
      const code = buffer.current.trim()
      buffer.current = ''
      if (code.length >= 8) {  // auto-trigger for EAN-8 minimum
        onScan(code)
      }
    }, 200)
  }, [onScan, enabled])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
    }
  }, [handleKeyDown])
}
```

- [ ] **Step 2: Commit**

```bash
git add components/billing/BarcodeScanner.tsx
git commit -m "feat(ops): useBarcodeScanner hook — USB keyboard-wedge barcode detection"
```

---

### Task 2: Wire barcode scanner to billing

**Files:**
- Modify: `components/billing/BillingForm.tsx`

- [ ] **Step 1: Import and use the hook in BillingForm**

Add import at top:
```typescript
import { useBarcodeScanner } from './BarcodeScanner'
```

- [ ] **Step 2: Add barcode scan handler inside BillingForm component**

Add inside the component, after the `addProduct` function:
```typescript
function handleBarcodeScan(barcode: string) {
  const found = products.find(p => p.barcode === barcode || p.sku === barcode)
  if (found) {
    addProduct(found)
    // Brief visual feedback
    const el = document.querySelector('[data-barcode-status]')
    if (el) {
      el.textContent = `✓ ${found.name} added`
      el.className = 'text-xs text-emerald-600 font-medium h-4'
      setTimeout(() => { if(el) el.textContent = '' }, 2000)
    }
  } else {
    const el = document.querySelector('[data-barcode-status]')
    if (el) {
      el.textContent = `Barcode not found: ${barcode}`
      el.className = 'text-xs text-red-500 font-medium h-4'
      setTimeout(() => { if(el) el.textContent = '' }, 2000)
    }
  }
}

useBarcodeScanner({ onScan: handleBarcodeScan, enabled: true })
```

- [ ] **Step 3: Add barcode status indicator to BillingForm JSX**

In the product search area, add below `<ProductSearch>`:
```tsx
<p data-barcode-status className="text-xs h-4 text-emerald-600 font-medium" />
```

- [ ] **Step 4: Commit**

```bash
git add components/billing/BillingForm.tsx
git commit -m "feat(ops): barcode scanner wired to billing — scan adds product to cart"
```

---

### Task 3: Thermal Receipt component

**Files:**
- Create: `public/thermal-print.css`
- Create: `components/invoice/ThermalReceipt.tsx`
- Modify: `app/(dashboard)/invoices/[id]/page.tsx`

- [ ] **Step 1: Create public/thermal-print.css**

```css
/* Thermal receipt print styles — 80mm paper width */
@media print {
  /* Hide everything except the receipt */
  body > * { display: none !important; }
  #thermal-receipt { display: block !important; }

  @page {
    size: 80mm auto;
    margin: 2mm 3mm;
  }

  #thermal-receipt {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: #000;
    width: 72mm;
    line-height: 1.4;
  }

  #thermal-receipt .divider {
    border-top: 1px dashed #000;
    margin: 4px 0;
  }
  #thermal-receipt .center { text-align: center; }
  #thermal-receipt .bold { font-weight: bold; }
  #thermal-receipt .large { font-size: 14px; }
  #thermal-receipt .small { font-size: 9px; }
  #thermal-receipt table { width: 100%; border-collapse: collapse; }
  #thermal-receipt td { padding: 1px 0; vertical-align: top; }
  #thermal-receipt .r { text-align: right; }
}
```

- [ ] **Step 2: Create ThermalReceipt.tsx**

```tsx
'use client'

import { useEffect } from 'react'
import type { Invoice } from '@/types/database'

interface Props { invoice: Invoice }

export function ThermalReceipt({ invoice }: Props) {
  useEffect(() => {
    // Inject print CSS only when component mounts
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/thermal-print.css'
    link.id = 'thermal-css'
    if (!document.getElementById('thermal-css')) {
      document.head.appendChild(link)
    }
    return () => { document.getElementById('thermal-css')?.remove() }
  }, [])

  const items = invoice.invoice_items ?? []
  const storeName = 'DUBAI SHOPPE'
  const storePhone = '+91 99999 99999'  // TODO: pull from settings
  const storeAddress = 'Hyderabad, Telangana'

  return (
    <div id="thermal-receipt" style={{ display: 'none' }}>
      {/* Header */}
      <div className="center bold large">{storeName}</div>
      <div className="center small">{storeAddress}</div>
      <div className="center small">Ph: {storePhone}</div>
      <div className="divider" />

      {/* Invoice info */}
      <table>
        <tbody>
          <tr><td>Invoice:</td><td className="r bold">{invoice.invoice_no}</td></tr>
          <tr><td>Date:</td><td className="r">{new Date(invoice.created_at).toLocaleDateString('en-IN')}</td></tr>
          {invoice.customers && (
            <tr><td>Customer:</td><td className="r">{invoice.customers.name}</td></tr>
          )}
        </tbody>
      </table>
      <div className="divider" />

      {/* Items */}
      <table>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td colSpan={2}>
                <div>{item.product_name}</div>
                <div className="small">
                  {item.quantity} x ₹{Number(item.rate).toFixed(2)}
                  {item.gst_rate > 0 ? ` + ${item.gst_rate}% GST` : ''}
                </div>
              </td>
              <td className="r bold">₹{Number(item.total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="divider" />

      {/* Totals */}
      <table>
        <tbody>
          {invoice.taxable_amount > 0 && (
            <tr><td>Taxable Amt:</td><td className="r">₹{Number(invoice.taxable_amount).toFixed(2)}</td></tr>
          )}
          {invoice.cgst > 0 && (
            <tr><td>CGST:</td><td className="r">₹{Number(invoice.cgst).toFixed(2)}</td></tr>
          )}
          {invoice.sgst > 0 && (
            <tr><td>SGST:</td><td className="r">₹{Number(invoice.sgst).toFixed(2)}</td></tr>
          )}
          {invoice.igst > 0 && (
            <tr><td>IGST:</td><td className="r">₹{Number(invoice.igst).toFixed(2)}</td></tr>
          )}
          {/* Non-taxable items */}
          {items.filter(i => !i.is_taxable).map(item => (
            <tr key={item.id}>
              <td>{item.product_name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}:</td>
              <td className="r">₹{Number(item.total).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="divider" />
      <table>
        <tbody>
          <tr className="bold large">
            <td>TOTAL:</td>
            <td className="r">₹{Number(invoice.grand_total).toFixed(2)}</td>
          </tr>
          <tr><td>Payment:</td><td className="r capitalize">{invoice.payment_method?.replace('_',' ')}</td></tr>
        </tbody>
      </table>
      <div className="divider" />
      <div className="center small">Thank you for your purchase!</div>
      <div className="center small">Goods once sold will not be taken back</div>
    </div>
  )
}
```

- [ ] **Step 3: Add Print Receipt button to invoice detail page**

In `app/(dashboard)/invoices/[id]/page.tsx`, add a "Print Receipt" button that:
1. Renders `<ThermalReceipt invoice={invoice} />` on the page (hidden)
2. On click: calls `window.print()`

```tsx
'use client'
// Add this PrintReceiptButton as a small client component
function PrintReceiptButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
    >
      <PrinterIcon className="size-4" />
      Print Receipt
    </button>
  )
}
```

Include `<ThermalReceipt invoice={invoice} />` and `<PrintReceiptButton />` in the invoice detail page.

- [ ] **Step 4: Commit**

```bash
git add public/thermal-print.css components/invoice/ThermalReceipt.tsx app/(dashboard)/invoices/[id]/page.tsx
git commit -m "feat(ops): thermal receipt — 80mm print layout + Print Receipt button on invoice"
```

---

### Task 4: Batch Label Print

**Files:**
- Modify: `app/(dashboard)/labels/page.tsx`

- [ ] **Step 1: Read the existing labels page to understand its structure**

Run: `cat app/(dashboard)/labels/page.tsx`

- [ ] **Step 2: Add multi-select state to labels page**

The labels page currently shows products and prints individual labels. Convert to a client component with multi-select:

```typescript
// At top of the client component
const [selected, setSelected] = useState<Set<string>>(new Set())

function toggleSelect(id: string) {
  setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}

function selectAll() {
  setSelected(new Set(products.map(p => p.id)))
}

function clearSelection() {
  setSelected(new Set())
}
```

- [ ] **Step 3: Add selection UI to each product row/card**

Add a checkbox before each product in the labels list:
```tsx
<input
  type="checkbox"
  checked={selected.has(product.id)}
  onChange={() => toggleSelect(product.id)}
  className="size-4 rounded"
/>
```

- [ ] **Step 4: Add batch print button**

Add a sticky bottom bar that appears when items are selected:
```tsx
{selected.size > 0 && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#111827] text-white rounded-2xl px-6 py-3 flex items-center gap-4 shadow-2xl">
    <span className="text-sm font-medium">{selected.size} item{selected.size !== 1 ? 's' : ''} selected</span>
    <button
      onClick={() => {
        // Filter selected products and trigger print
        const printProducts = products.filter(p => selected.has(p.id))
        sessionStorage.setItem('label_print_batch', JSON.stringify(printProducts))
        window.print()
      }}
      className="px-4 py-1.5 bg-white text-[#111827] rounded-xl text-sm font-semibold hover:bg-slate-100 transition-colors"
    >
      Print {selected.size} Labels
    </button>
    <button onClick={clearSelection} className="text-slate-400 hover:text-white text-sm">
      Clear
    </button>
  </div>
)}
```

- [ ] **Step 5: Add print CSS for batch labels**

Add to the existing labels print CSS (or create `@media print` block):
```css
@media print {
  /* Show selected labels in a grid layout for label sheets */
  .label-card { page-break-inside: avoid; }
  .label-card:not(.selected) { display: none; }
  /* 3 labels per row on A4 */
  .labels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
}
```

- [ ] **Step 6: Add "Select All" button to labels page header**

```tsx
<div className="flex items-center gap-3">
  <button onClick={selectAll} className="text-sm text-[#111827] font-medium hover:underline">
    Select All ({products.length})
  </button>
  {selected.size > 0 && (
    <button onClick={clearSelection} className="text-sm text-slate-500 hover:underline">
      Clear
    </button>
  )}
</div>
```

- [ ] **Step 7: Commit**

```bash
git add app/(dashboard)/labels/
git commit -m "feat(ops): batch label print — multi-select + print selected labels"
```

---

### Task 5: Typecheck + verify

- [ ] **Step 1: Run typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Test barcode scanner**

1. Go to Billing page
2. Open browser console
3. Run: `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'A', bubbles: true }))` followed quickly by other chars + Enter — OR — use a USB barcode scanner on a product with a barcode
4. Verify product is added to cart
5. Verify "not found" message appears when unknown barcode scanned

- [ ] **Step 3: Test thermal receipt**

1. Open an invoice detail page
2. Click "Print Receipt"
3. Browser print dialog should show 80mm receipt layout
4. Verify: store name, invoice number, items, GST breakdown, grand total all visible

- [ ] **Step 4: Test batch labels**

1. Go to Labels page
2. Select 3 products via checkboxes
3. Sticky bottom bar appears with "Print 3 Labels"
4. Click Print — browser print dialog shows only selected product labels
5. "Select All" selects all products

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(ops): complete operations polish — barcode scanner + thermal receipt + batch labels"
```

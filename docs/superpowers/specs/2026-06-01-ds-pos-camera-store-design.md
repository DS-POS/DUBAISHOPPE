# DS POS — Camera Store POS System
**Date:** 2026-06-01
**Status:** Approved
**Store Location:** Hyderabad, Telangana, India

---

## 1. Project Overview

Full-stack POS system for a professional camera and equipment store. Production-ready with database, inventory, billing, barcode labels, GST invoicing, and Tally XML export.

**Not a demo.** Every feature must work end-to-end.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| UI | React + Tailwind CSS + shadcn/ui |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage (product images) |
| PDF | @react-pdf/renderer |
| Barcode generate | react-barcode |
| Barcode scan | @zxing/library |
| Excel export | xlsx (SheetJS) |
| XML export | fast-xml-parser |
| Email | Resend |
| Deploy | Vercel |
| Offline | PWA + Service Worker + IndexedDB (Dexie.js) |

---

## 3. Architecture

Single Next.js 14 monolith using App Router + Server Actions for all mutations. No separate backend. Supabase handles DB, Auth, and file storage.

```
DS POS (Next.js 14)
├── app/                     # App Router pages
│   ├── (auth)/login/        # Login page
│   ├── (dashboard)/         # Protected routes
│   │   ├── dashboard/
│   │   ├── products/
│   │   ├── stock-in/
│   │   ├── billing/
│   │   ├── invoices/
│   │   ├── customers/
│   │   ├── labels/
│   │   ├── reports/
│   │   ├── tally-export/
│   │   └── settings/
├── components/              # Shared UI components
├── lib/                     # Supabase client, utilities
├── actions/                 # Server Actions (mutations)
├── types/                   # TypeScript types
└── docs/                    # Specs and design docs
```

---

## 4. Database Schema

### users
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
name text NOT NULL
email text UNIQUE NOT NULL
role text NOT NULL CHECK (role IN ('admin', 'staff'))
created_at timestamptz DEFAULT now()
```

### categories
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
name text NOT NULL
created_at timestamptz DEFAULT now()
```

### products
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
name text NOT NULL
sku text UNIQUE NOT NULL
barcode text UNIQUE
category_id uuid REFERENCES categories(id)
brand text
cost_price numeric(10,2) NOT NULL DEFAULT 0
selling_price numeric(10,2) NOT NULL DEFAULT 0
gst_rate numeric(5,2) NOT NULL DEFAULT 18
hsn_code text
current_stock integer NOT NULL DEFAULT 0
low_stock_alert integer DEFAULT 5
serial_required boolean DEFAULT false
image_url text
status text DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

### product_serials
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
product_id uuid REFERENCES products(id)
serial_number text NOT NULL
status text DEFAULT 'available' CHECK (status IN ('available', 'sold', 'damaged', 'returned'))
stock_in_id uuid
invoice_id uuid
created_at timestamptz DEFAULT now()
```

### stock_in
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
product_id uuid REFERENCES products(id)
quantity integer NOT NULL
cost_price numeric(10,2) NOT NULL
supplier_name text
supplier_gstin text
purchase_invoice_no text
purchase_date date DEFAULT CURRENT_DATE
notes text
created_by uuid REFERENCES users(id)
created_at timestamptz DEFAULT now()
```

### stock_history
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
product_id uuid REFERENCES products(id)
change_type text CHECK (change_type IN ('stock_in', 'sale', 'adjustment', 'return'))
quantity_change integer NOT NULL
quantity_after integer NOT NULL
reference_id uuid
created_by uuid REFERENCES users(id)
created_at timestamptz DEFAULT now()
```

### customers
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
name text NOT NULL
phone text
email text
gstin text
address text
state text DEFAULT 'Telangana'
created_at timestamptz DEFAULT now()
```

### invoices
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
invoice_no text UNIQUE NOT NULL
customer_id uuid REFERENCES customers(id)
subtotal numeric(10,2) NOT NULL DEFAULT 0
discount numeric(10,2) DEFAULT 0
taxable_amount numeric(10,2) NOT NULL DEFAULT 0
cgst numeric(10,2) DEFAULT 0
sgst numeric(10,2) DEFAULT 0
igst numeric(10,2) DEFAULT 0
total_gst numeric(10,2) DEFAULT 0
grand_total numeric(10,2) NOT NULL DEFAULT 0
payment_method text CHECK (payment_method IN ('cash', 'upi', 'card', 'bank_transfer', 'credit'))
status text DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled'))
created_by uuid REFERENCES users(id)
created_at timestamptz DEFAULT now()
```

### invoice_items
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
invoice_id uuid REFERENCES invoices(id)
product_id uuid REFERENCES products(id)
product_name text NOT NULL
sku text
hsn_code text
serial_number text
quantity integer NOT NULL
rate numeric(10,2) NOT NULL
discount numeric(10,2) DEFAULT 0
gst_rate numeric(5,2) DEFAULT 0
taxable_amount numeric(10,2) NOT NULL
cgst numeric(10,2) DEFAULT 0
sgst numeric(10,2) DEFAULT 0
igst numeric(10,2) DEFAULT 0
total numeric(10,2) NOT NULL
```

### tally_ledger_mapping
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
pos_field text NOT NULL
tally_ledger_name text NOT NULL
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
```

### export_logs
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
export_type text NOT NULL
date_from date
date_to date
file_url text
created_by uuid REFERENCES users(id)
created_at timestamptz DEFAULT now()
```

### settings
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
key text UNIQUE NOT NULL
value text
updated_at timestamptz DEFAULT now()
```

---

## 5. GST Logic

Store registered in **Telangana**.

- Customer state = Telangana → **CGST + SGST** (each = rate/2)
- Customer state ≠ Telangana → **IGST** (= full rate)
- GST rate comes from product master per item
- Calculation: taxable_amount = (rate × qty) - discount; tax = taxable_amount × gst_rate/100

---

## 6. Invoice Numbering

Format: `INV-000001`, `INV-000002` — sequential, never reused.
Generated server-side using DB sequence or max+1 with row lock.

---

## 7. Business Rules

| Rule | Detail |
|------|--------|
| Stock check | Block sale if current_stock < quantity requested |
| Serial check | Block invoice save if product.serial_required = true and no serial selected |
| Stock deduction | Only after invoice successfully saved |
| Serial update | Mark serial as 'sold' only after invoice saved |
| Invoice number | Unique, sequential, never editable |
| Delete access | Admin only |
| Returns | DB ready (status fields) but UI not built in Phase 1 |

---

## 8. UI Design System

From UI/UX Pro Max search — professional navy + blue CTA palette.

| Token | Value |
|-------|-------|
| Primary | `#0F172A` |
| Secondary | `#334155` |
| Accent/CTA | `#0369A1` |
| Success | `#16A34A` |
| Destructive | `#DC2626` |
| Background | `#F8FAFC` |
| Heading font | Rubik |
| Body font | Nunito Sans |

**Layout:** 240px left sidebar + top bar + main content area. Large touch-friendly buttons. Mobile responsive with hamburger nav.

Design system persisted at: `design-system/ds-pos-camera-store/MASTER.md`

---

## 9. Modules & Screens

| # | Screen | Route | Access |
|---|--------|-------|--------|
| 1 | Login | `/login` | Public |
| 2 | Dashboard | `/dashboard` | Both |
| 3 | Product List | `/products` | Both |
| 4 | Add Product | `/products/new` | Admin |
| 5 | Edit Product | `/products/[id]/edit` | Admin |
| 6 | Stock In | `/stock-in` | Both |
| 7 | New Sale | `/billing` | Both |
| 8 | Invoice View | `/invoices/[id]` | Both |
| 9 | Invoice List | `/invoices` | Both |
| 10 | Customer List | `/customers` | Both |
| 11 | Quotation List | `/quotations` | Both |
| 11a | New Quotation | `/quotations/new` | Both |
| 11b | Quotation View | `/quotations/[id]` | Both |
| 12 | Label Generator | `/labels` | Both |
| 12 | Reports | `/reports` | Both |
| 13 | Tally Export | `/reports/tally` | Admin |
| 14 | Ledger Mapping | `/settings/tally` | Admin |
| 15 | App Settings | `/settings` | Admin |

---

## 10. Quotation Module

### Purpose
Issue price quotes to customers without affecting stock. Convert to invoice when customer confirms purchase.

### Quotation Fields
Same as invoice with additions:
- `quotation_no` — format `QUO-000001` (separate sequence from invoices)
- `valid_until` — expiry date (default 7 days from creation)
- `status` — draft / sent / accepted / expired / rejected
- `converted_invoice_id` — filled when converted to invoice

### Workflow
1. Staff goes to Quotations → New Quotation
2. Search/scan products → add to cart (same billing screen UI)
3. Apply discounts, GST calculates automatically
4. Set validity date
5. Save quotation → generate PDF
6. Send via WhatsApp / Email
7. When customer agrees → click "Convert to Invoice"
8. Stock deducts only at conversion step

### Key Rules
- Stock NOT deducted on quotation save
- Stock checked (but not reserved) when converting
- Quotation PDF says "QUOTATION" not "Invoice"
- Quotation number never reused
- Converted quotations locked (no further edits)

### Database addition
```sql
-- quotations table
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
quotation_no text UNIQUE NOT NULL
customer_id uuid REFERENCES customers(id)
subtotal numeric(10,2) NOT NULL DEFAULT 0
discount numeric(10,2) DEFAULT 0
taxable_amount numeric(10,2) NOT NULL DEFAULT 0
cgst numeric(10,2) DEFAULT 0
sgst numeric(10,2) DEFAULT 0
igst numeric(10,2) DEFAULT 0
total_gst numeric(10,2) DEFAULT 0
grand_total numeric(10,2) NOT NULL DEFAULT 0
valid_until date
status text DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','expired','rejected'))
converted_invoice_id uuid REFERENCES invoices(id)
notes text
created_by uuid REFERENCES users(id)
created_at timestamptz DEFAULT now()

-- quotation_items table (same structure as invoice_items)
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
quotation_id uuid REFERENCES quotations(id)
product_id uuid REFERENCES products(id)
product_name text NOT NULL
sku text
hsn_code text
quantity integer NOT NULL
rate numeric(10,2) NOT NULL
discount numeric(10,2) DEFAULT 0
gst_rate numeric(5,2) DEFAULT 0
taxable_amount numeric(10,2) NOT NULL
cgst numeric(10,2) DEFAULT 0
sgst numeric(10,2) DEFAULT 0
igst numeric(10,2) DEFAULT 0
total numeric(10,2) NOT NULL
```

### Screens added
| Screen | Route | Access |
|--------|-------|--------|
| Quotation List | `/quotations` | Both |
| New Quotation | `/quotations/new` | Both |
| Quotation View | `/quotations/[id]` | Both |

---

## 11. Tally XML Export

### Export Types
1. Sales Voucher XML — per invoice
2. Purchase Voucher XML — per stock_in entry
3. Stock Item Master XML — product list
4. Ledger Master XML — customer/supplier ledgers
5. GST Summary XML

### Workflow
Admin → Reports → Tally Export → Select type → Select date range → Generate XML → Download .xml → Accountant imports into TallyPrime

### Ledger Mapping (defaults)
| POS Field | Tally Ledger |
|-----------|-------------|
| Cash Sales | Cash |
| UPI Sales | UPI Bank Ledger |
| Card Sales | Card Settlement Ledger |
| Sales 18% GST | Sales GST 18% |
| CGST Output | Output CGST |
| SGST Output | Output SGST |
| IGST Output | Output IGST |
| Customer Ledger | Sundry Debtors |
| Supplier Ledger | Sundry Creditors |

---

## 11. Phase Build Order

| Phase | Modules | Est. Steps |
|-------|---------|-----------|
| 1A | Foundation — project setup, DB schema, auth, shell | 1–8 |
| 1B | Product inventory — CRUD, barcode, images | 9–15 |
| 1C | Stock In + serial numbers | 16–20 |
| 1D | Billing + GST invoice + PDF + share | 21–33 |
| 1E | Labels + reports + Excel/CSV export | 34–45 |
| 1F | Tally XML export + ledger mapping | 46–54 |
| 1G | Dashboard + settings | 55–61 |

---

## 12. Offline Mode (PWA)

### What works offline
| Feature | Offline | Notes |
|---------|---------|-------|
| Billing / new sale | ✅ | Products cached in IndexedDB |
| View products | ✅ | Cached locally |
| View past invoices | ✅ | Cached locally |
| Stock In | ✅ | Queued, syncs when online |
| PDF invoice | ✅ | Generated client-side |
| WhatsApp share | ✅ | Works if phone has data |
| Add new product | ❌ | Requires online |
| Reports | ❌ | Requires online |
| Tally export | ❌ | Requires online |

### How it works
1. On first load, app caches all products + recent invoices to IndexedDB (Dexie.js)
2. Service Worker intercepts requests — serves cache when offline
3. New sales created offline → stored in IndexedDB queue
4. When internet returns → auto-sync queue to Supabase
5. Conflict resolution: offline sales always accepted (sequential invoice numbers reserved)
6. UI shows "OFFLINE MODE" banner when disconnected

### Added to build plan
- Phase 1H (after 1G): PWA setup, Service Worker, IndexedDB sync engine

## 13. Phase 1 Completion Criteria

- [ ] Products can be added with barcode
- [ ] Stock In works by scan
- [ ] Billing works by scan
- [ ] GST invoice generates correctly (CGST+SGST for Telangana, IGST for others)
- [ ] Stock reduces after invoice
- [ ] Barcode labels print
- [ ] Reports export to Excel
- [ ] Tally XML downloads
- [ ] App works on desktop and mobile browser
- [ ] App works offline for billing (products cached, sales queued)
- [ ] Offline sales sync automatically when internet returns
- [ ] App installable as PWA (Add to Home Screen)

---

## 13. Store Details (Confirmed)

| Field | Value |
|-------|-------|
| Store Name | DUBAI SHOPPE |
| Tagline | A Professional Camera Store |
| Address | 5-1-750/2, Haridas Market Bank Street, Koti, Hyderabad - 500095 |
| GSTIN | 36ALBPM0907C1ZO |
| State Code | 36 - Telangana |
| Phone 1 | 9885878645 |
| Phone 2 | 9866141485 |
| Email | dubaishoppe_hyd@yahoo.com |
| Logo | Provided (multicolor camera store logo) |

## 14. Required from User Before Coding

1. Supabase project URL + Anon Key + Service Role Key
2. GitHub repo URL
3. Store email address
4. Resend API key (free at resend.com — needed for email invoice sending)

## 14. Default Behaviours (Resolved Ambiguities)

| Scenario | Behaviour |
|----------|-----------|
| Customer state not set | Default = Telangana → CGST+SGST |
| Customer GSTIN not provided | Invoice still works, no B2B GST fields |
| Product no barcode provided | Auto-generate from SKU |
| Multiple GST rates in one invoice | Each line calculated independently |
| Email not configured | WhatsApp share still works independently |

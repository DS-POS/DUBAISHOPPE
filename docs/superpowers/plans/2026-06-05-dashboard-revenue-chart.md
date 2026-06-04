# Dashboard Revenue Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 30-day revenue trend area chart to the dashboard, showing daily revenue bars with a smooth area fill, giving management an instant visual of sales momentum.

**Architecture:** Install recharts. Extract `getDashboardRevenueChart(days)` server action from existing reports logic. Create a `RevenueChart` client component (recharts AreaChart). Add to dashboard between stat cards and the due-invoices table. Chart is only rendered on client to avoid SSR issues with recharts.

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, TypeScript, recharts (to install), shadcn/ui, Tailwind

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add recharts dependency |
| `actions/invoices.ts` | Modify | Add `getDashboardRevenueChart` action |
| `components/dashboard/RevenueChart.tsx` | Create | Client component — recharts AreaChart |
| `app/(dashboard)/dashboard/page.tsx` | Modify | Import + render RevenueChart |

---

### Task 1: Install recharts

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
npm install --save-dev @types/recharts
```

Note: `@types/recharts` may not exist — recharts ships its own types. If `@types/recharts` install fails, just skip it (not needed).

- [ ] **Step 2: Verify install**

```bash
node -e "require('recharts'); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

### Task 2: getDashboardRevenueChart server action

**Files:**
- Modify: `actions/invoices.ts`

- [ ] **Step 1: Read `actions/invoices.ts`** to find the end of the file.

- [ ] **Step 2: Add action at end of file**

```typescript
export interface DailyRevenuePoint {
  date: string      // 'DD MMM' format e.g. '01 Jun'
  revenue: number   // grand_total sum for that day
  invoices: number  // count of invoices
}

export async function getDashboardRevenueChart(days = 30): Promise<DailyRevenuePoint[]> {
  const supabase = await createClient()

  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  from.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('invoices')
    .select('grand_total, created_at')
    .gte('created_at', from.toISOString())
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  // Build map of date → { revenue, count }
  const map = new Map<string, { revenue: number; invoices: number }>()

  // Pre-fill all days with 0 so chart shows continuous line
  for (let i = 0; i < days; i++) {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    const key = d.toISOString().split('T')[0] // YYYY-MM-DD
    map.set(key, { revenue: 0, invoices: 0 })
  }

  for (const inv of data ?? []) {
    const key = inv.created_at.split('T')[0]
    const existing = map.get(key)
    if (existing) {
      existing.revenue += Number(inv.grand_total)
      existing.invoices += 1
    }
  }

  // Convert to array with display format
  return Array.from(map.entries()).map(([dateKey, vals]) => {
    const d = new Date(dateKey + 'T00:00:00')
    const day = String(d.getDate()).padStart(2, '0')
    const month = d.toLocaleString('en-IN', { month: 'short' })
    return {
      date: `${day} ${month}`,
      revenue: Math.round(vals.revenue * 100) / 100,
      invoices: vals.invoices,
    }
  })
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add actions/invoices.ts
git commit -m "feat(dashboard): getDashboardRevenueChart action"
```

---

### Task 3: RevenueChart client component

**Files:**
- Create: `components/dashboard/RevenueChart.tsx`

- [ ] **Step 1: Create component**

```tsx
'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DailyRevenuePoint } from '@/actions/invoices'

interface Props {
  data: DailyRevenuePoint[]
  totalRevenue: number
  days: number
}

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ value: number; payload: DailyRevenuePoint }>
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-slate-900 mb-1">{label}</p>
      <p className="text-slate-600">Revenue: <span className="font-bold text-slate-900">₹{point.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></p>
      <p className="text-slate-500">{point.invoices} invoice{point.invoices !== 1 ? 's' : ''}</p>
    </div>
  )
}

export function RevenueChart({ data, totalRevenue, days }: Props) {
  const hasData = data.some(d => d.revenue > 0)

  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-slate-900">Revenue Trend</h2>
          <p className="text-xs text-slate-500 mt-0.5">Last {days} days · ₹{totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{formatINR(totalRevenue)}</p>
          <p className="text-xs text-slate-400">{days}d total</p>
        </div>
      </div>

      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
          No invoices in the last {days} days.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#111827" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#111827" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval={Math.floor(data.length / 6)}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatINR}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#111827"
              strokeWidth={2}
              fill="url(#revenueGrad)"
              dot={false}
              activeDot={{ r: 4, fill: '#111827' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/RevenueChart.tsx
git commit -m "feat(dashboard): RevenueChart recharts client component"
```

---

### Task 4: Add RevenueChart to dashboard page

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Read `app/(dashboard)/dashboard/page.tsx`** to find imports and the stat cards section.

- [ ] **Step 2: Add imports**

```typescript
import { getDashboardRevenueChart } from '@/actions/invoices'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
```

- [ ] **Step 3: Add data fetch to Promise.all**

Find the existing `Promise.all` call. Add `getDashboardRevenueChart(30)` to it:

```typescript
const [stats, dueInvoices, recentInvoices, supplierDueStats, dueSupplierInvoices, chartData] = await Promise.all([
  getInvoiceStats(),
  getRecentDueInvoices(),
  getRecentInvoices(),
  getSupplierDueStats(),
  getRecentDueSupplierInvoices(),
  getDashboardRevenueChart(30),
])
```

- [ ] **Step 4: Add chart to JSX**

Find the `{/* Outstanding Customer Dues */}` comment. Add the chart component **before** it:

```tsx
{/* Revenue Trend Chart */}
<RevenueChart
  data={chartData}
  totalRevenue={chartData.reduce((s, d) => s + d.revenue, 0)}
  days={30}
/>

{/* Outstanding Customer Dues */}
```

`RevenueChart` is a client component — Next.js handles the boundary automatically since the dashboard page is a server component.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): add RevenueChart to dashboard page"
```

---

### Verification Checklist

- [ ] Dashboard loads without error
- [ ] Revenue trend chart visible below stat cards
- [ ] Chart shows 30 days of data (flat line if no invoices is fine)
- [ ] Hovering chart shows tooltip with date, revenue, invoice count
- [ ] YAxis labels abbreviated (₹10K, ₹1.5L etc.)
- [ ] Days with no invoices show as 0 (continuous line, no gaps)
- [ ] Chart renders correctly on mobile (responsive container)
- [ ] No console errors related to recharts

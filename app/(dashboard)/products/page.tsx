import Link from 'next/link'
import { PlusIcon, PackageIcon, CheckCircleIcon, AlertTriangleIcon, UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProductsTable } from '@/components/products/ProductsTable'

import { getProducts } from '@/actions/products'
import { getCategories } from '@/actions/categories'
import { getUserRole } from '@/lib/get-user-role'

export const dynamic = 'force-dynamic'

export default async function ProductsPage({ searchParams }: { searchParams?: { filter?: string } }) {
  const products = await getProducts()
  const categories = await getCategories()
  const isLowStockFilter = searchParams?.filter === 'low-stock'

  const userRole = (await getUserRole()) ?? 'staff'
  const activeCount = products.filter(p => p.status === 'active').length
  const lowStockCount = products.filter(
    p => p.current_stock <= p.low_stock_alert && p.status === 'active' && p.low_stock_alert > 0
  ).length
  const displayProducts = isLowStockFilter
    ? products.filter(p => p.low_stock_alert > 0 && p.current_stock < p.low_stock_alert)
    : products

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Product Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your product catalog and inventory
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/products/import">
            <Button variant="outline" className="gap-1.5">
              <UploadIcon className="size-4" />
              Import Products
            </Button>
          </Link>
          <Link href="/products/new">
            <Button className="bg-slate-900 text-white hover:bg-slate-800 gap-1.5">
              <PlusIcon className="size-4" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
          <div className="p-1.5 sm:p-2 rounded-lg icon-gradient-dark shrink-0">
            <PackageIcon className="size-4 sm:size-5 text-white" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black tabular-nums text-slate-900 leading-tight">{products.length}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Total Products</p>
          </div>
        </Card>

        <Card className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
          <div className="p-1.5 sm:p-2 rounded-lg icon-gradient-blue shrink-0">
            <CheckCircleIcon className="size-4 sm:size-5 text-white" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black tabular-nums text-slate-900 leading-tight">{activeCount}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Active Products</p>
          </div>
        </Card>

        <Card className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
          <div className="p-1.5 sm:p-2 rounded-lg icon-gradient-amber shrink-0">
            <AlertTriangleIcon className="size-4 sm:size-5 text-white" />
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-black tabular-nums text-slate-900 leading-tight">{lowStockCount}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">Low Stock Items</p>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/products"
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${!isLowStockFilter ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          All Products ({products.length})
        </Link>
        <Link
          href="/products?filter=low-stock"
          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${isLowStockFilter ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}
        >
          ⚠ Low Stock ({lowStockCount})
        </Link>
      </div>

      {/* Products Table (Client Component) */}
      <ProductsTable
        products={displayProducts}
        categories={categories}
        userRole={userRole}
      />
    </div>
  )
}

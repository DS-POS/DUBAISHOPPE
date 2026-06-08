'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  EditIcon,
  BarcodeIcon,
  Trash2Icon,
  PackageIcon,
} from 'lucide-react'

import { deleteProduct } from '@/actions/products'
import { BarcodeModal } from './BarcodeModal'
import { ProductSearch } from './ProductSearch'
import type { Product, Category } from '@/types/database'

interface ProductsTableProps {
  products: Product[]
  categories: Category[]
  userRole: string
}

export function ProductsTable({ products, categories, userRole }: ProductsTableProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [barcodeModal, setBarcodeModal] = useState<{
    open: boolean
    product: Product | null
  }>({ open: false, product: null })
  const [deleting, setDeleting] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode ?? '').toLowerCase().includes(search.toLowerCase())

      const matchCategory =
        categoryFilter === 'all' || p.category_id === categoryFilter

      const matchStatus =
        statusFilter === 'all' || p.status === statusFilter

      return matchSearch && matchCategory && matchStatus
    })
  }, [products, search, categoryFilter, statusFilter])

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Mark "${name}" as inactive?`)) return
    setDeleting(id)
    try {
      await deleteProduct(id)
      toast.success(`"${name}" marked inactive`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const isAdmin = userRole === 'admin'

  return (
    <div className="space-y-5">
      <ProductSearch
        categories={categories}
        onSearchChange={setSearch}
        onCategoryChange={setCategoryFilter}
        onStatusChange={setStatusFilter}
        searchValue={search}
        categoryValue={categoryFilter}
        statusValue={statusFilter}
      />

      {/* Product list */}
      <div className="rounded-2xl bg-white ring-1 ring-black/[0.06] shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                <PackageIcon className="size-5 text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-700 text-sm">No products found</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {search || categoryFilter !== 'all' || statusFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Add your first product to get started'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile: 2-column grid cards */}
            <div className="block md:hidden p-2.5 grid grid-cols-2 gap-2">
              {filtered.map(product => {
                const isLowStock = product.current_stock <= product.low_stock_alert && product.low_stock_alert > 0
                return (
                  <div key={product.id} className="bg-slate-50 rounded-xl p-2.5 flex flex-col gap-1.5 border border-slate-100">
                    <div className="flex items-start justify-between gap-1">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <PackageIcon className="size-4 text-slate-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-0 shrink-0">
                        <button onClick={() => setBarcodeModal({ open: true, product })} className="hover:bg-slate-200 p-1 rounded-lg text-slate-500">
                          <BarcodeIcon className="size-3.5" />
                        </button>
                        <Link href={`/products/${product.id}/edit`}>
                          <span className="hover:bg-slate-200 p-1 rounded-lg text-slate-500 inline-flex">
                            <EditIcon className="size-3.5" />
                          </span>
                        </Link>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-slate-900 leading-tight line-clamp-2">{product.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{product.sku}</p>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-auto">
                      <span className="font-bold text-xs text-slate-900">₹{product.selling_price.toFixed(2)}</span>
                      {isLowStock && product.status === 'active'
                        ? <span className="bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded-full text-[10px]">⚠{product.current_stock}</span>
                        : <span className="text-[10px] text-slate-400">×{product.current_stock}</span>
                      }
                    </div>
                    <div>
                      {product.status === 'active'
                        ? <span className="bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full text-[10px]">Active</span>
                        : <span className="bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded-full text-[10px]">Inactive</span>
                      }
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-14">Image</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name / SKU</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Price (₹)</th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">GST</th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(product => {
                    const isLowStock = product.current_stock <= product.low_stock_alert
                    return (
                      <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                            {product.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <PackageIcon className="size-5 text-slate-400" />
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm">
                          <p className="font-semibold text-slate-900 text-sm">{product.name}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{product.sku}</p>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{product.categories?.name ?? '—'}</td>
                        <td className="px-5 py-3.5 text-sm text-right">
                          {isLowStock && product.status === 'active'
                            ? <span className="bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full text-xs">{product.current_stock}</span>
                            : <span className="font-semibold text-slate-700">{product.current_stock}</span>
                          }
                        </td>
                        <td className="px-5 py-3.5 text-sm text-right font-bold text-slate-900">₹{product.selling_price.toFixed(2)}</td>
                        <td className="px-5 py-3.5 text-sm text-center text-slate-500">{product.gst_rate}%</td>
                        <td className="px-5 py-3.5 text-sm text-center">
                          {product.status === 'active'
                            ? <span className="bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full text-xs">Active</span>
                            : <span className="bg-slate-100 text-slate-500 font-semibold px-2.5 py-0.5 rounded-full text-xs">Inactive</span>
                          }
                        </td>
                        <td className="px-5 py-3.5 text-sm text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <button title="View barcode" onClick={() => setBarcodeModal({ open: true, product })} className="hover:bg-slate-100 p-1.5 rounded-lg transition-colors text-slate-500 hover:text-slate-700">
                              <BarcodeIcon className="size-4" />
                            </button>
                            <Link href={`/products/${product.id}/edit`}>
                              <span className="hover:bg-slate-100 p-1.5 rounded-lg transition-colors text-slate-500 hover:text-slate-700 inline-flex">
                                <EditIcon className="size-4" />
                              </span>
                            </Link>
                            {isAdmin && (
                              <button title="Deactivate product" onClick={() => handleDelete(product.id, product.name)} disabled={deleting === product.id || product.status === 'inactive'} className="hover:bg-red-50 p-1.5 rounded-lg transition-colors text-slate-400 hover:text-red-500 disabled:opacity-40 disabled:cursor-not-allowed">
                                <Trash2Icon className="size-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Barcode Modal */}
      {barcodeModal.product && (
        <BarcodeModal
          open={barcodeModal.open}
          onOpenChange={open => setBarcodeModal(prev => ({ ...prev, open }))}
          productName={barcodeModal.product.name}
          sku={barcodeModal.product.sku}
          barcode={barcodeModal.product.barcode ?? barcodeModal.product.sku}
          sellingPrice={barcodeModal.product.selling_price}
        />
      )}
    </div>
  )
}

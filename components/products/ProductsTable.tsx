'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  EditIcon,
  BarcodeIcon,
  Trash2Icon,
  PackageIcon,
  AlertTriangleIcon,
} from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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
    <div className="space-y-4">
      <ProductSearch
        categories={categories}
        onSearchChange={setSearch}
        onCategoryChange={setCategoryFilter}
        onStatusChange={setStatusFilter}
        searchValue={search}
        categoryValue={categoryFilter}
        statusValue={statusFilter}
      />

      <div className="rounded-xl border border-border overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-14">Image</TableHead>
              <TableHead>Name / SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Price (₹)</TableHead>
              <TableHead className="text-center">GST</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageIcon className="size-10 opacity-30" />
                    <p className="font-medium">No products found</p>
                    <p className="text-sm">
                      {search || categoryFilter !== 'all' || statusFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Add your first product to get started'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(product => {
                const isLowStock = product.current_stock <= product.low_stock_alert
                return (
                  <TableRow key={product.id} className="hover:bg-slate-50/50">
                    {/* Image */}
                    <TableCell>
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center shrink-0">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <PackageIcon className="size-5 text-slate-400" />
                        )}
                      </div>
                    </TableCell>

                    {/* Name / SKU */}
                    <TableCell>
                      <div>
                        <p className="font-medium text-[#0F172A] text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{product.sku}</p>
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell>
                      <span className="text-sm text-slate-600">
                        {product.categories?.name ?? '—'}
                      </span>
                    </TableCell>

                    {/* Stock */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isLowStock && product.status === 'active' && (
                          <AlertTriangleIcon className="size-3.5 text-amber-500 shrink-0" />
                        )}
                        <span
                          className={
                            isLowStock && product.status === 'active'
                              ? 'font-semibold text-amber-600'
                              : 'text-sm text-slate-700'
                          }
                        >
                          {product.current_stock}
                        </span>
                      </div>
                      {isLowStock && product.status === 'active' && (
                        <p className="text-xs text-amber-500 text-right">Low stock</p>
                      )}
                    </TableCell>

                    {/* Price */}
                    <TableCell className="text-right">
                      <span className="font-medium text-sm">
                        ₹{product.selling_price.toFixed(2)}
                      </span>
                    </TableCell>

                    {/* GST */}
                    <TableCell className="text-center">
                      <span className="text-sm text-slate-600">{product.gst_rate}%</span>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <Badge
                        variant={product.status === 'active' ? 'default' : 'secondary'}
                        className={
                          product.status === 'active'
                            ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20'
                            : ''
                        }
                      >
                        {product.status}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Barcode */}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="View barcode"
                          onClick={() => setBarcodeModal({ open: true, product })}
                        >
                          <BarcodeIcon className="size-4" />
                        </Button>

                        {/* Edit */}
                        <Link href={`/products/${product.id}/edit`}>
                          <Button variant="ghost" size="icon-sm" title="Edit product">
                            <EditIcon className="size-4" />
                          </Button>
                        </Link>

                        {/* Delete (admin only) */}
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Deactivate product"
                            onClick={() => handleDelete(product.id, product.name)}
                            disabled={deleting === product.id || product.status === 'inactive'}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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

'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Resolver } from 'react-hook-form'
import { createStockIn } from '@/actions/stock-in'
import type { Product } from '@/types/database'
import { InvoiceScanner } from '@/components/stock-in/InvoiceScanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProductCombobox } from '@/components/stock-in/ProductCombobox'

const stockInSchema = z.object({
  product_id: z.string().min(1, 'Select a product'),
  quantity: z.coerce.number().int().min(1, 'Min 1'),
  cost_price: z.coerce.number().min(0, 'Required'),
  supplier_name: z.string().optional(),
  supplier_gstin: z.string().optional(),
  purchase_invoice_no: z.string().optional(),
  purchase_date: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})

type StockInFormValues = z.infer<typeof stockInSchema>

interface StockInFormProps {
  products: Product[]
}

export default function StockInForm({ products }: StockInFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [serialInputs, setSerialInputs] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StockInFormValues>({
    resolver: zodResolver(stockInSchema) as Resolver<StockInFormValues>,
    defaultValues: {
      purchase_date: new Date().toISOString().slice(0, 10),
      quantity: 1,
    },
  })

  const selectedProductId = watch('product_id')
  const quantity = watch('quantity')

  const selectedProduct = useMemo(
    () => products.find(p => p.id === selectedProductId),
    [products, selectedProductId]
  )

  useEffect(() => {
    if (selectedProduct) {
      setValue('cost_price', selectedProduct.cost_price)
    }
  }, [selectedProduct, setValue])

  useEffect(() => {
    if (selectedProduct?.serial_required && quantity > 0) {
      setSerialInputs(prev => {
        const newArr = Array(quantity).fill('')
        for (let i = 0; i < Math.min(prev.length, quantity); i++) {
          newArr[i] = prev[i]
        }
        return newArr
      })
    } else {
      setSerialInputs([])
    }
  }, [selectedProduct?.serial_required, selectedProduct?.id, quantity])

  function handleInvoiceData(data: {
    supplier_name?: string
    supplier_gstin?: string
    purchase_invoice_no?: string
    purchase_date?: string
    quantity: number
    cost_price: number
    notes?: string
    matched_product_id?: string
  }) {
    if (data.supplier_name) setValue('supplier_name', data.supplier_name)
    if (data.supplier_gstin) setValue('supplier_gstin', data.supplier_gstin)
    if (data.purchase_invoice_no) setValue('purchase_invoice_no', data.purchase_invoice_no)
    if (data.purchase_date) setValue('purchase_date', data.purchase_date)
    if (data.quantity) setValue('quantity', data.quantity)
    if (data.cost_price) setValue('cost_price', data.cost_price)
    if (data.notes) setValue('notes', data.notes)
    if (data.matched_product_id) setValue('product_id', data.matched_product_id, { shouldValidate: true })
  }

  async function onSubmit(values: StockInFormValues) {
    if (selectedProduct?.serial_required) {
      const missing = serialInputs.some(s => !s.trim())
      if (missing) {
        toast.error('Enter all serial numbers before saving.')
        return
      }
    }

    setSubmitting(true)
    try {
      await createStockIn({
        ...values,
        serial_numbers: selectedProduct?.serial_required ? serialInputs : undefined,
      })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add stock.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <InvoiceScanner products={products} onItemSelected={handleInvoiceData} />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Product */}
      <div className="space-y-2">
        <Label>Product *</Label>
        <ProductCombobox
          products={products}
          value={selectedProductId || ''}
          onChange={(id) => setValue('product_id', id, { shouldValidate: true })}
          error={!!errors.product_id}
        />
        {errors.product_id && (
          <p className="text-xs text-destructive">{errors.product_id.message}</p>
        )}
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity *</Label>
        <Input id="quantity" type="number" min="1" {...register('quantity')} />
        {errors.quantity && (
          <p className="text-xs text-destructive">{errors.quantity.message}</p>
        )}
        {selectedProduct?.serial_required && quantity > 0 && (
          <p className="text-xs text-muted-foreground">
            This product requires {quantity} serial number(s).
          </p>
        )}
      </div>

      {/* Cost Price */}
      <div className="space-y-2">
        <Label htmlFor="cost_price">Cost Price (₹) *</Label>
        <Input id="cost_price" type="number" min="0" step="0.01" {...register('cost_price')} />
        {errors.cost_price && (
          <p className="text-xs text-destructive">{errors.cost_price.message}</p>
        )}
      </div>

      {/* Purchase Date */}
      <div className="space-y-2">
        <Label htmlFor="purchase_date">Purchase Date *</Label>
        <Input id="purchase_date" type="date" {...register('purchase_date')} />
        {errors.purchase_date && (
          <p className="text-xs text-destructive">{errors.purchase_date.message}</p>
        )}
      </div>

      {/* Supplier Name */}
      <div className="space-y-2">
        <Label htmlFor="supplier_name">Supplier Name</Label>
        <Input
          id="supplier_name"
          type="text"
          placeholder="e.g. ABC Distributors"
          {...register('supplier_name')}
        />
      </div>

      {/* Purchase Invoice No */}
      <div className="space-y-2">
        <Label htmlFor="purchase_invoice_no">Purchase Invoice No</Label>
        <Input
          id="purchase_invoice_no"
          type="text"
          placeholder="e.g. INV-2024-001"
          {...register('purchase_invoice_no')}
        />
      </div>

      {/* Supplier GSTIN */}
      <div className="space-y-2">
        <Label htmlFor="supplier_gstin">Supplier GSTIN</Label>
        <Input
          id="supplier_gstin"
          type="text"
          placeholder="e.g. 29ABCDE1234F1Z5"
          {...register('supplier_gstin')}
        />
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          type="text"
          placeholder="Optional notes"
          {...register('notes')}
        />
      </div>

      {/* Serial Numbers (only when product requires them) */}
      {selectedProduct?.serial_required && serialInputs.length > 0 && (
        <div className="space-y-3">
          <Label>Serial Numbers *</Label>
          <div className="space-y-2 rounded-lg border border-input p-4">
            {serialInputs.map((val, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-7 text-xs text-muted-foreground text-right shrink-0">
                  {idx + 1}.
                </span>
                <Input
                  type="text"
                  placeholder={`Serial #${idx + 1}`}
                  value={val}
                  onChange={e => {
                    const updated = [...serialInputs]
                    updated[idx] = e.target.value
                    setSerialInputs(updated)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/stock-in')}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Add Stock'}
        </Button>
      </div>
    </form>
    </div>
  )
}

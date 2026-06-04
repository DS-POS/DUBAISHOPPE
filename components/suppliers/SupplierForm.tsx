'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Resolver } from 'react-hook-form'
import { createSupplier, updateSupplier } from '@/actions/suppliers'
import type { Supplier } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
  'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
]

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  business_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gstin: z.string().optional(),
  address: z.string().optional(),
  state: z.string().min(1, 'State is required'),
  notes: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  supplier?: Supplier
}

export default function SupplierForm({ supplier }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: supplier?.name ?? '',
      business_name: supplier?.business_name ?? '',
      phone: supplier?.phone ?? '',
      email: supplier?.email ?? '',
      gstin: supplier?.gstin ?? '',
      address: supplier?.address ?? '',
      state: supplier?.state ?? 'Telangana',
      notes: supplier?.notes ?? '',
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        if (supplier) {
          await updateSupplier(supplier.id, values)
        } else {
          await createSupplier(values)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save supplier.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input placeholder="e.g. Nikon India Pvt Ltd" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Business Name</Label>
        <Input placeholder="Legal business / trade name" {...register('business_name')} />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input type="tel" placeholder="9876543210" {...register('phone')} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" placeholder="supplier@example.com" {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>GSTIN</Label>
        <Input placeholder="29ABCDE1234F1Z5" {...register('gstin')} />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input placeholder="Street, City, Pincode" {...register('address')} />
      </div>
      <div className="space-y-2">
        <Label>State *</Label>
        <select
          {...register('state')}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {INDIAN_STATES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Input placeholder="Optional notes about this supplier" {...register('notes')} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.push('/suppliers')} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : supplier ? 'Update Supplier' : 'Add Supplier'}
        </Button>
      </div>
    </form>
  )
}

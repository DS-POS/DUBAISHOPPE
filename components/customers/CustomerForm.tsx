'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { Resolver } from 'react-hook-form'
import { createCustomer, updateCustomer } from '@/actions/customers'
import type { Customer } from '@/types/database'
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
  name: z.string().min(1, 'Name required'),
  business_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  gstin: z.string().optional(),
  address: z.string().optional(),
  state: z.string().min(1, 'State required'),
  credit_limit: z.number().min(0).default(0),
})
type FormValues = z.infer<typeof schema>

interface Props {
  customer?: Customer
}

export default function CustomerForm({ customer }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: customer?.name ?? '',
      business_name: customer?.business_name ?? '',
      phone: customer?.phone ?? '',
      email: customer?.email ?? '',
      gstin: customer?.gstin ?? '',
      address: customer?.address ?? '',
      state: customer?.state ?? 'Telangana',
      credit_limit: customer?.credit_limit ?? 0,
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        if (customer) {
          await updateCustomer(customer.id, values)
        } else {
          await createCustomer(values)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save customer.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input placeholder="e.g. Rahul Sharma" {...register('name')} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-1">
        <Label>Business Name</Label>
        <Input placeholder="Business / company name" {...register('business_name')} />
      </div>
      <div className="space-y-2">
        <Label>Phone</Label>
        <Input type="tel" placeholder="9876543210" {...register('phone')} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input type="email" placeholder="customer@example.com" {...register('email')} />
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
      <div className="space-y-1.5">
        <Label>Credit Limit (₹)</Label>
        <input
          type="number"
          min={0}
          step={500}
          {...register('credit_limit', { valueAsNumber: true })}
          placeholder="0 = cash only"
          className="h-9 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#111827]/20 focus:border-[#111827] bg-transparent"
        />
        {errors.credit_limit && <p className="text-xs text-destructive">{errors.credit_limit.message}</p>}
        <p className="text-xs text-slate-400">Set 0 for cash-only customers. Billing warns when exceeded.</p>
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.push('/customers')} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving...' : customer ? 'Update Customer' : 'Add Customer'}
        </Button>
      </div>
    </form>
  )
}

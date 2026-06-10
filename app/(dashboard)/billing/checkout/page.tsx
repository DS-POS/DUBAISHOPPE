'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CartItem } from '@/components/billing/types'
import type { Customer } from '@/types/database'
import { CheckoutForm } from '@/components/billing/CheckoutForm'
import { getCustomerCreditSummary } from '@/actions/customers'

export default function CheckoutPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [creditInfo, setCreditInfo] = useState<{ limit: number; available: number } | null>(null)

  useEffect(() => {
    const rawCart = sessionStorage.getItem('pos_checkout_cart')
    const rawCustomer = sessionStorage.getItem('pos_checkout_customer')

    if (!rawCart) {
      router.replace('/billing')
      return
    }

    async function init() {
      try {
        const parsedCart: CartItem[] = JSON.parse(rawCart!)
        if (!parsedCart || parsedCart.length === 0) {
          router.replace('/billing')
          return
        }
        setCart(parsedCart)

        let parsedCustomer: Customer | null = null
        if (rawCustomer) {
          try {
            parsedCustomer = JSON.parse(rawCustomer)
          } catch {
            parsedCustomer = null
          }
        }
        setCustomer(parsedCustomer)

        if (parsedCustomer && parsedCustomer.credit_limit > 0) {
          try {
            const summary = await getCustomerCreditSummary(parsedCustomer.id)
            setCreditInfo({ limit: summary.credit_limit, available: summary.available_credit })
          } catch {
            setCreditInfo(null)
          }
        } else {
          setCreditInfo(null)
        }

        setReady(true)
      } catch {
        router.replace('/billing')
      }
    }

    init()
  }, [router])

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground text-sm">Loading checkout…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-950" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Checkout
        </h1>
        <p className="text-slate-500 text-sm mt-1">Review cart, enter customer details and confirm payment</p>
      </div>
      <CheckoutForm
        initialCart={cart}
        initialCustomer={customer}
        creditLimit={creditInfo?.limit}
        creditAvailable={creditInfo?.available}
      />
    </div>
  )
}

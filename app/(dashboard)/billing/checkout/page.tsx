'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CartItem } from '@/components/billing/types'
import type { Customer } from '@/types/database'
import { CheckoutForm } from '@/components/billing/CheckoutForm'

export default function CheckoutPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [customer, setCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    const rawCart = sessionStorage.getItem('pos_checkout_cart')
    const rawCustomer = sessionStorage.getItem('pos_checkout_customer')

    if (!rawCart) {
      router.replace('/billing')
      return
    }

    try {
      const parsedCart: CartItem[] = JSON.parse(rawCart)
      if (!parsedCart || parsedCart.length === 0) {
        router.replace('/billing')
        return
      }
      setCart(parsedCart)

      if (rawCustomer) {
        try {
          setCustomer(JSON.parse(rawCustomer))
        } catch {
          setCustomer(null)
        }
      }

      setReady(true)
    } catch {
      router.replace('/billing')
    }
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
        <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: 'Rubik, sans-serif' }}>
          Checkout
        </h1>
        <p className="text-slate-500 text-sm mt-1">Review cart, enter customer details and confirm payment</p>
      </div>
      <CheckoutForm initialCart={cart} initialCustomer={customer} />
    </div>
  )
}

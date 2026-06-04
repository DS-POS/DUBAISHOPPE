'use client'
import { useEffect } from 'react'
import type { Invoice } from '@/types/database'

interface Props { invoice: Invoice }

export function ThermalReceipt({ invoice }: Props) {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/thermal-print.css'
    link.id = 'thermal-css'
    if (!document.getElementById('thermal-css')) document.head.appendChild(link)
    return () => { document.getElementById('thermal-css')?.remove() }
  }, [])

  const items = invoice.invoice_items ?? []
  const nonTaxableItems = items.filter(i => i.is_taxable === false)

  return (
    <div id="thermal-receipt" style={{ display: 'none' }}>
      <div className="center bold large">DUBAI SHOPPE</div>
      <div className="center small">Hyderabad, Telangana</div>
      <div className="divider" />
      <table><tbody>
        <tr><td>Invoice:</td><td className="r bold">{invoice.invoice_no}</td></tr>
        <tr><td>Date:</td><td className="r">{new Date(invoice.created_at).toLocaleDateString('en-IN')}</td></tr>
        {invoice.customers && <tr><td>Customer:</td><td className="r">{invoice.customers.name}</td></tr>}
      </tbody></table>
      <div className="divider" />
      <table><tbody>
        {items.map(item => (
          <tr key={item.id}>
            <td colSpan={2}>
              <div>{item.product_name}</div>
              <div className="small">{item.quantity} x &#8377;{Number(item.rate).toFixed(2)}{item.is_taxable !== false && item.gst_rate > 0 ? ` + ${item.gst_rate}% GST` : ''}</div>
            </td>
            <td className="r bold">&#8377;{Number(item.total).toFixed(2)}</td>
          </tr>
        ))}
      </tbody></table>
      <div className="divider" />
      <table><tbody>
        {invoice.taxable_amount > 0 && <tr><td>Taxable:</td><td className="r">&#8377;{Number(invoice.taxable_amount).toFixed(2)}</td></tr>}
        {invoice.cgst > 0 && <tr><td>CGST:</td><td className="r">&#8377;{Number(invoice.cgst).toFixed(2)}</td></tr>}
        {invoice.sgst > 0 && <tr><td>SGST:</td><td className="r">&#8377;{Number(invoice.sgst).toFixed(2)}</td></tr>}
        {invoice.igst > 0 && <tr><td>IGST:</td><td className="r">&#8377;{Number(invoice.igst).toFixed(2)}</td></tr>}
        {nonTaxableItems.map(item => (
          <tr key={item.id}><td>{item.product_name}{item.quantity > 1 ? ` ×${item.quantity}` : ''}:</td><td className="r">&#8377;{Number(item.total).toFixed(2)}</td></tr>
        ))}
      </tbody></table>
      <div className="divider" />
      <table><tbody>
        <tr className="bold large"><td>TOTAL:</td><td className="r">&#8377;{Number(invoice.grand_total).toFixed(2)}</td></tr>
        <tr><td>Payment:</td><td className="r capitalize">{invoice.payment_method?.replace('_', ' ')}</td></tr>
      </tbody></table>
      <div className="divider" />
      <div className="center small">Thank you for your purchase!</div>
    </div>
  )
}

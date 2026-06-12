'use server'

import { Resend } from 'resend'
import { getInvoice } from './invoices'
import { STORE } from '@/lib/store-constants'
import { round2 } from '@/lib/gst'

export async function sendInvoiceEmail(
  invoiceId: string,
  toEmail: string,
): Promise<{ success: boolean; error?: string }> {
  try {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'Email service not configured. RESEND_API_KEY is missing.' }
  const resend = new Resend(apiKey)

  const invoice = await getInvoice(invoiceId)
  if (!invoice) return { success: false, error: 'Invoice not found' }

  const customer = invoice.customers
  const items = invoice.invoice_items ?? []
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://pos.dubaishoppe.in'
  const pdfUrl = `${appUrl}/api/invoices/${invoiceId}/pdf`

  const itemsHtml = items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
      <td style="padding:6px 8px">${item.product_name}${item.serial_number ? `<br><small style="color:#94a3b8">S/N: ${item.serial_number}</small>` : ''}</td>
      <td style="padding:6px 8px;text-align:center">${item.quantity}</td>
      <td style="padding:6px 8px;text-align:right">₹${round2(item.rate).toFixed(2)}</td>
      <td style="padding:6px 8px;text-align:right;font-weight:600">₹${round2(item.total).toFixed(2)}</td>
    </tr>
  `).join('')

  const { error: sendError } = await resend.emails.send({
    from: `${STORE.name} <onboarding@resend.dev>`,
    to: [toEmail],
    subject: `Invoice ${invoice.invoice_no} from ${STORE.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
        <div style="background:#2563eb;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px">${STORE.name}</h1>
          <p style="margin:4px 0 0;opacity:0.8;font-size:13px">${STORE.address}, ${STORE.city}</p>
        </div>
        <div style="padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 4px;font-size:18px">TAX INVOICE</h2>
          <p style="margin:0;color:#64748b;font-size:13px">Invoice No: <strong>${invoice.invoice_no}</strong> · Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN')}</p>
          <p style="margin:4px 0 0;color:#64748b;font-size:13px">Bill To: <strong>${customer ? customer.name : 'Walk-in Customer'}</strong></p>

          <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
            <thead>
              <tr style="background:#f1f5f9">
                <th style="padding:8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase">Product</th>
                <th style="padding:8px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase">Qty</th>
                <th style="padding:8px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase">Rate</th>
                <th style="padding:8px;text-align:right;font-size:11px;color:#64748b;text-transform:uppercase">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <div style="margin-top:16px;text-align:right;font-size:13px">
            <p style="margin:2px 0;color:#64748b">Taxable Amount: ₹${round2(invoice.taxable_amount).toFixed(2)}</p>
            <p style="margin:2px 0;color:#64748b">Total GST: ₹${round2(invoice.total_gst).toFixed(2)}</p>
            <p style="margin:8px 0 0;font-size:18px;font-weight:700;color:#2563eb">Grand Total: ₹${round2(invoice.grand_total).toFixed(2)}</p>
          </div>

          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0">
            <a href="${pdfUrl}" style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">
              Download PDF Invoice
            </a>
          </div>

          <p style="margin-top:16px;font-size:11px;color:#94a3b8">GSTIN: ${STORE.gstin} · ${STORE.phone}</p>
        </div>
      </div>
    `,
  })

  if (sendError) return { success: false, error: sendError.message ?? 'Email delivery failed' }
  return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unexpected error sending email' }
  }
}

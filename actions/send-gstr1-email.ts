'use server'

import { Resend } from 'resend'
import { STORE } from '@/lib/store-constants'

export async function sendGSTR1Email(params: {
  to: string
  from_date: string
  to_date: string
  gstin: string
  gstr1Json: object
}): Promise<{ success: boolean; error?: string }> {
  const { to, from_date, to_date, gstin, gstr1Json } = params

  // Build a human-readable period string e.g. "Apr 2025 – Jun 2025"
  const fromD  = new Date(from_date)
  const toD    = new Date(to_date)
  const opts   = { month: 'short', year: 'numeric' } as const
  const period = `${fromD.toLocaleDateString('en-IN', opts)} – ${toD.toLocaleDateString('en-IN', opts)}`

  // Attachment filename: GSTR1_062025.json (MMYYYY of end month)
  const mm       = String(toD.getMonth() + 1).padStart(2, '0')
  const yyyy     = toD.getFullYear()
  const fileSlug = `${mm}${yyyy}`
  const filename = `GSTR1_${fileSlug}.json`

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'Email service not configured' }
  const resend = new Resend(apiKey)

  const jsonBuffer = Buffer.from(JSON.stringify(gstr1Json, null, 2))

  const { error } = await resend.emails.send({
    from: `DS POS <noreply@dspos.in>`,
    to: [to],
    subject: `GSTR-1 Return Data — ${period} — DS CAMERA STORE`,
    attachments: [
      {
        filename,
        content: jsonBuffer,
      },
    ],
    html: `
      <div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1e293b">
        <div style="background:#5C4A3A;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
          <h1 style="margin:0;font-size:20px">${STORE.name}</h1>
          <p style="margin:4px 0 0;opacity:0.8;font-size:13px">GSTIN: ${STORE.gstin}</p>
        </div>

        <div style="padding:24px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 4px;font-size:18px;color:#5C4A3A">GSTR-1 Return Data</h2>
          <p style="margin:0;color:#64748b;font-size:13px">
            Period: <strong>${period}</strong> &nbsp;·&nbsp; Filer GSTIN: <strong>${gstin}</strong>
          </p>

          <p style="margin-top:16px;font-size:14px;color:#334155;line-height:1.6">
            Please find attached the GSTR-1 JSON file for the above period. This file is in the
            official GST portal format and is ready for direct upload.
          </p>

          <div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px">
            <h3 style="margin:0 0 10px;font-size:14px;color:#5C4A3A">Steps to upload on GST Portal</h3>
            <ol style="margin:0;padding-left:18px;font-size:13px;color:#475569;line-height:2">
              <li>Log in to <a href="https://www.gst.gov.in" style="color:#2563eb">www.gst.gov.in</a> with GSTIN: <strong>${gstin}</strong></li>
              <li>Navigate to <strong>Returns → GSTR-1</strong></li>
              <li>Select the return period matching this file</li>
              <li>Choose <strong>"Upload JSON"</strong> option</li>
              <li>Upload the attached file: <strong>${filename}</strong></li>
              <li>Verify all sections (B2B, B2CS, HSN) and submit</li>
            </ol>
          </div>

          <div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e">
            <strong>Important:</strong> Please verify all figures in the JSON before filing. This file was
            auto-generated from DS POS transaction data.
          </div>

          <p style="margin-top:20px;font-size:11px;color:#94a3b8">
            ${STORE.name} · ${STORE.address}, ${STORE.city} · ${STORE.phone}
          </p>
        </div>
      </div>
    `,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

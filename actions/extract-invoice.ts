'use server'

import Anthropic from '@anthropic-ai/sdk'

export interface ExtractedItem {
  description: string
  hsn_code?: string
  quantity: number
  unit_price: number       // per-unit price INCLUDING all taxes/GST (what we actually paid per unit)
  gst_rate?: number        // total GST % on this item (CGST%+SGST% or IGST%). e.g. 12, 18, 5, 28
}

export interface ExtractedInvoiceData {
  supplier_name?: string
  supplier_gstin?: string
  purchase_invoice_no?: string
  purchase_date?: string  // YYYY-MM-DD
  invoice_total?: number  // grand total amount on the invoice (incl. all taxes) — what we owe supplier
  items: ExtractedItem[]
}

export async function extractInvoiceData(
  fileBase64: string,
  mimeType: string
): Promise<ExtractedInvoiceData> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const client = new Anthropic({ apiKey })

  const extractionPrompt = `You are an invoice parser for a Point of Sale system. Extract data from this supplier/purchase invoice and return ONLY a valid JSON object. No markdown. No explanation. Just JSON.

Return this exact structure:
{
  "supplier_name": "seller company name (NOT the buyer)",
  "supplier_gstin": "seller GSTIN/UIN",
  "purchase_invoice_no": "invoice number",
  "purchase_date": "YYYY-MM-DD format",
  "invoice_total": 0.00,
  "items": [
    {
      "description": "product description as printed",
      "hsn_code": "HSN/SAC code if visible",
      "quantity": 1,
      "unit_price": 0.00,
      "gst_rate": 18
    }
  ]
}

Rules:
- Return ONLY valid JSON, nothing else
- purchase_date MUST be YYYY-MM-DD (convert "9-Jul-25" → "2025-07-09")
- quantity, unit_price, and gst_rate are numbers (not strings)
- unit_price is the per-unit price INCLUDING all taxes/GST (total line amount ÷ quantity). For example: if line amount is ₹6000 for qty 1, unit_price = 6000. If grand total is ₹24000 for 4 identical items, unit_price = 6000.
- invoice_total is the GRAND TOTAL amount on the invoice (the final amount payable, including all taxes). This is NOT the taxable value — it is the total amount to pay the supplier.
- gst_rate is the TOTAL GST percentage applied to this item. Add CGST% + SGST% together (e.g. CGST 6% + SGST 6% = 12). Or use IGST% directly. Valid values: 0, 5, 12, 18, 28. If not visible, use 18.
- supplier_name is the SELLER, not the buyer
- If a field is not found, omit it from JSON
- Include ALL line items in the items array`

  // ~4MB base64 limit (≈3MB raw file) — Claude API max is 5MB per image
  const MAX_BASE64_BYTES = 4 * 1024 * 1024
  if (fileBase64.length > MAX_BASE64_BYTES) {
    throw new Error('File too large. Please use an image under 3MB or compress the PDF.')
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

  let responseText: string

  if (imageTypes.includes(mimeType)) {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: fileBase64,
            },
          },
          { type: 'text', text: extractionPrompt },
        ],
      }],
    })
    responseText = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else if (mimeType === 'application/pdf') {
    // Claude supports PDFs via the document content type
    type BetaContent = Parameters<typeof client.beta.messages.create>[0]['messages'][0]['content']
    const pdfContent: BetaContent = [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: fileBase64,
        },
      } as BetaContent extends (infer U)[] ? U : never,
      { type: 'text', text: extractionPrompt } as BetaContent extends (infer U)[] ? U : never,
    ]
    const msg = await client.beta.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      betas: ['pdfs-2024-09-25'],
      messages: [{
        role: 'user',
        content: pdfContent,
      }],
    })
    responseText = msg.content[0].type === 'text' ? msg.content[0].text : ''
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`)
  }

  // Strip markdown code fences if model adds them
  const cleaned = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as ExtractedInvoiceData
    return {
      supplier_name: parsed.supplier_name,
      supplier_gstin: parsed.supplier_gstin,
      purchase_invoice_no: parsed.purchase_invoice_no,
      purchase_date: parsed.purchase_date,
      invoice_total: typeof parsed.invoice_total === 'number' ? parsed.invoice_total : undefined,
      items: Array.isArray(parsed.items) ? parsed.items : [],
    }
  } catch {
    throw new Error('Failed to parse invoice data. Please try a clearer image.')
  }
}

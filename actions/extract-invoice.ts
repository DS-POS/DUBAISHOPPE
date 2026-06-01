'use server'

import Anthropic from '@anthropic-ai/sdk'

export interface ExtractedItem {
  description: string
  hsn_code?: string
  quantity: number
  unit_price: number
}

export interface ExtractedInvoiceData {
  supplier_name?: string
  supplier_gstin?: string
  purchase_invoice_no?: string
  purchase_date?: string  // YYYY-MM-DD
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
  "items": [
    {
      "description": "product description as printed",
      "hsn_code": "HSN/SAC code if visible",
      "quantity": 1,
      "unit_price": 0.00
    }
  ]
}

Rules:
- Return ONLY valid JSON, nothing else
- purchase_date MUST be YYYY-MM-DD (convert "9-Jul-25" → "2025-07-09")
- quantity and unit_price are numbers (not strings)
- unit_price is the per-unit price BEFORE tax/GST
- supplier_name is the SELLER, not the buyer
- If a field is not found, omit it from JSON
- Include ALL line items in the items array`

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
      items: Array.isArray(parsed.items) ? parsed.items : [],
    }
  } catch {
    throw new Error('Failed to parse invoice data. Please try a clearer image.')
  }
}

'use client'

const IMAGE_MAX_KB = 500
const IMAGE_MAX_PX = 1920
const PDF_WARN_MB = 3
const PDF_MAX_MB = 8

export interface CompressResult {
  file: File
  originalKB: number
  compressedKB: number
  compressed: boolean
}

export async function compressImage(file: File): Promise<CompressResult> {
  const originalKB = Math.round(file.size / 1024)

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      if (width > IMAGE_MAX_PX || height > IMAGE_MAX_PX) {
        if (width > height) {
          height = Math.round((height / width) * IMAGE_MAX_PX)
          width = IMAGE_MAX_PX
        } else {
          width = Math.round((width / height) * IMAGE_MAX_PX)
          height = IMAGE_MAX_PX
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // Try reducing quality until under limit
      const quality = 0.85
      const attempt = (q: number) => {
        canvas.toBlob(
          blob => {
            if (!blob) return reject(new Error('Canvas compression failed'))
            const kb = Math.round(blob.size / 1024)
            if (kb <= IMAGE_MAX_KB || q <= 0.3) {
              const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                type: 'image/jpeg',
              })
              resolve({ file: compressed, originalKB, compressedKB: kb, compressed: kb < originalKB })
            } else {
              attempt(Math.max(q - 0.1, 0.3))
            }
          },
          'image/jpeg',
          q,
        )
      }
      attempt(quality)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

export function validatePdf(file: File): { ok: boolean; warn: boolean; message?: string } {
  const mb = file.size / (1024 * 1024)
  if (mb > PDF_MAX_MB) {
    return {
      ok: false,
      warn: false,
      message: `PDF too large (${mb.toFixed(1)} MB). Max ${PDF_MAX_MB} MB. Please compress before uploading.`,
    }
  }
  if (mb > PDF_WARN_MB) {
    return {
      ok: true,
      warn: true,
      message: `Large PDF (${mb.toFixed(1)} MB). Consider compressing to save storage.`,
    }
  }
  return { ok: true, warn: false }
}

export async function prepareFile(file: File): Promise<CompressResult & { warning?: string }> {
  if (file.type === 'application/pdf') {
    const check = validatePdf(file)
    if (!check.ok) throw new Error(check.message)
    return {
      file,
      originalKB: Math.round(file.size / 1024),
      compressedKB: Math.round(file.size / 1024),
      compressed: false,
      warning: check.warn ? check.message : undefined,
    }
  }

  if (file.type.startsWith('image/')) {
    const result = await compressImage(file)
    return result
  }

  return {
    file,
    originalKB: Math.round(file.size / 1024),
    compressedKB: Math.round(file.size / 1024),
    compressed: false,
  }
}

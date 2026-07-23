export const sanitizeFileName = (value: string, fallback = 'bikevoyager') => {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const cleaned = normalized
    .replace(/[^a-zA-Z0-9 _.-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
  return cleaned || fallback
}

export const buildGpxFileName = (label: string) => {
  return buildRouteFileName(label, 'gpx')
}

export type RouteExportFormat = 'gpx' | 'tcx'

export const buildRouteFileName = (label: string, format: RouteExportFormat) => {
  const stamp = new Date().toISOString().slice(0, 10)
  const base = sanitizeFileName(label)
  return `${base}-${stamp}.${format}`
}

export const parseContentDispositionFileName = (header: string | null) => {
  if (!header) {
    return null
  }

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1])
    } catch {
      return utfMatch[1]
    }
  }

  const asciiMatch = header.match(/filename="?([^";]+)"?/i)
  return asciiMatch?.[1] ?? null
}

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

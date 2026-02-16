import { apiPaths } from '../routing/apiPaths'
import type { PoiCategory, PoiItem, RouteResult } from '../routing/domain'

type FetchPoisParams = {
  geometry: RouteResult['geometry']
  categories: PoiCategory[]
  distance: number
  language: string
  signal: AbortSignal
}

export const fetchPoisAroundRoute = async ({
  geometry,
  categories,
  distance,
  language,
  signal,
}: FetchPoisParams) => {
  const response = await fetch(apiPaths.poiAroundRoute, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      geometry,
      categories,
      distance,
      language,
    }),
    signal,
  })

  if (!response.ok) {
    let message: string | null = null
    try {
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as { message?: string }
        if (payload.message && payload.message.trim()) {
          message = payload.message.trim()
        }
      } else {
        const bodyText = (await response.text()).trim()
        if (bodyText) {
          message = bodyText.slice(0, 220)
        }
      }
    } catch {
      message = null
    }

    return {
      ok: false as const,
      message,
    }
  }

  const data = (await response.json()) as PoiItem[]
  return {
    ok: true as const,
    data,
  }
}

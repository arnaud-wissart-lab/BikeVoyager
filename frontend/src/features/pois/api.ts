import { apiPaths } from '../routing/apiPaths'
import { readApiMessage } from '../routing/api'
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
    return {
      ok: false as const,
      message: await readApiMessage(response),
    }
  }

  const data = (await response.json()) as PoiItem[]
  return {
    ok: true as const,
    data,
  }
}

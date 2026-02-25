import { apiPaths } from './apiPaths'
import type {
  ApiHealthStatus,
  LoopResult,
  LoopRequestPayload,
  RouteElevationPoint,
  RouteResult,
  RouteRequestPayload,
  ValhallaStatus,
} from './domain'

export const readApiMessage = async (response: Response) => {
  try {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as {
        message?: string
        title?: string
        detail?: string
        errors?: Record<string, string[]>
      }

      if (typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message.trim()
      }

      if (typeof payload.detail === 'string' && payload.detail.trim()) {
        return payload.detail.trim()
      }

      if (payload.errors && typeof payload.errors === 'object') {
        const firstError = Object.values(payload.errors).find(
          (messages) => Array.isArray(messages) && messages.length > 0,
        )

        if (firstError?.[0] && firstError[0].trim()) {
          return firstError[0].trim()
        }
      }

      if (typeof payload.title === 'string' && payload.title.trim()) {
        return payload.title.trim()
      }
    }

    const body = (await response.text()).trim()
    if (body) {
      return body.slice(0, 240)
    }
  } catch {
    return null
  }

  return null
}

export const fetchRoute = async (requestBody: RouteRequestPayload) => {
  const response = await fetch(apiPaths.route, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    return { ok: false as const, response }
  }

  const data = (await response.json()) as Omit<RouteResult, 'kind'> & {
    elevation_profile?: RouteElevationPoint[]
  }

  return {
    ok: true as const,
    result: {
      ...data,
      kind: 'route' as const,
      elevation_profile: Array.isArray(data.elevation_profile) ? data.elevation_profile : [],
    },
  }
}

export const fetchLoop = async (requestBody: LoopRequestPayload) => {
  const response = await fetch(apiPaths.loop, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    return { ok: false as const, response }
  }

  const data = (await response.json()) as Omit<LoopResult, 'kind'> & {
    elevation_profile?: RouteElevationPoint[]
  }

  return {
    ok: true as const,
    result: {
      ...data,
      kind: 'loop' as const,
      elevation_profile: Array.isArray(data.elevation_profile) ? data.elevation_profile : [],
    },
  }
}

export const fetchApiHealth = async () => {
  const response = await fetch(apiPaths.health)
  if (!response.ok) {
    return { ok: false as const }
  }

  const data = (await response.json()) as ApiHealthStatus
  return { ok: true as const, data }
}

export const fetchValhallaStatus = async () => {
  const response = await fetch(apiPaths.valhallaStatus)
  if (!response.ok) {
    return { ok: false as const }
  }

  const data = (await response.json()) as ValhallaStatus
  return { ok: true as const, data }
}

export const startValhallaUpdate = async () =>
  fetch(apiPaths.valhallaUpdateStart, {
    method: 'POST',
  })

export const submitDeveloperFeedback = async (payload: {
  subject: string
  message: string
  contactEmail: string
  page: string
}) =>
  fetch(apiPaths.feedback, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      website: '',
    }),
  })

export const exportRouteAsGpx = async (payload: {
  geometry: RouteResult['geometry']
  elevation_profile: RouteElevationPoint[] | null
  name: string
}) =>
  fetch(apiPaths.exportGpx, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

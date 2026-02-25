import { vi } from 'vitest'
import { apiPaths } from '../features/routing/apiPaths'
import { routeStorageKey } from '../features/routing/domain'
import { createJsonResponse, resolveRequestUrl } from './test-utils'

type AppFetchOverride = (
  url: string,
  input: RequestInfo | URL,
) => Response | Promise<Response> | null | undefined

export const createDefaultApiResponse = (url: string): Response => {
  if (url === apiPaths.cloudProviders) {
    return createJsonResponse({
      providers: { onedrive: false, googleDrive: false },
    })
  }

  if (url === apiPaths.cloudSession) {
    return createJsonResponse({
      connected: false,
      authState: null,
    })
  }

  if (url === apiPaths.cloudStatus) {
    return createJsonResponse({
      providers: { onedrive: false, googleDrive: false },
      session: { connected: false, authState: null },
      cache: {
        distributedCacheType: 'Redis',
        healthy: true,
        message: 'OK',
        fallback: null,
      },
      serverTimeUtc: '2026-02-15T10:30:00Z',
    })
  }

  if (url === apiPaths.health) {
    return createJsonResponse({
      status: 'OK',
      valhalla: {
        status: 'UP',
        message: 'Valhalla est prêt et joignable.',
        reason: null,
        serviceReachable: true,
        serviceError: null,
        build: {
          state: 'completed',
          phase: 'ready',
          progressPct: 100,
          message: 'Valhalla est prêt.',
          updatedAt: '2026-02-15T10:00:00Z',
        },
      },
      version: '1.0.0',
      commit: 'abc123',
      checkedAt: '2026-02-15T10:30:00Z',
    })
  }

  if (url === apiPaths.valhallaStatus) {
    return createJsonResponse({
      ready: true,
      reason: null,
      marker_exists: true,
      service_reachable: true,
      service_error: null,
      message: 'ready',
      build: {
        state: 'idle',
        phase: 'ready',
        progress_pct: 100,
        message: 'ready',
        updated_at: '2026-02-15T10:00:00Z',
      },
      update: {
        state: 'idle',
        update_available: false,
        reason: null,
        message: 'up-to-date',
        checked_at: '2026-02-15T09:00:00Z',
        next_check_at: '2026-02-15T12:00:00Z',
        marker_exists: true,
        remote: {
          available: true,
          error: null,
        },
      },
    })
  }

  if (url.startsWith(apiPaths.placesSearch)) {
    return createJsonResponse([])
  }

  if (url.endsWith(apiPaths.poiAroundRoute) || url.includes(apiPaths.poiAroundRoute)) {
    return createJsonResponse([])
  }

  if (url === apiPaths.route || url === apiPaths.loop || url === apiPaths.exportGpx) {
    return createJsonResponse({}, 400)
  }

  return createJsonResponse({})
}

export const createAppFetchMock = (override?: AppFetchOverride) =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = resolveRequestUrl(input)
    const overriddenResponse = override ? await override(url, input) : null

    if (overriddenResponse) {
      return overriddenResponse
    }

    return createDefaultApiResponse(url)
  })

export const resetAppTestEnvironment = () => {
  localStorage.clear()
  window.location.hash = ''
  vi.unstubAllGlobals()
}

export const setDesktopMatchMedia = () => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('(min-width: 60em)'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      addListener: () => {},
      removeListener: () => {},
    }),
  })
}

export const saveRouteResultToStorage = (routeResult: unknown) => {
  localStorage.setItem(routeStorageKey, JSON.stringify(routeResult))
}

export const isPoiAroundRouteUrl = (input: RequestInfo | URL) => {
  const url = resolveRequestUrl(input)
  return url.endsWith(apiPaths.poiAroundRoute) || url.includes(apiPaths.poiAroundRoute)
}

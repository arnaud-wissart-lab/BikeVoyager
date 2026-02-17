import { waitFor } from '@testing-library/react'
import App from '../App'
import { apiPaths } from '../features/routing/apiPaths'
import { createAppFetchMock, resetAppTestEnvironment } from './app-test-utils'
import { createJsonResponse, renderWithProviders, resolveRequestUrl } from './test-utils'

const createValhallaStatusPayload = (updateAvailable: boolean) => ({
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
    update_available: updateAvailable,
    reason: null,
    message: updateAvailable ? 'update-available' : 'up-to-date',
    checked_at: '2026-02-15T09:00:00Z',
    next_check_at: '2026-02-15T12:00:00Z',
    marker_exists: true,
    remote: {
      available: true,
      error: null,
    },
  },
})

describe('App valhalla', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    window.location.hash = '/aide'
  })

  it('charge le statut valhalla sur la page aide', async () => {
    const fetchMock = createAppFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<App />)

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) =>
        resolveRequestUrl(input as RequestInfo | URL),
      )

      expect(urls).toContain(apiPaths.valhallaStatus)
    })
  })

  it('declenche une mise a jour valhalla quand une update est disponible', async () => {
    let statusCallCount = 0

    const fetchMock = createAppFetchMock((url) => {
      if (url === apiPaths.valhallaStatus) {
        statusCallCount += 1
        return createJsonResponse(createValhallaStatusPayload(statusCallCount === 1))
      }

      if (url === apiPaths.valhallaUpdateStart) {
        return createJsonResponse({})
      }

      return undefined
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<App />)

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) =>
        resolveRequestUrl(input as RequestInfo | URL),
      )

      expect(urls).toContain(apiPaths.valhallaUpdateStart)
    })
  })
})

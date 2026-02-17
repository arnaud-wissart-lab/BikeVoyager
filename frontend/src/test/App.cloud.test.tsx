import { waitFor } from '@testing-library/react'
import App from '../App'
import { apiPaths } from '../features/routing/apiPaths'
import { createAppFetchMock, resetAppTestEnvironment } from './app-test-utils'
import { renderWithProviders, resolveRequestUrl } from './test-utils'

describe('App cloud', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
  })

  it('charge providers et session cloud au demarrage', async () => {
    const fetchMock = createAppFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<App />)

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) =>
        resolveRequestUrl(input as RequestInfo | URL),
      )

      expect(urls).toContain(apiPaths.cloudProviders)
      expect(urls).toContain(apiPaths.cloudSession)
    })
  })

  it('charge le statut cloud sur la page aide', async () => {
    window.location.hash = '/aide'

    const fetchMock = createAppFetchMock()
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<App />)

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) =>
        resolveRequestUrl(input as RequestInfo | URL),
      )

      expect(urls).toContain(apiPaths.cloudStatus)
    })
  })
})

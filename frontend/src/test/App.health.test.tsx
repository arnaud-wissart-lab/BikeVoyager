import { screen, waitFor } from '@testing-library/react'
import App from '../App'
import { apiPaths } from '../features/routing/apiPaths'
import { createAppFetchMock, resetAppTestEnvironment } from './app-test-utils'
import { createJsonResponse, renderWithProviders } from './test-utils'

describe('App health', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    window.location.hash = '/planifier'
  })

  it('affiche un message clair quand valhalla est en cours de build', async () => {
    const fetchMock = createAppFetchMock((url) => {
      if (url === apiPaths.health) {
        return createJsonResponse({
          status: 'DEGRADED',
          valhalla: {
            status: 'BUILDING',
            message: 'Le moteur est en preparation.',
            reason: 'dossier des tuiles absent',
            serviceReachable: null,
            serviceError: null,
            build: {
              state: 'running',
              phase: 'tiles',
              progressPct: 36,
              message: 'Generation des tuiles',
              updatedAt: '2026-02-25T10:30:00Z',
            },
          },
          version: '1.0.0',
          commit: 'abc123',
          checkedAt: '2026-02-25T10:30:00Z',
        })
      }

      return undefined
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithProviders(<App />)

    await waitFor(() => {
      expect(
        screen.getByText(
          "Le moteur d'itinéraire est en cours de préparation. Réessayez dans quelques minutes.",
        ),
      ).toBeInTheDocument()
    })
  })
})

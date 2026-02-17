import { screen, waitFor } from '@testing-library/react'
import App from '../App'
import { createAppFetchMock, resetAppTestEnvironment } from './app-test-utils'
import { renderWithProviders } from './test-utils'

describe('App smoke', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    vi.stubGlobal('fetch', createAppFetchMock())
  })

  it('affiche le nom du produit', async () => {
    const fetchMock = vi.mocked(fetch)

    renderWithProviders(<App />)

    expect(screen.getByText('BikeVoyager')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })
})

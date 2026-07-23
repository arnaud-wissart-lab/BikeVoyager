import { screen, waitFor } from '@testing-library/react'
import App from '../App'
import { createAppFetchMock, resetAppTestEnvironment, setDesktopMatchMedia } from './app-test-utils'
import { renderWithProviders } from './test-utils'

describe('App smoke', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    vi.stubGlobal('fetch', createAppFetchMock())
  })

  it('retire le nom visible et illustre chaque entrée du menu', async () => {
    const fetchMock = vi.mocked(fetch)
    setDesktopMatchMedia()

    renderWithProviders(<App />)

    expect(screen.queryByText('BikeVoyager')).not.toBeInTheDocument()

    for (const label of ['Planifier', 'Carte', 'Profils', 'Données', 'Aide']) {
      const tab = screen.getByRole('tab', { name: label })
      expect(tab.querySelector('svg')).not.toBeNull()
    }

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })
})

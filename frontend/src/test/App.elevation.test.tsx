import { screen } from '@testing-library/react'
import App from '../App'
import { plannerDraftStorageKey } from '../features/routing/domain'
import {
  createAppFetchMock,
  resetAppTestEnvironment,
  saveRouteResultToStorage,
  setDesktopMatchMedia,
} from './app-test-utils'
import { renderWithProviders } from './test-utils'

const savePlannerDraftMode = (mode: 'bike' | 'ebike') => {
  localStorage.setItem(
    plannerDraftStorageKey,
    JSON.stringify({
      mode,
      tripType: 'oneway',
    }),
  )
}

describe('App elevation summary', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    setDesktopMatchMedia()
    window.location.hash = '/carte'
    vi.stubGlobal('fetch', createAppFetchMock())
  })

  it('affiche les métriques d’altimétrie et la difficulté quand un profil existe', async () => {
    savePlannerDraftMode('bike')
    saveRouteResultToStorage({
      kind: 'route',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.3522, 48.8566],
          [2.36, 48.86],
        ],
      },
      distance_m: 30000,
      duration_s_engine: 7200,
      eta_s: 7200,
      turn_by_turn: [],
      elevation_profile: [
        { distance_m: 0, elevation_m: 100 },
        { distance_m: 1000, elevation_m: 130 },
        { distance_m: 1500, elevation_m: 125 },
        { distance_m: 2500, elevation_m: 160 },
        { distance_m: 3000, elevation_m: 140 },
      ],
    })

    renderWithProviders(<App />)

    await screen.findByText('Dénivelé positif')
    expect(screen.getByText('65 m')).toBeInTheDocument()
    expect(screen.getByText('Dénivelé négatif')).toBeInTheDocument()
    expect(screen.getByText('25 m')).toBeInTheDocument()
    expect(screen.getByText('Altitude min/max')).toBeInTheDocument()
    expect(screen.getAllByText('100 m - 160 m').length).toBeGreaterThan(0)
    expect(screen.getByText('Pente max')).toBeInTheDocument()
    expect(screen.getByText('3.5 %')).toBeInTheDocument()
    expect(screen.getByText('Difficulté')).toBeInTheDocument()
    expect(screen.getByText('Modéré')).toBeInTheDocument()
    expect(screen.getByTestId('elevation-profile-chart')).toBeInTheDocument()
  })

  it('affiche un fallback propre quand le profil d’altitude est absent', async () => {
    savePlannerDraftMode('bike')
    saveRouteResultToStorage({
      kind: 'route',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.3522, 48.8566],
          [2.36, 48.86],
        ],
      },
      distance_m: 1200,
      duration_s_engine: 500,
      eta_s: 500,
      turn_by_turn: [],
    })

    renderWithProviders(<App />)

    await screen.findByText('Altimétrie indisponible sur ce trajet.')
    expect(screen.queryByText('Dénivelé positif')).not.toBeInTheDocument()
    expect(screen.queryByText('Dénivelé négatif')).not.toBeInTheDocument()
    expect(screen.queryByText('Pente max')).not.toBeInTheDocument()
    expect(screen.queryByTestId('elevation-profile-chart')).not.toBeInTheDocument()
  })

  it('masque la pente max quand les segments sont trop courts pour être fiables', async () => {
    savePlannerDraftMode('bike')
    saveRouteResultToStorage({
      kind: 'route',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.3522, 48.8566],
          [2.36, 48.86],
        ],
      },
      distance_m: 1000,
      duration_s_engine: 300,
      eta_s: 300,
      turn_by_turn: [],
      elevation_profile: [
        { distance_m: 0, elevation_m: 100 },
        { distance_m: 10, elevation_m: 103 },
      ],
    })

    renderWithProviders(<App />)

    await screen.findByText('Dénivelé positif')
    expect(screen.getByText('3 m')).toBeInTheDocument()
    expect(screen.queryByText('Pente max')).not.toBeInTheDocument()
    expect(screen.getByTestId('elevation-profile-chart')).toBeInTheDocument()
  })
})

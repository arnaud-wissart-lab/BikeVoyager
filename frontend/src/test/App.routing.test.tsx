import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { apiPaths } from '../features/routing/apiPaths'
import {
  createAppFetchMock,
  isPoiAroundRouteUrl,
  resetAppTestEnvironment,
  saveRouteResultToStorage,
  setDesktopMatchMedia,
} from './app-test-utils'
import { createJsonResponse, renderWithProviders } from './test-utils'

describe('App routing', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    vi.stubGlobal('fetch', createAppFetchMock())
  })

  it('isole le depart entre aller simple et boucle', async () => {
    const user = userEvent.setup()

    renderWithProviders(<App />)

    const getActiveStartInput = () => {
      const inputs = screen.getAllByTestId('plan-start-input') as HTMLInputElement[]
      return inputs.find((input) => !input.disabled) ?? inputs[0]
    }

    await user.click(screen.getByText('Vélo'))
    await user.click(screen.getByText('Aller simple'))

    await user.type(getActiveStartInput(), 'A')
    expect(getActiveStartInput()).toHaveValue('A')

    await user.click(screen.getByText('Boucle'))
    expect(getActiveStartInput()).toHaveValue('')
    await user.type(getActiveStartInput(), 'B')
    expect(getActiveStartInput()).toHaveValue('B')

    await user.click(screen.getByText('Aller simple'))
    expect(getActiveStartInput()).toHaveValue('A')

    await user.click(screen.getByText('Boucle'))
    expect(getActiveStartInput()).toHaveValue('B')
  })

  it('enchaîne planifier, carte, navigation et sortie', async () => {
    const user = userEvent.setup()

    const mockFetch = createAppFetchMock((url) => {
      if (url.startsWith(apiPaths.placesSearch)) {
        const params = new URLSearchParams(url.split('?')[1] ?? '')
        const query = params.get('q') ?? ''
        const normalized = query.toLowerCase()
        const candidates =
          normalized.includes('paris')
            ? [
                {
                  label: 'Paris',
                  lat: 48.8566,
                  lon: 2.3522,
                  score: 0.9,
                  source: 'test',
                },
              ]
            : [
                {
                  label: 'Lyon',
                  lat: 45.764,
                  lon: 4.8357,
                  score: 0.9,
                  source: 'test',
                },
              ]

        return createJsonResponse(candidates)
      }

      if (url === apiPaths.route) {
        return createJsonResponse({
          geometry: {
            type: 'LineString',
            coordinates: [
              [2.3522, 48.8566],
              [4.8357, 45.764],
            ],
          },
          distance_m: 465000,
          duration_s_engine: 10000,
          eta_s: 10000,
          turn_by_turn: [],
          elevation_profile: [],
        })
      }

      return undefined
    })
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)

    await user.click(screen.getByText('Vélo'))
    await user.click(screen.getByText('Aller simple'))

    const startInputs = screen.getAllByTestId('plan-start-input')
    const startInput =
      startInputs.find((input) => !(input as HTMLInputElement).disabled) ??
      startInputs[0]
    await user.type(startInput, 'Paris')
    await user.click(await screen.findByTestId('plan-start-option-0'))

    const endInputs = screen.getAllByTestId('plan-end-input')
    const endInput =
      endInputs.find((input) => !(input as HTMLInputElement).disabled) ??
      endInputs[0]
    await user.type(endInput, 'Lyon')
    await user.click(await screen.findByTestId('plan-end-option-0'))

    await user.click(screen.getByRole('button', { name: 'Calculer' }))

    const navigationSetupOpen = await screen.findByTestId('nav-setup-open')
    await user.click(navigationSetupOpen)

    const navigationStart = await screen.findByTestId('nav-start')
    await user.click(navigationStart)

    const navigationExit = await screen.findByTestId('nav-exit')
    expect(navigationExit).toBeInTheDocument()
    await user.click(navigationExit)

    await waitFor(() => {
      expect(screen.getByTestId('nav-setup-open')).toBeInTheDocument()
    })
  })

  it('masque les POI paysages quand la categorie est deselectionnee', async () => {
    const user = userEvent.setup()

    setDesktopMatchMedia()
    window.location.hash = '/carte'
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
      elevation_profile: [],
    })

    const mockFetch = createAppFetchMock((url, input) => {
      if (url.endsWith(apiPaths.poiAroundRoute) || isPoiAroundRouteUrl(input)) {
        return createJsonResponse([
          {
            id: 'poi-monument',
            name: 'Monument A',
            lat: 48.8568,
            lon: 2.353,
            category: 'monuments',
            kind: 'historic:monument',
            distance_m: 120,
            tags: { name: 'Monument A' },
          },
          {
            id: 'poi-landscape',
            name: 'Belvedere',
            lat: 48.8571,
            lon: 2.354,
            category: 'paysages',
            kind: 'tourism:viewpoint',
            distance_m: 180,
            tags: { name: 'Belvedere' },
          },
        ])
      }

      return undefined
    })
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)

    await user.click(screen.getByRole('button', { name: 'Afficher le panneau' }))
    await screen.findByText('Monument A')
    await screen.findByText('Belvedere')

    await user.click(screen.getByLabelText('Paysages'))

    await waitFor(() => {
      expect(screen.queryByText('Chargement des POI...')).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('Monument A')).toBeInTheDocument()
    })
    expect(screen.queryByText('Belvedere')).not.toBeInTheDocument()
  })

  it('deduplique les POI quasi-identiques dans la liste', async () => {
    const user = userEvent.setup()

    setDesktopMatchMedia()
    window.location.hash = '/carte'
    saveRouteResultToStorage({
      kind: 'route',
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.865, 45.923],
          [6.885, 45.925],
        ],
      },
      distance_m: 2200,
      duration_s_engine: 900,
      eta_s: 900,
      turn_by_turn: [],
      elevation_profile: [],
    })

    const mockFetch = createAppFetchMock((url, input) => {
      if (url.endsWith(apiPaths.poiAroundRoute) || isPoiAroundRouteUrl(input)) {
        return createJsonResponse([
          {
            id: 'poi-dup-1',
            name: 'NIVEAU DU GLACIER',
            lat: 45.92435,
            lon: 6.87405,
            category: 'monuments',
            kind: 'historic:memorial',
            distance_m: 22,
            distance_to_route_m: 16,
            tags: { name: 'NIVEAU DU GLACIER', historic: 'memorial' },
          },
          {
            id: 'poi-dup-2',
            name: 'NIVEAU DU GLACIER',
            lat: 45.92433,
            lon: 6.87402,
            category: 'monuments',
            kind: 'historic:memorial',
            distance_m: 24,
            distance_to_route_m: 14,
            tags: { name: 'NIVEAU DU GLACIER', historic: 'memorial', wikipedia: 'fr:...' },
          },
          {
            id: 'poi-dup-3',
            name: 'NIVEAU DU GLACIER',
            lat: 45.92437,
            lon: 6.87407,
            category: 'monuments',
            kind: 'historic:memorial',
            distance_m: 21,
            distance_to_route_m: 15,
            tags: { name: 'NIVEAU DU GLACIER', historic: 'memorial' },
          },
        ])
      }

      return undefined
    })
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)

    await user.click(screen.getByRole('button', { name: 'Afficher le panneau' }))

    await screen.findByText('NIVEAU DU GLACIER')
    await waitFor(() => {
      expect(screen.getAllByText('NIVEAU DU GLACIER')).toHaveLength(1)
    })
  })

  it('n envoie pas de requete POI supplementaire quand aucune categorie visible n est selectionnee hors navigation', async () => {
    const user = userEvent.setup()

    setDesktopMatchMedia()
    window.location.hash = '/carte'
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
      elevation_profile: [],
    })

    const mockFetch = createAppFetchMock((_, input) => {
      if (isPoiAroundRouteUrl(input)) {
        return createJsonResponse([])
      }

      return undefined
    })
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)

    const getPoiAroundRouteCallCount = () =>
      mockFetch.mock.calls.filter(([input]) => isPoiAroundRouteUrl(input as RequestInfo | URL))
        .length

    await user.click(screen.getByRole('button', { name: 'Afficher le panneau' }))
    await waitFor(() => {
      expect(getPoiAroundRouteCallCount()).toBeGreaterThan(0)
    })
    await waitFor(() => {
      expect(screen.queryByText('Chargement des POI...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Monuments'))
    await waitFor(() => {
      expect(screen.queryByText('Chargement des POI...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Commerces'))
    await waitFor(() => {
      expect(screen.queryByText('Chargement des POI...')).not.toBeInTheDocument()
    })

    await user.click(screen.getByLabelText('Services'))
    await waitFor(() => {
      expect(screen.queryByText('Chargement des POI...')).not.toBeInTheDocument()
    })

    const callCountBeforeLastToggle = getPoiAroundRouteCallCount()

    await user.click(screen.getByLabelText('Paysages'))
    await waitFor(() => {
      expect(screen.getByText('Sélectionnez au moins une catégorie.')).toBeInTheDocument()
      expect(screen.queryByText('Chargement des POI...')).not.toBeInTheDocument()
    })

    expect(getPoiAroundRouteCallCount()).toBe(callCountBeforeLastToggle)
  })
})

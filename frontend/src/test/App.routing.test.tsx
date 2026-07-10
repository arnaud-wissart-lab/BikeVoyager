import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { appPreferencesStorageKey, savedTripsStorageKey } from '../features/data/dataPortability'
import { apiPaths } from '../features/routing/apiPaths'
import {
  plannerDraftStorageKey,
  routeStorageKey,
  routeOptionVariants,
  type LoopRequestPayload,
  type RouteRequestPayload,
  type TripResult,
} from '../features/routing/domain'
import {
  createAppFetchMock,
  isPoiAroundRouteUrl,
  resetAppTestEnvironment,
  saveRouteResultToStorage,
  setDesktopMatchMedia,
} from './app-test-utils'
import { createJsonResponse, renderWithProviders } from './test-utils'

const currentComparisonRoute: TripResult = {
  kind: 'route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.3522, 48.8566],
      [2.36, 48.86],
    ],
  },
  distance_m: 1200,
  duration_s_engine: 300,
  eta_s: 300,
  turn_by_turn: [],
  elevation_profile: [
    { distance_m: 0, elevation_m: 100 },
    { distance_m: 600, elevation_m: 130 },
    { distance_m: 1200, elevation_m: 115 },
  ],
}

const alternativeComparisonRoute: TripResult = {
  kind: 'route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.3522, 48.8566],
      [2.37, 48.865],
    ],
  },
  distance_m: 2400,
  duration_s_engine: 600,
  eta_s: 600,
  turn_by_turn: [],
  elevation_profile: [
    { distance_m: 0, elevation_m: 100 },
    { distance_m: 1200, elevation_m: 150 },
    { distance_m: 2400, elevation_m: 120 },
  ],
}

const currentComparisonLoop: TripResult = {
  kind: 'loop',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.3522, 48.8566],
      [2.36, 48.86],
      [2.3522, 48.8566],
    ],
  },
  distance_m: 4000,
  eta_s: 900,
  overlapScore: 'faible',
  segmentsCount: 3,
  elevation_profile: [
    { distance_m: 0, elevation_m: 100 },
    { distance_m: 2000, elevation_m: 130 },
    { distance_m: 4000, elevation_m: 100 },
  ],
}

const alternativeComparisonLoop: TripResult = {
  kind: 'loop',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.3522, 48.8566],
      [2.37, 48.865],
      [2.3522, 48.8566],
    ],
  },
  distance_m: 5000,
  eta_s: 1200,
  overlapScore: 'moyen',
  segmentsCount: 4,
  elevation_profile: [
    { distance_m: 0, elevation_m: 100 },
    { distance_m: 2500, elevation_m: 150 },
    { distance_m: 5000, elevation_m: 110 },
  ],
}

const originalWakeLockDescriptor = Object.getOwnPropertyDescriptor(navigator, 'wakeLock')

const getJsonRequestBodies = <TBody,>(mockFetch: { mock: { calls: unknown[][] } }, path: string) =>
  mockFetch.mock.calls
    .filter(([input]) => input === path)
    .map(([, init]) => {
      const body = (init as RequestInit | undefined)?.body
      expect(typeof body).toBe('string')
      return JSON.parse(body as string) as TBody
    })

const createGpxResponse = () =>
  ({
    ok: true,
    headers: new Headers(),
    blob: async () => new Blob(['<gpx />'], { type: 'application/gpx+xml' }),
  }) as Response

const setupRouteComparisonTest = (routeResponse: Response | (() => Response)) => {
  setDesktopMatchMedia()
  window.location.hash = '/carte'
  localStorage.setItem(
    plannerDraftStorageKey,
    JSON.stringify({
      mode: 'bike',
      tripType: 'oneway',
    }),
  )
  saveRouteResultToStorage(currentComparisonRoute)

  const mockFetch = createAppFetchMock((url) => {
    if (url === apiPaths.route) {
      return typeof routeResponse === 'function' ? routeResponse() : routeResponse
    }

    return undefined
  })
  vi.stubGlobal('fetch', mockFetch)

  return mockFetch
}

const setupLoopComparisonTest = (loopResponse: Response | (() => Response)) => {
  setDesktopMatchMedia()
  window.location.hash = '/carte'
  localStorage.setItem(
    plannerDraftStorageKey,
    JSON.stringify({
      mode: 'bike',
      tripType: 'loop',
    }),
  )
  saveRouteResultToStorage(currentComparisonLoop)

  const mockFetch = createAppFetchMock((url) => {
    if (url === apiPaths.loop) {
      return typeof loopResponse === 'function' ? loopResponse() : loopResponse
    }

    return undefined
  })
  vi.stubGlobal('fetch', mockFetch)

  return mockFetch
}

describe('App routing', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    vi.stubGlobal('fetch', createAppFetchMock())
  })

  afterEach(() => {
    if (originalWakeLockDescriptor) {
      Object.defineProperty(navigator, 'wakeLock', originalWakeLockDescriptor)
      return
    }

    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('isole le départ entre aller simple et boucle', async () => {
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
    const wakeLockRelease = vi.fn(() => Promise.resolve())
    const wakeLockSentinel: WakeLockSentinel = Object.assign(new EventTarget(), {
      onrelease: null,
      released: false,
      type: 'screen' as const,
      release: wakeLockRelease,
    })
    const wakeLockRequest = vi.fn<WakeLock['request']>().mockResolvedValue(wakeLockSentinel)
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: wakeLockRequest } satisfies WakeLock,
    })

    const mockFetch = createAppFetchMock((url) => {
      if (url.startsWith(apiPaths.placesSearch)) {
        const params = new URLSearchParams(url.split('?')[1] ?? '')
        const query = params.get('q') ?? ''
        const normalized = query.toLowerCase()
        const candidates = normalized.includes('paris')
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
      startInputs.find((input) => !(input as HTMLInputElement).disabled) ?? startInputs[0]
    await user.type(startInput, 'Paris')
    await user.click(await screen.findByTestId('plan-start-option-0'))

    const endInputs = screen.getAllByTestId('plan-end-input')
    const endInput =
      endInputs.find((input) => !(input as HTMLInputElement).disabled) ?? endInputs[0]
    await user.type(endInput, 'Lyon')
    await user.click(await screen.findByTestId('plan-end-option-0'))

    await user.click(screen.getByRole('button', { name: 'Calculer' }))

    const navigationSetupOpen = await screen.findByTestId('nav-setup-open')
    await user.click(navigationSetupOpen)

    const navigationStart = await screen.findByTestId('nav-start')
    await user.click(navigationStart)

    await waitFor(() => {
      expect(wakeLockRequest).toHaveBeenCalledTimes(1)
      expect(wakeLockRequest).toHaveBeenCalledWith('screen')
    })

    const navigationExit = await screen.findByTestId('nav-exit')
    expect(navigationExit).toBeInTheDocument()
    await user.click(navigationExit)

    await waitFor(() => {
      expect(wakeLockRelease).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId('nav-setup-open')).toBeInTheDocument()
    })
  })

  it('actualise l’instruction active pendant une navigation simulée', async () => {
    const user = userEvent.setup()

    setDesktopMatchMedia()
    window.location.hash = '/carte'
    saveRouteResultToStorage({
      kind: 'route',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.3522, 48.8566],
          [2.3522, 48.862],
        ],
      },
      distance_m: 600,
      duration_s_engine: 144,
      eta_s: 144,
      turn_by_turn: [
        { instruction: 'Prendre la rue A', distance_m: 100, duration_s: 24, type: 1 },
        { instruction: 'Continuer sur la rue B', distance_m: 200, duration_s: 48, type: 2 },
        { instruction: 'Rejoindre la rue C', distance_m: 300, duration_s: 72, type: 3 },
      ],
      elevation_profile: [],
    })
    vi.stubGlobal('fetch', createAppFetchMock())

    renderWithProviders(<App />)

    await user.click(await screen.findByTestId('nav-setup-open'))
    await user.click(screen.getByText('Simulation'))

    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByTestId('nav-start'))

      expect(screen.getByTestId('navigation-active-instruction')).toHaveTextContent(
        'Prendre la rue A',
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })

      expect(screen.getByTestId('navigation-active-instruction')).toHaveTextContent(
        'Continuer sur la rue B',
      )
      expect(screen.getByTestId('navigation-active-instruction')).not.toHaveTextContent(
        'Prendre la rue A',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('sauvegarde, modifie, ouvre et supprime un trajet depuis le carnet', async () => {
    const user = userEvent.setup()
    const mockFetch = createAppFetchMock((url) => {
      if (url === apiPaths.exportGpx) {
        return createGpxResponse()
      }

      return undefined
    })
    vi.stubGlobal('fetch', mockFetch)
    Object.defineProperty(window.URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:bikevoyager-test'),
    })
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    })

    setDesktopMatchMedia()
    window.location.hash = '/carte'
    localStorage.setItem(
      plannerDraftStorageKey,
      JSON.stringify({
        mode: 'bike',
        tripType: 'oneway',
        onewayStartValue: 'Paris',
        endValue: 'Lyon',
      }),
    )
    saveRouteResultToStorage({
      kind: 'route',
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
      turn_by_turn: [
        {
          instruction: 'Quitter Paris par Rue Test',
          distance_m: 120,
          duration_s: 60,
          type: 10,
        },
        {
          instruction: 'Continuer vers Lyon',
          distance_m: 850,
          duration_s: 240,
          type: 8,
        },
      ],
      elevation_profile: [],
    })

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Sauvegarder ce trajet' }))
    expect(await screen.findByLabelText('Nom du trajet')).toHaveValue('Paris → Lyon')
    await user.type(screen.getByLabelText('Notes personnelles'), 'Pause à Dijon')
    await user.type(screen.getByPlaceholderText('Ajouter un tag'), 'weekend')
    await user.click(screen.getByLabelText('Ajouter un tag'))
    await user.click(screen.getByLabelText('Favori'))
    await user.click(screen.getByRole('button', { name: 'Sauvegarder' }))

    await waitFor(() => {
      const storedTrips = JSON.parse(
        localStorage.getItem(savedTripsStorageKey) ?? '[]',
      ) as unknown[]
      expect(storedTrips).toHaveLength(1)
    })

    await user.click(screen.getByRole('tab', { name: 'Données' }))
    await user.click(await screen.findByText('Trajets sauvegardés'))
    expect(await screen.findByText('Paris → Lyon')).toBeInTheDocument()
    expect(screen.getByText('Pause à Dijon')).toBeInTheDocument()
    expect(screen.getByText('weekend')).toBeInTheDocument()

    await user.click(screen.getByPlaceholderText('Rechercher un trajet'))
    await user.type(screen.getByPlaceholderText('Rechercher un trajet'), 'week')
    expect(screen.getByText('Paris → Lyon')).toBeInTheDocument()
    const routeBeforeSavedTripGpxExport = localStorage.getItem(routeStorageKey)

    await user.click(screen.getByRole('button', { name: 'Exporter GPX' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        apiPaths.exportGpx,
        expect.objectContaining({ method: 'POST' }),
      )
    })
    const gpxBodies = getJsonRequestBodies<{
      geometry: TripResult['geometry']
      elevation_profile: TripResult['elevation_profile'] | null
      name: string
    }>(mockFetch, apiPaths.exportGpx)
    expect(gpxBodies).toHaveLength(1)
    expect(gpxBodies[0]).toMatchObject({
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.3522, 48.8566],
          [4.8357, 45.764],
        ],
      },
      elevation_profile: null,
      name: 'Paris → Lyon',
    })
    expect(localStorage.getItem(routeStorageKey)).toBe(routeBeforeSavedTripGpxExport)
    expect(window.location.hash).toBe('#/donnees')

    await user.click(screen.getByLabelText('Modifier'))
    await user.clear(screen.getByLabelText('Nom du trajet'))
    await user.type(screen.getByLabelText('Nom du trajet'), 'Paris Lyon été')
    await user.clear(screen.getByLabelText('Notes personnelles'))
    await user.type(screen.getByLabelText('Notes personnelles'), 'Variante testée')
    await user.click(screen.getByRole('button', { name: 'Sauvegarder' }))

    expect(await screen.findByText('Paris Lyon été')).toBeInTheDocument()
    expect(screen.getByText('Variante testée')).toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText('Rechercher un trajet'))
    await user.click(screen.getByRole('button', { name: 'Ouvrir sur la carte' }))

    await waitFor(() => {
      expect(window.location.hash).toBe('#/carte')
    })
    expect(screen.getAllByText('465.0 km').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Feuille de route' }))
    expect(screen.getByText('Quitter Paris par Rue Test')).toBeInTheDocument()
    expect(screen.getByText('Continuer vers Lyon')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Données' }))
    await user.click(await screen.findByText('Trajets sauvegardés'))
    await user.click(await screen.findByLabelText('Supprimer'))
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))

    await waitFor(() => {
      const storedTrips = JSON.parse(
        localStorage.getItem(savedTripsStorageKey) ?? '[]',
      ) as unknown[]
      expect(storedTrips).toHaveLength(0)
    })
  }, 10_000)

  it('masque les POI paysages quand la catégorie est désélectionnée', async () => {
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

  it('filtre les parkings voiture sans masquer le stationnement vélo et persiste le choix', async () => {
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
            id: 'poi-car-parking',
            name: 'Parking voiture',
            lat: 48.8568,
            lon: 2.353,
            category: 'services',
            kind: 'amenity:parking',
            distance_m: 120,
            tags: { name: 'Parking voiture', amenity: 'parking' },
          },
          {
            id: 'poi-bike-parking',
            name: 'Arceaux vélo',
            lat: 48.8571,
            lon: 2.354,
            category: 'services',
            kind: 'amenity:bicycle_parking',
            distance_m: 180,
            tags: { name: 'Arceaux vélo', amenity: 'bicycle_parking' },
          },
        ])
      }

      return undefined
    })
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)

    await user.click(screen.getByRole('button', { name: 'Afficher le panneau' }))
    await screen.findByText('Parking voiture')
    await screen.findByText('Arceaux vélo')
    await user.click(screen.getByText('Parking voiture'))
    expect(screen.getByRole('button', { name: 'Fermer les détails' })).toBeInTheDocument()

    expect(screen.getByText('Filtrer les POI')).toBeInTheDocument()
    await user.click(screen.getByText('Filtrer les POI'))
    await user.click(await screen.findByLabelText('Parking voiture'))
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('Parking voiture')).not.toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Fermer les détails' })).not.toBeInTheDocument()
    expect(screen.getByText('Arceaux vélo')).toBeInTheDocument()

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(appPreferencesStorageKey) ?? '{}') as {
        poiAdvancedFilterSettings?: { services?: string[] }
      }
      expect(stored.poiAdvancedFilterSettings?.services).not.toContain('car_parking')
      expect(stored.poiAdvancedFilterSettings?.services).toContain('bicycle_parking')
    })

    await user.click(screen.getByText('Filtrer les POI'))
    await user.click(screen.getByRole('button', { name: 'Réinitialiser' }))
    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.getByText('Parking voiture')).toBeInTheDocument()
    })
    expect(screen.getByText('Arceaux vélo')).toBeInTheDocument()
  })

  it('n’envoie pas de requête POI supplémentaire quand aucune catégorie visible n’est sélectionnée hors navigation', async () => {
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

  it('ouvre une comparaison quand un autre trajet est proposé sans écraser le trajet courant', async () => {
    const user = userEvent.setup()
    setupRouteComparisonTest(createJsonResponse(alternativeComparisonRoute))

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Proposer un autre trajet' }))

    expect(await screen.findByText('Comparer les trajets')).toBeInTheDocument()
    const map = await screen.findByTestId('cesium-route-map')
    expect(map).toHaveAttribute('data-route-layer-count', '2')
    expect(map).toHaveAttribute('data-alternative-route-visible', 'true')
    expect(screen.getByText('Trajet actuel')).toBeInTheDocument()
    expect(screen.getByText('Alternative')).toBeInTheDocument()
    expect(screen.getAllByText('1.2 km').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2.4 km').length).toBeGreaterThan(0)
  })

  it('garde le trajet courant quand l’utilisateur conserve le trajet actuel', async () => {
    const user = userEvent.setup()
    setupRouteComparisonTest(createJsonResponse(alternativeComparisonRoute))

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Proposer un autre trajet' }))
    await screen.findByText('Comparer les trajets')
    await user.click(screen.getByRole('button', { name: 'Garder le trajet actuel' }))

    await waitFor(() => {
      expect(screen.queryByText('Comparer les trajets')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByTestId('cesium-route-map')).toHaveAttribute(
        'data-alternative-route-visible',
        'false',
      )
    })
    expect(screen.getAllByText('1.2 km').length).toBeGreaterThan(0)
    expect(screen.queryByText('2.4 km')).not.toBeInTheDocument()
  })

  it('remplace le trajet courant quand l’utilisateur applique l’alternative', async () => {
    const user = userEvent.setup()
    const routeResponses = [
      createJsonResponse(alternativeComparisonRoute),
      createJsonResponse({
        ...alternativeComparisonRoute,
        distance_m: 3600,
        eta_s: 900,
        duration_s_engine: 900,
      }),
    ]
    const mockFetch = setupRouteComparisonTest(() => routeResponses.shift() ?? routeResponses[0])

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Proposer un autre trajet' }))
    await screen.findByText('Comparer les trajets')
    await user.click(screen.getByRole('button', { name: 'Utiliser cette alternative' }))

    await waitFor(() => {
      expect(screen.queryByText('Comparer les trajets')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByTestId('cesium-route-map')).toHaveAttribute(
        'data-alternative-route-visible',
        'false',
      )
    })
    await waitFor(() => {
      expect(screen.getAllByText('2.4 km').length).toBeGreaterThan(0)
    })

    await user.click(screen.getByRole('button', { name: 'Proposer un autre trajet' }))
    await screen.findByText('3.6 km')

    const routeBodies = getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)
    expect(routeBodies).toHaveLength(2)
    expect(routeBodies[0].options).toEqual(routeOptionVariants[1])
    expect(routeBodies[1].options).toEqual(routeOptionVariants[2])
  })

  it('relance un calcul quand l’utilisateur demande une autre alternative', async () => {
    const user = userEvent.setup()
    const routeResponses = [
      createJsonResponse(alternativeComparisonRoute),
      createJsonResponse({
        ...alternativeComparisonRoute,
        distance_m: 3600,
        eta_s: 900,
        duration_s_engine: 900,
      }),
    ]
    const mockFetch = setupRouteComparisonTest(() => routeResponses.shift() ?? routeResponses[0])

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Proposer un autre trajet' }))
    await screen.findByText('2.4 km')
    await user.click(screen.getByRole('button', { name: 'Proposer une autre alternative' }))

    await screen.findByText('3.6 km')
    const routeBodies = getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)
    expect(routeBodies).toHaveLength(2)
    expect(routeBodies[0].options).toEqual(routeOptionVariants[1])
    expect(routeBodies[1].options).toEqual(routeOptionVariants[2])
  })

  it('relance une autre boucle avec la variation suivante sans appliquer la première', async () => {
    const user = userEvent.setup()
    const loopResponses = [
      createJsonResponse(alternativeComparisonLoop),
      createJsonResponse({
        ...alternativeComparisonLoop,
        distance_m: 6000,
        eta_s: 1500,
      }),
    ]
    const mockFetch = setupLoopComparisonTest(() => loopResponses.shift() ?? loopResponses[0])

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Générer une autre boucle' }))
    await screen.findByText('5.0 km')
    await user.click(screen.getByRole('button', { name: 'Proposer une autre alternative' }))

    await screen.findByText('6.0 km')
    const loopBodies = getJsonRequestBodies<LoopRequestPayload>(mockFetch, apiPaths.loop)
    expect(loopBodies).toHaveLength(2)
    expect(loopBodies[0].variation).toBe(1)
    expect(loopBodies[1].variation).toBe(2)
  })

  it('affiche un fallback propre si l’alternative échoue', async () => {
    const user = userEvent.setup()
    setupRouteComparisonTest(createJsonResponse({ message: 'Alternative impossible.' }, 500))

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Proposer un autre trajet' }))

    expect(await screen.findByText('Alternative indisponible')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Utiliser cette alternative' })).toBeDisabled()
    expect(screen.getAllByText('1.2 km').length).toBeGreaterThan(0)
  })
})

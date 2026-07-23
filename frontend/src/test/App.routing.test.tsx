import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
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

const secondAlternativeComparisonRoute: TripResult = {
  ...alternativeComparisonRoute,
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.3522, 48.8566],
      [2.38, 48.87],
    ],
  },
  distance_m: 3600,
  eta_s: 900,
  duration_s_engine: 900,
  elevation_profile: [
    { distance_m: 0, elevation_m: 100 },
    { distance_m: 1800, elevation_m: 155 },
    { distance_m: 3600, elevation_m: 125 },
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
const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation')

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

const installGeolocationMock = () => {
  let onPosition: PositionCallback | null = null
  let nextWatchId = 1
  const watchPosition = vi
    .fn<Geolocation['watchPosition']>()
    .mockImplementation((successCallback) => {
      onPosition = successCallback
      return nextWatchId++
    })
  const clearWatch = vi.fn<Geolocation['clearWatch']>()

  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition, clearWatch },
  })

  return {
    watchPosition,
    clearWatch,
    emitPosition: (params: { lat: number; lon: number; accuracy: number; timestamp: number }) => {
      if (!onPosition) {
        throw new Error('Le suivi GPS n’est pas démarré.')
      }

      onPosition({
        coords: {
          latitude: params.lat,
          longitude: params.lon,
          accuracy: params.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: 4,
        },
        timestamp: params.timestamp,
      })
    },
  }
}

const gpsNavigationRoute: Extract<TripResult, { kind: 'route' }> = {
  kind: 'route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.35, 48.85],
      [2.35, 48.86],
    ],
  },
  distance_m: 1112,
  duration_s_engine: 180,
  eta_s: 180,
  turn_by_turn: [
    { instruction: 'Continuer tout droit', distance_m: 1112, duration_s: 180, type: 1 },
  ],
  elevation_profile: [],
}

const setupStoredGpsNavigation = (
  routeResult: TripResult = gpsNavigationRoute,
  automaticNavigationRecalculationEnabled = false,
) => {
  setDesktopMatchMedia()
  window.location.hash = '/carte'
  localStorage.setItem(
    plannerDraftStorageKey,
    JSON.stringify({
      mode: 'ebike',
      tripType: routeResult.kind === 'loop' ? 'loop' : 'oneway',
      onewayStartValue: 'Départ initial',
      endValue: 'Destination initiale',
      loopStartValue: 'Départ de boucle',
    }),
  )
  if (automaticNavigationRecalculationEnabled) {
    localStorage.setItem(
      appPreferencesStorageKey,
      JSON.stringify({ automaticNavigationRecalculationEnabled: true }),
    )
  }
  saveRouteResultToStorage(routeResult)
}

const startGpsNavigation = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByTestId('nav-setup-open'))
  await user.click(screen.getByTestId('nav-start'))
}

const emitConfirmedDeviation = (
  geolocation: ReturnType<typeof installGeolocationMock>,
  baseTimestamp: number,
) => {
  act(() => {
    geolocation.emitPosition({
      lat: 48.855,
      lon: 2.352,
      accuracy: 5,
      timestamp: baseTimestamp + 2000,
    })
    geolocation.emitPosition({
      lat: 48.855,
      lon: 2.352,
      accuracy: 5,
      timestamp: baseTimestamp + 5000,
    })
    geolocation.emitPosition({
      lat: 48.855,
      lon: 2.352,
      accuracy: 5,
      timestamp: baseTimestamp + 8000,
    })
  })
}

describe('App routing', () => {
  beforeEach(() => {
    resetAppTestEnvironment()
    vi.stubGlobal('fetch', createAppFetchMock())
  })

  afterEach(() => {
    cleanup()

    if (originalWakeLockDescriptor) {
      Object.defineProperty(navigator, 'wakeLock', originalWakeLockDescriptor)
    } else {
      Reflect.deleteProperty(navigator, 'wakeLock')
    }

    if (originalGeolocationDescriptor) {
      Object.defineProperty(navigator, 'geolocation', originalGeolocationDescriptor)
    } else {
      Reflect.deleteProperty(navigator, 'geolocation')
    }
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

  it('actualise la prochaine manœuvre pendant une navigation simulée', async () => {
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
        'Continuer sur la rue B',
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000)
      })

      expect(screen.getByTestId('navigation-active-instruction')).toHaveTextContent(
        'Rejoindre la rue C',
      )
      expect(screen.getByTestId('navigation-active-instruction')).not.toHaveTextContent(
        'Continuer sur la rue B',
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('détecte une sortie GPS et recalcule depuis la position réellement observée', async () => {
    const user = userEvent.setup()
    setupStoredGpsNavigation()
    const geolocation = installGeolocationMock()
    const recalculatedRoute: Extract<TripResult, { kind: 'route' }> = {
      ...gpsNavigationRoute,
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.352, 48.855],
          [2.35, 48.86],
        ],
      },
      distance_m: 600,
    }
    const mockFetch = createAppFetchMock((url) => {
      if (url === apiPaths.route) {
        return createJsonResponse({
          geometry: recalculatedRoute.geometry,
          distance_m: recalculatedRoute.distance_m,
          duration_s_engine: recalculatedRoute.duration_s_engine,
          eta_s: recalculatedRoute.eta_s,
          turn_by_turn: recalculatedRoute.turn_by_turn,
          elevation_profile: recalculatedRoute.elevation_profile,
        })
      }

      return undefined
    })
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))

    const baseTimestamp = Date.now() - 20_000
    act(() => {
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.35002,
        accuracy: 5,
        timestamp: baseTimestamp,
      })
    })
    expect(screen.queryByTestId('navigation-off-route-alert')).not.toBeInTheDocument()
    emitConfirmedDeviation(geolocation, baseTimestamp)

    expect(await screen.findByTestId('navigation-off-route-alert')).toBeVisible()
    expect(screen.getByTestId('navigation-off-route-distance')).toHaveTextContent(
      'Écart estimé : environ',
    )

    await user.click(screen.getByTestId('navigation-recalculate-from-position'))

    await waitFor(() => {
      expect(getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)).toHaveLength(1)
    })
    const [payload] = getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)
    expect(payload.from).toEqual({
      lat: 48.855,
      lon: 2.352,
      label: 'Position GPS actuelle',
    })
    expect(payload.from.lon).not.toBe(2.35)
    expect(payload.to).toEqual({
      lat: 48.86,
      lon: 2.35,
      label: 'Destination initiale',
    })
    expect(payload.mode).toBe('ebike')
    expect(payload.options).toEqual(routeOptionVariants[0])
    expect(payload.speedKmh).toBe(25)
    expect(payload.ebikeAssist).toBe('medium')

    await waitFor(() => {
      expect(screen.getByTestId('navigation-recalculation-success')).toHaveTextContent(
        'Itinéraire recalculé',
      )
      expect(screen.getByTestId('nav-exit')).toBeInTheDocument()
      expect(screen.getByText('Mode GPS réel')).toBeInTheDocument()
      expect(screen.queryByTestId('navigation-off-route-alert')).not.toBeInTheDocument()
      expect(geolocation.watchPosition).toHaveBeenCalledTimes(2)
    })
    const storedRoute = JSON.parse(localStorage.getItem(routeStorageKey) ?? 'null') as TripResult
    expect(storedRoute.geometry).toEqual(recalculatedRoute.geometry)
  })

  it('continue sans recalcul puis réarme l’avertissement après retour sur le trajet', async () => {
    const user = userEvent.setup()
    setupStoredGpsNavigation(gpsNavigationRoute, true)
    const geolocation = installGeolocationMock()

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))

    const baseTimestamp = Date.now() - 20_000
    emitConfirmedDeviation(geolocation, baseTimestamp)
    await user.click(await screen.findByTestId('navigation-dismiss-off-route'))

    expect(screen.queryByTestId('navigation-off-route-alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('navigation-auto-recalculation-cancelled')).toHaveTextContent(
      'Recalcul automatique annulé pour cette sortie',
    )
    act(() => {
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.352,
        accuracy: 5,
        timestamp: baseTimestamp + 9000,
      })
    })
    expect(screen.queryByTestId('navigation-off-route-alert')).not.toBeInTheDocument()

    act(() => {
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.35002,
        accuracy: 5,
        timestamp: baseTimestamp + 10_000,
      })
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.35002,
        accuracy: 5,
        timestamp: baseTimestamp + 11_000,
      })
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.352,
        accuracy: 5,
        timestamp: baseTimestamp + 12_000,
      })
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.352,
        accuracy: 5,
        timestamp: baseTimestamp + 15_000,
      })
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.352,
        accuracy: 5,
        timestamp: baseTimestamp + 18_000,
      })
    })

    expect(await screen.findByTestId('navigation-off-route-alert')).toBeVisible()
  })

  it('affiche le compte à rebours optionnel et réutilise le recalcul existant immédiatement', async () => {
    const user = userEvent.setup()
    setupStoredGpsNavigation(gpsNavigationRoute, true)
    const geolocation = installGeolocationMock()
    const mockFetch = createAppFetchMock((url) =>
      url === apiPaths.route
        ? createJsonResponse({
            geometry: gpsNavigationRoute.geometry,
            distance_m: gpsNavigationRoute.distance_m,
            duration_s_engine: gpsNavigationRoute.duration_s_engine,
            eta_s: gpsNavigationRoute.eta_s,
            turn_by_turn: gpsNavigationRoute.turn_by_turn,
            elevation_profile: gpsNavigationRoute.elevation_profile,
          })
        : undefined,
    )
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))
    emitConfirmedDeviation(geolocation, Date.now() - 20_000)

    expect(await screen.findByTestId('navigation-auto-recalculation-countdown')).toHaveTextContent(
      'Recalcul automatique dans 8 s',
    )
    await user.click(screen.getByTestId('navigation-auto-recalculate-now'))

    await waitFor(() => {
      expect(getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)).toHaveLength(1)
      expect(screen.getByTestId('navigation-recalculation-success')).toBeVisible()
    })
    expect(screen.getByTestId('nav-exit')).toBeEnabled()
    expect(screen.getByText('Mode GPS réel')).toBeVisible()
  })

  it('conserve l’ancien trajet et autorise une nouvelle tentative après un échec', async () => {
    const user = userEvent.setup()
    setupStoredGpsNavigation()
    const geolocation = installGeolocationMock()
    const mockFetch = createAppFetchMock((url) =>
      url === apiPaths.route ? createJsonResponse({ message: 'Échec du test' }, 500) : undefined,
    )
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))
    emitConfirmedDeviation(geolocation, Date.now() - 20_000)

    await user.click(await screen.findByTestId('navigation-recalculate-from-position'))

    expect(await screen.findByText('Impossible de recalculer l’itinéraire')).toBeVisible()
    expect(screen.getByTestId('navigation-recalculate-from-position')).toBeEnabled()
    expect(screen.getByTestId('nav-exit')).toBeInTheDocument()
    const storedRoute = JSON.parse(localStorage.getItem(routeStorageKey) ?? 'null') as TripResult
    expect(storedRoute.geometry).toEqual(gpsNavigationRoute.geometry)
  })

  it('empêche un double appel pendant le recalcul', async () => {
    const user = userEvent.setup()
    setupStoredGpsNavigation()
    const geolocation = installGeolocationMock()
    let resolveRouteResponse: ((response: Response) => void) | null = null
    const routeResponse = new Promise<Response>((resolve) => {
      resolveRouteResponse = resolve
    })
    const mockFetch = createAppFetchMock((url) =>
      url === apiPaths.route ? routeResponse : undefined,
    )
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))
    emitConfirmedDeviation(geolocation, Date.now() - 20_000)

    const recalculateButton = await screen.findByTestId('navigation-recalculate-from-position')
    await user.click(recalculateButton)

    expect(recalculateButton).toBeDisabled()
    expect(recalculateButton).toHaveTextContent('Recalcul en cours…')
    expect(screen.getByTestId('navigation-dismiss-off-route')).toBeDisabled()
    fireEvent.click(recalculateButton)
    expect(getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)).toHaveLength(1)

    act(() => {
      resolveRouteResponse?.(
        createJsonResponse({
          geometry: gpsNavigationRoute.geometry,
          distance_m: gpsNavigationRoute.distance_m,
          duration_s_engine: gpsNavigationRoute.duration_s_engine,
          eta_s: gpsNavigationRoute.eta_s,
          turn_by_turn: gpsNavigationRoute.turn_by_turn,
          elevation_profile: gpsNavigationRoute.elevation_profile,
        }),
      )
    })
    expect(await screen.findByTestId('navigation-recalculation-success')).toBeVisible()
  })

  it('ignore le résultat tardif lorsque l’utilisateur quitte la navigation', async () => {
    const user = userEvent.setup()
    setupStoredGpsNavigation()
    const geolocation = installGeolocationMock()
    let resolveRouteResponse: ((response: Response) => void) | null = null
    const routeResponse = new Promise<Response>((resolve) => {
      resolveRouteResponse = resolve
    })
    const mockFetch = createAppFetchMock((url) =>
      url === apiPaths.route ? routeResponse : undefined,
    )
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))
    emitConfirmedDeviation(geolocation, Date.now() - 20_000)
    await user.click(await screen.findByTestId('navigation-recalculate-from-position'))

    await user.click(screen.getByTestId('nav-exit'))
    expect(screen.queryByTestId('nav-exit')).not.toBeInTheDocument()

    await act(async () => {
      resolveRouteResponse?.(
        createJsonResponse({
          geometry: alternativeComparisonRoute.geometry,
          distance_m: alternativeComparisonRoute.distance_m,
          duration_s_engine: alternativeComparisonRoute.duration_s_engine,
          eta_s: alternativeComparisonRoute.eta_s,
          turn_by_turn: alternativeComparisonRoute.turn_by_turn,
          elevation_profile: alternativeComparisonRoute.elevation_profile,
        }),
      )
      await Promise.resolve()
    })

    const storedRoute = JSON.parse(localStorage.getItem(routeStorageKey) ?? 'null') as TripResult
    expect(storedRoute.geometry).toEqual(gpsNavigationRoute.geometry)
    expect(screen.queryByTestId('nav-exit')).not.toBeInTheDocument()
    expect(screen.queryByTestId('navigation-recalculation-success')).not.toBeInTheDocument()
  })

  it('ignore le résultat d’une ancienne session après un redémarrage de la navigation', async () => {
    const user = userEvent.setup()
    setupStoredGpsNavigation()
    const geolocation = installGeolocationMock()
    let resolveRouteResponse: ((response: Response) => void) | null = null
    const routeResponse = new Promise<Response>((resolve) => {
      resolveRouteResponse = resolve
    })
    const mockFetch = createAppFetchMock((url) =>
      url === apiPaths.route ? routeResponse : undefined,
    )
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))
    emitConfirmedDeviation(geolocation, Date.now() - 20_000)
    await user.click(await screen.findByTestId('navigation-recalculate-from-position'))

    await user.click(screen.getByTestId('nav-exit'))
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(2))

    await act(async () => {
      resolveRouteResponse?.(
        createJsonResponse({
          geometry: alternativeComparisonRoute.geometry,
          distance_m: alternativeComparisonRoute.distance_m,
          duration_s_engine: alternativeComparisonRoute.duration_s_engine,
          eta_s: alternativeComparisonRoute.eta_s,
          turn_by_turn: alternativeComparisonRoute.turn_by_turn,
          elevation_profile: alternativeComparisonRoute.elevation_profile,
        }),
      )
      await Promise.resolve()
    })

    const storedRoute = JSON.parse(localStorage.getItem(routeStorageKey) ?? 'null') as TripResult
    expect(storedRoute.geometry).toEqual(gpsNavigationRoute.geometry)
    expect(screen.getByTestId('nav-exit')).toBeInTheDocument()
    expect(screen.getByText('Mode GPS réel')).toBeInTheDocument()
    expect(screen.queryByTestId('navigation-recalculation-success')).not.toBeInTheDocument()
  })

  it('bloque le recalcul quand la dernière position devient trop imprécise', async () => {
    const user = userEvent.setup()
    setupStoredGpsNavigation()
    const geolocation = installGeolocationMock()
    const mockFetch = createAppFetchMock()
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))
    const baseTimestamp = Date.now() - 20_000
    emitConfirmedDeviation(geolocation, baseTimestamp)

    act(() => {
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.352,
        accuracy: 60,
        timestamp: baseTimestamp + 9000,
      })
    })

    expect(await screen.findByText('Position GPS trop imprécise')).toBeVisible()
    expect(screen.getByTestId('navigation-recalculate-from-position')).toBeDisabled()
    fireEvent.click(screen.getByTestId('navigation-recalculate-from-position'))
    expect(getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)).toHaveLength(0)
  })

  it('détecte la sortie d’une boucle sans proposer de recalcul', async () => {
    const user = userEvent.setup()
    const loopRoute: TripResult = {
      kind: 'loop',
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.35, 48.85],
          [2.35, 48.86],
          [2.36, 48.86],
          [2.35, 48.85],
        ],
      },
      distance_m: 3000,
      eta_s: 600,
      overlapScore: 'faible',
      segmentsCount: 3,
      elevation_profile: [],
    }
    setupStoredGpsNavigation(loopRoute, true)
    const geolocation = installGeolocationMock()
    const mockFetch = createAppFetchMock()
    vi.stubGlobal('fetch', mockFetch)

    renderWithProviders(<App />)
    await startGpsNavigation(user)
    await waitFor(() => expect(geolocation.watchPosition).toHaveBeenCalledTimes(1))
    const baseTimestamp = Date.now() - 20_000
    act(() => {
      geolocation.emitPosition({ lat: 48.855, lon: 2.34, accuracy: 5, timestamp: baseTimestamp })
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.34,
        accuracy: 5,
        timestamp: baseTimestamp + 3000,
      })
      geolocation.emitPosition({
        lat: 48.855,
        lon: 2.34,
        accuracy: 5,
        timestamp: baseTimestamp + 6000,
      })
    })

    expect(await screen.findByTestId('navigation-off-route-alert')).toBeVisible()
    expect(screen.getByText('Le recalcul des boucles n’est pas encore disponible')).toBeVisible()
    expect(screen.queryByTestId('navigation-auto-recalculation-countdown')).not.toBeInTheDocument()
    expect(screen.queryByTestId('navigation-recalculate-from-position')).not.toBeInTheDocument()
    expect(getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)).toHaveLength(0)
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

  it('ne compare pas le trajet avec lui-même quand aucune variante distincte n’est trouvée', async () => {
    const user = userEvent.setup()
    const mockFetch = setupRouteComparisonTest(createJsonResponse(currentComparisonRoute))

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Proposer un autre trajet' }))

    expect(await screen.findByTestId('route-alternative-unavailable')).toHaveTextContent(
      'Aucun autre trajet distinct n’a été trouvé.',
    )
    expect(screen.queryByText('Comparer les trajets')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Proposer un autre trajet' }),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('cesium-route-map')).toHaveAttribute('data-route-layer-count', '1')

    const routeBodies = getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)
    expect(routeBodies).toHaveLength(routeOptionVariants.length)
    expect(routeBodies.map((body) => body.options)).toEqual([
      routeOptionVariants[1],
      routeOptionVariants[2],
      routeOptionVariants[3],
      routeOptionVariants[0],
    ])
  })

  it('ignore un doublon puis compare la première variante réellement distincte', async () => {
    const user = userEvent.setup()
    const routeResponses = [
      createJsonResponse(currentComparisonRoute),
      createJsonResponse(alternativeComparisonRoute),
    ]
    const mockFetch = setupRouteComparisonTest(() => routeResponses.shift() ?? routeResponses[0])

    renderWithProviders(<App />)

    await user.click(await screen.findByRole('button', { name: 'Proposer un autre trajet' }))

    expect(await screen.findByText('Comparer les trajets')).toBeInTheDocument()
    expect(screen.getAllByText('1.2 km').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2.4 km').length).toBeGreaterThan(0)

    const storedRoute = JSON.parse(localStorage.getItem(routeStorageKey) ?? '{}') as {
      distance_m?: number
    }
    expect(storedRoute.distance_m).toBe(currentComparisonRoute.distance_m)

    const routeBodies = getJsonRequestBodies<RouteRequestPayload>(mockFetch, apiPaths.route)
    expect(routeBodies).toHaveLength(2)
    expect(routeBodies[0].options).toEqual(routeOptionVariants[1])
    expect(routeBodies[1].options).toEqual(routeOptionVariants[2])
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
      createJsonResponse(secondAlternativeComparisonRoute),
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
      createJsonResponse(secondAlternativeComparisonRoute),
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

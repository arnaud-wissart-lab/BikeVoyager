import type { TFunction } from 'i18next'
import { createNavigationRecalculationActions } from '../features/routing/actions.navigation'
import { apiPaths } from '../features/routing/apiPaths'
import type { RouteRequestPayload, TripResult } from '../features/routing/domain'
import { createJsonResponse } from './test-utils'

type NavigationActionParams = Parameters<typeof createNavigationRecalculationActions>[0]
type NavigationActionStore = NavigationActionParams['store']

const routeResult: TripResult = {
  kind: 'route',
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.35, 48.85],
      [2.36, 48.86],
    ],
  },
  distance_m: 1500,
  duration_s_engine: 360,
  eta_s: 360,
  turn_by_turn: [],
  elevation_profile: [],
}

const replacementRoute: TripResult = {
  ...routeResult,
  geometry: {
    type: 'LineString',
    coordinates: [
      [2.37, 48.87],
      [2.38, 48.88],
    ],
  },
}

const previousPayload: RouteRequestPayload = {
  from: { lat: 48.85, lon: 2.35, label: 'Départ initial' },
  to: { lat: 48.86, lon: 2.36, label: 'Destination initiale' },
  mode: 'bicycle',
  options: { preferCycleways: true, avoidHills: false },
  speedKmh: 18,
}

const createDeferredResponse = () => {
  let resolve: ((response: Response) => void) | null = null
  const promise = new Promise<Response>((resolvePromise) => {
    resolve = resolvePromise
  })

  return {
    promise,
    resolve: (response: Response) => resolve?.(response),
  }
}

const createSuccessfulResponse = (route: TripResult = replacementRoute) => {
  if (route.kind !== 'route') {
    throw new Error('Le test attend un trajet classique.')
  }

  return createJsonResponse({
    geometry: route.geometry,
    distance_m: route.distance_m,
    duration_s_engine: route.duration_s_engine,
    eta_s: route.eta_s,
    turn_by_turn: route.turn_by_turn,
    elevation_profile: route.elevation_profile,
  })
}

const createStore = () =>
  ({
    mode: 'bike',
    profileSettings: {
      speeds: { walk: 5, bike: 18, ebike: 22 },
      ebikeAssist: 'medium',
    },
    detourPoints: [],
    navigationProgress: {
      distance_m: 300,
      lat: 48.852,
      lon: 2.352,
      heading_deg: 0,
      source: 'gps',
      speed_mps: 4,
      observed_lat: 48.853,
      observed_lon: 2.353,
      accuracy_m: 5,
      observed_at_ms: Date.now() - 1000,
    },
    navigationRecalculationInFlightRef: { current: false },
    navigationRecalculationGenerationRef: { current: 0 },
    navigationRecalculationRequestIdRef: { current: null },
    navigationIsActiveRef: { current: true },
    navigationModeRef: { current: 'gps' },
    navigationRouteResultRef: { current: routeResult },
    routeAlternativeIndex: 0,
    lastRouteRequestRef: {
      current: { type: 'route', payload: previousPayload },
    },
    setRouteErrorMessage: vi.fn(),
    setRouteErrorKey: vi.fn(),
    setRouteResultFromNavigationRecalculation: vi.fn(),
    setHasResult: vi.fn(),
    setIsDirty: vi.fn(),
    setDetourPoints: vi.fn(),
    setNavigationProgress: vi.fn(),
    setNavigationDeviationState: vi.fn(),
    setNavigationRecalculationStatus: vi.fn(),
  }) as unknown as NavigationActionStore

const createActions = (store: NavigationActionStore) =>
  createNavigationRecalculationActions({
    store,
    map: {
      mapTripType: 'oneway',
      mapStartCoordinate: [2.35, 48.85],
      mapEndCoordinate: [2.36, 48.86],
      startLabel: 'Départ initial',
      endLabel: 'Destination initiale',
      mapHeaderTitle: 'Trajet de test',
    },
    t: ((key: string) =>
      key === 'navigationCurrentGpsPosition' ? 'Position GPS actuelle' : key) as TFunction,
  })

describe('actions de recalcul de navigation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('conserve la dernière demande après un échec et ne la remplace qu’après un succès accepté', async () => {
    const store = createStore()
    const previousRequest = store.lastRouteRequestRef.current
    const deferred = createDeferredResponse()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createJsonResponse({ message: 'Échec' }, 500))
      .mockReturnValueOnce(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)
    const actions = createActions(store)

    await expect(actions.handleRecalculateFromCurrentPosition()).resolves.toBe(false)
    expect(store.lastRouteRequestRef.current).toBe(previousRequest)

    const successfulRequest = actions.handleRecalculateFromCurrentPosition()
    expect(store.lastRouteRequestRef.current).toBe(previousRequest)

    deferred.resolve(createSuccessfulResponse())
    await expect(successfulRequest).resolves.toBe(true)

    expect(store.lastRouteRequestRef.current).not.toBe(previousRequest)
    expect(store.lastRouteRequestRef.current?.type).toBe('route')
    expect(store.setRouteResultFromNavigationRecalculation).toHaveBeenCalledWith(
      expect.objectContaining({ geometry: replacementRoute.geometry }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      apiPaths.route,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('ignore une réponse lorsque le trajet courant a changé', async () => {
    const store = createStore()
    const previousRequest = store.lastRouteRequestRef.current
    const deferred = createDeferredResponse()
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockReturnValue(deferred.promise))
    const request = createActions(store).handleRecalculateFromCurrentPosition()

    store.navigationRecalculationGenerationRef.current += 1
    store.navigationRecalculationRequestIdRef.current = null
    store.navigationRecalculationInFlightRef.current = false
    store.navigationRouteResultRef.current = replacementRoute

    deferred.resolve(createSuccessfulResponse())
    await expect(request).resolves.toBe(false)

    expect(store.lastRouteRequestRef.current).toBe(previousRequest)
    expect(store.setRouteResultFromNavigationRecalculation).not.toHaveBeenCalled()
    expect(store.setNavigationRecalculationStatus).not.toHaveBeenCalledWith('success')
  })

  it('ne laisse pas une ancienne requête libérer le verrou de la suivante', async () => {
    const store = createStore()
    const firstDeferred = createDeferredResponse()
    const secondDeferred = createDeferredResponse()
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockReturnValueOnce(firstDeferred.promise)
        .mockReturnValueOnce(secondDeferred.promise),
    )
    const actions = createActions(store)

    const firstRequest = actions.handleRecalculateFromCurrentPosition()
    store.navigationRecalculationGenerationRef.current += 1
    store.navigationRecalculationRequestIdRef.current = null
    store.navigationRecalculationInFlightRef.current = false

    const secondRequest = actions.handleRecalculateFromCurrentPosition()
    const secondRequestId = store.navigationRecalculationRequestIdRef.current

    firstDeferred.resolve(createSuccessfulResponse())
    await expect(firstRequest).resolves.toBe(false)

    expect(store.navigationRecalculationRequestIdRef.current).toBe(secondRequestId)
    expect(store.navigationRecalculationInFlightRef.current).toBe(true)
    expect(store.setRouteResultFromNavigationRecalculation).not.toHaveBeenCalled()

    secondDeferred.resolve(createSuccessfulResponse())
    await expect(secondRequest).resolves.toBe(true)

    expect(store.navigationRecalculationRequestIdRef.current).toBeNull()
    expect(store.navigationRecalculationInFlightRef.current).toBe(false)
    expect(store.setRouteResultFromNavigationRecalculation).toHaveBeenCalledTimes(1)
  })
})

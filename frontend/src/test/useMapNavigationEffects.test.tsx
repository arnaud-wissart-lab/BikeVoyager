import { act, renderHook, waitFor } from '@testing-library/react'
import type { TFunction } from 'i18next'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMapNavigationEffects } from '../features/map/useMapNavigationEffects'
import {
  buildCumulativeDistances,
  createNavigationDeviationState,
  type NavigationMode,
  type NavigationProgress,
} from '../features/routing/domain'

const routeCoordinates: [number, number][] = [
  [2.35, 48.85],
  [2.35, 48.86],
]
const routeCumulativeDistances = buildCumulativeDistances(routeCoordinates)
const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
const t = ((key: string) => key) as TFunction
const noop = () => undefined

const createPosition = (overrides: Partial<GeolocationCoordinates> = {}): GeolocationPosition => ({
  coords: {
    latitude: 48.855,
    longitude: 2.351,
    accuracy: 8,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: 4,
    ...overrides,
  },
  timestamp: Date.now(),
})

const useNavigationEffectsTestHarness = (navigationMode: NavigationMode) => {
  const [navigationProgress, setNavigationProgress] = useState<NavigationProgress | null>(null)
  const [navigationDeviationState, setNavigationDeviationState] = useState(() =>
    createNavigationDeviationState(),
  )
  const alertSeenPoiIdsRef = useRef(new Set<string>())
  const simulationDistanceRef = useRef(0)

  useMapNavigationEffects({
    route: 'carte',
    hasRoute: true,
    isDesktop: true,
    isNavigationActive: true,
    isPoiModalOpen: false,
    selectedPoiId: null,
    visiblePoiItems: [],
    routeCoordinates,
    routeCumulativeDistances,
    routeDistanceFromGeometry: routeCumulativeDistances.at(-1) ?? 0,
    simulationSpeedKmh: 15,
    navigationMode,
    navigationProgress,
    poiAlertEnabled: false,
    poiAlertCategories: [],
    poiItems: [],
    poiAlertDistanceMeters: 100,
    systemNotificationsEnabled: false,
    alertSeenPoiIdsRef,
    simulationDistanceRef,
    setIsNavigationActive: noop,
    setIsNavigationSetupOpen: noop,
    setIsMobileMapPanelExpanded: noop,
    setSelectedPoiId: noop,
    setIsPoiModalOpen: noop,
    setIsMobilePoiDetailsExpanded: noop,
    setNavigationProgress,
    setNavigationError: noop,
    setNavigationDeviationState,
    setNavigationRecalculationStatus: noop,
    setActivePoiAlertId: noop,
    t,
  })

  return { navigationProgress, navigationDeviationState }
}

describe('useMapNavigationEffects', () => {
  afterEach(() => {
    if (originalGeolocationDescriptor) {
      Object.defineProperty(navigator, 'geolocation', originalGeolocationDescriptor)
      return
    }

    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('conserve la position GPS observée séparément de la projection et nettoie le suivi', async () => {
    let onPosition: PositionCallback | null = null
    const clearWatch = vi.fn()
    const watchPosition = vi
      .fn<Geolocation['watchPosition']>()
      .mockImplementation((successCallback) => {
        onPosition = successCallback
        return 17
      })
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch },
    })

    const { result, unmount } = renderHook(() => useNavigationEffectsTestHarness('gps'))
    await waitFor(() => expect(watchPosition).toHaveBeenCalledTimes(1))

    const timestamp = Date.now()
    act(() => {
      onPosition?.({ ...createPosition(), timestamp })
    })

    await waitFor(() => {
      expect(result.current.navigationProgress?.observed_lat).toBe(48.855)
    })
    expect(result.current.navigationProgress).toMatchObject({
      lat: 48.855,
      lon: 2.35,
      observed_lat: 48.855,
      observed_lon: 2.351,
      accuracy_m: 8,
      observed_at_ms: timestamp,
      source: 'gps',
    })
    expect(result.current.navigationProgress?.distance_to_route_m).toBeGreaterThan(60)
    expect(result.current.navigationProgress?.lon).not.toBe(
      result.current.navigationProgress?.observed_lon,
    )

    unmount()
    expect(clearWatch).toHaveBeenCalledWith(17)
  })

  it('ne fabrique aucune donnée GPS brute en simulation', async () => {
    const watchPosition = vi.fn<Geolocation['watchPosition']>()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition, clearWatch: vi.fn() },
    })

    const { result } = renderHook(() => useNavigationEffectsTestHarness('simulation'))

    await waitFor(() => expect(result.current.navigationProgress).not.toBeNull())
    expect(watchPosition).not.toHaveBeenCalled()
    expect(result.current.navigationProgress).not.toHaveProperty('observed_lat')
    expect(result.current.navigationProgress).not.toHaveProperty('observed_lon')
    expect(result.current.navigationProgress).not.toHaveProperty('accuracy_m')
    expect(result.current.navigationProgress).not.toHaveProperty('observed_at_ms')
    expect(result.current.navigationDeviationState.status).toBe('on_route')
  })
})

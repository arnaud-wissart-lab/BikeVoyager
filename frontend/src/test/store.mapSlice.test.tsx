import { act, renderHook } from '@testing-library/react'
import { defaultAppPreferences } from '../features/data/dataPortability'
import { emptyPlannerDraft, type TripResult } from '../features/routing/domain'
import { useMapSlice } from '../state/store.mapSlice'

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

const renderMapSlice = () =>
  renderHook(() =>
    useMapSlice({
      initialPlannerDraft: emptyPlannerDraft,
      initialAppPreferences: defaultAppPreferences,
    }),
  )

describe('cycle de vie du recalcul dans le store cartographique', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('invalide immédiatement une demande lorsque le trajet courant change', () => {
    const { result } = renderMapSlice()

    act(() => {
      result.current.navigationRecalculationGenerationRef.current = 7
      result.current.navigationRecalculationRequestIdRef.current = 7
      result.current.navigationRecalculationInFlightRef.current = true
      result.current.setNavigationRecalculationStatus('loading')
      result.current.setRouteResult(routeResult)
    })

    expect(result.current.routeResult).toBe(routeResult)
    expect(result.current.navigationRouteResultRef.current).toBe(routeResult)
    expect(result.current.navigationRecalculationGenerationRef.current).toBe(8)
    expect(result.current.navigationRecalculationRequestIdRef.current).toBeNull()
    expect(result.current.navigationRecalculationInFlightRef.current).toBe(false)
    expect(result.current.navigationRecalculationStatus).toBe('idle')
    expect(result.current.navigationSessionKey).toBe(1)
  })

  it('crée une nouvelle session de navigation au redémarrage et au recalcul', () => {
    const { result } = renderMapSlice()

    act(() => result.current.setIsNavigationActive(true))
    expect(result.current.navigationSessionKey).toBe(1)

    act(() => result.current.setIsNavigationActive(false))
    expect(result.current.navigationSessionKey).toBe(1)

    act(() => result.current.setIsNavigationActive(true))
    expect(result.current.navigationSessionKey).toBe(2)

    act(() => result.current.setRouteResultFromNavigationRecalculation(routeResult))
    expect(result.current.navigationSessionKey).toBe(3)
  })

  it('invalide une demande au démontage sans modifier un état démonté', () => {
    const { result, unmount } = renderMapSlice()
    const generationRef = result.current.navigationRecalculationGenerationRef
    const requestIdRef = result.current.navigationRecalculationRequestIdRef
    const inFlightRef = result.current.navigationRecalculationInFlightRef

    act(() => {
      generationRef.current = 3
      requestIdRef.current = 3
      inFlightRef.current = true
    })

    unmount()

    expect(generationRef.current).toBe(4)
    expect(requestIdRef.current).toBeNull()
    expect(inFlightRef.current).toBe(false)
  })
})

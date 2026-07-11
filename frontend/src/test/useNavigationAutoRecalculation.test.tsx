import { StrictMode, type PropsWithChildren } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import {
  createNavigationDeviationState,
  type NavigationDeviationState,
  type NavigationRecalculationPlan,
} from '../features/routing/domain'
import {
  useNavigationAutoRecalculation,
  type UseNavigationAutoRecalculationParams,
} from '../features/map/useNavigationAutoRecalculation'

const availablePlan: NavigationRecalculationPlan = {
  available: true,
  payload: {
    from: { lat: 48.85, lon: 2.35, label: 'Position GPS actuelle' },
    to: { lat: 48.86, lon: 2.36, label: 'Destination' },
    mode: 'bicycle',
    options: {
      use_roads: 0.5,
      use_hills: 0.5,
      use_ferry: 0.5,
    },
    speedKmh: 16,
  },
}

const offRouteState = (firstOffRouteAtMs = 1000): NavigationDeviationState => ({
  ...createNavigationDeviationState(),
  status: 'off_route',
  firstOffRouteAtMs,
  distanceToRouteMeters: 75,
  accuracyMeters: 5,
})

const createParams = (
  overrides: Partial<UseNavigationAutoRecalculationParams> = {},
): UseNavigationAutoRecalculationParams => ({
  enabled: true,
  isNavigationActive: true,
  navigationMode: 'gps',
  deviationState: offRouteState(),
  recalculationStatus: 'idle',
  routeSessionKey: 1,
  getRecalculationPlan: vi.fn(() => availablePlan),
  onRecalculate: vi.fn(async () => true),
  ...overrides,
})

const StrictModeWrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-11T10:00:00.000Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useNavigationAutoRecalculation', () => {
  it('démarre à huit secondes, actualise l’affichage et appelle une seule fois à l’expiration', () => {
    const params = createParams()
    const { result } = renderHook(() => useNavigationAutoRecalculation(params))

    expect(result.current.status).toBe('countdown')
    expect(result.current.remainingSeconds).toBe(8)

    act(() => vi.advanceTimersByTime(2100))
    expect(result.current.remainingSeconds).toBe(6)

    act(() => vi.advanceTimersByTime(5900))
    expect(params.onRecalculate).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('triggered')

    act(() => vi.advanceTimersByTime(20_000))
    expect(params.onRecalculate).toHaveBeenCalledTimes(1)
  })

  it('ne double pas l’appel sous StrictMode', () => {
    const params = createParams()
    renderHook(() => useNavigationAutoRecalculation(params), { wrapper: StrictModeWrapper })

    act(() => vi.advanceTimersByTime(8000))

    expect(params.onRecalculate).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['option désactivée', { enabled: false }],
    ['simulation', { navigationMode: 'simulation' as const }],
    ['statut suspected', { deviationState: { ...offRouteState(), status: 'suspected' as const } }],
    [
      'plan indisponible pour une boucle, des étapes ou un GPS invalide',
      {
        getRecalculationPlan: vi.fn((): NavigationRecalculationPlan => ({
          available: false,
          reason: 'loop',
        })),
      },
    ],
  ])('ne démarre pas quand %s', (_label, overrides) => {
    const params = createParams(overrides)
    const { result } = renderHook(() => useNavigationAutoRecalculation(params))

    expect(result.current.status).toBe('idle')
    expect(result.current.remainingSeconds).toBeNull()
    act(() => vi.advanceTimersByTime(8000))
    expect(params.onRecalculate).not.toHaveBeenCalled()
  })

  it('recalcule immédiatement sans laisser expirer l’ancien timer', async () => {
    const params = createParams()
    const { result } = renderHook(() => useNavigationAutoRecalculation(params))

    await act(async () => {
      await result.current.recalculateNow()
    })
    act(() => vi.advanceTimersByTime(8000))

    expect(params.onRecalculate).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('triggered')
  })

  it('annule le timer pour l’épisode courant', () => {
    const params = createParams()
    const { result, rerender } = renderHook(
      (props: UseNavigationAutoRecalculationParams) => useNavigationAutoRecalculation(props),
      { initialProps: params },
    )

    act(() => result.current.cancelForCurrentEpisode())
    rerender({ ...params })
    act(() => vi.advanceTimersByTime(8000))

    expect(result.current.status).toBe('cancelled')
    expect(params.onRecalculate).not.toHaveBeenCalled()
  })

  it.each([
    ['retour sur le trajet', { deviationState: createNavigationDeviationState() }],
    ['sortie de navigation', { isNavigationActive: false }],
    ['désactivation de l’option', { enabled: false }],
    ['passage en simulation', { navigationMode: 'simulation' as const }],
    ['début d’un recalcul manuel', { recalculationStatus: 'loading' as const }],
  ])('annule l’échéance lors du %s', (_label, changes) => {
    const params = createParams()
    const { result, rerender } = renderHook(
      (props: UseNavigationAutoRecalculationParams) => useNavigationAutoRecalculation(props),
      { initialProps: params },
    )

    rerender({ ...params, ...changes })
    expect(result.current.status).not.toBe('countdown')
    act(() => vi.advanceTimersByTime(8000))
    expect(params.onRecalculate).not.toHaveBeenCalled()
  })

  it('invalide l’ancienne échéance quand le trajet change', () => {
    const params = createParams()
    const { result, rerender } = renderHook(
      (props: UseNavigationAutoRecalculationParams) => useNavigationAutoRecalculation(props),
      { initialProps: params },
    )

    act(() => vi.advanceTimersByTime(2000))
    expect(result.current.remainingSeconds).toBe(6)

    rerender({ ...params, routeSessionKey: 2 })
    expect(result.current.remainingSeconds).toBe(8)

    act(() => vi.advanceTimersByTime(6000))
    expect(params.onRecalculate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(2000))
    expect(params.onRecalculate).toHaveBeenCalledTimes(1)
  })

  it('supprime les timers au démontage', () => {
    const params = createParams()
    const { unmount } = renderHook(() => useNavigationAutoRecalculation(params))

    unmount()
    act(() => vi.advanceTimersByTime(8000))

    expect(params.onRecalculate).not.toHaveBeenCalled()
  })

  it('réévalue le plan à l’expiration sans consommer la tentative si le GPS est devenu invalide', () => {
    let isAvailable = true
    const getRecalculationPlan = vi.fn((): NavigationRecalculationPlan =>
      isAvailable ? availablePlan : { available: false, reason: 'position_stale' },
    )
    const params = createParams({ getRecalculationPlan })
    const { result, rerender } = renderHook(
      (props: UseNavigationAutoRecalculationParams) => useNavigationAutoRecalculation(props),
      { initialProps: params },
    )

    isAvailable = false
    act(() => vi.advanceTimersByTime(8000))
    expect(params.onRecalculate).not.toHaveBeenCalled()
    expect(result.current.status).toBe('idle')

    isAvailable = true
    rerender({ ...params })
    expect(result.current.status).toBe('countdown')
    expect(result.current.remainingSeconds).toBe(8)
    act(() => vi.advanceTimersByTime(8000))
    expect(params.onRecalculate).toHaveBeenCalledTimes(1)
  })

  it('démarre lorsque la position redevient fiable pendant le même épisode', () => {
    let isAvailable = false
    const getRecalculationPlan = vi.fn((): NavigationRecalculationPlan =>
      isAvailable ? availablePlan : { available: false, reason: 'position_inaccurate' },
    )
    const params = createParams({ getRecalculationPlan })
    const { result, rerender } = renderHook(
      (props: UseNavigationAutoRecalculationParams) => useNavigationAutoRecalculation(props),
      { initialProps: params },
    )

    expect(result.current.status).toBe('idle')
    isAvailable = true
    rerender({ ...params })
    expect(result.current.status).toBe('countdown')
  })

  it('ne réessaie pas automatiquement après un échec mais réarme un nouvel épisode', () => {
    const onRecalculate = vi.fn(async () => false)
    const params = createParams({ onRecalculate })
    const { result, rerender } = renderHook(
      (props: UseNavigationAutoRecalculationParams) => useNavigationAutoRecalculation(props),
      { initialProps: params },
    )

    act(() => vi.advanceTimersByTime(8000))
    expect(onRecalculate).toHaveBeenCalledTimes(1)

    rerender({ ...params, recalculationStatus: 'error' })
    act(() => vi.advanceTimersByTime(20_000))
    expect(onRecalculate).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe('triggered')

    rerender({ ...params, deviationState: offRouteState(2000), recalculationStatus: 'idle' })
    expect(result.current.status).toBe('countdown')
    act(() => vi.advanceTimersByTime(8000))
    expect(onRecalculate).toHaveBeenCalledTimes(2)
  })
})

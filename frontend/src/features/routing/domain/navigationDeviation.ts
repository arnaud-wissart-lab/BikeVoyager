import type { NavigationMode } from './types'

export const navigationDeviationThresholds = {
  maximumUsableAccuracyMeters: 50,
  offRouteEntryMeters: 40,
  onRouteReturnMeters: 20,
  requiredOffRouteSamples: 3,
  minimumOffRouteDurationMs: 6000,
  requiredOnRouteSamples: 2,
  maximumSampleAgeMs: 30_000,
} as const

export type NavigationDeviationStatus = 'on_route' | 'suspected' | 'off_route' | 'dismissed'

export type NavigationDeviationState = {
  status: NavigationDeviationStatus
  consecutiveOffRouteSamples: number
  consecutiveOnRouteSamples: number
  firstOffRouteAtMs: number | null
  lastSampleAtMs: number | null
  distanceToRouteMeters: number | null
  accuracyMeters: number | null
}

export type NavigationDeviationSample = {
  isNavigationActive: boolean
  navigationMode: NavigationMode
  distanceToRouteMeters: number
  accuracyMeters: number | null
  observedAtMs: number
  evaluatedAtMs: number
}

export const createNavigationDeviationState = (): NavigationDeviationState => ({
  status: 'on_route',
  consecutiveOffRouteSamples: 0,
  consecutiveOnRouteSamples: 0,
  firstOffRouteAtMs: null,
  lastSampleAtMs: null,
  distanceToRouteMeters: null,
  accuracyMeters: null,
})

export const resetNavigationDeviationState = () => createNavigationDeviationState()

const isUsableSample = (state: NavigationDeviationState, sample: NavigationDeviationSample) => {
  if (
    !Number.isFinite(sample.distanceToRouteMeters) ||
    sample.distanceToRouteMeters < 0 ||
    !Number.isFinite(sample.observedAtMs) ||
    !Number.isFinite(sample.evaluatedAtMs) ||
    sample.observedAtMs <= 0 ||
    sample.observedAtMs > sample.evaluatedAtMs ||
    sample.evaluatedAtMs - sample.observedAtMs > navigationDeviationThresholds.maximumSampleAgeMs ||
    (state.lastSampleAtMs !== null && sample.observedAtMs <= state.lastSampleAtMs)
  ) {
    return false
  }

  return (
    sample.accuracyMeters !== null &&
    Number.isFinite(sample.accuracyMeters) &&
    sample.accuracyMeters > 0 &&
    sample.accuracyMeters <= navigationDeviationThresholds.maximumUsableAccuracyMeters
  )
}

export const updateNavigationDeviationState = (
  state: NavigationDeviationState,
  sample: NavigationDeviationSample,
): NavigationDeviationState => {
  if (!sample.isNavigationActive || sample.navigationMode !== 'gps') {
    return resetNavigationDeviationState()
  }

  if (!isUsableSample(state, sample)) {
    return state
  }

  const confidenceAdjustedDistance = Math.max(
    0,
    sample.distanceToRouteMeters - (sample.accuracyMeters ?? 0),
  )
  const sampledState = {
    ...state,
    lastSampleAtMs: sample.observedAtMs,
    distanceToRouteMeters: sample.distanceToRouteMeters,
    accuracyMeters: sample.accuracyMeters,
  }

  if (confidenceAdjustedDistance > navigationDeviationThresholds.offRouteEntryMeters) {
    if (state.status === 'dismissed') {
      return {
        ...sampledState,
        consecutiveOffRouteSamples: 0,
        consecutiveOnRouteSamples: 0,
        firstOffRouteAtMs: null,
      }
    }

    if (state.status === 'off_route') {
      return {
        ...sampledState,
        consecutiveOffRouteSamples: state.consecutiveOffRouteSamples + 1,
        consecutiveOnRouteSamples: 0,
      }
    }

    const firstOffRouteAtMs = state.firstOffRouteAtMs ?? sample.observedAtMs
    const consecutiveOffRouteSamples = state.consecutiveOffRouteSamples + 1
    const isConfirmed =
      consecutiveOffRouteSamples >= navigationDeviationThresholds.requiredOffRouteSamples &&
      sample.observedAtMs - firstOffRouteAtMs >=
        navigationDeviationThresholds.minimumOffRouteDurationMs

    return {
      ...sampledState,
      status: isConfirmed ? 'off_route' : 'suspected',
      consecutiveOffRouteSamples,
      consecutiveOnRouteSamples: 0,
      firstOffRouteAtMs,
    }
  }

  if (sample.distanceToRouteMeters < navigationDeviationThresholds.onRouteReturnMeters) {
    if (state.status === 'on_route') {
      return {
        ...sampledState,
        consecutiveOffRouteSamples: 0,
        consecutiveOnRouteSamples: 0,
        firstOffRouteAtMs: null,
      }
    }

    const consecutiveOnRouteSamples = state.consecutiveOnRouteSamples + 1
    if (consecutiveOnRouteSamples >= navigationDeviationThresholds.requiredOnRouteSamples) {
      return {
        ...createNavigationDeviationState(),
        lastSampleAtMs: sample.observedAtMs,
        distanceToRouteMeters: sample.distanceToRouteMeters,
        accuracyMeters: sample.accuracyMeters,
      }
    }

    return {
      ...sampledState,
      consecutiveOffRouteSamples: 0,
      consecutiveOnRouteSamples,
      firstOffRouteAtMs: state.status === 'off_route' ? state.firstOffRouteAtMs : null,
    }
  }

  return {
    ...sampledState,
    consecutiveOffRouteSamples: 0,
    consecutiveOnRouteSamples: 0,
    firstOffRouteAtMs: state.status === 'off_route' ? state.firstOffRouteAtMs : null,
  }
}

export const dismissNavigationDeviation = (
  state: NavigationDeviationState,
): NavigationDeviationState => {
  if (state.status !== 'off_route') {
    return state
  }

  return {
    ...state,
    status: 'dismissed',
    consecutiveOffRouteSamples: 0,
    consecutiveOnRouteSamples: 0,
    firstOffRouteAtMs: null,
  }
}

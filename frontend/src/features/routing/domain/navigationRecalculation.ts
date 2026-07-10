import { haversineDistanceMeters } from './math'
import { navigationDeviationThresholds } from './navigationDeviation'
import type {
  ApiRouteMode,
  AssistLevel,
  NavigationMode,
  NavigationProgress,
  RouteOptions,
  RouteRequestPayload,
  TripResult,
} from './types'

export const navigationRecalculationDestinationToleranceMeters = 250

export type NavigationRecalculationStatus = 'idle' | 'loading' | 'success' | 'error'

export type NavigationRecalculationUnavailableReason =
  | 'inactive'
  | 'simulation'
  | 'no_route'
  | 'loop'
  | 'waypoints'
  | 'position_unavailable'
  | 'position_inaccurate'
  | 'position_stale'
  | 'destination_unavailable'

export type NavigationRouteFallbackSettings = {
  mode: ApiRouteMode
  options: RouteOptions
  speedKmh: number
  ebikeAssist?: AssistLevel
}

export type NavigationRecalculationPlanParams = {
  isNavigationActive: boolean
  navigationMode: NavigationMode
  navigationProgress: NavigationProgress | null
  routeResult: TripResult | null
  detourPointCount: number
  lastRoutePayload: RouteRequestPayload | null
  mapEndCoordinate: [number, number] | null
  endLabel: string
  currentPositionLabel: string
  destinationFallbackLabel: string
  fallbackSettings: NavigationRouteFallbackSettings
  evaluatedAtMs: number
}

export type NavigationRecalculationPlan =
  | {
      available: true
      payload: RouteRequestPayload
    }
  | {
      available: false
      reason: NavigationRecalculationUnavailableReason
    }

const isValidCoordinate = (coordinate: [number, number] | null): coordinate is [number, number] =>
  coordinate !== null &&
  Number.isFinite(coordinate[0]) &&
  Number.isFinite(coordinate[1]) &&
  coordinate[0] >= -180 &&
  coordinate[0] <= 180 &&
  coordinate[1] >= -90 &&
  coordinate[1] <= 90

const resolveCoherentLastRoutePayload = (
  lastRoutePayload: RouteRequestPayload | null,
  routeResult: TripResult,
) => {
  const finalCoordinate = routeResult.geometry.coordinates.at(-1) ?? null
  if (
    !lastRoutePayload ||
    !isValidCoordinate(finalCoordinate) ||
    !isValidCoordinate([lastRoutePayload.to.lon, lastRoutePayload.to.lat])
  ) {
    return null
  }

  return haversineDistanceMeters(finalCoordinate, [
    lastRoutePayload.to.lon,
    lastRoutePayload.to.lat,
  ]) <= navigationRecalculationDestinationToleranceMeters
    ? lastRoutePayload
    : null
}

export const createNavigationRecalculationPlan = ({
  isNavigationActive,
  navigationMode,
  navigationProgress,
  routeResult,
  detourPointCount,
  lastRoutePayload,
  mapEndCoordinate,
  endLabel,
  currentPositionLabel,
  destinationFallbackLabel,
  fallbackSettings,
  evaluatedAtMs,
}: NavigationRecalculationPlanParams): NavigationRecalculationPlan => {
  if (!isNavigationActive) {
    return { available: false, reason: 'inactive' }
  }

  if (navigationMode !== 'gps') {
    return { available: false, reason: 'simulation' }
  }

  if (!routeResult) {
    return { available: false, reason: 'no_route' }
  }

  if (routeResult.kind === 'loop') {
    return { available: false, reason: 'loop' }
  }

  const coherentLastRoutePayload = resolveCoherentLastRoutePayload(lastRoutePayload, routeResult)
  if (
    detourPointCount > 0 ||
    (coherentLastRoutePayload?.waypoints && coherentLastRoutePayload.waypoints.length > 0)
  ) {
    return { available: false, reason: 'waypoints' }
  }

  const observedCoordinate: [number, number] | null =
    navigationProgress?.observed_lon !== undefined && navigationProgress.observed_lat !== undefined
      ? [navigationProgress.observed_lon, navigationProgress.observed_lat]
      : null
  if (!isValidCoordinate(observedCoordinate)) {
    return { available: false, reason: 'position_unavailable' }
  }

  const accuracyMeters = navigationProgress?.accuracy_m
  if (
    accuracyMeters === undefined ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters <= 0 ||
    accuracyMeters > navigationDeviationThresholds.maximumUsableAccuracyMeters
  ) {
    return { available: false, reason: 'position_inaccurate' }
  }

  const observedAtMs = navigationProgress?.observed_at_ms
  if (
    observedAtMs === undefined ||
    !Number.isFinite(observedAtMs) ||
    !Number.isFinite(evaluatedAtMs) ||
    observedAtMs <= 0 ||
    observedAtMs > evaluatedAtMs ||
    evaluatedAtMs - observedAtMs > navigationDeviationThresholds.maximumSampleAgeMs
  ) {
    return { available: false, reason: 'position_stale' }
  }

  const finalCoordinate = routeResult.geometry.coordinates.at(-1) ?? null
  const fallbackDestinationCoordinate = isValidCoordinate(mapEndCoordinate)
    ? mapEndCoordinate
    : isValidCoordinate(finalCoordinate)
      ? finalCoordinate
      : null
  const destination =
    coherentLastRoutePayload?.to ??
    (fallbackDestinationCoordinate
      ? {
          lon: fallbackDestinationCoordinate[0],
          lat: fallbackDestinationCoordinate[1],
          label: endLabel.trim() || destinationFallbackLabel,
        }
      : null)
  if (!destination) {
    return { available: false, reason: 'destination_unavailable' }
  }

  const settings = fallbackSettings
  return {
    available: true,
    payload: {
      from: {
        lon: observedCoordinate[0],
        lat: observedCoordinate[1],
        label: currentPositionLabel,
      },
      to: destination,
      mode: settings.mode,
      options: { ...settings.options },
      speedKmh: settings.speedKmh,
      ...(settings.ebikeAssist
        ? {
            ebikeAssist: settings.ebikeAssist,
          }
        : {}),
    },
  }
}

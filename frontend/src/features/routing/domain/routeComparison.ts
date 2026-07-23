import {
  computeElevationStats,
  computeRouteDifficulty,
  type ElevationMinMax,
  type RouteDifficulty,
} from './elevation'
import { areRouteGeometriesEquivalent } from './map'
import type { AssistLevel, Mode, TripResult } from './types'

export type RouteComparisonMetrics = {
  distanceMeters: number | null
  durationSeconds: number | null
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  elevationMinMax: ElevationMinMax | null
  maxSlopePercent: number | null
  difficulty: RouteDifficulty | null
  hasElevationProfile: boolean
}

export type RouteComparisonDelta = {
  distanceMeters: number | null
  durationSeconds: number | null
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  difficultyChanged: boolean
}

export type RouteAlternativeCandidate = {
  route: TripResult
  routeAlternativeIndex: number | null
  loopAlternativeIndex: number | null
}

export type RouteComparisonSummary = {
  current: RouteComparisonMetrics
  alternative: RouteComparisonMetrics
  delta: RouteComparisonDelta
}

const resolveDurationSeconds = (route: TripResult | null | undefined) => {
  if (!route) {
    return null
  }

  if (typeof route.eta_s === 'number' && Number.isFinite(route.eta_s) && route.eta_s > 0) {
    return route.eta_s
  }

  if (
    route.kind === 'route' &&
    typeof route.duration_s_engine === 'number' &&
    Number.isFinite(route.duration_s_engine) &&
    route.duration_s_engine > 0
  ) {
    return route.duration_s_engine
  }

  return null
}

const resolveFinitePositiveOrZero = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null

export const createRouteComparisonMetrics = (
  route: TripResult | null | undefined,
  mode: Mode | null | undefined,
  ebikeAssist: AssistLevel | null | undefined,
): RouteComparisonMetrics => {
  const elevationStats = computeElevationStats(route?.elevation_profile ?? null)
  const distanceMeters = resolveFinitePositiveOrZero(route?.distance_m)
  const difficulty = computeRouteDifficulty(
    distanceMeters,
    elevationStats.elevationGainMeters,
    elevationStats.maxSlopePercent,
    mode,
    ebikeAssist,
  )

  return {
    distanceMeters,
    durationSeconds: resolveDurationSeconds(route),
    elevationGainMeters: elevationStats.elevationGainMeters,
    elevationLossMeters: elevationStats.elevationLossMeters,
    elevationMinMax: elevationStats.elevationMinMax,
    maxSlopePercent: elevationStats.maxSlopePercent,
    difficulty,
    hasElevationProfile: elevationStats.isAvailable,
  }
}

const resolveDisplayedDistanceKey = (distanceMeters: number | null) => {
  if (distanceMeters === null || !Number.isFinite(distanceMeters)) {
    return null
  }

  return Math.abs(distanceMeters) < 1000
    ? `m:${Math.round(distanceMeters)}`
    : `km:${(distanceMeters / 1000).toFixed(1)}`
}

const resolveDisplayedDurationKey = (durationSeconds: number | null) =>
  durationSeconds !== null && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? Math.round(durationSeconds / 60)
    : null

const resolveRoundedKey = (value: number | null) =>
  value !== null && Number.isFinite(value) ? Math.round(value) : null

const resolveSlopeKey = (value: number | null) =>
  value !== null && Number.isFinite(value) ? Number(value.toFixed(1)) : null

const resolveElevationRangeKey = (value: ElevationMinMax | null) =>
  value ? `${Math.round(value.min)}:${Math.round(value.max)}` : null

const haveEquivalentDisplayedMetrics = (
  current: RouteComparisonMetrics,
  candidate: RouteComparisonMetrics,
) =>
  resolveDisplayedDistanceKey(current.distanceMeters) ===
    resolveDisplayedDistanceKey(candidate.distanceMeters) &&
  resolveDisplayedDurationKey(current.durationSeconds) ===
    resolveDisplayedDurationKey(candidate.durationSeconds) &&
  resolveRoundedKey(current.elevationGainMeters) ===
    resolveRoundedKey(candidate.elevationGainMeters) &&
  resolveRoundedKey(current.elevationLossMeters) ===
    resolveRoundedKey(candidate.elevationLossMeters) &&
  resolveElevationRangeKey(current.elevationMinMax) ===
    resolveElevationRangeKey(candidate.elevationMinMax) &&
  resolveSlopeKey(current.maxSlopePercent) === resolveSlopeKey(candidate.maxSlopePercent) &&
  current.difficulty === candidate.difficulty

export const areRoutesEquivalentForComparison = (
  currentRoute: TripResult,
  candidateRoute: TripResult,
  mode: Mode | null | undefined,
  ebikeAssist: AssistLevel | null | undefined,
) => {
  if (areRouteGeometriesEquivalent(currentRoute.geometry, candidateRoute.geometry)) {
    return true
  }

  return haveEquivalentDisplayedMetrics(
    createRouteComparisonMetrics(currentRoute, mode, ebikeAssist),
    createRouteComparisonMetrics(candidateRoute, mode, ebikeAssist),
  )
}

const computeNullableDelta = (current: number | null, alternative: number | null) =>
  current !== null && alternative !== null ? alternative - current : null

export const createRouteComparisonSummary = (
  currentRoute: TripResult | null | undefined,
  alternativeRoute: TripResult | null | undefined,
  mode: Mode | null | undefined,
  ebikeAssist: AssistLevel | null | undefined,
): RouteComparisonSummary | null => {
  if (!currentRoute || !alternativeRoute) {
    return null
  }

  const current = createRouteComparisonMetrics(currentRoute, mode, ebikeAssist)
  const alternative = createRouteComparisonMetrics(alternativeRoute, mode, ebikeAssist)

  return {
    current,
    alternative,
    delta: {
      distanceMeters: computeNullableDelta(current.distanceMeters, alternative.distanceMeters),
      durationSeconds: computeNullableDelta(current.durationSeconds, alternative.durationSeconds),
      elevationGainMeters: computeNullableDelta(
        current.elevationGainMeters,
        alternative.elevationGainMeters,
      ),
      elevationLossMeters: computeNullableDelta(
        current.elevationLossMeters,
        alternative.elevationLossMeters,
      ),
      difficultyChanged:
        current.difficulty !== null &&
        alternative.difficulty !== null &&
        current.difficulty !== alternative.difficulty,
    },
  }
}

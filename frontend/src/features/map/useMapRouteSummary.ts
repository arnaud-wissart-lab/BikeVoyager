import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import type { PlaceCandidate } from '../../components/PlaceSearchInput'
import type {
  Mode,
  NavigationProgress,
  ProfileSettings,
  RouteKey,
  TripResult,
  TripType,
} from '../routing/domain'
import {
  buildCumulativeDistances,
  computeRouteBounds,
  defaultProfileSettings,
  expandBounds,
  kmhToMps,
} from '../routing/domain'

type UseMapRouteSummaryParams = {
  route: RouteKey
  routeResult: TripResult | null
  mode: Mode | null
  loopStartPlace: PlaceCandidate | null
  onewayStartPlace: PlaceCandidate | null
  loopStartValue: string
  onewayStartValue: string
  endPlace: PlaceCandidate | null
  endValue: string
  profileSettings: ProfileSettings
  navigationProgress: NavigationProgress | null
  isNavigationActive: boolean
  t: TFunction
  isFrench: boolean
}

export const useMapRouteSummary = ({
  route,
  routeResult,
  mode,
  loopStartPlace,
  onewayStartPlace,
  loopStartValue,
  onewayStartValue,
  endPlace,
  endValue,
  profileSettings,
  navigationProgress,
  isNavigationActive,
  t,
  isFrench,
}: UseMapRouteSummaryParams) => {
  const hasRoute = Boolean(routeResult)

  const routeCoordinates = useMemo(
    () => routeResult?.geometry.coordinates ?? [],
    [routeResult?.geometry],
  )
  const routeCumulativeDistances = useMemo(
    () => buildCumulativeDistances(routeCoordinates),
    [routeCoordinates],
  )
  const routeDistanceFromGeometry =
    routeCumulativeDistances.length > 0
      ? routeCumulativeDistances[routeCumulativeDistances.length - 1]
      : 0
  const routeDistanceMeters =
    routeResult?.distance_m ??
    (routeDistanceFromGeometry > 0 ? routeDistanceFromGeometry : null)
  const simulationSpeedKmh =
    mode !== null ? profileSettings.speeds[mode] : defaultProfileSettings.speeds.bike
  const fallbackNavigationSpeedMps = kmhToMps(simulationSpeedKmh)
  const liveNavigationSpeedMps =
    navigationProgress?.speed_mps && navigationProgress.speed_mps > 0.4
      ? navigationProgress.speed_mps
      : fallbackNavigationSpeedMps
  const navigationRemainingMeters =
    isNavigationActive && navigationProgress
      ? Math.max(
          0,
          (routeDistanceFromGeometry > 0 ? routeDistanceFromGeometry : routeDistanceMeters ?? 0) -
            navigationProgress.distance_m,
        )
      : routeDistanceMeters
  const navigationEtaSeconds =
    navigationRemainingMeters !== null && liveNavigationSpeedMps > 0
      ? navigationRemainingMeters / liveNavigationSpeedMps
      : null

  const formatDistance = (distanceMeters: number | null) => {
    if (!distanceMeters || !Number.isFinite(distanceMeters)) {
      return t('placeholderValue')
    }

    if (distanceMeters < 1000) {
      return `${Math.round(distanceMeters)} ${t('unitM')}`
    }

    return `${(distanceMeters / 1000).toFixed(1)} ${t('unitKm')}`
  }

  const formatCoordinate = (value: number) => {
    if (!Number.isFinite(value)) {
      return t('placeholderValue')
    }

    return value.toLocaleString(isFrench ? 'fr-FR' : 'en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    })
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds || !Number.isFinite(seconds)) {
      return t('placeholderValue')
    }

    const totalMinutes = Math.round(seconds / 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours <= 0) {
      return `${minutes} ${t('unitMin')}`
    }

    if (minutes === 0) {
      return `${hours} ${t('unitHour')}`
    }

    return `${hours} ${t('unitHour')} ${minutes} ${t('unitMin')}`
  }

  const distanceLabel =
    navigationRemainingMeters !== null
      ? formatDistance(navigationRemainingMeters)
      : t('placeholderValue')
  const etaLabel =
    navigationEtaSeconds !== null
      ? formatDuration(navigationEtaSeconds)
      : t('placeholderValue')
  const navigationProgressPct =
    isNavigationActive && navigationProgress && routeDistanceFromGeometry > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (navigationProgress.distance_m / routeDistanceFromGeometry) * 100,
          ),
        )
      : null

  const routeBounds = routeResult ? computeRouteBounds(routeResult.geometry) : null
  const expandedRouteBounds = routeBounds ? expandBounds(routeBounds) : null
  const mapStartCoordinate = routeCoordinates.length > 0 ? routeCoordinates[0] : null
  const mapEndCoordinate =
    routeCoordinates.length > 0 ? routeCoordinates[routeCoordinates.length - 1] : null
  const mapTripType: TripType | null = routeResult
    ? routeResult.kind === 'loop'
      ? 'loop'
      : 'oneway'
    : null
  const mapStartPlace = mapTripType === 'loop' ? loopStartPlace : onewayStartPlace
  const mapStartValue = mapTripType === 'loop' ? loopStartValue : onewayStartValue
  const startLabel = mapStartPlace?.label ?? mapStartValue.trim()
  const endLabel = endPlace?.label ?? endValue.trim()

  const mapHeaderTitle = hasRoute
    ? routeResult?.kind === 'loop'
      ? t('mapHeaderLoop', {
          start: startLabel || t('placeholderValue'),
        })
      : t('mapHeaderRoute', {
          start: startLabel || t('placeholderValue'),
          end: endLabel || t('placeholderValue'),
        })
    : ''

  const mobileHeaderTitle = route === 'carte' && hasRoute ? mapHeaderTitle : t('appName')

  return {
    routeCoordinates,
    routeCumulativeDistances,
    routeDistanceFromGeometry,
    routeDistanceMeters,
    simulationSpeedKmh,
    formatDistance,
    formatCoordinate,
    distanceLabel,
    etaLabel,
    navigationProgressPct,
    expandedRouteBounds,
    mapStartCoordinate,
    mapEndCoordinate,
    mapTripType,
    startLabel,
    endLabel,
    mapHeaderTitle,
    mobileHeaderTitle,
  }
}

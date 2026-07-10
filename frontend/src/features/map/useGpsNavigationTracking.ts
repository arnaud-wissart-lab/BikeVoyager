import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import {
  projectCoordinateOnRoute,
  updateNavigationDeviationState,
  type NavigationDeviationState,
  type NavigationMode,
  type NavigationProgress,
} from '../routing/domain'

type UseGpsNavigationTrackingParams = {
  isNavigationActive: boolean
  navigationMode: NavigationMode
  routeCoordinates: [number, number][]
  routeCumulativeDistances: number[]
  simulationDistanceRef: MutableRefObject<number>
  setNavigationProgress: Dispatch<SetStateAction<NavigationProgress | null>>
  setNavigationError: (value: string | null) => void
  setNavigationDeviationState: Dispatch<SetStateAction<NavigationDeviationState>>
  t: TFunction
}

export const useGpsNavigationTracking = ({
  isNavigationActive,
  navigationMode,
  routeCoordinates,
  routeCumulativeDistances,
  simulationDistanceRef,
  setNavigationProgress,
  setNavigationError,
  setNavigationDeviationState,
  t,
}: UseGpsNavigationTrackingParams) => {
  useEffect(() => {
    if (
      !isNavigationActive ||
      navigationMode !== 'gps' ||
      routeCoordinates.length < 2 ||
      routeCumulativeDistances.length < 2
    ) {
      return
    }

    if (!('geolocation' in navigator)) {
      setNavigationError(t('navigationGpsUnsupported'))
      return
    }

    const geolocation = navigator.geolocation
    const watchId = geolocation.watchPosition(
      (position) => {
        const evaluatedAtMs = Date.now()
        const observedAtMs =
          Number.isFinite(position.timestamp) && position.timestamp > 0
            ? position.timestamp
            : evaluatedAtMs
        const accuracyMeters =
          Number.isFinite(position.coords.accuracy) && position.coords.accuracy > 0
            ? position.coords.accuracy
            : null
        const projection = projectCoordinateOnRoute(
          [position.coords.longitude, position.coords.latitude],
          routeCoordinates,
          routeCumulativeDistances,
        )
        if (!projection) {
          return
        }

        simulationDistanceRef.current = projection.distance_m
        setNavigationError(null)
        setNavigationProgress({
          ...projection,
          source: 'gps',
          speed_mps:
            typeof position.coords.speed === 'number' && position.coords.speed > 0
              ? position.coords.speed
              : null,
          observed_lat: position.coords.latitude,
          observed_lon: position.coords.longitude,
          ...(accuracyMeters !== null
            ? {
                accuracy_m: accuracyMeters,
              }
            : {}),
          observed_at_ms: observedAtMs,
        })
        setNavigationDeviationState((current) =>
          updateNavigationDeviationState(current, {
            isNavigationActive,
            navigationMode,
            distanceToRouteMeters: projection.distance_to_route_m,
            accuracyMeters,
            observedAtMs,
            evaluatedAtMs,
          }),
        )
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setNavigationError(t('navigationGpsPermissionDenied'))
          return
        }
        if (error.code === error.TIMEOUT) {
          setNavigationError(t('navigationGpsTimeout'))
          return
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          setNavigationError(t('navigationGpsUnavailable'))
          return
        }

        setNavigationError(t('navigationGpsFailed'))
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000,
      },
    )

    return () => {
      geolocation.clearWatch(watchId)
    }
  }, [
    isNavigationActive,
    navigationMode,
    routeCoordinates,
    routeCumulativeDistances,
    setNavigationError,
    setNavigationDeviationState,
    setNavigationProgress,
    simulationDistanceRef,
    t,
  ])
}

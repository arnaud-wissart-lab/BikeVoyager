import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react'
import type { TFunction } from 'i18next'
import {
  haversineDistanceMeters,
  kmhToMps,
  projectCoordinateOnRoute,
  sampleRouteAtDistance,
  simulationTickMs,
  type NavigationMode,
  type NavigationProgress,
  type PoiCategory,
  type PoiItem,
  type RouteKey,
} from '../routing/domain'

type UseMapNavigationEffectsParams = {
  route: RouteKey
  hasRoute: boolean
  isDesktop: boolean
  isNavigationActive: boolean
  isPoiModalOpen: boolean
  selectedPoiId: string | null
  visiblePoiItems: PoiItem[]
  routeCoordinates: [number, number][]
  routeCumulativeDistances: number[]
  routeDistanceFromGeometry: number
  simulationSpeedKmh: number
  navigationMode: NavigationMode
  navigationProgress: NavigationProgress | null
  poiAlertEnabled: boolean
  poiAlertCategories: PoiCategory[]
  poiItems: PoiItem[]
  poiAlertDistanceMeters: number
  systemNotificationsEnabled: boolean
  alertSeenPoiIdsRef: MutableRefObject<Set<string>>
  simulationDistanceRef: MutableRefObject<number>
  setIsNavigationActive: (value: boolean) => void
  setIsNavigationSetupOpen: (value: boolean) => void
  setIsMobileMapPanelExpanded: (value: boolean) => void
  setIsPoiModalOpen: (value: boolean) => void
  setIsMobilePoiDetailsExpanded: (value: boolean) => void
  setNavigationProgress: Dispatch<SetStateAction<NavigationProgress | null>>
  setNavigationError: (value: string | null) => void
  setActivePoiAlertId: (value: string | null) => void
  t: TFunction
}

export const useMapNavigationEffects = ({
  route,
  hasRoute,
  isDesktop,
  isNavigationActive,
  isPoiModalOpen,
  selectedPoiId,
  visiblePoiItems,
  routeCoordinates,
  routeCumulativeDistances,
  routeDistanceFromGeometry,
  simulationSpeedKmh,
  navigationMode,
  navigationProgress,
  poiAlertEnabled,
  poiAlertCategories,
  poiItems,
  poiAlertDistanceMeters,
  systemNotificationsEnabled,
  alertSeenPoiIdsRef,
  simulationDistanceRef,
  setIsNavigationActive,
  setIsNavigationSetupOpen,
  setIsMobileMapPanelExpanded,
  setIsPoiModalOpen,
  setIsMobilePoiDetailsExpanded,
  setNavigationProgress,
  setNavigationError,
  setActivePoiAlertId,
  t,
}: UseMapNavigationEffectsParams) => {
  useEffect(() => {
    if (route !== 'carte' || !hasRoute) {
      setIsNavigationActive(false)
      setIsNavigationSetupOpen(false)
    }
  }, [hasRoute, route, setIsNavigationActive, setIsNavigationSetupOpen])

  useEffect(() => {
    if (isDesktop || route !== 'carte' || !hasRoute || isNavigationActive) {
      setIsMobileMapPanelExpanded(false)
      return
    }

    if (!isPoiModalOpen) {
      setIsMobileMapPanelExpanded(true)
    }
  }, [
    hasRoute,
    isDesktop,
    isNavigationActive,
    isPoiModalOpen,
    route,
    setIsMobileMapPanelExpanded,
  ])

  useEffect(() => {
    if (!selectedPoiId) {
      setIsPoiModalOpen(false)
      setIsMobilePoiDetailsExpanded(true)
      return
    }

    if (visiblePoiItems.some((poi) => poi.id === selectedPoiId)) {
      return
    }

    setIsPoiModalOpen(false)
    setIsMobilePoiDetailsExpanded(true)
  }, [
    selectedPoiId,
    setIsMobilePoiDetailsExpanded,
    setIsPoiModalOpen,
    visiblePoiItems,
  ])

  useEffect(() => {
    if (isNavigationActive) {
      return
    }

    simulationDistanceRef.current = 0
    alertSeenPoiIdsRef.current.clear()
    setNavigationProgress(null)
    setNavigationError(null)
    setActivePoiAlertId(null)
  }, [
    alertSeenPoiIdsRef,
    isNavigationActive,
    setActivePoiAlertId,
    setNavigationError,
    setNavigationProgress,
    simulationDistanceRef,
  ])

  useEffect(() => {
    if (!isNavigationActive) {
      return
    }

    if (routeCoordinates.length < 2 || routeCumulativeDistances.length < 2) {
      setNavigationError(t('navigationNoRouteData'))
      return
    }

    alertSeenPoiIdsRef.current.clear()
    setActivePoiAlertId(null)
    setNavigationError(null)

    const initialPoint = sampleRouteAtDistance(
      routeCoordinates,
      routeCumulativeDistances,
      0,
    )
    if (!initialPoint) {
      return
    }

    simulationDistanceRef.current = 0
    setNavigationProgress({
      ...initialPoint,
      source: navigationMode,
      speed_mps: navigationMode === 'simulation' ? kmhToMps(simulationSpeedKmh) : null,
    })
  }, [
    alertSeenPoiIdsRef,
    isNavigationActive,
    navigationMode,
    routeCoordinates,
    routeCumulativeDistances,
    setActivePoiAlertId,
    setNavigationError,
    setNavigationProgress,
    simulationDistanceRef,
    simulationSpeedKmh,
    t,
  ])

  useEffect(() => {
    if (
      !isNavigationActive ||
      navigationMode !== 'simulation' ||
      routeCoordinates.length < 2 ||
      routeCumulativeDistances.length < 2 ||
      routeDistanceFromGeometry <= 0
    ) {
      return
    }

    const speedMps = kmhToMps(simulationSpeedKmh)
    let lastTick = performance.now()

    const intervalId = window.setInterval(() => {
      const now = performance.now()
      const deltaSeconds = Math.max(0, (now - lastTick) / 1000)
      lastTick = now

      setNavigationProgress((current) => {
        const currentDistance = current?.distance_m ?? simulationDistanceRef.current
        const nextDistance = Math.min(
          routeDistanceFromGeometry,
          currentDistance + speedMps * deltaSeconds,
        )
        simulationDistanceRef.current = nextDistance

        const sampledPoint = sampleRouteAtDistance(
          routeCoordinates,
          routeCumulativeDistances,
          nextDistance,
        )
        if (!sampledPoint) {
          return current
        }

        return {
          ...sampledPoint,
          source: 'simulation',
          speed_mps: speedMps,
        }
      })
    }, simulationTickMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    isNavigationActive,
    navigationMode,
    routeCoordinates,
    routeCumulativeDistances,
    routeDistanceFromGeometry,
    setNavigationProgress,
    simulationDistanceRef,
    simulationSpeedKmh,
  ])

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

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
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
        })
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
      navigator.geolocation.clearWatch(watchId)
    }
  }, [
    isNavigationActive,
    navigationMode,
    routeCoordinates,
    routeCumulativeDistances,
    setNavigationError,
    setNavigationProgress,
    simulationDistanceRef,
    t,
  ])

  useEffect(() => {
    if (
      !isNavigationActive ||
      !poiAlertEnabled ||
      !navigationProgress ||
      poiAlertCategories.length === 0 ||
      poiItems.length === 0
    ) {
      return
    }

    let closestPoi: (typeof poiItems)[number] | null = null
    let closestDistance = Number.POSITIVE_INFINITY
    const currentCoordinate: [number, number] = [
      navigationProgress.lon,
      navigationProgress.lat,
    ]

    for (const poi of poiItems) {
      if (!poiAlertCategories.includes(poi.category)) {
        continue
      }
      if (alertSeenPoiIdsRef.current.has(poi.id)) {
        continue
      }

      const poiDistance = haversineDistanceMeters(currentCoordinate, [poi.lon, poi.lat])
      if (poiDistance > poiAlertDistanceMeters || poiDistance >= closestDistance) {
        continue
      }

      closestPoi = poi
      closestDistance = poiDistance
    }

    if (!closestPoi) {
      return
    }

    alertSeenPoiIdsRef.current.add(closestPoi.id)
    setActivePoiAlertId(closestPoi.id)

    if (
      systemNotificationsEnabled &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      const title = t('poiAlertNotificationTitle')
      const body = t('poiAlertNotificationBody', {
        name: closestPoi.name,
        distance: Math.round(closestDistance),
      })
      new Notification(title, { body })
    }
  }, [
    alertSeenPoiIdsRef,
    isNavigationActive,
    navigationProgress,
    poiAlertCategories,
    poiAlertDistanceMeters,
    poiAlertEnabled,
    poiItems,
    setActivePoiAlertId,
    systemNotificationsEnabled,
    t,
  ])
}

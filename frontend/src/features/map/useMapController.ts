import { useCallback, useEffect, useMemo } from 'react'
import type { TFunction } from 'i18next'
import { useMapFeatureSlice } from './useMapFeatureSlice'
import { usePoisFeatureSlice } from '../pois/usePoisFeatureSlice'
import type { AppStore } from '../../state/appStore'
import type { MapViewMode, PoiCategory, RouteKey, TripType } from '../routing/domain'
import {
  buildCumulativeDistances,
  computeRouteBounds,
  defaultProfileSettings,
  expandBounds,
  haversineDistanceMeters,
  kmhToMps,
  isNavigationCameraMode,
  isNavigationMode,
  osmTagLabels,
  osmValueLabels,
  poiPreferredTagOrder,
  projectCoordinateOnRoute,
  sampleRouteAtDistance,
  simulationTickMs,
} from '../routing/domain'

type UseMapControllerParams = {
  store: AppStore
  route: RouteKey
  isDesktop: boolean
  t: TFunction
  isFrench: boolean
  initialMapViewMode: MapViewMode
}

export const useMapController = ({
  store,
  route,
  isDesktop,
  t,
  isFrench,
  initialMapViewMode,
}: UseMapControllerParams) => {
  const {
    routeResult,
    mode,
    loopStartPlace,
    onewayStartPlace,
    loopStartValue,
    onewayStartValue,
    endPlace,
    endValue,
    profileSettings,
    detourPoints,
    poiCategories,
    poiItems,
    activePoiAlertId,
    isRouteLoading,
    navigationMode,
    navigationProgress,
    isNavigationActive,
    poiAlertEnabled,
    poiAlertCategories,
    poiAlertDistanceMeters,
    systemNotificationsEnabled,
    setIsNavigationActive,
    setIsNavigationSetupOpen,
    isNavigationSetupOpen,
    setNavigationMode,
    setNavigationCameraMode,
    setSystemNotificationsEnabled,
    setNavigationProgress,
    setNavigationError,
    navigationError,
    setActivePoiAlertId,
    alertSeenPoiIdsRef,
    simulationDistanceRef,
    setRouteErrorKey,
    setRouteErrorMessage,
  } = store

  const { hasPoiCategories, visiblePoiItems } = usePoisFeatureSlice({
    poiCategories,
    poiItems,
  })

  const {
    mapViewMode,
    setMapViewMode,
    mapCommand,
    mapCommandSeq,
    triggerMapCommand,
    isSummaryPanelExpanded,
    toggleSummaryPanel: handleToggleSummaryPanel,
    isPoiPanelExpanded,
    togglePoiPanel: handleTogglePoiPanel,
    isMobileMapPanelExpanded,
    setIsMobileMapPanelExpanded,
    toggleMobileMapPanel: handleToggleMobileMapPanel,
    selectedPoiId,
    setSelectedPoiId,
    isPoiModalOpen,
    setIsPoiModalOpen,
    isMobilePoiDetailsExpanded,
    setIsMobilePoiDetailsExpanded,
    toggleMobilePoiDetails: handleToggleMobilePoiDetails,
    selectedPoi,
    activePoiAlert,
    handlePoiSelect,
  } = useMapFeatureSlice({
    initialMapViewMode,
    isDesktop,
    visiblePoiItems,
    poiItems,
    activePoiAlertId,
  })

  const hasRoute = Boolean(routeResult)
  const isMapRoute = route === 'carte'
  const poiEnabled = hasRoute

  const resetPoiSelectionUi = useCallback(() => {
    setSelectedPoiId(null)
    setIsPoiModalOpen(false)
    setIsMobilePoiDetailsExpanded(true)
  }, [setIsMobilePoiDetailsExpanded, setIsPoiModalOpen, setSelectedPoiId])

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

  const mobileHeaderTitle = isMapRoute && hasRoute ? mapHeaderTitle : t('appName')
  const poiDetourIds = useMemo(() => {
    const ids = new Set<string>()
    for (const point of detourPoints) {
      if (point.poiId) {
        ids.add(point.poiId)
      }
    }
    return ids
  }, [detourPoints])
  const detourSummary = useMemo(() => {
    if (detourPoints.length === 0) {
      return null
    }

    const head = detourPoints.slice(0, 2).map((point) => point.label)
    const suffix = detourPoints.length > 2 ? ` +${detourPoints.length - 2}` : ''
    return `${head.join(' • ')}${suffix}`
  }, [detourPoints])

  const toTitleCase = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return trimmed
    }

    return trimmed[0].toLocaleUpperCase(isFrench ? 'fr-FR' : 'en-US') + trimmed.slice(1)
  }
  const formatRawOsmToken = (value: string) => value.trim().replaceAll('_', ' ')
  const normalizeOsmToken = (value: string) => value.trim().toLowerCase()

  const formatPoiTagLabel = (tagKey: string) => {
    const normalized = normalizeOsmToken(tagKey)
    const mapped = osmTagLabels[normalized]
    if (mapped) {
      return isFrench ? mapped.fr : mapped.en
    }

    return toTitleCase(tagKey.replaceAll(':', ' • ').replaceAll('_', ' '))
  }

  const formatPoiTagValue = (tagValue: string) => {
    const tokens = tagValue
      .split(';')
      .map((token) => token.trim())
      .filter(Boolean)

    if (tokens.length === 0) {
      return ''
    }

    const localized = tokens.map((token) => {
      const mapped = osmValueLabels[normalizeOsmToken(token)]
      if (mapped) {
        return isFrench ? mapped.fr : mapped.en
      }

      return formatRawOsmToken(token)
    })

    return localized.join(' ; ')
  }

  const formatPoiKind = (kind: string | null | undefined) => {
    if (!kind) {
      return null
    }

    const separatorIndex = kind.indexOf(':')
    if (separatorIndex <= 0) {
      return toTitleCase(formatPoiTagValue(kind))
    }

    const kindKey = kind.slice(0, separatorIndex)
    const kindValue = kind.slice(separatorIndex + 1)
    return `${formatPoiTagLabel(kindKey)} • ${formatPoiTagValue(kindValue)}`
  }

  const getPoiDisplayName = (poi: typeof selectedPoi) => {
    if (!poi) {
      return t('poiDetailsTitle')
    }

    const hasExplicitName = Object.keys(poi.tags ?? {}).some((key) => {
      const normalized = key.toLowerCase()
      return (
        normalized === 'name' ||
        normalized === 'name:fr' ||
        normalized === 'name:en' ||
        normalized === 'brand' ||
        normalized === 'operator' ||
        normalized === 'official_name' ||
        normalized === 'int_name'
      )
    })

    if (hasExplicitName && poi.name.trim()) {
      return poi.name
    }

    const kindLabel = formatPoiKind(poi.kind)
    if (kindLabel && kindLabel.includes(' • ')) {
      const parts = kindLabel.split(' • ')
      return toTitleCase(parts[parts.length - 1])
    }

    if (kindLabel) {
      return toTitleCase(kindLabel)
    }

    return poi.name
  }

  const selectedPoiDisplayName = getPoiDisplayName(selectedPoi)
  const selectedPoiKind = formatPoiKind(selectedPoi?.kind)
  const poiCategoryLabels = useMemo<Record<PoiCategory, string>>(
    () => ({
      monuments: t('poiCategoryMonuments'),
      paysages: t('poiCategoryLandscapes'),
      commerces: t('poiCategoryShops'),
      services: t('poiCategoryServices'),
    }),
    [t],
  )
  const selectedPoiCategoryLabel = selectedPoi
    ? poiCategoryLabels[selectedPoi.category]
    : null
  const selectedPoiTags = useMemo(() => {
    if (!selectedPoi?.tags) {
      return [] as Array<[string, string]>
    }

    return Object.entries(selectedPoi.tags)
      .filter(([key, value]) => Boolean(key?.trim()) && Boolean(value?.trim()))
      .sort(([leftKey], [rightKey]) => {
        const leftIndex = poiPreferredTagOrder.indexOf(leftKey.toLowerCase())
        const rightIndex = poiPreferredTagOrder.indexOf(rightKey.toLowerCase())
        if (leftIndex !== -1 && rightIndex !== -1) {
          return leftIndex - rightIndex
        }
        if (leftIndex !== -1) {
          return -1
        }
        if (rightIndex !== -1) {
          return 1
        }
        return leftKey.localeCompare(rightKey)
      })
  }, [selectedPoi])
  const selectedPoiWebsite =
    selectedPoi?.tags?.website ?? selectedPoi?.tags?.['contact:website'] ?? null

  const notificationsSupported = typeof Notification !== 'undefined'
  const notificationsPermission = notificationsSupported
    ? Notification.permission
    : 'default'

  const handleNavigationModeChange = (value: string) => {
    if (!isNavigationMode(value)) {
      return
    }

    setNavigationMode(value)
    if (value === 'simulation') {
      setMapViewMode('3d')
      setNavigationCameraMode('panoramic_3d')
      return
    }

    setMapViewMode('3d')
    setNavigationCameraMode('follow_3d')
  }

  const handleNavigationCameraModeChange = (value: string) => {
    if (!isNavigationCameraMode(value)) {
      return
    }

    setNavigationCameraMode(value)
    if (value === 'overview_2d') {
      setMapViewMode('2d')
      return
    }

    setMapViewMode('3d')
  }

  const handleSystemNotificationsChange = async (checked: boolean) => {
    if (!checked) {
      setSystemNotificationsEnabled(false)
      return
    }

    if (typeof Notification === 'undefined') {
      setSystemNotificationsEnabled(false)
      return
    }

    if (Notification.permission === 'granted') {
      setSystemNotificationsEnabled(true)
      return
    }

    if (Notification.permission === 'denied') {
      setSystemNotificationsEnabled(false)
      return
    }

    try {
      const permission = await Notification.requestPermission()
      setSystemNotificationsEnabled(permission === 'granted')
    } catch {
      setSystemNotificationsEnabled(false)
    }
  }

  const handleOpenNavigationSetup = () => {
    if (!hasRoute || isRouteLoading) {
      return
    }

    setIsNavigationSetupOpen(true)
    setIsPoiModalOpen(false)
    if (!isDesktop) {
      setIsMobileMapPanelExpanded(false)
    }
  }

  const handleCloseNavigationSetup = () => {
    setIsNavigationSetupOpen(false)
  }

  const handleStartNavigation = () => {
    if (!hasRoute || isRouteLoading) {
      return
    }

    setRouteErrorKey(null)
    setRouteErrorMessage(null)
    setNavigationError(null)
    setActivePoiAlertId(null)
    setIsNavigationSetupOpen(false)
    setIsNavigationActive(true)
    setIsPoiModalOpen(false)
    if (!isDesktop) {
      setIsMobileMapPanelExpanded(false)
    }
    if (navigationMode === 'simulation') {
      setMapViewMode('3d')
      setNavigationCameraMode('panoramic_3d')
    }
  }

  const handleExitNavigation = () => {
    setIsNavigationActive(false)
  }

  const handleDismissPoiAlert = () => {
    setActivePoiAlertId(null)
  }

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

  return {
    hasRoute,
    isMapRoute,
    poiEnabled,
    hasPoiCategories,
    visiblePoiItems,
    mapViewMode,
    setMapViewMode,
    mapCommand,
    mapCommandSeq,
    triggerMapCommand,
    isSummaryPanelExpanded,
    handleToggleSummaryPanel,
    isPoiPanelExpanded,
    handleTogglePoiPanel,
    isMobileMapPanelExpanded,
    setIsMobileMapPanelExpanded,
    handleToggleMobileMapPanel,
    selectedPoiId,
    setSelectedPoiId,
    isPoiModalOpen,
    setIsPoiModalOpen,
    isMobilePoiDetailsExpanded,
    setIsMobilePoiDetailsExpanded,
    handleToggleMobilePoiDetails,
    selectedPoi,
    activePoiAlert,
    handlePoiSelect,
    resetPoiSelectionUi,
    formatDistance,
    formatCoordinate,
    formatPoiTagLabel,
    formatPoiTagValue,
    formatPoiKind,
    getPoiDisplayName,
    routeCoordinates,
    routeCumulativeDistances,
    routeDistanceFromGeometry,
    routeDistanceMeters,
    simulationSpeedKmh,
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
    poiDetourIds,
    detourSummary,
    selectedPoiDisplayName,
    selectedPoiCategoryLabel,
    selectedPoiKind,
    selectedPoiTags,
    selectedPoiWebsite,
    poiCategoryLabels,
    notificationsSupported,
    notificationsPermission,
    handleNavigationModeChange,
    handleNavigationCameraModeChange,
    handleSystemNotificationsChange,
    handleOpenNavigationSetup,
    handleCloseNavigationSetup,
    handleStartNavigation,
    handleExitNavigation,
    handleDismissPoiAlert,
    navigationError,
    isNavigationSetupOpen,
  }
}

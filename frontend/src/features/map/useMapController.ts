import { useCallback, useMemo } from 'react'
import type { TFunction } from 'i18next'
import { useMapFeatureSlice } from './useMapFeatureSlice'
import { usePoisFeatureSlice } from '../pois/usePoisFeatureSlice'
import type { AppStore } from '../../state/appStore'
import type { MapViewMode, RouteKey, TripType } from '../routing/domain'
import {
  buildCumulativeDistances,
  computeRouteBounds,
  defaultProfileSettings,
  expandBounds,
  kmhToMps,
  isNavigationCameraMode,
  isNavigationMode,
} from '../routing/domain'
import { useMapPoiFormatting } from './useMapPoiFormatting'
import { useMapNavigationEffects } from './useMapNavigationEffects'

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

  const {
    formatPoiTagLabel,
    formatPoiTagValue,
    formatPoiKind,
    getPoiDisplayName,
    selectedPoiDisplayName,
    selectedPoiKind,
    poiCategoryLabels,
    selectedPoiCategoryLabel,
    selectedPoiTags,
    selectedPoiWebsite,
  } = useMapPoiFormatting({
    selectedPoi,
    t,
    isFrench,
  })

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

  useMapNavigationEffects({
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
  })

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

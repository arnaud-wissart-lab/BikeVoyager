import { useCallback, useMemo } from 'react'
import type { TFunction } from 'i18next'
import { useMapFeatureSlice } from './useMapFeatureSlice'
import { usePoisFeatureSlice } from '../pois/usePoisFeatureSlice'
import type { AppStore } from '../../state/appStore'
import type { MapViewMode, RouteKey } from '../routing/domain'
import { isNavigationCameraMode, isNavigationMode } from '../routing/domain'
import { useMapPoiFormatting } from './useMapPoiFormatting'
import { useMapNavigationEffects } from './useMapNavigationEffects'
import { useMapRouteSummary } from './useMapRouteSummary'

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

  const {
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
  } = useMapRouteSummary({
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
  })
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

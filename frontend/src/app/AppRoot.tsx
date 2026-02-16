import {
  Badge,
  Loader,
  useComputedColorScheme,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import {
  IconDatabase,
  IconHelpCircle,
  IconMap2,
  IconRoute,
  IconUser,
} from '@tabler/icons-react'
import { useEffect, useMemo, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCloudController } from '../features/cloud/useCloudController'
import { useDataController } from '../features/data/useDataController'
import { loadAppPreferences } from '../features/data/dataPortability'
import { useMapController } from '../features/map/useMapController'
import { usePoisController } from '../features/pois/usePoisController'
import {
  normalizeNumericInput,
  poiAlertDistanceRange,
  poiCorridorRange,
  type RouteElevationPoint,
  type RouteKey,
} from '../features/routing/domain'
import { loadPlannerDraft } from '../features/routing/domain'
import useHashRoute from '../features/routing/useHashRoute'
import { useRoutingController } from '../features/routing/useRoutingController'
import { useAppStore } from '../state/appStore'
import DataPage from '../ui/pages/DataPage'
import HelpPage from '../ui/pages/HelpPage'
import MapPage from '../ui/pages/MapPage'
import PlannerPage from '../ui/pages/PlannerPage'
import ProfilesPage from '../ui/pages/ProfilesPage'
import ShellLayout, { type ShellNavItem } from '../ui/shell/ShellLayout'
import ShellModals from '../ui/shell/ShellModals'

const computeElevationGain = (profile: RouteElevationPoint[] | null | undefined) => {
  if (!profile || profile.length < 2) {
    return null
  }

  let gain = 0
  for (let i = 1; i < profile.length; i += 1) {
    const delta = profile[i].elevation_m - profile[i - 1].elevation_m
    if (Number.isFinite(delta) && delta > 0) {
      gain += delta
    }
  }

  return gain
}

export default function AppRoot() {
  const { t, i18n } = useTranslation()
  const theme = useMantineTheme()
  const { colorScheme, setColorScheme } = useMantineColorScheme()
  const computedColorScheme = useComputedColorScheme('light')
  const isDesktop = useMediaQuery('(min-width: 60em)')

  const initialPlannerDraft = useMemo(() => loadPlannerDraft(), [])
  const initialAppPreferences = useMemo(() => loadAppPreferences(), [])
  const [route, navigate] = useHashRoute('planifier')
  const store = useAppStore({
    initialPlannerDraft,
    initialAppPreferences,
  })

  const language = i18n.language.startsWith('en') ? 'en' : 'fr'
  const isFrench = language === 'fr'
  const themeMode = colorScheme
  const isDarkTheme = computedColorScheme === 'dark'
  const nextThemeMode =
    themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto'
  const mobileThemeModeLabel =
    themeMode === 'auto'
      ? t('themeAuto')
      : themeMode === 'light'
        ? t('themeLight')
        : t('themeDark')
  const mobileThemeActionLabel = `${t('settingsThemeLabel')}: ${mobileThemeModeLabel}`

  const handleNavigate = (next: RouteKey, force = false) => {
    if (store.isNavigationActive) {
      store.setIsNavigationActive(false)
    }
    if (store.isNavigationSetupOpen) {
      store.setIsNavigationSetupOpen(false)
    }
    void force
    navigate(next)
  }

  const mapController = useMapController({
    store,
    route,
    isDesktop,
    t,
    isFrench,
    initialMapViewMode: initialAppPreferences.mapViewMode,
  })
  const routingController = useRoutingController({
    store,
    route,
    t,
    map: {
      mapTripType: mapController.mapTripType,
      mapStartCoordinate: mapController.mapStartCoordinate,
      mapEndCoordinate: mapController.mapEndCoordinate,
      startLabel: mapController.startLabel,
      endLabel: mapController.endLabel,
      mapHeaderTitle: mapController.mapHeaderTitle,
    },
    onNavigate: handleNavigate,
  })

  const footerHeight = isDesktop ? 0 : 72
  const showShellHeader = !store.isNavigationActive || (!isDesktop && route === 'carte')
  const showShellFooter = !store.isNavigationActive
  const showMobileCompactHeader = !isDesktop && showShellHeader
  const showDesktopMapHeader = isDesktop && route === 'carte' && mapController.hasRoute
  const headerHeight = isDesktop ? 72 : 56
  const chromeHeaderHeight = showShellHeader ? headerHeight : 0
  const chromeFooterHeight = showShellFooter ? footerHeight : 0
  const contentSize = isDesktop ? '84rem' : 'xl'
  const surfaceColor = isDarkTheme ? theme.colors.gray[9] : theme.white
  const borderColor = theme.colors.gray[isDarkTheme ? 8 : 3]
  const shellChromeBackground = isDarkTheme
    ? 'rgba(14, 17, 24, 0.84)'
    : 'rgba(255, 255, 255, 0.86)'
  const shellChromeFilter = 'saturate(1.15) blur(12px)'
  const shellMainBackground = isDarkTheme
    ? 'radial-gradient(1200px 520px at -15% -10%, rgba(35,87,153,0.34) 0%, rgba(13,19,30,0) 55%), radial-gradient(900px 420px at 110% -5%, rgba(29,120,89,0.22) 0%, rgba(12,18,28,0) 55%), linear-gradient(180deg, rgba(12,15,21,1) 0%, rgba(10,14,20,1) 100%)'
    : 'radial-gradient(1200px 520px at -15% -10%, rgba(120,186,255,0.3) 0%, rgba(244,248,255,0) 55%), radial-gradient(900px 420px at 110% -5%, rgba(125,217,186,0.26) 0%, rgba(245,250,248,0) 55%), linear-gradient(180deg, rgba(247,250,255,1) 0%, rgba(244,247,252,1) 100%)'
  const viewportHeightUnit = isDesktop ? '100vh' : '100dvh'
  const availableViewportHeight = `calc(${viewportHeightUnit} - ${chromeHeaderHeight + chromeFooterHeight}px)`

  const toastPosition = isDesktop ? 'top-right' : 'top-center'
  const toastTopOffsetPx = showShellHeader ? headerHeight + 10 : 10
  const toastStyle = useMemo(
    () =>
      ({
        marginTop: `${toastTopOffsetPx}px`,
        maxWidth: isDesktop ? 'min(420px, calc(100vw - 40px))' : 'calc(100vw - 24px)',
      }) as const,
    [isDesktop, toastTopOffsetPx],
  )
  const showSuccessToast = (
    message: string,
    options?: { title?: string; durationMs?: number },
  ) => {
    notifications.show({
      color: 'teal',
      position: toastPosition,
      autoClose: options?.durationMs ?? 2600,
      style: toastStyle,
      title: options?.title,
      message,
    })
  }
  const showErrorToast = (
    message: string,
    options?: { title?: string; durationMs?: number },
  ) => {
    notifications.show({
      color: 'red',
      position: toastPosition,
      autoClose: options?.durationMs ?? 5000,
      style: toastStyle,
      title: options?.title,
      message,
    })
  }

  const dataController = useDataController({
    store,
    t,
    language,
    themeMode,
    setThemeMode: setColorScheme,
    mapViewMode: mapController.mapViewMode,
    mapHeaderTitle: mapController.mapHeaderTitle,
    startLabel: mapController.startLabel,
    showSuccessToast,
    showErrorToast,
    requestRoute: routingController.requestRoute,
  })
  const cloudController = useCloudController({
    store,
    route,
    t,
    isDesktop,
    cloudBackupPayloadContent: dataController.cloudBackupPayloadContent,
    parseImportedPayload: dataController.parseImportedPayload,
    applyParsedImportedData: dataController.applyParsedImportedData,
    wouldCloudBackupMergeChangeLocal: dataController.wouldCloudBackupMergeChangeLocal,
    cloudRestoreSuccessMessageByKind: dataController.cloudRestoreSuccessMessageByKind,
    hasLocalBackupData: dataController.hasLocalBackupData,
  })
  const poisController = usePoisController({
    store,
    route,
    language: i18n.language,
    t,
    onResetPoiSelectionUi: mapController.resetPoiSelectionUi,
  })

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const previousRootBackground = root.style.background
    const previousBodyBackground = document.body.style.background
    root.style.background = shellMainBackground
    document.body.style.background = shellMainBackground

    return () => {
      root.style.background = previousRootBackground
      document.body.style.background = previousBodyBackground
    }
  }, [shellMainBackground])

  const navItems: ShellNavItem[] = [
    { key: 'planifier', label: t('navPlanifier'), icon: IconRoute, disabled: false },
    { key: 'carte', label: t('navCarte'), icon: IconMap2, disabled: false },
    { key: 'profils', label: t('navProfils'), icon: IconUser, disabled: false },
    { key: 'donnees', label: t('navDonnees'), icon: IconDatabase, disabled: false },
    { key: 'aide', label: t('navAide'), icon: IconHelpCircle, disabled: false },
  ]

  const handleAddPoiWaypoint = async (poi: (typeof store.poiItems)[number]) => {
    if (!mapController.poiEnabled || !mapController.mapTripType) {
      return
    }

    const result = await routingController.addDetourPointAndRecalculate({
      id: `poi:${poi.id}`,
      source: 'poi',
      poiId: poi.id,
      lat: poi.lat,
      lon: poi.lon,
      label: mapController.getPoiDisplayName(poi),
    })

    if (result.status === 'success' || result.status === 'unchanged') {
      mapController.setSelectedPoiId(poi.id)
      mapController.setIsPoiModalOpen(true)
      mapController.setIsMobilePoiDetailsExpanded(true)
    }
  }

  const handleAddCustomDetourFromAddress = async () => {
    if (!store.customDetourPlace) {
      return
    }

    const result = await routingController.addDetourPointAndRecalculate({
      id: `custom-address:${store.customDetourPlace.lat.toFixed(6)}:${store.customDetourPlace.lon.toFixed(6)}`,
      source: 'custom',
      lat: store.customDetourPlace.lat,
      lon: store.customDetourPlace.lon,
      label: store.customDetourPlace.label,
    })

    if (result.status !== 'success') {
      return
    }

    store.setCustomDetourValue('')
    store.setCustomDetourPlace(null)
    store.setCustomDetourLat('')
    store.setCustomDetourLon('')
  }

  const handleAddAddressBookDetour = async (entryId: string) => {
    const entry = dataController.addressBookById.get(entryId)
    if (!entry) {
      return
    }

    const result = await routingController.addDetourPointAndRecalculate({
      id: `address-book:${entry.id}`,
      source: 'custom',
      lat: entry.lat,
      lon: entry.lon,
      label: entry.name,
    })

    if (result.status !== 'success') {
      return
    }

    const now = new Date().toISOString()
    store.setAddressBook((current) =>
      current.map((item) => (item.id === entryId ? { ...item, updatedAt: now } : item)),
    )
  }

  const handleAddCustomDetourFromCoordinates = async () => {
    if (typeof store.customDetourLat !== 'number' || typeof store.customDetourLon !== 'number') {
      return
    }
    if (
      store.customDetourLat < -90 ||
      store.customDetourLat > 90 ||
      store.customDetourLon < -180 ||
      store.customDetourLon > 180
    ) {
      return
    }

    const label = `${store.customDetourLat.toFixed(5)}, ${store.customDetourLon.toFixed(5)}`
    const result = await routingController.addDetourPointAndRecalculate({
      id: `custom-gps:${store.customDetourLat.toFixed(6)}:${store.customDetourLon.toFixed(6)}`,
      source: 'custom',
      lat: store.customDetourLat,
      lon: store.customDetourLon,
      label,
    })

    if (result.status !== 'success') {
      return
    }

    store.setCustomDetourValue('')
    store.setCustomDetourPlace(null)
    store.setCustomDetourLat('')
    store.setCustomDetourLon('')
  }

  const handleRemoveDetourPoint = async (detourId: string) => {
    const result = await routingController.removeDetourPointAndRecalculate(detourId)
    if (
      result.success &&
      mapController.selectedPoiId &&
      !result.nextDetours.some((point) => point.poiId === mapController.selectedPoiId)
    ) {
      mapController.setSelectedPoiId(null)
    }
  }

  const handleAddActivePoiAlertWaypoint = async () => {
    if (!mapController.activePoiAlert) {
      return
    }

    await handleAddPoiWaypoint(mapController.activePoiAlert)
    store.setActivePoiAlertId(null)
  }

  const handleDeliveryStopDragStart = (
    event: DragEvent<HTMLDivElement>,
    entryId: string,
  ) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', entryId)
    dataController.setDeliveryDraggedStopId(entryId)
  }
  const handleDeliveryStopDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }
  const handleDeliveryStopDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault()
    const sourceId =
      store.deliveryDraggedStopId ?? event.dataTransfer.getData('text/plain')
    if (!sourceId) {
      return
    }

    dataController.reorderDeliveryStops(sourceId, targetId)
    dataController.setDeliveryDraggedStopId(null)
  }
  const handleDeliveryStopDragEnd = () => {
    dataController.setDeliveryDraggedStopId(null)
  }

  const overlapLabel = store.routeResult?.kind === 'loop' ? store.routeResult.overlapScore : null
  const overlapHint =
    overlapLabel === 'faible'
      ? t('mapOverlapLowHelp')
      : overlapLabel === 'moyen'
        ? t('mapOverlapMediumHelp')
        : overlapLabel === 'élevé'
          ? t('mapOverlapHighHelp')
          : null
  const elevationGain = store.routeResult
    ? computeElevationGain(store.routeResult.elevation_profile)
    : null
  const elevationValueLabel =
    elevationGain !== null ? `${Math.round(elevationGain)} ${t('unitM')}` : t('placeholderValue')
  const elevationHint =
    store.routeResult && elevationGain === null ? t('mapElevationUnavailable') : null

  const renderPoiLoadIndicator = (size: 'xs' | 'sm' = 'xs') => {
    if (store.isPoiLoading) {
      return <Loader size={size} />
    }

    if (store.poiError && store.hasPoiFetchCompleted) {
      return (
        <Badge size={size} color="red" variant="light">
          !
        </Badge>
      )
    }

    if (!store.hasPoiFetchCompleted || !mapController.hasPoiCategories) {
      return null
    }

    return (
      <Badge
        size={size}
        variant="light"
        color={mapController.visiblePoiItems.length > 0 ? 'blue' : 'gray'}
      >
        {mapController.visiblePoiItems.length}
      </Badge>
    )
  }

  const mapSummaryPanelProps = {
    distanceLabel: mapController.distanceLabel,
    etaLabel: mapController.etaLabel,
    overlapLabel,
    overlapHint,
    elevationValueLabel,
    elevationHint,
    detourSummary: mapController.detourSummary,
    hasRoute: mapController.hasRoute,
    isRouteLoading: store.isRouteLoading,
    alternativeRouteLabel: routingController.alternativeRouteLabel,
    isExporting: store.isExporting,
    exportError: store.exportError,
    routeErrorMessage: routingController.routeErrorDisplayMessage,
    onRecalculateAlternative: () => {
      void routingController.handleRecalculateAlternative()
    },
    onOpenNavigationSetup: mapController.handleOpenNavigationSetup,
    onExportGpx: () => {
      void routingController.handleExportGpx()
    },
    canSaveCurrentLoop: store.routeResult?.kind === 'loop',
    onSaveCurrentLoop: dataController.handleSaveCurrentLoop,
  }

  const poiPanelProps = {
    poiCategoryOptions: poisController.poiCategoryOptions,
    poiCategories: store.poiCategories,
    onPoiCategoryChange: poisController.handlePoiCategoryChange,
    poiCorridorMeters: store.poiCorridorMeters,
    onPoiCorridorMetersChange: store.setPoiCorridorMeters,
    hasPoiCategories: mapController.hasPoiCategories,
    isPoiLoading: store.isPoiLoading,
    onPoiRefresh: poisController.handlePoiRefresh,
    isCustomDetourPanelOpen: store.isCustomDetourPanelOpen,
    onToggleCustomDetourPanel: () =>
      store.setIsCustomDetourPanelOpen((current) => !current),
    detourPoints: store.detourPoints,
    customDetourValue: store.customDetourValue,
    onCustomDetourValueChange: store.setCustomDetourValue,
    customDetourPlace: store.customDetourPlace,
    onCustomDetourPlaceSelect: store.setCustomDetourPlace,
    onAddCustomDetourFromAddress: handleAddCustomDetourFromAddress,
    customDetourLat: store.customDetourLat,
    customDetourLon: store.customDetourLon,
    onCustomDetourLatChange: (value: string | number) =>
      store.setCustomDetourLat(normalizeNumericInput(value)),
    onCustomDetourLonChange: (value: string | number) =>
      store.setCustomDetourLon(normalizeNumericInput(value)),
    onAddCustomDetourFromCoordinates: handleAddCustomDetourFromCoordinates,
    onRemoveDetourPoint: handleRemoveDetourPoint,
    addressBookEntries: store.addressBook,
    selectedDeliveryStartId: store.deliveryStartAddressId,
    selectedDeliveryStopIds: store.deliveryStopAddressIds,
    onSelectDeliveryStart: dataController.handleSelectDeliveryStart,
    onToggleDeliveryStop: dataController.handleToggleDeliveryStop,
    onAddAddressBookDetour: handleAddAddressBookDetour,
    deliveryPlannerPanelProps: {
      mode: store.deliveryMode,
      returnToStart: store.deliveryReturnToStart,
      optimizeStops: store.deliveryOptimizeStops,
      stops: dataController.deliveryStopAddresses,
      draggedStopId: store.deliveryDraggedStopId,
      isRouteLoading: store.isRouteLoading,
      canBuildRoute: dataController.canBuildDeliveryRoute,
      canClearSelection:
        store.deliveryStartAddressId !== null || store.deliveryStopAddressIds.length > 0,
      summaryLabel: dataController.deliverySummaryLabel,
      orderSummaryLabel: dataController.deliveryOrderSummaryLabel,
      onModeChange: dataController.handleDeliveryModeChange,
      onReturnToStartChange: dataController.setDeliveryReturnToStart,
      onOptimizeStopsChange: dataController.setDeliveryOptimizeStops,
      onStopDragStart: handleDeliveryStopDragStart,
      onStopDragOver: handleDeliveryStopDragOver,
      onStopDrop: handleDeliveryStopDrop,
      onStopDragEnd: handleDeliveryStopDragEnd,
      onMoveStop: dataController.handleMoveDeliveryStop,
      onBuildRoute: () => {
        void dataController.handleBuildDeliveryRoute()
      },
      onClearSelection: dataController.handleClearDeliverySelection,
    },
    isRouteLoading: store.isRouteLoading,
    poiError: store.poiError,
    poiErrorMessage: store.poiErrorMessage,
    poiItems: mapController.visiblePoiItems,
    selectedPoiId: mapController.selectedPoiId,
    poiDetourIds: mapController.poiDetourIds,
    poiCategoryLabels: mapController.poiCategoryLabels,
    onPoiSelect: mapController.handlePoiSelect,
    onAddPoiWaypoint: handleAddPoiWaypoint,
    getPoiDisplayName: mapController.getPoiDisplayName,
    formatPoiKind: mapController.formatPoiKind,
    formatDistance: mapController.formatDistance,
    borderColor,
    selectedBorderColor: theme.colors.blue[5],
    activeBorderColor: theme.colors.orange[5],
    poiCorridorRange,
  }

  const navigationOptionsPanelProps = {
    navigationMode: store.navigationMode,
    navigationCameraMode: store.navigationCameraMode,
    simulationSpeedKmh: mapController.simulationSpeedKmh,
    poiAlertEnabled: store.poiAlertEnabled,
    poiAlertCategories: store.poiAlertCategories,
    poiAlertDistanceMeters: store.poiAlertDistanceMeters,
    systemNotificationsEnabled: store.systemNotificationsEnabled,
    notificationsSupported: mapController.notificationsSupported,
    notificationsPermission: mapController.notificationsPermission,
    poiCategoryOptions: poisController.poiCategoryOptions,
    poiAlertDistanceRange,
    onNavigationModeChange: mapController.handleNavigationModeChange,
    onNavigationCameraModeChange: mapController.handleNavigationCameraModeChange,
    onPoiAlertEnabledChange: store.setPoiAlertEnabled,
    onPoiAlertCategoryChange: poisController.handlePoiAlertCategoryChange,
    onPoiAlertDistanceMetersChange: store.setPoiAlertDistanceMeters,
    onSystemNotificationsChange: mapController.handleSystemNotificationsChange,
  }

  const renderPlanifier = () => (
    <PlannerPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isDarkTheme={isDarkTheme}
      theme={theme}
      mode={store.mode}
      tripType={store.tripType}
      showLocationInputs={routingController.showLocationInputs}
      panelStackStyle={routingController.panelStackStyle}
      getPanelStyle={routingController.getPanelStyle}
      onModeChange={routingController.handleModeChange}
      onTypeChange={routingController.handleTypeChange}
      onewayStartValue={store.onewayStartValue}
      onOnewayStartValueChange={routingController.handleOnewayStartValueChange}
      onOnewayStartPlaceSelect={routingController.handleOnewayStartPlaceSelect}
      canQuickSaveOnewayStart={dataController.canQuickSaveOnewayStart}
      onSaveQuickOnewayStart={() => dataController.handleSaveQuickAddress(store.onewayStartPlace)}
      endValue={store.endValue}
      onEndValueChange={routingController.handleEndValueChange}
      onEndPlaceSelect={routingController.handleEndPlaceSelect}
      canQuickSaveOnewayEnd={dataController.canQuickSaveOnewayEnd}
      onSaveQuickOnewayEnd={() => dataController.handleSaveQuickAddress(store.endPlace)}
      loopStartValue={store.loopStartValue}
      onLoopStartValueChange={routingController.handleLoopStartValueChange}
      onLoopStartPlaceSelect={routingController.handleLoopStartPlaceSelect}
      canQuickSaveLoopStart={dataController.canQuickSaveLoopStart}
      onSaveQuickLoopStart={() => dataController.handleSaveQuickAddress(store.loopStartPlace)}
      targetDistanceKm={store.targetDistanceKm}
      onTargetDistanceChange={routingController.handleTargetDistanceChange}
      helperHasMissing={routingController.helperHasMissing}
      helperItems={routingController.helperItems}
      helperReadyLabel={routingController.helperReadyLabel}
      isFormReady={routingController.isFormReady}
      isRouteLoading={store.isRouteLoading}
      onCalculate={() => {
        void routingController.handleCalculate()
      }}
      ctaLabel={routingController.ctaLabel}
      routeErrorMessage={routingController.routeErrorDisplayMessage}
    />
  )

  const renderCarte = () => (
    <MapPage
      availableViewportHeight={availableViewportHeight}
      mapBackgroundColor={isDarkTheme ? theme.colors.gray[9] : theme.colors.gray[1]}
      loadingOverlayColor={
        isDarkTheme ? 'rgba(18, 20, 24, 0.62)' : 'rgba(255, 255, 255, 0.64)'
      }
      setupOverlayColor={isDarkTheme ? 'rgba(10, 12, 16, 0.62)' : 'rgba(255, 255, 255, 0.62)'}
      loadingSpinnerColor={theme.colors.blue[6]}
      routeResult={store.routeResult}
      expandedRouteBounds={mapController.expandedRouteBounds}
      mapViewMode={mapController.mapViewMode}
      mapCommand={mapController.mapCommand}
      mapCommandSeq={mapController.mapCommandSeq}
      poiEnabled={mapController.poiEnabled}
      visiblePoiItems={mapController.visiblePoiItems}
      selectedPoiId={mapController.selectedPoiId}
      onPoiSelect={mapController.handlePoiSelect}
      isNavigationActive={store.isNavigationActive}
      navigationProgress={store.navigationProgress}
      navigationCameraMode={store.navigationCameraMode}
      hasRoute={mapController.hasRoute}
      mapOverlayPadding={isDesktop ? 20 : 12}
      isDesktop={isDesktop}
      isSummaryPanelExpanded={mapController.isSummaryPanelExpanded}
      onToggleSummaryPanel={mapController.handleToggleSummaryPanel}
      summaryPanelProps={mapSummaryPanelProps}
      isPoiPanelExpanded={mapController.isPoiPanelExpanded}
      onTogglePoiPanel={mapController.handleTogglePoiPanel}
      poiPanelProps={poiPanelProps}
      renderPoiLoadIndicator={renderPoiLoadIndicator}
      surfaceColor={surfaceColor}
      panelTransitionDuration={routingController.panelTransitionDuration}
      panelTransitionTiming={routingController.panelTransitionTiming}
      onResetRouteView={() => mapController.triggerMapCommand('resetRoute')}
      chromeFooterHeight={chromeFooterHeight}
      isMobileMapPanelExpanded={mapController.isMobileMapPanelExpanded}
      onToggleMobileMapPanel={mapController.handleToggleMobileMapPanel}
      mobileMapPanelTransition={[
        'max-height 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        'opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        'filter 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        'padding-top 320ms cubic-bezier(0.22, 1, 0.36, 1)',
      ].join(', ')}
      isPoiModalOpen={mapController.isPoiModalOpen}
      selectedPoi={mapController.selectedPoi}
      selectedPoiDisplayName={mapController.selectedPoiDisplayName}
      selectedPoiCategoryLabel={mapController.selectedPoiCategoryLabel}
      selectedPoiKind={mapController.selectedPoiKind}
      onZoomOutPoi={() => mapController.triggerMapCommand('zoomOutPoi')}
      onZoomInPoi={() => mapController.triggerMapCommand('zoomInPoi')}
      isRouteLoading={store.isRouteLoading}
      isMobilePoiDetailsExpanded={mapController.isMobilePoiDetailsExpanded}
      onToggleMobilePoiDetails={mapController.handleToggleMobilePoiDetails}
      onClosePoiModal={() => mapController.setIsPoiModalOpen(false)}
      poiDetourIds={mapController.poiDetourIds}
      onAddSelectedPoiWaypoint={() => {
        if (!mapController.selectedPoi) {
          return
        }
        void handleAddPoiWaypoint({
          ...mapController.selectedPoi,
          name: mapController.selectedPoiDisplayName,
        })
      }}
      selectedPoiWebsite={mapController.selectedPoiWebsite}
      formatDistance={mapController.formatDistance}
      formatCoordinate={mapController.formatCoordinate}
      selectedPoiTags={mapController.selectedPoiTags}
      formatPoiTagLabel={mapController.formatPoiTagLabel}
      formatPoiTagValue={mapController.formatPoiTagValue}
      mobilePoiPanelTransition={[
        'max-height 340ms cubic-bezier(0.22, 1, 0.36, 1)',
        'opacity 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)',
        'filter 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      ].join(', ')}
      isNavigationSetupOpen={mapController.isNavigationSetupOpen}
      onCloseNavigationSetup={mapController.handleCloseNavigationSetup}
      navigationOptionsPanelProps={navigationOptionsPanelProps}
      onStartNavigation={mapController.handleStartNavigation}
      navigationMode={store.navigationMode}
      onExitNavigation={mapController.handleExitNavigation}
      distanceLabel={mapController.distanceLabel}
      etaLabel={mapController.etaLabel}
      navigationProgressPct={mapController.navigationProgressPct}
      onNavigationCameraModeChange={mapController.handleNavigationCameraModeChange}
      navigationError={mapController.navigationError}
      activePoiAlert={mapController.activePoiAlert}
      getPoiDisplayName={mapController.getPoiDisplayName}
      poiCategoryLabels={mapController.poiCategoryLabels}
      onAddActivePoiAlertWaypoint={() => {
        void handleAddActivePoiAlertWaypoint()
      }}
      onDismissPoiAlert={mapController.handleDismissPoiAlert}
    />
  )

  const renderProfils = () => (
    <ProfilesPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      profileSettings={store.profileSettings}
      onSpeedChange={routingController.handleSpeedChange}
      onAssistChange={(value) =>
        store.setProfileSettings((current) => ({
          ...current,
          ebikeAssist: value,
        }))
      }
      onReset={routingController.handleResetProfiles}
    />
  )

  const renderDonnees = () => (
    <DataPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isFrench={isFrench}
      surfaceColor={surfaceColor}
      borderColor={borderColor}
      dataAccordionValue={store.dataAccordionValue}
      onDataAccordionChange={store.setDataAccordionValue}
      savedTrips={store.savedTrips}
      onExportBackup={() => {
        void dataController.handleExportBackup()
      }}
      onImportData={dataController.handleImportData}
      importInputRef={store.importInputRef}
      onImportFileChange={dataController.handleImportFileChange}
      formatDistance={(distanceMeters: number) => mapController.formatDistance(distanceMeters)}
      onOpenSavedTrip={dataController.handleOpenSavedTrip}
      onExportSavedTrip={dataController.handleExportSavedTrip}
      onDeleteSavedTrip={dataController.handleDeleteSavedTrip}
      hasAnyConfiguredCloudProvider={cloudController.hasAnyConfiguredCloudProvider}
      cloudProvider={store.cloudProvider}
      onCloudProviderChange={cloudController.handleCloudProviderChange}
      cloudProviderControlData={cloudController.cloudProviderControlData}
      selectedCloudProvider={cloudController.selectedCloudProvider}
      selectedCloudConfigured={cloudController.selectedCloudConfigured}
      cloudAuthState={store.cloudAuthState}
      toCloudProviderLabel={cloudController.toCloudProviderLabel}
      cloudAccountLabel={cloudController.cloudAccountLabel}
      cloudLastSyncAt={store.cloudLastSyncAt}
      cloudBackupFileName={cloudController.cloudBackupFileName}
      connectedCloudMatchesSelection={cloudController.connectedCloudMatchesSelection}
      onCloudConnect={() => {
        void cloudController.handleCloudConnect()
      }}
      onCloudDisconnect={() => {
        void cloudController.handleCloudDisconnect()
      }}
      isCloudAuthLoading={store.isCloudAuthLoading}
      isCloudSyncLoading={store.isCloudSyncLoading}
      cloudAutoBackupEnabled={store.cloudAutoBackupEnabled}
      onCloudAutoBackupEnabledChange={cloudController.handleCloudAutoBackupEnabledChange}
      onCloudUploadBackup={() => {
        void cloudController.handleCloudUploadBackup()
      }}
      cloudSyncMessage={store.cloudSyncMessage}
      cloudSyncError={store.cloudSyncError}
      addressBookPanelProps={{
        isDesktop,
        entries: store.addressBook,
        visibleEntries: dataController.visibleAddressBookEntries,
        visibleCount: dataController.visibleAddressBookCount,
        filterTag: store.addressBookFilterTag,
        filterAllValue: dataController.addressBookFilterAll,
        filterOptions: dataController.addressBookTagOptions,
        nameValue: store.addressBookNameValue,
        placeValue: store.addressBookPlaceValue,
        tagsValue: store.addressBookTagsValue,
        canSave: dataController.canSaveAddressBookEntry,
        formatTagLabel: dataController.formatAddressTagLabel,
        onNameChange: store.setAddressBookNameValue,
        onPlaceValueChange: store.setAddressBookPlaceValue,
        onPlaceSelect: store.setAddressBookPlaceCandidate,
        onTagsChange: store.setAddressBookTagsValue,
        onSave: dataController.handleSaveAddressBookEntry,
        onFilterChange: dataController.setAddressBookFilterTag,
        onDelete: dataController.handleDeleteAddressBookEntry,
        onAddTag: dataController.handleAddAddressBookTag,
        onDeleteTag: dataController.handleDeleteAddressBookTag,
      }}
    />
  )

  const renderAide = () => (
    <HelpPage
      contentSize={contentSize}
      isDesktop={isDesktop}
      isDarkTheme={isDarkTheme}
      isFrench={isFrench}
      theme={theme}
      valhallaStatus={store.valhallaStatus}
      isValhallaStatusLoading={store.isValhallaStatusLoading}
      valhallaStatusError={store.valhallaStatusError}
      valhallaUpdateAvailable={routingController.valhallaUpdateAvailable}
      isValhallaBuildRunning={routingController.isValhallaBuildRunning}
      cloudDiagnostics={store.cloudDiagnostics}
      isCloudDiagnosticsLoading={store.isCloudDiagnosticsLoading}
      cloudDiagnosticsError={store.cloudDiagnosticsError}
      feedbackSubject={store.feedbackSubject}
      feedbackContactEmail={store.feedbackContactEmail}
      feedbackMessage={store.feedbackMessage}
      isFeedbackSubmitting={store.isFeedbackSubmitting}
      canSubmitFeedback={routingController.canSubmitFeedback}
      feedbackSubmitMessage={store.feedbackSubmitMessage}
      feedbackSubmitError={store.feedbackSubmitError}
      onFeedbackSubjectChange={store.setFeedbackSubject}
      onFeedbackContactEmailChange={store.setFeedbackContactEmail}
      onFeedbackMessageChange={store.setFeedbackMessage}
      onSubmitFeedback={() => {
        void routingController.handleSubmitDeveloperFeedback()
      }}
    />
  )

  const mainContent = (() => {
    switch (route) {
      case 'carte':
        return renderCarte()
      case 'profils':
        return renderProfils()
      case 'donnees':
        return renderDonnees()
      case 'aide':
        return renderAide()
      default:
        return renderPlanifier()
    }
  })()

  return (
    <>
      <ShellLayout
        isDesktop={isDesktop}
        route={route}
        navItems={navItems}
        onNavigate={handleNavigate}
        showShellHeader={showShellHeader}
        showShellFooter={showShellFooter}
        showMobileCompactHeader={showMobileCompactHeader}
        showDesktopMapHeader={showDesktopMapHeader}
        headerHeight={headerHeight}
        footerHeight={footerHeight}
        viewportHeightUnit={viewportHeightUnit}
        availableViewportHeight={availableViewportHeight}
        contentSize={contentSize}
        borderColor={borderColor}
        shellChromeBackground={shellChromeBackground}
        shellChromeFilter={shellChromeFilter}
        shellMainBackground={shellMainBackground}
        isMapRoute={route === 'carte'}
        mobileHeaderTitle={mapController.mobileHeaderTitle}
        mapHeaderTitle={mapController.mapHeaderTitle}
        appNameLabel={t('appName')}
        appTaglineLabel={t('tagline')}
        language={language}
        onLanguageChange={(value) => {
          void i18n.changeLanguage(value)
        }}
        mapViewMode={mapController.mapViewMode}
        onMapViewModeChange={mapController.setMapViewMode}
        mapViewLabel={t('mapViewLabel')}
        mapView2dLabel={t('mapView2d')}
        mapView3dLabel={t('mapView3d')}
        themeMode={themeMode}
        onThemeModeChange={setColorScheme}
        isDarkTheme={isDarkTheme}
        nextThemeMode={nextThemeMode}
        mobileThemeActionLabel={mobileThemeActionLabel}
        settingsLanguageLabel={t('settingsLanguageLabel')}
        themeAutoLabel={t('themeAuto')}
        themeLightLabel={t('themeLight')}
        themeDarkLabel={t('themeDark')}
        mainContent={mainContent}
        surfaceGrayDisabled={theme.colors.gray[4]}
        surfaceGrayDefault={theme.colors.gray[6]}
        activeRouteColor={theme.colors.blue[6]}
      />

      <ShellModals
        pendingCloudRestoreModifiedAt={cloudController.pendingCloudRestore?.modifiedAt ?? null}
        isOpen={cloudController.pendingCloudRestore !== null}
        isFrench={isFrench}
        onCancelPendingCloudRestore={cloudController.handleCancelPendingCloudRestore}
        onApplyPendingCloudRestore={cloudController.applyPendingCloudRestore}
      />
    </>
  )
}

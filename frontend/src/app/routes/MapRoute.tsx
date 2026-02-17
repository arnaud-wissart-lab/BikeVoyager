import { Badge, Loader, type MantineTheme } from '@mantine/core'
import type { TFunction } from 'i18next'
import { useDataController } from '../../features/data/useDataController'
import { useMapController } from '../../features/map/useMapController'
import { usePoisController } from '../../features/pois/usePoisController'
import {
  normalizeNumericInput,
  poiAlertDistanceRange,
  poiCorridorRange,
  type RouteElevationPoint,
} from '../../features/routing/domain'
import { useRoutingController } from '../../features/routing/useRoutingController'
import type { AppStore } from '../../state/appStore'
import MapPage from '../../ui/pages/MapPage'
import { useAppDetourHandlers } from '../useAppDetourHandlers'

type MapRouteProps = {
  t: TFunction
  theme: MantineTheme
  isDesktop: boolean
  isDarkTheme: boolean
  surfaceColor: string
  borderColor: string
  availableViewportHeight: string
  chromeFooterHeight: number
  store: AppStore
  mapController: ReturnType<typeof useMapController>
  routingController: ReturnType<typeof useRoutingController>
  dataController: ReturnType<typeof useDataController>
  poisController: ReturnType<typeof usePoisController>
  detourHandlers: ReturnType<typeof useAppDetourHandlers>
}

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

export default function MapRoute({
  t,
  theme,
  isDesktop,
  isDarkTheme,
  surfaceColor,
  borderColor,
  availableViewportHeight,
  chromeFooterHeight,
  store,
  mapController,
  routingController,
  dataController,
  poisController,
  detourHandlers,
}: MapRouteProps) {
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
    onToggleCustomDetourPanel: () => store.setIsCustomDetourPanelOpen((current) => !current),
    detourPoints: store.detourPoints,
    customDetourValue: store.customDetourValue,
    onCustomDetourValueChange: store.setCustomDetourValue,
    customDetourPlace: store.customDetourPlace,
    onCustomDetourPlaceSelect: store.setCustomDetourPlace,
    onAddCustomDetourFromAddress: detourHandlers.handleAddCustomDetourFromAddress,
    customDetourLat: store.customDetourLat,
    customDetourLon: store.customDetourLon,
    onCustomDetourLatChange: (value: string | number) =>
      store.setCustomDetourLat(normalizeNumericInput(value)),
    onCustomDetourLonChange: (value: string | number) =>
      store.setCustomDetourLon(normalizeNumericInput(value)),
    onAddCustomDetourFromCoordinates: detourHandlers.handleAddCustomDetourFromCoordinates,
    onRemoveDetourPoint: detourHandlers.handleRemoveDetourPoint,
    addressBookEntries: store.addressBook,
    selectedDeliveryStartId: store.deliveryStartAddressId,
    selectedDeliveryStopIds: store.deliveryStopAddressIds,
    onSelectDeliveryStart: dataController.handleSelectDeliveryStart,
    onToggleDeliveryStop: dataController.handleToggleDeliveryStop,
    onAddAddressBookDetour: detourHandlers.handleAddAddressBookDetour,
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
      onStopDragStart: detourHandlers.handleDeliveryStopDragStart,
      onStopDragOver: detourHandlers.handleDeliveryStopDragOver,
      onStopDrop: detourHandlers.handleDeliveryStopDrop,
      onStopDragEnd: detourHandlers.handleDeliveryStopDragEnd,
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
    onAddPoiWaypoint: detourHandlers.handleAddPoiWaypoint,
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

  return (
    <MapPage
      availableViewportHeight={availableViewportHeight}
      mapBackgroundColor={isDarkTheme ? theme.colors.gray[9] : theme.colors.gray[1]}
      loadingOverlayColor={isDarkTheme ? 'rgba(18, 20, 24, 0.62)' : 'rgba(255, 255, 255, 0.64)'}
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
        void detourHandlers.handleAddPoiWaypoint({
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
        void detourHandlers.handleAddActivePoiAlertWaypoint()
      }}
      onDismissPoiAlert={mapController.handleDismissPoiAlert}
    />
  )
}

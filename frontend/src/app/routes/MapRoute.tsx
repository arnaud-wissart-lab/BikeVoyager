import { Badge, Box, Loader, type MantineTheme } from '@mantine/core'
import type { TFunction } from 'i18next'
import { useEffect, useMemo } from 'react'
import { useDataController } from '../../features/data/useDataController'
import { useMapController } from '../../features/map/useMapController'
import { usePoisController } from '../../features/pois/usePoisController'
import {
  computeElevationStats,
  computeRouteBounds,
  computeRouteDifficulty,
  expandBounds,
  findProfileMatchingSettings,
  normalizeNumericInput,
  poiAlertDistanceRange,
  poiCorridorRange,
  type RouteDifficulty,
  type RouteKey,
} from '../../features/routing/domain'
import { useRoutingController } from '../../features/routing/useRoutingController'
import type { AppStore } from '../../state/appStore'
import MapPage from '../../ui/pages/MapPage'
import RouteAlternativeComparisonDialog from '../../ui/pages/RouteAlternativeComparisonDialog'
import { useSaveTripDialog } from '../../ui/pages/map/useSaveTripDialog'
import { useAppDetourHandlers } from '../useAppDetourHandlers'

type MapRouteProps = {
  t: TFunction
  theme: MantineTheme
  isDesktop: boolean
  isDarkTheme: boolean
  isFrench: boolean
  surfaceColor: string
  borderColor: string
  availableViewportHeight: string
  chromeFooterHeight: number
  onNavigate: (route: RouteKey) => void
  store: AppStore
  mapController: ReturnType<typeof useMapController>
  routingController: ReturnType<typeof useRoutingController>
  dataController: ReturnType<typeof useDataController>
  poisController: ReturnType<typeof usePoisController>
  detourHandlers: ReturnType<typeof useAppDetourHandlers>
}

const routeDifficultyTranslationKeys: Record<RouteDifficulty, string> = {
  easy: 'routeDifficultyEasy',
  moderate: 'routeDifficultyModerate',
  demanding: 'routeDifficultyDemanding',
  hard: 'routeDifficultyHard',
}

const comparisonPanelTransitionMs = 320

export default function MapRoute({
  t,
  theme,
  isDesktop,
  isDarkTheme,
  isFrench,
  surfaceColor,
  borderColor,
  availableViewportHeight,
  chromeFooterHeight,
  onNavigate,
  store,
  mapController,
  routingController,
  dataController,
  poisController,
  detourHandlers,
}: MapRouteProps) {
  const overlapLabel = store.routeResult?.kind === 'loop' ? store.routeResult.overlapScore : null
  const activeProfile = findProfileMatchingSettings(store.profileCatalog, store.profileSettings)
  const activeProfileLabel =
    activeProfile?.kind === 'preset'
      ? t(activeProfile.preset.labelKey)
      : activeProfile?.kind === 'custom'
        ? activeProfile.profile.name
        : t('profileCurrentCustomShort')
  const overlapHint =
    overlapLabel === 'faible'
      ? t('mapOverlapLowHelp')
      : overlapLabel === 'moyen'
        ? t('mapOverlapMediumHelp')
        : overlapLabel === 'élevé'
          ? t('mapOverlapHighHelp')
          : null
  const elevationProfile = store.routeResult?.elevation_profile ?? null
  const elevationStats = computeElevationStats(elevationProfile)
  const routeDifficulty = computeRouteDifficulty(
    mapController.routeDistanceMeters,
    elevationStats.elevationGainMeters,
    elevationStats.maxSlopePercent,
    store.mode,
    store.profileSettings.ebikeAssist,
  )
  const formatElevationMeters = (value: number | null) =>
    value !== null ? `${Math.round(value)} ${t('unitM')}` : t('placeholderValue')
  const formatSlopePercent = (value: number | null) =>
    value !== null ? `${Number(value.toFixed(1))} %` : null
  const elevationGainLabel = formatElevationMeters(elevationStats.elevationGainMeters)
  const elevationLossLabel = formatElevationMeters(elevationStats.elevationLossMeters)
  const elevationRangeLabel = elevationStats.elevationMinMax
    ? `${Math.round(elevationStats.elevationMinMax.min)} - ${Math.round(
        elevationStats.elevationMinMax.max,
      )} ${t('unitM')}`
    : t('placeholderValue')
  const maxSlopeLabel = formatSlopePercent(elevationStats.maxSlopePercent)
  const routeDifficultyLabel = routeDifficulty
    ? t(routeDifficultyTranslationKeys[routeDifficulty])
    : null
  const routeDifficultyHint =
    store.mode === 'ebike' && routeDifficulty ? t('mapSummaryEbikeDifficultyHint') : null
  const elevationHint =
    store.routeResult && !elevationStats.isAvailable ? t('mapElevationUnavailable') : null
  const saveTripDialog = useSaveTripDialog({
    routeResult: store.routeResult,
    startLabel: mapController.startLabel,
    endLabel: mapController.endLabel,
    isFrench,
    t,
    onSave: dataController.handleSaveCurrentTrip,
  })
  const selectedAlternativeId =
    store.routeAlternatives.find(
      (alternative) => alternative.candidate === store.pendingAlternativeRoute,
    )?.id ?? null
  const triggerMapCommand = mapController.triggerMapCommand
  const visibleAlternativeRoute = store.isAlternativeComparisonOpen
    ? (store.pendingAlternativeRoute?.route ?? null)
    : null
  const visibleRouteBounds = useMemo(() => {
    if (!store.routeResult || !visibleAlternativeRoute) {
      return mapController.expandedRouteBounds
    }

    const combinedBounds = computeRouteBounds({
      type: 'LineString',
      coordinates: [
        ...store.routeResult.geometry.coordinates,
        ...visibleAlternativeRoute.geometry.coordinates,
      ],
    })

    return combinedBounds ? expandBounds(combinedBounds) : mapController.expandedRouteBounds
  }, [mapController.expandedRouteBounds, store.routeResult, visibleAlternativeRoute])

  useEffect(() => {
    if (!isDesktop || !store.isAlternativeComparisonOpen) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      triggerMapCommand('resetRoute')
    }, comparisonPanelTransitionMs + 40)

    return () => window.clearTimeout(timeoutId)
  }, [isDesktop, selectedAlternativeId, store.isAlternativeComparisonOpen, triggerMapCommand])

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
    routeResult: store.routeResult,
    distanceLabel: mapController.distanceLabel,
    etaLabel: mapController.etaLabel,
    overlapLabel,
    overlapHint,
    elevationGainLabel,
    elevationLossLabel,
    elevationRangeLabel,
    maxSlopeLabel,
    routeDifficultyLabel,
    routeDifficultyHint,
    elevationHint,
    elevationProfile,
    detourSummary: mapController.detourSummary,
    hasRoute: mapController.hasRoute,
    isRouteLoading: store.isRouteLoading,
    isAlternativeLoading: store.isAlternativeLoading,
    alternativeCount: store.routeAlternatives.length,
    isAlternativeComparisonActive:
      store.isAlternativeComparisonOpen && Boolean(store.pendingAlternativeRoute),
    isExporting: store.isExporting,
    exportError: store.exportError,
    routeErrorMessage: routingController.routeErrorDisplayMessage,
    activeProfileLabel,
    onOpenProfiles: () => onNavigate('profils'),
    onOpenAlternativeComparison: () => {
      void routingController.handleOpenAlternativeComparison()
    },
    onOpenNavigationSetup: mapController.handleOpenNavigationSetup,
    onExportRoute: (format: 'gpx' | 'tcx') => {
      void routingController.handleExportRoute(format)
    },
    onOpenSaveTripDialog: saveTripDialog.open,
  }

  const poiPanelProps = {
    poiCategoryOptions: poisController.poiCategoryOptions,
    poiCategories: store.poiCategories,
    onPoiCategoryChange: poisController.handlePoiCategoryChange,
    poiAdvancedFilterGroups: poisController.poiAdvancedFilterGroups,
    poiAdvancedFilterSettings: store.poiAdvancedFilterSettings,
    poiAdvancedFilterSelectedCount: poisController.poiAdvancedFilterSelectedCount,
    onPoiAdvancedFilterGroupChange: poisController.handlePoiAdvancedFilterGroupChange,
    onPoiAdvancedFilterGroupSelectAll: poisController.handlePoiAdvancedFilterGroupSelectAll,
    onPoiAdvancedFilterGroupHideAll: poisController.handlePoiAdvancedFilterGroupHideAll,
    onPoiAdvancedFilterSelectAll: poisController.handlePoiAdvancedFilterSelectAll,
    onPoiAdvancedFilterHideAll: poisController.handlePoiAdvancedFilterHideAll,
    onPoiAdvancedFilterReset: poisController.handlePoiAdvancedFilterReset,
    onPoiAdvancedFilterUsefulBikePreset: poisController.handlePoiAdvancedFilterUsefulBikePreset,
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
    automaticNavigationRecalculationEnabled: store.automaticNavigationRecalculationEnabled,
    voiceGuidanceEnabled: store.voiceGuidanceEnabled,
    voiceGuidanceSupportStatus: mapController.voiceGuidance.supportStatus,
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
    onAutomaticNavigationRecalculationEnabledChange:
      store.setAutomaticNavigationRecalculationEnabled,
    onVoiceGuidanceEnabledChange: store.setVoiceGuidanceEnabled,
    onPoiAlertEnabledChange: store.setPoiAlertEnabled,
    onPoiAlertCategoryChange: poisController.handlePoiAlertCategoryChange,
    onPoiAlertDistanceMetersChange: store.setPoiAlertDistanceMeters,
    onSystemNotificationsChange: mapController.handleSystemNotificationsChange,
  }

  return (
    <>
      {saveTripDialog.node}
      <Box
        data-testid="map-comparison-layout"
        data-comparison-open={isDesktop && store.isAlternativeComparisonOpen ? 'true' : 'false'}
        style={{
          display: 'grid',
          gridTemplateColumns:
            isDesktop && store.isAlternativeComparisonOpen
              ? 'minmax(0, 1fr) min(40rem, 42vw)'
              : 'minmax(0, 1fr) 0',
          width: '100%',
          height: availableViewportHeight,
          overflow: 'hidden',
          transition: `grid-template-columns ${comparisonPanelTransitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        <Box data-testid="map-comparison-map" style={{ minWidth: 0, height: '100%' }}>
          <MapPage
            availableViewportHeight="100%"
            mapBackgroundColor={isDarkTheme ? theme.colors.gray[9] : theme.colors.gray[1]}
            loadingOverlayColor={
              isDarkTheme ? 'rgba(18, 20, 24, 0.62)' : 'rgba(255, 255, 255, 0.64)'
            }
            setupOverlayColor={isDarkTheme ? 'rgba(10, 12, 16, 0.62)' : 'rgba(255, 255, 255, 0.62)'}
            loadingSpinnerColor={theme.colors.blue[6]}
            routeResult={store.routeResult}
            pendingAlternativeRoute={visibleAlternativeRoute}
            expandedRouteBounds={visibleRouteBounds}
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
            formatDistance={mapController.formatDistance}
            formatCoordinate={mapController.formatCoordinate}
            selectedPoiUsefulRows={mapController.selectedPoiUsefulRows}
            selectedPoiExternalLinks={mapController.selectedPoiExternalLinks}
            selectedPoiTechnicalRows={mapController.selectedPoiTechnicalRows}
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
            navigationGuidance={mapController.navigationGuidance}
            voiceGuidanceEnabled={store.voiceGuidanceEnabled}
            voiceGuidanceSupportStatus={mapController.voiceGuidance.supportStatus}
            wakeLockStatus={mapController.wakeLockStatus}
            onNavigationCameraModeChange={mapController.handleNavigationCameraModeChange}
            navigationError={mapController.navigationError}
            navigationOffRouteAlert={routingController.navigationOffRouteAlert}
            navigationRecalculationSuccessMessage={
              routingController.navigationRecalculationSuccessMessage
            }
            navigationAutoRecalculationCancellationMessage={
              routingController.navigationAutoRecalculationCancellationMessage
            }
            onRecalculateFromCurrentPosition={() => {
              void routingController.handleRecalculateFromCurrentPosition()
            }}
            onDismissNavigationDeviation={() => {
              routingController.cancelAutomaticRecalculationForCurrentEpisode()
              mapController.handleDismissNavigationDeviation()
            }}
            activePoiAlert={mapController.activePoiAlert}
            getPoiDisplayName={mapController.getPoiDisplayName}
            poiCategoryLabels={mapController.poiCategoryLabels}
            onAddActivePoiAlertWaypoint={() => {
              void detourHandlers.handleAddActivePoiAlertWaypoint()
            }}
            onDismissPoiAlert={mapController.handleDismissPoiAlert}
          />
        </Box>

        {isDesktop ? (
          <Box
            data-testid="route-comparison-sidebar"
            style={{ minWidth: 0, height: '100%', overflow: 'hidden' }}
          >
            <RouteAlternativeComparisonDialog
              opened={store.isAlternativeComparisonOpen}
              isCompact={false}
              alternatives={store.routeAlternatives}
              selectedAlternativeId={selectedAlternativeId}
              onSelectAlternative={routingController.handleSelectAlternativeRoute}
              onApplyAlternative={routingController.handleApplyAlternativeRoute}
              onClose={routingController.handleCloseAlternativeComparison}
            />
          </Box>
        ) : null}
      </Box>

      {!isDesktop ? (
        <RouteAlternativeComparisonDialog
          opened={store.isAlternativeComparisonOpen}
          isCompact
          alternatives={store.routeAlternatives}
          selectedAlternativeId={selectedAlternativeId}
          onSelectAlternative={routingController.handleSelectAlternativeRoute}
          onApplyAlternative={routingController.handleApplyAlternativeRoute}
          onClose={routingController.handleCloseAlternativeComparison}
        />
      ) : null}
    </>
  )
}

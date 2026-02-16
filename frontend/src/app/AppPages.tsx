import { Badge, Loader, type MantineTheme } from '@mantine/core'
import type { TFunction } from 'i18next'
import DataPage from '../ui/pages/DataPage'
import HelpPage from '../ui/pages/HelpPage'
import MapPage from '../ui/pages/MapPage'
import PlannerPage from '../ui/pages/PlannerPage'
import ProfilesPage from '../ui/pages/ProfilesPage'
import { normalizeNumericInput, poiAlertDistanceRange, poiCorridorRange, type RouteElevationPoint, type RouteKey } from '../features/routing/domain'
import type { AppStore } from '../state/appStore'
import { useCloudController } from '../features/cloud/useCloudController'
import { useDataController } from '../features/data/useDataController'
import { useMapController } from '../features/map/useMapController'
import { usePoisController } from '../features/pois/usePoisController'
import { useRoutingController } from '../features/routing/useRoutingController'
import { useAppDetourHandlers } from './useAppDetourHandlers'

type AppPagesProps = {
  route: RouteKey
  t: TFunction
  theme: MantineTheme
  isDesktop: boolean
  isDarkTheme: boolean
  isFrench: boolean
  contentSize: string
  surfaceColor: string
  borderColor: string
  availableViewportHeight: string
  chromeFooterHeight: number
  store: AppStore
  mapController: ReturnType<typeof useMapController>
  routingController: ReturnType<typeof useRoutingController>
  dataController: ReturnType<typeof useDataController>
  cloudController: ReturnType<typeof useCloudController>
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

export default function AppPages({
  route,
  t,
  theme,
  isDesktop,
  isDarkTheme,
  isFrench,
  contentSize,
  surfaceColor,
  borderColor,
  availableViewportHeight,
  chromeFooterHeight,
  store,
  mapController,
  routingController,
  dataController,
  cloudController,
  poisController,
  detourHandlers,
}: AppPagesProps) {
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

  if (route === 'carte') {
    return (
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

  if (route === 'profils') {
    return (
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
  }

  if (route === 'donnees') {
    return (
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
  }

  if (route === 'aide') {
    return (
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
  }

  return (
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
}

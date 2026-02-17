import { Box, Loader, Paper, Stack, Text } from '@mantine/core'
import { Suspense, lazy, type ComponentProps, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  MapCommand,
  MapViewMode,
  NavigationCameraMode,
  NavigationMode,
  NavigationProgress,
  PoiCategory,
  PoiItem,
  RouteBounds,
  TripResult,
} from '../../features/routing/domain'
import MapSummaryPanel from './MapSummaryPanel'
import NavigationOptionsPanel from './NavigationOptionsPanel'
import PoiPanel from './PoiPanel'
import MapNavigationOverlay from './map/MapNavigationOverlay'
import MapNavigationSetupOverlay from './map/MapNavigationSetupOverlay'
import MapPanelsOverlay from './map/MapPanelsOverlay'
import MapPoiDetailsOverlay from './map/MapPoiDetailsOverlay'

const LazyCesiumRouteMap = lazy(() => import('../../components/CesiumRouteMap'))

type MapPageProps = {
  availableViewportHeight: string
  mapBackgroundColor: string
  loadingOverlayColor: string
  setupOverlayColor: string
  loadingSpinnerColor: string
  routeResult: TripResult | null
  expandedRouteBounds: RouteBounds | null
  mapViewMode: MapViewMode
  mapCommand: MapCommand | null
  mapCommandSeq: number
  poiEnabled: boolean
  visiblePoiItems: PoiItem[]
  selectedPoiId: string | null
  onPoiSelect: (poiId: string) => void
  isNavigationActive: boolean
  navigationProgress: NavigationProgress | null
  navigationCameraMode: NavigationCameraMode
  hasRoute: boolean
  mapOverlayPadding: number
  isDesktop: boolean
  isSummaryPanelExpanded: boolean
  onToggleSummaryPanel: () => void
  summaryPanelProps: Omit<ComponentProps<typeof MapSummaryPanel>, 'isCompact'>
  isPoiPanelExpanded: boolean
  onTogglePoiPanel: () => void
  poiPanelProps: Omit<ComponentProps<typeof PoiPanel>, 'isCompact'>
  renderPoiLoadIndicator: (size?: 'xs' | 'sm') => ReactNode
  surfaceColor: string
  panelTransitionDuration: number
  panelTransitionTiming: string
  onResetRouteView: () => void
  chromeFooterHeight: number
  isMobileMapPanelExpanded: boolean
  onToggleMobileMapPanel: () => void
  mobileMapPanelTransition: string
  isPoiModalOpen: boolean
  selectedPoi: PoiItem | null
  selectedPoiDisplayName: string
  selectedPoiCategoryLabel: string | null
  selectedPoiKind: string | null
  onZoomOutPoi: () => void
  onZoomInPoi: () => void
  isRouteLoading: boolean
  isMobilePoiDetailsExpanded: boolean
  onToggleMobilePoiDetails: () => void
  onClosePoiModal: () => void
  poiDetourIds: Set<string>
  onAddSelectedPoiWaypoint: () => void
  selectedPoiWebsite: string | null
  formatDistance: (distanceMeters: number | null) => string
  formatCoordinate: (coordinate: number) => string
  selectedPoiTags: Array<[string, string]>
  formatPoiTagLabel: (key: string) => string
  formatPoiTagValue: (value: string) => string
  mobilePoiPanelTransition: string
  isNavigationSetupOpen: boolean
  onCloseNavigationSetup: () => void
  navigationOptionsPanelProps: Omit<ComponentProps<typeof NavigationOptionsPanel>, 'isCompact'>
  onStartNavigation: () => void
  navigationMode: NavigationMode
  onExitNavigation: () => void
  distanceLabel: string
  etaLabel: string
  navigationProgressPct: number | null
  onNavigationCameraModeChange: (value: string) => void
  navigationError: string | null
  activePoiAlert: PoiItem | null
  getPoiDisplayName: (poi: PoiItem | null) => string
  poiCategoryLabels: Record<PoiCategory, string>
  onAddActivePoiAlertWaypoint: () => void
  onDismissPoiAlert: () => void
}

export default function MapPage({
  availableViewportHeight,
  mapBackgroundColor,
  loadingOverlayColor,
  setupOverlayColor,
  loadingSpinnerColor,
  routeResult,
  expandedRouteBounds,
  mapViewMode,
  mapCommand,
  mapCommandSeq,
  poiEnabled,
  visiblePoiItems,
  selectedPoiId,
  onPoiSelect,
  isNavigationActive,
  navigationProgress,
  navigationCameraMode,
  hasRoute,
  mapOverlayPadding,
  isDesktop,
  isSummaryPanelExpanded,
  onToggleSummaryPanel,
  summaryPanelProps,
  isPoiPanelExpanded,
  onTogglePoiPanel,
  poiPanelProps,
  renderPoiLoadIndicator,
  surfaceColor,
  panelTransitionDuration,
  panelTransitionTiming,
  onResetRouteView,
  chromeFooterHeight,
  isMobileMapPanelExpanded,
  onToggleMobileMapPanel,
  mobileMapPanelTransition,
  isPoiModalOpen,
  selectedPoi,
  selectedPoiDisplayName,
  selectedPoiCategoryLabel,
  selectedPoiKind,
  onZoomOutPoi,
  onZoomInPoi,
  isRouteLoading,
  isMobilePoiDetailsExpanded,
  onToggleMobilePoiDetails,
  onClosePoiModal,
  poiDetourIds,
  onAddSelectedPoiWaypoint,
  selectedPoiWebsite,
  formatDistance,
  formatCoordinate,
  selectedPoiTags,
  formatPoiTagLabel,
  formatPoiTagValue,
  mobilePoiPanelTransition,
  isNavigationSetupOpen,
  onCloseNavigationSetup,
  navigationOptionsPanelProps,
  onStartNavigation,
  navigationMode,
  onExitNavigation,
  distanceLabel,
  etaLabel,
  navigationProgressPct,
  onNavigationCameraModeChange,
  navigationError,
  activePoiAlert,
  getPoiDisplayName,
  poiCategoryLabels,
  onAddActivePoiAlertWaypoint,
  onDismissPoiAlert,
}: MapPageProps) {
  const { t } = useTranslation()

  const mapPois = poiEnabled ? visiblePoiItems : []
  const mapNavigationProgress =
    isNavigationActive && navigationProgress
      ? {
          lat: navigationProgress.lat,
          lon: navigationProgress.lon,
          headingDeg: navigationProgress.heading_deg,
          source: navigationProgress.source,
        }
      : null

  return (
    <Box
      style={{
        position: 'relative',
        height: availableViewportHeight,
        width: '100%',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        backgroundColor: mapBackgroundColor,
      }}
    >
      <Suspense
        fallback={
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mapBackgroundColor,
            }}
          >
            <Loader size="sm" />
          </Box>
        }
      >
        <LazyCesiumRouteMap
          geometry={routeResult?.geometry ?? null}
          bounds={expandedRouteBounds}
          elevationProfile={routeResult?.elevation_profile ?? null}
          viewMode={mapViewMode}
          mapCommand={mapCommand}
          mapCommandSeq={mapCommandSeq}
          fallbackLabel={t('mapPlaceholderCanvas')}
          pois={mapPois}
          activePoiId={selectedPoiId}
          onPoiSelect={onPoiSelect}
          navigationActive={isNavigationActive}
          navigationProgress={mapNavigationProgress}
          navigationCameraMode={navigationCameraMode}
        />
      </Suspense>

      {!hasRoute && (
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: mapOverlayPadding,
            textAlign: 'center',
          }}
        >
          <Paper withBorder radius="md" p="xl" maw={420}>
            <Stack gap={8} align="center">
              <Text fw={600}>{t('mapPlaceholderTitle')}</Text>
              <Text size="sm" c="dimmed">
                {t('mapPlaceholderBody')}
              </Text>
            </Stack>
          </Paper>
        </Box>
      )}

      <MapPanelsOverlay
        isDesktop={isDesktop}
        hasRoute={hasRoute}
        isNavigationActive={isNavigationActive}
        mapOverlayPadding={mapOverlayPadding}
        isSummaryPanelExpanded={isSummaryPanelExpanded}
        onToggleSummaryPanel={onToggleSummaryPanel}
        summaryPanelProps={summaryPanelProps}
        isPoiPanelExpanded={isPoiPanelExpanded}
        onTogglePoiPanel={onTogglePoiPanel}
        poiPanelProps={poiPanelProps}
        renderPoiLoadIndicator={renderPoiLoadIndicator}
        surfaceColor={surfaceColor}
        panelTransitionDuration={panelTransitionDuration}
        panelTransitionTiming={panelTransitionTiming}
        onResetRouteView={onResetRouteView}
        chromeFooterHeight={chromeFooterHeight}
        isMobileMapPanelExpanded={isMobileMapPanelExpanded}
        onToggleMobileMapPanel={onToggleMobileMapPanel}
        mobileMapPanelTransition={mobileMapPanelTransition}
      />

      <MapPoiDetailsOverlay
        isOpen={isPoiModalOpen}
        selectedPoi={selectedPoi}
        isNavigationActive={isNavigationActive}
        mapOverlayPadding={mapOverlayPadding}
        isDesktop={isDesktop}
        surfaceColor={surfaceColor}
        selectedPoiDisplayName={selectedPoiDisplayName}
        selectedPoiCategoryLabel={selectedPoiCategoryLabel}
        selectedPoiKind={selectedPoiKind}
        onZoomOutPoi={onZoomOutPoi}
        onZoomInPoi={onZoomInPoi}
        isRouteLoading={isRouteLoading}
        isMobilePoiDetailsExpanded={isMobilePoiDetailsExpanded}
        onToggleMobilePoiDetails={onToggleMobilePoiDetails}
        onClosePoiModal={onClosePoiModal}
        poiDetourIds={poiDetourIds}
        onAddSelectedPoiWaypoint={onAddSelectedPoiWaypoint}
        selectedPoiWebsite={selectedPoiWebsite}
        formatDistance={formatDistance}
        formatCoordinate={formatCoordinate}
        selectedPoiTags={selectedPoiTags}
        formatPoiTagLabel={formatPoiTagLabel}
        formatPoiTagValue={formatPoiTagValue}
        mobilePoiPanelTransition={mobilePoiPanelTransition}
      />

      {isRouteLoading && (
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: loadingOverlayColor,
            backdropFilter: 'blur(1px)',
          }}
        >
          <Stack gap={6} align="center">
            <Loader size="sm" color={loadingSpinnerColor} />
            <Text size="sm" c="dimmed">
              {t('mapLoading')}
            </Text>
          </Stack>
        </Box>
      )}

      <MapNavigationSetupOverlay
        isOpen={isNavigationSetupOpen}
        hasRoute={hasRoute}
        isNavigationActive={isNavigationActive}
        mapOverlayPadding={mapOverlayPadding}
        setupOverlayColor={setupOverlayColor}
        isDesktop={isDesktop}
        surfaceColor={surfaceColor}
        onCloseNavigationSetup={onCloseNavigationSetup}
        navigationOptionsPanelProps={navigationOptionsPanelProps}
        onStartNavigation={onStartNavigation}
      />

      <MapNavigationOverlay
        isNavigationActive={isNavigationActive}
        hasRoute={hasRoute}
        mapOverlayPadding={mapOverlayPadding}
        surfaceColor={surfaceColor}
        onExitNavigation={onExitNavigation}
        navigationMode={navigationMode}
        distanceLabel={distanceLabel}
        etaLabel={etaLabel}
        navigationProgressPct={navigationProgressPct}
        navigationCameraMode={navigationCameraMode}
        onNavigationCameraModeChange={onNavigationCameraModeChange}
        navigationError={navigationError}
        activePoiAlert={activePoiAlert}
        getPoiDisplayName={getPoiDisplayName}
        poiCategoryLabels={poiCategoryLabels}
        onAddActivePoiAlertWaypoint={onAddActivePoiAlertWaypoint}
        onDismissPoiAlert={onDismissPoiAlert}
        isDesktop={isDesktop}
        chromeFooterHeight={chromeFooterHeight}
      />
    </Box>
  )
}

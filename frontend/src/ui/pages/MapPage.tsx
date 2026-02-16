import {
  ActionIcon,
  Box,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconMapPinPlus,
  IconMinus,
  IconPlayerPlay,
  IconPlus,
  IconRoute,
  IconX,
} from '@tabler/icons-react'
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
import MapCollapsibleSection from './MapCollapsibleSection'
import MapSummaryPanel from './MapSummaryPanel'
import PoiPanel from './PoiPanel'
import NavigationOptionsPanel from './NavigationOptionsPanel'

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
  navigationOptionsPanelProps: Omit<
    ComponentProps<typeof NavigationOptionsPanel>,
    'isCompact'
  >
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

      {isDesktop && hasRoute && !isNavigationActive && (
        <Box
          style={{
            position: 'absolute',
            top: mapOverlayPadding,
            right: mapOverlayPadding,
            width: 320,
            zIndex: 30,
            pointerEvents: 'auto',
          }}
        >
          <Stack gap="xs">
            <MapCollapsibleSection
              title={t('mapSummaryTitle')}
              expanded={isSummaryPanelExpanded}
              onToggle={onToggleSummaryPanel}
              content={<MapSummaryPanel isCompact={false} {...summaryPanelProps} />}
              isCompact={false}
              ariaLabel={t(
                isSummaryPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand',
              )}
              backgroundColor={surfaceColor}
              transitionDuration={panelTransitionDuration}
              transitionTimingFunction={panelTransitionTiming}
            />
            <MapCollapsibleSection
              title={t('tabPois')}
              expanded={isPoiPanelExpanded}
              onToggle={onTogglePoiPanel}
              content={<PoiPanel isCompact={false} {...poiPanelProps} />}
              isCompact={false}
              indicator={renderPoiLoadIndicator()}
              ariaLabel={t(isPoiPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand')}
              backgroundColor={surfaceColor}
              transitionDuration={panelTransitionDuration}
              transitionTimingFunction={panelTransitionTiming}
            />
          </Stack>
        </Box>
      )}

      {!isDesktop && hasRoute && !isNavigationActive && (
        <Box
          style={{
            position: 'absolute',
            top: mapOverlayPadding,
            left: mapOverlayPadding,
            pointerEvents: 'auto',
            zIndex: 31,
          }}
        >
          <ActionIcon
            variant="default"
            size="lg"
            onClick={onResetRouteView}
            aria-label={t('mapResetView')}
            title={t('mapResetView')}
          >
            <IconRoute size={18} />
          </ActionIcon>
        </Box>
      )}

      {!isDesktop && hasRoute && !isNavigationActive && (
        <Paper
          withBorder
          radius="lg"
          shadow="sm"
          p="xs"
          style={{
            position: 'absolute',
            left: mapOverlayPadding,
            right: mapOverlayPadding,
            bottom: chromeFooterHeight + mapOverlayPadding,
            backgroundColor: surfaceColor,
            zIndex: 30,
          }}
        >
          <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
            <Text fw={600} size="sm" lineClamp={1} style={{ minWidth: 0, flex: 1 }}>
              {t('mapSummaryTitle')} + {t('tabPois')}
            </Text>
            <Group gap={6} align="center" wrap="nowrap">
              {renderPoiLoadIndicator('sm')}
              <ActionIcon
                variant="default"
                size="md"
                onClick={onToggleMobileMapPanel}
                aria-label={t(
                  isMobileMapPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand',
                )}
              >
                {isMobileMapPanelExpanded ? (
                  <IconChevronDown size={16} />
                ) : (
                  <IconChevronUp size={16} />
                )}
              </ActionIcon>
            </Group>
          </Group>
          <Box
            className="mobile-map-panel-content"
            aria-hidden={!isMobileMapPanelExpanded}
            style={{
              maxHeight: isMobileMapPanelExpanded ? 'min(52dvh, 380px)' : 0,
              opacity: isMobileMapPanelExpanded ? 1 : 0,
              transform: isMobileMapPanelExpanded
                ? 'translateY(0) scale(1)'
                : 'translateY(10px) scale(0.985)',
              filter: isMobileMapPanelExpanded ? 'blur(0px)' : 'blur(1.5px)',
              overflowY: isMobileMapPanelExpanded ? 'auto' : 'hidden',
              paddingTop: isMobileMapPanelExpanded ? 8 : 0,
              pointerEvents: isMobileMapPanelExpanded ? 'auto' : 'none',
              overscrollBehavior: 'contain',
              transition: mobileMapPanelTransition,
            }}
          >
            <Stack gap="xs">
              <MapCollapsibleSection
                title={t('mapSummaryTitle')}
                expanded={isSummaryPanelExpanded}
                onToggle={onToggleSummaryPanel}
                content={<MapSummaryPanel isCompact {...summaryPanelProps} />}
                isCompact
                ariaLabel={t(
                  isSummaryPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand',
                )}
                backgroundColor={surfaceColor}
                transitionDuration={panelTransitionDuration}
                transitionTimingFunction={panelTransitionTiming}
              />
              <MapCollapsibleSection
                title={t('tabPois')}
                expanded={isPoiPanelExpanded}
                onToggle={onTogglePoiPanel}
                content={<PoiPanel isCompact {...poiPanelProps} />}
                isCompact
                indicator={renderPoiLoadIndicator()}
                ariaLabel={t(
                  isPoiPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand',
                )}
                backgroundColor={surfaceColor}
                transitionDuration={panelTransitionDuration}
                transitionTimingFunction={panelTransitionTiming}
              />
            </Stack>
          </Box>
        </Paper>
      )}

      {isPoiModalOpen && selectedPoi && !isNavigationActive && (
        <Paper
          withBorder
          radius="md"
          p="sm"
          style={{
            position: 'absolute',
            top: mapOverlayPadding + (isDesktop ? 64 : 52),
            right: isDesktop ? mapOverlayPadding + 344 : mapOverlayPadding,
            left: isDesktop ? undefined : mapOverlayPadding,
            width: isDesktop ? 300 : undefined,
            maxHeight: isDesktop ? '52vh' : '36dvh',
            overflow: 'hidden',
            backgroundColor: surfaceColor,
            pointerEvents: 'auto',
            zIndex: 26,
          }}
        >
          <Stack gap={8}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text size="sm" fw={700} lineClamp={2}>
                  {selectedPoiDisplayName}
                </Text>
                <Text size="xs" c="dimmed">
                  {selectedPoiCategoryLabel}
                  {selectedPoiKind ? ` • ${selectedPoiKind}` : ''}
                </Text>
              </Stack>
              <Group gap={4} align="center" wrap="nowrap">
                {!isDesktop && (
                  <ActionIcon
                    variant="default"
                    size="sm"
                    onClick={onZoomOutPoi}
                    aria-label={t('mapPoiZoomOut')}
                    title={t('mapPoiZoomOut')}
                    disabled={isRouteLoading}
                  >
                    <IconMinus size={14} />
                  </ActionIcon>
                )}
                {!isDesktop && (
                  <ActionIcon
                    variant="default"
                    size="sm"
                    onClick={onZoomInPoi}
                    aria-label={t('mapPoiZoomIn')}
                    title={t('mapPoiZoomIn')}
                    disabled={isRouteLoading}
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                )}
                {!isDesktop && (
                  <ActionIcon
                    variant="default"
                    size="sm"
                    onClick={onToggleMobilePoiDetails}
                    aria-label={t(
                      isMobilePoiDetailsExpanded
                        ? 'mapPanelCollapse'
                        : 'mapPanelExpand',
                    )}
                  >
                    {isMobilePoiDetailsExpanded ? (
                      <IconChevronDown size={14} />
                    ) : (
                      <IconChevronUp size={14} />
                    )}
                  </ActionIcon>
                )}
                {isDesktop && (
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={onClosePoiModal}
                    aria-label={t('poiDetailsClose')}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                )}
              </Group>
            </Group>

            <Box
              className="mobile-poi-details-content"
              aria-hidden={!isDesktop && !isMobilePoiDetailsExpanded}
              style={
                isDesktop
                  ? undefined
                  : {
                      maxHeight: isMobilePoiDetailsExpanded ? '26dvh' : 0,
                      opacity: isMobilePoiDetailsExpanded ? 1 : 0,
                      transform: isMobilePoiDetailsExpanded
                        ? 'translateY(0) scale(1)'
                        : 'translateY(8px) scale(0.988)',
                      filter: isMobilePoiDetailsExpanded ? 'blur(0px)' : 'blur(1px)',
                      overflowY: isMobilePoiDetailsExpanded ? 'auto' : 'hidden',
                      pointerEvents: isMobilePoiDetailsExpanded ? 'auto' : 'none',
                      transition: mobilePoiPanelTransition,
                    }
              }
            >
              <Stack gap={8}>
                <Group gap={6} wrap="wrap">
                  <Button
                    size="xs"
                    variant={poiDetourIds.has(selectedPoi.id) ? 'filled' : 'light'}
                    disabled={isRouteLoading}
                    onClick={onAddSelectedPoiWaypoint}
                    leftSection={<IconMapPinPlus size={14} />}
                  >
                    {t('poiAddWaypoint')}
                  </Button>
                  {selectedPoiWebsite && (
                    <Button
                      size="xs"
                      variant="default"
                      component="a"
                      href={selectedPoiWebsite}
                      target="_blank"
                      rel="noreferrer"
                      leftSection={<IconExternalLink size={14} />}
                    >
                      {t('poiDetailsWebsite')}
                    </Button>
                  )}
                </Group>

                <Group justify="space-between" align="center" wrap="nowrap" gap={8}>
                  <Text size="xs" c="dimmed">
                    {t('poiDetailsDistanceAlong')}
                  </Text>
                  <Text size="xs" fw={600} ta="right">
                    {formatDistance(selectedPoi.distance_m)}
                  </Text>
                </Group>
                {typeof selectedPoi.distance_to_route_m === 'number' && (
                  <Group justify="space-between" align="center" wrap="nowrap" gap={8}>
                    <Text size="xs" c="dimmed">
                      {t('poiDetailsDistanceToRoute')}
                    </Text>
                    <Text size="xs" fw={600} ta="right">
                      {formatDistance(selectedPoi.distance_to_route_m)}
                    </Text>
                  </Group>
                )}
                <Group justify="space-between" align="center" wrap="nowrap" gap={8}>
                  <Text size="xs" c="dimmed">
                    {t('poiDetailsCoordinates')}
                  </Text>
                  <Text size="xs" fw={600} ta="right">
                    {formatCoordinate(selectedPoi.lat)} ; {formatCoordinate(selectedPoi.lon)}
                  </Text>
                </Group>
                {selectedPoi.osm_type && typeof selectedPoi.osm_id === 'number' && (
                  <Group justify="space-between" align="center" wrap="nowrap" gap={8}>
                    <Text size="xs" c="dimmed">
                      {t('poiDetailsSource')}
                    </Text>
                    <Text size="xs" fw={600} ta="right">
                      {selectedPoi.osm_type}/{selectedPoi.osm_id}
                    </Text>
                  </Group>
                )}

                <Text size="xs" c="dimmed">
                  {t('poiDetailsTags')}
                </Text>
                {selectedPoiTags.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    {t('poiDetailsNoData')}
                  </Text>
                ) : (
                  <ScrollArea.Autosize mah={isDesktop ? 180 : 140} offsetScrollbars>
                    <Stack gap={4}>
                      {selectedPoiTags.map(([key, value]) => (
                        <Group
                          key={key}
                          justify="space-between"
                          align="flex-start"
                          wrap="nowrap"
                          gap={8}
                        >
                          <Text size="xs" c="dimmed">
                            {formatPoiTagLabel(key)}
                          </Text>
                          <Text size="xs" ta="right">
                            {formatPoiTagValue(value)}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  </ScrollArea.Autosize>
                )}
              </Stack>
            </Box>
          </Stack>
        </Paper>
      )}

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

      {isNavigationSetupOpen && hasRoute && !isNavigationActive && (
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: mapOverlayPadding,
            pointerEvents: 'auto',
            backgroundColor: setupOverlayColor,
            backdropFilter: 'blur(2px)',
          }}
        >
          <Paper
            withBorder
            radius="md"
            p="md"
            style={{
              width: isDesktop ? 460 : '100%',
              maxWidth: 560,
              maxHeight: isDesktop ? '78vh' : '82dvh',
              overflowY: 'auto',
              backgroundColor: surfaceColor,
            }}
          >
            <Stack gap="md">
              <Group justify="space-between" align="center" wrap="nowrap">
                <Text fw={600}>{t('navigationSetupTitle')}</Text>
                <ActionIcon
                  variant="subtle"
                  onClick={onCloseNavigationSetup}
                  aria-label={t('navigationSetupClose')}
                >
                  <IconX size={16} />
                </ActionIcon>
              </Group>
              <NavigationOptionsPanel
                isCompact={false}
                {...navigationOptionsPanelProps}
              />
              <Group grow>
                <Button variant="default" onClick={onCloseNavigationSetup}>
                  {t('navigationSetupClose')}
                </Button>
                <Button
                  onClick={onStartNavigation}
                  data-testid="nav-start"
                  leftSection={<IconPlayerPlay size={16} />}
                >
                  {t('navigationStart')}
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Box>
      )}

      {isNavigationActive && hasRoute && (
        <Box style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Box
            style={{
              position: 'absolute',
              top: mapOverlayPadding,
              left: mapOverlayPadding,
              right: mapOverlayPadding,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'auto',
            }}
          >
            <Paper
              withBorder
              radius="md"
              p="sm"
              style={{ backgroundColor: surfaceColor, minWidth: 260, maxWidth: 520 }}
            >
              <Stack gap={6}>
                <Group justify="space-between" align="center" wrap="nowrap">
                  <Text size="xs" c="dimmed">
                    {t('navigationTitle')}
                  </Text>
                  <Button
                    size="xs"
                    radius="xl"
                    variant="subtle"
                    color="gray"
                    onClick={onExitNavigation}
                    data-testid="nav-exit"
                    leftSection={<IconX size={14} />}
                  >
                    {t('navigationExit')}
                  </Button>
                </Group>
                <Text size="xs" c="dimmed">
                  {navigationMode === 'simulation'
                    ? t('navigationModeSimulationLabel')
                    : t('navigationModeGpsLabel')}
                </Text>
                <Group gap="lg" justify="center" wrap="nowrap">
                  <Stack gap={2} align="center">
                    <Text size="xs" c="dimmed">
                      {t('navigationRemaining')}
                    </Text>
                    <Text fw={600}>{distanceLabel}</Text>
                  </Stack>
                  <Stack gap={2} align="center">
                    <Text size="xs" c="dimmed">
                      {t('navigationEta')}
                    </Text>
                    <Text fw={600}>{etaLabel}</Text>
                  </Stack>
                </Group>
                {navigationProgressPct !== null && (
                  <Text size="xs" c="dimmed">
                    {t('navigationProgressLabel', {
                      progress: Math.round(navigationProgressPct),
                    })}
                  </Text>
                )}
                <SegmentedControl
                  size="xs"
                  radius="xl"
                  value={navigationCameraMode}
                  onChange={onNavigationCameraModeChange}
                  data={[
                    { label: t('navigationViewFollow3d'), value: 'follow_3d' },
                    { label: t('navigationViewPanoramic3d'), value: 'panoramic_3d' },
                    { label: t('navigationViewOverview2d'), value: 'overview_2d' },
                  ]}
                  fullWidth
                />
                {navigationError && (
                  <Text size="xs" c="red.6">
                    {navigationError}
                  </Text>
                )}
              </Stack>
            </Paper>
          </Box>
          {activePoiAlert && (
            <Box
              style={{
                position: 'absolute',
                left: mapOverlayPadding,
                right: mapOverlayPadding,
                bottom: mapOverlayPadding + (isDesktop ? 0 : chromeFooterHeight + 8),
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'auto',
              }}
            >
              <Paper
                withBorder
                radius="md"
                p="sm"
                style={{ backgroundColor: surfaceColor, maxWidth: 520, width: '100%' }}
              >
                <Stack gap={6}>
                  <Text size="xs" c="dimmed">
                    {t('poiAlertTitle')}
                  </Text>
                  <Text size="sm" fw={600}>
                    {getPoiDisplayName(activePoiAlert)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {poiCategoryLabels[activePoiAlert.category]}
                  </Text>
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      size="xs"
                      variant="light"
                      onClick={onAddActivePoiAlertWaypoint}
                      leftSection={<IconMapPinPlus size={14} />}
                    >
                      {t('poiAlertAddWaypoint')}
                    </Button>
                    <Button size="xs" variant="subtle" onClick={onDismissPoiAlert}>
                      {t('poiAlertDismiss')}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}


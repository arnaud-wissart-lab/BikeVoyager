import { ActionIcon, Box, Group, Paper, Stack, Text } from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconRoute } from '@tabler/icons-react'
import type { ComponentProps, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MapCollapsibleSection from '../MapCollapsibleSection'
import MapSummaryPanel from '../MapSummaryPanel'
import PoiPanel from '../PoiPanel'

type MapPanelsOverlayProps = {
  isDesktop: boolean
  hasRoute: boolean
  isNavigationActive: boolean
  mapOverlayPadding: number
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
}

export default function MapPanelsOverlay({
  isDesktop,
  hasRoute,
  isNavigationActive,
  mapOverlayPadding,
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
}: MapPanelsOverlayProps) {
  const { t } = useTranslation()

  if (!hasRoute || isNavigationActive) {
    return null
  }

  if (isDesktop) {
    return (
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
            ariaLabel={t(isSummaryPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand')}
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
    )
  }

  return (
    <>
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
              aria-label={t(isMobileMapPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand')}
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
              ariaLabel={t(isSummaryPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand')}
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
              ariaLabel={t(isPoiPanelExpanded ? 'mapPanelCollapse' : 'mapPanelExpand')}
              backgroundColor={surfaceColor}
              transitionDuration={panelTransitionDuration}
              transitionTimingFunction={panelTransitionTiming}
            />
          </Stack>
        </Box>
      </Paper>
    </>
  )
}

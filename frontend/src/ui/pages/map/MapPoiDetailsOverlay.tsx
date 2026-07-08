import { ActionIcon, Box, Button, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core'
import {
  IconChevronDown,
  IconChevronUp,
  IconExternalLink,
  IconMapPinPlus,
  IconMinus,
  IconPlus,
  IconX,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { PoiDisplayRow, PoiExternalLink } from '../../../features/map/poiDetailsPresentation'
import type { PoiItem } from '../../../features/routing/domain'

type MapPoiDetailsOverlayProps = {
  isOpen: boolean
  selectedPoi: PoiItem | null
  isNavigationActive: boolean
  mapOverlayPadding: number
  isDesktop: boolean
  surfaceColor: string
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
  formatDistance: (distanceMeters: number | null) => string
  formatCoordinate: (coordinate: number) => string
  selectedPoiUsefulRows: PoiDisplayRow[]
  selectedPoiExternalLinks: PoiExternalLink[]
  selectedPoiTechnicalRows: PoiDisplayRow[]
  mobilePoiPanelTransition: string
}

export default function MapPoiDetailsOverlay({
  isOpen,
  selectedPoi,
  isNavigationActive,
  mapOverlayPadding,
  isDesktop,
  surfaceColor,
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
  formatDistance,
  formatCoordinate,
  selectedPoiUsefulRows,
  selectedPoiExternalLinks,
  selectedPoiTechnicalRows,
  mobilePoiPanelTransition,
}: MapPoiDetailsOverlayProps) {
  const { t } = useTranslation()

  if (!isOpen || !selectedPoi || isNavigationActive) {
    return null
  }

  const renderRow = (row: PoiDisplayRow) => (
    <Group key={row.key} justify="space-between" align="flex-start" wrap="nowrap" gap={8}>
      <Text size="xs" c="dimmed">
        {row.labelKey.startsWith('poiDetails') ? t(row.labelKey) : row.labelKey}
      </Text>
      <Text size="xs" ta="right">
        {row.value}
      </Text>
    </Group>
  )

  return (
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
                aria-label={t(isMobilePoiDetailsExpanded ? 'mapPanelCollapse' : 'mapPanelExpand')}
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
              {selectedPoiExternalLinks.map((link) => (
                <Button
                  key={link.key}
                  size="xs"
                  variant="default"
                  component="a"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  leftSection={<IconExternalLink size={14} />}
                >
                  {t(link.labelKey)}
                </Button>
              ))}
            </Group>

            <Text size="xs" c="dimmed">
              {t('poiDetailsUsefulTitle')}
            </Text>
            {selectedPoiUsefulRows.length === 0 ? (
              <Text size="xs" c="dimmed">
                {t('poiDetailsNoData')}
              </Text>
            ) : (
              <Stack gap={4}>{selectedPoiUsefulRows.map(renderRow)}</Stack>
            )}

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

            {selectedPoiTechnicalRows.length > 0 && (
              <Box
                component="details"
                style={{
                  borderTop: '1px solid var(--mantine-color-default-border)',
                  paddingTop: 6,
                }}
              >
                <Text
                  component="summary"
                  size="xs"
                  c="dimmed"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {t('poiDetailsTechnicalTitle')}
                </Text>
                <ScrollArea.Autosize mah={isDesktop ? 130 : 100} mt={6} offsetScrollbars>
                  <Stack gap={4}>{selectedPoiTechnicalRows.map(renderRow)}</Stack>
                </ScrollArea.Autosize>
              </Box>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  )
}

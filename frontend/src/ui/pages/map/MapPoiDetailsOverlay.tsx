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
  selectedPoiWebsite: string | null
  formatDistance: (distanceMeters: number | null) => string
  formatCoordinate: (coordinate: number) => string
  selectedPoiTags: Array<[string, string]>
  formatPoiTagLabel: (key: string) => string
  formatPoiTagValue: (value: string) => string
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
  selectedPoiWebsite,
  formatDistance,
  formatCoordinate,
  selectedPoiTags,
  formatPoiTagLabel,
  formatPoiTagValue,
  mobilePoiPanelTransition,
}: MapPoiDetailsOverlayProps) {
  const { t } = useTranslation()

  if (!isOpen || !selectedPoi || isNavigationActive) {
    return null
  }

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
  )
}

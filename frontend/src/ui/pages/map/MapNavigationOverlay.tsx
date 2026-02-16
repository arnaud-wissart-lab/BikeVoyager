import { Box, Button, Group, Paper, SegmentedControl, Stack, Text } from '@mantine/core'
import { IconMapPinPlus, IconX } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type {
  NavigationCameraMode,
  NavigationMode,
  PoiCategory,
  PoiItem,
} from '../../../features/routing/domain'

type MapNavigationOverlayProps = {
  isNavigationActive: boolean
  hasRoute: boolean
  mapOverlayPadding: number
  surfaceColor: string
  onExitNavigation: () => void
  navigationMode: NavigationMode
  distanceLabel: string
  etaLabel: string
  navigationProgressPct: number | null
  navigationCameraMode: NavigationCameraMode
  onNavigationCameraModeChange: (value: string) => void
  navigationError: string | null
  activePoiAlert: PoiItem | null
  getPoiDisplayName: (poi: PoiItem | null) => string
  poiCategoryLabels: Record<PoiCategory, string>
  onAddActivePoiAlertWaypoint: () => void
  onDismissPoiAlert: () => void
  isDesktop: boolean
  chromeFooterHeight: number
}

export default function MapNavigationOverlay({
  isNavigationActive,
  hasRoute,
  mapOverlayPadding,
  surfaceColor,
  onExitNavigation,
  navigationMode,
  distanceLabel,
  etaLabel,
  navigationProgressPct,
  navigationCameraMode,
  onNavigationCameraModeChange,
  navigationError,
  activePoiAlert,
  getPoiDisplayName,
  poiCategoryLabels,
  onAddActivePoiAlertWaypoint,
  onDismissPoiAlert,
  isDesktop,
  chromeFooterHeight,
}: MapNavigationOverlayProps) {
  const { t } = useTranslation()

  if (!isNavigationActive || !hasRoute) {
    return null
  }

  return (
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
  )
}

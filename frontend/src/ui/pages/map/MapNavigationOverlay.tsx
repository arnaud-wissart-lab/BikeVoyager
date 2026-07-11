import { Box, Button, Group, Paper, SegmentedControl, Stack, Text } from '@mantine/core'
import { IconMapPinPlus, IconX } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type {
  NavigationCameraMode,
  NavigationGuidance,
  NavigationMode,
  PoiCategory,
  PoiItem,
} from '../../../features/routing/domain'
import { formatRouteStepDistance } from '../../../features/routing/domain'
import type { ScreenWakeLockStatus } from '../../../features/map/useScreenWakeLock'
import type { VoiceGuidanceSupportStatus } from '../../../features/map/useNavigationVoiceGuidance'

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
  navigationGuidance: NavigationGuidance | null
  voiceGuidanceEnabled: boolean
  voiceGuidanceSupportStatus: VoiceGuidanceSupportStatus
  wakeLockStatus: ScreenWakeLockStatus
  navigationCameraMode: NavigationCameraMode
  onNavigationCameraModeChange: (value: string) => void
  navigationError: string | null
  navigationOffRouteAlert: {
    distanceLabel: string
    showRecalculateAction: boolean
    isRecalculateDisabled: boolean
    isRecalculating: boolean
    isDismissDisabled: boolean
    unavailableMessage: string | null
    errorMessage: string | null
  } | null
  navigationRecalculationSuccessMessage: string | null
  onRecalculateFromCurrentPosition: () => void
  onDismissNavigationDeviation: () => void
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
  navigationGuidance,
  voiceGuidanceEnabled,
  voiceGuidanceSupportStatus,
  wakeLockStatus,
  navigationCameraMode,
  onNavigationCameraModeChange,
  navigationError,
  navigationOffRouteAlert,
  navigationRecalculationSuccessMessage,
  onRecalculateFromCurrentPosition,
  onDismissNavigationDeviation,
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

  const maneuverDistanceLabel = formatRouteStepDistance(
    navigationGuidance?.distanceToManeuverMeters,
  )

  return (
    <Box style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Box
        style={{
          position: 'absolute',
          top: mapOverlayPadding,
          bottom: mapOverlayPadding,
          left: mapOverlayPadding,
          right: mapOverlayPadding,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Paper
          withBorder
          radius="md"
          p="sm"
          style={{
            backgroundColor: surfaceColor,
            width: '100%',
            maxWidth: 520,
            maxHeight: '100%',
            overflowY: 'auto',
            pointerEvents: 'auto',
          }}
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
            {navigationGuidance && (
              <Stack gap={2} aria-live="polite" aria-atomic="true">
                <Text size="xs" c="dimmed">
                  {t('navigationInstructionLabel')}
                </Text>
                {!navigationGuidance.isArrival &&
                  navigationGuidance.nextInstruction &&
                  maneuverDistanceLabel && (
                    <Text size="xs" fw={600} data-testid="navigation-distance-to-maneuver">
                      {t('navigationDistanceToManeuver', { distance: maneuverDistanceLabel })}
                    </Text>
                  )}
                <Text fw={700} lineClamp={2} data-testid="navigation-active-instruction">
                  {navigationGuidance.isArrival
                    ? t('navigationArrival')
                    : (navigationGuidance.nextInstruction ?? navigationGuidance.activeInstruction)}
                </Text>
              </Stack>
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
            {navigationOffRouteAlert && (
              <Paper
                withBorder
                radius="md"
                p="xs"
                bg="var(--mantine-color-orange-light)"
                data-testid="navigation-off-route-alert"
                role="status"
                aria-live="polite"
              >
                <Stack gap={6}>
                  <Text size="sm" fw={700} c="orange.8">
                    {t('navigationOffRouteTitle')}
                  </Text>
                  <Text size="xs" data-testid="navigation-off-route-distance">
                    {t('navigationOffRouteDistance', {
                      distance: navigationOffRouteAlert.distanceLabel,
                    })}
                  </Text>
                  {navigationOffRouteAlert.unavailableMessage && (
                    <Text size="xs" c="dimmed">
                      {navigationOffRouteAlert.unavailableMessage}
                    </Text>
                  )}
                  {navigationOffRouteAlert.errorMessage && (
                    <Text size="xs" c="red.7">
                      {navigationOffRouteAlert.errorMessage}
                    </Text>
                  )}
                  <Group gap="xs" grow wrap="wrap" align="stretch">
                    {navigationOffRouteAlert.showRecalculateAction && (
                      <Button
                        size="xs"
                        variant="filled"
                        color="orange"
                        onClick={onRecalculateFromCurrentPosition}
                        disabled={navigationOffRouteAlert.isRecalculateDisabled}
                        data-testid="navigation-recalculate-from-position"
                        style={{ flex: '1 1 210px' }}
                      >
                        {navigationOffRouteAlert.isRecalculating
                          ? t('navigationRecalculating')
                          : t('navigationRecalculateFromPosition')}
                      </Button>
                    )}
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={onDismissNavigationDeviation}
                      disabled={navigationOffRouteAlert.isDismissDisabled}
                      data-testid="navigation-dismiss-off-route"
                      style={{ flex: '1 1 180px' }}
                    >
                      {t('navigationContinueWithoutRecalculation')}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            )}
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
            {wakeLockStatus !== 'idle' && wakeLockStatus !== 'requesting' && (
              <Text size="xs" c="dimmed" data-testid="navigation-wake-lock-status">
                {wakeLockStatus === 'active'
                  ? t('navigationWakeLockActive')
                  : wakeLockStatus === 'unsupported'
                    ? t('navigationWakeLockUnsupported')
                    : t('navigationWakeLockError')}
              </Text>
            )}
            {voiceGuidanceEnabled && voiceGuidanceSupportStatus !== 'unsupported' && (
              <Text size="xs" c="dimmed" data-testid="navigation-voice-status">
                {voiceGuidanceSupportStatus === 'supported'
                  ? t('navigationVoiceActive')
                  : t('navigationVoiceUnavailable')}
              </Text>
            )}
            {navigationError && (
              <Text size="xs" c="red.6">
                {navigationError}
              </Text>
            )}
            {navigationRecalculationSuccessMessage && (
              <Text size="xs" c="teal.7" data-testid="navigation-recalculation-success">
                {navigationRecalculationSuccessMessage}
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

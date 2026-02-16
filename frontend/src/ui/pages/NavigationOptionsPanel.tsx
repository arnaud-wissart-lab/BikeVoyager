import { Checkbox, Group, Paper, SegmentedControl, Slider, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import type { NavigationCameraMode, NavigationMode, PoiCategory } from '../../features/routing/domain'

type PoiCategoryOption = {
  value: string
  label: string
}

type NavigationOptionsPanelProps = {
  isCompact: boolean
  navigationMode: NavigationMode
  navigationCameraMode: NavigationCameraMode
  simulationSpeedKmh: number
  poiAlertEnabled: boolean
  poiAlertCategories: PoiCategory[]
  poiAlertDistanceMeters: number
  systemNotificationsEnabled: boolean
  notificationsSupported: boolean
  notificationsPermission: NotificationPermission
  poiCategoryOptions: PoiCategoryOption[]
  poiAlertDistanceRange: {
    min: number
    max: number
    step: number
  }
  onNavigationModeChange: (value: string) => void
  onNavigationCameraModeChange: (value: string) => void
  onPoiAlertEnabledChange: (checked: boolean) => void
  onPoiAlertCategoryChange: (values: string[]) => void
  onPoiAlertDistanceMetersChange: (value: number) => void
  onSystemNotificationsChange: (checked: boolean) => Promise<void>
}

export default function NavigationOptionsPanel({
  isCompact,
  navigationMode,
  navigationCameraMode,
  simulationSpeedKmh,
  poiAlertEnabled,
  poiAlertCategories,
  poiAlertDistanceMeters,
  systemNotificationsEnabled,
  notificationsSupported,
  notificationsPermission,
  poiCategoryOptions,
  poiAlertDistanceRange,
  onNavigationModeChange,
  onNavigationCameraModeChange,
  onPoiAlertEnabledChange,
  onPoiAlertCategoryChange,
  onPoiAlertDistanceMetersChange,
  onSystemNotificationsChange,
}: NavigationOptionsPanelProps) {
  const { t } = useTranslation()

  return (
    <Paper withBorder radius="md" p={isCompact ? 'xs' : 'sm'}>
      <Stack gap={isCompact ? 8 : 10}>
        <Text size="xs" fw={600}>
          {t('navigationOptionsTitle')}
        </Text>
        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            {t('navigationModeLabel')}
          </Text>
          <SegmentedControl
            size="xs"
            radius="xl"
            value={navigationMode}
            onChange={onNavigationModeChange}
            data={[
              { label: t('navigationModeGps'), value: 'gps' },
              { label: t('navigationModeSimulation'), value: 'simulation' },
            ]}
            fullWidth
          />
        </Stack>
        <Stack gap={4}>
          <Text size="xs" c="dimmed">
            {t('navigationViewTypeLabel')}
          </Text>
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
        </Stack>
        <Text size="xs" c="dimmed">
          {navigationMode === 'simulation'
            ? t('navigationSimulationSpeedLabel', { speed: simulationSpeedKmh })
            : t('navigationGpsHint')}
        </Text>
        <Checkbox
          checked={poiAlertEnabled}
          onChange={(event) => onPoiAlertEnabledChange(event.currentTarget.checked)}
          label={t('poiAlertEnableLabel')}
          size="xs"
        />
        {poiAlertEnabled && (
          <Stack gap={6}>
            <Text size="xs" c="dimmed">
              {t('poiAlertCategoryLabel')}
            </Text>
            <Checkbox.Group
              value={poiAlertCategories}
              onChange={onPoiAlertCategoryChange}
            >
              <Group gap="xs" wrap="wrap">
                {poiCategoryOptions.map((category) => (
                  <Checkbox
                    key={`alert-${category.value}`}
                    value={category.value}
                    label={category.label}
                    size="xs"
                  />
                ))}
              </Group>
            </Checkbox.Group>
            <Text size="xs" c="dimmed">
              {t('poiAlertDistanceLabel', { distance: poiAlertDistanceMeters })}
            </Text>
            <Slider
              min={poiAlertDistanceRange.min}
              max={poiAlertDistanceRange.max}
              step={poiAlertDistanceRange.step}
              value={poiAlertDistanceMeters}
              onChange={onPoiAlertDistanceMetersChange}
              label={(value) => `${value} ${t('unitM')}`}
            />
            <Checkbox
              size="xs"
              checked={systemNotificationsEnabled}
              disabled={!notificationsSupported}
              onChange={(event) => {
                void onSystemNotificationsChange(event.currentTarget.checked)
              }}
              label={t('poiAlertSystemNotifications')}
            />
            {!notificationsSupported && (
              <Text size="xs" c="dimmed">
                {t('poiAlertNotificationsUnsupported')}
              </Text>
            )}
            {notificationsSupported && notificationsPermission === 'denied' && (
              <Text size="xs" c="orange.6">
                {t('poiAlertNotificationsDenied')}
              </Text>
            )}
            {poiAlertCategories.length === 0 && (
              <Text size="xs" c="orange.6">
                {t('poiAlertSelectAtLeastOne')}
              </Text>
            )}
          </Stack>
        )}
        {isCompact && (
          <Text size="xs" c="dimmed">
            {t('navigationOptionsCompactHint')}
          </Text>
        )}
      </Stack>
    </Paper>
  )
}


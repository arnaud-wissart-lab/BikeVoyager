import { Button, Group, Stack, Text } from '@mantine/core'
import {
  IconDeviceFloppy,
  IconDownload,
  IconPlayerPlay,
  IconRefresh,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

type MapSummaryPanelProps = {
  isCompact: boolean
  distanceLabel: string
  etaLabel: string
  overlapLabel: string | null
  overlapHint: string | null
  elevationValueLabel: string
  elevationHint: string | null
  detourSummary: string | null
  hasRoute: boolean
  isRouteLoading: boolean
  alternativeRouteLabel: string
  isExporting: boolean
  exportError: string | null
  routeErrorMessage: string | null
  canSaveCurrentLoop: boolean
  onRecalculateAlternative: () => void
  onOpenNavigationSetup: () => void
  onExportGpx: () => void
  onSaveCurrentLoop: () => void
}

export default function MapSummaryPanel({
  isCompact,
  distanceLabel,
  etaLabel,
  overlapLabel,
  overlapHint,
  elevationValueLabel,
  elevationHint,
  detourSummary,
  hasRoute,
  isRouteLoading,
  alternativeRouteLabel,
  isExporting,
  exportError,
  routeErrorMessage,
  canSaveCurrentLoop,
  onRecalculateAlternative,
  onOpenNavigationSetup,
  onExportGpx,
  onSaveCurrentLoop,
}: MapSummaryPanelProps) {
  const { t } = useTranslation()
  const metricTextSize = isCompact ? 'xs' : 'sm'

  return (
    <Stack gap={isCompact ? 'sm' : 'md'}>
      <Stack gap={6}>
        <Group justify="space-between">
          <Text size={metricTextSize} c="dimmed">
            {t('mapSummaryDistance')}
          </Text>
          <Text size={metricTextSize} fw={600}>
            {distanceLabel}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size={metricTextSize} c="dimmed">
            {t('mapSummaryEta')}
          </Text>
          <Text size={metricTextSize} fw={600}>
            {etaLabel}
          </Text>
        </Group>
        {overlapLabel && (
          <>
            <Group justify="space-between">
              <Text size={metricTextSize} c="dimmed">
                {t('mapSummaryOverlap')}
              </Text>
              <Text size={metricTextSize} fw={600}>
                {overlapLabel}
              </Text>
            </Group>
            {overlapHint && (
              <Text size="xs" c="dimmed">
                {overlapHint}
              </Text>
            )}
          </>
        )}
        <Group justify="space-between">
          <Text size={metricTextSize} c="dimmed">
            {t('mapSummaryElevation')}
          </Text>
          <Text size={metricTextSize} fw={600}>
            {elevationValueLabel}
          </Text>
        </Group>
        {elevationHint && (
          <Text size="xs" c="dimmed">
            {elevationHint}
          </Text>
        )}
        {detourSummary && (
          <Group justify="space-between">
            <Text size={metricTextSize} c="dimmed">
              {t('poiDetourLabel')}
            </Text>
            <Text size={metricTextSize} fw={600}>
              {detourSummary}
            </Text>
          </Group>
        )}
      </Stack>
      <Button
        variant="default"
        onClick={onRecalculateAlternative}
        fullWidth={isCompact}
        disabled={!hasRoute || isRouteLoading}
        leftSection={<IconRefresh size={16} />}
      >
        {alternativeRouteLabel}
      </Button>
      <Button
        onClick={onOpenNavigationSetup}
        fullWidth={isCompact}
        disabled={!hasRoute || isRouteLoading}
        data-testid="nav-setup-open"
        leftSection={<IconPlayerPlay size={16} />}
      >
        {t('navigationSetupOpen')}
      </Button>
      <Button
        variant="light"
        onClick={onExportGpx}
        fullWidth={isCompact}
        disabled={!hasRoute || isRouteLoading || isExporting}
        loading={isExporting}
        leftSection={<IconDownload size={16} />}
      >
        {t('mapExportGpx')}
      </Button>
      {canSaveCurrentLoop && (
        <Button
          variant="outline"
          onClick={onSaveCurrentLoop}
          fullWidth={isCompact}
          disabled={!hasRoute || isRouteLoading}
          leftSection={<IconDeviceFloppy size={16} />}
        >
          {t('dataSaveLoop')}
        </Button>
      )}
      {exportError && (
        <Text size="xs" c="red.6">
          {exportError}
        </Text>
      )}
      {routeErrorMessage && (
        <Text size="xs" c="red.6">
          {routeErrorMessage}
        </Text>
      )}
    </Stack>
  )
}

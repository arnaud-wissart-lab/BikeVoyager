import { Button, Group, Stack, Text } from '@mantine/core'
import { IconDeviceFloppy, IconDownload, IconPlayerPlay, IconRefresh } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { RouteElevationPoint } from '../../features/routing/domain'
import ElevationProfileChart from './ElevationProfileChart'

type MapSummaryPanelProps = {
  isCompact: boolean
  distanceLabel: string
  etaLabel: string
  overlapLabel: string | null
  overlapHint: string | null
  elevationGainLabel: string
  elevationLossLabel: string
  elevationRangeLabel: string
  maxSlopeLabel: string | null
  routeDifficultyLabel: string | null
  routeDifficultyHint: string | null
  elevationHint: string | null
  elevationProfile: RouteElevationPoint[] | null
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
  elevationGainLabel,
  elevationLossLabel,
  elevationRangeLabel,
  maxSlopeLabel,
  routeDifficultyLabel,
  routeDifficultyHint,
  elevationHint,
  elevationProfile,
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
  const renderMetricRow = (label: string, value: string) => (
    <Group justify="space-between" align="baseline" gap="sm" wrap="nowrap">
      <Text size={metricTextSize} c="dimmed" style={{ minWidth: 0, flex: 1 }}>
        {label}
      </Text>
      <Text size={metricTextSize} fw={600} ta="right" style={{ flexShrink: 0 }}>
        {value}
      </Text>
    </Group>
  )

  return (
    <Stack gap={isCompact ? 'sm' : 'md'}>
      <Stack gap={6}>
        {renderMetricRow(t('mapSummaryDistance'), distanceLabel)}
        {renderMetricRow(t('mapSummaryEta'), etaLabel)}
        {overlapLabel && (
          <>
            {renderMetricRow(t('mapSummaryOverlap'), overlapLabel)}
            {overlapHint && (
              <Text size="xs" c="dimmed">
                {overlapHint}
              </Text>
            )}
          </>
        )}
        {elevationHint ? (
          <Text size="xs" c="dimmed">
            {elevationHint}
          </Text>
        ) : (
          <>
            {renderMetricRow(t('mapSummaryElevationGain'), elevationGainLabel)}
            {renderMetricRow(t('mapSummaryElevationLoss'), elevationLossLabel)}
            {renderMetricRow(t('mapSummaryAltitudeRange'), elevationRangeLabel)}
            {maxSlopeLabel && renderMetricRow(t('mapSummaryMaxSlope'), maxSlopeLabel)}
            {routeDifficultyLabel &&
              renderMetricRow(t('mapSummaryDifficulty'), routeDifficultyLabel)}
            {routeDifficultyHint && (
              <Text size="xs" c="dimmed">
                {routeDifficultyHint}
              </Text>
            )}
            <ElevationProfileChart profile={elevationProfile} isCompact={isCompact} />
          </>
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

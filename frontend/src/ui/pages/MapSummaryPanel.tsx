import { Box, Button, Group, Stack, Text } from '@mantine/core'
import {
  IconChevronDown,
  IconChevronUp,
  IconDeviceFloppy,
  IconDownload,
  IconPlayerPlay,
  IconRefresh,
} from '@tabler/icons-react'
import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  normalizeRouteSteps,
  type RouteElevationPoint,
  type TripResult,
} from '../../features/routing/domain'
import ElevationProfileChart from './ElevationProfileChart'

type MapSummaryPanelProps = {
  isCompact: boolean
  routeResult: TripResult | null
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
  alternativeUnavailableLabel: string
  isAlternativeUnavailable: boolean
  isExporting: boolean
  exportError: string | null
  routeErrorMessage: string | null
  onRecalculateAlternative: () => void
  onOpenNavigationSetup: () => void
  onExportGpx: () => void
  onOpenSaveTripDialog: () => void
}

export default function MapSummaryPanel({
  isCompact,
  routeResult,
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
  alternativeUnavailableLabel,
  isAlternativeUnavailable,
  isExporting,
  exportError,
  routeErrorMessage,
  onRecalculateAlternative,
  onOpenNavigationSetup,
  onExportGpx,
  onOpenSaveTripDialog,
}: MapSummaryPanelProps) {
  const { t } = useTranslation()
  const roadbookPanelId = useId()
  const [isRoadbookOpen, setIsRoadbookOpen] = useState(false)
  const roadbookSteps = useMemo(
    () => (routeResult?.kind === 'route' ? normalizeRouteSteps(routeResult.turn_by_turn) : []),
    [routeResult],
  )
  const metricTextSize = isCompact ? 'xs' : 'sm'
  const hasRouteInstructions =
    routeResult?.kind === 'route' &&
    Array.isArray(routeResult.turn_by_turn) &&
    routeResult.turn_by_turn.length > 0
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
      {hasRouteInstructions && (
        <Box>
          <Button
            variant="subtle"
            color="gray"
            size={isCompact ? 'xs' : 'sm'}
            fullWidth
            justify="space-between"
            onClick={() => setIsRoadbookOpen((current) => !current)}
            aria-expanded={isRoadbookOpen}
            aria-controls={roadbookPanelId}
            rightSection={
              isRoadbookOpen ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />
            }
          >
            {t('roadbookTitle')}
          </Button>
          {isRoadbookOpen && (
            <Stack id={roadbookPanelId} gap={isCompact ? 6 : 8} pt={isCompact ? 6 : 8}>
              <Text size="xs" fw={600}>
                {t('roadbookStepsTitle')}
              </Text>
              {roadbookSteps.length > 0 ? (
                <Box
                  data-testid="roadbook-steps-scroll"
                  style={{
                    maxHeight: isCompact ? 220 : 'min(32dvh, 280px)',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    paddingRight: 4,
                  }}
                >
                  <Box
                    component="ol"
                    aria-label={t('roadbookStepsTitle')}
                    style={{
                      margin: 0,
                      paddingLeft: isCompact ? 18 : 20,
                      display: 'grid',
                      gap: isCompact ? 6 : 8,
                    }}
                  >
                    {roadbookSteps.map((step, index) => {
                      const distanceLabel = step.distanceLabel ?? t('placeholderValue')
                      const durationLabel = step.durationLabel ?? t('placeholderValue')

                      return (
                        <Box component="li" key={`${index}-${step.instruction ?? 'step'}`}>
                          <Stack gap={2}>
                            <Text size={metricTextSize} fw={500}>
                              {step.instruction ?? t('roadbookStepFallback', { index: index + 1 })}
                            </Text>
                            <Text size="xs" c="dimmed">
                              <Box
                                component="span"
                                aria-label={`${t('roadbookDistanceLabel')}: ${distanceLabel}`}
                              >
                                {distanceLabel}
                              </Box>
                              {' · '}
                              <Box
                                component="span"
                                aria-label={`${t('roadbookDurationLabel')}: ${durationLabel}`}
                              >
                                {durationLabel}
                              </Box>
                            </Text>
                          </Stack>
                        </Box>
                      )
                    })}
                  </Box>
                </Box>
              ) : (
                <Text size="xs" c="dimmed">
                  {t('roadbookEmpty')}
                </Text>
              )}
            </Stack>
          )}
        </Box>
      )}
      {routeResult?.kind === 'loop' && (
        <Text size="xs" c="dimmed">
          {t('roadbookLoopUnavailable')}
        </Text>
      )}
      {isAlternativeUnavailable ? (
        <Text size="xs" c="dimmed" role="status" data-testid="route-alternative-unavailable">
          {alternativeUnavailableLabel}
        </Text>
      ) : (
        <Button
          variant="default"
          onClick={onRecalculateAlternative}
          fullWidth={isCompact}
          disabled={!hasRoute || isRouteLoading}
          leftSection={<IconRefresh size={16} />}
        >
          {alternativeRouteLabel}
        </Button>
      )}
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
      <Button
        variant="outline"
        onClick={onOpenSaveTripDialog}
        fullWidth={isCompact}
        disabled={!hasRoute || isRouteLoading}
        leftSection={<IconDeviceFloppy size={16} />}
      >
        {t('dataSaveTrip')}
      </Button>
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

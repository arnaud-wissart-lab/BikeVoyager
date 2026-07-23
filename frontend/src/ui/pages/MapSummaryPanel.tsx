import { ActionIcon, Box, Button, Group, Menu, Stack, Text, Tooltip } from '@mantine/core'
import {
  IconChevronDown,
  IconChevronUp,
  IconDeviceFloppy,
  IconDownload,
  IconGps,
  IconRouteAltLeft,
  IconUser,
} from '@tabler/icons-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  normalizeRouteSteps,
  type RouteElevationPoint,
  type RouteExportFormat,
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
  isAlternativeLoading: boolean
  alternativeCount: number
  isAlternativeComparisonActive: boolean
  isExporting: boolean
  exportError: string | null
  routeErrorMessage: string | null
  activeProfileLabel: string
  onOpenAlternativeComparison: () => void
  onOpenProfiles: () => void
  onOpenNavigationSetup: () => void
  onExportRoute: (format: RouteExportFormat) => void
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
  isAlternativeLoading,
  alternativeCount,
  isAlternativeComparisonActive,
  isExporting,
  exportError,
  routeErrorMessage,
  activeProfileLabel,
  onOpenAlternativeComparison,
  onOpenProfiles,
  onOpenNavigationSetup,
  onExportRoute,
  onOpenSaveTripDialog,
}: MapSummaryPanelProps) {
  const { t } = useTranslation()
  const roadbookPanelId = useId()
  const [isRoadbookOpen, setIsRoadbookOpen] = useState(false)
  const [isAlternativeHintOpen, setIsAlternativeHintOpen] = useState(false)
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const alternativeHintTimeoutRef = useRef<number | null>(null)
  const roadbookSteps = useMemo(
    () => (routeResult?.kind === 'route' ? normalizeRouteSteps(routeResult.turn_by_turn) : []),
    [routeResult],
  )
  const metricTextSize = isCompact ? 'xs' : 'sm'
  const actionIconSize = isCompact ? 30 : 36
  const hasRouteInstructions =
    routeResult?.kind === 'route' &&
    Array.isArray(routeResult.turn_by_turn) &&
    routeResult.turn_by_turn.length > 0
  const isAlternativeActionPending = isRouteLoading || isAlternativeLoading
  const isAlternativeActionDisabled =
    !hasRoute || isAlternativeActionPending || alternativeCount === 0
  const alternativeActionLabel = isAlternativeActionPending
    ? t('routeAlternativesLoading')
    : alternativeCount > 0
      ? t('routeAlternativesButton', { count: alternativeCount })
      : t('routeAlternativesUnavailable')

  const clearAlternativeHintTimeout = () => {
    if (alternativeHintTimeoutRef.current !== null) {
      window.clearTimeout(alternativeHintTimeoutRef.current)
      alternativeHintTimeoutRef.current = null
    }
  }

  const hideAlternativeHint = () => {
    clearAlternativeHintTimeout()
    setIsAlternativeHintOpen(false)
  }

  const showAlternativeHint = (autoClose: boolean) => {
    if (!isAlternativeActionDisabled) {
      return
    }

    clearAlternativeHintTimeout()
    setIsAlternativeHintOpen(true)
    if (autoClose) {
      alternativeHintTimeoutRef.current = window.setTimeout(() => {
        setIsAlternativeHintOpen(false)
        alternativeHintTimeoutRef.current = null
      }, 3500)
    }
  }

  useEffect(
    () => () => {
      if (alternativeHintTimeoutRef.current !== null) {
        window.clearTimeout(alternativeHintTimeoutRef.current)
      }
    },
    [],
  )

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
        <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
          <Text size={metricTextSize} c="dimmed">
            {t('mapSummaryProfile')}
          </Text>
          <Tooltip label={t('mapActiveProfileAction', { name: activeProfileLabel })}>
            <Button
              variant="subtle"
              color="violet"
              size="compact-xs"
              leftSection={<IconUser size={15} />}
              onClick={onOpenProfiles}
              aria-label={t('mapActiveProfileAction', { name: activeProfileLabel })}
              styles={{
                root: {
                  minWidth: 0,
                  maxWidth: '70%',
                },
                label: {
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              {activeProfileLabel}
            </Button>
          </Tooltip>
        </Group>
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
      <Group
        justify="space-between"
        gap="md"
        wrap="nowrap"
        w="100%"
        aria-label={t('mapRouteActions')}
      >
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Tooltip
            label={alternativeActionLabel}
            opened={isAlternativeActionDisabled && isAlternativeHintOpen}
            disabled={!isAlternativeActionDisabled}
            events={{ hover: false, focus: false, touch: false }}
            withArrow
            multiline
          >
            <Button
              variant="default"
              size={isCompact ? 'xs' : 'sm'}
              onClick={(event) => {
                if (isAlternativeActionDisabled) {
                  event.preventDefault()
                  showAlternativeHint(true)
                  return
                }

                onOpenAlternativeComparison()
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') {
                  showAlternativeHint(false)
                }
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') {
                  hideAlternativeHint()
                }
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== 'mouse') {
                  showAlternativeHint(true)
                }
              }}
              onKeyDown={(event) => {
                if (isAlternativeActionDisabled && (event.key === 'Enter' || event.key === ' ')) {
                  showAlternativeHint(true)
                }
              }}
              data-unavailable={isAlternativeActionDisabled || undefined}
              aria-busy={isAlternativeActionPending}
              leftSection={<IconRouteAltLeft size={16} />}
              aria-label={alternativeActionLabel}
              style={{
                flex: '0 0 auto',
                minWidth: isCompact ? 54 : 60,
                opacity: isAlternativeActionDisabled ? 0.55 : 1,
                cursor: isAlternativeActionDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {alternativeCount}
            </Button>
          </Tooltip>
        </Group>
        <Group gap="xs" wrap="nowrap" ml="auto">
          <Tooltip label={t('navigationSetupOpen')}>
            <ActionIcon
              variant="light"
              color="blue"
              size={actionIconSize}
              onClick={onOpenNavigationSetup}
              disabled={!hasRoute || isRouteLoading}
              data-testid="nav-setup-open"
              aria-label={t('navigationSetupOpen')}
            >
              <IconGps size={18} />
            </ActionIcon>
          </Tooltip>
          <Menu
            position="bottom-end"
            width={260}
            withinPortal
            opened={isExportMenuOpen}
            onChange={setIsExportMenuOpen}
          >
            <Menu.Target>
              <Tooltip
                label={t(
                  isAlternativeComparisonActive ? 'mapExportCurrentRoute' : 'mapExportRoute',
                )}
                disabled={isExportMenuOpen}
              >
                <ActionIcon
                  variant="light"
                  color="cyan"
                  size={actionIconSize}
                  disabled={!hasRoute || isRouteLoading || isExporting}
                  loading={isExporting}
                  aria-label={t(
                    isAlternativeComparisonActive ? 'mapExportCurrentRoute' : 'mapExportRoute',
                  )}
                >
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{t('routeExportFormatLabel')}</Menu.Label>
              <Menu.Item onClick={() => onExportRoute('gpx')}>
                <Text size="sm" fw={600}>
                  GPX
                </Text>
                <Text size="xs" c="dimmed">
                  {t('routeExportGpxDescription')}
                </Text>
              </Menu.Item>
              <Menu.Item onClick={() => onExportRoute('tcx')}>
                <Text size="sm" fw={600}>
                  TCX
                </Text>
                <Text size="xs" c="dimmed">
                  {t('routeExportTcxDescription')}
                </Text>
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Tooltip
            label={t(isAlternativeComparisonActive ? 'dataSaveCurrentTrip' : 'dataSaveTrip')}
          >
            <ActionIcon
              variant="light"
              color="teal"
              size={actionIconSize}
              onClick={onOpenSaveTripDialog}
              disabled={!hasRoute || isRouteLoading}
              aria-label={t(isAlternativeComparisonActive ? 'dataSaveCurrentTrip' : 'dataSaveTrip')}
            >
              <IconDeviceFloppy size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
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

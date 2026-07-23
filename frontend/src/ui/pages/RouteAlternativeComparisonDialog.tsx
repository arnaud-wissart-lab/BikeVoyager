import {
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { IconCheck, IconRouteAltLeft, IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  RouteAlternativeOption,
  RouteComparisonDelta,
  RouteComparisonMetrics,
  RouteDifficulty,
} from '../../features/routing/domain'
import { alternativeRouteColor, currentRouteColor } from '../../features/routing/routePresentation'

type RouteAlternativeComparisonDialogProps = {
  opened: boolean
  isCompact: boolean
  alternatives: RouteAlternativeOption[]
  selectedAlternativeId: string | null
  onSelectAlternative: (alternativeId: string) => void
  onApplyAlternative: (alternativeId: string) => void
  onClose: () => void
}

type MetricRow = {
  key: keyof RouteComparisonMetrics
  labelKey: string
  format: (value: RouteComparisonMetrics[keyof RouteComparisonMetrics]) => string | null
  deltaKey?: keyof RouteComparisonDelta
}

const difficultyTranslationKeys: Record<RouteDifficulty, string> = {
  easy: 'routeDifficultyEasy',
  moderate: 'routeDifficultyModerate',
  demanding: 'routeDifficultyDemanding',
  hard: 'routeDifficultyHard',
}

export default function RouteAlternativeComparisonDialog({
  opened,
  isCompact,
  alternatives,
  selectedAlternativeId,
  onSelectAlternative,
  onApplyAlternative,
  onClose,
}: RouteAlternativeComparisonDialogProps) {
  const { t } = useTranslation()
  const [localSelectedAlternativeId, setLocalSelectedAlternativeId] = useState<string | null>(null)
  const placeholder = t('placeholderValue')
  const currentMetrics = alternatives[0]?.comparison.current ?? null

  useEffect(() => {
    if (!opened) {
      return
    }

    const nextSelectedId = alternatives.some(
      (alternative) => alternative.id === selectedAlternativeId,
    )
      ? selectedAlternativeId
      : (alternatives[0]?.id ?? null)
    setLocalSelectedAlternativeId(nextSelectedId)
  }, [alternatives, opened, selectedAlternativeId])

  const orderedAlternatives = [...alternatives].sort(
    (first, second) => second.assessment.relevanceScore - first.assessment.relevanceScore,
  )

  const formatDistance = (distanceMeters: number | null) => {
    if (distanceMeters === null || !Number.isFinite(distanceMeters)) {
      return placeholder
    }

    if (Math.abs(distanceMeters) < 1000) {
      return `${Math.round(distanceMeters)} ${t('unitM')}`
    }

    return `${(distanceMeters / 1000).toFixed(1)} ${t('unitKm')}`
  }

  const formatDuration = (seconds: number | null) => {
    if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
      return placeholder
    }

    const totalMinutes = Math.round(seconds / 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    if (hours <= 0) {
      return `${minutes} ${t('unitMin')}`
    }
    if (minutes === 0) {
      return `${hours} ${t('unitHour')}`
    }

    return `${hours} ${t('unitHour')} ${minutes} ${t('unitMin')}`
  }

  const formatElevation = (meters: number | null) =>
    meters !== null && Number.isFinite(meters) ? `${Math.round(meters)} ${t('unitM')}` : placeholder

  const formatSlope = (value: number | null) =>
    value !== null && Number.isFinite(value) ? `${Number(value.toFixed(1))} %` : placeholder

  const formatAltitudeRange = (value: RouteComparisonMetrics['elevationMinMax']) =>
    value ? `${Math.round(value.min)} ${t('unitM')} - ${Math.round(value.max)} ${t('unitM')}` : null

  const formatDifficulty = (value: RouteComparisonMetrics['difficulty']) =>
    value ? t(difficultyTranslationKeys[value]) : placeholder

  const formatDelta = (
    delta: number | boolean | null,
    formatter: (value: number | null) => string,
    minimumMagnitude: number,
  ) => {
    if (delta === null || typeof delta === 'boolean' || !Number.isFinite(delta)) {
      return null
    }
    if (Math.abs(delta) < minimumMagnitude) {
      return null
    }
    if (delta === 0) {
      return formatter(0)
    }

    return `${delta > 0 ? '+' : '-'}${formatter(Math.abs(delta))}`
  }

  const metricRows: MetricRow[] = [
    {
      key: 'distanceMeters',
      labelKey: 'routeComparisonDistance',
      format: (value) => formatDistance(value as number | null),
      deltaKey: 'distanceMeters',
    },
    {
      key: 'durationSeconds',
      labelKey: 'routeComparisonDuration',
      format: (value) => formatDuration(value as number | null),
      deltaKey: 'durationSeconds',
    },
    {
      key: 'elevationGainMeters',
      labelKey: 'routeComparisonElevationGain',
      format: (value) => formatElevation(value as number | null),
      deltaKey: 'elevationGainMeters',
    },
    {
      key: 'elevationLossMeters',
      labelKey: 'routeComparisonElevationLoss',
      format: (value) => formatElevation(value as number | null),
      deltaKey: 'elevationLossMeters',
    },
    {
      key: 'elevationMinMax',
      labelKey: 'mapSummaryAltitudeRange',
      format: (value) => formatAltitudeRange(value as RouteComparisonMetrics['elevationMinMax']),
    },
    {
      key: 'maxSlopePercent',
      labelKey: 'routeComparisonMaxSlope',
      format: (value) => formatSlope(value as number | null),
    },
    {
      key: 'difficulty',
      labelKey: 'routeComparisonDifficulty',
      format: (value) => formatDifficulty(value as RouteComparisonMetrics['difficulty']),
      deltaKey: 'difficultyChanged',
    },
  ]

  const getDeltaLabel = (alternative: RouteAlternativeOption, row: MetricRow) => {
    if (!row.deltaKey) {
      return null
    }
    if (row.deltaKey === 'difficultyChanged') {
      return alternative.comparison.delta.difficultyChanged
        ? t('routeComparisonDifficultyChanged')
        : null
    }

    const formatter =
      row.deltaKey === 'durationSeconds'
        ? formatDuration
        : row.deltaKey === 'distanceMeters'
          ? formatDistance
          : formatElevation
    const minimumMagnitude = row.deltaKey === 'durationSeconds' ? 30 : 1
    return formatDelta(alternative.comparison.delta[row.deltaKey], formatter, minimumMagnitude)
  }

  const routeMetricEntries = [
    ...(currentMetrics
      ? [
          {
            id: 'current',
            distance: currentMetrics.distanceMeters,
            elevation: currentMetrics.elevationGainMeters,
          },
        ]
      : []),
    ...alternatives.map((alternative) => ({
      id: alternative.id,
      distance: alternative.comparison.alternative.distanceMeters,
      elevation: alternative.comparison.alternative.elevationGainMeters,
    })),
  ]
  const distanceEntries = routeMetricEntries.filter(
    (entry): entry is typeof entry & { distance: number } => entry.distance !== null,
  )
  const elevationEntries = routeMetricEntries.filter(
    (entry): entry is typeof entry & { elevation: number } => entry.elevation !== null,
  )
  const distanceValues = distanceEntries.map((entry) => entry.distance)
  const elevationValues = elevationEntries.map((entry) => entry.elevation)
  const shortestRouteId =
    distanceValues.length > 1 && Math.max(...distanceValues) - Math.min(...distanceValues) >= 10
      ? distanceEntries.reduce((best, entry) => (entry.distance < best.distance ? entry : best)).id
      : null
  const flattestRouteId =
    elevationValues.length > 1 && Math.max(...elevationValues) - Math.min(...elevationValues) >= 10
      ? elevationEntries.reduce((best, entry) => (entry.elevation < best.elevation ? entry : best))
          .id
      : null
  const hilliestRouteId =
    elevationValues.length > 1 && Math.max(...elevationValues) - Math.min(...elevationValues) >= 10
      ? elevationEntries.reduce((best, entry) => (entry.elevation > best.elevation ? entry : best))
          .id
      : null

  const renderRouteBadges = (routeId: string) => (
    <Group gap={4} wrap="wrap">
      {routeId === shortestRouteId && (
        <Badge size="xs" variant="light" color="teal">
          {t('routeComparisonShortest')}
        </Badge>
      )}
      {routeId === flattestRouteId && (
        <Badge size="xs" variant="light" color="cyan">
          {t('routeComparisonFlattest')}
        </Badge>
      )}
      {routeId === hilliestRouteId && (
        <Badge size="xs" variant="light" color="pink">
          {t('routeComparisonHilliest')}
        </Badge>
      )}
    </Group>
  )

  const renderRouteHeader = (
    routeId: string,
    label: string,
    color: string,
    isAlternative: boolean,
  ) => {
    const content = (
      <Stack gap={4}>
        <Group gap={6} wrap="nowrap">
          <Box
            aria-hidden
            style={{
              width: 24,
              height: isAlternative ? 0 : 4,
              borderTop: isAlternative ? `4px dashed ${color}` : undefined,
              borderRadius: isAlternative ? 0 : 2,
              backgroundColor: isAlternative ? undefined : color,
              flexShrink: 0,
            }}
          />
          <Text component="span" size="sm" fw={600}>
            {label}
          </Text>
          {isAlternative && routeId === localSelectedAlternativeId && (
            <IconCheck size={15} color="var(--mantine-color-grape-6)" aria-hidden />
          )}
        </Group>
        {renderRouteBadges(routeId)}
      </Stack>
    )

    if (!isAlternative) {
      return content
    }

    return (
      <UnstyledButton
        aria-pressed={routeId === localSelectedAlternativeId}
        aria-label={label}
        onClick={() => {
          setLocalSelectedAlternativeId(routeId)
          onSelectAlternative(routeId)
        }}
        style={{ display: 'block', width: '100%' }}
      >
        {content}
      </UnstyledButton>
    )
  }

  const content = (
    <Stack
      gap="md"
      style={{
        width: isCompact ? 'calc(100dvw - 32px)' : '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      {orderedAlternatives.length > 0 && (
        <>
          <Table.ScrollContainer minWidth={260 + orderedAlternatives.length * 150}>
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('routeComparisonMetric')}</Table.Th>
                  <Table.Th>
                    {renderRouteHeader(
                      'current',
                      t('routeComparisonCurrent'),
                      currentRouteColor,
                      false,
                    )}
                  </Table.Th>
                  {orderedAlternatives.map((alternative, index) => (
                    <Table.Th
                      key={alternative.id}
                      bg={
                        alternative.id === localSelectedAlternativeId
                          ? 'var(--mantine-color-grape-light)'
                          : undefined
                      }
                    >
                      {renderRouteHeader(
                        alternative.id,
                        t('routeComparisonAlternativeNumber', { number: index + 1 }),
                        alternativeRouteColor,
                        true,
                      )}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {t('routeComparisonDistinctPart')}
                    </Text>
                  </Table.Td>
                  <Table.Td>{t('routeComparisonReference')}</Table.Td>
                  {orderedAlternatives.map((alternative) => (
                    <Table.Td
                      key={alternative.id}
                      bg={
                        alternative.id === localSelectedAlternativeId
                          ? 'var(--mantine-color-grape-light)'
                          : undefined
                      }
                    >
                      <Text size="sm" fw={600}>
                        {Math.round(alternative.assessment.distinctRatio * 100)} %
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatDistance(alternative.assessment.distinctDistanceMeters)}
                      </Text>
                    </Table.Td>
                  ))}
                </Table.Tr>
                {metricRows.map((row) => (
                  <Table.Tr key={row.key}>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {t(row.labelKey)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {currentMetrics
                        ? (row.format(currentMetrics[row.key]) ?? placeholder)
                        : placeholder}
                    </Table.Td>
                    {orderedAlternatives.map((alternative) => {
                      const deltaLabel = getDeltaLabel(alternative, row)
                      return (
                        <Table.Td
                          key={alternative.id}
                          bg={
                            alternative.id === localSelectedAlternativeId
                              ? 'var(--mantine-color-grape-light)'
                              : undefined
                          }
                        >
                          <Text size="sm">
                            {row.format(alternative.comparison.alternative[row.key]) ?? placeholder}
                          </Text>
                          {deltaLabel && (
                            <Text size="xs" c="dimmed">
                              {deltaLabel}
                            </Text>
                          )}
                        </Table.Td>
                      )
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </>
      )}

      <Group
        justify="flex-end"
        gap="xs"
        wrap="wrap"
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 1,
          paddingTop: 8,
          background: 'var(--mantine-color-body)',
        }}
      >
        <Button variant="default" onClick={onClose} leftSection={<IconX size={16} />}>
          {t('routeComparisonClose')}
        </Button>
        <Button
          onClick={() => {
            if (localSelectedAlternativeId) {
              onApplyAlternative(localSelectedAlternativeId)
            }
          }}
          disabled={!localSelectedAlternativeId}
          leftSection={<IconCheck size={16} />}
        >
          {t('routeComparisonApply')}
        </Button>
      </Group>
    </Stack>
  )

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconRouteAltLeft size={18} />
          <Text fw={600}>{t('routeComparisonTitle')}</Text>
        </Group>
      }
      position={isCompact ? 'bottom' : 'right'}
      size={isCompact ? '82%' : 'min(52rem, 58vw)'}
      withOverlay={false}
      closeOnClickOutside
      trapFocus={false}
      lockScroll={false}
      data-testid="route-comparison-panel"
    >
      <ScrollArea.Autosize
        mah={isCompact ? 'calc(82dvh - 5rem)' : 'calc(100dvh - 5rem)'}
        offsetScrollbars
      >
        {content}
      </ScrollArea.Autosize>
    </Drawer>
  )
}

import {
  Alert,
  Badge,
  Box,
  Button,
  Drawer,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { IconCheck, IconRefresh, IconRouteAltLeft, IconX } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type {
  RouteComparisonDelta,
  RouteComparisonMetrics,
  RouteComparisonSummary,
  RouteDifficulty,
} from '../../features/routing/domain'

type RouteAlternativeComparisonDialogProps = {
  opened: boolean
  isCompact: boolean
  isLoading: boolean
  comparison: RouteComparisonSummary | null
  routeErrorMessage: string | null
  onApplyAlternative: () => void
  onKeepCurrentRoute: () => void
  onRecalculateAlternative: () => void
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

const currentRouteColor = '#2b8a3e'
const alternativeRouteColor = '#1971c2'

export default function RouteAlternativeComparisonDialog({
  opened,
  isCompact,
  isLoading,
  comparison,
  routeErrorMessage,
  onApplyAlternative,
  onKeepCurrentRoute,
  onRecalculateAlternative,
  onClose,
}: RouteAlternativeComparisonDialogProps) {
  const { t } = useTranslation()
  const placeholder = t('placeholderValue')

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
  ) => {
    if (delta === null || typeof delta === 'boolean' || !Number.isFinite(delta)) {
      return placeholder
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

  const renderDeltaCell = (row: MetricRow) => {
    if (!comparison || !row.deltaKey) {
      return placeholder
    }

    if (row.deltaKey === 'difficultyChanged') {
      return comparison.delta.difficultyChanged
        ? t('routeComparisonDifficultyChanged')
        : placeholder
    }

    const delta = comparison.delta[row.deltaKey]
    const formatter =
      row.deltaKey === 'durationSeconds'
        ? formatDuration
        : row.deltaKey === 'distanceMeters'
          ? formatDistance
          : formatElevation

    return formatDelta(delta, formatter)
  }

  const insightLabels = comparison
    ? [
        comparison.delta.distanceMeters !== null && comparison.delta.distanceMeters < 0
          ? t('routeComparisonShorter')
          : null,
        comparison.delta.distanceMeters !== null && comparison.delta.distanceMeters > 0
          ? t('routeComparisonLonger')
          : null,
        comparison.delta.elevationGainMeters !== null && comparison.delta.elevationGainMeters < 0
          ? t('routeComparisonClimbsLess')
          : null,
        comparison.delta.elevationGainMeters !== null && comparison.delta.elevationGainMeters > 0
          ? t('routeComparisonClimbsMore')
          : null,
      ].filter((label): label is string => Boolean(label))
    : []

  const renderRouteHeader = (label: string, color: string) => (
    <Group gap={6} wrap="nowrap">
      <Box
        aria-hidden
        style={{
          width: 20,
          height: 4,
          borderRadius: 2,
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      <Text component="span" size="sm" fw={600}>
        {label}
      </Text>
    </Group>
  )

  const content = (
    <Stack gap="md">
      {isLoading && (
        <Alert color="blue" variant="light" icon={<IconRefresh size={16} />}>
          {t('routeComparisonLoading')}
        </Alert>
      )}

      {!isLoading && !comparison && (
        <Alert color="orange" variant="light" icon={<IconRouteAltLeft size={16} />}>
          <Stack gap={4}>
            <Text size="sm" fw={600}>
              {t('routeComparisonUnavailable')}
            </Text>
            {routeErrorMessage && <Text size="sm">{routeErrorMessage}</Text>}
          </Stack>
        </Alert>
      )}

      {comparison && (
        <>
          {insightLabels.length > 0 && (
            <Group gap="xs">
              {insightLabels.map((label) => (
                <Badge key={label} variant="light" color="blue">
                  {label}
                </Badge>
              ))}
            </Group>
          )}

          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('routeComparisonMetric')}</Table.Th>
                <Table.Th>
                  {renderRouteHeader(t('routeComparisonCurrent'), currentRouteColor)}
                </Table.Th>
                <Table.Th>
                  {renderRouteHeader(t('routeComparisonAlternative'), alternativeRouteColor)}
                </Table.Th>
                <Table.Th>{t('routeComparisonDelta')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {metricRows.map((row) => (
                <Table.Tr key={row.key}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {t(row.labelKey)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{row.format(comparison.current[row.key]) ?? placeholder}</Table.Td>
                  <Table.Td>{row.format(comparison.alternative[row.key]) ?? placeholder}</Table.Td>
                  <Table.Td>{renderDeltaCell(row)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}

      <Group justify="flex-end" gap="xs">
        <Button
          variant="default"
          onClick={onClose}
          disabled={isLoading}
          leftSection={<IconX size={16} />}
        >
          {t('routeComparisonClose')}
        </Button>
        <Button variant="light" onClick={onKeepCurrentRoute} disabled={isLoading}>
          {t('routeComparisonKeepCurrent')}
        </Button>
        <Button
          variant="light"
          onClick={onRecalculateAlternative}
          loading={isLoading}
          leftSection={<IconRefresh size={16} />}
        >
          {t('routeComparisonRecalculate')}
        </Button>
        <Button
          onClick={onApplyAlternative}
          disabled={!comparison || isLoading}
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
      title={t('routeComparisonTitle')}
      position={isCompact ? 'bottom' : 'right'}
      size={isCompact ? '78%' : 'min(42rem, 48vw)'}
      withOverlay={false}
      closeOnClickOutside={false}
      trapFocus={false}
      lockScroll={false}
      data-testid="route-comparison-panel"
    >
      <ScrollArea.Autosize
        mah={isCompact ? 'calc(78dvh - 5rem)' : 'calc(100dvh - 5rem)'}
        offsetScrollbars
      >
        {content}
      </ScrollArea.Autosize>
    </Drawer>
  )
}

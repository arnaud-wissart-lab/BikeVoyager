import { Box, Group, Text, useMantineTheme } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import {
  computeElevationMinMax,
  normalizeElevationProfile,
  type RouteElevationPoint,
} from '../../features/routing/domain'

type ElevationProfileChartProps = {
  profile: RouteElevationPoint[] | null
  isCompact: boolean
}

const chartWidth = 320
const chartHeight = 96
const chartPadding = {
  top: 8,
  right: 6,
  bottom: 18,
  left: 6,
}

const formatMeters = (value: number, unit: string) => `${Math.round(value)} ${unit}`

const buildChartPoint = (
  point: RouteElevationPoint,
  firstDistance: number,
  totalDistance: number,
  minElevation: number,
  elevationSpan: number,
) => {
  const x =
    chartPadding.left +
    ((point.distance_m - firstDistance) / totalDistance) *
      (chartWidth - chartPadding.left - chartPadding.right)
  const y =
    chartHeight -
    chartPadding.bottom -
    (elevationSpan === 0 ? 0.5 : (point.elevation_m - minElevation) / elevationSpan) *
      (chartHeight - chartPadding.top - chartPadding.bottom)

  return `${x.toFixed(1)},${y.toFixed(1)}`
}

export default function ElevationProfileChart({ profile, isCompact }: ElevationProfileChartProps) {
  const { t } = useTranslation()
  const theme = useMantineTheme()
  const points = normalizeElevationProfile(profile)

  if (points.length < 2) {
    return null
  }

  const firstDistance = points[0].distance_m
  const lastDistance = points[points.length - 1].distance_m
  const totalDistance = lastDistance - firstDistance
  const minMax = computeElevationMinMax(points)

  if (!minMax || totalDistance <= 0) {
    return null
  }

  const elevationSpan = minMax.max - minMax.min
  const polylinePoints = points
    .map((point) => buildChartPoint(point, firstDistance, totalDistance, minMax.min, elevationSpan))
    .join(' ')
  const areaPoints = `${chartPadding.left},${chartHeight - chartPadding.bottom} ${polylinePoints} ${
    chartWidth - chartPadding.right
  },${chartHeight - chartPadding.bottom}`

  return (
    <Box data-testid="elevation-profile-chart">
      <Group justify="space-between" gap="xs" wrap="nowrap" mb={4}>
        <Text size="xs" fw={600} lineClamp={1} style={{ minWidth: 0 }}>
          {t('mapElevationProfileLabel')}
        </Text>
        <Text size="xs" c="dimmed" ta="right" style={{ flexShrink: 0 }}>
          {formatMeters(minMax.min, t('unitM'))} - {formatMeters(minMax.max, t('unitM'))}
        </Text>
      </Group>
      <Box
        style={{
          width: '100%',
          aspectRatio: isCompact ? '3.4 / 1' : '3 / 1',
          minHeight: isCompact ? 68 : 82,
        }}
      >
        <svg
          aria-label={t('mapElevationProfileLabel')}
          role="img"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
        >
          <line
            x1={chartPadding.left}
            x2={chartWidth - chartPadding.right}
            y1={chartHeight - chartPadding.bottom}
            y2={chartHeight - chartPadding.bottom}
            stroke={theme.colors.gray[4]}
            strokeWidth="1"
          />
          <polygon points={areaPoints} fill={theme.colors.green[1]} opacity="0.7" />
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={theme.colors.green[7]}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth="2.5"
          />
        </svg>
      </Box>
    </Box>
  )
}

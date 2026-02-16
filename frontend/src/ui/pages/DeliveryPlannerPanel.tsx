import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconRoute } from '@tabler/icons-react'
import { type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { AddressBookEntry } from '../../features/data/dataPortability'
import type { Mode } from '../../features/routing/domain'

type DeliveryPlannerPanelProps = {
  mode: Mode
  returnToStart: boolean
  optimizeStops: boolean
  stops: AddressBookEntry[]
  draggedStopId: string | null
  isRouteLoading: boolean
  canBuildRoute: boolean
  canClearSelection: boolean
  summaryLabel: string
  orderSummaryLabel: string
  onModeChange: (value: string) => void
  onReturnToStartChange: (value: boolean) => void
  onOptimizeStopsChange: (value: boolean) => void
  onStopDragStart: (event: DragEvent<HTMLDivElement>, entryId: string) => void
  onStopDragOver: (event: DragEvent<HTMLDivElement>) => void
  onStopDrop: (event: DragEvent<HTMLDivElement>, targetId: string) => void
  onStopDragEnd: () => void
  onMoveStop: (entryId: string, direction: -1 | 1) => void
  onBuildRoute: () => void
  onClearSelection: () => void
}

export default function DeliveryPlannerPanel({
  mode,
  returnToStart,
  optimizeStops,
  stops,
  draggedStopId,
  isRouteLoading,
  canBuildRoute,
  canClearSelection,
  summaryLabel,
  orderSummaryLabel,
  onModeChange,
  onReturnToStartChange,
  onOptimizeStopsChange,
  onStopDragStart,
  onStopDragOver,
  onStopDrop,
  onStopDragEnd,
  onMoveStop,
  onBuildRoute,
  onClearSelection,
}: DeliveryPlannerPanelProps) {
  const { t } = useTranslation()

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        {t('deliveryPlannerTitle')}
      </Text>
      <Text size="sm" c="dimmed">
        {t('deliveryPlannerBody')}
      </Text>
      <SegmentedControl
        fullWidth
        size="sm"
        radius="xl"
        value={mode}
        onChange={onModeChange}
        data={[
          { label: t('modeWalk'), value: 'walk' },
          { label: t('modeBike'), value: 'bike' },
          { label: t('modeEbike'), value: 'ebike' },
        ]}
      />
      <Checkbox
        checked={returnToStart}
        onChange={(event) => onReturnToStartChange(event.currentTarget.checked)}
        label={t('deliveryReturnToStartLabel')}
      />
      <Checkbox
        checked={optimizeStops}
        onChange={(event) => onOptimizeStopsChange(event.currentTarget.checked)}
        label={t('deliveryOptimizeStopsLabel')}
      />
      <Stack gap={4}>
        <Text size="xs" c="dimmed">
          {t('deliveryStopsOrderTitle')}
        </Text>
        {stops.length === 0 ? (
          <Text size="xs" c="dimmed">
            {t('deliveryStopsOrderEmpty')}
          </Text>
        ) : (
          <Stack gap={6}>
            {stops.map((entry, index) => {
              const canMoveUp = index > 0
              const canMoveDown = index < stops.length - 1
              const isDragging = draggedStopId === entry.id
              return (
                <Paper
                  key={entry.id}
                  withBorder
                  radius="md"
                  p="xs"
                  draggable
                  onDragStart={(event) => onStopDragStart(event, entry.id)}
                  onDragOver={onStopDragOver}
                  onDrop={(event) => onStopDrop(event, entry.id)}
                  onDragEnd={onStopDragEnd}
                  style={{
                    cursor: 'grab',
                    opacity: isDragging ? 0.65 : 1,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" gap="xs">
                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                      <Badge size="sm" variant="light" color="gray">
                        {index + 1}
                      </Badge>
                      <Text size="sm" lineClamp={1}>
                        {entry.name}
                      </Text>
                    </Group>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        disabled={!canMoveUp}
                        onClick={() => onMoveStop(entry.id, -1)}
                        aria-label={t('deliveryMoveStopUpAction')}
                        title={t('deliveryMoveStopUpAction')}
                      >
                        <IconChevronUp size={14} />
                      </ActionIcon>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        disabled={!canMoveDown}
                        onClick={() => onMoveStop(entry.id, 1)}
                        aria-label={t('deliveryMoveStopDownAction')}
                        title={t('deliveryMoveStopDownAction')}
                      >
                        <IconChevronDown size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>
                </Paper>
              )
            })}
          </Stack>
        )}
      </Stack>
      <Text size="xs" c="dimmed">
        {summaryLabel}
      </Text>
      <Text size="xs" c="dimmed">
        {orderSummaryLabel}
      </Text>
      <Group gap="xs" wrap="wrap">
        <Button
          size="sm"
          variant="default"
          leftSection={<IconRoute size={16} />}
          loading={isRouteLoading}
          disabled={!canBuildRoute}
          onClick={onBuildRoute}
        >
          {t('deliveryBuildRouteAction')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onClearSelection}
          disabled={!canClearSelection}
        >
          {t('deliveryClearSelectionAction')}
        </Button>
      </Group>
    </Stack>
  )
}


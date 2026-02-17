import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core'
import { IconMapPinPlus } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { PoiCategory, PoiItem } from '../../../features/routing/domain'

type PoiResultsListProps = {
  isCompact: boolean
  isPoiLoading: boolean
  poiError: boolean
  poiErrorMessage: string | null
  poiItems: PoiItem[]
  hasPoiCategories: boolean
  selectedPoiId: string | null
  poiDetourIds: Set<string>
  poiCategoryLabels: Record<PoiCategory, string>
  onPoiSelect: (poiId: string) => void
  onAddPoiWaypoint: (poi: PoiItem) => Promise<void>
  getPoiDisplayName: (poi: PoiItem) => string
  formatPoiKind: (kind: string | null | undefined) => string | null
  formatDistance: (distanceMeters: number | null) => string
  isRouteLoading: boolean
  borderColor: string
  selectedBorderColor: string
  activeBorderColor: string
}

export default function PoiResultsList({
  isCompact,
  isPoiLoading,
  poiError,
  poiErrorMessage,
  poiItems,
  hasPoiCategories,
  selectedPoiId,
  poiDetourIds,
  poiCategoryLabels,
  onPoiSelect,
  onAddPoiWaypoint,
  getPoiDisplayName,
  formatPoiKind,
  formatDistance,
  isRouteLoading,
  borderColor,
  selectedBorderColor,
  activeBorderColor,
}: PoiResultsListProps) {
  const { t } = useTranslation()

  return (
    <ScrollArea h={isCompact ? 180 : 260} offsetScrollbars>
      <Stack gap="xs">
        {isPoiLoading && (
          <Group gap="xs" align="center">
            <Loader size="xs" />
            <Text size="xs" c="dimmed">
              {t('poiLoading')}
            </Text>
          </Group>
        )}

        {!isPoiLoading && poiError && (
          <Text size="xs" c="red.6">
            {poiErrorMessage ?? t('poiError')}
          </Text>
        )}

        {!isPoiLoading && !poiError && poiItems.length === 0 && hasPoiCategories && (
          <Text size="xs" c="dimmed">
            {t('poiEmpty')}
          </Text>
        )}

        {poiItems.map((poi) => {
          const isSelected = poi.id === selectedPoiId
          const isActive = poiDetourIds.has(poi.id)
          const poiKind = formatPoiKind(poi.kind)
          const categoryLabel = poiCategoryLabels[poi.category]

          return (
            <Paper
              key={poi.id}
              withBorder
              radius="md"
              shadow="none"
              p="xs"
              onClick={() => onPoiSelect(poi.id)}
              style={{
                cursor: 'pointer',
                borderWidth: isActive || isSelected ? 2 : 1,
                borderStyle: 'solid',
                borderColor: isActive
                  ? activeBorderColor
                  : isSelected
                    ? selectedBorderColor
                    : borderColor,
                backgroundColor: isActive
                  ? 'var(--mantine-color-orange-0)'
                  : isSelected
                    ? 'var(--mantine-color-blue-0)'
                    : 'transparent',
              }}
            >
              <Stack gap={4}>
                <Group justify="space-between" align="center" wrap="nowrap" gap={8}>
                  <Text size="sm" fw={600} lineClamp={2} style={{ minWidth: 0, flex: 1 }}>
                    {getPoiDisplayName(poi)}
                  </Text>
                  <Group gap={6} align="center" wrap="nowrap">
                    <Badge
                      size="sm"
                      variant={isActive ? 'filled' : 'light'}
                      color={isActive ? 'orange' : 'gray'}
                    >
                      {formatDistance(poi.distance_m)}
                    </Badge>
                    {isCompact && (
                      <ActionIcon
                        size="sm"
                        variant={isActive ? 'filled' : 'subtle'}
                        color={isActive ? 'orange' : undefined}
                        onClick={(event) => {
                          event.stopPropagation()
                          void onAddPoiWaypoint({
                            ...poi,
                            name: getPoiDisplayName(poi),
                          })
                        }}
                        disabled={isRouteLoading}
                        aria-label={t('poiAddWaypoint')}
                      >
                        <IconMapPinPlus size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                </Group>
                <Group gap={6} wrap="wrap">
                  <Badge size="xs" variant="light" color={isActive ? 'orange' : 'blue'}>
                    {categoryLabel}
                  </Badge>
                  {poiKind && (
                    <Badge size="xs" variant="outline" color="gray">
                      {poiKind}
                    </Badge>
                  )}
                </Group>
                {!isCompact && (
                  <Button
                    size="xs"
                    variant={isActive ? 'filled' : 'light'}
                    onClick={(event) => {
                      event.stopPropagation()
                      void onAddPoiWaypoint({
                        ...poi,
                        name: getPoiDisplayName(poi),
                      })
                    }}
                    disabled={isRouteLoading}
                    leftSection={<IconMapPinPlus size={14} />}
                  >
                    {t('poiAddWaypoint')}
                  </Button>
                )}
              </Stack>
            </Paper>
          )
        })}
      </Stack>
    </ScrollArea>
  )
}

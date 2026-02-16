import { Button, Checkbox, Group, Slider, Stack, Text } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { PoiCategory } from '../../../features/routing/domain'
import type { PoiCategoryOption, PoiCorridorRange } from './types'

type PoiFiltersSectionProps = {
  poiCategoryOptions: PoiCategoryOption[]
  poiCategories: PoiCategory[]
  onPoiCategoryChange: (values: string[]) => void
  poiCorridorMeters: number
  onPoiCorridorMetersChange: (value: number) => void
  hasPoiCategories: boolean
  isPoiLoading: boolean
  onPoiRefresh: () => void
  poiCorridorRange: PoiCorridorRange
}

export default function PoiFiltersSection({
  poiCategoryOptions,
  poiCategories,
  onPoiCategoryChange,
  poiCorridorMeters,
  onPoiCorridorMetersChange,
  hasPoiCategories,
  isPoiLoading,
  onPoiRefresh,
  poiCorridorRange,
}: PoiFiltersSectionProps) {
  const { t } = useTranslation()

  return (
    <Stack gap="sm">
      <Stack gap={6}>
        <Text size="xs" c="dimmed">
          {t('poiFiltersLabel')}
        </Text>
        <Checkbox.Group value={poiCategories} onChange={onPoiCategoryChange}>
          <Group gap="xs" wrap="wrap">
            {poiCategoryOptions.map((category) => (
              <Checkbox
                key={category.value}
                value={category.value}
                label={category.label}
                size="xs"
              />
            ))}
          </Group>
        </Checkbox.Group>
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            {t('poiCorridorLabel', { distance: poiCorridorMeters })}
          </Text>
          <Button
            size="xs"
            variant="subtle"
            onClick={onPoiRefresh}
            disabled={!hasPoiCategories || isPoiLoading}
            leftSection={<IconRefresh size={14} />}
          >
            {t('poiFetch')}
          </Button>
        </Group>
        <Slider
          min={poiCorridorRange.min}
          max={poiCorridorRange.max}
          step={poiCorridorRange.step}
          value={poiCorridorMeters}
          onChange={onPoiCorridorMetersChange}
          label={(value) => `${value} ${t('unitM')}`}
        />
      </Stack>
      {!hasPoiCategories && (
        <Text size="xs" c="orange.6">
          {t('poiSelectAtLeastOne')}
        </Text>
      )}
    </Stack>
  )
}

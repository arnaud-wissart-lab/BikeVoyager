import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  NumberInput,
  Paper,
  ScrollArea,
  Slider,
  Stack,
  Text,
} from '@mantine/core'
import { IconAdjustmentsHorizontal, IconMapPinPlus, IconRefresh, IconX } from '@tabler/icons-react'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import PlaceSearchInput from '../../../components/PlaceSearchInput'
import type { PlaceCandidate } from '../../../components/PlaceSearchInput'
import type { AddressBookEntry } from '../dataPortability'
import type { DetourPoint, PoiCategory, PoiItem } from '../domain'
import DeliveryPlannerPanel from './DeliveryPlannerPanel'

type PoiCategoryOption = {
  value: string
  label: string
}

type PoiPanelProps = {
  isCompact: boolean
  poiCategoryOptions: PoiCategoryOption[]
  poiCategories: PoiCategory[]
  onPoiCategoryChange: (values: string[]) => void
  poiCorridorMeters: number
  onPoiCorridorMetersChange: (value: number) => void
  hasPoiCategories: boolean
  isPoiLoading: boolean
  onPoiRefresh: () => void

  isCustomDetourPanelOpen: boolean
  onToggleCustomDetourPanel: () => void
  detourPoints: DetourPoint[]

  customDetourValue: string
  onCustomDetourValueChange: (value: string) => void
  customDetourPlace: PlaceCandidate | null
  onCustomDetourPlaceSelect: (place: PlaceCandidate | null) => void
  onAddCustomDetourFromAddress: () => Promise<void>

  customDetourLat: number | ''
  customDetourLon: number | ''
  onCustomDetourLatChange: (value: string | number) => void
  onCustomDetourLonChange: (value: string | number) => void
  onAddCustomDetourFromCoordinates: () => Promise<void>
  onRemoveDetourPoint: (detourId: string) => Promise<void>
  addressBookEntries: AddressBookEntry[]
  selectedDeliveryStartId: string | null
  selectedDeliveryStopIds: string[]
  onSelectDeliveryStart: (entryId: string) => void
  onToggleDeliveryStop: (entryId: string) => void
  onAddAddressBookDetour: (entryId: string) => Promise<void>
  deliveryPlannerPanelProps: ComponentProps<typeof DeliveryPlannerPanel>

  isRouteLoading: boolean
  poiError: boolean
  poiErrorMessage: string | null
  poiItems: PoiItem[]
  selectedPoiId: string | null
  poiDetourIds: Set<string>
  poiCategoryLabels: Record<PoiCategory, string>

  onPoiSelect: (poiId: string) => void
  onAddPoiWaypoint: (poi: PoiItem) => Promise<void>
  getPoiDisplayName: (poi: PoiItem) => string
  formatPoiKind: (kind: string | null | undefined) => string | null
  formatDistance: (distanceMeters: number | null) => string

  borderColor: string
  selectedBorderColor: string
  activeBorderColor: string

  poiCorridorRange: {
    min: number
    max: number
    step: number
  }
}

export default function PoiPanel({
  isCompact,
  poiCategoryOptions,
  poiCategories,
  onPoiCategoryChange,
  poiCorridorMeters,
  onPoiCorridorMetersChange,
  hasPoiCategories,
  isPoiLoading,
  onPoiRefresh,
  isCustomDetourPanelOpen,
  onToggleCustomDetourPanel,
  detourPoints,
  customDetourValue,
  onCustomDetourValueChange,
  customDetourPlace,
  onCustomDetourPlaceSelect,
  onAddCustomDetourFromAddress,
  customDetourLat,
  customDetourLon,
  onCustomDetourLatChange,
  onCustomDetourLonChange,
  onAddCustomDetourFromCoordinates,
  onRemoveDetourPoint,
  addressBookEntries,
  selectedDeliveryStartId,
  selectedDeliveryStopIds,
  onSelectDeliveryStart,
  onToggleDeliveryStop,
  onAddAddressBookDetour,
  deliveryPlannerPanelProps,
  isRouteLoading,
  poiError,
  poiErrorMessage,
  poiItems,
  selectedPoiId,
  poiDetourIds,
  poiCategoryLabels,
  onPoiSelect,
  onAddPoiWaypoint,
  getPoiDisplayName,
  formatPoiKind,
  formatDistance,
  borderColor,
  selectedBorderColor,
  activeBorderColor,
  poiCorridorRange,
}: PoiPanelProps) {
  const { t } = useTranslation()
  const addressBookDetourIds = new Set(
    detourPoints
      .filter((detour) => detour.id.startsWith('address-book:'))
      .map((detour) => detour.id.slice('address-book:'.length)),
  )

  return (
    <Stack gap="sm">
      <Stack gap={6}>
        <Text size="xs" c="dimmed">
          {t('poiFiltersLabel')}
        </Text>
        <Checkbox.Group
          value={poiCategories}
          onChange={onPoiCategoryChange}
        >
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

      <Button
        size="xs"
        variant={isCustomDetourPanelOpen ? 'default' : 'light'}
        onClick={onToggleCustomDetourPanel}
        leftSection={<IconAdjustmentsHorizontal size={14} />}
      >
        {isCustomDetourPanelOpen
          ? t('detourManagerHide')
          : detourPoints.length > 0
            ? t('detourManagerShowWithCount', { count: detourPoints.length })
            : t('detourManagerShow')}
      </Button>

      {isCustomDetourPanelOpen && (
        <Paper withBorder radius="md" p={isCompact ? 'xs' : 'sm'}>
          <Stack gap={8}>
            <Text size="xs" c="dimmed">
              {t('detourManagerTitle')}
            </Text>
            <PlaceSearchInput
              label={t('detourAddressLabel')}
              placeholder={t('detourAddressPlaceholder')}
              value={customDetourValue}
              onValueChange={onCustomDetourValueChange}
              onPlaceSelect={onCustomDetourPlaceSelect}
              disabled={isRouteLoading}
              testId="detour-address"
            />
            <Button
              size="xs"
              variant="light"
              disabled={!customDetourPlace || isRouteLoading}
              onClick={() => {
                void onAddCustomDetourFromAddress()
              }}
              leftSection={<IconMapPinPlus size={14} />}
            >
              {t('detourAddAddress')}
            </Button>
            <Stack gap={4}>
              <Text size="xs" c="dimmed">
                {t('detourAddressBookLabel')}
              </Text>
              {addressBookEntries.length === 0 ? (
                <Text size="xs" c="dimmed">
                  {t('detourAddressBookEmpty')}
                </Text>
              ) : (
                <ScrollArea.Autosize mah={isCompact ? 140 : 170} offsetScrollbars>
                  <Stack gap={6}>
                    {addressBookEntries.map((entry) => {
                      const isSelectedAsStart = selectedDeliveryStartId === entry.id
                      const isSelectedAsStop = selectedDeliveryStopIds.includes(entry.id)
                      const isUsedAsDetour = addressBookDetourIds.has(entry.id)
                      return (
                        <Paper key={entry.id} withBorder radius="md" p="xs">
                          <Stack gap={4}>
                            <Text size="xs" fw={600} lineClamp={1}>
                              {entry.name}
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {entry.label}
                            </Text>
                            <Group gap="xs" wrap="wrap">
                              <Button
                                size="xs"
                                variant={isSelectedAsStart ? 'filled' : 'light'}
                                disabled={isRouteLoading}
                                onClick={() => onSelectDeliveryStart(entry.id)}
                              >
                                {t('deliveryStartAction')}
                              </Button>
                              <Button
                                size="xs"
                                variant={isSelectedAsStop ? 'filled' : 'light'}
                                disabled={isSelectedAsStart || isRouteLoading}
                                onClick={() => onToggleDeliveryStop(entry.id)}
                              >
                                {t('deliveryStopAction')}
                              </Button>
                              <Button
                                size="xs"
                                variant={isUsedAsDetour ? 'default' : 'subtle'}
                                disabled={isRouteLoading}
                                onClick={() => {
                                  void onAddAddressBookDetour(entry.id)
                                }}
                                leftSection={<IconMapPinPlus size={14} />}
                              >
                                {isUsedAsDetour
                                  ? t('detourAddressBookAdded')
                                  : t('detourAddressBookAddAction')}
                              </Button>
                            </Group>
                          </Stack>
                        </Paper>
                      )
                    })}
                  </Stack>
                </ScrollArea.Autosize>
              )}
            </Stack>
            <Group grow>
              <NumberInput
                label={t('detourLatitudeLabel')}
                value={customDetourLat}
                onChange={onCustomDetourLatChange}
                min={-90}
                max={90}
                decimalScale={6}
                hideControls
              />
              <NumberInput
                label={t('detourLongitudeLabel')}
                value={customDetourLon}
                onChange={onCustomDetourLonChange}
                min={-180}
                max={180}
                decimalScale={6}
                hideControls
              />
            </Group>
            <Button
              size="xs"
              variant="default"
              disabled={
                isRouteLoading ||
                typeof customDetourLat !== 'number' ||
                typeof customDetourLon !== 'number' ||
                customDetourLat < -90 ||
                customDetourLat > 90 ||
                customDetourLon < -180 ||
                customDetourLon > 180
              }
              onClick={() => {
                void onAddCustomDetourFromCoordinates()
              }}
              leftSection={<IconMapPinPlus size={14} />}
            >
              {t('detourAddCoordinates')}
            </Button>
            {detourPoints.length > 0 && (
              <Stack gap={4}>
                <Text size="xs" c="dimmed">
                  {t('detourListLabel', { count: detourPoints.length })}
                </Text>
                <ScrollArea.Autosize mah={isCompact ? 96 : 126} offsetScrollbars>
                  <Stack gap={4}>
                    {detourPoints.map((detour) => (
                      <Group key={detour.id} justify="space-between" align="center" wrap="nowrap">
                        <Stack gap={0} style={{ minWidth: 0 }}>
                          <Text size="xs" fw={600} lineClamp={1}>
                            {detour.label}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {detour.source === 'poi' ? t('detourTypePoi') : t('detourTypeCustom')}
                          </Text>
                        </Stack>
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={() => {
                            void onRemoveDetourPoint(detour.id)
                          }}
                          aria-label={t('detourRemoveLabel')}
                        >
                          <IconX size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea.Autosize>
              </Stack>
            )}
            <DeliveryPlannerPanel {...deliveryPlannerPanelProps} />
          </Stack>
        </Paper>
      )}

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
    </Stack>
  )
}

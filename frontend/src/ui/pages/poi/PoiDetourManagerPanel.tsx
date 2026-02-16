import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from '@mantine/core'
import { IconAdjustmentsHorizontal, IconMapPinPlus, IconX } from '@tabler/icons-react'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import PlaceSearchInput from '../../../components/PlaceSearchInput'
import type { PlaceCandidate } from '../../../components/PlaceSearchInput'
import type { AddressBookEntry } from '../../../features/data/dataPortability'
import type { DetourPoint } from '../../../features/routing/domain'
import DeliveryPlannerPanel from '../DeliveryPlannerPanel'

type PoiDetourManagerPanelProps = {
  isCompact: boolean
  isOpen: boolean
  onToggle: () => void
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
  addressBookDetourIds: Set<string>
  selectedDeliveryStartId: string | null
  selectedDeliveryStopIds: string[]
  onSelectDeliveryStart: (entryId: string) => void
  onToggleDeliveryStop: (entryId: string) => void
  onAddAddressBookDetour: (entryId: string) => Promise<void>
  deliveryPlannerPanelProps: ComponentProps<typeof DeliveryPlannerPanel>
  isRouteLoading: boolean
}

export default function PoiDetourManagerPanel({
  isCompact,
  isOpen,
  onToggle,
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
  addressBookDetourIds,
  selectedDeliveryStartId,
  selectedDeliveryStopIds,
  onSelectDeliveryStart,
  onToggleDeliveryStop,
  onAddAddressBookDetour,
  deliveryPlannerPanelProps,
  isRouteLoading,
}: PoiDetourManagerPanelProps) {
  const { t } = useTranslation()

  return (
    <>
      <Button
        size="xs"
        variant={isOpen ? 'default' : 'light'}
        onClick={onToggle}
        leftSection={<IconAdjustmentsHorizontal size={14} />}
      >
        {isOpen
          ? t('detourManagerHide')
          : detourPoints.length > 0
            ? t('detourManagerShowWithCount', { count: detourPoints.length })
            : t('detourManagerShow')}
      </Button>

      {isOpen && (
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
    </>
  )
}

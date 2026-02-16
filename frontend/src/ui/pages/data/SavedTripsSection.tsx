import { ActionIcon, Badge, Button, Group, Paper, ScrollArea, Stack, Text } from '@mantine/core'
import { IconTrash } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import type { SavedTripRecord } from '../../../features/data/dataPortability'

type SavedTripsSectionProps = {
  isDesktop: boolean
  isFrench: boolean
  savedTrips: SavedTripRecord[]
  formatDistance: (distanceMeters: number) => string
  onOpenSavedTrip: (trip: SavedTripRecord) => void
  onExportSavedTrip: (trip: SavedTripRecord) => void | Promise<void>
  onDeleteSavedTripRequest: (trip: SavedTripRecord) => void
}

export default function SavedTripsSection({
  isDesktop,
  isFrench,
  savedTrips,
  formatDistance,
  onOpenSavedTrip,
  onExportSavedTrip,
  onDeleteSavedTripRequest,
}: SavedTripsSectionProps) {
  const { t } = useTranslation()

  if (savedTrips.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('dataSavedTripsEmpty')}
      </Text>
    )
  }

  return (
    <ScrollArea.Autosize mah={isDesktop ? 320 : 260} offsetScrollbars>
      <Stack gap={8}>
        {savedTrips.map((trip) => (
          <Paper key={trip.id} withBorder radius="md" p="sm">
            <Stack gap={6}>
              <Group justify="space-between" align="center" wrap="nowrap">
                <Text size="sm" fw={600} lineClamp={1}>
                  {trip.name}
                </Text>
                <Badge variant="outline">
                  {trip.tripType === 'loop' ? t('typeLoop') : t('typeOneWay')}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {new Date(trip.savedAt).toLocaleString(isFrench ? 'fr-FR' : 'en-US')} •{' '}
                {formatDistance(trip.trip.distance_m)}
              </Text>
              <Group gap="xs" wrap="nowrap">
                <Button size="xs" variant="default" onClick={() => onOpenSavedTrip(trip)}>
                  {t('dataSavedTripOpen')}
                </Button>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => {
                    void onExportSavedTrip(trip)
                  }}
                >
                  {t('dataSavedTripExport')}
                </Button>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="red"
                  onClick={() => onDeleteSavedTripRequest(trip)}
                  aria-label={t('dataSavedTripDelete')}
                  title={t('dataSavedTripDelete')}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </ScrollArea.Autosize>
  )
}

import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconCopy,
  IconEdit,
  IconFileExport,
  IconFileTypeXml,
  IconMap2,
  IconSearch,
  IconStar,
  IconStarFilled,
  IconTrash,
} from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SavedTripRecord } from '../../../features/data/dataPortability'
import {
  filterSavedTripsForLibrary,
  type SavedTripLibraryFilter,
} from '../../../features/data/savedTripsLibrary'

type SavedTripsSectionProps = {
  isDesktop: boolean
  isFrench: boolean
  savedTrips: SavedTripRecord[]
  formatDistance: (distanceMeters: number) => string
  onOpenSavedTrip: (trip: SavedTripRecord) => void
  onExportSavedTrip: (trip: SavedTripRecord) => void | Promise<void>
  onExportSavedTripGpx: (trip: SavedTripRecord) => void | Promise<void>
  onEditSavedTripRequest: (trip: SavedTripRecord) => void
  onDuplicateSavedTrip: (trip: SavedTripRecord) => void
  onDeleteSavedTripRequest: (trip: SavedTripRecord) => void
}

export default function SavedTripsSection({
  isDesktop,
  isFrench,
  savedTrips,
  formatDistance,
  onOpenSavedTrip,
  onExportSavedTrip,
  onExportSavedTripGpx,
  onEditSavedTripRequest,
  onDuplicateSavedTrip,
  onDeleteSavedTripRequest,
}: SavedTripsSectionProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SavedTripLibraryFilter>('all')
  const visibleTrips = useMemo(
    () => filterSavedTripsForLibrary(savedTrips, { query, filter }),
    [filter, query, savedTrips],
  )

  const formatDuration = (seconds: number | null) => {
    if (!seconds || !Number.isFinite(seconds)) {
      return t('placeholderValue')
    }

    const totalMinutes = Math.round(seconds / 60)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (hours <= 0) {
      return `${minutes} ${t('unitMin')}`
    }

    return minutes > 0
      ? `${hours} ${t('unitHour')} ${minutes} ${t('unitMin')}`
      : `${hours} ${t('unitHour')}`
  }

  const getModeLabel = (trip: SavedTripRecord) => {
    if (trip.mode === 'walk') {
      return t('modeWalk')
    }

    if (trip.mode === 'ebike') {
      return t('modeEbike')
    }

    return trip.mode === 'bike' ? t('modeBike') : t('placeholderValue')
  }

  const getDurationSeconds = (trip: SavedTripRecord) =>
    trip.trip.kind === 'route' ? trip.trip.eta_s || trip.trip.duration_s_engine : trip.trip.eta_s

  if (savedTrips.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('dataSavedTripsEmpty')}
      </Text>
    )
  }

  return (
    <Stack gap="sm">
      <TextInput
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        placeholder={t('dataSavedTripSearchPlaceholder')}
        leftSection={<IconSearch size={16} />}
      />
      <SegmentedControl
        value={filter}
        onChange={(value) => setFilter(value as SavedTripLibraryFilter)}
        fullWidth={!isDesktop}
        data={[
          { value: 'all', label: t('dataSavedTripFilterAll') },
          { value: 'favorites', label: t('dataSavedTripFilterFavorites') },
          { value: 'routes', label: t('dataSavedTripFilterRoutes') },
          { value: 'loops', label: t('dataSavedTripFilterLoops') },
        ]}
      />
      {visibleTrips.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('dataSavedTripsNoMatch')}
        </Text>
      ) : (
        <ScrollArea.Autosize mah={isDesktop ? 420 : 340} offsetScrollbars>
          <Stack gap={8}>
            {visibleTrips.map((trip) => (
              <Paper key={trip.id} withBorder radius="md" p="sm">
                <Stack gap={8}>
                  <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                    <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                      <Group gap={6} wrap="nowrap">
                        {trip.favorite ? (
                          <IconStarFilled size={15} color="var(--mantine-color-yellow-6)" />
                        ) : (
                          <IconStar size={15} color="var(--mantine-color-dimmed)" />
                        )}
                        <Text size="sm" fw={600} lineClamp={1}>
                          {trip.name}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        {new Date(trip.updatedAt).toLocaleString(isFrench ? 'fr-FR' : 'en-US')}
                      </Text>
                    </Stack>
                    <Badge variant="outline">
                      {trip.tripType === 'loop' ? t('typeLoop') : t('typeOneWay')}
                    </Badge>
                  </Group>
                  <Group gap={6}>
                    <Badge variant="light">{formatDistance(trip.trip.distance_m)}</Badge>
                    <Badge variant="light">{formatDuration(getDurationSeconds(trip))}</Badge>
                    <Badge variant="light">{getModeLabel(trip)}</Badge>
                  </Group>
                  {trip.notes && (
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {trip.notes}
                    </Text>
                  )}
                  {trip.tags.length > 0 && (
                    <Group gap={6}>
                      {trip.tags.map((tag) => (
                        <Badge key={tag} size="sm" variant="dot">
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  )}
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={<IconMap2 size={14} />}
                      onClick={() => onOpenSavedTrip(trip)}
                    >
                      {t('dataSavedTripOpen')}
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconFileTypeXml size={14} />}
                      onClick={() => {
                        void onExportSavedTripGpx(trip)
                      }}
                    >
                      {t('dataSavedTripExportGpx')}
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconFileExport size={14} />}
                      onClick={() => {
                        void onExportSavedTrip(trip)
                      }}
                    >
                      {t('dataSavedTripExportBikeVoyager')}
                    </Button>
                    <Tooltip label={t('dataSavedTripEdit')}>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => onEditSavedTripRequest(trip)}
                        aria-label={t('dataSavedTripEdit')}
                      >
                        <IconEdit size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('dataSavedTripDuplicate')}>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={() => onDuplicateSavedTrip(trip)}
                        aria-label={t('dataSavedTripDuplicate')}
                      >
                        <IconCopy size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={t('dataSavedTripDelete')}>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => onDeleteSavedTripRequest(trip)}
                        aria-label={t('dataSavedTripDelete')}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Stack>
  )
}

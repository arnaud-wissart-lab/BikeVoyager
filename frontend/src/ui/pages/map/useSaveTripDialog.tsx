import type { TFunction } from 'i18next'
import { useMemo, useState } from 'react'
import type { SavedTripMetadataInput } from '../../../features/data/dataPortability'
import type { TripResult } from '../../../features/routing/domain'
import SavedTripMetadataDialog from '../data/SavedTripMetadataDialog'

type UseSaveTripDialogParams = {
  routeResult: TripResult | null
  startLabel: string
  endLabel: string
  isFrench: boolean
  t: TFunction
  onSave: (metadata: SavedTripMetadataInput) => void
}

export const useSaveTripDialog = ({
  routeResult,
  startLabel,
  endLabel,
  isFrench,
  t,
  onSave,
}: UseSaveTripDialogParams) => {
  const [opened, setOpened] = useState(false)
  const suggestedName = useMemo(() => {
    const fallbackDate = new Date().toLocaleDateString(isFrench ? 'fr-FR' : 'en-US')
    if (!routeResult) {
      return t('dataSavedTripDatedDefaultName', { date: fallbackDate })
    }

    if (routeResult.kind === 'loop') {
      return startLabel
        ? t('dataSavedTripLoopSuggestedName', { start: startLabel })
        : t('dataSavedTripDatedDefaultName', { date: fallbackDate })
    }

    return startLabel && endLabel
      ? t('dataSavedTripRouteSuggestedName', { start: startLabel, end: endLabel })
      : t('dataSavedTripDatedDefaultName', { date: fallbackDate })
  }, [endLabel, isFrench, routeResult, startLabel, t])

  const initialValues: SavedTripMetadataInput = useMemo(
    () => ({
      name: suggestedName,
      notes: '',
      tags: [],
      favorite: false,
    }),
    [suggestedName],
  )

  return {
    open: () => setOpened(true),
    node: (
      <SavedTripMetadataDialog
        opened={opened}
        title={t('dataSaveTrip')}
        submitLabel={t('dataSavedTripSaveAction')}
        initialValues={initialValues}
        onClose={() => setOpened(false)}
        onSubmit={(metadata) => {
          onSave(metadata)
          setOpened(false)
        }}
      />
    ),
  }
}
